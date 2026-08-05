/**
 * Shared API response-envelope types used by both the backend route helpers
 * (lib/api.ts) and the frontend client (lib/api-client.ts).
 */

export interface ApiEnvelopeSuccess<T> {
  success: true;
  data: T;
}

export interface ApiEnvelopeError {
  success: false;
  error: string;
  details?: unknown;
}

export type ApiEnvelope<T> = ApiEnvelopeSuccess<T> | ApiEnvelopeError;

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

export interface PageResult<T> {
  items: T[];
  pagination: PaginationInfo;
}
