import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { hashPassword } from "@/lib/security";
import { getRoleCodes } from "@/lib/role-catalog";
import { ApiError, fail, isUniqueViolation, ok, readJson, requestIp, writeAudit } from "@/lib/api";
import { parsePagination, queryText } from "@/lib/http-utils";

export const runtime = "nodejs";

const optionalText = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const stringField = (fallback: string) => (value: unknown) => (typeof value === "string" ? value : fallback);

const createUserSchema = z.object({
  username: z.preprocess(stringField(""), z.string().trim().min(2, "用户名至少2个字符").regex(/^[A-Za-z0-9_.-]+$/, "用户名只能包含字母、数字、下划线、点和横线")),
  password: z.preprocess(stringField(""), z.string().min(10, "密码至少10个字符")),
  displayName: z.preprocess((value) => (typeof value === "string" ? value.trim() : null), z.string().nullable()),
  role: z.preprocess(stringField("staff"), z.string()),
  roleTags: z.preprocess(
    (value) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []),
    z.array(z.string()),
  ),
  phone: z.preprocess(optionalText, z.string().nullable()),
  email: z.preprocess(optionalText, z.string().nullable()),
  orgId: z.preprocess(optionalText, z.string().nullable()),
  postId: z.preprocess(optionalText, z.string().nullable()),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "admin");
    const url = new URL(request.url);
    const { page, pageSize } = parsePagination(url);
    const keyword = queryText(url, "keyword");
    const role = queryText(url, "role");
    const activeParam = queryText(url, "active");

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
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(422, parsed.error.issues[0]?.message ?? "格式不正确");
    const { username, password, role, roleTags, phone, email, orgId, postId } = parsed.data;
    const displayName = parsed.data.displayName ?? username;

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
