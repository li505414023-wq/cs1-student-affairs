import { describe, it, expect } from "vitest";
import { parsePagination, queryText, queryParam } from "@/lib/http-utils";

const urlOf = (query: string) => new URL(`https://example.test/api/items?${query}`);

describe("parsePagination", () => {
  it("uses defaults when no params are provided", () => {
    expect(parsePagination(urlOf(""))).toEqual({ page: 1, pageSize: 20 });
  });

  it("parses valid page and pageSize", () => {
    expect(parsePagination(urlOf("page=3&pageSize=15"))).toEqual({ page: 3, pageSize: 15 });
  });

  it("clamps page below 1 to 1", () => {
    expect(parsePagination(urlOf("page=0")).page).toBe(1);
    expect(parsePagination(urlOf("page=-3")).page).toBe(1);
  });

  it("falls back to page 1 for non-numeric values", () => {
    expect(parsePagination(urlOf("page=abc")).page).toBe(1);
    expect(parsePagination(urlOf("page=")).page).toBe(1);
  });

  it("clamps pageSize to the 1..100 range by default", () => {
    expect(parsePagination(urlOf("pageSize=0")).pageSize).toBe(20); // falsy → default
    expect(parsePagination(urlOf("pageSize=-5")).pageSize).toBe(1); // Math.max(1, -5) → 1,与原有 clamp 语义一致
    expect(parsePagination(urlOf("pageSize=500")).pageSize).toBe(100);
    expect(parsePagination(urlOf("pageSize=abc")).pageSize).toBe(20);
    expect(parsePagination(urlOf("pageSize=1")).pageSize).toBe(1);
    expect(parsePagination(urlOf("pageSize=100")).pageSize).toBe(100);
  });

  it("honors custom defaultPageSize", () => {
    expect(parsePagination(urlOf(""), { defaultPageSize: 50 })).toEqual({ page: 1, pageSize: 50 });
    expect(parsePagination(urlOf("pageSize=abc"), { defaultPageSize: 30 })).toEqual({ page: 1, pageSize: 30 });
    expect(parsePagination(urlOf("pageSize=10"), { defaultPageSize: 50 })).toEqual({ page: 1, pageSize: 10 });
  });

  it("honors custom maxPageSize", () => {
    expect(parsePagination(urlOf("pageSize=90"), { maxPageSize: 50 })).toEqual({ page: 1, pageSize: 50 });
    expect(parsePagination(urlOf("pageSize=200"), { maxPageSize: 200 })).toEqual({ page: 1, pageSize: 200 });
  });
});

describe("queryText", () => {
  it("returns the trimmed value when present", () => {
    expect(queryText(urlOf("keyword=%20%20abc%20"), "keyword")).toBe("abc");
  });

  it("returns fallback for missing, empty, or whitespace-only values", () => {
    expect(queryText(urlOf(""), "keyword")).toBe("");
    expect(queryText(urlOf("keyword="), "keyword")).toBe("");
    expect(queryText(urlOf("keyword=%20%20"), "keyword", "fallback")).toBe("fallback");
  });
});

describe("queryParam", () => {
  it("returns raw value or null", () => {
    expect(queryParam(urlOf("role=counselor"), "role")).toBe("counselor");
    expect(queryParam(urlOf(""), "role")).toBeNull();
  });
});
