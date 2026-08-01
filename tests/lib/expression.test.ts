import { describe, it, expect } from "vitest";
import { evaluate } from "@/lib/workflow/expression";
import type { ExpressionContext } from "@/lib/workflow/types";

function ctx(formData: Record<string, unknown>): ExpressionContext {
  return { formData, user: { id: "u1", role: "admin" } };
}

describe("evaluate", () => {
  it("returns true for empty expression", () => {
    expect(evaluate("", ctx({}))).toBe(true);
    expect(evaluate("   ", ctx({}))).toBe(true);
  });

  it("evaluates numeric comparison with variable reference", () => {
    expect(evaluate("${days} > 3", ctx({ days: "5" }))).toBe(true);
    expect(evaluate("${days} > 3", ctx({ days: "2" }))).toBe(false);
    expect(evaluate("${days} >= 3", ctx({ days: "3" }))).toBe(true);
    expect(evaluate("${days} < 10", ctx({ days: "5" }))).toBe(true);
    expect(evaluate("${days} <= 5", ctx({ days: "5" }))).toBe(true);
  });

  it("evaluates string equality", () => {
    expect(evaluate("${faculty} == '信息工程学院'", ctx({ faculty: "信息工程学院" }))).toBe(true);
    expect(evaluate("${faculty} == '商学院'", ctx({ faculty: "信息工程学院" }))).toBe(false);
    expect(evaluate("${faculty} != '商学院'", ctx({ faculty: "信息工程学院" }))).toBe(true);
  });

  it("evaluates logical AND/OR", () => {
    const context = ctx({ amount: "6000", type: "奖学金" });
    expect(evaluate("${amount} >= 5000 && ${type} == '奖学金'", context)).toBe(true);
    expect(evaluate("${amount} >= 10000 && ${type} == '奖学金'", context)).toBe(false);
    expect(evaluate("${amount} >= 10000 || ${type} == '奖学金'", context)).toBe(true);
  });

  it("handles NOT operator", () => {
    // !"true" = false, !"" = true (empty string is falsy)
    expect(evaluate("!${isAdmin}", ctx({ isAdmin: "true" }))).toBe(false);
    expect(evaluate("!${isEmpty}", ctx({ isEmpty: "" }))).toBe(true);
  });

  it("handles parentheses for grouping", () => {
    const context = ctx({ amount: "6000", type: "助学金" });
    expect(evaluate("(${amount} >= 5000 && ${type} == '奖学金') || (${amount} < 1000)", context)).toBe(false);
    expect(evaluate("(${amount} >= 5000 && ${type} == '助学金') || (${amount} < 1000)", context)).toBe(true);
  });

  it("returns false for malformed expressions", () => {
    expect(evaluate("${missing >", ctx({}))).toBe(false);
  });

  it("treats unknown variables as empty string", () => {
    expect(evaluate("${unknown} == ''", ctx({}))).toBe(true);
  });

  it("handles numeric literal comparison", () => {
    // 5 > 3 → true
    expect(evaluate("5 > 3", ctx({}))).toBe(true);
    expect(evaluate("5 < 3", ctx({}))).toBe(false);
  });
});
