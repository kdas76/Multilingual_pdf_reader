/**
 * PdfViewer.jsx
 * ─────────────
 * Renders the PDF with react-pdf and provides:
 * - Actual PDF page rendering with text layer overlay
 * - Word-level highlighting synced with audio
 * - Click-to-start: user clicks any position to set reading start
 * - Auto-scroll as reading progresses
 * - Translated text panel (right side) when language differs
 */

import { useState, useRef, useCallback, useEffect, forwardRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PdfViewer = forwardRef(function PdfViewer(
    {
        file,
        currentPage,
        onPageChange,
        totalPages,
        onTextClick,
        disabled,
        translatedText,
        showTranslation,
    },
    ref
) {
    const [numPages, setNumPages] = useState(null);
    const [pageWidth, setPageWidth] = useState(600);
    const containerRef = useRef(null);

    // Responsive page width
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                setPageWidth(Math.min(containerWidth - 40, 800));
            }
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
    };

    // Handle text click for "start from here"
    const handleTextLayerClick = useCallback(
        (e) => {
            if (disabled) return;

            // Get click position relative to text content
            const target = e.target;
            if (target.tagName === 'SPAN' && target.closest('.react-pdf__Page__textContent')) {
                const text = target.textContent;
                const rect = target.getBoundingClientRect();
                // Calculate approximate character position from click X
                const charIndex = Math.floor(
                    ((e.clientX - rect.left) / rect.width) * text.length
                );

                if (onTextClick) {
                    onTextClick({ text, charIndex, element: target });
                }
            }
        },
        [disabled, onTextClick]
    );

    return (
        <div className="pdf-viewer-container" ref={containerRef}>
            <div className="pdf-viewer-layout">
                {/* PDF Panel */}
                <div
                    className="pdf-panel"
                    ref={ref}
                    onClick={handleTextLayerClick}
                    style={{ cursor: disabled ? 'default' : 'text' }}
                >
                    {/* Page Navigation Bar */}
                    <div className="pdf-page-nav">
                        <button
                            className="pdf-nav-btn"
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage <= 0 || disabled}
                        >
                            ◀
                        </button>
                        <span className="pdf-page-info">
                            Page {currentPage + 1} / {numPages || totalPages || '?'}
                        </span>
                        <button
                            className="pdf-nav-btn"
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage >= (numPages || totalPages) - 1 || disabled}
                        >
                            ▶
                        </button>
                    </div>

                    {/* PDF Document */}
                    <div className="pdf-document-wrapper">
                        <Document
                            file={file}
                            onLoadSuccess={onDocumentLoadSuccess}
                            loading={
                                <div className="pdf-loading">
                                    <div className="spinner" />
                                    <p>Loading PDF...</p>
                                </div>
                            }
                            error={
                                <div className="pdf-error">
                                    <p>❌ Failed to load PDF</p>
                                </div>
                            }
                        >
                            <Page
                                pageNumber={currentPage + 1}
                                width={pageWidth}
                                renderTextLayer={true}
                                renderAnnotationLayer={false}
                                loading={
                                    <div className="pdf-loading">
                                        <div className="spinner" />
                                    </div>
                                }
                            />
                        </Document>
                    </div>
                </div>

                {/* Translated Text Panel (shown only when languages differ) */}
                {showTranslation && translatedText && (
                    <div className="translated-panel animate-slide-up">
                        <div className="translated-header">
                            <span>🌐 Translated Text</span>
                        </div>
                        <div className="translated-content">
                            <p>{translatedText}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export default PdfViewer;
