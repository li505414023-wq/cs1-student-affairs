import { and, count, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { roles, users } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { ALL_PERMISSIONS, invalidateRoleCache } from "@/lib/security";
import { ApiError, fail, ok, readJson, requestIp, writeAudit } from "@/lib/api";

export const runtime = "nodejs";

async function countActiveUsersWithRole(db: ReturnType<typeof getDb>, code: string): Promise<number> {
  const [row] = await db.select({ value: count() }).from(users).where(and(eq(users.role, code), eq(users.active, true)));
  return Number(row?.value ?? 0);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(request, "admin");
    validateCsrf(request, session);
    const { id } = await context.params;
    const body = await readJson(request);
    const db = getDb();

    const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!existing) throw new ApiError(404, "角色不存在");

    // Anti-lockout: the admin role's powers are fixed in code; its DB row
    // cannot be weakened or disabled through the API.
    if (existing.code === "admin" && (body?.permissions !== undefined || body?.status !== undefined)) {
      throw new ApiError(403, "系统管理员角色的权限与状态受保护,不可修改");
    }

    const updates: Record<string, unknown> = {};
    if (typeof body?.code === "string" && body.code.trim() !== existing.code) {
      if (existing.builtin) throw new ApiError(403, "内置角色的编码不可修改");
      if (!/^[a-z0-9_]{2,40}$/.test(body.code.trim())) throw new ApiError(422, "角色编码只能包含小写字母、数字和下划线(2-40 位)");
      updates.code = body.code.trim();
    }
    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name || name.length > 30) throw new ApiError(422, "角色名称需在 1-30 个字符内");
      updates.name = name;
    }
    if (body?.permissions !== undefined) {
      const permissions = Array.isArray(body.permissions)
        ? [...new Set(body.permissions.filter((p): p is string => typeof p === "string" && (ALL_PERMISSIONS as readonly string[]).includes(p)))]
        : null;
      if (!permissions || permissions.length === 0) throw new ApiError(422, "至少选择一项有效权限");
      updates.permissions = permissions;
    }
    if (Array.isArray(body?.tags)) updates.tags = body.tags.filter((t: unknown) => typeof t === "string");
    if (typeof body?.dataScope === "string" && ["all", "faculty", "self"].includes(body.dataScope)) updates.dataScope = body.dataScope;
    if (typeof body?.description === "string") updates.description = body.description.slice(0, 200);
    if (typeof body?.status === "string" && ["启用", "停用"].includes(body.status)) {
      if (body.status === "停用" && (await countActiveUsersWithRole(db, existing.code)) > 0) {
        throw new ApiError(409, "该角色下仍有启用的用户,不能停用,请先调整用户角色");
      }
      updates.status = body.status;
    }

    if (Object.keys(updates).length === 0) throw new ApiError(422, "无有效更新字段");
    await db.update(roles).set(updates).where(eq(roles.id, id));
    invalidateRoleCache();
    await writeAudit({ userId: session.user.id, action: "update_role", resourceType: "role", resourceId: id, detail: { code: existing.code, fields: Object.keys(updates) }, ip: requestIp(request) });
    return ok({ updated: true });
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
    const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!existing) throw new ApiError(404, "角色不存在");
    if (existing.builtin) throw new ApiError(403, "内置角色不可删除");
    if ((await countActiveUsersWithRole(db, existing.code)) > 0) {
      throw new ApiError(409, "该角色下仍有启用的用户,不能删除,请先调整用户角色");
    }
    await db.delete(roles).where(eq(roles.id, id));
    invalidateRoleCache();
    await writeAudit({ userId: session.user.id, action: "delete_role", resourceType: "role", resourceId: id, detail: { code: existing.code }, ip: requestIp(request) });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error, request);
  }
}
