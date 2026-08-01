import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";

const code = (prefix, s) => prefix + createHash("sha1").update(String(s)).digest("hex").slice(0, 8);

/**
 * Derive the faculty → major → class reference hierarchy from the students
 * table so the cascading dropdowns in the student form have real data.
 * Codes are deterministic per name, so re-runs are idempotent and parent
 * links stay consistent.
 */
export async function seedOrgHierarchy(client) {
  const { rows } = await client.query(
    `select faculty, major, class_name, grade from students where faculty <> '' order by faculty, major, class_name`,
  );

  const facCodes = new Map();
  for (const f of [...new Set(rows.map((r) => r.faculty))]) facCodes.set(f, code("fac-", f));
  for (const [f, c] of facCodes) {
    await client.query(
      `insert into managed_items (id, feature_id, code, name, parent_code, sort_order, status, data_json)
       values ($1, 'faculty-admin', $2, $3, null, 0, '启用', '{}')
       on conflict (feature_id, code) where code <> '' do nothing`,
      [randomUUID(), c, f],
    );
  }

  const majCodes = new Map();
  for (const r of new Map(rows.map((r) => [`${r.faculty}|${r.major}`, r])).values()) {
    const key = `${r.faculty}|${r.major}`;
    const c = code("maj-", key);
    majCodes.set(key, c);
    await client.query(
      `insert into managed_items (id, feature_id, code, name, parent_code, sort_order, status, data_json)
       values ($1, 'major-admin', $2, $3, $4, 0, '启用', '{}')
       on conflict (feature_id, code) where code <> '' do nothing`,
      [randomUUID(), c, r.major, facCodes.get(r.faculty)],
    );
  }

  for (const r of rows) {
    const mkey = `${r.faculty}|${r.major}`;
    const c = code("cls-", `${mkey}|${r.class_name}`);
    await client.query(
      `insert into managed_items (id, feature_id, code, name, parent_code, sort_order, status, data_json)
       values ($1, 'class-admin', $2, $3, $4, 0, '启用', $5)
       on conflict (feature_id, code) where code <> '' do nothing`,
      [randomUUID(), c, r.class_name, majCodes.get(mkey), JSON.stringify({ grade: r.grade || "" })],
    );
  }

  const counts = await client.query(
    `select feature_id, count(*)::int as n from managed_items
     where feature_id in ('faculty-admin','major-admin','class-admin') group by feature_id`,
  );
  return counts.rows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL.trim() });
  await client.connect();
  try {
    const counts = await seedOrgHierarchy(client);
    console.log("[seed-org-hierarchy]", JSON.stringify(counts));
  } finally {
    await client.end();
  }
}
