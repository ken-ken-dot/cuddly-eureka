import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { config } from "./config.js";
import { api } from "./routes.js";
import { attachRealtimeRelay } from "./realtime.js";

const app = express();

// The app sends base64 audio; keep the JSON body limit generous but bounded.
app.use(express.json({ limit: "12mb" }));
app.use(cors({ origin: config.corsOrigin }));

app.use("/api", api);

// Multilingual brief Section 4: WebSocket relay at /api/realtime, mounted on
// the same HTTP server the REST API already uses. Additive — every existing
// route is unchanged.

app.use((_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Unknown route." } });
});

// Malformed JSON bodies and other express-level errors land here.
app.use((err: Error & { type?: string; statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.type === "entity.too.large") {
    res.status(413).json({ error: { code: "AUDIO_TOO_LARGE", message: "Recording too long — keep clips under ~60 seconds." } });
    return;
  }
  if (err.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "BAD_JSON", message: "Request body was not valid JSON." } });
    return;
  }
  console.error("[vuga-proxy] unhandled error:", err.message);
  res.status(500).json({ error: { code: "INTERNAL", message: "Unexpected server error." } });
});

const server = createServer(app);
attachRealtimeRelay(server);

server.listen(config.port, () => {
  console.log(`[vuga-proxy] listening on http://localhost:${config.port}`);
  console.log(`[vuga-proxy] provider=${config.provider} (set VUGA_PROVIDER=google + credentials for real STT/MT)`);
  console.log("[vuga-proxy] realtime relay: ws://localhost:" + config.port + "/api/realtime");
});
