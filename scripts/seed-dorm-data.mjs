/**
 * Idempotent seed for dorm reference data: buildings, rooms, occupancy.
 * Keys record data by the exact table column names used in the UI.
 *
 * Run: node --env-file=.env.local scripts/seed-dorm-data.mjs
 */
import { randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("缺少 DATABASE_URL");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });

const buildings = [
  { 校区: "滨湖校区", 楼栋名称: "海棠1号楼", 楼层数: "6", 房间数: "120", 住宿性别: "男", 楼栋管理员: "王老师", 启用状态: "启用" },
  { 校区: "滨湖校区", 楼栋名称: "海棠2号楼", 楼层数: "6", 房间数: "120", 住宿性别: "女", 楼栋管理员: "李老师", 启用状态: "启用" },
  { 校区: "城南校区", 楼栋名称: "梧桐3号楼", 楼层数: "5", 房间数: "90", 住宿性别: "男", 楼栋管理员: "赵老师", 启用状态: "启用" },
];

const rooms = [
  { 楼栋: "海棠1号楼", 房间号: "301", 楼层: "3", 房间类型: "四人间", 床位数: "4", 已住人数: "1", 空床数: "3", 房间状态: "正常" },
  { 楼栋: "海棠2号楼", 房间号: "408", 楼层: "4", 房间类型: "四人间", 床位数: "4", 已住人数: "1", 空床数: "3", 房间状态: "正常" },
  { 楼栋: "梧桐3号楼", 房间号: "216", 楼层: "2", 房间类型: "六人间", 床位数: "6", 已住人数: "1", 空床数: "5", 房间状态: "正常" },
  { 楼栋: "海棠1号楼", 房间号: "302", 楼层: "3", 房间类型: "四人间", 床位数: "4", 已住人数: "0", 空床数: "4", 房间状态: "空置" },
  { 楼栋: "海棠2号楼", 房间号: "410", 楼层: "4", 房间类型: "四人间", 床位数: "4", 已住人数: "0", 空床数: "4", 房间状态: "维修中" },
];

const occupancy = [
  { 楼栋: "海棠1号楼", 房间号: "301", 床位号: "1", 姓名: "陈清禾", 学号: "20240136", 院系: "智能制造学院", 入住日期: "2024-09-01", 住宿状态: "在住" },
  { 楼栋: "海棠2号楼", 房间号: "408", 床位号: "2", 姓名: "周言川", 学号: "20250017", 院系: "商学院", 入住日期: "2025-09-01", 住宿状态: "在住" },
  { 楼栋: "梧桐3号楼", 房间号: "216", 床位号: "3", 姓名: "林晓晨", 学号: "20260001", 院系: "信息工程学院", 入住日期: "2026-03-01", 住宿状态: "在住" },
];

try {
  const admin = await pool.query(`select id from users where role = 'admin' limit 1`);
  const adminId = admin.rows[0]?.id ?? null;

  const datasets = [
    { featureId: "dorm-building", rows: buildings },
    { featureId: "dorm-room", rows: rooms },
    { featureId: "dorm-occupancy", rows: occupancy },
  ];

  for (const { featureId, rows } of datasets) {
    await pool.query(`delete from business_records where feature_id = $1`, [featureId]);
    for (const data of rows) {
      await pool.query(
        `insert into business_records (id, feature_id, data_json, status, created_by, created_at, updated_at)
         values ($1, $2, $3, '启用', $4, now(), now())`,
        [randomUUID(), featureId, JSON.stringify(data), adminId],
      );
    }
  }

  const { rows: summary } = await pool.query(
    `select feature_id, count(*)::int as n from business_records
     where feature_id in ('dorm-building','dorm-room','dorm-occupancy') group by feature_id`,
  );
  console.log("[seed-dorm-data] 完成:", summary.map((row) => `${row.feature_id}=${row.n}`).join(" "));
} finally {
  await pool.end();
}
