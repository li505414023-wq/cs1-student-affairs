import { eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { businessRecords, counselorClasses, students } from "@/db/schema";
import type { CurrentSession } from "@/lib/auth";

/**
 * Row-scope conditions for business_records, mirroring the student list endpoint:
 * - students see records they submitted plus records that name them by 学号
 *   (conduct scores / physical tests / punishments are registered by staff);
 * - counselors/department admins see their own records, records submitted by
 *   students of their assigned classes, and records whose 区队/班级/学号 fields
 *   point at those classes or students (police data entered by admins);
 * - everyone else (admin/staff/…) unrestricted.
 * Shared by the list and the stats endpoints so aggregates match the visible rows.
 */
export async function recordScopeConditions(session: CurrentSession) {
  const db = getDb();
  if (session.user.role === "student") {
    const own = eq(businessRecords.createdBy, session.user.id);
    const [stu] = await db.select({ no: students.no })
      .from(students).where(eq(students.userId, session.user.id)).limit(1);
    if (!stu) return [own];
    return [or(own, sql`${businessRecords.dataJson}->>'学号' = ${stu.no}`)];
  }
  if (session.user.role === "counselor" || session.user.role === "department_admin") {
    const classes = await db.select({ className: counselorClasses.className })
      .from(counselorClasses).where(eq(counselorClasses.userId, session.user.id));
    if (classes.length === 0) return [eq(businessRecords.createdBy, "__no_scope_access__")];
    const classNames = [...new Set(classes.map((c) => c.className))];
    const classStudents = await db.select({ userId: students.userId, no: students.no })
      .from(students).where(inArray(students.className, classNames));
    const ids = new Set<string>([session.user.id]);
    const nos: string[] = [];
    for (const row of classStudents) {
      if (row.userId) ids.add(row.userId);
      if (row.no) nos.push(row.no);
    }
    return [or(
      inArray(businessRecords.createdBy, [...ids]),
      inArray(sql`${businessRecords.dataJson}->>'区队'`, classNames),
      inArray(sql`${businessRecords.dataJson}->>'班级'`, classNames),
      nos.length > 0 ? inArray(sql`${businessRecords.dataJson}->>'学号'`, nos) : undefined,
    )];
  }
  return [];
}
