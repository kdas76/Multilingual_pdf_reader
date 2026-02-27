import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'sessions.json');

const sessions = new Map();

function ensureStoreFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
        fs.writeFileSync(STORE_PATH, '[]', 'utf-8');
    }
}

function serializeSession(session) {
    return {
        id: session.id,
        fullText: session.fullText,
        pages: Array.isArray(session.pages) ? session.pages : [],
        detectedLanguage: session.detectedLanguage || null,
        lastAccess: typeof session.lastAccess === 'number' ? session.lastAccess : Date.now(),
    };
}

let persistTimer = null;

function persistSessions() {
    // Debounce: wait 2s after last call before writing
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
        ensureStoreFile();
        const payload = Array.from(sessions.values()).map(serializeSession);
        fs.writeFileSync(STORE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
        persistTimer = null;
    }, 2000);
}

function loadSessions() {
    ensureStoreFile();
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    for (const item of parsed) {
        if (!item || !item.id) continue;
        sessions.set(item.id, {
            id: item.id,
            fullText: item.fullText || '',
            pages: Array.isArray(item.pages) ? item.pages : [],
            detectedLanguage: item.detectedLanguage || null,
            audioCacheMap: new Map(),
            lastAccess: typeof item.lastAccess === 'number' ? item.lastAccess : Date.now(),
        });
    }
}

loadSessions();

export function upsertSession(session) {
    sessions.set(session.id, {
        ...session,
        audioCacheMap: session.audioCacheMap || new Map(),
        lastAccess: typeof session.lastAccess === 'number' ? session.lastAccess : Date.now(),
    });
    persistSessions();
}

export function getSessionById(sessionId) {
    return sessions.get(sessionId) || null;
}

export function deleteSessionById(sessionId) {
    sessions.delete(sessionId);
    persistSessions();
}

export function listSessionEntries() {
    return sessions.entries();
}

export function touchSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return null;
    session.lastAccess = Date.now();
    persistSessions();
    return session;
}
