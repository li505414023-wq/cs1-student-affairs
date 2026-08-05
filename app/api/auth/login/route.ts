import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createSession, scheduleExpiredSessionCleanup, setSessionCookie } from "@/lib/auth";
import { ApiError, fail, ok, readJson, requestIp, writeAudit } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/security";

export const runtime = "nodejs";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
    const ip = requestIp(request);
    enforceRateLimit(`login:${ip}`, 8, 10 * 60_000);
    const body = await readJson(request);
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const suppliedPassword = typeof body?.password === "string" ? body.password : "";
    if (!username || !suppliedPassword) throw new ApiError(400, "请输入用户名和密码");

    const [user] = await getDb().select().from(users).where(eq(users.username, username)).limit(1);

    // Account-level lockout after repeated failures (complements the IP rate limit).
    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new ApiError(423, `账号已连续输错密码被锁定，请 ${minutes} 分钟后再试`);
    }

    // Always run scrypt to prevent username enumeration via timing side-channel.
    // A dummy hash with valid scrypt format is used when the user does not exist
    // or is inactive, ensuring consistent response time for all cases.
    const DUMMY_HASH = "scrypt$00000000000000000000000000000000$00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    const validPassword = user?.active ? await verifyPassword(suppliedPassword, user.passwordHash) : await verifyPassword(suppliedPassword, DUMMY_HASH);
    if (!user || !user.active || !validPassword) {
      if (user?.active) {
        const attempts = (user.failedAttempts ?? 0) + 1;
        await getDb().update(users).set(
          attempts >= MAX_FAILED_ATTEMPTS
            ? { failedAttempts: attempts, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
            : { failedAttempts: attempts },
        ).where(eq(users.id, user.id));
        await writeAudit({ userId: user.id, action: "login_failed", resourceType: "session", detail: { attempts, locked: attempts >= MAX_FAILED_ATTEMPTS }, ip });
      }
      throw new ApiError(401, "用户名或密码错误");
    }

    // Successful login clears the failure counter and any expired lock.
    if ((user.failedAttempts ?? 0) > 0 || user.lockedUntil) {
      await getDb().update(users).set({ failedAttempts: 0, lockedUntil: null }).where(eq(users.id, user.id));
    }
    const session = await createSession(user.id);
    // Opportunistic cleanup of expired sessions (throttled, fire-and-forget).
    scheduleExpiredSessionCleanup();
    await writeAudit({ userId: user.id, action: "login", resourceType: "session", ip });
    const response = ok({ user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role }, csrfToken: session.csrfToken });
    setSessionCookie(response, session.token, session.expiresAt, request);
    return response;
  } catch (error) {
    return fail(error, request);
  }
}
