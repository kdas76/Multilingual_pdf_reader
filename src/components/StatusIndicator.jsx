/**
 * StatusIndicator Component
 * ─────────────────────────
 * Real-time progress display for audio generation.
 * Shows step, progress bar, and status message from SSE events.
 */

export default function StatusIndicator({ status }) {
    if (!status || status.step === 'idle') return null;

    const { step, progress, message } = status;
    const isComplete = step === 'complete';
    const isError = step === 'error';

    return (
        <div
            className="animate-fade-in"
            style={{
                maxWidth: '600px',
                margin: '0 auto',
                padding: '20px 24px',
                borderRadius: 'var(--radius-md)',
                background: isError
                    ? 'rgba(239, 68, 68, 0.08)'
                    : isComplete
                        ? 'rgba(16, 185, 129, 0.08)'
                        : 'rgba(139, 92, 246, 0.08)',
                border: `1px solid ${isError
                    ? 'rgba(239, 68, 68, 0.2)'
                    : isComplete
                        ? 'rgba(16, 185, 129, 0.2)'
                        : 'rgba(139, 92, 246, 0.15)'
                    }`,
            }}
        >
            {/* Status Text */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: progress > 0 && !isComplete && !isError ? '12px' : '0',
                }}
            >
                {/* Spinner / Check / Error icon */}
                <span style={{ fontSize: '1.1rem' }}>
                    {isError ? '❌' : isComplete ? '✅' : (
                        <span
                            style={{
                                display: 'inline-block',
                                width: '18px',
                                height: '18px',
                                border: '2.5px solid var(--border-subtle)',
                                borderTopColor: 'var(--accent-primary)',
                                borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite',
                            }}
                        />
                    )}
                </span>

                <span
                    style={{
                        color: isError
                            ? 'var(--error)'
                            : isComplete
                                ? 'var(--success)'
                                : 'var(--text-primary)',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                    }}
                >
                    {message}
                </span>

                {/* Percentage */}
                {progress > 0 && !isComplete && !isError && (
                    <span
                        style={{
                            marginLeft: 'auto',
                            color: 'var(--accent-primary)',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            fontFamily: 'var(--font-mono)',
                        }}
                    >
                        {progress}%
                    </span>
                )}
            </div>

            {/* Progress Bar */}
            {progress > 0 && !isComplete && !isError && (
                <div
                    style={{
                        width: '100%',
                        height: '4px',
                        background: 'var(--border-subtle)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            height: '100%',
                            width: `${progress}%`,
                            background: 'var(--accent-gradient)',
                            borderRadius: '2px',
                            transition: 'width 0.4s ease-out',
                        }}
                    />
                </div>
            )}
        </div>
    );
}
