/**
 * generateController.js — V2
 * ──────────────────────────
 * Handles all audio generation endpoints:
 * 
 * V1 (kept):
 *   POST /process-text → clean text, create session, split pages
 *
 * V2 (new):
 *   POST /stream-read → real-time streaming: chunk → translate → TTS → SSE
 *   POST /stop-reading → stop a running stream
 *   GET /session/:id → get session info
 * 
 * Streaming flow (per micro-chunk):
 *   1. Split text from startOffset into ~100 word chunks
 *   2. For each chunk: detect lang → translate if needed → TTS with subtitles
 *   3. Stream audio URL + word timings via SSE
 *   4. Frontend plays chunk N while backend processes chunk N+1
 *   5. Frontend requests next chunk when 70% played (smart pre-fetch)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { cleanText, splitIntoPages } from '../services/textCleaner.js';
import { microChunk } from '../services/chunkService.js';
import { smartTranslate } from '../services/translationService.js';
import { generateChunkWithTimings } from '../services/ttsService.js';
import { detectLanguage } from '../services/languageDetector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUDIO_DIR = path.join(__dirname, '..', 'audio');

// Ensure audio directory exists
if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// ─── Session Store ───
const sessions = new Map();
// Track active streams so they can be stopped
const activeStreams = new Map();

// Auto-clean sessions after 2 hours
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if (now - session.lastAccess > 2 * 60 * 60 * 1000) {
            cleanupSession(id);
        }
    }
}, 30 * 60 * 1000);

function cleanupSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return;

    // Clean up audio files
    const sessionAudioDir = path.join(AUDIO_DIR, sessionId);
    if (fs.existsSync(sessionAudioDir)) {
        fs.rmSync(sessionAudioDir, { recursive: true, force: true });
    }

    sessions.delete(sessionId);
    activeStreams.delete(sessionId);
    console.log(`🗑️ Session cleaned: ${sessionId}`);
}

/**
 * POST /api/process-text
 * Receives extracted text from frontend, cleans it, creates session
 */
export async function processText(req, res) {
    try {
        const { text } = req.body;
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'No text provided' });
        }

        const sessionId = uuidv4();

        // Clean and process text
        const cleaned = cleanText(text);
        const pages = splitIntoPages(cleaned);

        // Detect source language
        const detected = detectLanguage(cleaned);

        // Create session audio directory
        const sessionAudioDir = path.join(AUDIO_DIR, sessionId);
        fs.mkdirSync(sessionAudioDir, { recursive: true });

        // Store session
        sessions.set(sessionId, {
            id: sessionId,
            fullText: cleaned,
            pages: pages,
            detectedLanguage: detected,
            audioCacheMap: new Map(),
            lastAccess: Date.now(),
        });

        console.log(`\n📚 Session created: ${sessionId}`);
        console.log(`   Pages: ${pages.length}, Detected: ${detected.name} (${detected.confidence})`);

        res.json({
            sessionId,
            totalPages: pages.length,
            detectedLanguage: detected,
            pagePreviews: pages.map((p, i) => ({
                page: i + 1,
                preview: p.substring(0, 200) + (p.length > 200 ? '...' : ''),
                length: p.length,
            })),
        });

    } catch (error) {
        console.error('Process text error:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * POST /api/stream-read
 * Real-time streaming TTS with SSE
 * Body: { sessionId, language, pageIndex, startOffset? }
 * 
 * SSE events:
 *   { type: 'chunk-ready', chunkIndex, audioUrl, wordTimings, text, charStart, charEnd, translated }
 *   { type: 'page-done', pageIndex }
 *   { type: 'error', message }
 */
export async function streamRead(req, res) {
    const { sessionId, language, pageIndex, startOffset = 0 } = req.body;

    // Validate session
    const session = sessions.get(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    if (pageIndex < 0 || pageIndex >= session.pages.length) {
        return res.status(400).json({ error: 'Invalid page index' });
    }

    session.lastAccess = Date.now();

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const streamId = `${sessionId}-${Date.now()}`;
    activeStreams.set(streamId, { active: true });

    const sendEvent = (data) => {
        try {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (e) {
            // Client disconnected
        }
    };

    // Handle client disconnect
    req.on('close', () => {
        activeStreams.delete(streamId);
        console.log(`  🔌 Stream disconnected: ${streamId}`);
    });

    try {
        const pageText = session.pages[pageIndex];
        const { chunks } = microChunk(pageText, startOffset);

        console.log(`\n🎙️ Streaming: page ${pageIndex + 1}, ${chunks.length} chunks, lang=${language}`);

        // Send initial info
        sendEvent({
            type: 'stream-start',
            totalChunks: chunks.length,
            detectedLanguage: session.detectedLanguage,
            needsTranslation: session.detectedLanguage.code !== language,
        });

        const sessionAudioDir = path.join(AUDIO_DIR, sessionId);

        for (let i = 0; i < chunks.length; i++) {
            // Check if stream was stopped
            const stream = activeStreams.get(streamId);
            if (!stream || !stream.active) {
                sendEvent({ type: 'stopped' });
                break;
            }

            const chunk = chunks[i];
            const audioFileName = `chunk_p${pageIndex}_${language}_${i}_${Date.now()}.mp3`;
            const audioFilePath = path.join(sessionAudioDir, audioFileName);

            try {
                // Step 1: Translate if needed
                let textToSpeak = chunk.text;
                let wasTranslated = false;

                const translationResult = await smartTranslate(
                    chunk.text,
                    language,
                    `${sessionId}_p${pageIndex}_chunk${i}_${language}`
                );

                textToSpeak = translationResult.text;
                wasTranslated = translationResult.translated;

                // Step 2: Generate speech with word timings
                const { audioPath, wordTimings } = await generateChunkWithTimings(
                    textToSpeak,
                    language,
                    audioFilePath
                );

                // Step 3: Send chunk data to frontend
                sendEvent({
                    type: 'chunk-ready',
                    chunkIndex: i,
                    totalChunks: chunks.length,
                    audioUrl: `http://localhost:3001/audio/${sessionId}/${audioFileName}`,
                    wordTimings: wordTimings,
                    originalText: chunk.text,
                    spokenText: textToSpeak,
                    charStart: chunk.charStart,
                    charEnd: chunk.charEnd,
                    translated: wasTranslated,
                });

                console.log(`  ✅ Chunk ${i + 1}/${chunks.length} ready (${wordTimings.length} words)`);

            } catch (chunkError) {
                console.error(`  ❌ Chunk ${i} error:`, chunkError.message);
                sendEvent({
                    type: 'chunk-error',
                    chunkIndex: i,
                    message: chunkError.message,
                });
            }
        }

        // All chunks done
        sendEvent({ type: 'page-done', pageIndex });

    } catch (error) {
        console.error('Stream error:', error);
        sendEvent({ type: 'error', message: error.message });
    } finally {
        activeStreams.delete(streamId);
        res.end();
    }
}

/**
 * POST /api/stop-reading
 * Stops an active reading stream
 */
export async function stopReading(req, res) {
    const { sessionId } = req.body;

    // Stop all active streams for this session
    let stopped = 0;
    for (const [streamId, stream] of activeStreams) {
        if (streamId.startsWith(sessionId)) {
            stream.active = false;
            stopped++;
        }
    }

    res.json({ stopped, message: stopped > 0 ? 'Reading stopped' : 'No active reading' });
}

/**
 * GET /api/session/:id
 * Returns session info
 */
export async function getSession(req, res) {
    const session = sessions.get(req.params.id);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
        id: session.id,
        totalPages: session.pages.length,
        detectedLanguage: session.detectedLanguage,
    });
}
