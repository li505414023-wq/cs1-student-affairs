import { randomUUID } from "node:crypto";
import pg from "pg";
import { hashPassword } from "../lib/security.js";

const databaseUrl = process.env.DATABASE_URL?.trim();
const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const displayName = process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME?.trim() || "系统管理员";

if (!databaseUrl) throw new Error("缺少 DATABASE_URL");
if (!username || !password) throw new Error("缺少 BOOTSTRAP_ADMIN_USERNAME 或 BOOTSTRAP_ADMIN_PASSWORD");
if (password.length < 12) throw new Error("初始管理员密码至少需要 12 个字符");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
try {
  const existing = (await pool.query("select id from users where username = $1", [username])).rows[0];
  let adminId = existing?.id;
  if (existing) {
    console.log(`管理员 ${username} 已存在，未覆盖原密码`);
  } else {
    adminId = randomUUID();
    await pool.query(
      "insert into users (id, username, display_name, password_hash, role, role_tags, active) values ($1, $2, $3, $4, 'admin', $5, true)",
      [adminId, username, displayName, await hashPassword(password), ["管理员", "学工处管理员", "系统管理员"]],
    );
    console.log(`管理员 ${username} 创建完成`);
  }

  const seedStudents = [
    ["林晓晨", "20260001", "13800001001", "女", "信息工程学院", "软件技术", "软件2601", "2026", "2008-03-12", "滨湖校区"],
    ["周言川", "20250017", "13800001002", "男", "商学院", "电子商务", "电商2501", "2025", "2007-08-21", "滨湖校区"],
    ["陈清禾", "20240136", "13800001003", "男", "智能制造学院", "机电一体化", "机电2403", "2024", "2006-11-05", "城南校区"],
  ];
  for (const student of seedStudents) {
    await pool.query(
      `insert into students (id, name, no, phone, gender, faculty, major, class_name, grade, birth_date, address, status, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '在读', $12)
       on conflict (no) do nothing`,
      [randomUUID(), ...student, adminId],
    );
  }
  console.log("演示学生数据已就绪");
} finally {
  await pool.end();
}
