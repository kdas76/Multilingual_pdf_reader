import { useState, useRef, useCallback, useEffect } from 'react';
import { API_BASE, AUDIO_BASE } from '../config';

export default function useStreamingAudio() {
    const [state, setState] = useState('idle');
    const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
    const [totalChunks, setTotalChunks] = useState(0);
    const [wordTimings, setWordTimings] = useState([]);
    const [currentWordIndex, setCurrentWordIndex] = useState(-1);
    const [chunkTextInfo, setChunkTextInfo] = useState(null);
    const [detectedLanguage, setDetectedLanguage] = useState(null);
    const [needsTranslation, setNeedsTranslation] = useState(false);
    const [lastCompletedPage, setLastCompletedPage] = useState(null);

    const stateRef = useRef('idle');
    const audioRef = useRef(null);
    const chunkQueueRef = useRef([]);
    const isPlayingRef = useRef(false);
    const abortControllerRef = useRef(null);
    const wordTimerRef = useRef(null);
    const idleResetTimerRef = useRef(null);
    const playNextChunkRef = useRef(() => {});
    const streamCompletedRef = useRef(true);
    const pendingPageDoneRef = useRef(null);
    const totalChunksRef = useRef(0);
    const lastPlayedChunkRef = useRef(-1);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const clearIdleResetTimer = useCallback(() => {
        if (idleResetTimerRef.current) {
            clearTimeout(idleResetTimerRef.current);
            idleResetTimerRef.current = null;
        }
    }, []);

    const cleanup = useCallback(() => {
        clearIdleResetTimer();

        if (wordTimerRef.current) {
            cancelAnimationFrame(wordTimerRef.current);
            wordTimerRef.current = null;
        }

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        chunkQueueRef.current = [];
        isPlayingRef.current = false;
        streamCompletedRef.current = true;
        pendingPageDoneRef.current = null;
        totalChunksRef.current = 0;
        lastPlayedChunkRef.current = -1;
    }, [clearIdleResetTimer]);

    useEffect(() => cleanup, [cleanup]);

    const startWordTracking = useCallback((timings) => {
        if (!timings || timings.length === 0) return;

        const track = () => {
            if (!audioRef.current || audioRef.current.paused) return;

            const currentMs = audioRef.current.currentTime * 1000;
            let wordIdx = -1;

            for (let i = 0; i < timings.length; i++) {
                if (currentMs >= timings[i].start && currentMs <= timings[i].end) {
                    wordIdx = i;
                    break;
                }

                if (currentMs < timings[i].start) break;
                wordIdx = i;
            }

            setCurrentWordIndex(wordIdx);
            wordTimerRef.current = requestAnimationFrame(track);
        };

        wordTimerRef.current = requestAnimationFrame(track);
    }, []);

    const playNextChunk = useCallback(() => {
        const queue = chunkQueueRef.current;

        if (queue.length === 0) {
            isPlayingRef.current = false;
            setCurrentWordIndex(-1);
            if (streamCompletedRef.current && pendingPageDoneRef.current !== null) {
                setLastCompletedPage(pendingPageDoneRef.current);
                pendingPageDoneRef.current = null;
            }
            setState(streamCompletedRef.current ? 'idle' : 'loading');
            return;
        }

        const chunk = queue.shift();
        lastPlayedChunkRef.current = chunk.chunkIndex;
        setCurrentChunkIndex(chunk.chunkIndex);
        setWordTimings(chunk.wordTimings || []);
        setChunkTextInfo({
            originalText: chunk.originalText,
            spokenText: chunk.spokenText,
            charStart: chunk.charStart,
            charEnd: chunk.charEnd,
            translated: chunk.translated,
        });

        if (audioRef.current) {
            audioRef.current.pause();
        }

        const audio = new Audio(`${AUDIO_BASE}${chunk.audioUrl}`);
        audioRef.current = audio;

        audio.onplay = () => {
            setState('playing');
            isPlayingRef.current = true;
            startWordTracking(chunk.wordTimings || []);
        };

        audio.onended = () => {
            if (wordTimerRef.current) {
                cancelAnimationFrame(wordTimerRef.current);
                wordTimerRef.current = null;
            }
            setCurrentWordIndex(-1);
            playNextChunkRef.current?.();
        };

        audio.onerror = () => {
            playNextChunkRef.current?.();
        };

        audio.play().catch(() => {
            playNextChunkRef.current?.();
        });
    }, [startWordTracking]);

    useEffect(() => {
        playNextChunkRef.current = playNextChunk;
    }, [playNextChunk]);

    const start = useCallback(
        async (sessionId, language, pageIndex, startOffset = 0, options = {}) => {
            cleanup();
            clearIdleResetTimer();

            setState('loading');
            setCurrentChunkIndex(-1);
            setTotalChunks(0);
            setCurrentWordIndex(-1);
            setWordTimings([]);
            setChunkTextInfo(null);
            setLastCompletedPage(null);
            streamCompletedRef.current = false;

            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            let isFirstChunk = true;

            const playbackOptions = {
                speed: Number(options.speed) || 1,
                voiceGender: options.voiceGender || 'female',
            };

            try {
                const response = await fetch(`${API_BASE}/stream-read`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId,
                        language,
                        pageIndex,
                        startOffset,
                        ...playbackOptions,
                    }),
                    signal: abortController.signal,
                });

                if (!response.ok) {
                    let message = `Failed to stream audio (${response.status})`;
                    try {
                        const err = await response.json();
                        message = err.error || err.message || message;
                    } catch {
                        // Keep default message
                    }
                    throw new Error(message);
                }

                if (!response.body) {
                    throw new Error('Streaming response has no body');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const events = buffer.split('\n\n');
                    buffer = events.pop() || '';

                    for (const event of events) {
                        const dataLine = event
                            .split('\n')
                            .find((line) => line.startsWith('data: '));
                        if (!dataLine) continue;

                        try {
                            const data = JSON.parse(dataLine.slice(6));

                            if (data.type === 'stream-start') {
                                setTotalChunks(data.totalChunks || 0);
                                totalChunksRef.current = data.totalChunks || 0;
                                setDetectedLanguage(data.detectedLanguage || null);
                                setNeedsTranslation(!!data.needsTranslation);
                            }

                            if (data.type === 'chunk-ready') {
                                chunkQueueRef.current.push(data);

                                if (isFirstChunk) {
                                    isFirstChunk = false;
                                    playNextChunkRef.current?.();
                                }

                                if (!isPlayingRef.current && stateRef.current !== 'paused') {
                                    playNextChunkRef.current?.();
                                }
                            }

                            if (data.type === 'error') {
                                streamCompletedRef.current = true;
                                setState('idle');
                            }

                            if (data.type === 'page-done' || data.type === 'stopped') {
                                streamCompletedRef.current = true;
                                if (data.type === 'page-done' && Number.isInteger(data.pageIndex)) {
                                    pendingPageDoneRef.current = data.pageIndex;
                                }
                                if (!isPlayingRef.current && chunkQueueRef.current.length === 0) {
                                    if (pendingPageDoneRef.current !== null) {
                                        setLastCompletedPage(pendingPageDoneRef.current);
                                        pendingPageDoneRef.current = null;
                                    }

                                    setState('idle');
                                    setCurrentWordIndex(-1);
                                }
                            }

                            if (data.type === 'chunk-error') {
                                if (streamCompletedRef.current && !isPlayingRef.current && chunkQueueRef.current.length === 0) {
                                    setState('idle');
                                }
                            }
                        } catch {
                            // Ignore malformed SSE event
                        }
                    }
                }
                streamCompletedRef.current = true;
                if (!isPlayingRef.current && chunkQueueRef.current.length === 0) {
                    if (pendingPageDoneRef.current !== null) {
                        setLastCompletedPage(pendingPageDoneRef.current);
                        pendingPageDoneRef.current = null;
                    }

                    setState('idle');
                    setCurrentWordIndex(-1);
                }
            } catch (error) {
                streamCompletedRef.current = true;
                if (error.name !== 'AbortError') {
                    setState('idle');
                }
            }
        },
        [cleanup, clearIdleResetTimer]
    );

    const pause = useCallback(() => {
        if (audioRef.current && !audioRef.current.paused) {
            audioRef.current.pause();
            if (wordTimerRef.current) {
                cancelAnimationFrame(wordTimerRef.current);
                wordTimerRef.current = null;
            }
            setState('paused');
            isPlayingRef.current = false;
        }
    }, []);

    const resume = useCallback(() => {
        if (audioRef.current && audioRef.current.paused) {
            audioRef.current.play().then(() => {
                setState('playing');
                isPlayingRef.current = true;
                startWordTracking(wordTimings);
            }).catch(() => {
                setState('idle');
            });
        }
    }, [startWordTracking, wordTimings]);

    const stop = useCallback(
        async (sessionId) => {
            cleanup();
            clearIdleResetTimer();

            setState('stopped');
            setCurrentChunkIndex(-1);
            setCurrentWordIndex(-1);
            setWordTimings([]);
            setChunkTextInfo(null);

            if (sessionId) {
                try {
                    await fetch(`${API_BASE}/stop-reading`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId }),
                    });
                } catch {
                    // Best effort stop
                }
            }

            idleResetTimerRef.current = setTimeout(() => {
                setState('idle');
                idleResetTimerRef.current = null;
            }, 300);
        },
        [cleanup, clearIdleResetTimer]
    );

    return {
        state,
        currentChunkIndex,
        totalChunks,
        wordTimings,
        currentWordIndex,
        chunkTextInfo,
        detectedLanguage,
        needsTranslation,
        lastCompletedPage,
        start,
        pause,
        resume,
        stop,
    };
}
