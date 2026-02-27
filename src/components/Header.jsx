/**
 * Header Component
 * ────────────────
 * App branding and subtitle with animated gradient text.
 */
export default function Header() {
    return (
        <header
            style={{
                padding: '32px 24px 24px',
                textAlign: 'center',
                animation: 'fadeIn 0.6s ease-out',
            }}
        >
            {/* Logo / Icon */}
            <div
                style={{
                    fontSize: '3rem',
                    marginBottom: '12px',
                    filter: 'drop-shadow(0 0 20px rgba(139, 92, 246, 0.4))',
                }}
            >
                📚
            </div>

            {/* Title */}
            <h1
                style={{
                    fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1, #3b82f6, #8b5cf6)',
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: 'shimmer 3s linear infinite',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                }}
            >
                PDF to Speech
            </h1>

            {/* Subtitle */}
            <p
                style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.95rem',
                    marginTop: '8px',
                    fontWeight: 400,
                    maxWidth: '500px',
                    margin: '8px auto 0',
                }}
            >
                Upload a PDF book and listen in{' '}
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>English</span>,{' '}
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>Hindi</span>, or{' '}
                <span style={{ color: '#10b981', fontWeight: 600 }}>Bengali</span>
            </p>

            {/* Decorative line */}
            <div
                style={{
                    width: '60px',
                    height: '3px',
                    background: 'var(--accent-gradient)',
                    borderRadius: '2px',
                    margin: '20px auto 0',
                }}
            />
        </header>
    );
}
