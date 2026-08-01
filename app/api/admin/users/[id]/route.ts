import { and, count, eq, ne } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { hashPassword } from "@/lib/security";
import { getRoleCodes } from "@/lib/role-catalog";
import { ApiError, fail, ok, readJson, requestIp, writeAudit } from "@/lib/api";

export const runtime = "nodejs";

const optionalText = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/** Refuse to remove the last active admin account. */
async function guardLastAdmin(db: ReturnType<typeof getDb>, userId: string) {
  const [target] = await db.select({ role: users.role, active: users.active }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new ApiError(404, "用户不存在");
  if (target.role === "admin" && target.active) {
    const [others] = await db.select({ value: count() }).from(users)
      .where(and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, userId)));
    if (Number(others?.value ?? 0) === 0) {
      throw new ApiError(409, "不能移除最后一个启用的管理员账号");
    }
  }
  return target;
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(request, "admin");
    validateCsrf(request, session);
    const { id } = await context.params;
    const body = await readJson(request);
    const db = getDb();

    const updates: Record<string, unknown> = {};
    if (typeof body?.displayName === "string") updates.displayName = body.displayName.trim();
    if (typeof body?.role === "string") {
      if (!(await getRoleCodes()).includes(body.role)) throw new ApiError(422, "无效的角色");
      updates.role = body.role;
    }
    if (Array.isArray(body?.roleTags)) updates.roleTags = body.roleTags.filter((t: unknown) => typeof t === "string");
    if (body?.phone !== undefined) updates.phone = optionalText(body.phone);
    if (body?.email !== undefined) updates.email = optionalText(body.email);
    if (body?.orgId !== undefined) updates.orgId = optionalText(body.orgId);
    if (body?.postId !== undefined) updates.postId = optionalText(body.postId);
    if (typeof body?.active === "boolean") updates.active = body.active;
    if (body?.unlock === true) {
      updates.failedAttempts = 0;
      updates.lockedUntil = null;
    }

    // Password reset revokes all of the target user's sessions.
    let passwordReset = false;
    if (typeof body?.password === "string") {
      if (body.password.length < 10) throw new ApiError(422, "密码至少10个字符");
      updates.passwordHash = await hashPassword(body.password);
      passwordReset = true;
    }

    if (Object.keys(updates).length === 0) throw new ApiError(422, "无有效更新字段");

    const losesAdmin = ("role" in updates && updates.role !== "admin") || updates.active === false;
    if (losesAdmin) await guardLastAdmin(db, id);

    await db.update(users).set(updates).where(eq(users.id, id));
    if (passwordReset) await db.delete(sessions).where(eq(sessions.userId, id));
    await writeAudit({
      userId: session.user.id,
      action: "update_user",
      resourceType: "user",
      resourceId: id,
      detail: { fields: Object.keys(updates).filter((k) => k !== "passwordHash"), passwordReset },
      ip: requestIp(request),
    });
    return ok({ updated: true, passwordReset });
  } catch (error) {
    return fail(error, request);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(request, "admin");
    validateCsrf(request, session);
    const { id } = await context.params;
    const db = getDb();
    await guardLastAdmin(db, id);
    await db.update(users).set({ active: false }).where(eq(users.id, id));
    await db.delete(sessions).where(eq(sessions.userId, id));
    await writeAudit({ userId: session.user.id, action: "disable_user", resourceType: "user", resourceId: id, ip: requestIp(request) });
    return ok({ disabled: true });
  } catch (error) {
    return fail(error, request);
  }
}
