import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { ApiError, fail, ok, requestIp, writeAudit } from "@/lib/api";

export const runtime = "nodejs";

/** Admin force-logout: revoke every session of the target user. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(request, "admin");
    validateCsrf(request, session);
    const { id } = await context.params;
    const [user] = await getDb().select({ id: users.id, username: users.username }).from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new ApiError(404, "用户不存在");
    await getDb().delete(sessions).where(eq(sessions.userId, id));
    await writeAudit({
      userId: session.user.id,
      action: "revoke_sessions",
      resourceType: "user",
      resourceId: id,
      detail: { username: user.username },
      ip: requestIp(request),
    });
    return ok({ revoked: true });
  } catch (error) {
    return fail(error, request);
  }
}
