import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import type { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { hasPermission } from "./security";
import { ApiError, requestIp } from "./api";
import { enforceRateLimit } from "./rate-limit";

export const SESSION_COOKIE = "xg_session";
const SESSION_HOURS = 8;
const SESSION_LIFETIME_MS = SESSION_HOURS * 60 * 60 * 1000;
// Absolute session lifetime: even with sliding renewal, a session can never
// live longer than this since its creation (mitigates never-expiring sessions).
export const SESSION_MAX_DAYS = 7;
const SESSION_MAX_MS = SESSION_MAX_DAYS * 24 * 60 * 60 * 1000;

export type CurrentSession = {
  id: string;
  csrfToken: string;
  expiresAt: Date;
  user: { id: string; username: string; displayName: string; role: string; roleTags: string[] };
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(24).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);
  await getDb().insert(sessions).values({ id: randomUUID(), tokenHash: tokenHash(token), userId, csrfToken, expiresAt, lastSeenAt: now, createdAt: now });
  return { token, csrfToken, expiresAt };
}

// Opportunistic cleanup of expired sessions, throttled in-process so it runs
// at most once per interval. Fire-and-forget: failures never affect the caller.
const CLEANUP_INTERVAL_MS = 10 * 60_000;
let lastCleanupAt = 0;
export function scheduleExpiredSessionCleanup() {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  try {
    Promise.resolve(getDb().delete(sessions).where(lt(sessions.expiresAt, new Date()))).catch(() => {});
  } catch {
    // Cleanup must never break the main auth flow.
  }
}

function isSecureRequest(request?: NextRequest) {
  // Production always requires secure cookies: x-forwarded-proto can be forged
  // when Node is reached directly (bypassing the trusted proxy).
  if (process.env.NODE_ENV === "production") return true;
  if (!request) return false;
  return request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https";
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date, request?: NextRequest) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: isSecureRequest(request),
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse, request?: NextRequest) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: isSecureRequest(request),
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentSession(request: NextRequest): Promise<CurrentSession | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await getDb().select({
    id: sessions.id, csrfToken: sessions.csrfToken, expiresAt: sessions.expiresAt, createdAt: sessions.createdAt,
    userId: users.id, username: users.username, displayName: users.displayName, role: users.role, roleTags: users.roleTags, active: users.active,
  }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(eq(sessions.tokenHash, tokenHash(token))).limit(1);
  if (!row || !row.active || row.expiresAt.getTime() <= Date.now()) return null;
  // Absolute lifetime check: no session outlives SESSION_MAX_DAYS since creation.
  const absoluteDeadline = new Date(row.createdAt.getTime() + SESSION_MAX_MS);
  const now = new Date();
  if (now.getTime() >= absoluteDeadline.getTime()) return null;
  // Sliding expiry: once less than half the session lifetime remains, extend it,
  // but never beyond the absolute deadline.
  let expiresAt = row.expiresAt;
  if (expiresAt.getTime() - now.getTime() < SESSION_LIFETIME_MS / 2) {
    const extended = new Date(now.getTime() + SESSION_LIFETIME_MS);
    expiresAt = extended.getTime() <= absoluteDeadline.getTime() ? extended : absoluteDeadline;
  }
  await getDb().update(sessions).set({ lastSeenAt: now, expiresAt }).where(eq(sessions.id, row.id));
  return { id: row.id, csrfToken: row.csrfToken, expiresAt, user: { id: row.userId, username: row.username, displayName: row.displayName, role: row.role, roleTags: row.roleTags ?? [] } };
}

export async function requirePermission(request: NextRequest, permission: "read" | "write" | "delete" | "admin") {
  const session = await getCurrentSession(request);
  if (!session) throw new ApiError(401, "请先登录");
  if (!(await hasPermission(session.user.role, permission))) throw new ApiError(403, "当前账号没有此操作权限");
  return session;
}

// Constant-time comparison to avoid timing side-channels on CSRF tokens.
function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function validateCsrf(request: NextRequest, session: CurrentSession) {
  const supplied = request.headers.get("x-csrf-token");
  if (!supplied || !safeEqual(supplied, session.csrfToken)) throw new ApiError(403, "安全校验失败，请刷新页面后重试");
  // Every state-changing route funnels through validateCsrf, so throttling here
  // gives uniform write protection per user + IP without touching each handler.
  enforceRateLimit(`write:${session.user.id}:${requestIp(request)}`, 120, 60_000);
}

export async function revokeSession(sessionId: string) {
  await getDb().delete(sessions).where(eq(sessions.id, sessionId));
}
