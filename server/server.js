import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { config } from 'dotenv';
import rateLimit from 'express-rate-limit';
import router from './routes.js';

// Load .env
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Rate Limiting ───
const limiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// ─── Middleware ───
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// ─── Create required directories ───
const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
}

// ─── Serve static audio files ───
app.use('/audio', express.static(audioDir));

// ─── API Routes ───
app.use('/api', router);

// ─── Error Handler ───
app.use((err, req, res, _next) => {
    console.error('Server Error:', err.message);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ─── Start Server ───
app.listen(PORT, () => {
    console.log(`\n🚀 PDF-to-Speech Server running at http://localhost:${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/api/health\n`);
});
