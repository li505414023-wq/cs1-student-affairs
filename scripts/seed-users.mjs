/**
 * 幂等补齐审批角色用户（院系管理员 + 宿管员）。
 * 背景：三级评审的"院系审核"节点(assignee=院系管理员)与住宿申办的"宿管审核"节点(assignee=宿管员)
 * 依赖真实用户按 role_tags 认领，缺这些用户时多级审批会退化成 admin 单点审批。
 * 审批人匹配桥接 = 用户表的 role + role_tags 中文标签（与 workflow 模型 assignee 对齐）。
 * Run: node --env-file=.env.local scripts/seed-users.mjs
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { hashPassword } from "./hash-password.mjs";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("缺少 DATABASE_URL");

const password =
  process.env.TEST_USER_PASSWORD?.trim() ??
  process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
if (!password || password.length < 12) throw new Error("需要 TEST_USER_PASSWORD 或 BOOTSTRAP_ADMIN_PASSWORD（至少 12 位）");

const users = [
  {
    username: process.env.DEPT_ADMIN_USERNAME?.trim() || "dept_admin",
    displayName: "院系管理员",
    role: "department_admin",
    roleTags: ["院系管理员", "部门管理员"],
  },
  {
    username: process.env.DORM_MANAGER_USERNAME?.trim() || "dorm_admin",
    displayName: "宿管员",
    role: "dorm_manager",
    roleTags: ["宿管员", "宿舍管理员"],
  },
];

const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
try {
  for (const user of users) {
    const existing = (await pool.query("select id from users where username = $1", [user.username])).rows[0];
    if (existing) {
      console.log(`${user.displayName} ${user.username} 已存在，未覆盖`);
      continue;
    }
    await pool.query(
      "insert into users (id, username, display_name, password_hash, role, role_tags, active) values ($1, $2, $3, $4, $5, $6, true)",
      [randomUUID(), user.username, user.displayName, await hashPassword(password), user.role, user.roleTags],
    );
    console.log(`${user.displayName} ${user.username} 创建完成`);
  }
} finally {
  await pool.end();
}
