/**
 * generateController.js
 * ─────────────────────
 * Controller for the /api/process-text and /api/generate endpoints.
 * 
 * Flow:
 * 1. POST /api/process-text → receive extracted text, clean it, store in session, return pages
 * 2. POST /api/generate → translate page (if needed) → chunk → TTS → merge → return audio URL
 * 
 * Uses SSE (Server-Sent Events) for real-time progress updates during generation.
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { cleanText, splitIntoPages } from '../services/textCleaner.js';
import { chunkText } from '../services/chunkService.js';
import { translateText, clearTranslationCache } from '../services/translationService.js';
import { generateChunkSpeech } from '../services/ttsService.js';
import { mergeAudioFiles, cleanupChunks } from '../services/audioMergeService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const audioDir = path.join(__dirname, '..', 'audio');

// ─── Session Store ───
// Stores { originalText, pages[], audioCache: { 'en_0': 'filename.mp3', ... } }
const sessions = new Map();

// Auto-cleanup sessions after 2 hours
const SESSION_TTL = 2 * 60 * 60 * 1000;

/**
 * POST /api/process-text
 * Receives extracted text from client, cleans it, splits into pages, and returns session info.
 */
export async function processText(req, res) {
    try {
        const { text } = req.body;

        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({ error: 'No text provided. Please upload a valid PDF.' });
        }

        console.log(`\n📄 Received text: ${text.length} characters`);

        // Clean the text
        const cleanedText = cleanText(text);
        console.log(`  🧹 Cleaned text: ${cleanedText.length} characters`);

        // Split into pages
        const pages = splitIntoPages(cleanedText);
        console.log(`  📖 Split into ${pages.length} pages`);

        // Create session
        const sessionId = uuidv4();
        sessions.set(sessionId, {
            originalText: cleanedText,
            pages: pages,
            audioCache: {},
            createdAt: Date.now()
        });

        // Schedule auto-cleanup
        setTimeout(() => {
            cleanupSession(sessionId);
        }, SESSION_TTL);

        res.json({
            sessionId,
            totalPages: pages.length,
            pagePreviews: pages.map((p, i) => ({
                pageIndex: i,
                preview: p.substring(0, 150) + (p.length > 150 ? '...' : ''),
                charCount: p.length
            }))
        });
    } catch (error) {
        console.error('❌ Process text error:', error);
        res.status(500).json({ error: 'Failed to process text', message: error.message });
    }
}

/**
 * POST /api/generate
 * Generates audio for a specific page in a specific language.
 * Uses SSE to stream progress updates.
 * 
 * Body: { sessionId, language: 'en'|'hi'|'bn', pageIndex: number }
 */
export async function generateAudio(req, res) {
    try {
        const { sessionId, language, pageIndex } = req.body;

        // Validate
        if (!sessionId || !sessions.has(sessionId)) {
            return res.status(400).json({ error: 'Invalid or expired session. Please re-upload the PDF.' });
        }

        if (!['en', 'hi', 'bn'].includes(language)) {
            return res.status(400).json({ error: 'Unsupported language. Use en, hi, or bn.' });
        }

        const session = sessions.get(sessionId);
        const page = pageIndex !== undefined ? parseInt(pageIndex) : 0;

        if (page < 0 || page >= session.pages.length) {
            return res.status(400).json({ error: `Invalid page index. Valid range: 0-${session.pages.length - 1}` });
        }

        // Check audio cache
        const cacheKey = `${language}_${page}`;
        if (session.audioCache[cacheKey]) {
            const cachedFile = session.audioCache[cacheKey];
            const cachedPath = path.join(audioDir, cachedFile);
            if (fs.existsSync(cachedPath)) {
                console.log(`  ⚡ Cache hit: ${cacheKey}`);
                return res.json({
                    audioUrl: `/audio/${cachedFile}`,
                    language,
                    pageIndex: page,
                    cached: true
                });
            }
        }

        // ─── Set up SSE ───
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const sendProgress = (step, progress, message) => {
            res.write(`data: ${JSON.stringify({ type: 'progress', step, progress, message })}\n\n`);
        };

        console.log(`\n🎬 Generating audio: page ${page}, language: ${language}`);
        sendProgress('start', 0, 'Starting audio generation...');

        // Step 1: Get page text
        let pageText = session.pages[page];

        // Step 2: Translate if needed
        if (language !== 'en') {
            sendProgress('translating', 20, `Translating to ${language === 'hi' ? 'Hindi' : 'Bengali'}...`);

            const translationCacheKey = `${sessionId}_${language}_${page}`;
            pageText = await translateText(pageText, language, translationCacheKey);

            sendProgress('translated', 40, 'Translation complete');
        } else {
            sendProgress('translated', 40, 'Using original English text');
        }

        // Step 3: Chunk the text
        sendProgress('chunking', 45, 'Preparing text for speech...');
        const chunks = chunkText(pageText);
        console.log(`  ✂️ Split into ${chunks.length} chunks`);

        // Step 4: Generate TTS for each chunk
        const chunkPaths = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunkProgress = 45 + Math.round((i / chunks.length) * 40);
            sendProgress('generating', chunkProgress, `Generating speech... (${i + 1}/${chunks.length})`);

            const chunkFilename = `${sessionId}_${language}_p${page}_c${i}.mp3`;
            const chunkPath = path.join(audioDir, chunkFilename);

            await generateChunkSpeech(chunks[i], language, chunkPath);
            chunkPaths.push(chunkPath);
        }

        // Step 5: Merge audio chunks
        sendProgress('merging', 88, 'Creating seamless audio...');

        const finalFilename = `${sessionId}_${language}_page${page}.mp3`;
        const finalPath = path.join(audioDir, finalFilename);
        await mergeAudioFiles(chunkPaths, finalPath);

        // Cleanup temp chunks
        cleanupChunks(chunkPaths);

        // Cache the result
        session.audioCache[cacheKey] = finalFilename;

        sendProgress('complete', 100, 'Audio ready!');

        // Send final result
        res.write(`data: ${JSON.stringify({
            type: 'complete',
            audioUrl: `/audio/${finalFilename}`,
            language,
            pageIndex: page,
            cached: false
        })}\n\n`);

        res.end();
        console.log(`  ✅ Audio ready: ${finalFilename}`);

    } catch (error) {
        console.error('❌ Generate error:', error);

        // If SSE headers were already sent
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
        } else {
            res.status(500).json({ error: 'Audio generation failed', message: error.message });
        }
    }
}

/**
 * GET /api/session/:sessionId
 * Returns session info (pages, cached audio, etc.)
 */
export function getSessionInfo(req, res) {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
        return res.status(404).json({ error: 'Session not found or expired' });
    }

    res.json({
        totalPages: session.pages.length,
        audioCache: Object.keys(session.audioCache).reduce((acc, key) => {
            acc[key] = `/audio/${session.audioCache[key]}`;
            return acc;
        }, {}),
        pagePreviews: session.pages.map((p, i) => ({
            pageIndex: i,
            preview: p.substring(0, 150) + (p.length > 150 ? '...' : ''),
            charCount: p.length
        }))
    });
}

/**
 * Cleanup a session and its audio files
 */
function cleanupSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return;

    // Delete all audio files for this session
    try {
        const files = fs.readdirSync(audioDir);
        for (const file of files) {
            if (file.startsWith(sessionId)) {
                fs.unlinkSync(path.join(audioDir, file));
            }
        }
    } catch (err) {
        // Non-critical
    }

    // Clear translation cache
    clearTranslationCache(sessionId);

    // Remove session
    sessions.delete(sessionId);
    console.log(`🧹 Session cleaned: ${sessionId.substring(0, 8)}`);
}
