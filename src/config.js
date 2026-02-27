/**
 * config.js
 * ─────────
 * Centralized configuration for the frontend.
 * Uses Vite environment variables with sensible defaults.
 */

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';
export const AUDIO_BASE = import.meta.env.VITE_AUDIO_BASE || 'http://localhost:3001';
