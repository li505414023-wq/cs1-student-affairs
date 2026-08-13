import {
  absenceWarnings,
  attendances,
  conductScores,
  courseScores,
  leaves,
  physicalTests,
  punishments,
  statusChanges,
} from "@/db/schema";

// 领域表核心列的取值工具：区队(警务化)与班级(学工)两种键名并存。
export const str = (value: unknown): string =>
  typeof value === "number" ? String(value) : typeof value === "string" ? value : "";

export const num = (value: unknown): number => {
  const n = Number(str(value));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

export const classNameOf = (d: Record<string, unknown>): string =>
  str(d["区队"] ?? d["班级"] ?? d["班级名称"] ?? "");

export type DomainConfig = {
  featureId: string;
  // 8 张领域表结构相似（均含 studentNo/className/createdBy/dataJson 等列），
  // 但 drizzle 将表名编码进类型导致互不兼容，统一用宽松类型。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  // 从 dataJson 提取核心列（返回真表列名 → 值，不含 data_json/id/时间戳）。
  extractCore: (d: Record<string, unknown>) => Record<string, unknown>;
  // 列表统计时可按数值聚合的 jsonb 键（复用通用 stats 逻辑）。
  numericColumns: string[];
};

export const DOMAIN_CONFIGS: DomainConfig[] = [
  {
    featureId: "punishment",
    table: punishments,
    extractCore: (d) => ({
      studentNo: str(d["学号"]),
      studentName: str(d["姓名"]),
      className: classNameOf(d),
      punishmentType: str(d["处分类型"]),
      punishmentLevel: str(d["处分等级"]),
      status: str(d["处分状态"] ?? d["处理状态"] ?? d["状态"] ?? "生效中"),
    }),
    numericColumns: [],
  },
  {
    featureId: "conduct-score",
    table: conductScores,
    extractCore: (d) => ({
      studentNo: str(d["学号"]),
      studentName: str(d["姓名"]),
      className: classNameOf(d),
      direction: str(d["加减分"] ?? "加分"),
      score: num(d["分值"]),
      reason: str(d["事由"]),
      recordDate: str(d["记录日期"] ?? d["申请日期"] ?? ""),
    }),
    numericColumns: ["分值"],
  },
  {
    featureId: "course-scores",
    table: courseScores,
    extractCore: (d) => ({
      studentNo: str(d["学号"]),
      studentName: str(d["姓名"]),
      className: classNameOf(d),
      term: str(d["学年学期"] ?? d["学期"] ?? ""),
      courseName: str(d["课程名称"]),
      score: num(d["课程成绩"]),
      passStatus: str(d["及格状态"]),
    }),
    numericColumns: ["课程成绩"],
  },
  {
    featureId: "physical-test",
    table: physicalTests,
    extractCore: (d) => ({
      studentNo: str(d["学号"]),
      studentName: str(d["姓名"]),
      className: classNameOf(d),
      item: str(d["测试项目"]),
      score: str(d["成绩"]),
      result: str(d["成绩评定"]),
    }),
    numericColumns: [],
  },
  {
    featureId: "class-attendance",
    table: attendances,
    extractCore: (d) => ({
      studentNo: str(d["学号"]),
      studentName: str(d["姓名"]),
      className: classNameOf(d),
      sourceFeature: "class-attendance",
      attendanceDate: str(d["日期"] ?? d["考勤日期"] ?? ""),
      slot: str(d["集队时段"] ?? ""),
      attendanceStatus: str(d["点名结果"] ?? d["考勤状态"] ?? ""),
    }),
    numericColumns: [],
  },
  {
    featureId: "evening-rollcall",
    table: attendances,
    extractCore: (d) => ({
      studentNo: str(d["学号"]),
      studentName: str(d["姓名"]),
      className: classNameOf(d),
      sourceFeature: "evening-rollcall",
      attendanceDate: str(d["日期"] ?? d["考勤日期"] ?? ""),
      slot: "",
      attendanceStatus: str(d["点名结果"] ?? d["考勤状态"] ?? ""),
    }),
    numericColumns: [],
  },
  {
    featureId: "morning-exercise",
    table: attendances,
    extractCore: (d) => ({
      studentNo: str(d["学号"]),
      studentName: str(d["姓名"]),
      className: classNameOf(d),
      sourceFeature: "morning-exercise",
      attendanceDate: str(d["日期"] ?? d["考勤日期"] ?? ""),
      slot: "",
      attendanceStatus: str(d["考勤状态"] ?? d["点名结果"] ?? ""),
    }),
    numericColumns: [],
  },
  {
    featureId: "absence-warning",
    table: absenceWarnings,
    extractCore: (d) => ({
      studentNo: str(d["学号"]),
      studentName: str(d["姓名"]),
      className: classNameOf(d),
      term: str(d["学期"] ?? ""),
      totalHours: num(d["累计旷课课时"]),
      warningLevel: str(d["预警等级"]),
      status: str(d["状态"] ?? "预警中"),
    }),
    numericColumns: ["累计旷课课时"],
  },
  {
    featureId: "leave",
    table: leaves,
    extractCore: (d) => ({
      studentNo: str(d["学号"]),
      studentName: str(d["姓名"]),
      className: classNameOf(d),
      leaveType: str(d["请假类型"]),
      startAt: str(d["开始时间"] ?? d["开始日期"] ?? ""),
      endAt: str(d["结束时间"] ?? d["结束日期"] ?? ""),
      days: num(d["请假天数"]),
      approvalChain: str(d["审批链"] ?? ""),
      status: str(d["审核状态"] ?? d["状态"] ?? "已提交"),
    }),
    numericColumns: ["请假天数"],
  },
  {
    featureId: "status-change",
    table: statusChanges,
    extractCore: (d) => ({
      studentNo: str(d["学号"]),
      studentName: str(d["姓名"]),
      className: classNameOf(d),
      changeType: str(d["异动类型"]),
      effectiveDate: str(d["生效日期"] ?? ""),
      status: str(d["处理状态"] ?? d["状态"] ?? "待处理"),
    }),
    numericColumns: [],
  },
];

const configByFeature = new Map(DOMAIN_CONFIGS.map((c) => [c.featureId, c]));

export function getDomainConfig(featureId: string): DomainConfig | undefined {
  return configByFeature.get(featureId);
}

export function isDomainFeature(featureId: string): boolean {
  return configByFeature.has(featureId);
}

// 考勤三合一共享 attendances 表，需按 source_feature 区分来源。
export const ATTENDANCE_FEATURES = ["class-attendance", "evening-rollcall", "morning-exercise"];
