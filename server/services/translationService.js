import translate from 'google-translate-api-x';
import { checkTranslationNeeded } from './languageDetector.js';

const translationCache = new Map();
const MAX_TRANSLATE_LENGTH = 4500;

async function translateInBatches(text, targetLang) {
    if (text.length <= MAX_TRANSLATE_LENGTH) {
        const result = await translate(text, { to: targetLang });
        return result.text;
    }

    const sentences = text.match(/[^.!?।]+[.!?।]+/g) || [text];
    const translatedParts = [];
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

    return translatedParts.join(' ');
}

export async function smartTranslate(text, targetLang, cacheKey = null, sourceLangHint = null) {
    const check = sourceLangHint
        ? { needsTranslation: sourceLangHint !== targetLang, sourceLang: sourceLangHint }
        : checkTranslationNeeded(text, targetLang);

    if (!check.needsTranslation) {
        return {
            text,
            translated: false,
            sourceLang: check.sourceLang,
        };
    }

    const translated = await translateText(text, targetLang, cacheKey);
    return {
        text: translated,
        translated: true,
        sourceLang: check.sourceLang,
    };
}

export async function translateText(text, targetLang, cacheKey = null) {
    if (targetLang === 'en' && /^[ -~\s]*$/.test(text.substring(0, 200))) {
        return text;
    }

    if (cacheKey && translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey);
    }

    try {
        const fullTranslation = await translateInBatches(text, targetLang);
        if (cacheKey) translationCache.set(cacheKey, fullTranslation);
        return fullTranslation;
    } catch (error) {
        if (error.name === 'TooManyRequestsError' || error.code === 429) {
            await new Promise((r) => setTimeout(r, 2000));
            try {
                const retriedTranslation = await translateInBatches(text, targetLang);
                if (cacheKey) translationCache.set(cacheKey, retriedTranslation);
                return retriedTranslation;
            } catch (retryError) {
                throw new Error(`Translation failed: ${retryError.message}`);
            }
        }

        throw new Error(`Translation failed: ${error.message}`);
    }
}

export function clearTranslationCache(sessionId) {
    for (const key of translationCache.keys()) {
        if (key.startsWith(sessionId)) {
            translationCache.delete(key);
        }
    }
}
