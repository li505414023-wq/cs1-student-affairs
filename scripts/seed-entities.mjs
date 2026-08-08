/**
 * Idempotent seed for managed_items (entity engine features).
 * Faculties/majors/classes are extracted from the real students table;
 * dictionaries, posts, flow categories, and content entries are examples.
 *
 * Run: node --env-file=/etc/cs1.env scripts/seed-entities.mjs   (or .env.local in dev)
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { seedOrgHierarchy } from "./seed-org-hierarchy.mjs";
import { LEAVE_TYPES } from "../lib/dictionaries.js";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("缺少 DATABASE_URL");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });

const INSERT = `
  insert into managed_items (id, feature_id, code, name, description, parent_code, sort_order, status, data_json)
  values ($1, $2, $3, $4, $5, $6, $7, '启用', $8)
  on conflict (feature_id, code) where code <> '' do nothing
`;

async function put(featureId, code, name, { description = "", parentCode = null, sort = 0, data = {} } = {}) {
  await pool.query(INSERT, [randomUUID(), featureId, code, name, description, parentCode, sort, JSON.stringify(data)]);
}

try {
  // ---- 学院/专业/班级:委托给 seed-org-hierarchy(确定性哈希码,避免重复) ----
  const client = await pool.connect();
  try {
    await seedOrgHierarchy(client);
  } finally {
    client.release();
  }

  // ---- 系统字典:字典 + 字典项 ----
  await put("system-dict", "GENDER", "性别", { sort: 1 });
  await put("system-dict", "GENDER_M", "男", { parentCode: "GENDER", sort: 1, data: { value: "男" } });
  await put("system-dict", "GENDER_F", "女", { parentCode: "GENDER", sort: 2, data: { value: "女" } });
  await put("system-dict", "POLITICAL", "政治面貌", { sort: 2 });
  for (const [index, value] of ["群众", "共青团员", "中共预备党员", "中共党员"].entries()) {
    await put("system-dict", `POLITICAL_${index + 1}`, value, { parentCode: "POLITICAL", sort: index + 1, data: { value } });
  }

  // ---- 业务字典 ----
  await put("business-dict", "LEAVE_TYPE", "请假类型", { sort: 1 });
  for (const [index, value] of LEAVE_TYPES.entries()) {
    await put("business-dict", `LEAVE_TYPE_${index + 1}`, value, { parentCode: "LEAVE_TYPE", sort: index + 1, data: { value } });
  }

  // ---- 机构 / 岗位 ----
  await put("org-admin", "ORG-XG", "学生工作处", { sort: 1, data: { orgType: "行政机构" } });
  await put("org-admin", "ORG-JW", "教务处", { sort: 2, data: { orgType: "行政机构" } });
  await put("org-admin", "ORG-XXGC", "信息工程学院", { sort: 3, data: { orgType: "教学机构" } });
  await put("post-admin", "POST-FDY", "辅导员", { sort: 1, data: { category: "专技岗" } });
  await put("post-admin", "POST-BZR", "班主任", { sort: 2, data: { category: "专技岗" } });
  await put("post-admin", "POST-SGY", "宿管员", { sort: 3, data: { category: "工勤岗" } });

  // ---- 流程分类 / 流程按钮 ----
  await put("flow-category", "FC-STU", "学生事务", { sort: 1 });
  await put("flow-category", "FC-DORM", "宿舍事务", { sort: 2 });
  await put("flow-category", "FC-AID", "助困事务", { sort: 3 });
  await put("flow-button", "BTN-AGREE", "同意", { sort: 1, data: { buttonType: "同意", action: "approve" } });
  await put("flow-button", "BTN-REJECT", "拒绝", { sort: 2, data: { buttonType: "拒绝", action: "reject" } });
  await put("flow-button", "BTN-RETURN", "退回", { sort: 3, data: { buttonType: "退回", action: "return" } });

  // ---- 校内发布示例 ----
  await put("announcement", "ANN-001", "关于暑期离校登记的通知", {
    sort: 1,
    data: { content: "请各位同学在离校前完成去向登记。", scope: "全校", publishAt: "2026-07-01" },
  });
  await put("announcement", "ANN-002", "奖助学金评定工作启动通知", {
    sort: 2,
    data: { content: "本学年奖助学金评定工作已启动,请关注批次安排。", scope: "全校", publishAt: "2026-07-10" },
  });
  await put("campus-news", "NEWS-001", "我校学工系统完成升级上线", {
    sort: 1,
    data: { content: "智慧学工系统完成安全加固与流程升级,欢迎师生使用。", author: "信息中心", publishAt: "2026-07-24" },
  });
  await put("home-carousel", "CAR-001", "新学期欢迎横幅", {
    sort: 1,
    data: { image: "https://placehold.co/1200x360?text=Welcome", link: "" },
  });

  const { rows: summary } = await pool.query(
    `select feature_id, count(*)::int as n from managed_items group by feature_id order by feature_id`,
  );
  console.log("[seed-entities] 完成:", summary.map((row) => `${row.feature_id}=${row.n}`).join(" "));
} finally {
  await pool.end();
}
