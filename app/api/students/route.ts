import { asc, count, eq, like, or, and, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { students, counselorClasses } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { ApiError, fail, isUniqueViolation, ok, readJson, requestIp, writeAudit } from "@/lib/api";
import { validateStudentInput } from "@/lib/validation";

export const runtime = "nodejs";

/** id_card is PII — never return it to clients (it lives only in the DB). */
function withoutIdCard<T extends Record<string, unknown> | null | undefined>(row: T): T {
  if (!row) return row;
  const { idCard: _omit, ...rest } = row;
  return rest as T;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, "read");
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("pageSize") ?? 20)));
    const keyword = request.nextUrl.searchParams.get("keyword")?.trim() ?? "";
    const faculty = request.nextUrl.searchParams.get("faculty")?.trim() ?? "";
    const major = request.nextUrl.searchParams.get("major")?.trim() ?? "";
    const className = request.nextUrl.searchParams.get("className")?.trim() ?? "";
    const grade = request.nextUrl.searchParams.get("grade")?.trim() ?? "";

    // Build conditions: keyword search + field filters + data scope
    const conditions = [];
    if (keyword) {
      conditions.push(or(
        like(students.name, `%${keyword}%`),
        like(students.no, `%${keyword}%`),
        like(students.phone, `%${keyword}%`),
      ));
    }
    if (faculty) conditions.push(like(students.faculty, `%${faculty}%`));
    if (major) conditions.push(like(students.major, `%${major}%`));
    if (className) conditions.push(like(students.className, `%${className}%`));
    if (grade) conditions.push(eq(students.grade, grade));

    // Student can only see their own linked record
    if (session.user.role === "student") {
      const [ownRecord] = await getDb().select().from(students).where(eq(students.userId, session.user.id)).limit(1);
      return ok({ items: ownRecord ? [withoutIdCard(ownRecord)] : [], pagination: { page: 1, pageSize: 1, total: ownRecord ? 1 : 0 } });
    }

    // Data permission isolation: counselors & department admins see only their classes
    if (session.user.role === "counselor" || session.user.role === "department_admin") {
      const classes = await getDb().select().from(counselorClasses).where(eq(counselorClasses.userId, session.user.id));
      if (classes.length > 0) {
        const classNames = [...new Set(classes.map((c) => c.className))];
        conditions.push(inArray(students.className, classNames));
      } else {
        // No assigned classes = no visible students
        return ok({ items: [], pagination: { page, pageSize, total: 0 } });
      }
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const db = getDb();
    const items = await db.select().from(students).where(where).orderBy(asc(students.no)).limit(pageSize).offset((page - 1) * pageSize);
    const [totalRow] = await db.select({ value: count() }).from(students).where(where);
    const total = Number(totalRow?.value ?? 0);
    return ok({ items: items.map(withoutIdCard), pagination: { page, pageSize, total } });
  } catch (error) {
    return fail(error, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "write");
    validateCsrf(request, session);
    const validated = validateStudentInput(await readJson(request));
    if (!validated.success) throw new ApiError(422, "学生信息校验失败", validated.errors);
    const id = randomUUID();
    try {
      await getDb().insert(students).values({ id, ...validated.data, createdBy: session.user.id });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError(409, "该学号已存在");
      throw error;
    }
    await writeAudit({ userId: session.user.id, action: "create", resourceType: "student", resourceId: id, detail: { no: validated.data.no }, ip: requestIp(request) });
    const [created] = await getDb().select().from(students).where(eq(students.id, id)).limit(1);
    return ok(withoutIdCard(created), 201);
  } catch (error) {
    return fail(error, request);
  }
}
