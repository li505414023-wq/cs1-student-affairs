import { describe, expect, it } from "vitest";
import { corpsForFaculties, enrichRecordData, validateEntityUniqueness, validateRecordBusiness } from "@/lib/records-hooks";
import type { getDb } from "@/db";

type Db = ReturnType<typeof getDb>;

describe("请假记录补全:审批链", () => {
  it("按请假天数写入手册审批链", () => {
    const data = enrichRecordData("leave", { 姓名: "测试", 请假天数: "2" });
    expect(data["审批链"]).toBe("区队指导员→大队长");
  });
  it("无天数时由起止时间推算(含首尾两天)", () => {
    const data = enrichRecordData("leave", { 开始时间: "2026-09-01", 结束时间: "2026-09-05" });
    expect(data["请假天数"]).toBe("5");
    expect(data["审批链"]).toBe("区队指导员→大队长→系部主任");
  });
  it("公假按校内因公由系部主任审批", () => {
    const data = enrichRecordData("leave", { 请假类型: "公假", 请假天数: "2" });
    expect(data["审批链"]).toBe("系部主任(校内因公)");
  });
  it("非请假功能原样返回", () => {
    const input = { 姓名: "测试" };
    expect(enrichRecordData("complaints", input)).toBe(input);
  });
});

describe("业务前置校验", () => {
  it("请假超过90天拒绝", () => {
    expect(validateRecordBusiness("leave", { 请假天数: "91" })).toMatch("休学");
    expect(validateRecordBusiness("leave", { 请假天数: "90" })).toBeNull();
  });
  it("申诉超过10日时限拒绝", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(validateRecordBusiness("appeal", { 处分决定书日期: "2020-01-01" })).toMatch("申诉时限");
    expect(validateRecordBusiness("appeal", { 处分决定书日期: today })).toBeNull();
  });
  it("学籍异动类型白名单", () => {
    expect(validateRecordBusiness("status-change", { 异动类型: "休学" })).toBeNull();
    expect(validateRecordBusiness("status-change", { 异动类型: "跳级" })).toMatch("异动类型不正确");
    expect(validateRecordBusiness("status-change", {})).toBeNull();
  });
});

describe("大队唯一性与所属大队推导", () => {
  it("非大队实体或无系部时不触发唯一性校验", async () => {
    const db = null as unknown as Db; // 短路分支不会访问数据库
    await expect(validateEntityUniqueness("faculty-admin", "fac-x", db)).resolves.toBeNull();
    await expect(validateEntityUniqueness("corps-admin", null, db)).resolves.toBeNull();
    await expect(validateEntityUniqueness("corps-admin", "", db)).resolves.toBeNull();
  });
  it("无院系名称时返回空映射", async () => {
    const db = null as unknown as Db;
    await expect(corpsForFaculties(db, [])).resolves.toEqual(new Map());
    await expect(corpsForFaculties(db, ["", ""])).resolves.toEqual(new Map());
  });
});
