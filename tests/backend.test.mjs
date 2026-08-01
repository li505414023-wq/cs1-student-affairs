import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("hashes passwords with a unique salt and verifies them", async () => {
  const { hashPassword, verifyPassword } = await import("../lib/security.js");
  const first = await hashPassword("Correct-Horse-2026!");
  const second = await hashPassword("Correct-Horse-2026!");

  assert.notEqual(first, second);
  assert.doesNotMatch(first, /Correct-Horse-2026/);
  assert.equal(await verifyPassword("Correct-Horse-2026!", first), true);
  assert.equal(await verifyPassword("wrong-password", first), false);
});

test("enforces role permissions", async () => {
  const { hasPermission } = await import("../lib/security.js");

  assert.equal(hasPermission("admin", "delete"), true);
  assert.equal(hasPermission("staff", "write"), true);
  assert.equal(hasPermission("staff", "admin"), false);
  assert.equal(hasPermission("viewer", "write"), false);
  assert.equal(hasPermission("viewer", "read"), true);
});

test("validates and normalizes student payloads", async () => {
  const { validateStudentInput } = await import("../lib/validation.js");
  const valid = validateStudentInput({
    name: "  顾明澈 ", no: "20260088", phone: "13800001234", gender: "男",
    faculty: "信息工程学院", major: "软件技术", className: "软件2601",
    grade: "2026", birthDate: "2008-03-12", address: "滨湖校区",
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data.name, "顾明澈");

  const invalid = validateStudentInput({ name: "", no: "x", phone: "123" });
  assert.equal(invalid.success, false);
  assert.ok(invalid.errors.length >= 3);
});

test("defines the PostgreSQL production persistence tables", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  for (const table of ["users", "sessions", "students", "business_records", "workflow_forms", "workflow_models", "workflow_deployments", "audit_logs"]) {
    assert.match(schema, new RegExp(`pgTable\\(\\"${table}\\"`));
  }
  assert.match(schema, /uniqueIndex/);
  assert.match(schema, /index/);
  assert.match(schema, /jsonb/);
});

test("exposes authenticated API surfaces without hardcoded credentials", async () => {
  const sources = await Promise.all([
    "../app/api/auth/login/route.ts",
    "../app/api/auth/session/route.ts",
    "../app/api/students/route.ts",
    "../app/api/records/[featureId]/route.ts",
    "../app/api/workflows/route.ts",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const combined = sources.join("\n");

  assert.match(combined, /requirePermission/);
  assert.match(combined, /validateCsrf/);
  assert.doesNotMatch(combined, /password\s*[:=]\s*["'][^"']+["']/i);
});
