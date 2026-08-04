/**
 * 为学生申请类模块补齐已部署的工作流模型（幂等）。
 * 背景：student-card / club-apply 提交记录时会按 modelKeyForFeature 启动流程，
 * 但线上 workflow_models 缺少对应模型，导致提交后静默停留"已提交"。
 * Run: node --env-file=.env.local scripts/seed-workflow-models.mjs
 */
import { randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("缺少 DATABASE_URL");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });

const standardNodes = [
  { id: "start", name: "开始", type: "start" },
  { id: "submit", name: "申请人提交", type: "submit", assignee: "流程发起人" },
  { id: "approve", name: "辅导员审批", type: "approval", assignee: "辅导员" },
  { id: "end", name: "结束", type: "end" },
];

const models = [
  {
    modelKey: "student-card",
    modelName: "学生证申请",
    category: "学生事务",
    description: "学生证申领/补办申请，辅导员审批。",
    formKey: "form-card",
    formName: "学生证申请表",
    fields: [
      { id: "c1", type: "下拉选择", label: "申请类型", required: true },
      { id: "c2", type: "多行文本", label: "申请说明", required: true },
    ],
    nodes: standardNodes,
  },
  {
    modelKey: "club-apply",
    modelName: "社团申请",
    category: "学生事务",
    description: "社团加入/活动申请，辅导员审批。",
    formKey: "form-club",
    formName: "社团申请表",
    fields: [
      { id: "u1", type: "单行文本", label: "社团名称", required: true },
      { id: "u2", type: "多行文本", label: "申请说明", required: true },
    ],
    nodes: standardNodes,
  },
];

try {
  for (const model of models) {
    // 表单按 key 幂等
    const formRows = await pool.query("select id from workflow_forms where key = $1", [model.formKey]);
    let formId;
    if (formRows.rowCount > 0) {
      formId = formRows.rows[0].id;
      await pool.query("update workflow_forms set name = $2, fields_json = $3, updated_at = now() where id = $1", [formId, model.formName, JSON.stringify(model.fields)]);
    } else {
      formId = `form-${randomUUID().slice(0, 8)}`;
      await pool.query(
        "insert into workflow_forms (id, key, name, type, status, fields_json, created_at, updated_at) values ($1, $2, $3, '内置表单', '启用', $4, now(), now())",
        [formId, model.formKey, model.formName, JSON.stringify(model.fields)],
      );
    }

    // 模型按 key 幂等：已存在则更新为已部署状态，不存在则插入
    const modelRows = await pool.query("select id, version from workflow_models where key = $1", [model.modelKey]);
    let version;
    if (modelRows.rowCount > 0) {
      version = modelRows.rows[0].version;
      await pool.query(
        "update workflow_models set name = $2, category = $3, description = $4, form_id = $5, status = '已部署', nodes_json = $6, updated_at = now() where id = $1",
        [modelRows.rows[0].id, model.modelName, model.category, model.description, formId, JSON.stringify(model.nodes)],
      );
    } else {
      version = 1;
      await pool.query(
        "insert into workflow_models (id, key, name, category, description, form_id, version, status, nodes_json, created_at, updated_at) values ($1, $2, $3, $4, $5, $6, 1, '已部署', $7, now(), now())",
        [randomUUID(), model.modelKey, model.modelName, model.category, model.description, formId, JSON.stringify(model.nodes)],
      );
    }

    // 部署记录按 model_key + version 幂等
    const deployRows = await pool.query("select id from workflow_deployments where model_key = $1 and version = $2", [model.modelKey, version]);
    if (deployRows.rowCount === 0) {
      await pool.query(
        "insert into workflow_deployments (id, model_key, model_name, category, version, status, deployed_at) values ($1, $2, $3, $4, $5, '已部署', now())",
        [randomUUID(), model.modelKey, model.modelName, model.category, version],
      );
    }
    console.log(`✓ ${model.modelKey}（${model.modelName}）已部署，form=${model.formKey}`);
  }

  const check = await pool.query("select key, name, status from workflow_models order by key");
  console.log("当前模型:", check.rows.map((r) => `${r.key}=${r.status}`).join(", "));
} finally {
  await pool.end();
}
