/**
 * 学生手册(2024)业务规则——纯函数实现,便于单元测试。
 * 依据《安徽公安学院学生手册(2024年制定)》:
 * 考勤管理办法 / 学生综合素质考核办法 / 学生表彰奖励办法 /
 * 家庭经济困难学生认定办法 / 国家助学金评审办法 / 学生申诉处理办法。
 */

/* ---------------- 请假分级审批(考勤管理办法 第八条) ---------------- */

/** 校内因公请假由系部主任审批。 */
export const LEAVE_ON_CAMPUS_DUTY_APPROVER = "系部主任(校内因公)";

/**
 * 按时长返回审批链(自下而上签署):
 * ≤1天 区队指导员;≤3天 +大队长;≤7天 +系部主任;
 * ≤30天 +分管院领导;≤90天 +院长;超过90天不允许。
 */
export function leaveApprovalChain(days: number, onCampusDuty = false): string {
  if (onCampusDuty) return LEAVE_ON_CAMPUS_DUTY_APPROVER;
  if (days <= 0) return "区队指导员";
  if (days <= 1) return "区队指导员";
  if (days <= 3) return "区队指导员→大队长";
  if (days <= 7) return "区队指导员→大队长→系部主任";
  if (days <= 30) return "区队指导员→大队长→系部主任→分管院领导";
  if (days <= 90) return "区队指导员→大队长→系部主任→分管院领导→院长";
  return "";
}

export function leaveChainValid(days: number): boolean {
  return leaveApprovalChain(days) !== "";
}

/* ---------------- 旷课累计处分(学籍管理 旷课条款) ---------------- */

const ABSENCE_PUNISHMENT_LINES: Array<{ hours: number; punishment: string }> = [
  { hours: 40, punishment: "留校察看" },
  { hours: 30, punishment: "记过" },
  { hours: 20, punishment: "严重警告" },
  { hours: 10, punishment: "警告" },
];

/** 一学期累计旷课课时 → 对应处分;不足10课时返回 null。 */
export function absencePunishment(totalHours: number): string | null {
  for (const line of ABSENCE_PUNISHMENT_LINES) {
    if (totalHours >= line.hours) return line.punishment;
  }
  return null;
}

/** 旷课预警等级:≥6 预警,≥10 严重预警,≥30 高危。 */
export function absenceWarningLevel(totalHours: number): string | null {
  if (totalHours >= 30) return "高危";
  if (totalHours >= 10) return "严重预警";
  if (totalHours >= 6) return "预警";
  return null;
}

/* ---------------- 处分与操行分联动(综合素质考核办法) ---------------- */

const PUNISHMENT_CONDUCT_DELTA: Record<string, number> = {
  警告: -10,
  严重警告: -20,
  记过: -30,
  留校察看: -40,
};

/** 处分类型 → 操行分减分;旷课处分另按旷课节数×2计,不重复减分。 */
export function punishmentConductDelta(punishmentType: string): number {
  return PUNISHMENT_CONDUCT_DELTA[punishmentType] ?? 0;
}

/** 旷课1课时减2分;迟到早退减1分。 */
export const ABSENCE_PER_HOUR_DEDUCTION = -2;
export const LATE_EARLY_DEDUCTION = -1;

/* ---------------- 申诉时限(学生申诉处理办法) ---------------- */

/** 接到处理处分决定书之日起10日内提出书面申诉。 */
export const APPEAL_DEADLINE_DAYS = 10;
/** 学申委15日内作出复查结论,经批准可延长15日。 */
export const APPEAL_REVIEW_DAYS = 15;

export function appealReviewDaysGuard(): number {
  return APPEAL_REVIEW_DAYS;
}

export function isAppealInDeadline(decisionDate: string, appealDate: string): boolean {
  const decision = new Date(decisionDate);
  const appeal = new Date(appealDate);
  if (Number.isNaN(decision.getTime()) || Number.isNaN(appeal.getTime())) return false;
  const diffDays = (appeal.getTime() - decision.getTime()) / 86_400_000;
  return diffDays >= 0 && diffDays <= APPEAL_DEADLINE_DAYS;
}

/* ---------------- 综合素质考核(德育30+智育60+体育10) ---------------- */

/** 品德操行量化基础分。 */
export const CONDUCT_BASE_SCORE = 70;
/** 操行分一票否决线。 */
export const CONDUCT_VETO_LINE = 65;
/** 单科成绩一票否决线。 */
export const COURSE_VETO_LINE = 60;

export type EvalInput = {
  /** 操行量化分(基础70 ± 加减分) */
  conductScore: number;
  /** 学年课程平均分 */
  courseAverage: number;
  /** 每门考试课程成绩(用于单科否决线) */
  courseScores: number[];
  /** 学年两次体测是否合格 */
  physicalPasses: [boolean, boolean];
};

export type EvalResult = {
  moralScore: number;
  academicScore: number;
  physicalScore: number;
  totalScore: number;
  vetoReasons: string[];
};

const round1 = (value: number) => Math.round(value * 10) / 10;

/** 总分100 = 德育(操行分×30%) + 智育(课程均分×60%) + 体育(体测两次×5分)。 */
export function comprehensiveEval(input: EvalInput): EvalResult {
  const moralScore = round1(Math.max(0, Math.min(100, input.conductScore)) * 0.3);
  const academicScore = round1(Math.max(0, Math.min(100, input.courseAverage)) * 0.6);
  // 体测一项不合格该项计0分:合格一次5分,两次满分10分。
  const physicalScore = input.physicalPasses.filter(Boolean).length * 5;
  const vetoReasons: string[] = [];
  if (input.conductScore < CONDUCT_VETO_LINE) vetoReasons.push(`操行分${input.conductScore}低于${CONDUCT_VETO_LINE}分`);
  if (input.courseScores.some((score) => score < COURSE_VETO_LINE)) vetoReasons.push("存在单科成绩低于60分");
  if (input.physicalPasses.some((passed) => !passed)) vetoReasons.push("体测存在不合格项");
  return { moralScore, academicScore, physicalScore, totalScore: round1(moralScore + academicScore + physicalScore), vetoReasons };
}

/* ---------------- 表彰奖励参数(学生表彰奖励办法) ---------------- */

export const SCHOLARSHIP_CONFIG = {
  一等奖学金: { ratio: "3%", amount: 1000 },
  二等奖学金: { ratio: "5%", amount: 800 },
  三等奖学金: { ratio: "22%", amount: 500 },
} as const;

export const HONOR_RATIOS: Record<string, string> = {
  三好学生: "学生总数的10%",
  优秀学生干部: "参评学生干部总数的8%",
  校级优秀毕业生: "毕业生总数的5%",
  省级优秀毕业生: "毕业生总数的3%",
  优秀团员: "团员总数的8%",
  优秀团干部: "参评团干部的8%",
  文明宿舍: "学生宿舍总数的15%以内",
  先进区队: "参评区队总数的20%以内",
  先进班: "参评班总数的20%以内",
  先进团支部: "参评团支部总数的15%以内",
};

export const COLLECTIVE_HONOR_BONUS: Record<string, number> = {
  文明宿舍: 200,
  先进班: 200,
  先进区队: 500,
  先进团支部: 500,
};

/** 表彰经院长办公会批准后全校公示天数。 */
export const COMMENDATION_PUBLICITY_DAYS = 5;

/* ---------------- 资助参数(助学金/困难认定/资助经费管理办法) ---------------- */

/** 国家助学金三档,资助名额按在校生数20%确定。 */
export const NATIONAL_GRANT_TIERS = {
  甲档: { amount: 4500, hardshipLevel: "特别困难" },
  乙档: { amount: 3000, hardshipLevel: "困难" },
  丙档: { amount: 2000, hardshipLevel: "一般困难" },
} as const;

export const NATIONAL_GRANT_QUOTA_RATIO = "在校生数的20%";

/** 国家励志奖学金:约占在校生3%,每人每年5000元,需综合素质前35%且获三等以上奖学金。 */
export const ENDEAVOR_SCHOLARSHIP = { amount: 5000, ratio: "在校生数的3%" } as const;

/** 特别困难补助两个等级。 */
export const HARDSHIP_SUBSIDY = { 一等: 2000, 二等: 1000 } as const;

/** 校内无息借款每生每年上限。 */
export const CAMPUS_LOAN_LIMIT = 3000;

/** 困难认定三档(认定结果作为奖助学金评定依据)。 */
export const HARDSHIP_LEVELS = ["特别困难", "困难", "一般困难"] as const;

/* ---------------- 考勤参数(学生考勤管理办法) ---------------- */

/** 考勤六种类型。 */
export const ATTENDANCE_TYPES = ["出勤", "迟到", "早退", "旷课", "病假", "事假"] as const;

/** 课前集队时间。 */
export const MORNING_ASSEMBLY = "8:10";
export const AFTERNOON_ASSEMBLY = "13:40";
/** 周五至周日晚点名时段,按1课时考勤。 */
export const EVENING_ROLLCALL_SLOT = "19:00-19:30";
/** 学习日区队事假人数上限比例。 */
export const DAILY_LEAVE_RATIO_LIMIT = 0.05;
