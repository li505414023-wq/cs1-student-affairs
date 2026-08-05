/**
 * Shared HTTP utilities for API routes: pagination parsing and query-param
 * helpers. Keeps the clamp semantics that previously lived duplicated in
 * every list endpoint.
 */

export interface ParsePaginationOptions {
  /** pageSize used when the param is missing/invalid (default 20). */
  defaultPageSize?: number;
  /** Upper bound for pageSize (default 100). */
  maxPageSize?: number;
}

export interface ParsedPagination {
  page: number;
  pageSize: number;
}

/**
 * Parse `page` / `pageSize` from a request URL with the project's clamp
 * semantics: page >= 1; pageSize clamped to [1, maxPageSize]; missing or
 * non-numeric values fall back to the defaults.
 */
export function parsePagination(url: URL, options: ParsePaginationOptions = {}): ParsedPagination {
  const { defaultPageSize = 20, maxPageSize = 100 } = options;
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, Number(url.searchParams.get("pageSize")) || defaultPageSize));
  return { page, pageSize };
}

/**
 * Read a query param, trimmed; returns `fallback` (default "") when missing
 * or blank. Matches the `get(name)?.trim() ?? ""` style used across routes.
 */
export function queryText(url: URL, name: string, fallback = ""): string {
  const value = url.searchParams.get(name)?.trim();
  return value ? value : fallback;
}

/** Read a raw (untrimmed) query param, or null when missing. */
export function queryParam(url: URL, name: string): string | null {
  return url.searchParams.get(name);
}
