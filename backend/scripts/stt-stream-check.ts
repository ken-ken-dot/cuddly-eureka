import fs from "node:fs";
import { config, googleConfigured } from "../src/config.js";
import { STT_LANGUAGE_ROUTING, sttRoutingFor } from "../src/languages.js";

/**
 * Manual streaming-STT verification (multilingual brief Section 8, step 3) —
 * extends the db-check script pattern: exit 0 on success, 1 on failure.
 *
 *   npm run stt:stream --workspace backend            # config check only
 *   npm run stt:stream --workspace backend -- --audio ./sample.wav --lang rw
 *   npm run stt:stream --workspace backend -- --audio ./sample.wav --lang en
 *   npm run stt:stream --workspace backend -- --audio ./sample.wav --lang de
 *
 * --lang rw deliberately proves the `eu`-routed path before any client code
 * trusts it. Requires VUGA_PROVIDER=google plus the single service-account
 * key (any accepted form). Mock mode can only validate the routing table.
 */

function fail(msg: string): never {
  console.error(`[vuga-stt-stream] FAILED: ${msg}`);
  process.exit(1);
}

const routingEntries = [...STT_LANGUAGE_ROUTING.entries()];
console.log("[vuga-stt-stream] routing table:");
for (const [code, r] of routingEntries) {
  console.log(`  ${code.padEnd(6)} -> region=${r.region.padEnd(6)} stt=${r.sttCode.padEnd(12)} model=${r.model}`);
}

if (process.argv.includes("--audio")) {
  const idx = process.argv.indexOf("--audio");
  const path = process.argv[idx + 1];
  const langIdx = process.argv.indexOf("--lang");
  const lang = langIdx !== -1 ? (process.argv[langIdx + 1] ?? "rw") : "rw";
  if (!path) fail("--audio requires a file path");
  if (!googleConfigured()) {
    fail("Google is not configured — set VUGA_PROVIDER=google, GOOGLE_CLOUD_PROJECT, and the service-account key in backend/.env");
  }
  const routing = sttRoutingFor(lang);
  if (!routing) fail(`no verified streaming route for language '${lang}'`);
  if (!fs.existsSync(path)) fail(`audio file not found: ${path}`);

  const { openStreamingSession } = await import("../src/google/streaming.js");
  const base64 = fs.readFileSync(path).toString("base64");

  console.log(`[vuga-stt-stream] streaming ${lang} via region=${routing.region} (${routing.sttCode}, model=${routing.model})…`);
  let finals = 0;
  const session = await openStreamingSession({
    languageCode: lang,
    events: {
      onPartial: (t) => console.log(`  partial: ${t}`),
      onFinal: (t) => {
        finals += 1;
        console.log(`  FINAL:   ${t}`);
      },
      onError: (e) => fail(e.message),
    },
  });
  if (!session) fail("streaming session could not be opened");

  // 320-sample frames (~20 ms) — same chunking the relay sees from the app.
  const bytes = Buffer.from(base64, "base64");
  const frame = 640;
  for (let i = 0; i < bytes.length; i += frame) {
    session.write(bytes.subarray(i, i + frame).toString("base64"));
  }
  session.finish();
  await new Promise((r) => setTimeout(r, 4000));
  console.log(finals > 0 ? "[vuga-stt-stream] OK — streaming transcription received" : "[vuga-stt-stream] no final result arrived (audio silent or too short?)");
  process.exit(finals > 0 ? 0 : 1);
} else {
  if (config.provider !== "google") {
    console.log("[vuga-stt-stream] mock mode — routing table above is validated, live STT is not. Set VUGA_PROVIDER=google for the audio pass.");
  } else if (!googleConfigured()) {
    fail("VUGA_PROVIDER=google but project/credentials are missing");
  } else {
    console.log("[vuga-stt-stream] google provider configured — pass --audio <file.wav> --lang <rw|en|de|zh> to stream a sample.");
  }
}
