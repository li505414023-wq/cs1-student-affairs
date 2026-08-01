import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { students, counselorClasses } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { ApiError, fail, ok, readJson, requestIp, writeAudit } from "@/lib/api";
import { validateStudentInput } from "@/lib/validation";

export const runtime = "nodejs";

/** id_card is PII — never return it to clients. */
function withoutIdCard<T extends Record<string, unknown> | null | undefined>(row: T): T {
  if (!row) return row;
  const { idCard: _omit, ...rest } = row;
  return rest as T;
}

/**
 * Verify the current user is authorized to access a specific student record.
 * Mirrors the data-scope logic from the list endpoint (route.ts).
 */
async function authorizeStudentAccess(request: NextRequest, studentId: string, action: "read" | "write" | "delete"): Promise<ReturnType<typeof requirePermission>> {
  const session = await requirePermission(request, action);
  const db = getDb();
  const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
  if (!student) throw new ApiError(404, "学生记录不存在");

  // Student role: only their own linked record
  if (session.user.role === "student") {
    if (student.userId !== session.user.id) throw new ApiError(403, "无权访问该学生记录");
    return session;
  }

  // Counselors and department admins: only their assigned classes
  if (session.user.role === "counselor" || session.user.role === "department_admin") {
    const classes = await db.select().from(counselorClasses).where(eq(counselorClasses.userId, session.user.id));
    const classNames = classes.map((c) => c.className);
    if (classNames.length === 0 || !classNames.includes(student.className)) {
      throw new ApiError(403, "无权访问该学生记录");
    }
  }

  return session;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await authorizeStudentAccess(_request, id, "read");
    const [student] = await getDb().select().from(students).where(eq(students.id, id)).limit(1);
    return ok(withoutIdCard(student));
  } catch (error) {
    return fail(error, _request);
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await authorizeStudentAccess(request, id, "write");
    validateCsrf(request, session);
    const validated = validateStudentInput(await readJson(request));
    if (!validated.success) throw new ApiError(422, "学生信息校验失败", validated.errors);
    try {
      await getDb().update(students).set({ ...validated.data, updatedAt: new Date() }).where(eq(students.id, id));
    } catch (error) {
      if ((error as { code?: unknown })?.code === "23505") throw new ApiError(409, "该学号已存在");
      throw error;
    }
    await writeAudit({ userId: session.user.id, action: "update", resourceType: "student", resourceId: id, detail: { no: validated.data.no }, ip: requestIp(request) });
    const [updated] = await getDb().select().from(students).where(eq(students.id, id)).limit(1);
    return ok(withoutIdCard(updated));
  } catch (error) {
    return fail(error, request);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await authorizeStudentAccess(request, id, "delete");
    validateCsrf(request, session);
    const deleted = await getDb().delete(students).where(eq(students.id, id)).returning({ id: students.id });
    if (deleted.length === 0) throw new ApiError(404, "学生记录不存在");
    await writeAudit({ userId: session.user.id, action: "delete", resourceType: "student", resourceId: id, ip: requestIp(request) });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error, request);
  }
}
