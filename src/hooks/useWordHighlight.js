/**
 * useWordHighlight.js
 * ───────────────────
 * Tracks current word being spoken and highlights it in the PDF text layer.
 * 
 * Uses word timing data from node-edge-tts subtitles to synchronize
 * text highlighting with audio playback — similar to Edge's Read Aloud.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Find and highlight the current word in the PDF text layer
 */
export default function useWordHighlight(containerRef) {
    const [highlightedRange, setHighlightedRange] = useState(null);
    const lastHighlightRef = useRef(null);

    /**
     * Highlight a specific word index in the spoken text
     * @param {number} wordIndex - Index of the current word
     * @param {Array} wordTimings - Array of {part, start, end} from TTS subtitles
     * @param {string} spokenText - The text that's being spoken
     * @param {number} charStart - Character offset in the full page text
     */
    const highlightWord = useCallback((wordIndex, wordTimings, spokenText, charStart) => {
        if (!containerRef?.current || wordIndex < 0 || !wordTimings?.length) {
            clearHighlight();
            return;
        }

        const word = wordTimings[wordIndex];
        if (!word) return;

        setHighlightedRange({
            wordIndex,
            word: word.part?.trim(),
            startMs: word.start,
            endMs: word.end,
        });

        // Find and highlight in DOM
        const container = containerRef.current;
        if (!container) return;

        // Clear previous highlight
        const prevHighlights = container.querySelectorAll('.word-highlight');
        prevHighlights.forEach(el => el.classList.remove('word-highlight'));

        // Find the text layer spans in the PDF
        const textSpans = container.querySelectorAll('.react-pdf__Page__textContent span');
        if (textSpans.length === 0) return;

        const targetWord = word.part?.trim();
        if (!targetWord) return;

        // Build a character offset map to locate the word
        let cumulativeOffset = 0;
        let targetCharStart = 0;
        for (let i = 0; i < wordIndex; i++) {
            if (wordTimings[i]?.part) {
                targetCharStart += wordTimings[i].part.length;
            }
        }

        // Walk through text spans to find the matching position
        let charCount = 0;
        for (const span of textSpans) {
            const text = span.textContent || '';
            const spanStart = charCount;
            const spanEnd = charCount + text.length;

            // Check if this span contains our target word
            if (targetCharStart >= spanStart && targetCharStart < spanEnd) {
                span.classList.add('word-highlight');

                // Scroll the highlighted word into view
                if (lastHighlightRef.current !== span) {
                    span.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    lastHighlightRef.current = span;
                }
                break;
            }
            charCount += text.length;
        }
    }, [containerRef]);

    /**
     * Clear all highlights
     */
    const clearHighlight = useCallback(() => {
        setHighlightedRange(null);
        if (containerRef?.current) {
            const highlights = containerRef.current.querySelectorAll('.word-highlight');
            highlights.forEach(el => el.classList.remove('word-highlight'));
        }
        lastHighlightRef.current = null;
    }, [containerRef]);

    return {
        highlightedRange,
        highlightWord,
        clearHighlight,
    };
}
