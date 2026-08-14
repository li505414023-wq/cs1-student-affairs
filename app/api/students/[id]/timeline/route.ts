import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { counselorClasses, students } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { ApiError, fail, ok } from "@/lib/api";
import { studentTimeline } from "@/lib/timeline";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requirePermission(request, "read");
    const db = getDb();
    const [student] = await db.select().from(students).where(eq(students.id, id)).limit(1);
    if (!student) throw new ApiError(404, "学生记录不存在");

    // 行级权限与学生档案一致：学生看本人，辅导员/院系看绑定范围。
    if (session.user.role === "student") {
      if (student.userId !== session.user.id) throw new ApiError(403, "无权访问该学生档案");
    } else if (session.user.role === "counselor" || session.user.role === "department_admin") {
      const classes = await db.select().from(counselorClasses).where(eq(counselorClasses.userId, session.user.id));
      const classNames = classes.map((c) => c.className);
      if (classNames.length === 0 || !classNames.includes(student.className)) {
        throw new ApiError(403, "无权访问该学生档案");
      }
    }

    const events = await studentTimeline(student.no);
    return ok({ events });
  } catch (error) {
    return fail(error, request);
  }
}
