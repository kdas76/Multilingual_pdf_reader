import { useState, useCallback } from 'react';
import Header from './components/Header';
import UploadSection from './components/UploadSection';
import LanguageSwitcher from './components/LanguageSwitcher';
import PageNavigator from './components/PageNavigator';
import StatusIndicator from './components/StatusIndicator';
import AudioPlayer from './components/AudioPlayer';

/**
 * App.jsx — Main Orchestrator
 * ───────────────────────────
 * Connects frontend components to backend API.
 * Flow: Upload PDF → Extract text → Send to backend → Select language → Generate audio
 */

const API_BASE = 'http://localhost:3001/api';

export default function App() {
    // ─── State ───
    const [sessionId, setSessionId] = useState(null);
    const [pages, setPages] = useState([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [selectedLanguage, setSelectedLanguage] = useState('en');
    const [audioUrl, setAudioUrl] = useState(null);
    const [status, setStatus] = useState({ step: 'idle', progress: 0, message: '' });
    const [isProcessing, setIsProcessing] = useState(false);
    const [pdfName, setPdfName] = useState('');

    /**
     * Handle extracted text from PDF → Send to backend for processing
     */
    const handleTextExtracted = useCallback(async (text, fileName) => {
        setPdfName(fileName);
        setIsProcessing(true);
        setStatus({ step: 'processing', progress: 10, message: 'Processing extracted text...' });

        try {
            const response = await fetch(`${API_BASE}/process-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to process text');
            }

            const data = await response.json();
            setSessionId(data.sessionId);
            setPages(data.pagePreviews);
            setCurrentPage(0);
            setAudioUrl(null);
            setStatus({ step: 'idle', progress: 0, message: '' });
            setIsProcessing(false);
        } catch (error) {
            console.error('Process text error:', error);
            setStatus({ step: 'error', progress: 0, message: error.message });
            setIsProcessing(false);
        }
    }, []);

    /**
     * Generate audio for the current page in the selected language
     * Uses SSE (Server-Sent Events) for real-time progress
     */
    const handleGenerateAudio = useCallback(async () => {
        if (!sessionId) return;

        setIsProcessing(true);
        setAudioUrl(null);
        setStatus({ step: 'start', progress: 5, message: 'Starting audio generation...' });

        try {
            const response = await fetch(`${API_BASE}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    language: selectedLanguage,
                    pageIndex: currentPage,
                }),
            });

            // Check if it's a cached response (regular JSON)
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                if (data.audioUrl) {
                    setAudioUrl(data.audioUrl);
                    setStatus({ step: 'complete', progress: 100, message: 'Audio ready! (cached)' });
                    setIsProcessing(false);
                    return;
                }
            }

            // SSE response — read the stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Parse SSE events
                const events = buffer.split('\n\n');
                buffer = events.pop() || ''; // Keep incomplete event in buffer

                for (const event of events) {
                    const dataLine = event.split('\n').find(line => line.startsWith('data: '));
                    if (!dataLine) continue;

                    try {
                        const data = JSON.parse(dataLine.substring(6));

                        if (data.type === 'progress') {
                            setStatus({
                                step: data.step,
                                progress: data.progress,
                                message: data.message,
                            });
                        } else if (data.type === 'complete') {
                            setAudioUrl(data.audioUrl);
                            setStatus({ step: 'complete', progress: 100, message: 'Audio ready!' });
                            setIsProcessing(false);
                        } else if (data.type === 'error') {
                            setStatus({ step: 'error', progress: 0, message: data.message });
                            setIsProcessing(false);
                        }
                    } catch (e) {
                        // Skip malformed events
                    }
                }
            }
        } catch (error) {
            console.error('Generate error:', error);
            setStatus({ step: 'error', progress: 0, message: `Connection failed: ${error.message}` });
            setIsProcessing(false);
        }
    }, [sessionId, selectedLanguage, currentPage]);

    /**
     * Handle language change
     */
    const handleLanguageChange = (langCode) => {
        setSelectedLanguage(langCode);
        // Clear current audio when language changes (user will need to regenerate)
        setAudioUrl(null);
        setStatus({ step: 'idle', progress: 0, message: '' });
    };

    /**
     * Handle page navigation
     */
    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        setAudioUrl(null);
        setStatus({ step: 'idle', progress: 0, message: '' });
    };

    const hasPages = pages.length > 0;

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header */}
            <Header />

            {/* Main Content */}
            <main
                style={{
                    flex: 1,
                    padding: '0 24px 40px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                }}
            >
                {/* Upload Section */}
                <UploadSection
                    onTextExtracted={handleTextExtracted}
                    isProcessing={isProcessing}
                />

                {/* Show these only after PDF is processed */}
                {hasPages && (
                    <>
                        {/* Language Switcher */}
                        <LanguageSwitcher
                            selectedLanguage={selectedLanguage}
                            onLanguageChange={handleLanguageChange}
                            disabled={isProcessing}
                        />

                        {/* Page Navigator */}
                        <PageNavigator
                            pages={pages.map(p => p.preview)}
                            currentPage={currentPage}
                            onPageChange={handlePageChange}
                            disabled={isProcessing}
                        />

                        {/* Generate Button */}
                        <div
                            className="animate-slide-up"
                            style={{
                                maxWidth: '600px',
                                margin: '0 auto',
                                width: '100%',
                                textAlign: 'center',
                                animationDelay: '0.35s',
                            }}
                        >
                            <button
                                className="btn-primary"
                                onClick={handleGenerateAudio}
                                disabled={isProcessing}
                                style={{
                                    padding: '14px 40px',
                                    fontSize: '1rem',
                                    width: '100%',
                                    maxWidth: '300px',
                                }}
                            >
                                {isProcessing ? '⏳ Generating...' : '🎙️ Generate Audio'}
                            </button>
                        </div>

                        {/* Status Indicator */}
                        <StatusIndicator status={status} />

                        {/* Audio Player */}
                        <AudioPlayer
                            audioUrl={audioUrl}
                            language={selectedLanguage}
                            pageIndex={currentPage}
                        />
                    </>
                )}
            </main>

            {/* Footer */}
            <footer
                style={{
                    padding: '20px',
                    textAlign: 'center',
                    borderTop: '1px solid var(--border-subtle)',
                }}
            >
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    PDF to Speech • Built with React + Edge Neural Voices
                </p>
            </footer>
        </div>
    );
}
