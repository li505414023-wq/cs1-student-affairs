import { asc, count, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { roles, users } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { ALL_PERMISSIONS, invalidateRoleCache } from "@/lib/security";
import { ApiError, fail, isUniqueViolation, ok, readJson, requestIp, writeAudit } from "@/lib/api";

export const runtime = "nodejs";

function parsePermissions(value: unknown): string[] {
  const list = Array.isArray(value) ? value.filter((p): p is string => typeof p === "string") : [];
  const invalid = list.filter((p) => !(ALL_PERMISSIONS as readonly string[]).includes(p));
  if (invalid.length > 0) throw new ApiError(422, `无效的权限项: ${invalid.join(", ")}`);
  return [...new Set(list)];
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "admin");
    const db = getDb();
    const rows = await db.select().from(roles).orderBy(asc(roles.sortOrder), asc(roles.code));
    const counts = await db.select({ role: users.role, value: count() }).from(users).where(eq(users.active, true)).groupBy(users.role);
    const userCountByRole = new Map(counts.map((row) => [row.role, Number(row.value)]));
    return ok({
      items: rows.map((row) => ({
        id: row.id, code: row.code, name: row.name, description: row.description,
        permissions: row.permissions, tags: row.tags, dataScope: row.dataScope,
        builtin: row.builtin, status: row.status, sortOrder: row.sortOrder,
        userCount: userCountByRole.get(row.code) ?? 0,
      })),
    });
  } catch (error) {
    return fail(error, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "admin");
    validateCsrf(request, session);
    const body = await readJson(request);
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!/^[a-z0-9_]{2,40}$/.test(code)) throw new ApiError(422, "角色编码只能包含小写字母、数字和下划线(2-40 位)");
    if (!name || name.length > 30) throw new ApiError(422, "角色名称需在 1-30 个字符内");
    const permissions = parsePermissions(body?.permissions);
    if (permissions.length === 0) throw new ApiError(422, "至少选择一项权限");
    const tags = Array.isArray(body?.tags) ? body.tags.filter((t: unknown) => typeof t === "string") : [];
    const dataScope = typeof body?.dataScope === "string" && ["all", "faculty", "self"].includes(body.dataScope) ? body.dataScope : "self";
    const description = typeof body?.description === "string" ? body.description.slice(0, 200) : "";

    const id = randomUUID();
    try {
      await getDb().insert(roles).values({ id, code, name, description, permissions, tags, dataScope, builtin: false, status: "启用" });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError(409, `角色编码 ${code} 已存在`);
      throw error;
    }
    invalidateRoleCache();
    await writeAudit({ userId: session.user.id, action: "create_role", resourceType: "role", resourceId: id, detail: { code, name, permissions }, ip: requestIp(request) });
    return ok({ id, code, name }, 201);
  } catch (error) {
    return fail(error, request);
  }
}
