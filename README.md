# VUGA

Kinyarwanda ⇄ Mandarin speech translation with correction coaching, built for
market vendors. Free for individual users: no ads, no paywalls, no accounts in
V1.

## Layout

```
backend/            Node.js + Express proxy — holds provider keys, forwards STT/MT/TTS
mobile/             Expo (managed, SDK 54) app — Translate / Learn / Profile tabs
corrections.json    Shared curated mistake list (single source of truth for backend + app)
```

## Quick start

```bash
npm run setup     # installs both workspaces
npm run proxy     # Express proxy on http://localhost:8787
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
