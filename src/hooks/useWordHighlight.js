import { useState, useCallback, useRef } from 'react';

export default function useWordHighlight(containerRef) {
    const [highlightedRange, setHighlightedRange] = useState(null);
    const lastHighlightRef = useRef(null);

    const clearHighlight = useCallback(() => {
        setHighlightedRange(null);
        if (containerRef?.current) {
            const highlights = containerRef.current.querySelectorAll('.word-highlight');
            highlights.forEach((el) => el.classList.remove('word-highlight'));
        }
        lastHighlightRef.current = null;
    }, [containerRef]);

    const highlightWord = useCallback(
        (wordIndex, wordTimings, chunkInfo) => {
            if (!containerRef?.current || wordIndex < 0 || !wordTimings?.length || !chunkInfo) {
                clearHighlight();
                return;
            }

            const currentWord = wordTimings[wordIndex];
            if (!currentWord) return;

            const { charStart = 0, charEnd = charStart } = chunkInfo;
            const chunkLength = Math.max(1, charEnd - charStart);
            const progress =
                wordTimings.length <= 1
                    ? 0
                    : Math.max(0, Math.min(1, wordIndex / (wordTimings.length - 1)));
            const targetChar = charStart + Math.floor(progress * chunkLength);

            setHighlightedRange({
                wordIndex,
                word: currentWord.part?.trim(),
                startMs: currentWord.start,
                endMs: currentWord.end,
                char: targetChar,
            });

            const container = containerRef.current;
            const prevHighlights = container.querySelectorAll('.word-highlight');
            prevHighlights.forEach((el) => el.classList.remove('word-highlight'));

            const textSpans = container.querySelectorAll('.react-pdf__Page__textContent span');
            if (textSpans.length === 0) return;

            let runningCharCount = 0;
            for (const span of textSpans) {
                const text = span.textContent || '';
                const spanStart = runningCharCount;
                const spanEnd = spanStart + text.length;

                if (targetChar >= spanStart && targetChar < spanEnd) {
                    span.classList.add('word-highlight');
                    if (lastHighlightRef.current !== span) {
                        span.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        lastHighlightRef.current = span;
                    }
                    break;
                }

                runningCharCount = spanEnd;
            }
        },
        [containerRef, clearHighlight]
    );

    return {
        highlightedRange,
        highlightWord,
        clearHighlight,
    };
}
