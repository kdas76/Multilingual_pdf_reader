import { useState, useRef, useCallback, useEffect, forwardRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

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

    useEffect(() => {
        const updateWidth = () => {
            if (!containerRef.current) return;
            const containerWidth = containerRef.current.clientWidth;
            setPageWidth(Math.min(containerWidth - 40, 800));
        };

        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    const onDocumentLoadSuccess = ({ numPages: loadedPages }) => {
        setNumPages(loadedPages);
    };

    const handleTextLayerClick = useCallback(
        (e) => {
            if (disabled) return;

            const root = containerRef.current;
            if (!root) return;

            const textLayer = root.querySelector('.react-pdf__Page__textContent');
            if (!textLayer) return;

            const spans = Array.from(textLayer.querySelectorAll('span'));
            if (spans.length === 0) return;

            let targetSpan = e.target.tagName === 'SPAN' ? e.target : null;

            if (!targetSpan) {
                let bestSpan = null;
                let bestScore = Number.POSITIVE_INFINITY;

                for (const span of spans) {
                    const rect = span.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    const dx = e.clientX < rect.left ? rect.left - e.clientX : e.clientX > rect.right ? e.clientX - rect.right : 0;
                    const dy = Math.abs(midY - e.clientY);
                    const score = dy * 2 + dx;
                    if (score < bestScore) {
                        bestScore = score;
                        bestSpan = span;
                    }
                }

                targetSpan = bestSpan;
            }

            if (!targetSpan) return;

            const targetText = targetSpan.textContent || '';
            const targetRect = targetSpan.getBoundingClientRect();
            let charIndexInSpan = 0;
            if (targetRect.width > 0 && targetText.length > 0) {
                const ratio = (e.clientX - targetRect.left) / targetRect.width;
                const boundedRatio = Math.max(0, Math.min(1, ratio));
                charIndexInSpan = Math.floor(boundedRatio * targetText.length);
            }

            const spanIndex = spans.indexOf(targetSpan);
            if (spanIndex < 0) return;

            let pageOffset = charIndexInSpan;
            for (let i = 0; i < spanIndex; i++) {
                pageOffset += (spans[i].textContent || '').length;
            }

            onTextClick?.({
                pageOffset,
                charIndexInSpan,
                text: targetText,
            });
        },
        [disabled, onTextClick]
    );

    const displayTotalPages = numPages || totalPages || '?';
    const totalPageCount = numPages || totalPages || 1;
    const isPrevDisabled = currentPage <= 0 || disabled;
    const isNextDisabled = currentPage >= totalPageCount - 1 || disabled;

    return (
        <div className="pdf-viewer-container" ref={containerRef}>
            <div className="pdf-viewer-layout">
                <div
                    className="pdf-panel"
                    ref={ref}
                    onClick={handleTextLayerClick}
                    style={{ cursor: disabled ? 'default' : 'text' }}
                >
                    <div className="pdf-page-nav">
                        <button
                            className="pdf-nav-btn"
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={isPrevDisabled}
                        >
                            ‹
                        </button>
                        <span className="pdf-page-info">
                            Page {currentPage + 1} / {displayTotalPages}
                        </span>
                        <button
                            className="pdf-nav-btn"
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={isNextDisabled}
                        >
                            ›
                        </button>
                    </div>

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
                                    <p>Failed to load PDF</p>
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

                {showTranslation && translatedText && (
                    <div className="translated-panel animate-slide-up">
                        <div className="translated-header">
                            <span>Translated Text</span>
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
