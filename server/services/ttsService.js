import { EdgeTTS } from 'node-edge-tts';
import path from 'path';
import fs from 'fs';

const VOICE_MAP = {
    en: { lang: 'en-US', female: 'en-US-JennyNeural', male: 'en-US-GuyNeural' },
    hi: { lang: 'hi-IN', female: 'hi-IN-SwaraNeural', male: 'hi-IN-MadhurNeural' },
    bn: { lang: 'bn-IN', female: 'bn-IN-TanishaaNeural', male: 'bn-IN-BashkarNeural' },
    ta: { lang: 'ta-IN', female: 'ta-IN-PallaviNeural', male: 'ta-IN-ValluvarNeural' },
    te: { lang: 'te-IN', female: 'te-IN-ShrutiNeural', male: 'te-IN-MohanNeural' },
    mr: { lang: 'mr-IN', female: 'mr-IN-AarohiNeural', male: 'mr-IN-ManoharNeural' },
    gu: { lang: 'gu-IN', female: 'gu-IN-DhwaniNeural', male: 'gu-IN-NiranjanNeural' },
    kn: { lang: 'kn-IN', female: 'kn-IN-SapnaNeural', male: 'kn-IN-GaganNeural' },
    ml: { lang: 'ml-IN', female: 'ml-IN-SobhanaNeural', male: 'ml-IN-MidhunNeural' },
    pa: { lang: 'pa-IN', female: 'pa-IN-GurleenNeural', male: 'pa-IN-VikasNeural' },
    or: { lang: 'or-IN', female: 'or-IN-RupashreeNeural', male: 'or-IN-KishoreNeural' },
    as: { lang: 'as-IN', female: 'as-IN-YashicaNeural', male: 'as-IN-PrabhatNeural' },
    ur: { lang: 'ur-IN', female: 'ur-IN-GulNeural', male: 'ur-IN-SalmanNeural' },
};

function clampSpeed(speed) {
    const numeric = Number(speed);
    if (!Number.isFinite(numeric)) return 1;
    return Math.max(0.5, Math.min(2, numeric));
}

function speedToRate(speed) {
    const clamped = clampSpeed(speed);
    const percent = Math.round((clamped - 1) * 100);
    return `${percent >= 0 ? '+' : ''}${percent}%`;
}

function getVoiceConfig(language, voiceGender = 'female', speed = 1) {
    const voicePack = VOICE_MAP[language] || VOICE_MAP.en;
    const selectedVoice = voiceGender === 'male' ? voicePack.male : voicePack.female;

    return {
        voice: selectedVoice || voicePack.female || VOICE_MAP.en.female,
        lang: voicePack.lang || 'en-US',
        rate: speedToRate(speed),
        pitch: '+0Hz',
        volume: '+5%',
    };
}

async function synthesizeToFile(text, outputPath, config) {
    const tts = new EdgeTTS({
        voice: config.voice,
        lang: config.lang,
        outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
        saveSubtitles: true,
        rate: config.rate,
        pitch: config.pitch,
        volume: config.volume,
        timeout: 30000,
    });

    await tts.ttsPromise(text, outputPath);
}

export async function generateSpeechWithTimings(text, language, outputPath, options = {}) {
    if (!text || text.trim().length === 0) {
        throw new Error('Empty text provided for TTS');
    }

    const config = getVoiceConfig(language, options.voiceGender, options.speed);

    try {
        try {
            await synthesizeToFile(text, outputPath, config);
        } catch (primaryError) {
            if (language !== 'en') {
                const fallbackConfig = getVoiceConfig('en', 'female', options.speed);
                await synthesizeToFile(text, outputPath, fallbackConfig);
            } else {
                throw primaryError;
            }
        }

        const subtitlePath = outputPath.replace(/\.mp3$/, '.json');
        let wordTimings = [];

        if (fs.existsSync(subtitlePath)) {
            try {
                const subtitleData = fs.readFileSync(subtitlePath, 'utf-8');
                wordTimings = JSON.parse(subtitleData);
                fs.unlinkSync(subtitlePath);
            } catch {
                console.warn('Could not parse subtitle data');
            }
        }

        console.log(`Generated: ${path.basename(outputPath)} (${language}, ${wordTimings.length} words)`);

        return { audioPath: outputPath, wordTimings };
    } catch (error) {
        console.error(`TTS Error (${language}):`, error.message);
        throw new Error(`Speech generation failed for ${language}: ${error.message}`);
    }
}

export async function generateSpeech(text, language, outputPath, options = {}) {
    const result = await generateSpeechWithTimings(text, language, outputPath, options);
    return result.audioPath;
}

export async function generateChunkWithTimings(
    text,
    language,
    outputPath,
    options = {},
    retries = 2
) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await generateSpeechWithTimings(text, language, outputPath, options);
        } catch (error) {
            if (attempt < retries) {
                console.log(`Retry ${attempt}/${retries} for TTS chunk...`);
                await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            } else {
                throw error;
            }
        }
    }

    throw new Error('TTS retries exhausted');
}

export function getAvailableVoices() {
    return Object.entries(VOICE_MAP).flatMap(([lang, config]) => ([
        {
            language: lang,
            gender: 'female',
            voice: config.female,
        },
        {
            language: lang,
            gender: 'male',
            voice: config.male,
        },
    ]));
}
