/**
 * translationService.js — V2
 * ──────────────────────────
 * Translates text between languages using Google Translate (free).
 * 
 * V2 changes:
 * - Integrates language detection — skips translation if source=target
 * - Smarter chunked translation for large texts
 * - Better error handling with retry
 */

import translate from 'google-translate-api-x';
import { checkTranslationNeeded } from './languageDetector.js';

// ─── Translation Cache ───
const translationCache = new Map();

/**
 * Smart translate — detects source language, skips if same as target
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code ('en', 'hi', 'bn')
 * @param {string} cacheKey - Optional cache key
 * @returns {Promise<{text: string, translated: boolean, sourceLang: string}>}
 */
export async function smartTranslate(text, targetLang, cacheKey = null) {
    // Check if translation is needed
    const check = checkTranslationNeeded(text, targetLang);

    if (!check.needsTranslation) {
        return {
            text: text,
            translated: false,
            sourceLang: check.sourceLang,
        };
    }

    // Translation is needed
    const translated = await translateText(text, targetLang, cacheKey);
    return {
        text: translated,
        translated: true,
        sourceLang: check.sourceLang,
    };
}

/**
 * Translate text to the target language
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code
 * @param {string} cacheKey - Optional cache key
 * @returns {Promise<string>} - Translated text
 */
export async function translateText(text, targetLang, cacheKey = null) {
    if (targetLang === 'en' && /^[\x00-\x7F\s]*$/.test(text.substring(0, 200))) {
        return text; // Already English
    }

    // Check cache
    if (cacheKey && translationCache.has(cacheKey)) {
        console.log(`  ✅ Cache hit: ${cacheKey}`);
        return translationCache.get(cacheKey);
    }

    try {
        console.log(`  🌐 Translating to ${targetLang}... (${text.length} chars)`);

        const MAX_TRANSLATE_LENGTH = 4500;

        if (text.length <= MAX_TRANSLATE_LENGTH) {
            const result = await translate(text, { to: targetLang });
            const translated = result.text;
            if (cacheKey) translationCache.set(cacheKey, translated);
            return translated;
        }

        // Split into sentences and translate in batches
        const sentences = text.match(/[^.!?।]+[.!?।]+/g) || [text];
        let translatedParts = [];
        let batch = '';

        for (const sentence of sentences) {
            if (batch.length + sentence.length > MAX_TRANSLATE_LENGTH) {
                if (batch.trim()) {
                    const result = await translate(batch, { to: targetLang });
                    translatedParts.push(result.text);
                }
                batch = sentence;
            } else {
                batch += sentence;
            }
        }

        if (batch.trim()) {
            const result = await translate(batch, { to: targetLang });
            translatedParts.push(result.text);
        }

        const fullTranslation = translatedParts.join(' ');
        if (cacheKey) translationCache.set(cacheKey, fullTranslation);
        return fullTranslation;

    } catch (error) {
        console.error(`  ❌ Translation error:`, error.message);

        if (error.name === 'TooManyRequestsError' || error.code === 429) {
            console.log('  ⏳ Rate limited, retrying after delay...');
            await new Promise(r => setTimeout(r, 2000));
            try {
                const result = await translate(text.substring(0, 4500), { to: targetLang });
                return result.text;
            } catch (retryErr) {
                throw new Error(`Translation failed: ${retryErr.message}`);
            }
        }

        throw new Error(`Translation failed: ${error.message}`);
    }
}

/**
 * Clear translation cache for a session
 */
export function clearTranslationCache(sessionId) {
    for (const key of translationCache.keys()) {
        if (key.startsWith(sessionId)) {
            translationCache.delete(key);
        }
    }
}
