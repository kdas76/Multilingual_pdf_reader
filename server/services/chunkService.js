/**
 * chunkService.js — V2
 * ─────────────────────
 * Splits text into chunks for TTS processing.
 * 
 * V2 adds: microChunk() for real-time streaming (~100 words per chunk)
 * with character offset tracking for highlighting synchronization.
 */

const MAX_CHUNK_SIZE = 2500;
const MIN_CHUNK_SIZE = 500;

// ~100 words ≈ ~600 characters for English, ~400 for Hindi/Bengali
const MICRO_CHUNK_WORDS = 100;
const MICRO_CHUNK_MAX_CHARS = 700;

/**
 * Split text into micro-chunks (~100 words) for real-time streaming
 * Returns chunks with character offset tracking.
 * 
 * @param {string} text - Full text to split
 * @param {number} startOffset - Character offset to start from (for click-to-start)
 * @returns {{ chunks: Array<{text: string, charStart: number, charEnd: number, wordCount: number}> }}
 */
export function microChunk(text, startOffset = 0) {
    if (!text) return { chunks: [] };

    // Apply start offset
    const workingText = text.substring(startOffset);
    if (workingText.trim().length === 0) return { chunks: [] };

    const words = workingText.split(/(\s+)/); // Split but keep whitespace
    const chunks = [];
    let currentChunk = '';
    let currentWordCount = 0;
    let chunkCharStart = startOffset;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];

        // Skip pure whitespace in word count
        const isWord = word.trim().length > 0;

        currentChunk += word;
        if (isWord) currentWordCount++;

        // Check if we should end this chunk
        const shouldSplit = currentWordCount >= MICRO_CHUNK_WORDS
            || currentChunk.length >= MICRO_CHUNK_MAX_CHARS;

        // Find a good split point (sentence end preferred)
        if (shouldSplit && isWord) {
            // Try to end at a sentence boundary
            const endsWithSentence = /[.!?।]\s*$/.test(currentChunk.trimEnd());
            if (endsWithSentence || currentWordCount >= MICRO_CHUNK_WORDS || currentChunk.length >= MICRO_CHUNK_MAX_CHARS) {
                const trimmed = currentChunk.trim();
                if (trimmed.length > 0) {
                    chunks.push({
                        text: trimmed,
                        charStart: chunkCharStart,
                        charEnd: chunkCharStart + currentChunk.length,
                        wordCount: currentWordCount,
                    });
                }
                chunkCharStart += currentChunk.length;
                currentChunk = '';
                currentWordCount = 0;
            }
        }
    }

    // Push remaining text
    if (currentChunk.trim().length > 0) {
        chunks.push({
            text: currentChunk.trim(),
            charStart: chunkCharStart,
            charEnd: chunkCharStart + currentChunk.length,
            wordCount: currentWordCount,
        });
    }

    return { chunks };
}

/**
 * Split text into larger chunks (for batch processing)
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

        let splitPoint = findBestSplitPoint(remaining, maxSize);
        const chunk = remaining.substring(0, splitPoint).trim();
        if (chunk.length > 0) chunks.push(chunk);
        remaining = remaining.substring(splitPoint).trim();
    }

    return chunks.filter(c => c.length > 0);
}

function findBestSplitPoint(text, maxSize) {
    const searchRegion = text.substring(0, maxSize);

    const sentenceEnd = findLastMatch(searchRegion, /[.!?।]\s/g);
    if (sentenceEnd > MIN_CHUNK_SIZE) return sentenceEnd + 1;

    const commaEnd = findLastMatch(searchRegion, /[,;]\s/g);
    if (commaEnd > MIN_CHUNK_SIZE) return commaEnd + 1;

    const spaceEnd = searchRegion.lastIndexOf(' ');
    if (spaceEnd > MIN_CHUNK_SIZE) return spaceEnd + 1;

    return maxSize;
}

function findLastMatch(text, regex) {
    let lastIndex = -1;
    let match;
    while ((match = regex.exec(text)) !== null) {
        lastIndex = match.index;
    }
    return lastIndex;
}
