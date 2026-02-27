import { useEffect } from 'react';

const LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇬🇧', native: 'English' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳', native: 'हिन्दी' },
    { code: 'bn', name: 'Bengali', flag: '🇮🇳', native: 'বাংলা' },
    { code: 'ta', name: 'Tamil', flag: '🇮🇳', native: 'தமிழ்' },
    { code: 'te', name: 'Telugu', flag: '🇮🇳', native: 'తెలుగు' },
    { code: 'mr', name: 'Marathi', flag: '🇮🇳', native: 'मराठी' },
    { code: 'gu', name: 'Gujarati', flag: '🇮🇳', native: 'ગુજરાતી' },
    { code: 'kn', name: 'Kannada', flag: '🇮🇳', native: 'ಕನ್ನಡ' },
    { code: 'ml', name: 'Malayalam', flag: '🇮🇳', native: 'മലയാളം' },
    { code: 'pa', name: 'Punjabi', flag: '🇮🇳', native: 'ਪੰਜਾਬੀ' },
    { code: 'or', name: 'Odia', flag: '🇮🇳', native: 'ଓଡ଼ିଆ' },
    { code: 'as', name: 'Assamese', flag: '🇮🇳', native: 'অসমীয়া' },
    { code: 'ur', name: 'Urdu', flag: '🇮🇳', native: 'اردو' },
];

export default function ReadingControls({
    state,
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
    startOffset,
    onResetStartOffset,
    readingSpeed,
    onReadingSpeedChange,
    voiceGender,
    onVoiceGenderChange,
    onGenerateAudiobook,
    isGeneratingAudiobook,
    audiobookUrl,
    ambientEnabled,
    onAmbientToggle,
    ambientVolume,
    onAmbientVolumeChange,
    currentPage,
    totalPages,
    disabled,
}) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

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

                {detectedLanguage && (
                    <div className="detected-badge">
                        Source: <strong>{detectedLanguage.name}</strong>
                        {needsTranslation === false && (
                            <span className="skip-badge">No translation needed</span>
                        )}
                    </div>
                )}
            </div>

            <div className="controls-row settings-row">
                <label className="control-field">
                    <span>Speed: {Number(readingSpeed).toFixed(1)}x</span>
                    <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={readingSpeed}
                        onChange={(e) => onReadingSpeedChange?.(Number(e.target.value))}
                        disabled={isActive || disabled}
                    />
                </label>

                <label className="control-field">
                    <span>Voice</span>
                    <select
                        value={voiceGender}
                        onChange={(e) => onVoiceGenderChange?.(e.target.value)}
                        disabled={isActive || disabled}
                    >
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                    </select>
                </label>
            </div>

            <div className="controls-row settings-row">
                <label className="ambient-toggle">
                    <input
                        type="checkbox"
                        checked={ambientEnabled}
                        onChange={(e) => onAmbientToggle?.(e.target.checked)}
                    />
                    <span>Ambient background</span>
                </label>

                <label className="control-field">
                    <span>Ambient Vol: {Math.round((ambientVolume || 0) * 100)}%</span>
                    <input
                        type="range"
                        min="0"
                        max="0.3"
                        step="0.01"
                        value={ambientVolume}
                        onChange={(e) => onAmbientVolumeChange?.(Number(e.target.value))}
                        disabled={!ambientEnabled}
                    />
                </label>
            </div>

            <div className="controls-row controls-buttons">
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

                {state === 'loading' && (
                    <button className="control-btn loading-btn" disabled>
                        <div className="spinner-small" />
                        <span>Preparing...</span>
                    </button>
                )}

                {state === 'playing' && (
                    <button className="control-btn pause-btn" onClick={onPause}>
                        <span className="btn-icon">⏸</span>
                        <span>Pause</span>
                    </button>
                )}

                {state === 'paused' && (
                    <button className="control-btn resume-btn" onClick={onResume}>
                        <span className="btn-icon">▶</span>
                        <span>Resume</span>
                    </button>
                )}

                {isActive && (
                    <button className="control-btn stop-btn" onClick={onStop}>
                        <span className="btn-icon">⏹</span>
                        <span>Stop</span>
                    </button>
                )}
            </div>

            <div className="controls-row controls-buttons">
                <button
                    className="control-btn resume-btn"
                    onClick={onGenerateAudiobook}
                    disabled={isGeneratingAudiobook || isActive || disabled}
                >
                    <span className="btn-icon">📚</span>
                    <span>{isGeneratingAudiobook ? 'Generating Audiobook...' : 'Generate Full Audiobook'}</span>
                </button>
            </div>

            {audiobookUrl && (
                <div className="controls-row">
                    <a className="upload-new-btn" href={audiobookUrl} target="_blank" rel="noreferrer">
                        Download Audiobook MP3
                    </a>
                </div>
            )}

            {(state === 'idle' || state === 'stopped') && (
                <div className="controls-row start-offset-info">
                    <span className="chunk-text">
                        Start position: {startOffset > 0 ? `char ${startOffset}` : 'Page beginning'}
                    </span>
                    {startOffset > 0 && (
                        <button className="pdf-nav-btn" onClick={onResetStartOffset} title="Reset start position">
                            ↺
                        </button>
                    )}
                </div>
            )}

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
                            ? 'Loading first chunk...'
                            : `Chunk ${currentChunk + 1} / ${totalChunks}`}
                    </span>
                </div>
            )}

            <div className="keyboard-hints">
                <kbd>Space</kbd> Play/Pause
                <kbd>Esc</kbd> Stop
            </div>

            {totalPages > 0 && (
                <div className="controls-row progress-info">
                    <div className="chunk-progress">
                        <div
                            className="chunk-progress-bar"
                            style={{
                                width: `${Math.round(((currentPage + 1) / totalPages) * 100)}%`,
                            }}
                        />
                    </div>
                    <span className="chunk-text">
                        📖 Page {currentPage + 1} of {totalPages} — {Math.round(((currentPage + 1) / totalPages) * 100)}% read
                    </span>
                </div>
            )}
        </div>
    );
}
