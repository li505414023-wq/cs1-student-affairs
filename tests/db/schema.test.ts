import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("db schema", () => {
  const schema = readFileSync("db/schema.ts", "utf-8");

  it("defines at least 7 PostgreSQL tables", () => {
    const tableMatches = schema.match(/export const \w+ = pgTable\(/g);
    expect(tableMatches).not.toBeNull();
    expect(tableMatches!.length).toBeGreaterThanOrEqual(13);
  });

  it("has expected table names", () => {
    const expectedTables = ["users", "sessions", "students", "business_records", "workflow_forms", "workflow_models", "workflow_deployments", "workflow_instances", "workflow_tasks", "workflow_event_log", "notifications", "counselor_classes", "audit_logs"];
    for (const table of expectedTables) {
      expect(schema).toContain(`"${table}"`);
    }
  });

  it("uses PostgreSQL-specific types (jsonb, timestamp)", () => {
    expect(schema).toContain("jsonb");
    expect(schema).toContain("timestamp");
  });

  it("defines indexes for performance", () => {
    expect(schema).toContain("uniqueIndex");
    expect(schema).toContain("index(");
  });
});

describe("drizzle config", () => {
  const config = readFileSync("drizzle.config.ts", "utf-8");

  it("uses PostgreSQL dialect", () => {
    expect(config).toContain("postgresql");
  });
});
