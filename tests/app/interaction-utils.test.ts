import { describe, it, expect } from "vitest";
import { filterTableRows, createCsv } from "@/app/interaction-utils.js";

describe("filterTableRows", () => {
  const rows = [
    { name: "Alice", department: "Engineering" },
    { name: "Bob", department: "Design" },
    { name: "Charlie", department: "Engineering" },
  ];

  it("returns all rows when no filters applied", () => {
    const result = filterTableRows(rows, {});
    expect(result).toEqual(rows);
    // Immutability check
    expect(result).not.toBe(rows);
  });

  it("filters by exact substring match", () => {
    const result = filterTableRows(rows, { name: "Ali" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alice");
  });

  it("filters case-insensitively", () => {
    const result = filterTableRows(rows, { name: "alice" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alice");
  });

  it("filters by multiple fields (AND logic)", () => {
    const result = filterTableRows(rows, { name: "a", department: "engineering" });
    expect(result).toHaveLength(2); // Alice and Charlie both have "a" and are in Engineering
    expect(result.map((r: { name: string }) => r.name).sort()).toEqual(["Alice", "Charlie"]);
  });

  it("returns empty array when no rows match", () => {
    const result = filterTableRows(rows, { name: "Nobody" });
    expect(result).toHaveLength(0);
  });

  it("does not mutate the source array", () => {
    const original = [...rows];
    filterTableRows(rows, { name: "Bob" });
    expect(rows).toEqual(original);
  });
});

describe("createCsv", () => {
  const columns = ["姓名", "学号"];
  const rows = [
    ["张三", "20260001"],
    ["李四", "20260002"],
  ];

  it("creates CSV with BOM header", () => {
    const csv = createCsv(columns, rows);
    expect(csv).toContain("﻿");
  });

  it("includes column headers", () => {
    const csv = createCsv(columns, rows);
    expect(csv).toContain("姓名,学号");
  });

  it("includes data rows", () => {
    const csv = createCsv(columns, rows);
    expect(csv).toContain("张三,20260001");
    expect(csv).toContain("李四,20260002");
  });

  it("escapes fields containing commas", () => {
    const csv = createCsv(["名称", "描述"], [["A", "包含,逗号"]]);
    expect(csv).toContain('"包含,逗号"');
  });

  it("escapes fields containing double quotes", () => {
    const csv = createCsv(["名称"], [['他说"你好"']]);
    expect(csv).toContain('"他说""你好"""');
  });
});
