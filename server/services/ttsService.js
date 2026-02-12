/**
 * ttsService.js
 * ─────────────
 * Converts text to speech using Microsoft Edge's neural voices.
 * Uses node-edge-tts package (pure Node.js, no Python dependency).
 * 
 * API: new EdgeTTS({ voice, lang, outputFormat }) → tts.ttsPromise(text, filePath)
 * 
 * Supports: English, Hindi, Bengali with natural neural voices.
 */

import { EdgeTTS } from 'node-edge-tts';
import path from 'path';

// ─── Voice Configuration ───
const VOICE_MAP = {
    en: { voice: 'en-US-JennyNeural', lang: 'en-US' },
    hi: { voice: 'hi-IN-SwaraNeural', lang: 'hi-IN' },
    bn: { voice: 'bn-BD-NabanitaNeural', lang: 'bn-BD' }
};

/**
 * Generate speech audio from text
 * @param {string} text - Text to convert to speech
 * @param {string} language - Language code ('en', 'hi', 'bn')
 * @param {string} outputPath - Full path for the output audio file
 * @returns {Promise<string>} - Path to the generated audio file
 */
export async function generateSpeech(text, language, outputPath) {
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
            rate: language === 'en' ? '-5%' : '-8%',
            pitch: 'default',
            volume: 'default',
            timeout: 30000
        });

        await tts.ttsPromise(text, outputPath);

        console.log(`  🔊 Generated audio: ${path.basename(outputPath)} (${language})`);
        return outputPath;
    } catch (error) {
        console.error(`  ❌ TTS Error (${language}):`, error.message);
        throw new Error(`Speech generation failed for ${language}: ${error.message}`);
    }
}

/**
 * Generate speech for a single chunk with retry logic
 */
export async function generateChunkSpeech(text, language, outputPath, retries = 2) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await generateSpeech(text, language, outputPath);
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
        voice: config.voice
    }));
}
