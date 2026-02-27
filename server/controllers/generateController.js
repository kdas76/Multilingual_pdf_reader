import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { cleanText, splitIntoPages } from '../services/textCleaner.js';
import { microChunk, chunkText } from '../services/chunkService.js';
import { smartTranslate, clearTranslationCache } from '../services/translationService.js';
import { generateChunkWithTimings } from '../services/ttsService.js';
import { detectLanguage } from '../services/languageDetector.js';
import { mergeAudioFiles, cleanupChunks } from '../services/audioMergeService.js';
import {
    upsertSession,
    getSessionById,
    deleteSessionById,
    listSessionEntries,
    touchSession,
} from '../services/sessionStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUDIO_DIR = path.join(__dirname, '..', 'audio');

if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

const activeStreams = new Map();
const TRANSLATION_TIMEOUT_MS = 45000;
const TTS_TIMEOUT_MS = 180000;

function clampSpeed(speed) {
    const numeric = Number(speed);
    if (!Number.isFinite(numeric)) return 1;
    return Math.max(0.5, Math.min(2, numeric));
}

function normalizeVoiceGender(voiceGender) {
    return voiceGender === 'male' ? 'male' : 'female';
}

function withTimeout(promise, timeoutMs, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
    ]);
}

setInterval(() => {
    const now = Date.now();
    for (const [id, session] of listSessionEntries()) {
        if (now - session.lastAccess > 2 * 60 * 60 * 1000) {
            cleanupSession(id);
        }
    }
}, 30 * 60 * 1000);

function cleanupSession(sessionId) {
    const session = getSessionById(sessionId);
    if (!session) return;

    const sessionAudioDir = path.join(AUDIO_DIR, sessionId);
    if (fs.existsSync(sessionAudioDir)) {
        fs.rmSync(sessionAudioDir, { recursive: true, force: true });
    }

    clearTranslationCache(sessionId);
    deleteSessionById(sessionId);

    for (const [streamId, stream] of activeStreams) {
        if (stream.sessionId === sessionId) {
            activeStreams.delete(streamId);
        }
    }
}

function buildPagesFromRequest(rawText, rawPages) {
    if (Array.isArray(rawPages) && rawPages.length > 0) {
        const normalizedPages = rawPages.map((page) =>
            String(page || '')
                .replace(/\s+/g, ' ')
                .trim()
        );
        const hasAnyText = normalizedPages.some((page) => page.length > 0);
        if (hasAnyText) return normalizedPages;
    }

    const cleanedText = cleanText(rawText || '');
    const splitPages = splitIntoPages(cleanedText);
    return splitPages.length > 0 ? splitPages : [cleanedText];
}

export async function processText(req, res) {
    try {
        const { text, pages } = req.body || {};
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'No text provided' });
        }

        const sessionId = uuidv4();
        const normalizedPages = buildPagesFromRequest(text, pages);
        const fullText = normalizedPages.join('\n\n').trim();
        const detected = detectLanguage(fullText || cleanText(text));

        const sessionAudioDir = path.join(AUDIO_DIR, sessionId);
        fs.mkdirSync(sessionAudioDir, { recursive: true });

        upsertSession({
            id: sessionId,
            fullText,
            pages: normalizedPages,
            detectedLanguage: detected,
            audioCacheMap: new Map(),
            lastAccess: Date.now(),
        });

        res.json({
            sessionId,
            totalPages: normalizedPages.length,
            detectedLanguage: detected,
            pagePreviews: normalizedPages.map((pageText, i) => ({
                page: i + 1,
                preview: pageText
                    ? `${pageText.substring(0, 200)}${pageText.length > 200 ? '...' : ''}`
                    : '(No extractable text on this page)',
                length: pageText.length,
            })),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function streamRead(req, res) {
    const {
        sessionId,
        language,
        pageIndex,
        startOffset = 0,
        speed = 1,
        voiceGender = 'female',
    } = req.body || {};

    const session = getSessionById(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= session.pages.length) {
        return res.status(400).json({ error: 'Invalid page index' });
    }

    touchSession(sessionId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const streamId = `${sessionId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    activeStreams.set(streamId, { active: true, sessionId });

    const sendEvent = (data) => {
        try {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
            // Client disconnected
        }
    };

    const closeStream = () => {
        const stream = activeStreams.get(streamId);
        if (stream) stream.active = false;
        activeStreams.delete(streamId);
    };

    // Important: do not use req.close for SSE lifecycle, it can fire when request body ends.
    req.on('aborted', closeStream);
    res.on('close', closeStream);

    try {
        const pageText = session.pages[pageIndex] || '';
        const playback = {
            speed: clampSpeed(speed),
            voiceGender: normalizeVoiceGender(voiceGender),
        };
        const safeStartOffset = Math.max(
            0,
            Math.min(Number(startOffset) || 0, Math.max(pageText.length - 1, 0))
        );
        const { chunks } = microChunk(pageText, safeStartOffset);
        const sourceLanguageCode = session.detectedLanguage?.code || 'en';

        sendEvent({
            type: 'stream-start',
            totalChunks: chunks.length,
            detectedLanguage: session.detectedLanguage,
            needsTranslation: sourceLanguageCode !== language,
        });

        const sessionAudioDir = path.join(AUDIO_DIR, sessionId);

        for (let i = 0; i < chunks.length; i++) {
            const stream = activeStreams.get(streamId);
            if (!stream || !stream.active) {
                sendEvent({ type: 'stopped' });
                break;
            }

            const chunk = chunks[i];
            const audioFileName = `chunk_p${pageIndex}_${language}_${i}_${Date.now()}.mp3`;
            const audioFilePath = path.join(sessionAudioDir, audioFileName);

            try {
                let translationResult;
                try {
                    translationResult = await withTimeout(
                        smartTranslate(
                            chunk.text,
                            language,
                            `${sessionId}_p${pageIndex}_chunk${i}_${language}`,
                            sourceLanguageCode
                        ),
                        TRANSLATION_TIMEOUT_MS,
                        'Translation'
                    );
                } catch {
                    // Fallback so reading does not halt on translation failures.
                    translationResult = {
                        text: chunk.text,
                        translated: false,
                        sourceLang: sourceLanguageCode,
                    };
                }

                let spokenText = translationResult.text;
                let translated = translationResult.translated;
                let wordTimings = [];

                try {
                    const ttsResult = await withTimeout(
                        generateChunkWithTimings(
                            spokenText,
                            language,
                            audioFilePath,
                            playback
                        ),
                        TTS_TIMEOUT_MS,
                        'TTS'
                    );
                    wordTimings = ttsResult.wordTimings;
                } catch {
                    // Keep reading alive when translated text synthesis fails.
                    spokenText = chunk.text;
                    translated = false;
                    const fallbackTtsResult = await withTimeout(
                        generateChunkWithTimings(
                            spokenText,
                            language,
                            audioFilePath,
                            playback
                        ),
                        TTS_TIMEOUT_MS,
                        'TTS fallback'
                    );
                    wordTimings = fallbackTtsResult.wordTimings;
                }

                sendEvent({
                    type: 'chunk-ready',
                    chunkIndex: i,
                    totalChunks: chunks.length,
                    audioUrl: `/audio/${sessionId}/${audioFileName}`,
                    wordTimings,
                    originalText: chunk.text,
                    spokenText,
                    charStart: chunk.charStart,
                    charEnd: chunk.charEnd,
                    translated,
                });
            } catch (chunkError) {
                sendEvent({
                    type: 'chunk-error',
                    chunkIndex: i,
                    message: chunkError.message,
                });
            }
        }

        sendEvent({ type: 'page-done', pageIndex });
    } catch (error) {
        sendEvent({ type: 'error', message: error.message });
    } finally {
        activeStreams.delete(streamId);
        res.end();
    }
}

export async function generateAudiobook(req, res) {
    const {
        sessionId,
        language = 'en',
        speed = 1,
        voiceGender = 'female',
    } = req.body || {};

    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = getSessionById(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    touchSession(sessionId);

    const playback = {
        speed: clampSpeed(speed),
        voiceGender: normalizeVoiceGender(voiceGender),
    };
    const sourceLanguageCode = session.detectedLanguage?.code || 'en';
    const sessionAudioDir = path.join(AUDIO_DIR, sessionId);
    fs.mkdirSync(sessionAudioDir, { recursive: true });

    const generatedChunkPaths = [];

    try {
        for (let pageIndex = 0; pageIndex < session.pages.length; pageIndex++) {
            const pageText = session.pages[pageIndex] || '';
            const pageChunks = chunkText(pageText, 2200);

            for (let chunkIndex = 0; chunkIndex < pageChunks.length; chunkIndex++) {
                const chunk = pageChunks[chunkIndex];
                let translationResult;

                try {
                    translationResult = await withTimeout(
                        smartTranslate(
                            chunk,
                            language,
                            `${sessionId}_book_p${pageIndex}_c${chunkIndex}_${language}`,
                            sourceLanguageCode
                        ),
                        TRANSLATION_TIMEOUT_MS,
                        'Book translation'
                    );
                } catch {
                    translationResult = {
                        text: chunk,
                        translated: false,
                        sourceLang: sourceLanguageCode,
                    };
                }

                const chunkPath = path.join(
                    sessionAudioDir,
                    `book_p${pageIndex}_c${chunkIndex}_${Date.now()}.mp3`
                );

                try {
                    await withTimeout(
                        generateChunkWithTimings(
                            translationResult.text,
                            language,
                            chunkPath,
                            playback
                        ),
                        TTS_TIMEOUT_MS,
                        'Book TTS'
                    );
                    generatedChunkPaths.push(chunkPath);
                } catch {
                    await withTimeout(
                        generateChunkWithTimings(
                            chunk,
                            language,
                            chunkPath,
                            playback
                        ),
                        TTS_TIMEOUT_MS,
                        'Book TTS fallback'
                    );
                    generatedChunkPaths.push(chunkPath);
                }
            }
        }

        if (generatedChunkPaths.length === 0) {
            throw new Error('Could not generate any audiobook chunks');
        }

        const finalName = `audiobook_${language}_${Date.now()}.mp3`;
        const finalPath = path.join(sessionAudioDir, finalName);
        await mergeAudioFiles(generatedChunkPaths, finalPath);
        cleanupChunks(generatedChunkPaths);

        res.json({
            audioUrl: `/audio/${sessionId}/${finalName}`,
            fileName: finalName,
            pages: session.pages.length,
        });
    } catch (error) {
        cleanupChunks(generatedChunkPaths);
        res.status(500).json({ error: error.message });
    }
}

export async function stopReading(req, res) {
    const { sessionId } = req.body || {};
    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
    }

    let stopped = 0;
    for (const stream of activeStreams.values()) {
        if (stream.sessionId === sessionId) {
            stream.active = false;
            stopped++;
        }
    }

    res.json({ stopped, message: stopped > 0 ? 'Reading stopped' : 'No active reading' });
}

export async function getSession(req, res) {
    const session = getSessionById(req.params.id);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
        id: session.id,
        totalPages: session.pages.length,
        detectedLanguage: session.detectedLanguage,
    });
}
