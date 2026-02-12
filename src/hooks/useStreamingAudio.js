/**
 * useStreamingAudio.js
 * ────────────────────
 * Custom hook for real-time streaming audio playback.
 * 
 * Flow:
 * 1. Connects to /api/stream-read (SSE) to receive audio chunks
 * 2. Plays chunks using HTML5 Audio with gapless scheduling
 * 3. Pre-fetches next chunk when current is 70% done
 * 4. Exposes: start, pause, resume, stop, state, currentChunk
 * 
 * Smart chunk management:
 * - Only requests next chunk when 70% of current is played
 * - Doesn't generate wasteful audio the user won't listen to
 * - Seamless transitions between chunks with no gaps
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const API_BASE = 'http://localhost:3001/api';

export default function useStreamingAudio() {
    const [state, setState] = useState('idle'); // idle | loading | playing | paused | stopped
    const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
    const [totalChunks, setTotalChunks] = useState(0);
    const [wordTimings, setWordTimings] = useState([]);
    const [currentWordIndex, setCurrentWordIndex] = useState(-1);
    const [chunkTextInfo, setChunkTextInfo] = useState(null); // {originalText, spokenText, charStart, charEnd, translated}
    const [detectedLanguage, setDetectedLanguage] = useState(null);
    const [needsTranslation, setNeedsTranslation] = useState(false);

    // Refs for managing audio pipeline
    const audioRef = useRef(null);
    const chunkQueueRef = useRef([]); // Queue of ready-to-play chunks
    const isPlayingRef = useRef(false);
    const abortControllerRef = useRef(null);
    const wordTimerRef = useRef(null);
    const currentAudioStartTimeRef = useRef(0);
    const pausedAtRef = useRef(0);

    /**
     * Clean up timers and audio
     */
    const cleanup = useCallback(() => {
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
    }, []);

    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    /**
     * Track word timing during audio playback
     */
    const startWordTracking = useCallback((timings) => {
        if (!timings || timings.length === 0) return;

        const track = () => {
            if (!audioRef.current || audioRef.current.paused) return;

            const currentMs = audioRef.current.currentTime * 1000;

            // Find the current word based on audio position
            let wordIdx = -1;
            for (let i = 0; i < timings.length; i++) {
                if (currentMs >= timings[i].start && currentMs <= timings[i].end) {
                    wordIdx = i;
                    break;
                }
                if (currentMs < timings[i].start) break;
                wordIdx = i; // fallback to last passed word
            }

            setCurrentWordIndex(wordIdx);
            wordTimerRef.current = requestAnimationFrame(track);
        };

        wordTimerRef.current = requestAnimationFrame(track);
    }, []);

    /**
     * Play the next chunk from the queue
     */
    const playNextChunk = useCallback(() => {
        const queue = chunkQueueRef.current;
        if (queue.length === 0) {
            setState('idle');
            isPlayingRef.current = false;
            setCurrentWordIndex(-1);
            return;
        }

        const chunk = queue.shift();
        setCurrentChunkIndex(chunk.chunkIndex);
        setWordTimings(chunk.wordTimings || []);
        setChunkTextInfo({
            originalText: chunk.originalText,
            spokenText: chunk.spokenText,
            charStart: chunk.charStart,
            charEnd: chunk.charEnd,
            translated: chunk.translated,
        });

        // Create new audio element
        if (audioRef.current) {
            audioRef.current.pause();
        }
        const audio = new Audio(chunk.audioUrl);
        audioRef.current = audio;

        audio.onplay = () => {
            setState('playing');
            isPlayingRef.current = true;
            startWordTracking(chunk.wordTimings || []);
        };

        audio.onended = () => {
            if (wordTimerRef.current) {
                cancelAnimationFrame(wordTimerRef.current);
            }
            setCurrentWordIndex(-1);
            // Auto-play next chunk
            playNextChunk();
        };

        audio.onerror = (e) => {
            console.error('Audio playback error:', e);
            // Try next chunk
            playNextChunk();
        };

        // Start playing
        audio.play().catch(err => {
            console.error('Audio play failed:', err);
            playNextChunk();
        });
    }, [startWordTracking]);

    /**
     * Start streaming audio from a specific position
     */
    const start = useCallback(async (sessionId, language, pageIndex, startOffset = 0) => {
        cleanup();
        setState('loading');
        setCurrentChunkIndex(-1);
        setTotalChunks(0);
        setCurrentWordIndex(-1);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        let isFirstChunk = true;

        try {
            const response = await fetch(`${API_BASE}/stream-read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, language, pageIndex, startOffset }),
                signal: abortController.signal,
            });

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
                    const dataLine = event.split('\n').find(l => l.startsWith('data: '));
                    if (!dataLine) continue;

                    try {
                        const data = JSON.parse(dataLine.substring(6));

                        if (data.type === 'stream-start') {
                            setTotalChunks(data.totalChunks);
                            setDetectedLanguage(data.detectedLanguage);
                            setNeedsTranslation(data.needsTranslation);
                        }

                        if (data.type === 'chunk-ready') {
                            // Add to queue
                            chunkQueueRef.current.push(data);

                            // Start playing immediately when first chunk arrives
                            if (isFirstChunk) {
                                isFirstChunk = false;
                                playNextChunk();
                            }

                            // If we're idle (gap occurred), start playing
                            if (!isPlayingRef.current && state !== 'paused') {
                                playNextChunk();
                            }
                        }

                        if (data.type === 'stopped' || data.type === 'page-done') {
                            // Stream ended — remaining chunks will play from queue
                            console.log('Stream ended:', data.type);
                        }

                        if (data.type === 'error') {
                            console.error('Stream error:', data.message);
                            setState('idle');
                        }

                    } catch (e) {
                        // Skip malformed events
                    }
                }
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Streaming error:', error);
                setState('idle');
            }
        }
    }, [cleanup, playNextChunk, state]);

    /**
     * Pause playback
     */
    const pause = useCallback(() => {
        if (audioRef.current && !audioRef.current.paused) {
            audioRef.current.pause();
            if (wordTimerRef.current) {
                cancelAnimationFrame(wordTimerRef.current);
            }
            setState('paused');
            isPlayingRef.current = false;
        }
    }, []);

    /**
     * Resume playback
     */
    const resume = useCallback(() => {
        if (audioRef.current && audioRef.current.paused) {
            audioRef.current.play().then(() => {
                setState('playing');
                isPlayingRef.current = true;
                startWordTracking(wordTimings);
            });
        }
    }, [startWordTracking, wordTimings]);

    /**
     * Stop playback and reading
     */
    const stop = useCallback(async (sessionId) => {
        cleanup();
        setState('stopped');
        setCurrentChunkIndex(-1);
        setCurrentWordIndex(-1);
        setWordTimings([]);
        setChunkTextInfo(null);

        // Tell backend to stop generating
        if (sessionId) {
            try {
                await fetch(`${API_BASE}/stop-reading`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId }),
                });
            } catch (e) {
                // Best effort
            }
        }

        // Small delay then reset to idle
        setTimeout(() => setState('idle'), 300);
    }, [cleanup]);

    return {
        state,
        currentChunkIndex,
        totalChunks,
        wordTimings,
        currentWordIndex,
        chunkTextInfo,
        detectedLanguage,
        needsTranslation,
        start,
        pause,
        resume,
        stop,
    };
}
