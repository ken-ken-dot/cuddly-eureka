import "dotenv/config";
import fs from "node:fs";

export type ProviderName = "mock" | "google";

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const config = {
  port: num(process.env.PORT, 8787),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  provider: (process.env.VUGA_PROVIDER === "google" ? "google" : "mock") as ProviderName,
  mockLatencyMs: num(process.env.MOCK_LATENCY_MS, 150),

  google: {
    project: process.env.GOOGLE_CLOUD_PROJECT ?? "",
    location: process.env.GOOGLE_CLOUD_LOCATION || "global",
    /** Service-account JSON, either inline or via a mounted file (Cloud Run secret). */
    credentialsJson:
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
      (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_FILE
        ? fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_FILE, "utf8")
        : ""),
  },
};

export function googleConfigured(): boolean {
  return Boolean(config.google.project && config.google.credentialsJson);
}
