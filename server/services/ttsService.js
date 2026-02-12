/**
 * ttsService.js — V2
 * ───────────────────
 * Converts text to speech using Microsoft Edge's neural voices.
 * 
 * V2 changes:
 * - Subtitle generation (word-level timing data) for text highlighting
 * - Indian Bengali voice (bn-IN-TanishaaNeural) instead of Bangladeshi
 * - Tuned voice parameters for natural, pleasant sound
 * - Returns both audio path AND word timing data
 */

import { EdgeTTS } from 'node-edge-tts';
import path from 'path';
import fs from 'fs';

// ─── Voice Configuration (tuned for natural sound) ───
const VOICE_MAP = {
    en: {
        voice: 'en-US-JennyNeural',
        lang: 'en-US',
        rate: '-5%',
        pitch: '+2Hz',
        volume: '+5%',
    },
    hi: {
        voice: 'hi-IN-SwaraNeural',
        lang: 'hi-IN',
        rate: '-10%',
        pitch: '+0Hz',
        volume: '+5%',
    },
    bn: {
        voice: 'bn-IN-TanishaaNeural',  // Indian Bengali, not Bangladeshi
        lang: 'bn-IN',
        rate: '-10%',
        pitch: '+0Hz',
        volume: '+5%',
    },
};

/**
 * Generate speech with word-level timing (subtitles)
 * @param {string} text - Text to convert to speech
 * @param {string} language - Language code ('en', 'hi', 'bn')
 * @param {string} outputPath - Full path for the output audio file
 * @returns {Promise<{audioPath: string, wordTimings: Array}>}
 */
export async function generateSpeechWithTimings(text, language, outputPath) {
    if (!text || text.trim().length === 0) {
        throw new Error('Empty text provided for TTS');
    }

    const config = VOICE_MAP[language];
    if (!config) {
        throw new Error(`Unsupported language: ${language}`);
    }

    try {
        const tts = new EdgeTTS({
            voice: config.voice,
            lang: config.lang,
            outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
            saveSubtitles: true,  // Generate word-level timing JSON
            rate: config.rate,
            pitch: config.pitch,
            volume: config.volume,
            timeout: 30000,
        });

        await tts.ttsPromise(text, outputPath);

        // Read subtitle timing data (saved as JSON with same name as audio)
        const subtitlePath = outputPath.replace(/\.mp3$/, '.json');
        let wordTimings = [];

        if (fs.existsSync(subtitlePath)) {
            try {
                const subtitleData = fs.readFileSync(subtitlePath, 'utf-8');
                wordTimings = JSON.parse(subtitleData);
                // Clean up subtitle file
                fs.unlinkSync(subtitlePath);
            } catch (e) {
                console.warn('  ⚠️ Could not parse subtitle data');
            }
        }

        console.log(`  🔊 Generated: ${path.basename(outputPath)} (${language}, ${wordTimings.length} words)`);

        return { audioPath: outputPath, wordTimings };
    } catch (error) {
        console.error(`  ❌ TTS Error (${language}):`, error.message);
        throw new Error(`Speech generation failed for ${language}: ${error.message}`);
    }
}

/**
 * Generate speech (simple, without timings — for backward compat)
 */
export async function generateSpeech(text, language, outputPath) {
    const result = await generateSpeechWithTimings(text, language, outputPath);
    return result.audioPath;
}

/**
 * Generate speech for a chunk with retry logic
 */
export async function generateChunkWithTimings(text, language, outputPath, retries = 2) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await generateSpeechWithTimings(text, language, outputPath);
        } catch (error) {
            if (attempt < retries) {
                console.log(`  ⚠️ Retry ${attempt}/${retries} for TTS chunk...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            } else {
                throw error;
            }
        }
    }
}

/**
 * Get available voices for display
 */
export function getAvailableVoices() {
    return Object.entries(VOICE_MAP).map(([lang, config]) => ({
        language: lang,
        voice: config.voice,
        label: lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : 'Bengali (Indian)',
    }));
}
