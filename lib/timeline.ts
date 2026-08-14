import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  absenceWarnings,
  attendances,
  conductScores,
  courseScores,
  crisisRecords,
  helpRecords,
  leaves,
  physicalTests,
  punishments,
  statusChanges,
  talks,
} from "@/db/schema";

export type TimelineEvent = {
  type: string;
  label: string;
  date: string;
  summary: string;
  data: Record<string, unknown>;
};

const dayOf = (value: unknown, fallback: unknown): string => {
  const s = typeof value === "string" ? value : "";
  if (!s) {
    const d = fallback instanceof Date ? fallback.toISOString().slice(0, 10) : "";
    return d;
  }
  return s.slice(0, 10);
};

/**
 * 聚合某学生的全部关联记录，形成按时间倒序的统一档案时间线。
 * 数据源：谈心谈话、心理危机、学业帮扶、请假、操行分、课程成绩、
 * 体测、考勤、旷课预警、学籍异动、处分。
 */
export async function studentTimeline(studentNo: string): Promise<TimelineEvent[]> {
  const db = getDb();
  const events: TimelineEvent[] = [];

  const push = (
    rows: Array<Record<string, unknown>>,
    type: string,
    label: string,
    dateOf: (r: Record<string, unknown>) => string,
    summaryOf: (r: Record<string, unknown>) => string,
  ) => {
    for (const row of rows) {
      events.push({
        type,
        label,
        date: dateOf(row),
        summary: summaryOf(row),
        data: row,
      });
    }
  };

  const talksRows = await db.select().from(talks).where(eq(talks.studentNo, studentNo));
  push(talksRows, "talk", "谈心谈话", (r) => String(r.talkDate ?? ""), (r) => `${r.topic || "谈话"}（${r.way || ""}）`);

  const crisisRows = await db.select().from(crisisRecords).where(eq(crisisRecords.studentNo, studentNo));
  push(crisisRows, "crisis", "心理危机", (r) => dayOf(r.createdAt, r.createdAt), (r) => `${r.crisisLevel || ""} 危机：${r.reason || ""}`);

  const helpRows = await db.select().from(helpRecords).where(eq(helpRecords.studentNo, studentNo));
  push(helpRows, "help", "学业帮扶", (r) => dayOf(r.createdAt, r.createdAt), (r) => `帮扶：${r.courseName || ""}（${r.status || ""}）`);

  const leaveRows = await db.select().from(leaves).where(eq(leaves.studentNo, studentNo));
  push(leaveRows, "leave", "请假", (r) => String(r.startAt ?? ""), (r) => `请假 ${r.days || 0} 天（${r.status || ""}）`);

  const conductRows = await db.select().from(conductScores).where(eq(conductScores.studentNo, studentNo));
  push(conductRows, "conduct", "操行分", (r) => String(r.recordDate ?? ""), (r) => `${r.direction || ""} ${r.score} 分：${r.reason || ""}`);

  const courseRows = await db.select().from(courseScores).where(eq(courseScores.studentNo, studentNo));
  push(courseRows, "course", "课程成绩", (r) => dayOf(r.createdAt, r.createdAt), (r) => `${r.courseName || ""}：${r.score} 分`);

  const physicalRows = await db.select().from(physicalTests).where(eq(physicalTests.studentNo, studentNo));
  push(physicalRows, "physical", "体测", (r) => dayOf(r.createdAt, r.createdAt), (r) => `${r.item || ""}：${r.result || r.score || ""}`);

  const attendanceRows = await db.select().from(attendances).where(eq(attendances.studentNo, studentNo));
  push(attendanceRows, "attendance", "考勤", (r) => String(r.attendanceDate ?? ""), (r) => `${r.attendanceStatus || ""}（${r.sourceFeature || ""}）`);

  const warningRows = await db.select().from(absenceWarnings).where(eq(absenceWarnings.studentNo, studentNo));
  push(warningRows, "warning", "旷课预警", (r) => dayOf(r.createdAt, r.createdAt), (r) => `累计旷课 ${r.totalHours} 课时，${r.warningLevel || ""}`);

  const statusRows = await db.select().from(statusChanges).where(eq(statusChanges.studentNo, studentNo));
  push(statusRows, "status", "学籍异动", (r) => String(r.effectiveDate ?? ""), (r) => `${r.changeType || ""}（${r.status || ""}）`);

  const punishmentRows = await db.select().from(punishments).where(eq(punishments.studentNo, studentNo));
  push(punishmentRows, "punishment", "处分", (r) => dayOf(r.createdAt, r.createdAt), (r) => `${r.punishmentType || ""}（${r.status || ""}）`);

  events.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return events;
}
