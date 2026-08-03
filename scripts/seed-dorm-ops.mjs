/**
 * Idempotent seed for dormitory operation data
 * (hygiene checks, repairs, attendance, discipline, deduction rules).
 *
 * Run: node --env-file=.env.local scripts/seed-dorm-ops.mjs
 */
import { randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("缺少 DATABASE_URL");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });

const datasets = {
  "room-hygiene": [
    { 检查日期: "2026-08-01", 楼栋: "海棠1号楼", 房间号: "301", 卫生得分: "95", 扣分项: "无", 检查人: "宿管张老师", 整改状态: "合格" },
    { 检查日期: "2026-08-01", 楼栋: "海棠2号楼", 房间号: "408", 卫生得分: "82", 扣分项: "地面有杂物", 检查人: "宿管李老师", 整改状态: "待整改" },
    { 检查日期: "2026-08-01", 楼栋: "梧桐3号楼", 房间号: "216", 卫生得分: "90", 扣分项: "阳台堆放物品", 检查人: "宿管王老师", 整改状态: "已整改" },
  ],
  "student-hygiene": [
    { 姓名: "林晓晨", 学号: "20260001", 宿舍: "海棠1号楼-301", 个人得分: "92", 扣分项: "无", 检查日期: "2026-08-01", 整改状态: "合格" },
    { 姓名: "苏念安", 学号: "20260002", 宿舍: "海棠1号楼-301", 个人得分: "85", 扣分项: "桌面物品摆放杂乱", 检查日期: "2026-08-01", 整改状态: "待整改" },
  ],
  "dorm-repair": [
    { 报修编号: "BX-2026-0801", 报修位置: "海棠1号楼-302", 报修类型: "水电维修", 故障描述: "卫生间水龙头漏水", 报修人: "何嘉树", 维修人员: "维修组-老赵", 提交时间: "2026-08-01 09:20", 维修状态: "维修中" },
    { 报修编号: "BX-2026-0729", 报修位置: "海棠2号楼-408", 报修类型: "家具维修", 故障描述: "床板断裂", 报修人: "陈清禾", 维修人员: "维修组-老孙", 提交时间: "2026-07-29 14:05", 维修状态: "已完成" },
  ],
  "hygiene-deduction": [
    { 扣分项名称: "地面不洁", 扣分编码: "D01", 扣分值: "2", 适用对象: "宿舍", 整改期限: "1天", 启用状态: "启用" },
    { 扣分项名称: "违规电器", 扣分编码: "D02", 扣分值: "10", 适用对象: "宿舍", 整改期限: "立即", 启用状态: "启用" },
    { 扣分项名称: "桌面杂乱", 扣分编码: "D03", 扣分值: "1", 适用对象: "个人", 整改期限: "1天", 启用状态: "启用" },
  ],
  "dorm-attendance": [
    { 日期: "2026-08-02", 姓名: "林晓晨", 学号: "20260001", 宿舍: "海棠1号楼-301", 签到时间: "22:15", 定位结果: "楼内", 考勤状态: "正常" },
    { 日期: "2026-08-02", 姓名: "周言川", 学号: "20250017", 宿舍: "海棠2号楼-408", 签到时间: "23:40", 定位结果: "楼内", 考勤状态: "晚归" },
    { 日期: "2026-08-02", 姓名: "陈清禾", 学号: "20240136", 宿舍: "海棠2号楼-410", 签到时间: "", 定位结果: "楼外", 考勤状态: "未归" },
  ],
  "dorm-attendance-stats": [
    { 统计维度: "海棠1号楼", 应到: "45", 正常: "42", 晚归: "2", 未归: "1" },
    { 统计维度: "海棠2号楼", 应到: "52", 正常: "48", 晚归: "3", 未归: "1" },
    { 统计维度: "梧桐3号楼", 应到: "38", 正常: "37", 晚归: "1", 未归: "0" },
  ],
  "dorm-discipline": [
    { 姓名: "周言川", 学号: "20250017", 宿舍: "海棠2号楼-408", 违纪类型: "夜不归宿", 违纪时间: "2026-07-28", 扣分: "3", 处理状态: "已处理" },
  ],
};

try {
  const admin = await pool.query(`select id from users where role = 'admin' limit 1`);
  const adminId = admin.rows[0]?.id ?? null;

  for (const [featureId, rows] of Object.entries(datasets)) {
    await pool.query(`delete from business_records where feature_id = $1`, [featureId]);
    for (const data of rows) {
      await pool.query(
        `insert into business_records (id, feature_id, data_json, status, created_by, created_at, updated_at)
         values ($1, $2, $3, $4, $5, now(), now())`,
        [randomUUID(), featureId, JSON.stringify(data), "已提交", adminId],
      );
    }
  }

  const ids = Object.keys(datasets).map((k) => `'${k}'`).join(",");
  const { rows: summary } = await pool.query(
    `select feature_id, count(*)::int as n from business_records where feature_id in (${ids}) group by feature_id order by feature_id`,
  );
  console.log("[seed-dorm-ops] 完成:", summary.map((row) => `${row.feature_id}=${row.n}`).join(" "));
} finally {
  await pool.end();
}
