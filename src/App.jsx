import { useState, useCallback, useRef, useEffect } from 'react';
import Header from './components/Header';
import UploadSection from './components/UploadSection';
import PdfViewer from './components/PdfViewer';
import ReadingControls from './components/ReadingControls';
import useStreamingAudio from './hooks/useStreamingAudio';
import useWordHighlight from './hooks/useWordHighlight';
import useAmbientBackground from './hooks/useAmbientBackground';
import { API_BASE, AUDIO_BASE } from './config';

export default function App() {
    // ─── Theme ───
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('pdf-reader-theme');
        if (saved) return saved;
        return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('pdf-reader-theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

    // ─── Core State ───
    const [pdfFile, setPdfFile] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [pages, setPages] = useState([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [selectedLanguage, setSelectedLanguage] = useState('en');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [startOffset, setStartOffset] = useState(0);
    const [readingSpeed, setReadingSpeed] = useState(1);
    const [voiceGender, setVoiceGender] = useState('female');
    const [isGeneratingAudiobook, setIsGeneratingAudiobook] = useState(false);
    const [audiobookUrl, setAudiobookUrl] = useState('');
    const [ambientEnabled, setAmbientEnabled] = useState(false);
    const [ambientVolume, setAmbientVolume] = useState(0.08);

    const pdfContainerRef = useRef(null);
    const prevWordRef = useRef(-1);
    const autoAdvancedPageRef = useRef(-1);

    const streaming = useStreamingAudio();
    const { highlightWord, clearHighlight } = useWordHighlight(pdfContainerRef);
    const ambient = useAmbientBackground(ambientVolume);

    useEffect(() => {
        if (streaming.currentWordIndex === prevWordRef.current) return;

        prevWordRef.current = streaming.currentWordIndex;

        if (streaming.currentWordIndex >= 0 && streaming.chunkTextInfo) {
            highlightWord(
                streaming.currentWordIndex,
                streaming.wordTimings,
                streaming.chunkTextInfo
            );
        }
    }, [
        highlightWord,
        streaming.currentWordIndex,
        streaming.wordTimings,
        streaming.chunkTextInfo,
    ]);

    // ─── Save reading position to localStorage ───
    useEffect(() => {
        if (!sessionId || pages.length === 0) return;
        localStorage.setItem('pdf-reader-position', JSON.stringify({
            sessionId,
            currentPage,
            startOffset,
            selectedLanguage,
            timestamp: Date.now(),
        }));
    }, [sessionId, currentPage, startOffset, selectedLanguage, pages.length]);

    useEffect(() => {
        if (ambientEnabled && streaming.state === 'playing') {
            ambient.start();
        } else {
            ambient.stop();
        }
    }, [ambientEnabled, streaming.state, ambient]);

    useEffect(() => {
        if (!sessionId || pages.length === 0) return;
        if (streaming.state !== 'idle') return;
        if (!Number.isInteger(streaming.lastCompletedPage)) return;
        if (streaming.lastCompletedPage !== currentPage) return;
        if (currentPage >= pages.length - 1) return;
        if (autoAdvancedPageRef.current === streaming.lastCompletedPage) return;

        const nextPage = currentPage + 1;
        autoAdvancedPageRef.current = streaming.lastCompletedPage;
        setCurrentPage(nextPage);
        setStartOffset(0);
        clearHighlight();
        streaming.start(sessionId, selectedLanguage, nextPage, 0, {
            speed: readingSpeed,
            voiceGender,
        });
    }, [
        sessionId,
        pages.length,
        currentPage,
        selectedLanguage,
        readingSpeed,
        voiceGender,
        streaming,
        clearHighlight,
    ]);

    const handleTextExtracted = useCallback(async ({ text, pages: extractedPages, file }) => {
        setIsProcessing(true);
        setError(null);
        setPdfFile(file);

        try {
            const response = await fetch(`${API_BASE}/process-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    pages: extractedPages,
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to process text');
            }

            const data = await response.json();
            setSessionId(data.sessionId);
            setPages(data.pagePreviews);
            setCurrentPage(0);
            setStartOffset(0);
            setAudiobookUrl('');

            if (data.detectedLanguage && data.detectedLanguage.confidence === 'high') {
                setSelectedLanguage(data.detectedLanguage.code);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const handleStart = useCallback(() => {
        if (!sessionId) return;
        autoAdvancedPageRef.current = -1;
        clearHighlight();
        streaming.start(sessionId, selectedLanguage, currentPage, startOffset, {
            speed: readingSpeed,
            voiceGender,
        });
    }, [
        sessionId,
        selectedLanguage,
        currentPage,
        startOffset,
        readingSpeed,
        voiceGender,
        streaming,
        clearHighlight,
    ]);

    const handleStop = useCallback(() => {
        streaming.stop(sessionId);
        ambient.stop();
        clearHighlight();
    }, [streaming, sessionId, clearHighlight, ambient]);

    const handlePause = useCallback(() => {
        streaming.pause();
        ambient.stop();
    }, [streaming, ambient]);

    const handleResume = useCallback(() => {
        streaming.resume();
    }, [streaming]);

    const handleLanguageChange = (lang) => {
        setSelectedLanguage(lang);
        setAudiobookUrl('');
    };

    const handlePageChange = (newPage) => {
        if (newPage < 0 || newPage >= pages.length) return;

        if (streaming.state === 'playing' || streaming.state === 'paused' || streaming.state === 'loading') {
            streaming.stop(sessionId);
        }

        clearHighlight();
        setCurrentPage(newPage);
        setStartOffset(0);
        autoAdvancedPageRef.current = -1;
    };

    const handleTextClick = (info) => {
        if (typeof info.pageOffset !== 'number' || info.pageOffset < 0) return;
        const nextOffset = Math.floor(info.pageOffset);
        setStartOffset(nextOffset);
    };

    const handleGenerateAudiobook = useCallback(async () => {
        if (!sessionId) return;

        setIsGeneratingAudiobook(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/generate-book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    language: selectedLanguage,
                    speed: readingSpeed,
                    voiceGender,
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to generate audiobook');
            }

            const data = await response.json();
            setAudiobookUrl(`${AUDIO_BASE}${data.audioUrl}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsGeneratingAudiobook(false);
        }
    }, [sessionId, selectedLanguage, readingSpeed, voiceGender]);

    const hasSession = !!sessionId && pages.length > 0;
    const isReadingActive =
        streaming.state === 'playing' ||
        streaming.state === 'paused' ||
        streaming.state === 'loading';
    const showTranslation =
        streaming.chunkTextInfo?.translated &&
        (streaming.state === 'playing' || streaming.state === 'paused');

    return (
        <div className="app-container">
            <Header />
            <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            <main className="main-content">
                {!hasSession && (
                    <UploadSection
                        onTextExtracted={handleTextExtracted}
                        isProcessing={isProcessing}
                    />
                )}

                {error && (
                    <div className="error-banner animate-slide-up">
                        <span>❌ {error}</span>
                        <button onClick={() => setError(null)}>✕</button>
                    </div>
                )}

                {hasSession && (
                    <div className="reading-layout">
                        <div className="pdf-section">
                            <PdfViewer
                                ref={pdfContainerRef}
                                file={pdfFile}
                                currentPage={currentPage}
                                onPageChange={handlePageChange}
                                totalPages={pages.length}
                                onTextClick={handleTextClick}
                                disabled={isReadingActive}
                                translatedText={streaming.chunkTextInfo?.spokenText}
                                showTranslation={showTranslation}
                            />
                        </div>

                        <div className="controls-section">
                            <ReadingControls
                                state={streaming.state}
                                language={selectedLanguage}
                                onLanguageChange={handleLanguageChange}
                                onStart={handleStart}
                                onPause={handlePause}
                                onResume={handleResume}
                                onStop={handleStop}
                                currentChunk={streaming.currentChunkIndex}
                                totalChunks={streaming.totalChunks}
                                detectedLanguage={streaming.detectedLanguage}
                                needsTranslation={streaming.needsTranslation}
                                startOffset={startOffset}
                                onResetStartOffset={() => setStartOffset(0)}
                                readingSpeed={readingSpeed}
                                onReadingSpeedChange={setReadingSpeed}
                                voiceGender={voiceGender}
                                onVoiceGenderChange={setVoiceGender}
                                onGenerateAudiobook={handleGenerateAudiobook}
                                isGeneratingAudiobook={isGeneratingAudiobook}
                                audiobookUrl={audiobookUrl}
                                ambientEnabled={ambientEnabled}
                                onAmbientToggle={setAmbientEnabled}
                                ambientVolume={ambientVolume}
                                onAmbientVolumeChange={setAmbientVolume}
                                currentPage={currentPage}
                                totalPages={pages.length}
                            />

                            <button
                                className="upload-new-btn"
                                onClick={() => {
                                    handleStop();
                                    setSessionId(null);
                                    setPdfFile(null);
                                    setPages([]);
                                    setCurrentPage(0);
                                    setStartOffset(0);
                                    setAudiobookUrl('');
                                    autoAdvancedPageRef.current = -1;
                                }}
                            >
                                Upload New PDF
                            </button>
                        </div>
                    </div>
                )}
            </main>

            <footer className="app-footer">
                <p>PDF to Speech • Built with React + Edge Neural Voices</p>
            </footer>
        </div>
    );
}
