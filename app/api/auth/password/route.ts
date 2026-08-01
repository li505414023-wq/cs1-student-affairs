import { and, eq, ne } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/security";
import { ApiError, fail, ok, readJson, requestIp, writeAudit } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Self-service password change for the logged-in user.
 * Every role (including student, read-only elsewhere) may change their own password.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "read");
    validateCsrf(request, session);
    const body = await readJson(request);
    const oldPassword = typeof body?.oldPassword === "string" ? body.oldPassword : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
    if (!oldPassword || !newPassword) throw new ApiError(422, "请提供当前密码和新密码");
    if (newPassword.length < 10) throw new ApiError(422, "新密码至少10个字符");

    const [user] = await getDb()
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (!user) throw new ApiError(404, "用户不存在");

    const matches = await verifyPassword(oldPassword, user.passwordHash);
    if (!matches) throw new ApiError(422, "当前密码不正确");

    const passwordHash = await hashPassword(newPassword);
    await getDb().update(users).set({ passwordHash }).where(eq(users.id, user.id));

    // Revoke the user's other sessions; keep the current one alive.
    await getDb()
      .delete(sessions)
      .where(and(eq(sessions.userId, user.id), ne(sessions.id, session.id)));

    await writeAudit({ userId: session.user.id, action: "change_password", resourceType: "user", resourceId: user.id, ip: requestIp(request) });
    return ok({ changed: true });
  } catch (error) {
    return fail(error, request);
  }
}
