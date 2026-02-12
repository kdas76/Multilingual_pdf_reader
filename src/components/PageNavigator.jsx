/**
 * PageNavigator Component
 * ───────────────────────
 * Page-by-page navigation for the extracted PDF content.
 * Shows page preview text and allows navigating between pages.
 */

export default function PageNavigator({ pages, currentPage, onPageChange, disabled }) {
    if (!pages || pages.length === 0) return null;

    const totalPages = pages.length;
    const page = pages[currentPage];

    return (
        <div
            className="glass-card animate-slide-up"
            style={{
                padding: '24px',
                maxWidth: '600px',
                margin: '0 auto',
                animationDelay: '0.3s',
            }}
        >
            {/* Page Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                }}
            >
                <p
                    style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                    }}
                >
                    📖 Page Content
                </p>
                <span
                    style={{
                        color: 'var(--accent-primary)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                    }}
                >
                    {currentPage + 1} / {totalPages}
                </span>
            </div>

            {/* Page Preview */}
            <div
                style={{
                    padding: '16px',
                    background: 'var(--bg-glass)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    marginBottom: '16px',
                }}
            >
                <p
                    style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                    }}
                >
                    {page?.preview || page?.substring(0, 300)}
                    {(page?.length > 300) && '...'}
                </p>
            </div>

            {/* Navigation Buttons */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                }}
            >
                <button
                    className="btn-secondary"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 0 || disabled}
                    style={{
                        flex: '1',
                        opacity: currentPage === 0 ? 0.3 : 1,
                    }}
                >
                    ← Previous
                </button>

                {/* Page dots (for small page counts) */}
                {totalPages <= 10 && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {Array.from({ length: totalPages }, (_, i) => (
                            <button
                                key={i}
                                onClick={() => onPageChange(i)}
                                disabled={disabled}
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    background: i === currentPage ? 'var(--accent-primary)' : 'var(--border-subtle)',
                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease',
                                    padding: 0,
                                }}
                            />
                        ))}
                    </div>
                )}

                <button
                    className="btn-secondary"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages - 1 || disabled}
                    style={{
                        flex: '1',
                        opacity: currentPage === totalPages - 1 ? 0.3 : 1,
                    }}
                >
                    Next →
                </button>
            </div>
        </div>
    );
}
