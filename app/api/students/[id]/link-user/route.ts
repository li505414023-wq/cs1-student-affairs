import { eq } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { students, users } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { hashPassword } from "@/lib/security";
import { ApiError, fail, ok, readJson, writeAudit, requestIp } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(request, "admin");
    validateCsrf(request, session);

    const { id } = await context.params;
    const [student] = await getDb().select().from(students).where(eq(students.id, id)).limit(1);
    if (!student) throw new ApiError(404, "学生不存在");
    if (student.userId) throw new ApiError(409, "该学生已关联用户账户");

    const body = await readJson(request);
    // Default password is a random 12-char token (shown to the admin once in the
    // response) instead of a predictable student-number-derived value.
    const providedPassword = typeof body?.password === "string" && body.password.length > 0 ? body.password : null;
    if (providedPassword !== null && providedPassword.length < 10) {
      throw new ApiError(422, "密码至少10个字符");
    }
    const password = providedPassword ?? randomBytes(9).toString("base64url");

    // Create user account linked to this student
    const userId = randomUUID();
    const passwordHash = await hashPassword(password);
    await getDb().insert(users).values({
      id: userId,
      username: student.no,
      displayName: student.name,
      passwordHash,
      role: "student",
      roleTags: ["学生"],
    });

    // Link student to user
    await getDb().update(students).set({ userId }).where(eq(students.id, id));

    await writeAudit({ userId: session.user.id, action: "link_student_user", resourceType: "student", resourceId: id, detail: { userId, studentNo: student.no }, ip: requestIp(request) });
    return ok({ userId, username: student.no, password }, 201);
  } catch (error) {
    return fail(error, request);
  }
}
