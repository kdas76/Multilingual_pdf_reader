/**
 * routes.js — V2
 * ───────────────
 * API route definitions.
 * 
 * POST /api/process-text   → clean/process extracted text, create session
 * POST /api/stream-read    → real-time streaming TTS (SSE)
 * POST /api/stop-reading   → stop active reading stream
 * GET  /api/session/:id    → get session info
 * GET  /api/health         → health check
 */

import { Router } from 'express';
import { processText, streamRead, stopReading, getSession } from './controllers/generateController.js';

const router = Router();

router.post('/process-text', processText);
router.post('/stream-read', streamRead);
router.post('/stop-reading', stopReading);
router.get('/session/:id', getSession);

router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
