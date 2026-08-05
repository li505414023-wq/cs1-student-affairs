import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
