import { useState, useRef } from 'react';
import pdfToText from 'react-pdftotext';

/**
 * UploadSection Component
 * ───────────────────────
 * Drag & drop PDF upload with visual feedback and progress.
 * Extracts text client-side using react-pdftotext.
 */
export default function UploadSection({ onTextExtracted, isProcessing }) {
    const [isDragging, setIsDragging] = useState(false);
    const [fileName, setFileName] = useState('');
    const [extractionStatus, setExtractionStatus] = useState('');
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    const handleFile = async (file) => {
        if (!file) return;

        // Validate file type
        if (file.type !== 'application/pdf') {
            setError('Please upload a PDF file');
            return;
        }

        // Validate file size (max 50MB)
        if (file.size > 50 * 1024 * 1024) {
            setError('File too large. Maximum size is 50MB.');
            return;
        }

        setError('');
        setFileName(file.name);
        setExtractionStatus('Extracting text from PDF...');

        try {
            const text = await pdfToText(file);

            if (!text || text.trim().length === 0) {
                setError('Could not extract text. This might be a scanned PDF (image-based).');
                setExtractionStatus('');
                return;
            }

            setExtractionStatus(`Extracted ${text.length.toLocaleString()} characters`);
            onTextExtracted(text, file.name);
        } catch (err) {
            console.error('PDF extraction error:', err);
            setError('Failed to read PDF. Please try another file.');
            setExtractionStatus('');
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        handleFile(file);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleClick = () => {
        if (!isProcessing) fileInputRef.current?.click();
    };

    const handleInputChange = (e) => {
        const file = e.target.files[0];
        handleFile(file);
    };

    return (
        <div
            className="glass-card animate-slide-up"
            style={{ padding: '32px', maxWidth: '600px', margin: '0 auto', animationDelay: '0.1s' }}
        >
            {/* Drop Zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={handleClick}
                style={{
                    border: `2px dashed ${isDragging ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '48px 24px',
                    textAlign: 'center',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    background: isDragging ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                    opacity: isProcessing ? 0.5 : 1,
                }}
            >
                {/* Icon */}
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>
                    {fileName ? '✅' : isDragging ? '📥' : '📄'}
                </div>

                {/* Instruction Text */}
                {!fileName ? (
                    <>
                        <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                            Drop your PDF here
                        </p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            or click to browse • Max 50MB
                        </p>
                    </>
                ) : (
                    <>
                        <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--success)', marginBottom: '4px' }}>
                            {fileName}
                        </p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            {extractionStatus}
                        </p>
                    </>
                )}
            </div>

            {/* Error */}
            {error && (
                <div
                    style={{
                        marginTop: '12px',
                        padding: '10px 16px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--error)',
                        fontSize: '0.85rem',
                    }}
                >
                    ⚠️ {error}
                </div>
            )}

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleInputChange}
                style={{ display: 'none' }}
            />
        </div>
    );
}
