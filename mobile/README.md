# VUGA mobile (Expo, SDK 54)

React Native app: Translate / Learn / Profile bottom tabs.

```bash
npm run start      # from repo root, or: npx expo start here
```

## Structure

```
src/theme/        Token file (DARK/LIGHT exactly per brand spec) + ThemeProvider
src/components/   Logo (two-triangle mark), TriangleDivider, Ticket (correction stub),
                  Pill, ErrorBar, Waveform (listening indicator)
src/store/        Zustand stores: settings (theme, proxy URL), corrections (persisted),
                  session (turns, pipeline, errors),
                  account (opt-in auth state) + sync (background backup engine).
                  The app is fully usable signed out — auth is never a gate.
src/api/          Thin typed client for the VUGA proxy — never talks to providers directly
                  (account.ts adds opt-in auth/sync; tokens live in expo-secure-store)
src/corrections/  Loads shared /corrections.json + fuzzy matcher
src/speech/       expo-av mic capture hook (permission, record, base64 out)
src/screens/      TranslateScreen, LearnScreen, ProfileScreen
```

## Notes

- **Proxy URL**: defaults to `http://localhost:8787`. On a physical device,
  change it in Profile → Server to your machine's LAN address.
- **Mock mode**: if the backend runs without Google credentials, the app
  shows a "Demo mode" banner and placeholder text. This is not translation.
- **Corrections**: only fires for mistakes present in the shared
  `corrections.json` (32 entries). The Learn tab's empty state discloses
  this to users.
- Theme default is dark, per the brand spec; toggle lives in Profile.
