export class ApiError extends Error {
  /** Stable machine code from the proxy (e.g. NO_SPEECH, UNSUPPORTED_LANGUAGE). */
  readonly code: string;
  /** Human-readable copy, safe to show directly in the UI. */
  readonly userMessage: string;
  /** HTTP status; 0 means the request never reached the server. */
  readonly status: number;

  constructor(code: string, userMessage: string, status: number) {
    super(userMessage);
    this.name = "ApiError";
    this.code = code;
    this.userMessage = userMessage;
    this.status = status;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/**
 * Classify any thrown auth/network failure into a stable code + user-facing
 * message. Distinguishes the families the auth screens must present
 * differently:
 *   - AUTH_NOT_CONFIGURED — server lacks DATABASE_URL/JWT_SECRET (setup issue)
 *   - NETWORK         — request never reached a server (offline / dead host)
 *   - TIMEOUT         — reached but too slow
 *   - SERVER          — 5xx, server-side fault
 *   - 4xx ApiErrors   — validation/auth rejection, server copy shown as-is
 *   - UNKNOWN         — anything else
 */
export function classifyAuthError(e: unknown): ApiError {
  if (isApiError(e)) return e;
  if (e instanceof Error && e.name === "AbortError") {
    return new ApiError(
      "TIMEOUT",
      "The request took too long. Check your connection and try again.",
      0,
    );
  }
  // Network failure: provide actionable guidance for common issues
  return new ApiError(
    "NETWORK",
    "Can't reach the account service. Check your internet connection (and that the VUGA proxy is running). If the problem persists, it may be a temporary server issue.",
    0,
  );
}
