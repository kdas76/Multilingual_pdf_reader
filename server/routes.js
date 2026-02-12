/**
 * routes.js
 * ─────────
 * API route definitions for the PDF-to-Speech backend.
 */

import { Router } from 'express';
import { processText, generateAudio, getSessionInfo } from './controllers/generateController.js';

const router = Router();

// Process extracted text from PDF (client-side extraction)
router.post('/process-text', processText);

// Generate audio for a page in a specific language (SSE response)
router.post('/generate', generateAudio);

// Get session info (pages, cached audio status)
router.get('/session/:sessionId', getSessionInfo);

export default router;
