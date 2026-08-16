import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTestDataset, extractFeatureIds } from "../lib/test-data-generator.js";

const systemDataSource = await readFile(new URL("../app/system-data.ts", import.meta.url), "utf8");
const featureIds = extractFeatureIds(systemDataSource);

test("extracts every feature entry from all five systems", () => {
  assert.equal(featureIds.length, 119);
  assert.equal(new Set(featureIds).size, 119);
  for (const expected of ["students", "leave", "card-checkin", "dorm-repair", "morning-exercise", "deployment", "error-log"]) {
    assert.ok(featureIds.includes(expected));
  }
});

test("generates deterministic full-coverage datasets", () => {
  const options = { seed: "fixed-seed", featureIds, studentCount: 40, recordsPerFeature: 3 };
  const first = createTestDataset(options);
  const second = createTestDataset(options);

  assert.deepEqual(first, second);
  assert.equal(first.students.length, 40);
  assert.equal(first.businessRecords.length, featureIds.length * 3);
  assert.equal(new Set(first.students.map((student) => student.no)).size, 40);
  assert.equal(new Set(first.businessRecords.map((record) => record.featureId)).size, featureIds.length);
  // 审批角色齐全：三级评审（辅导员→院系→学校）与住宿申办（宿管）需真实用户认领，
  // 缺院系管理员/宿管员会导致对应审批节点无人认领、退化成 admin 单点审批。
  assert.ok(first.users.some((user) => user.role === "counselor"));
  assert.ok(first.users.some((user) => user.role === "department_admin"));
  assert.ok(first.users.some((user) => user.role === "dorm_manager"));
  assert.ok(first.users.some((user) => user.role === "viewer"));
  assert.ok(first.workflowForms.length >= 8);
  assert.ok(first.workflowModels.length >= 10);
  assert.ok(first.workflowDeployments.length >= 6);
  assert.ok(first.auditLogs.length >= 40);
});

test("uses the seed to produce a different but valid dataset", () => {
  const first = createTestDataset({ seed: "seed-a", featureIds, studentCount: 20, recordsPerFeature: 2 });
  const second = createTestDataset({ seed: "seed-b", featureIds, studentCount: 20, recordsPerFeature: 2 });

  assert.notDeepEqual(first.students, second.students);
  assert.ok(first.students.every((student) => /^TEST\d{8}$/.test(student.no)));
  assert.ok(first.students.every((student) => /^199\d{8}$/.test(student.phone)));
  assert.ok(first.businessRecords.every((record) => record.data && typeof record.data === "object"));
});

test("rejects unsafe generation sizes and empty feature lists", () => {
  assert.throws(() => createTestDataset({ seed: "x", featureIds: [], studentCount: 10, recordsPerFeature: 2 }), /功能/);
  assert.throws(() => createTestDataset({ seed: "x", featureIds, studentCount: 0, recordsPerFeature: 2 }), /学生/);
  assert.throws(() => createTestDataset({ seed: "x", featureIds, studentCount: 10, recordsPerFeature: 1001 }), /记录/);
});
