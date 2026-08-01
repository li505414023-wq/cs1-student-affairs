import { describe, expect, it } from "vitest";
import { idCardTailMatches, isValidIdCard, tail6 } from "@/lib/student-register";

describe("tail6", () => {
  it("takes the last 6 characters upper-cased", () => {
    expect(tail6("11010120080312001X")).toBe("12001X");
    expect(tail6("  110101200803121234  ")).toBe("121234");
  });

  it("handles null/undefined/short input without throwing", () => {
    expect(tail6(null)).toBe("");
    expect(tail6(undefined)).toBe("");
    expect(tail6("123")).toBe("123");
  });
});

describe("isValidIdCard", () => {
  it("accepts 18-digit with numeric or X check digit", () => {
    expect(isValidIdCard("110101200803120011")).toBe(true);
    expect(isValidIdCard("11010120080312001x")).toBe(true);
    expect(isValidIdCard("11010120080312001X")).toBe(true);
  });

  it("accepts legacy 15-digit form", () => {
    expect(isValidIdCard("110101880312123")).toBe(true);
  });

  it("rejects malformed values", () => {
    expect(isValidIdCard("")).toBe(false);
    expect(isValidIdCard("11010120080312001")).toBe(false); // 17 digits
    expect(isValidIdCard("11010120080312001XX")).toBe(false);
    expect(isValidIdCard("abcdefghijklmnopqr")).toBe(false);
    expect(isValidIdCard(null)).toBe(false);
  });
});

describe("idCardTailMatches", () => {
  it("matches on equal last-6 regardless of case", () => {
    expect(idCardTailMatches("11010120080312001x", "11010120080312001X")).toBe(true);
  });

  it("rejects when tails differ", () => {
    expect(idCardTailMatches("110101200803120011", "110101200803129999")).toBe(false);
  });

  it("rejects when either side is empty or malformed (anti-enumeration safe)", () => {
    expect(idCardTailMatches("", "110101200803120011")).toBe(false);
    expect(idCardTailMatches("110101200803120011", null)).toBe(false);
    expect(idCardTailMatches("not-an-id", "110101200803120011")).toBe(false);
    expect(idCardTailMatches("110101200803120011", "not-an-id")).toBe(false);
  });
});
