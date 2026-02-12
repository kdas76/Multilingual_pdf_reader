/**
 * languageDetector.js
 * ───────────────────
 * Detects the language of extracted text using the franc library.
 * Maps ISO 639-3 codes (franc output) to our app language codes.
 * 
 * Key use: Skip translation when source=target language
 * (e.g., Bengali PDF + Bengali output → no translation needed)
 */

import { franc } from 'franc';

// Map franc's ISO 639-3 codes to our app codes
const FRANC_TO_APP = {
    eng: 'en',
    hin: 'hi',
    ben: 'bn',
};

const APP_TO_NAME = {
    en: 'English',
    hi: 'Hindi',
    bn: 'Bengali',
};

/**
 * Detect the language of text
 * @param {string} text - Text to analyze (longer = more accurate)
 * @returns {{ code: string, name: string, confidence: string }}
 */
export function detectLanguage(text) {
    if (!text || text.trim().length < 20) {
        return { code: 'en', name: 'English', confidence: 'low' };
    }

    // Use a substantial sample for better accuracy
    const sample = text.substring(0, 3000);
    const detected = franc(sample);

    if (detected === 'und') {
        // Undetermined — try with the full text
        const fullDetected = franc(text.substring(0, 10000));
        if (fullDetected !== 'und' && FRANC_TO_APP[fullDetected]) {
            return {
                code: FRANC_TO_APP[fullDetected],
                name: APP_TO_NAME[FRANC_TO_APP[fullDetected]],
                confidence: 'medium',
            };
        }
        return { code: 'en', name: 'English', confidence: 'low' };
    }

    const appCode = FRANC_TO_APP[detected];
    if (appCode) {
        return {
            code: appCode,
            name: APP_TO_NAME[appCode],
            confidence: 'high',
        };
    }

    // Detected a language we don't support — default to English
    return { code: 'en', name: 'English', confidence: 'low' };
}

/**
 * Check if translation is needed
 * @param {string} sourceText - Source text
 * @param {string} targetLang - Target language code
 * @returns {{ needsTranslation: boolean, sourceLang: string, targetLang: string }}
 */
export function checkTranslationNeeded(sourceText, targetLang) {
    const detected = detectLanguage(sourceText);
    const needsTranslation = detected.code !== targetLang;

    console.log(`  🔍 Detected: ${detected.name} (${detected.confidence}) | Target: ${APP_TO_NAME[targetLang]} | Translate: ${needsTranslation ? 'YES' : 'SKIP'}`);

    return {
        needsTranslation,
        sourceLang: detected.code,
        sourceLangName: detected.name,
        targetLang,
        confidence: detected.confidence,
    };
}
