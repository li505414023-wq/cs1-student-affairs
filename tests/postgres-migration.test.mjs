import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseSqliteJson,
  postgresJson,
  sqliteBoolean,
  sqliteTimestamp,
} from "../lib/sqlite-postgres-migration.js";

test("converts SQLite scalar values to PostgreSQL values", () => {
  assert.equal(sqliteBoolean(1), true);
  assert.equal(sqliteBoolean(0), false);
  assert.equal(sqliteBoolean(true), true);
  assert.throws(() => sqliteBoolean(2), /boolean/i);

  assert.equal(sqliteTimestamp(1_721_347_200).toISOString(), "2024-07-19T00:00:00.000Z");
  assert.equal(sqliteTimestamp("2026-07-20T01:02:03.000Z").toISOString(), "2026-07-20T01:02:03.000Z");
  assert.throws(() => sqliteTimestamp("not-a-date"), /timestamp/i);
});

test("parses SQLite JSON columns without accepting corrupt data", () => {
  assert.deepEqual(parseSqliteJson('{"name":"测试"}', "detail_json"), { name: "测试" });
  assert.deepEqual(parseSqliteJson('[{"type":"start"}]', "nodes_json"), [{ type: "start" }]);
  assert.throws(() => parseSqliteJson("{broken", "data_json"), /data_json/);
  assert.equal(postgresJson([{ type: "start" }]), '[{"type":"start"}]');
});

test("uses PostgreSQL schema, configuration, and asynchronous query APIs", async () => {
  const [manifest, config, schema, db, routes, service] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../drizzle.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    Promise.all([
      "../lib/auth.ts",
      "../lib/api.ts",
      "../app/api/auth/login/route.ts",
      "../app/api/auth/session/route.ts",
      "../app/api/students/route.ts",
      "../app/api/students/[id]/route.ts",
      "../app/api/records/[featureId]/route.ts",
      "../app/api/workflows/route.ts",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8"))).then((files) => files.join("\n")),
    readFile(new URL("../deploy/cs1.service", import.meta.url), "utf8"),
  ]);

  assert.match(manifest, /"pg"\s*:/);
  assert.match(config, /dialect:\s*"postgresql"/);
  assert.match(config, /DATABASE_URL/);
  assert.match(schema, /drizzle-orm\/pg-core/);
  assert.match(schema, /jsonb\("data_json"\)/);
  assert.match(db, /drizzle-orm\/node-postgres/);
  assert.match(db, /DATABASE_URL/);
  assert.doesNotMatch(routes, /\.run\(\)|\.all\(\)/);
  assert.match(service, /EnvironmentFile=\/etc\/cs1\.env/);
  assert.doesNotMatch(service, /DATABASE_PATH=/);
});
