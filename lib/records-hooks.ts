import { and, eq, inArray, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { getDb } from "@/db";
import { businessRecords, managedItems, students } from "@/db/schema";
import {
  ABSENCE_PER_HOUR_DEDUCTION,
  absencePunishment,
  absenceWarningLevel,
  CONDUCT_BASE_SCORE,
  CONDUCT_VETO_LINE,
  COURSE_VETO_LINE,
  isAppealInDeadline,
  leaveApprovalChain,
  leaveChainValid,
  punishmentConductDelta,
} from "./handbook-rules";

type RecordData = Record<string, string | number>;
type Db = ReturnType<typeof getDb>;

const str = (value: unknown): string => (typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "");
const today = () => new Date().toISOString().slice(0, 10);

/**
 * 创建前的业务规则校验。返回 null 表示通过,否则返回面向用户的错误信息。
 */
export function validateRecordBusiness(featureId: string, data: Record<string, unknown>): string | null {
  if (featureId === "leave") {
    const days = leaveDays(data);
    if (days !== null && !leaveChainValid(days)) {
      return "请假时长超过三个月,须按学院规定办理休学手续,不能通过请假审批";
    }
  }
  if (featureId === "appeal") {
    const decisionDate = str(data["处分决定书日期"] || data["处分决定日期"]);
    const appealDate = str(data["申诉提交日期"]) || today();
    if (decisionDate && !isAppealInDeadline(decisionDate, appealDate)) {
      return "申诉须在接到处分决定书之日起10日内提出,已超过申诉时限";
    }
  }
  if (featureId === "status-change") {
    const type = str(data["异动类型"]);
    const allowed = ["休学", "复学", "学业警示", "留级", "退学", "转专业", "转系"];
    if (type && !allowed.includes(type)) return `异动类型不正确,可选:${allowed.join("/")}`;
  }
  return null;
}

/**
 * 创建前的数据补全:为请假记录计算请假天数与手册规定的分级审批链。
 */
export function enrichRecordData(featureId: string, data: RecordData): RecordData {
  if (featureId !== "leave") return data;
  const next: RecordData = { ...data };
  const days = leaveDays(next);
  if (days !== null) {
    if (!next["请假天数"]) next["请假天数"] = String(Math.max(1, Math.ceil(days)));
    const onCampusDuty = str(next["请假类型"]) === "公假" || str(next["是否校内因公"]) === "是";
    next["审批链"] = leaveApprovalChain(days, onCampusDuty);
  }
  return next;
}

function leaveDays(data: Record<string, unknown>): number | null {
  const explicit = Number(str(data["请假天数"]));
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const start = new Date(str(data["开始时间"] || data["开始日期"]));
  const end = new Date(str(data["结束时间"] || data["结束日期"]));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

/**
 * 实体维护的业务规则:一个院系只设一个学生大队(院系→大队 1:1)。
 * 返回 null 表示通过,否则返回错误信息。
 */
export async function validateEntityUniqueness(featureId: string, parentCode: string | null | undefined, db: Db, excludeId?: string): Promise<string | null> {
  if (featureId !== "corps-admin" || !parentCode) return null;
  const conditions = [eq(managedItems.featureId, "corps-admin"), eq(managedItems.parentCode, parentCode)];
  if (excludeId) conditions.push(ne(managedItems.id, excludeId));
  const [existing] = await db.select({ name: managedItems.name }).from(managedItems).where(and(...conditions)).limit(1);
  if (existing) return "一个院系只能设置一个学生大队,该系部已存在大队,请直接编辑现有大队";
  return null;
}

/**
 * 按院系名称返回所属大队(院系→大队 1:1)。
 * 大队长直接管理本大队辅导员,辅导员管理自己的区队。
 */
export async function corpsForFaculties(db: Db, facultyNames: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const names = [...new Set(facultyNames.filter(Boolean))];
  if (names.length === 0) return result;
  const faculties = await db.select({ code: managedItems.code, name: managedItems.name })
    .from(managedItems).where(eq(managedItems.featureId, "faculty-admin"));
  const codeByName = new Map(faculties.filter((f) => names.includes(f.name)).map((f) => [f.name, f.code]));
  if (codeByName.size === 0) return result;
  const corps = await db.select({ parentCode: managedItems.parentCode, name: managedItems.name })
    .from(managedItems).where(and(eq(managedItems.featureId, "corps-admin"), inArray(managedItems.parentCode, [...codeByName.values()])));
  const corpsByCode = new Map(corps.map((c) => [c.parentCode ?? "", c.name]));
  for (const [name, code] of codeByName) {
    const corpsName = corpsByCode.get(code);
    if (corpsName) result.set(name, corpsName);
  }
  return result;
}

const ABSENCE_FEATURES = ["class-attendance", "evening-rollcall", "morning-exercise"];

const HONOR_APPLY_FEATURES = ["personal-honor", "scholarship", "collective-honor"];

/**
 * 评优评奖前置校验(手册规定):
 * 存在生效中处分、操行分低于65、单科低于60或体测不合格者不得评优。
 */
export async function validateRecordAgainstDb(featureId: string, data: Record<string, unknown>, db: Db): Promise<string | null> {
  if (!HONOR_APPLY_FEATURES.includes(featureId)) return null;
  const no = str(data["学号"]);
  if (!no) return null;
  const punishments = await db.select({ dataJson: businessRecords.dataJson, status: businessRecords.status })
    .from(businessRecords).where(eq(businessRecords.featureId, "punishment"));
  const activePunishment = punishments.find((row) => {
    const d = row.dataJson as Record<string, unknown>;
    return str(d["学号"]) === no && !str(row.status).includes("解除") && !str(row.status).includes("撤销");
  });
  if (activePunishment) return "该学生存在生效中的处分记录,按手册规定不得参加评优评奖";
  // 综合素质一票否决线:操行<65 / 单科<60 / 体测不合格。
  const conductRows = await db.select({ dataJson: businessRecords.dataJson })
    .from(businessRecords).where(eq(businessRecords.featureId, "conduct-score"));
  let conduct = CONDUCT_BASE_SCORE;
  for (const row of conductRows) {
    const d = row.dataJson as Record<string, unknown>;
    if (str(d["学号"]) !== no) continue;
    const value = Number(str(d["分值"])) || 0;
    conduct += str(d["加减分"]) === "扣分" ? -value : value;
  }
  if (conduct < CONDUCT_VETO_LINE) return `该学生操行分${conduct}低于${CONDUCT_VETO_LINE}分,综合素质考核一票否决,不得评优`;
  const scoreRows = await db.select({ dataJson: businessRecords.dataJson })
    .from(businessRecords).where(eq(businessRecords.featureId, "course-scores"));
  const failedCourse = scoreRows.find((row) => {
    const d = row.dataJson as Record<string, unknown>;
    const score = Number(str(d["课程成绩"]));
    return str(d["学号"]) === no && Number.isFinite(score) && score < COURSE_VETO_LINE;
  });
  if (failedCourse) return "该学生存在单科成绩低于60分,综合素质考核一票否决,不得评优";
  const physicalRows = await db.select({ dataJson: businessRecords.dataJson })
    .from(businessRecords).where(eq(businessRecords.featureId, "physical-test"));
  const failedTest = physicalRows.find((row) => {
    const d = row.dataJson as Record<string, unknown>;
    return str(d["学号"]) === no && str(d["成绩评定"]) === "不合格";
  });
  if (failedTest) return "该学生体测存在不合格项,综合素质考核一票否决,不得评优";
  return null;
}

function isAbsence(data: Record<string, unknown>): boolean {
  return str(data["考勤状态"]) === "旷课" || str(data["点名结果"]) === "旷课";
}

/**
 * 记录创建后的联动副作用(手册规定):
 * - 处分登记 → 操行分按处分等级联动减分(警告-10/严重警告-20/记过-30/留校察看-40);
 * - 个人卫生检查不合格 → 操行分减2分;
 * - 考勤旷课 → 重新计算学期累计旷课并更新旷课预警记录;
 * - 学籍异动办结 → 同步学生学籍状态。
 */
export async function afterRecordCreated(featureId: string, data: RecordData, db: Db, createdBy: string): Promise<void> {
  if (featureId === "punishment") {
    const delta = punishmentConductDelta(str(data["处分类型"]));
    const no = str(data["学号"]);
    if (delta !== 0 && no) {
      await insertConductRecord(db, createdBy, {
        姓名: str(data["姓名"]), 学号: no, 区队: str(data["区队"]),
        加减分: "扣分", 分值: String(Math.abs(delta)),
        事由: `${str(data["处分类型"]) || "处分"}处分联动减分`,
      });
    }
    return;
  }
  if (featureId === "student-hygiene") {
    const score = Number(str(data["个人得分"]));
    const no = str(data["学号"]);
    if (no && Number.isFinite(score) && score < 60) {
      await insertConductRecord(db, createdBy, {
        姓名: str(data["姓名"]), 学号: no, 区队: str(data["区队"]),
        加减分: "扣分", 分值: "2",
        事由: "个人卫生检查不合格联动减分",
      });
    }
    return;
  }
  if (ABSENCE_FEATURES.includes(featureId) && isAbsence(data)) {
    await refreshAbsenceWarning(db, str(data["学号"]), str(data["姓名"]), str(data["区队"]));
    return;
  }
  if (featureId === "status-change") {
    const no = str(data["学号"]);
    const type = str(data["异动类型"]);
    const statusMap: Record<string, string> = { 休学: "休学", 复学: "在读", 退学: "退学" };
    if (no && statusMap[type]) {
      await db.update(students).set({ status: statusMap[type] }).where(eq(students.no, no));
    }
  }
}

async function insertConductRecord(db: Db, createdBy: string, fields: Record<string, string>): Promise<void> {
  await db.insert(businessRecords).values({
    id: randomUUID(),
    featureId: "conduct-score",
    dataJson: { ...fields, 记录日期: today(), 记录人: "系统联动" },
    status: "已提交",
    createdBy,
  });
}

/** 学期累计旷课(各考勤模块旷课记录合计)→ 更新该学生的旷课预警记录。 */
async function refreshAbsenceWarning(db: Db, no: string, name: string, className: string): Promise<void> {
  if (!no) return;
  // 三个考勤模块的旷课记录统一汇总(数据量小,一次取回内存过滤)。
  const rows = await db.select({ featureId: businessRecords.featureId, dataJson: businessRecords.dataJson })
    .from(businessRecords)
    .where(inArray(businessRecords.featureId, ABSENCE_FEATURES));
  const totalHours = rows.filter((row) => {
    const data = row.dataJson as Record<string, unknown>;
    return str(data["学号"]) === no && isAbsence(data);
  }).length;
  const level = absenceWarningLevel(totalHours);
  // 移除该学生旧预警后写入最新状态(不足预警线则仅清理)。
  const existing = await db.select({ id: businessRecords.id, dataJson: businessRecords.dataJson })
    .from(businessRecords).where(eq(businessRecords.featureId, "absence-warning"));
  const staleIds = existing.filter((row) => str((row.dataJson as Record<string, unknown>)["学号"]) === no).map((row) => row.id);
  for (const id of staleIds) {
    await db.delete(businessRecords).where(and(eq(businessRecords.featureId, "absence-warning"), eq(businessRecords.id, id)));
  }
  if (level) {
    await db.insert(businessRecords).values({
      id: randomUUID(),
      featureId: "absence-warning",
      dataJson: {
        姓名: name, 学号: no, 区队: className, 学期: currentTerm(),
        累计旷课课时: String(totalHours), 预警等级: level,
        对应处分: absencePunishment(totalHours) ?? "未达处分线",
        更新时间: new Date().toISOString().slice(0, 16).replace("T", " "),
      },
      status: totalHours >= 10 ? "已达处分线" : "预警中",
      createdBy: null,
    });
  }
}

function currentTerm(): string {
  const now = new Date();
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1}学年${now.getMonth() >= 1 && now.getMonth() <= 6 ? "第二学期" : "第一学期"}`;
}

export const CONDUCT_DEDUCTION_PER_ABSENCE = ABSENCE_PER_HOUR_DEDUCTION;
