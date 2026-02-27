/**
 * textCleaner.js
 * ──────────────
 * Cleans extracted PDF text for better TTS and translation results.
 * Removes artifacts like page numbers, excessive whitespace, and normalizes punctuation.
 */

/**
 * Clean raw PDF text for TTS processing
 * @param {string} rawText - Raw text extracted from PDF
 * @returns {string} - Cleaned text ready for TTS/translation
 */
function stripControlChars(input) {
    let cleaned = '';
    for (const ch of input) {
        const code = ch.charCodeAt(0);
        const isBlocked =
            code <= 8 ||
            code === 11 ||
            code === 12 ||
            (code >= 14 && code <= 31) ||
            code === 127;

        if (!isBlocked) cleaned += ch;
    }
    return cleaned;
}

export function cleanText(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';

    let text = rawText;

    // Remove page numbers (common patterns: "Page 1", "- 1 -", standalone numbers on lines)
    text = text.replace(/^[\s]*[-–—]?\s*\d+\s*[-–—]?\s*$/gm, '');
    text = text.replace(/\bpage\s+\d+\b/gi, '');

    // Remove headers/footers that repeat (common in PDFs)
    text = text.replace(/^\s*\d+\s*$/gm, '');

    // Normalize line breaks — collapse multiple newlines into paragraph breaks
    text = text.replace(/\n{3,}/g, '\n\n');

    // Replace single newlines (soft wraps from PDF) with spaces
    // But preserve paragraph breaks (double newlines)
    text = text.replace(/(?<!\n)\n(?!\n)/g, ' ');

    // Normalize whitespace
    text = text.replace(/[ \t]{2,}/g, ' ');

    // Normalize quotes and dashes
    text = text.replace(/[""]/g, '"');
    text = text.replace(/['']/g, "'");
    text = text.replace(/[–—]/g, '-');

    // Remove non-printable characters
    text = stripControlChars(text);

    // Add natural pauses after paragraphs (helps TTS sound more natural)
    text = text.replace(/\n\n/g, '.\n\n');

    // Clean up double periods from the pause insertion
    text = text.replace(/\.{2,}/g, '.');
    text = text.replace(/\.\s*\./g, '.');

    // Trim each line
    text = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');

    return text.trim();
}

/**
 * Split text into pages (if page markers exist) or logical sections
 * @param {string} text - Full book text
 * @returns {string[]} - Array of page texts
 */
export function splitIntoPages(text) {
    if (!text) return [];

    // Try splitting by double newlines (paragraph breaks = approximate pages)
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

    if (paragraphs.length === 0) return [text];

    // Group paragraphs into "pages" of roughly 1500-2500 characters
    const pages = [];
    let currentPage = '';

    for (const paragraph of paragraphs) {
        if (currentPage.length + paragraph.length > 2000 && currentPage.length > 500) {
            pages.push(currentPage.trim());
            currentPage = paragraph;
        } else {
            currentPage += (currentPage ? '\n\n' : '') + paragraph;
        }
    }

    if (currentPage.trim()) {
        pages.push(currentPage.trim());
    }

    return pages;
}
