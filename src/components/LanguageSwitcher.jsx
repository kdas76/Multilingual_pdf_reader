import { useState } from 'react';

/**
 * LanguageSwitcher Component
 * ──────────────────────────
 * Visual language selector with card-based UI.
 * Supports English, Hindi, Bengali.
 */

const LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇺🇸', nativeName: 'English', color: '#8b5cf6' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳', nativeName: 'हिन्दी', color: '#f59e0b' },
    { code: 'bn', name: 'Bengali', flag: '🇧🇩', nativeName: 'বাংলা', color: '#10b981' },
];

export default function LanguageSwitcher({ selectedLanguage, onLanguageChange, disabled }) {
    return (
        <div
            className="animate-slide-up"
            style={{
                maxWidth: '600px',
                margin: '0 auto',
                animationDelay: '0.2s',
            }}
        >
            {/* Label */}
            <p
                style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                }}
            >
                Select Language
            </p>

            {/* Language Cards */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                }}
            >
                {LANGUAGES.map((lang) => {
                    const isSelected = selectedLanguage === lang.code;
                    return (
                        <button
                            key={lang.code}
                            onClick={() => onLanguageChange(lang.code)}
                            disabled={disabled}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '16px 12px',
                                borderRadius: 'var(--radius-md)',
                                border: `1.5px solid ${isSelected ? lang.color : 'var(--border-subtle)'}`,
                                background: isSelected
                                    ? `${lang.color}15`
                                    : 'var(--bg-glass)',
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                transition: 'all 0.25s ease',
                                opacity: disabled ? 0.5 : 1,
                                fontFamily: 'var(--font-primary)',
                                boxShadow: isSelected
                                    ? `0 0 20px ${lang.color}25`
                                    : 'none',
                            }}
                            onMouseEnter={(e) => {
                                if (!disabled && !isSelected) {
                                    e.currentTarget.style.borderColor = `${lang.color}60`;
                                    e.currentTarget.style.background = `${lang.color}08`;
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isSelected) {
                                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                    e.currentTarget.style.background = 'var(--bg-glass)';
                                }
                            }}
                        >
                            {/* Flag */}
                            <span style={{ fontSize: '1.5rem' }}>{lang.flag}</span>

                            {/* Name */}
                            <span
                                style={{
                                    fontSize: '0.85rem',
                                    fontWeight: isSelected ? 700 : 500,
                                    color: isSelected ? lang.color : 'var(--text-primary)',
                                }}
                            >
                                {lang.name}
                            </span>

                            {/* Native name */}
                            <span
                                style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted)',
                                }}
                            >
                                {lang.nativeName}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
