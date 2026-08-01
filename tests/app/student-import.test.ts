import { describe, it, expect } from "vitest";
import { parseCsv, validateStudentRows, createStudentTemplateCsv } from "@/app/student-import.js";

describe("parseCsv", () => {
  it("parses simple CSV without quotes", () => {
    const result = parseCsv("姓名,学号\n张三,20260001");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(["姓名", "学号"]);
    expect(result[1]).toEqual(["张三", "20260001"]);
  });

  it("handles quoted fields with commas inside", () => {
    const result = parseCsv('名称,描述\n"A,B",测试');
    expect(result[0][0]).toBe("名称");
    expect(result[1][0]).toBe("A,B");
  });

  it("handles BOM at the start of file", () => {
    const result = parseCsv("﻿姓名,学号\n张三,20260001");
    expect(result[0]).toEqual(["姓名", "学号"]);
  });

  it("handles CRLF line endings", () => {
    const result = parseCsv("姓名,学号\r\n张三,20260001");
    expect(result).toHaveLength(2);
  });

  it("skips empty lines", () => {
    const result = parseCsv("姓名,学号\n\n张三,20260001\n");
    expect(result).toHaveLength(2);
  });

  it("handles escaped double quotes", () => {
    const result = parseCsv('名称\n"他说""你好"""');
    expect(result[1][0]).toBe('他说"你好"');
  });
});

describe("validateStudentRows", () => {
  // Required columns from REQUIRED_STUDENT_COLUMNS: 学号, 姓名, 性别, 院系名称, 专业名称, 班级名称, 入学年级, 出生日期, 民族, 学制, 移动电话
  it("validates correct student data", () => {
    const rows = [
      ["姓名", "学号", "移动电话", "性别", "院系名称", "专业名称", "班级名称", "入学年级", "出生日期", "民族", "学制"],
      ["张三", "20260001", "13800138000", "男", "信息工程学院", "软件技术", "软件2601", "2026", "2000-01-01", "汉族", "3"],
    ];
    const result = validateStudentRows(rows);
    expect(result.errors).toHaveLength(0);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0]["姓名"]).toBe("张三");
  });

  it("reports missing required columns", () => {
    const rows = [
      ["姓名", "学号"],
      ["张三", "20260001"],
    ];
    const result = validateStudentRows(rows);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("reports empty header row", () => {
    const result = validateStudentRows([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("reports duplicate student numbers", () => {
    const headerRow = ["姓名", "学号", "移动电话", "性别", "院系名称", "专业名称", "班级名称", "入学年级", "出生日期", "民族", "学制"];
    const rows = [
      headerRow,
      ["张三", "20260001", "13800138000", "男", "信息工程学院", "软件技术", "软件2601", "2026", "2000-01-01", "汉族", "3"],
      ["李四", "20260001", "13900139000", "女", "商学院", "电子商务", "电商2501", "2025", "2001-02-02", "汉族", "3"],
    ];
    const result = validateStudentRows(rows);
    expect(result.errors.length).toBeGreaterThan(0);
    const hasDuplicateError = result.errors.some((e: { message: string }) => e.message.includes("重复学号"));
    expect(hasDuplicateError).toBe(true);
  });

  it("skips empty data rows", () => {
    const rows = [
      ["姓名", "学号", "移动电话", "性别", "院系名称", "专业名称", "班级名称", "入学年级", "出生日期", "民族", "学制"],
      [],
      ["张三", "20260001", "13800138000", "男", "信息工程学院", "软件技术", "软件2601", "2026", "2000-01-01", "汉族", "3"],
    ];
    const result = validateStudentRows(rows);
    // The empty row doesn't count as valid. Row 2 should be valid since it has all required fields
    expect(result.validRows).toHaveLength(1);
  });
});

describe("createStudentTemplateCsv", () => {
  it("includes header row with all required columns", () => {
    const csv = createStudentTemplateCsv();
    expect(csv).toContain("姓名");
    expect(csv).toContain("学号");
    expect(csv).toContain("移动电话");
    expect(csv).toContain("性别");
  });

  it("includes at least one example row", () => {
    const csv = createStudentTemplateCsv();
    const lines = csv.trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});
