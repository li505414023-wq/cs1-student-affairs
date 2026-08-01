import Database from "better-sqlite3";
import { resolve } from "node:path";
import pg from "pg";
import { parseSqliteJson, postgresJson, sqliteBoolean, sqliteTimestamp } from "../lib/sqlite-postgres-migration.js";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("缺少 DATABASE_URL");

const sourcePath = resolve(process.cwd(), process.env.SQLITE_SOURCE_PATH ?? "data/xuegong.db");
const sqlite = new Database(sourcePath, { readonly: true, fileMustExist: true });
const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });

const tables = [
  {
    name: "users",
    columns: ["id", "username", "display_name", "password_hash", "role", "active", "created_at", "updated_at"],
    values: (row) => [row.id, row.username, row.display_name, row.password_hash, row.role, sqliteBoolean(row.active), sqliteTimestamp(row.created_at), sqliteTimestamp(row.updated_at)],
  },
  {
    name: "sessions",
    columns: ["id", "token_hash", "user_id", "csrf_token", "expires_at", "last_seen_at", "created_at"],
    values: (row) => [row.id, row.token_hash, row.user_id, row.csrf_token, sqliteTimestamp(row.expires_at), sqliteTimestamp(row.last_seen_at), sqliteTimestamp(row.created_at)],
  },
  {
    name: "students",
    columns: ["id", "name", "no", "phone", "gender", "faculty", "major", "class_name", "grade", "birth_date", "address", "status", "created_by", "created_at", "updated_at"],
    values: (row) => [row.id, row.name, row.no, row.phone, row.gender, row.faculty, row.major, row.class_name, row.grade, row.birth_date, row.address, row.status, row.created_by, sqliteTimestamp(row.created_at), sqliteTimestamp(row.updated_at)],
  },
  {
    name: "business_records",
    columns: ["id", "feature_id", "data_json", "status", "created_by", "created_at", "updated_at"],
    values: (row) => [row.id, row.feature_id, postgresJson(parseSqliteJson(row.data_json, "business_records.data_json")), row.status, row.created_by, sqliteTimestamp(row.created_at), sqliteTimestamp(row.updated_at)],
  },
  {
    name: "workflow_forms",
    columns: ["id", "key", "name", "type", "status", "fields_json", "created_at", "updated_at"],
    values: (row) => [row.id, row.key, row.name, row.type, row.status, postgresJson(parseSqliteJson(row.fields_json, "workflow_forms.fields_json")), sqliteTimestamp(row.created_at), sqliteTimestamp(row.updated_at)],
  },
  {
    name: "workflow_models",
    columns: ["id", "key", "name", "category", "description", "form_id", "version", "status", "nodes_json", "created_at", "updated_at"],
    values: (row) => [row.id, row.key, row.name, row.category, row.description, row.form_id, row.version, row.status, postgresJson(parseSqliteJson(row.nodes_json, "workflow_models.nodes_json")), sqliteTimestamp(row.created_at), sqliteTimestamp(row.updated_at)],
  },
  {
    name: "workflow_deployments",
    columns: ["id", "model_key", "model_name", "category", "version", "status", "deployed_at", "deployed_by"],
    values: (row) => [row.id, row.model_key, row.model_name, row.category, row.version, row.status, sqliteTimestamp(row.deployed_at), row.deployed_by],
  },
  {
    name: "audit_logs",
    columns: ["id", "user_id", "action", "resource_type", "resource_id", "detail_json", "ip", "created_at"],
    values: (row) => [row.id, row.user_id, row.action, row.resource_type, row.resource_id, postgresJson(parseSqliteJson(row.detail_json, "audit_logs.detail_json")), row.ip, sqliteTimestamp(row.created_at)],
  },
];

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout = 0");

  const sourceCounts = {};
  for (const table of tables) {
    const sourceRows = sqlite.prepare(`select * from ${table.name}`).all();
    sourceCounts[table.name] = sourceRows.length;
    const targetCount = Number((await client.query(`select count(*)::integer as count from ${table.name}`)).rows[0].count);
    if (targetCount !== 0) throw new Error(`目标表 ${table.name} 不是空表，已取消迁移`);

    const placeholders = table.columns.map((_, index) => `$${index + 1}`).join(", ");
    const insertSql = `insert into ${table.name} (${table.columns.join(", ")}) values (${placeholders})`;
    for (const row of sourceRows) await client.query(insertSql, table.values(row));
  }

  for (const table of tables) {
    const targetCount = Number((await client.query(`select count(*)::integer as count from ${table.name}`)).rows[0].count);
    if (targetCount !== sourceCounts[table.name]) {
      throw new Error(`表 ${table.name} 迁移数量不一致：源 ${sourceCounts[table.name]}，目标 ${targetCount}`);
    }
  }

  await client.query("COMMIT");
  console.log(JSON.stringify({ sourcePath, migrated: sourceCounts }, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  sqlite.close();
  await pool.end();
}
