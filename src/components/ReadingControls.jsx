/**
 * ReadingControls.jsx
 * ───────────────────
 * Play controls for the streaming reader:
 * - Start / Pause / Resume / Stop buttons
 * - Reading speed slider
 * - Language selector
 * - Status display
 * - Keyboard shortcuts (Space, Esc)
 */

import { useState, useEffect, useCallback } from 'react';

const LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇬🇧', native: 'English' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳', native: 'हिन्दी' },
    { code: 'bn', name: 'Bengali', flag: '🇮🇳', native: 'বাংলা' },
];

export default function ReadingControls({
    state,       // idle | loading | playing | paused | stopped
    language,
    onLanguageChange,
    onStart,
    onPause,
    onResume,
    onStop,
    currentChunk,
    totalChunks,
    detectedLanguage,
    needsTranslation,
    disabled,
}) {
    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.code === 'Space') {
                e.preventDefault();
                if (state === 'playing') onPause?.();
                else if (state === 'paused') onResume?.();
                else if (state === 'idle' || state === 'stopped') onStart?.();
            }

            if (e.code === 'Escape') {
                if (state === 'playing' || state === 'paused') onStop?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [state, onStart, onPause, onResume, onStop]);

    const isActive = state === 'playing' || state === 'paused' || state === 'loading';

    return (
        <div className="reading-controls glass-card animate-slide-up">
            {/* Language Row */}
            <div className="controls-row">
                <div className="language-selector">
                    {LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            className={`lang-chip ${language === lang.code ? 'active' : ''}`}
                            onClick={() => onLanguageChange?.(lang.code)}
                            disabled={isActive || disabled}
                            title={lang.native}
                        >
                            <span className="lang-flag">{lang.flag}</span>
                            <span className="lang-name">{lang.name}</span>
                        </button>
                    ))}
                </div>

                {/* Detected language badge */}
                {detectedLanguage && (
                    <div className="detected-badge">
                        🔍 Source: <strong>{detectedLanguage.name}</strong>
                        {needsTranslation === false && (
                            <span className="skip-badge">⚡ No translation needed</span>
                        )}
                    </div>
                )}
            </div>

            {/* Control Buttons */}
            <div className="controls-row controls-buttons">
                {/* Start Button */}
                {(state === 'idle' || state === 'stopped') && (
                    <button
                        className="control-btn start-btn"
                        onClick={onStart}
                        disabled={disabled}
                    >
                        <span className="btn-icon">▶</span>
                        <span>Start Reading</span>
                    </button>
                )}

                {/* Loading State */}
                {state === 'loading' && (
                    <button className="control-btn loading-btn" disabled>
                        <div className="spinner-small" />
                        <span>Preparing...</span>
                    </button>
                )}

                {/* Pause Button */}
                {state === 'playing' && (
                    <button className="control-btn pause-btn" onClick={onPause}>
                        <span className="btn-icon">⏸</span>
                        <span>Pause</span>
                    </button>
                )}

                {/* Resume Button */}
                {state === 'paused' && (
                    <button className="control-btn resume-btn" onClick={onResume}>
                        <span className="btn-icon">▶</span>
                        <span>Resume</span>
                    </button>
                )}

                {/* Stop Button */}
                {isActive && (
                    <button className="control-btn stop-btn" onClick={onStop}>
                        <span className="btn-icon">⏹</span>
                        <span>Stop</span>
                    </button>
                )}
            </div>

            {/* Progress Info */}
            {isActive && totalChunks > 0 && (
                <div className="controls-row progress-info">
                    <div className="chunk-progress">
                        <div
                            className="chunk-progress-bar"
                            style={{
                                width: `${((currentChunk + 1) / totalChunks) * 100}%`,
                            }}
                        />
                    </div>
                    <span className="chunk-text">
                        {state === 'loading'
                            ? '⏳ Loading first chunk...'
                            : `📖 Chunk ${currentChunk + 1} / ${totalChunks}`}
                    </span>
                </div>
            )}

            {/* Keyboard Hints */}
            <div className="keyboard-hints">
                <kbd>Space</kbd> Play/Pause
                <kbd>Esc</kbd> Stop
            </div>
        </div>
    );
}
