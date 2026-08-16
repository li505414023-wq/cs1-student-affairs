import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { hashPassword } from "./hash-password.mjs";
import { createTestDataset, extractFeatureIds } from "../lib/test-data-generator.js";
import { seedOrgHierarchy } from "./seed-org-hierarchy.mjs";
import { REAL_WORKFLOW_MODELS } from "./workflow-model-definitions.mjs";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("缺少 DATABASE_URL");

const seed = process.env.TEST_DATA_SEED?.trim() || randomBytes(12).toString("hex");
const studentCount = Number(process.env.TEST_DATA_STUDENTS ?? 500);
const recordsPerFeature = Number(process.env.TEST_DATA_RECORDS_PER_FEATURE ?? 8);
const testPassword = process.env.TEST_USER_PASSWORD;
if (!testPassword || testPassword.length < 12) throw new Error("TEST_USER_PASSWORD 至少需要 12 个字符");

const source = await readFile(resolve(process.cwd(), "app/system-data.ts"), "utf8");
const featureIds = extractFeatureIds(source);
if (featureIds.length !== 119) throw new Error(`功能入口数量异常：预期 119，实际 ${featureIds.length}`);

// 菜单减负后收进域页面 Tab 的子功能（与 app/domain-tabs.ts 保持同步）：
// 导航不再平铺，但仍是独立的 records featureId，需要生成演示数据。
const domainSubFeatures = [
  "scholarship-type", "scholarship-batch", "scholarship-mutex",
  "grant-type", "grant-batch", "grant-mutex",
  "hardship-type", "hardship-batch",
  "honor-type", "honor-batch", "personal-honor", "collective-honor",
  "dorm-transfer", "dorm-checkout", "holiday-dorm", "delayed-checkout",
  "faculty-checkin-stats", "class-checkin-stats", "live-checkin-stats",
  "supplies-stats", "transport-stats", "payment-stats", "step-stats", "nation-stats", "welcome-dorm-stats",
];

const dataset = createTestDataset({ seed, featureIds: [...new Set([...featureIds, ...domainSubFeatures])], studentCount, recordsPerFeature });

// 真实学生申请流程（与 seed-workflow-models.mjs 同源）：保证演示环境能真正发起请假/住宿等申请。
for (const model of REAL_WORKFLOW_MODELS) {
  if (!dataset.workflowForms.some((form) => form.key === model.formKey)) {
    dataset.workflowForms.push({ id: `real-${model.formKey}`, key: model.formKey, name: model.formName, type: "内置表单", status: "启用", fields: model.fields });
  }
  if (!dataset.workflowModels.some((existing) => existing.key === model.modelKey)) {
    dataset.workflowModels.push({
      id: `real-model-${model.modelKey}`, key: model.modelKey, name: model.modelName, category: model.category,
      description: model.description, formId: `real-${model.formKey}`, version: 1, status: "已部署", nodes: model.nodes,
    });
    dataset.workflowDeployments.push({
      id: `real-deploy-${model.modelKey}`, modelKey: model.modelKey, modelName: model.modelName, category: model.category,
      version: 1, status: "激活", deployedAt: new Date(Date.UTC(2026, 6, 19)).toISOString(),
    });
  }
}
const userPasswordHashes = await Promise.all(dataset.users.map(() => hashPassword(testPassword)));
const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  const admin = (await client.query("select id from users where role = 'admin' order by created_at limit 1")).rows[0];
  if (!admin) throw new Error("未找到管理员账号，请先执行 npm run db:seed");

  for (const table of ["sessions", "audit_logs", "business_records", "students", "workflow_deployments", "workflow_models", "workflow_forms"]) {
    await client.query(`delete from ${table}`);
  }
  await client.query("delete from users where role != 'admin'");

  for (const [index, user] of dataset.users.entries()) {
    await client.query(
      "insert into users (id, username, display_name, password_hash, role, role_tags, active) values ($1, $2, $3, $4, $5, $6, true)",
      [user.id, user.username, user.displayName, userPasswordHashes[index], user.role, user.roleTags ?? []],
    );
  }
  for (const [index, student] of dataset.students.entries()) {
    const createdAt = new Date(Date.UTC(2026, 6, 19) - (index % 365) * 86_400_000);
    // Deterministic 18-digit sample ID card (format-valid; not a real number).
    const idCard = "11010120080101" + String(index).padStart(4, "0");
    await client.query(
      `insert into students (id, name, no, phone, gender, faculty, major, class_name, grade, birth_date, id_card, address, status, created_by, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)`,
      [student.id, student.name, student.no, student.phone, student.gender, student.faculty, student.major, student.className, student.grade, student.birthDate, idCard, student.address, student.status, admin.id, createdAt],
    );
  }
  await seedOrgHierarchy(client);

  for (const [index, record] of dataset.businessRecords.entries()) {
    await client.query(
      "insert into business_records (id, feature_id, data_json, status, created_by, created_at, updated_at) values ($1, $2, $3, $4, $5, $6, $6)",
      [record.id, record.featureId, JSON.stringify(record.data), record.status, dataset.users[index % dataset.users.length].id, new Date(record.createdAt)],
    );
  }
  for (const form of dataset.workflowForms) {
    await client.query(
      "insert into workflow_forms (id, key, name, type, status, fields_json) values ($1, $2, $3, $4, $5, $6)",
      [form.id, form.key, form.name, form.type, form.status, JSON.stringify(form.fields)],
    );
  }
  for (const model of dataset.workflowModels) {
    await client.query(
      "insert into workflow_models (id, key, name, category, description, form_id, version, status, nodes_json) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      [model.id, model.key, model.name, model.category, model.description, model.formId, model.version, model.status, JSON.stringify(model.nodes)],
    );
  }
  for (const deployment of dataset.workflowDeployments) {
    await client.query(
      "insert into workflow_deployments (id, model_key, model_name, category, version, status, deployed_at, deployed_by) values ($1, $2, $3, $4, $5, $6, $7, $8)",
      [deployment.id, deployment.modelKey, deployment.modelName, deployment.category, deployment.version, deployment.status, new Date(deployment.deployedAt), admin.id],
    );
  }
  for (const log of dataset.auditLogs) {
    await client.query(
      "insert into audit_logs (id, user_id, action, resource_type, resource_id, detail_json, ip, created_at) values ($1, $2, $3, $4, $5, $6, 'local-test-generator', $7)",
      [log.id, dataset.users[log.userIndex].id, log.action, log.resourceType, log.resourceId, JSON.stringify(log.detail), new Date(log.createdAt)],
    );
  }

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}

console.log(JSON.stringify({
  seed,
  featureCount: featureIds.length,
  users: dataset.users.length,
  students: dataset.students.length,
  businessRecords: dataset.businessRecords.length,
  workflowForms: dataset.workflowForms.length,
  workflowModels: dataset.workflowModels.length,
  workflowDeployments: dataset.workflowDeployments.length,
  auditLogs: dataset.auditLogs.length,
}, null, 2));
