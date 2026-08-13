import { eq, inArray, or } from "drizzle-orm";
import { getDb } from "@/db";
import { counselorClasses, students } from "@/db/schema";
import type { CurrentSession } from "@/lib/auth";

// 领域表统一暴露的核心列（8 张表均含这三列，用于行级权限过滤）。
// 表名编码进 drizzle 类型导致互不兼容，用宽松类型。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ScopedTable = any;

/**
 * 领域表行级数据范围，逻辑与 businessRecords 的 recordScopeConditions 对齐，
 * 但用索引列 student_no / class_name 替代 JSONB 提取：
 * - 学生：本人提交 + 学号指向本人的记录（管理员代为登记的操行分/处分等）；
 * - 辅导员/院系管理员：本人记录 + 绑定班级学生的记录 + 区队/班级指向其范围的记录；
 * - 其余角色（admin/staff）不受限。
 */
export async function domainScopeConditions(session: CurrentSession, table: ScopedTable) {
  const db = getDb();
  if (session.user.role === "student") {
    const own = eq(table.createdBy, session.user.id);
    const [stu] = await db
      .select({ no: students.no })
      .from(students)
      .where(eq(students.userId, session.user.id))
      .limit(1);
    if (!stu) return [own];
    return [or(own, eq(table.studentNo, stu.no))];
  }
  if (session.user.role === "counselor" || session.user.role === "department_admin") {
    const classes = await db
      .select({ className: counselorClasses.className })
      .from(counselorClasses)
      .where(eq(counselorClasses.userId, session.user.id));
    if (classes.length === 0) return [eq(table.createdBy, "__no_scope_access__")];
    const classNames = [...new Set(classes.map((c) => c.className))];
    const classStudents = await db
      .select({ userId: students.userId, no: students.no })
      .from(students)
      .where(inArray(students.className, classNames));
    const ids = new Set<string>([session.user.id]);
    const nos: string[] = [];
    for (const row of classStudents) {
      if (row.userId) ids.add(row.userId);
      if (row.no) nos.push(row.no);
    }
    return [or(
      inArray(table.createdBy, [...ids]),
      inArray(table.className, classNames),
      nos.length > 0 ? inArray(table.studentNo, nos) : undefined,
    )];
  }
  return [];
}
