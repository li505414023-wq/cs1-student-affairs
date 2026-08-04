import { describe, expect, it } from "vitest";
import {
  absencePunishment,
  absenceWarningLevel,
  APPEAL_DEADLINE_DAYS,
  appealReviewDaysGuard,
  comprehensiveEval,
  CONDUCT_BASE_SCORE,
  isAppealInDeadline,
  leaveApprovalChain,
  leaveChainValid,
  punishmentConductDelta,
  SCHOLARSHIP_CONFIG,
  NATIONAL_GRANT_TIERS,
} from "@/lib/handbook-rules";

describe("请假分级审批链(考勤管理办法第八条)", () => {
  it("一天以内由区队指导员批准", () => {
    expect(leaveApprovalChain(1)).toBe("区队指导员");
    expect(leaveApprovalChain(0.5)).toBe("区队指导员");
  });
  it("一天以上三天以内需大队长批准", () => {
    expect(leaveApprovalChain(2)).toBe("区队指导员→大队长");
  });
  it("三天以上一周以内需系部主任批准", () => {
    expect(leaveApprovalChain(5)).toBe("区队指导员→大队长→系部主任");
  });
  it("一周以上一月以内需分管院领导批准", () => {
    expect(leaveApprovalChain(15)).toBe("区队指导员→大队长→系部主任→分管院领导");
  });
  it("一月以上三月以内需院长批准", () => {
    expect(leaveApprovalChain(60)).toBe("区队指导员→大队长→系部主任→分管院领导→院长");
  });
  it("超过三个月不允许请假", () => {
    expect(leaveApprovalChain(91)).toBe("");
    expect(leaveChainValid(91)).toBe(false);
    expect(leaveChainValid(90)).toBe(true);
  });
  it("校内因公请假由系部主任审批", () => {
    expect(leaveApprovalChain(2, true)).toBe("系部主任(校内因公)");
  });
});

describe("旷课累计处分与预警", () => {
  it("10/20/30/40课时分别对应警告/严重警告/记过/留校察看", () => {
    expect(absencePunishment(9)).toBeNull();
    expect(absencePunishment(10)).toBe("警告");
    expect(absencePunishment(20)).toBe("严重警告");
    expect(absencePunishment(30)).toBe("记过");
    expect(absencePunishment(45)).toBe("留校察看");
  });
  it("预警等级随课时递增", () => {
    expect(absenceWarningLevel(5)).toBeNull();
    expect(absenceWarningLevel(6)).toBe("预警");
    expect(absenceWarningLevel(10)).toBe("严重预警");
    expect(absenceWarningLevel(30)).toBe("高危");
  });
});

describe("处分与操行分联动", () => {
  it("按处分等级减10/20/30/40分", () => {
    expect(punishmentConductDelta("警告")).toBe(-10);
    expect(punishmentConductDelta("严重警告")).toBe(-20);
    expect(punishmentConductDelta("记过")).toBe(-30);
    expect(punishmentConductDelta("留校察看")).toBe(-40);
    expect(punishmentConductDelta("开除学籍")).toBe(0);
  });
});

describe("申诉时限(申诉处理办法)", () => {
  it("10日内申诉有效", () => {
    expect(APPEAL_DEADLINE_DAYS).toBe(10);
    expect(isAppealInDeadline("2026-07-01", "2026-07-11")).toBe(true);
    expect(isAppealInDeadline("2026-07-01", "2026-07-12")).toBe(false);
    expect(isAppealInDeadline("2026-07-01", "2026-06-30")).toBe(false);
    expect(isAppealInDeadline("无效日期", "2026-07-05")).toBe(false);
    expect(appealReviewDaysGuard()).toBe(15);
  });
});

describe("综合素质考核(德育30+智育60+体育10)", () => {
  it("基础70操行、均分80、两次体测合格 → 21+48+10=79", () => {
    const result = comprehensiveEval({
      conductScore: CONDUCT_BASE_SCORE,
      courseAverage: 80,
      courseScores: [80, 82],
      physicalPasses: [true, true],
    });
    expect(result.moralScore).toBe(21);
    expect(result.academicScore).toBe(48);
    expect(result.physicalScore).toBe(10);
    expect(result.totalScore).toBe(79);
    expect(result.vetoReasons).toHaveLength(0);
  });
  it("体测一项不合格该项计0分", () => {
    const result = comprehensiveEval({
      conductScore: 70, courseAverage: 80, courseScores: [80], physicalPasses: [true, false],
    });
    expect(result.physicalScore).toBe(5);
    expect(result.vetoReasons).toContain("体测存在不合格项");
  });
  it("三条一票否决线", () => {
    const result = comprehensiveEval({
      conductScore: 64, courseAverage: 70, courseScores: [59], physicalPasses: [false, true],
    });
    expect(result.vetoReasons).toHaveLength(3);
  });
});

describe("表彰奖励与资助参数", () => {
  it("奖学金比例3%/5%/22%与金额1000/800/500", () => {
    expect(SCHOLARSHIP_CONFIG.一等奖学金).toEqual({ ratio: "3%", amount: 1000 });
    expect(SCHOLARSHIP_CONFIG.二等奖学金).toEqual({ ratio: "5%", amount: 800 });
    expect(SCHOLARSHIP_CONFIG.三等奖学金).toEqual({ ratio: "22%", amount: 500 });
  });
  it("国家助学金三档4500/3000/2000对应困难认定三档", () => {
    expect(NATIONAL_GRANT_TIERS.甲档.amount).toBe(4500);
    expect(NATIONAL_GRANT_TIERS.乙档.amount).toBe(3000);
    expect(NATIONAL_GRANT_TIERS.丙档.amount).toBe(2000);
    expect(NATIONAL_GRANT_TIERS.甲档.hardshipLevel).toBe("特别困难");
  });
});
