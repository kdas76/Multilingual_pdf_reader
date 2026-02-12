import { useState, useCallback, useRef } from 'react';
import Header from './components/Header';
import UploadSection from './components/UploadSection';
import PdfViewer from './components/PdfViewer';
import ReadingControls from './components/ReadingControls';
import useStreamingAudio from './hooks/useStreamingAudio';
import useWordHighlight from './hooks/useWordHighlight';

/**
 * App.jsx — V2 Main Orchestrator
 * ───────────────────────────────
 * Two-panel layout: PDF viewer (left) + reading controls
 * Real-time streaming TTS with word-level highlighting.
 * 
 * Flow:
 * 1. Upload PDF → extract text → send to backend → get session
 * 2. Select language → press Start
 * 3. Backend streams micro-chunks via SSE
 * 4. Audio plays in real-time, words highlighted in PDF
 */

const API_BASE = 'http://localhost:3001/api';

export default function App() {
    // ─── Core State ───
    const [pdfFile, setPdfFile] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [pages, setPages] = useState([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [selectedLanguage, setSelectedLanguage] = useState('en');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);

    // PDF viewer ref for word highlighting
    const pdfContainerRef = useRef(null);

    // ─── Streaming Audio Hook ───
    const streaming = useStreamingAudio();

    // ─── Word Highlight Hook ───
    const highlight = useWordHighlight(pdfContainerRef);

    // Track word highlighting as audio plays
    const prevWordRef = useRef(-1);
    if (streaming.currentWordIndex !== prevWordRef.current) {
        prevWordRef.current = streaming.currentWordIndex;
        if (streaming.currentWordIndex >= 0 && streaming.chunkTextInfo) {
            highlight.highlightWord(
                streaming.currentWordIndex,
                streaming.wordTimings,
                streaming.chunkTextInfo.spokenText,
                streaming.chunkTextInfo.charStart
            );
        }
    }

    /**
     * Handle PDF file selected — extract text, send to backend
     */
    const handleTextExtracted = useCallback(async (text, fileName, file) => {
        setIsProcessing(true);
        setError(null);
        setPdfFile(file);

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

            // Auto-set language to detected language
            if (data.detectedLanguage && data.detectedLanguage.confidence === 'high') {
                setSelectedLanguage(data.detectedLanguage.code);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    }, []);

    /**
     * Start reading from current page
     */
    const handleStart = useCallback(() => {
        if (!sessionId) return;
        highlight.clearHighlight();
        streaming.start(sessionId, selectedLanguage, currentPage, 0);
    }, [sessionId, selectedLanguage, currentPage, streaming, highlight]);

    /**
     * Stop reading
     */
    const handleStop = useCallback(() => {
        streaming.stop(sessionId);
        highlight.clearHighlight();
    }, [streaming, sessionId, highlight]);

    /**
     * Language change — only when not actively reading
     */
    const handleLanguageChange = (lang) => {
        setSelectedLanguage(lang);
    };

    /**
     * Page change
     */
    const handlePageChange = (newPage) => {
        if (newPage < 0 || newPage >= pages.length) return;
        streaming.stop(sessionId);
        highlight.clearHighlight();
        setCurrentPage(newPage);
    };

    /**
     * Click on PDF text to start from that position
     */
    const handleTextClick = (info) => {
        // Could start reading from click position in the future
        console.log('Text clicked:', info.text);
    };

    const hasSession = !!sessionId && pages.length > 0;

    // Determine if we should show the translated text panel
    const showTranslation =
        streaming.chunkTextInfo?.translated && streaming.state === 'playing';

    return (
        <div className="app-container">
            {/* Header */}
            <Header />

            {/* Main Content */}
            <main className="main-content">
                {/* Upload Section — shown when no PDF is loaded */}
                {!hasSession && (
                    <UploadSection
                        onTextExtracted={handleTextExtracted}
                        isProcessing={isProcessing}
                    />
                )}

                {/* Error Display */}
                {error && (
                    <div className="error-banner animate-slide-up">
                        <span>❌ {error}</span>
                        <button onClick={() => setError(null)}>✕</button>
                    </div>
                )}

                {/* Main Reading Interface */}
                {hasSession && (
                    <div className="reading-layout">
                        {/* PDF Viewer */}
                        <div className="pdf-section">
                            <PdfViewer
                                ref={pdfContainerRef}
                                file={pdfFile}
                                currentPage={currentPage}
                                onPageChange={handlePageChange}
                                totalPages={pages.length}
                                onTextClick={handleTextClick}
                                disabled={streaming.state === 'playing'}
                                translatedText={streaming.chunkTextInfo?.spokenText}
                                showTranslation={showTranslation}
                            />
                        </div>

                        {/* Controls Panel */}
                        <div className="controls-section">
                            <ReadingControls
                                state={streaming.state}
                                language={selectedLanguage}
                                onLanguageChange={handleLanguageChange}
                                onStart={handleStart}
                                onPause={streaming.pause}
                                onResume={streaming.resume}
                                onStop={handleStop}
                                currentChunk={streaming.currentChunkIndex}
                                totalChunks={streaming.totalChunks}
                                detectedLanguage={streaming.detectedLanguage}
                                needsTranslation={streaming.needsTranslation}
                            />

                            {/* Upload New PDF button */}
                            <button
                                className="upload-new-btn"
                                onClick={() => {
                                    handleStop();
                                    setSessionId(null);
                                    setPdfFile(null);
                                    setPages([]);
                                    setCurrentPage(0);
                                }}
                            >
                                📤 Upload New PDF
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="app-footer">
                <p>PDF to Speech • Built with React + Edge Neural Voices</p>
            </footer>
        </div>
    );
}
