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
