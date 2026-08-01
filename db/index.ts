import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalDatabase = globalThis as unknown as { xuegongPostgresPool?: Pool };

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL is required");
  return value;
}

export function getPool() {
  if (!globalDatabase.xuegongPostgresPool) {
    const configuredMax = Number(process.env.DATABASE_POOL_SIZE ?? 10);
    const max = Number.isInteger(configuredMax) ? Math.min(30, Math.max(2, configuredMax)) : 10;
    globalDatabase.xuegongPostgresPool = new Pool({
      connectionString: databaseUrl(),
      max,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 30_000,
      application_name: "cs1-web",
    });
  }
  return globalDatabase.xuegongPostgresPool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}
