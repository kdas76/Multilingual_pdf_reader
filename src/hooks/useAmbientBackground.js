import { useCallback, useEffect, useRef } from 'react';

/**
 * useAmbientBackground — Soothing brown noise ambient
 * Uses Web Audio API with multiple filters for a warm, library-like tone.
 */
export default function useAmbientBackground(volume = 0.08) {
    const audioContextRef = useRef(null);
    const gainNodeRef = useRef(null);
    const sourceRef = useRef(null);

    const ensureContext = useCallback(() => {
        if (!audioContextRef.current) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            audioContextRef.current = new Ctx();
            gainNodeRef.current = audioContextRef.current.createGain();
            gainNodeRef.current.gain.value = Math.max(0, Math.min(1, volume));
            gainNodeRef.current.connect(audioContextRef.current.destination);
        }
        return audioContextRef.current;
    }, [volume]);

    const updateVolume = useCallback((nextVolume) => {
        if (!gainNodeRef.current || !audioContextRef.current) return;
        const clamped = Math.max(0, Math.min(1, Number(nextVolume) || 0));
        gainNodeRef.current.gain.setTargetAtTime(clamped, audioContextRef.current.currentTime, 0.1);
    }, []);

    useEffect(() => {
        updateVolume(volume);
    }, [volume, updateVolume]);

    const stop = useCallback(() => {
        if (sourceRef.current) {
            try {
                sourceRef.current.stop();
            } catch { /* already stopped */ }
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
    }, []);

    const start = useCallback(async () => {
        const ctx = ensureContext();
        if (!ctx || !gainNodeRef.current) return;
        if (sourceRef.current) return;

        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

        // Generate brown noise (warmer, more soothing than white noise)
        const bufferSize = ctx.sampleRate * 4; // 4 seconds loop
        const noiseBuffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = noiseBuffer.getChannelData(channel);
            let lastOut = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                // Brown noise filter (integration of white noise)
                lastOut = (lastOut + (0.02 * white)) / 1.02;
                data[i] = lastOut * 3.5; // Boost to compensate for low energy
            }
        }

        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;

        // Low-pass filter for warmth
        const lpFilter = ctx.createBiquadFilter();
        lpFilter.type = 'lowpass';
        lpFilter.frequency.value = 500;
        lpFilter.Q.value = 0.5;

        // High-pass to remove rumble
        const hpFilter = ctx.createBiquadFilter();
        hpFilter.type = 'highpass';
        hpFilter.frequency.value = 60;
        hpFilter.Q.value = 0.3;

        source.connect(hpFilter);
        hpFilter.connect(lpFilter);
        lpFilter.connect(gainNodeRef.current);
        source.start();
        sourceRef.current = source;
    }, [ensureContext]);

    useEffect(() => {
        return () => {
            stop();
            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
        };
    }, [stop]);

    return {
        start,
        stop,
        setVolume: updateVolume,
    };
}
