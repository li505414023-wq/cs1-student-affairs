import { and, eq, ilike, inArray, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { counselorClasses, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export const runtime = "nodejs";

const STAFF_ROLES = ["admin", "department_admin", "counselor", "dorm_manager", "staff", "viewer"];

/**
 * Staff roster (type=team) and head-teacher assignment query (type=headteacher),
 * both read-only aggregations over users + counselor_classes.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "admin");
    const url = new URL(request.url);
    const type = url.searchParams.get("type") === "headteacher" ? "headteacher" : "team";
    const keyword = url.searchParams.get("keyword")?.trim() ?? "";
    const className = url.searchParams.get("className")?.trim() ?? "";
    const db = getDb();

    if (type === "headteacher") {
      const conditions = [];
      if (keyword) {
        conditions.push(or(
          ilike(users.displayName, `%${keyword}%`),
          ilike(users.username, `%${keyword}%`),
          ilike(counselorClasses.className, `%${keyword}%`),
        ));
      }
      if (className) conditions.push(ilike(counselorClasses.className, `%${className}%`));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await db.select({
        id: counselorClasses.id,
        faculty: counselorClasses.faculty,
        className: counselorClasses.className,
        grade: counselorClasses.grade,
        teacherName: users.displayName,
        teacherUsername: users.username,
        teacherPhone: users.phone,
        active: users.active,
        createdAt: counselorClasses.createdAt,
      })
        .from(counselorClasses)
        .innerJoin(users, eq(users.id, counselorClasses.userId))
        .where(where)
        .orderBy(counselorClasses.className);
      return ok({ items: rows });
    }

    // Team roster: all non-student accounts with their class bindings.
    const staffRows = await db.select({
      id: users.id, username: users.username, displayName: users.displayName,
      role: users.role, roleTags: users.roleTags, phone: users.phone, active: users.active,
    }).from(users).where(inArray(users.role, STAFF_ROLES)).orderBy(users.role, users.username);

    const bindings = await db.select({
      userId: counselorClasses.userId,
      faculty: counselorClasses.faculty,
      className: counselorClasses.className,
    }).from(counselorClasses);
    const classesByUser = new Map<string, Array<{ faculty: string; className: string }>>();
    for (const binding of bindings) {
      const list = classesByUser.get(binding.userId) ?? [];
      list.push({ faculty: binding.faculty, className: binding.className });
      classesByUser.set(binding.userId, list);
    }

    const keywordLower = keyword.toLowerCase();
    const items = staffRows
      .filter((row) => !keywordLower
        || row.displayName.toLowerCase().includes(keywordLower)
        || row.username.toLowerCase().includes(keywordLower)
        || (row.phone ?? "").includes(keywordLower))
      .map((row) => ({ ...row, classes: classesByUser.get(row.id) ?? [] }));
    return ok({ items });
  } catch (error) {
    return fail(error, request);
  }
}
