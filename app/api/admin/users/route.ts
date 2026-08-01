import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { hashPassword } from "@/lib/security";
import { getRoleCodes } from "@/lib/role-catalog";
import { ApiError, fail, isUniqueViolation, ok, readJson, requestIp, writeAudit } from "@/lib/api";

export const runtime = "nodejs";

const optionalText = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "admin");
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));
    const keyword = url.searchParams.get("keyword")?.trim() ?? "";
    const role = url.searchParams.get("role")?.trim() ?? "";
    const activeParam = url.searchParams.get("active")?.trim() ?? "";

    const keywordCondition = keyword
      ? or(ilike(users.username, `%${keyword}%`), ilike(users.displayName, `%${keyword}%`), ilike(users.phone, `%${keyword}%`))
      : undefined;
    const roleCondition = role ? eq(users.role, role) : undefined;
    const activeCondition = activeParam === "true" ? eq(users.active, true) : activeParam === "false" ? eq(users.active, false) : undefined;
    const where = and(keywordCondition, roleCondition, activeCondition);

    const db = getDb();
    const rows = await db.select({
      id: users.id, username: users.username, displayName: users.displayName,
      role: users.role, roleTags: users.roleTags, phone: users.phone, email: users.email,
      orgId: users.orgId, postId: users.postId, active: users.active,
      failedAttempts: users.failedAttempts, lockedUntil: users.lockedUntil,
      createdAt: users.createdAt,
    }).from(users).where(where).orderBy(desc(users.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
    const [totalRow] = await db.select({ value: count() }).from(users).where(where);
    return ok({ items: rows, pagination: { page, pageSize, total: Number(totalRow?.value ?? 0) } });
  } catch (error) {
    return fail(error, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "admin");
    validateCsrf(request, session);
    const body = await readJson(request);
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : username;
    const role = typeof body?.role === "string" ? body.role : "staff";
    const roleTags = Array.isArray(body?.roleTags) ? body.roleTags.filter((t: unknown) => typeof t === "string") : [];
    const phone = optionalText(body?.phone);
    const email = optionalText(body?.email);
    const orgId = optionalText(body?.orgId);
    const postId = optionalText(body?.postId);

    if (!username || username.length < 2) throw new ApiError(422, "用户名至少2个字符");
    if (!/^[A-Za-z0-9_.-]+$/.test(username)) throw new ApiError(422, "用户名只能包含字母、数字、下划线、点和横线");
    if (!password || password.length < 10) throw new ApiError(422, "密码至少10个字符");
    if (!(await getRoleCodes()).includes(role)) throw new ApiError(422, "无效的角色");

    const id = randomUUID();
    try {
      await getDb().insert(users).values({ id, username, displayName, passwordHash: await hashPassword(password), role, roleTags, phone, email, orgId, postId });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError(409, "用户名已存在");
      throw error;
    }
    await writeAudit({ userId: session.user.id, action: "create_user", resourceType: "user", resourceId: id, detail: { username, role }, ip: requestIp(request) });
    return ok({ id, username, displayName, role }, 201);
  } catch (error) {
    return fail(error, request);
  }
}
