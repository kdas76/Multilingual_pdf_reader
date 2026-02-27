/**
 * audioMergeService.js
 * ────────────────────
 * Merges multiple audio chunk files into a single seamless MP3.
 * Uses raw buffer concatenation for MP3 files (no external ffmpeg dependency).
 * 
 * Key design: NO GAPS between chunks for seamless playback.
 */

import fs from 'fs';
import path from 'path';

/**
 * Merge multiple MP3 files into one seamless file
 * MP3 frames are independent, so simple concatenation works for MP3 format.
 * 
 * @param {string[]} chunkPaths - Array of paths to chunk MP3 files
 * @param {string} outputPath - Path for the merged output file
 * @returns {Promise<string>} - Path to merged file
 */
export async function mergeAudioFiles(chunkPaths, outputPath) {
    if (!chunkPaths || chunkPaths.length === 0) {
        throw new Error('No audio chunks to merge');
    }

    // Single file — just copy it
    if (chunkPaths.length === 1) {
        fs.copyFileSync(chunkPaths[0], outputPath);
        return outputPath;
    }

    try {
        console.log(`  🔗 Merging ${chunkPaths.length} audio chunks...`);

        // Read all chunk buffers
        const buffers = [];
        for (const chunkPath of chunkPaths) {
            if (!fs.existsSync(chunkPath)) {
                console.warn(`  ⚠️ Chunk file not found: ${chunkPath}`);
                continue;
            }
            const buffer = fs.readFileSync(chunkPath);
            buffers.push(buffer);
        }

        if (buffers.length === 0) {
            throw new Error('No valid audio chunks found');
        }

        // Concatenate all buffers (MP3 frames are self-contained, so this creates seamless audio)
        const merged = Buffer.concat(buffers);
        fs.writeFileSync(outputPath, merged);

        const sizeMB = (merged.length / (1024 * 1024)).toFixed(2);
        console.log(`  ✅ Merged audio: ${path.basename(outputPath)} (${sizeMB} MB)`);

        return outputPath;
    } catch (error) {
        console.error(`  ❌ Merge error:`, error.message);
        throw new Error(`Audio merge failed: ${error.message}`);
    }
}

/**
 * Clean up temporary chunk files after merging
 * @param {string[]} chunkPaths - Array of chunk file paths to delete
 */
export function cleanupChunks(chunkPaths) {
    let cleaned = 0;
    for (const chunkPath of chunkPaths) {
        try {
            if (fs.existsSync(chunkPath)) {
                fs.unlinkSync(chunkPath);
                cleaned++;
            }
        } catch {
            // Non-critical — log and continue
            console.warn(`  ⚠️ Could not delete chunk: ${path.basename(chunkPath)}`);
        }
    }
    if (cleaned > 0) {
        console.log(`  🧹 Cleaned up ${cleaned} temp chunks`);
    }
}

/**
 * Clean up session audio files
 * @param {string} audioDir - Audio directory
 * @param {string} sessionId - Session ID to clean
 */
export function cleanupSessionAudio(audioDir, sessionId) {
    try {
        const files = fs.readdirSync(audioDir);
        const sessionFiles = files.filter(f => f.startsWith(sessionId));
        for (const file of sessionFiles) {
            fs.unlinkSync(path.join(audioDir, file));
        }
        if (sessionFiles.length > 0) {
            console.log(`  🧹 Cleaned ${sessionFiles.length} files for session ${sessionId.substring(0, 8)}`);
        }
    } catch {
        // Non-critical
    }
}

