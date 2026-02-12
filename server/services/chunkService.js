/**
 * chunkService.js
 * ───────────────
 * Splits text into TTS-safe chunks that don't break words or sentences.
 * Edge TTS works best with chunks of 2000-3000 characters.
 */

const MAX_CHUNK_SIZE = 2500;
const MIN_CHUNK_SIZE = 500;

/**
 * Split text into TTS-safe chunks
 * @param {string} text - Text to split
 * @param {number} maxSize - Maximum chunk size in characters
 * @returns {string[]} - Array of text chunks
 */
export function chunkText(text, maxSize = MAX_CHUNK_SIZE) {
    if (!text || text.length === 0) return [];
    if (text.length <= maxSize) return [text];

    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxSize) {
            chunks.push(remaining.trim());
            break;
        }

        // Find the best split point within the max size
        let splitPoint = findBestSplitPoint(remaining, maxSize);

        const chunk = remaining.substring(0, splitPoint).trim();
        if (chunk.length > 0) {
            chunks.push(chunk);
        }

        remaining = remaining.substring(splitPoint).trim();
    }

    return chunks.filter(c => c.length > 0);
}

/**
 * Find the best point to split text without cutting words or sentences
 * Priority: sentence end (.) > comma > space > force cut
 */
function findBestSplitPoint(text, maxSize) {
    const searchRegion = text.substring(0, maxSize);

    // Priority 1: Split at the last sentence-ending punctuation (. ! ?)
    const sentenceEnd = findLastMatch(searchRegion, /[.!?]\s/g);
    if (sentenceEnd > MIN_CHUNK_SIZE) return sentenceEnd + 1;

    // Priority 2: Split at the last comma or semicolon
    const commaEnd = findLastMatch(searchRegion, /[,;]\s/g);
    if (commaEnd > MIN_CHUNK_SIZE) return commaEnd + 1;

    // Priority 3: Split at the last space (don't break words)
    const spaceEnd = searchRegion.lastIndexOf(' ');
    if (spaceEnd > MIN_CHUNK_SIZE) return spaceEnd + 1;

    // Priority 4: Force split at maxSize (shouldn't happen often)
    return maxSize;
}

/**
 * Find the index of the last regex match
 */
function findLastMatch(text, regex) {
    let lastIndex = -1;
    let match;
    while ((match = regex.exec(text)) !== null) {
        lastIndex = match.index;
    }
    return lastIndex;
}
