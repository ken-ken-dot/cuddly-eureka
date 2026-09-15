import { config } from "../config.js";
import { GoogleApiError, parseGoogleApiError } from "./errors.js";

const STT_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const TTS_SCOPE = STT_SCOPE;

let cachedToken: { token: string; expiresAtMs: number } | null = null;

function serviceAccount(): { client_email: string; private_key: string } {
  let json: unknown;
  try {
    json = JSON.parse(config.google.credentialsJson);
  } catch {
    throw new GoogleApiError("GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON", 500);
  }
  const sa = json as { client_email?: string; private_key?: string };
  if (!sa.client_email || !sa.private_key) {
    throw new GoogleApiError(
      "Google credentials JSON is missing client_email or private_key (needs a service account key)",
      500,
    );
  }
  return { client_email: sa.client_email, private_key: sa.private_key };
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Minimal JWT-bearer OAuth for service accounts. Avoids pulling the entire
 * google-auth-library for one token flow — keeps the proxy thin on purpose.
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs - 60_000 > now) {
    return cachedToken.token;
  }

  const sa = serviceAccount();
  const iat = Math.floor(now / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: sa.client_email,
      scope: `${STT_SCOPE} ${TTS_SCOPE}`,
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp: iat + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;

  const crypto = await import("node:crypto");
  const signature = base64Url(
    crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key.replace(/\\n/g, "\n")),
  );
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw parseGoogleApiError(text, res.status);
  }
  const body = JSON.parse(text) as { access_token?: string; expires_in?: number };
  if (!body.access_token) {
    throw new GoogleApiError("Google OAuth response had no access_token", 500);
  }
  cachedToken = {
    token: body.access_token,
    expiresAtMs: now + (body.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

/** POST JSON to a Google API endpoint with the service-account bearer token. */
export async function googlePost<T>(url: string, payload: unknown): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    throw parseGoogleApiError(text, res.status);
  }
  return JSON.parse(text) as T;
}
