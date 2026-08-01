import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("缺少 DATABASE_URL");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
try {
  await migrate(drizzle(pool), { migrationsFolder: resolve(process.cwd(), "drizzle-postgres") });
  console.log("PostgreSQL 数据库迁移完成");
} finally {
  await pool.end();
}
