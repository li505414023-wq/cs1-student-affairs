/**
 * Typed frontend API client. Unwraps the backend response envelope
 * ({ success, data, error }, see lib/api-types.ts): successful calls resolve
 * with `data`; failures reject with ApiClientError carrying the server
 * message (may be empty when the server provided none), the HTTP status and
 * optional error details.
 *
 * CSRF: mutating requests carry the x-csrf-token header. The token comes
 * from the auth session (same mechanism as before — the session endpoint
 * issues it); AuthContext registers it via setCsrfToken.
 */

import type { ApiEnvelope } from "@/lib/api-types";

export class ApiClientError extends Error {
  /** HTTP status of the failed response; 0 for network errors. */
  status: number;
  /** Server-provided `details` from the error envelope, when present. */
  details?: unknown;

  constructor(message: string, status = 0, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
  }
}

let csrfToken = "";

/** Register the current session CSRF token ("" clears it, e.g. on logout). */
export function setCsrfToken(token: string) {
  csrfToken = token;
}

export function getCsrfToken(): string {
  return csrfToken;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (MUTATING_METHODS.has(method) && csrfToken) headers["x-csrf-token"] = csrfToken;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiClientError("", 0);
  }

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    envelope = null;
  }

  // Failure: non-2xx, unreadable body, or an explicit success:false envelope.
  // (Envelopes without an explicit `success` field are tolerated so long as
  // the HTTP status is ok — the backend always sets it, but stubs/mocks may not.)
  if (!response.ok || !envelope || envelope.success === false) {
    const raw = envelope as { error?: unknown; details?: unknown } | null;
    const message = typeof raw?.error === "string" ? raw.error : "";
    throw new ApiClientError(message, response.status, raw?.details);
  }
  return (envelope as { data: T }).data;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body),
  del: <T>(url: string, body?: unknown) => request<T>("DELETE", url, body),
};

/** True when the failure was a network error (no HTTP response received). */
export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 0;
}

/** Server-provided error message, or `fallback` when none was provided. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiClientError && error.message ? error.message : fallback;
}
