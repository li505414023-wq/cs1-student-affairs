import { ApiError, fail } from "@/lib/api";
import { WorkflowError } from "./types";

/**
 * Shared error-to-response mapping for all workflow API routes.
 * Converts engine-level WorkflowError (with HTTP semantics) into ApiError so
 * 4xx client errors are surfaced with their status code instead of being
 * swallowed as generic 5xx failures (and polluting system logs).
 */
export function failWorkflow(error: unknown, request?: Request) {
  if (error instanceof WorkflowError) {
    return fail(new ApiError(error.status, error.message), request);
  }
  return fail(error, request);
}
