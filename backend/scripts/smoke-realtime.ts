/**
 * Mock-mode end-to-end smoke (multilingual brief Section 8, step 8's
 * regression core). Boots nothing itself — run the proxy first, then:
 *
 *   node --import tsx scripts/smoke-realtime.ts
 *
 * Asserts, against a LIVE proxy in mock mode:
 *   1. REST regression: /api/health, /api/languages, /api/transcribe (rw),
 *      /api/translate (rw->zh) still behave exactly as V1.
 *   2. New pairs: /api/translate accepts rw->en, de->rw, en->de.
 *   3. New languages stay rejected where V1 rejected them is NOT expected —
 *      normalize now accepts en/de — but still rejects truly unknown codes.
 *   4. WebSocket relay round-trip: start -> started -> final frames arrive
 *      with text + translated in mock mode, then stop -> stopped.
 */

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:8787";

function fail(msg: string): never {
  console.error(`[vuga-smoke] FAILED: ${msg}`);
  process.exit(1);
}

async function rest(path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as any };
}

async function main() {
  // --- 1. REST regression surface ------------------------------------------
  const health = await rest("/api/health");
  if (health.status !== 200 || health.json.ok !== true) fail("health check broke");
  console.log("[vuga-smoke] /api/health OK (provider=" + health.json.provider + ")");

  const langs = await rest("/api/languages");
  if (langs.status !== 200) fail("languages broke");
  console.log("[vuga-smoke] /api/languages OK:", JSON.stringify(langs.json));

  const silence = Buffer.alloc(96).toString("base64"); // <64 bytes triggers NO_SPEECH
  const noSpeech = await rest("/api/transcribe", { audio: Buffer.alloc(96, 1).toString("base64"), languageCode: "rw" });
  if (noSpeech.status !== 200) fail("transcribe rw regression broke");
  console.log("[vuga-smoke] /api/transcribe rw OK:", JSON.stringify(noSpeech.json));

  const t1 = await rest("/api/translate", { text: "murakoze", sourceLang: "rw", targetLang: "zh-CN" });
  if (t1.status !== 200 || typeof t1.json.translated !== "string") fail("rw->zh translate regression broke");
  console.log("[vuga-smoke] /api/translate rw->zh OK:", JSON.stringify(t1.json));

  // --- 2. New pairs through the SAME route ----------------------------------
  for (const [s, tgt] of [["rw", "en"], ["en", "de"], ["de", "rw"]] as const) {
    const t = await rest("/api/translate", { text: "hello", sourceLang: s, targetLang: tgt });
    if (t.status !== 200 || typeof t.json.translated !== "string") fail(`translate ${s}->${tgt} failed`);
    console.log(`[vuga-smoke] /api/translate ${s}->${tgt} OK`);
  }

  const bad = await rest("/api/translate", { text: "hi", sourceLang: "fr", targetLang: "en" });
  if (bad.status !== 400) fail("unknown source language should still 400");
  console.log("[vuga-smoke] unknown language still rejected with 400");

  // --- 3. WebSocket relay round-trip ----------------------------------------
  const { WebSocket } = await import("ws");
  const wsUrl = BASE.replace(/^http/, "ws") + "/api/realtime";
  const ws = new WebSocket(wsUrl);

  const frames: any[] = [];
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("relay timed out")), 15000);
    ws.on("message", (raw: Buffer) => {
      const f = JSON.parse(String(raw));
      frames.push(f);
      if (f.type === "final" && frames.filter((x) => x.type === "final").length >= 2) {
        clearTimeout(timeout);
        resolve();
      }
    });
    ws.on("error", (e: Error) => {
      clearTimeout(timeout);
      reject(e);
    });
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "start", sourceLang: "rw", targetLang: "en" }));
      // Feed silent PCM so the mock ticker is the only final-source.
      setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "audio", data: Buffer.alloc(1600).toString("base64") }));
        }
      }, 100);
    });
  });

  const started = frames.find((f) => f.type === "started");
  const finals = frames.filter((f) => f.type === "final");
  if (!started) fail("relay never sent started");
  if (finals.length < 2) fail("relay never sent two final frames");
  for (const f of finals) {
    if (typeof f.text !== "string" || typeof f.translated !== "string") fail("final frame missing text/translated");
  }
  console.log(`[vuga-smoke] relay round-trip OK (${finals.length} finals; sample: "${finals[0].text}" -> "${finals[0].translated}")`);

  ws.send(JSON.stringify({ type: "stop" }));
  await new Promise((r) => setTimeout(r, 300));
  if (!frames.some((f) => f.type === "stopped")) fail("relay never confirmed stop");
  ws.close();

  console.log("[vuga-smoke] ALL OK");
  process.exit(0);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
