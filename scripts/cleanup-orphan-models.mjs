/**
 * 清理孤儿流程模型与孤儿表单（幂等）。
 * 背景：dorm-checkin 模型是历史 seed 残留，代码已改用 declare 统一住宿申办，
 * 但数据库里还残留 dorm-checkin 模型、3 个实例、部署记录及 dorm_form 表单。
 * Run: node --env-file=.env.local scripts/cleanup-orphan-models.mjs
 */
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("缺少 DATABASE_URL");

const ORPHAN_MODEL_KEYS = ["dorm-checkin"];

const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
try {
  await pool.query("BEGIN");
  for (const key of ORPHAN_MODEL_KEYS) {
    // 1. 实例事件日志（workflow_event_log.instance_id 无外键，需手动删）
    const log = await pool.query(
      "delete from workflow_event_log where instance_id in (select id from workflow_instances where model_key = $1)",
      [key],
    );
    // 2. 实例（workflow_tasks 通过 onDelete cascade 级联删除）
    const instances = await pool.query("delete from workflow_instances where model_key = $1", [key]);
    // 3. 部署记录
    const deployments = await pool.query("delete from workflow_deployments where model_key = $1", [key]);
    // 4. 模型本体
    const models = await pool.query("delete from workflow_models where key = $1", [key]);
    console.log(
      `${key}: 删日志 ${log.rowCount} / 实例 ${instances.rowCount} / 部署 ${deployments.rowCount} / 模型 ${models.rowCount}`,
    );
  }
  // 5. 清理既无模型引用、也无实例引用的孤儿表单（dorm_form/award_form/leave_form 等历史残留）
  const forms = await pool.query(
    `delete from workflow_forms
     where id not in (select distinct form_id from workflow_models where form_id is not null)
       and id not in (select distinct form_id from workflow_instances where form_id is not null)`,
  );
  console.log(`孤儿表单清理 ${forms.rowCount} 条`);
  await pool.query("COMMIT");
  console.log("清理完成");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}
