import { createHash, randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { hasPermission } from "./security";
import { ApiError, requestIp } from "./api";
import { enforceRateLimit } from "./rate-limit";

export const SESSION_COOKIE = "xg_session";
const SESSION_HOURS = 8;

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
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000);
  await getDb().insert(sessions).values({ id: randomUUID(), tokenHash: tokenHash(token), userId, csrfToken, expiresAt, lastSeenAt: now });
  return { token, csrfToken, expiresAt };
}

function isSecureRequest(request?: NextRequest) {
  if (!request) return process.env.NODE_ENV === "production";
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
    id: sessions.id, csrfToken: sessions.csrfToken, expiresAt: sessions.expiresAt,
    userId: users.id, username: users.username, displayName: users.displayName, role: users.role, roleTags: users.roleTags, active: users.active,
  }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(eq(sessions.tokenHash, tokenHash(token))).limit(1);
  if (!row || !row.active || row.expiresAt.getTime() <= Date.now()) return null;
  // Sliding expiry: once less than half the session lifetime remains, extend it.
  const now = new Date();
  let expiresAt = row.expiresAt;
  if (expiresAt.getTime() - now.getTime() < (SESSION_HOURS * 60 * 60 * 1000) / 2) {
    expiresAt = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000);
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

export function validateCsrf(request: NextRequest, session: CurrentSession) {
  const supplied = request.headers.get("x-csrf-token");
  if (!supplied || supplied !== session.csrfToken) throw new ApiError(403, "安全校验失败，请刷新页面后重试");
  // Every state-changing route funnels through validateCsrf, so throttling here
  // gives uniform write protection per user + IP without touching each handler.
  enforceRateLimit(`write:${session.user.id}:${requestIp(request)}`, 120, 60_000);
}

export async function revokeSession(sessionId: string) {
  await getDb().delete(sessions).where(eq(sessions.id, sessionId));
}
