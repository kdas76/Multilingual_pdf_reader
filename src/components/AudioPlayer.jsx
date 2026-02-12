import { useRef, useState, useEffect } from 'react';

/**
 * AudioPlayer Component
 * ─────────────────────
 * Custom styled audio player with play/pause, progress, and download.
 * Handles seamless audio playback with visual waveform bars.
 */

export default function AudioPlayer({ audioUrl, language, pageIndex }) {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);

    const langNames = { en: 'English', hi: 'Hindi', bn: 'Bengali' };

    // Reset state when audio URL changes
    useEffect(() => {
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setIsLoaded(false);
    }, [audioUrl]);

    if (!audioUrl) return null;

    const fullUrl = `http://localhost:3001${audioUrl}`;

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
            setIsLoaded(true);
        }
    };

    const handleSeek = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        if (audioRef.current) {
            audioRef.current.currentTime = percentage * duration;
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
    };

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div
            className="glass-card animate-slide-up"
            style={{
                padding: '24px',
                maxWidth: '600px',
                margin: '0 auto',
                animationDelay: '0.4s',
            }}
        >
            {/* Hidden HTML audio element */}
            <audio
                ref={audioRef}
                src={fullUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                preload="auto"
            />

            {/* Player Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '20px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🔊</span>
                    <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600 }}>
                        Now Playing
                    </span>
                </div>
                <span
                    style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                    }}
                >
                    {langNames[language]} • Page {(pageIndex || 0) + 1}
                </span>
            </div>

            {/* Waveform Visualization */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px',
                    height: '40px',
                    marginBottom: '16px',
                }}
            >
                {Array.from({ length: 24 }, (_, i) => (
                    <div
                        key={i}
                        style={{
                            width: '3px',
                            height: isPlaying ? `${12 + Math.random() * 28}px` : '8px',
                            background: i < Math.floor(progress * 0.24)
                                ? 'var(--accent-primary)'
                                : 'var(--border-subtle)',
                            borderRadius: '2px',
                            transition: isPlaying ? 'height 0.15s ease' : 'height 0.3s ease',
                            animation: isPlaying ? `wave 0.5s ease-in-out ${i * 0.05}s infinite alternate` : 'none',
                        }}
                    />
                ))}
            </div>

            {/* Progress Bar (clickable) */}
            <div
                onClick={handleSeek}
                style={{
                    width: '100%',
                    height: '6px',
                    background: 'var(--border-subtle)',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    marginBottom: '12px',
                    position: 'relative',
                }}
            >
                <div
                    style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: 'var(--accent-gradient)',
                        borderRadius: '3px',
                        transition: 'width 0.1s linear',
                    }}
                />
                {/* Thumb */}
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: `${progress}%`,
                        transform: 'translate(-50%, -50%)',
                        width: '14px',
                        height: '14px',
                        background: 'var(--accent-primary)',
                        borderRadius: '50%',
                        border: '2px solid var(--bg-primary)',
                        boxShadow: '0 0 8px var(--accent-glow)',
                        transition: 'left 0.1s linear',
                    }}
                />
            </div>

            {/* Time Display */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '20px',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                }}
            >
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                {/* Play / Pause */}
                <button
                    onClick={togglePlay}
                    className="btn-primary"
                    style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.3rem',
                    }}
                >
                    {isPlaying ? '⏸' : '▶'}
                </button>

                {/* Download */}
                <a
                    href={fullUrl}
                    download={`page_${(pageIndex || 0) + 1}_${language}.mp3`}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 20px',
                        background: 'var(--bg-glass)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        textDecoration: 'none',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        transition: 'all 0.3s ease',
                        fontFamily: 'var(--font-primary)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-accent)';
                        e.currentTarget.style.background = 'var(--bg-glass-hover)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        e.currentTarget.style.background = 'var(--bg-glass)';
                    }}
                >
                    ⬇️ Download MP3
                </a>
            </div>
        </div>
    );
}
