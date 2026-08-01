import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { businessRecords, counselorClasses, students } from "@/db/schema";
import type { CurrentSession } from "@/lib/auth";

/**
 * Row-scope conditions for business_records, mirroring the student list endpoint:
 * students see only their own; counselors/department admins see their assigned
 * classes' students (plus their own); everyone else (admin/staff/…) unrestricted.
 * Shared by the list and the stats endpoints so aggregates match the visible rows.
 */
export async function recordScopeConditions(session: CurrentSession) {
  if (session.user.role === "student") {
    return [eq(businessRecords.createdBy, session.user.id)];
  }
  if (session.user.role === "counselor" || session.user.role === "department_admin") {
    const db = getDb();
    const classes = await db.select({ className: counselorClasses.className })
      .from(counselorClasses).where(eq(counselorClasses.userId, session.user.id));
    if (classes.length === 0) return [eq(businessRecords.createdBy, "__no_scope_access__")];
    const classNames = [...new Set(classes.map((c) => c.className))];
    const classStudents = await db.select({ userId: students.userId })
      .from(students).where(inArray(students.className, classNames));
    const ids = new Set<string>([session.user.id]);
    for (const row of classStudents) if (row.userId) ids.add(row.userId);
    return [inArray(businessRecords.createdBy, [...ids])];
  }
  return [];
}
