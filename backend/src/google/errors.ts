/** Google API error with HTTP-ish status info. */
export interface GoogleApiErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
  message?: string;
  code?: number;
  status?: string;
}

export class GoogleApiError extends Error {
  readonly status?: number;
  readonly grpcStatus?: string;

  constructor(message: string, status?: number, grpcStatus?: string) {
    super(message);
    this.name = "GoogleApiError";
    this.status = status;
    this.grpcStatus = grpcStatus;
  }
}

export function parseGoogleApiError(bodyText: string, httpStatus: number): GoogleApiError {
  try {
    const body = JSON.parse(bodyText) as GoogleApiErrorBody;
    const err = body.error;
    const message = err?.message || body.message || bodyText.slice(0, 300);
    return new GoogleApiError(message, httpStatus, err?.status ?? body.status);
  } catch {
    return new GoogleApiError(bodyText.slice(0, 300) || `Google API error (HTTP ${httpStatus})`, httpStatus);
  }
}
