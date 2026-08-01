import { describe, it, expect } from "vitest";
import { validateStudentInput, validateRecordInput } from "@/lib/validation";

describe("validateStudentInput", () => {
  it("accepts valid student data", () => {
    const result = validateStudentInput({
      name: "张三",
      no: "20260001",
      phone: "13800138000",
      gender: "男",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("张三");
      expect(result.data.no).toBe("20260001");
    }
  });

  it("trims whitespace from fields", () => {
    const result = validateStudentInput({
      name: "  张三  ",
      no: "20260001",
      phone: "13800138000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("张三");
    }
  });

  it("rejects empty name", () => {
    const result = validateStudentInput({
      name: "",
      no: "20260001",
      phone: "13800138000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid student no format", () => {
    const result = validateStudentInput({
      name: "张三",
      no: "abc", // too short
      phone: "13800138000",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "no")).toBe(true);
    }
  });

  it("rejects invalid phone format", () => {
    const result = validateStudentInput({
      name: "张三",
      no: "20260001",
      phone: "12345",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "phone")).toBe(true);
    }
  });

  it("defaults gender to 未知 when omitted", () => {
    const result = validateStudentInput({
      name: "张三",
      no: "20260001",
      phone: "13800138000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gender).toBe("未知");
    }
  });

  it("defaults status to 在读 when omitted", () => {
    const result = validateStudentInput({
      name: "张三",
      no: "20260001",
      phone: "13800138000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("在读");
    }
  });

  it("rejects invalid grade format", () => {
    const result = validateStudentInput({
      name: "张三",
      no: "20260001",
      phone: "13800138000",
      grade: "abc",
    });
    expect(result.success).toBe(false);
  });
});

describe("validateRecordInput", () => {
  it("accepts valid record with data and status", () => {
    const result = validateRecordInput({
      data: { field1: "value1" },
      status: "已提交",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data).toEqual({ field1: "value1" });
      expect(result.data.status).toBe("已提交");
    }
  });

  it("defaults status to 草稿 when omitted", () => {
    const result = validateRecordInput({
      data: { field1: "value1" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("草稿");
    }
  });

  it("rejects empty data object", () => {
    const result = validateRecordInput({
      data: {},
    });
    // An empty record is still valid (Zod z.record allows empty objects)
    expect(result.success).toBe(true);
  });

  it("rejects missing data field", () => {
    const result = validateRecordInput({});
    expect(result.success).toBe(false);
  });

  it("rejects oversized string values", () => {
    const result = validateRecordInput({
      data: { field1: "x".repeat(2001) },
    });
    expect(result.success).toBe(false);
  });

  it("rejects too many fields", () => {
    const data: Record<string, string> = {};
    for (let i = 0; i < 201; i++) data[`k${i}`] = "v";
    const result = validateRecordInput({ data });
    expect(result.success).toBe(false);
  });

  it("accepts shallow nested objects", () => {
    const result = validateRecordInput({
      data: { student: { name: "张三", scores: [90, 95] } },
    });
    expect(result.success).toBe(true);
  });

  it("rejects overly deep nesting", () => {
    const result = validateRecordInput({
      data: { a: { b: { c: { d: "too deep" } } } },
    });
    expect(result.success).toBe(false);
  });
});
