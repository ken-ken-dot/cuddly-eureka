# VUGA backend proxy

Thin Express proxy whose only job is to hold provider API keys and forward
STT/MT/TTS requests. **The mobile app never talks to providers directly** —
that would ship API keys inside the compiled app.

## Routes

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/health` | — | `{ ok, provider, googleConfigured, time }` |
| GET | `/api/languages` | — | supported languages (V1: `rw`, `zh-CN`) |
| POST | `/api/transcribe` | `{ audio, languageCode }` (audio = base64) | `{ text, lang, confidence, provider, mock }` |
| POST | `/api/translate` | `{ text, sourceLang, targetLang }` | `{ translated, provider, mock }` |
| POST | `/api/tts` | `{ text, languageCode }` | `{ audioBase64, mimeType, provider, mock }` |

Error responses always have the shape
`{ error: { code, message } }` with human-readable `message` copy — the app
shows it verbatim.

## Setup

```bash
cp .env.example .env      # then edit .env
npm install
npm run dev               # tsx watch, http://localhost:8787
```

### Modes

- **mock** (`VUGA_PROVIDER=mock`, default): deterministic fake responses, no
  network, no keys. Lets the whole app be built and tested before credentials
  exist. Mock output is clearly marked (`mock: true`) — it is NOT translation.
- **google** (`VUGA_PROVIDER=google`): real Google Cloud STT V2 (`rw-RW`),
  Translation NMT (`rw ⇄ zh-CN`), and Text-to-Speech. Requires:

  - `GOOGLE_APPLICATION_CREDENTIALS_JSON` — full service-account key JSON
    (or `GOOGLE_APPLICATION_CREDENTIALS_JSON_FILE` pointing at a mounted file)
  - `GOOGLE_CLOUD_PROJECT` — project id
  - APIs enabled on the project: Speech-to-Text, Cloud Translation, Cloud TTS

## Testing with curl

```bash
curl http://localhost:8787/api/health

curl -X POST http://localhost:8787/api/translate \
  -H 'Content-Type: application/json' \
  -d '{"text":"amafaranga angahe?","sourceLang":"rw","targetLang":"zh-CN"}'
```

## Design notes

- `src/google/client.ts` implements the service-account JWT flow directly —
  one token endpoint call, no heavy SDK — and caches the token for an hour.
- STT uses Speech-to-Text **V2** `batchRecognize` with speech adaptation
  boosted by the market-vendor vocabulary.
- Translation deliberately uses the classic **NMT** endpoint
  (`/language/translate/v2`). Google's newer "Translation LLM" offering does
  not list Kinyarwanda — do not switch endpoints without re-checking that.
- `corrections.json` is the curated common-mistake list (V1 scope). The
  matcher that consumes it lives in `src/matcher.ts`; the same file shape is
  embedded in the app.
