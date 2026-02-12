📚 PDF to Multilingual Neural Speech

Convert any uploaded PDF book into natural neural speech with dynamic language switching (English ⇄ Hindi ⇄ Bengali) using a fully free stack powered by Edge Neural Voices.

🎯 Project Goal

Build a web application where:

User uploads a PDF book

The system extracts the English text once

The book starts reading in English

User can switch language anytime (Hindi / Bengali)

System translates internally (if needed)

Generates a new MP3 using neural voices

Returns downloadable audio

All without using paid APIs.

🧠 Core Concept

Extract once. Translate on demand. Generate speech per language.

Original English text is extracted and stored once.

Language switching does NOT reprocess the PDF.

Switching language triggers:

Translation (if needed)

New TTS generation

New MP3 output

This makes the system efficient and scalable.

🏗 System Architecture
React Frontend
      ↓
Express Backend API
      ↓
PDF Extraction (pdf-parse)
      ↓
Store Original English Text (Session-Based)
      ↓
Language Selected?
      ↓
If English → Edge TTS
If Hindi/Bengali → Translate → Edge TTS
      ↓
Chunk Processing
      ↓
Merge Audio Files
      ↓
Return MP3 URL
🖥 Frontend (React)
UI Components
1️⃣ Upload Section

Centered upload card

Drag & drop area

File input button

Upload progress bar

2️⃣ Language Switcher

Dropdown options:

English

Hindi

Bengali

Changing selection triggers:

POST /generate
3️⃣ Audio Section

HTML <audio> player

Play / Pause

Download button

Loading spinner during processing

4️⃣ Status Indicator

Shows:

Extracting PDF...

Translating...

Generating audio...

Ready

Suggested UI Layout
---------------------------------------
|        PDF to Speech App            |
---------------------------------------
|  [ Upload PDF ]                     |
|                                      |
|  Language: [ English ▼ ]            |
|                                      |
|  [ Generate Audio ]                 |
|                                      |
|  🔊 Audio Player                    |
|  [ Play | Pause ]                   |
|  [ Download MP3 ]                   |
---------------------------------------
Frontend Responsibilities

Upload PDF to backend

Store session ID

Send selected language to backend

Receive MP3 URL

Play audio

Handle loading and errors

🖥 Backend (Node.js + Express)
Core Responsibilities

Receive PDF upload

Extract text

Clean text

Store original English text (session-based)

Translate when required

Generate speech using edge-tts

Chunk large text

Merge audio

Return final MP3 file

📦 Backend Stack

Express

pdf-parse

@vitalets/google-translate-api

edge-tts

multer

fs

path

📂 Backend Folder Structure
server/
│
├── controllers/
│   ├── uploadController.js
│   └── generateController.js
│
├── services/
│   ├── pdfService.js
│   ├── textCleaner.js
│   ├── translationService.js
│   ├── ttsService.js
│   ├── chunkService.js
│   └── audioMergeService.js
│
├── uploads/
├── audio/
│
├── routes.js
├── server.js
└── package.json
🔄 Backend Workflow
1️⃣ Upload Route
POST /upload
Steps:

Receive file via multer

Extract text using pdf-parse

Clean extracted text

Store cleaned English text in memory (Map/session)

Generate sessionId

Return sessionId to frontend

2️⃣ Generate Route
POST /generate

Request Body:

{
  "sessionId": "abc123",
  "language": "en" | "hi" | "bn"
}
Logic
Case 1: English
originalEnglishText
      ↓
Chunk text
      ↓
Edge TTS (English voice)
      ↓
Merge audio
      ↓
Return MP3
Case 2: Hindi or Bengali
originalEnglishText
      ↓
Translate (Google Translate API)
      ↓
Translated text
      ↓
Chunk text
      ↓
Edge TTS (Selected voice)
      ↓
Merge audio
      ↓
Return MP3
🔊 Edge TTS Integration

Edge TTS runs inside backend only.

Installation
npm install edge-tts
Voice Mapping

English:

en-US-JennyNeural

Hindi:

hi-IN-MadhurNeural

Bengali:

bn-BD-NabanitaNeural
✂ Chunking Strategy (Mandatory)

Large text must be split.

Rules:

Split every 2000–3000 characters

Do not cut words in half

Process each chunk sequentially

Save temporary chunk audio files

Merge into single final MP3

🧹 Text Cleaning (Mandatory)

Before translation or TTS:

Remove multiple line breaks

Replace multiple spaces

Normalize punctuation

Remove page numbers

Add paragraph pauses

Clean text significantly improves speech quality.

🗂 Storage Strategy
Temporary Storage

Store extracted English text per session

Store generated audio inside /audio

Optional: auto-delete files after X hours

⚙ Backend Must Handle

Large file uploads

Memory safety

Proper chunking

Translation failures

TTS failures

Concurrent users

Cleanup of temp files

Rate limit errors

🧪 Edge Cases

Scanned PDF (no extractable text)

Empty file

Language switch before upload

Very large books

Translation timeout

TTS request limit

🚀 Deployment (Free Options)

Frontend:

Vercel

Backend:

Render

Railway

Note:
Free hosting may introduce cold-start delay.

🔐 Important Notes About Edge TTS

Uses Microsoft neural voices

No API key required

Free for moderate use

Not officially guaranteed for enterprise production

Suitable for learning and small-scale apps

🎬 Final Expected Behavior

User uploads book

Backend extracts English text

English audio generated

User switches to Hindi

Text translated

Hindi audio generated

User switches to Bengali

Text translated

Bengali audio generated

No re-extraction required.

Only translation + new TTS.

✅ Conclusion

This system is fully achievable using:

React frontend

Express backend

Free translation

Edge neural TTS

Success depends on:

Proper chunking

Clean text processing

Session-based storage

Efficient audio merging

End of README.md