# VUGA

Kinyarwanda ⇄ Mandarin speech translation with correction coaching, built for
market vendors — now extended additively with real-time translation across
four verified languages: Kinyarwanda, English, German, Mandarin. Free for
individual users: no ads, no paywalls, no accounts required.

## Layout

```
backend/            Node.js + Express proxy — holds provider keys, forwards STT/MT/TTS
mobile/             Expo (managed, SDK 54) app — Translate / Learn / Profile tabs
corrections.json    Shared curated mistake list (single source of truth for backend + app)
```

## Quick start

```bash
npm run setup     # installs both workspaces
npm run proxy     # Express proxy on http://localhost:8787 (+ WS relay on /api/realtime)
npm run app       # Expo dev server — scan the QR with Expo Go
```

On a phone, the app defaults to `http://localhost:8787` — open **Profile →
Server** and set it to your machine's LAN address (e.g.
`http://192.168.x.x:8787`), or run through a tunnel. The value persists.

## Provider status (Section 0 findings)

Confirmed against official language-support documentation (September 2026):

| Capability | Provider | Status |
|---|---|---|
| STT `rw-RW` | Google Cloud Speech-to-Text V2 (short + long) | **Supported — chosen primary** |
| STT `rw-RW` | Azure Speech | Not supported — dropped |
| STT `rw-RW` | Whisper large-v3 / Meta MMS | Present but self-hosting required — fallback only |
| MT `rw ⇄ zh` | Google Cloud Translation **NMT** | **Supported — chosen primary** |
| MT `rw` | Azure Translator | Supported — fallback option |
| MT `rw` | DeepL | Not supported — dropped (as predicted in the brief) |
| TTS `zh-CN` | Google Cloud Text-to-Speech | Supported (voice output) |

Two hard-won details baked into the code:

1. Google's newer **Translation LLM** endpoint does *not* list Kinyarwanda —
   the proxy deliberately uses the classic NMT endpoint
   (`/language/translate/v2`). Don't "upgrade" without re-checking.
2. No two-hop Kinyarwanda→English→Mandarin pipeline is needed — direct
   `rw ⇄ zh-CN` is supported. Its *quality* on real vendor speech still needs
   a live accuracy pass (see below).

## Multilingual real-time status (Section 9 definition of done)

The multilingual brief's build order was followed. What is **done and
verified in this environment** (mock mode — no Google Cloud credentials
exist yet, same honest caveat as V1):

- [x] Language catalog extended to the four verified languages, V1 pair
      first and untouched (`backend/src/languages.ts`, unit-tested)
- [x] One-credential setup: `GOOGLE_APPLICATION_CREDENTIALS` (key file),
      `GOOGLE_APPLICATION_CREDENTIALS_JSON` (inline), and `GCP_PROJECT_ID`
      aliases all accepted — no second provider, no per-language keys
- [x] Explicit STT region routing table (Section 3): `rw` → `eu` region,
      `short` model; `en`/`de`/`zh` → `global`, `chirp_3` model. Note the
      STT code for Mandarin is `cmn-Hans-CN`, not `zh-CN` — verified against
      Google's supported-languages page (Sept 2026)
- [x] gRPC `StreamingRecognize` wrapper with interim results
      (`backend/src/google/streaming.ts`) — lazy-loaded, additive, REST
      batch path untouched
- [x] WebSocket relay at `/api/realtime` (Section 4): client PCM up,
      partials/finals + translations down, finals translated through the
      same `runTranslate` as REST (identical mock behavior + error copy)
- [x] Mock-mode relay path so the full client flow is exercisable without
      keys; smoke script proves the round-trip end to end
- [x] Language picker (Section 5): source/target picker limited to the four
      verified pairs, same pill visual language, Kinyarwanda⇄Mandarin the
      default and unchanged
- [x] Picker wired to the relay: an opt-in LIVE toggle on the Translate
      screen routes the mic through the WS relay — partials render live,
      finals land as normal transcript turns with corrections firing exactly
      as in V1 whenever Kinyarwanda is the source. Default mode is unchanged
      (record-once → translate), and `/api/languages` now lists all four
      verified codes with the V1 shape intact
- [x] `react-native-live-audio-stream` installed with the Section 4a config
      (16 kHz / mono / 16-bit / VOICE_RECOGNITION / 4096 buffer) and an
      automatic `expo-av` chunked fallback so the app still runs in Expo Go
      before `expo prebuild`
- [x] Pair-aware sync (Section 6): uploads derive `language_pair` from each
      record's actual languages (V1 records still produce `rw-zh`); pulls
      resolve any pair back into per-record languages — no learning-portal
      logic changed, per the brief's reuse rule
- [x] Backend `tsc --noEmit` clean; backend 8/8 + mobile 24/24 tests pass;
      mock-mode smoke: REST regression surface + new pairs + WS round-trip
      all green (`backend/scripts/smoke-realtime.ts`)

**Cannot be checked here — explicit per the brief's rule:**

- [ ] **Live STT/MT streaming for all four languages.** Needs a real
      service-account key with Speech Client + Translation API User roles
      and both APIs enabled. Then run:
      `npm run stt:stream --workspace backend -- --audio sample.wav --lang rw`
      (this specifically proves the `eu`-routed Kinyarwanda path before
      trusting it) — repeat with `en` and `de`.
- [ ] **`expo prebuild` + physical-device pass.** The native audio module
      requires a dev build; until then the app runs in Expo Go via the
      `expo-av` fallback (chunked, higher latency — real-time feel is not
      yet representative).
- [ ] **Billing alerts** in Google Cloud console (Billing → Budgets &
      alerts) — a console action, not code.
- [ ] **Full signed-in regression on a physical device** across all four
      pairs.

## Honest V1 status (definition of done)

Done and verified in this environment:

- [x] Backend proxy with `/api/transcribe`, `/api/translate`, `/api/tts`,
      health/languages routes, typed validation, and human-readable error
      copy for every failure mode — all curl-tested (mock mode), including
      400/404/413/422 paths
- [x] Correction matcher: 32-entry curated list, Levenshtein matching, plus
      a guard that never fires on correctly-spelled words — 4/4 unit tests
      pass
- [x] Expo app (SDK 54): bottom tabs, exact DARK/LIGHT token file, two-
      triangle logomark, imigongo triangle divider, ticket-style corrections
      with Keep, pulsing waveform listening indicator, alternating
      You/Them transcript, text input mode, direction toggle
      (Kinyarwanda→Mandarin / Mandarin→Kinyarwanda), Learn tab with local
      persistence + honest limitation note, Profile with theme toggle
      (dark default), static language-pair display, editable proxy URL, and
      a plain-language privacy note
- [x] Full Metro bundle builds (`expo export`) and `tsc --noEmit` is clean
      for both workspaces

Explicitly NOT done — do not mistake this for a finished V1:

- [ ] **Live STT/MT accuracy numbers.** The work was done in mock mode
      because no Google Cloud credentials exist yet. Official language
      support is confirmed; WER/latency on real vendor speech is not
      measured. Add `GOOGLE_APPLICATION_CREDENTIALS_JSON` +
      `GOOGLE_CLOUD_PROJECT` to `backend/.env`, set `VUGA_PROVIDER=google`,
      and run the sample-audio pass before shipping.
- [ ] **Real-device testing.** Mic permission flows, interruption modes,
      and audio quality must be validated on physical Android and iOS
      devices; none were available in this environment.
- [ ] **Deployed (non-localhost) proxy.** The definition of done requires
      the app to reach a deployed proxy; only local operation was testable
      here.
- [ ] **Correction detection is a curated list, not a model.** It only
      catches mistakes already in `corrections.json`. The Learn tab says
      this plainly to users; expanding the list (or training a real model
      on kept-correction data) is the honest V2 path.

## Secrets

Provider keys live only in `backend/.env` (git-ignored). The mobile app never
talks to STT/MT providers directly — it only ever talks to this proxy. See
`backend/.env.example` for every variable.
