/**
 * translationService.js
 * ─────────────────────
 * Translates text between languages using Google Translate (free).
 * Uses google-translate-api-x (actively maintained fork).
 * 
 * Includes caching to avoid re-translating the same text.
 */

import translate from 'google-translate-api-x';

// ─── Translation Cache ───
// Key: `${sessionId}_${language}_${pageIndex}`, Value: translated text
const translationCache = new Map();

/**
 * Translate text to the target language
 * @param {string} text - English text to translate
 * @param {string} targetLang - Target language code ('hi' for Hindi, 'bn' for Bengali)
 * @param {string} cacheKey - Optional cache key for caching
 * @returns {Promise<string>} - Translated text
 */
export async function translateText(text, targetLang, cacheKey = null) {
    // Don't translate English
    if (targetLang === 'en') return text;

    // Check cache first
    if (cacheKey && translationCache.has(cacheKey)) {
        console.log(`  ✅ Cache hit for translation: ${cacheKey}`);
        return translationCache.get(cacheKey);
    }

    try {
        console.log(`  🌐 Translating to ${targetLang}... (${text.length} chars)`);

        // For long texts, translate in smaller segments to avoid API limits
        const MAX_TRANSLATE_LENGTH = 4500;

        if (text.length <= MAX_TRANSLATE_LENGTH) {
            const result = await translate(text, { to: targetLang });
            const translated = result.text;

            // Cache the result
            if (cacheKey) {
                translationCache.set(cacheKey, translated);
            }

            return translated;
        }

        // Split into sentences and translate in batches
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
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

        // Translate remaining batch
        if (batch.trim()) {
            const result = await translate(batch, { to: targetLang });
            translatedParts.push(result.text);
        }

        const fullTranslation = translatedParts.join(' ');

        // Cache the result
        if (cacheKey) {
            translationCache.set(cacheKey, fullTranslation);
        }

        return fullTranslation;
    } catch (error) {
        console.error(`  ❌ Translation error:`, error.message);

        // If rate limited, add a small delay and retry once
        if (error.name === 'TooManyRequestsError' || error.code === 429) {
            console.log('  ⏳ Rate limited, waiting 2 seconds and retrying...');
            await new Promise(resolve => setTimeout(resolve, 2000));

            try {
                const result = await translate(text.substring(0, MAX_TRANSLATE_LENGTH), { to: targetLang });
                return result.text;
            } catch (retryError) {
                throw new Error(`Translation failed after retry: ${retryError.message}`);
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

/**
 * Get supported languages
 */
export function getSupportedLanguages() {
    return [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
        { code: 'bn', name: 'Bengali', flag: '🇧🇩' }
    ];
}
