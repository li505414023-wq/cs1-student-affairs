import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { auditLogs, systemLogs } from "@/db/schema";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(error: unknown, request?: Request) {
  if (error instanceof ApiError) {
    // 5xx ApiErrors are system-level problems worth logging (4xx are client errors — skip).
    if (error.status >= 500) writeSystemLog({ message: error.message, request });
    return NextResponse.json({ success: false, error: error.message, details: error.details }, { status: error.status });
  }
  writeSystemLog({
    message: error instanceof Error ? error.message : String(error),
    request,
    detail: { stack: error instanceof Error ? error.stack?.slice(0, 2000) : undefined },
  });
  console.error("API request failed", error);
  return NextResponse.json({ success: false, error: "服务器处理请求失败" }, { status: 500 });
}

/**
 * Write a system error log. Never throws — logging failures must not
 * escalate into API failures (e.g. when the database itself is down).
 */
export function writeSystemLog(input: { message: string; request?: Request; detail?: Record<string, unknown> }): void {
  try {
    const url = input.request ? new URL(input.request.url) : null;
    void getDb()
      .insert(systemLogs)
      .values({
        id: randomUUID(),
        level: "error",
        category: "api",
        message: String(input.message).slice(0, 500),
        path: url ? url.pathname : null,
        method: input.request?.method ?? null,
        ip: input.request ? requestIp(input.request) : null,
        detailJson: input.detail ?? {},
      })
      .catch((logError) => console.error("system log write failed", logError));
  } catch (logError) {
    console.error("system log write failed", logError);
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid object");
    return body as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "请求数据不是有效的 JSON");
  }
}

/** Detect Postgres unique-violation errors (drizzle may wrap the pg error). */
export function isUniqueViolation(error: unknown): boolean {
  const err = error as { code?: string; cause?: { code?: string }; message?: string };
  return err?.code === "23505"
    || err?.cause?.code === "23505"
    || String(err?.message ?? "").includes("23505");
}

/**
 * Resolve the client IP. Prefer X-Real-IP (Nginx sets it to $remote_addr, which
 * a client cannot forge) and fall back to the LAST hop of X-Forwarded-For (the
 * nearest proxy). The first X-Forwarded-For element is client-controlled and
 * must NOT be trusted, otherwise per-IP rate limits are trivially bypassed.
 */
export function requestIp(request: Request) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const xff = request.headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  return xff || "local";
}

export async function writeAudit(input: { userId?: string; action: string; resourceType: string; resourceId?: string; detail?: unknown; ip?: string }) {
  await getDb().insert(auditLogs).values({
    id: randomUUID(),
    userId: input.userId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    detailJson: (input.detail ?? {}) as Record<string, unknown>,
    ip: input.ip ?? "local",
  });
}
