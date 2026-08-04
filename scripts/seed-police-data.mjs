/**
 * Idempotent seed for police-academy (警务化管理) data:
 * morning exercise, appearance inspection, conduct scores,
 * physical tests, training attendance, duty assignments, drills, political review.
 * 区队即班级：公安院校的区队合并写入班级管理（classes）同一套数据。
 *
 * Run: node --env-file=.env.local scripts/seed-police-data.mjs
 */
import { randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("缺少 DATABASE_URL");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });

// 区队作为班级写入 classes（列与班级元数据一致），按班级代码幂等。
const platoonClasses = [
  { 院系名称: "侦查系", 专业名称: "侦查学", 班级名称: "侦查2601区队", 班级代码: "QD-2601", 所属年级: "2026", 班主任工号: "张卫国", 班级群号: "" },
  { 院系名称: "治安系", 专业名称: "治安学", 班级名称: "治安2601区队", 班级代码: "QD-2602", 所属年级: "2026", 班主任工号: "李红梅", 班级群号: "" },
  { 院系名称: "刑侦系", 专业名称: "刑事科学技术", 班级名称: "刑侦2501区队", 班级代码: "QD-2501", 所属年级: "2025", 班主任工号: "王强", 班级群号: "" },
];

// 学生名册与区队对齐：警务数据的学号必须与 students 表一致，
// 否则学生本人/辅导员的按学号数据范围会漏数据。
const rosterStudents = [
  { no: "20260001", name: "林晓晨", faculty: "侦查系", major: "侦查学", className: "侦查2601区队", grade: "2026" },
  { no: "20250017", name: "周言川", faculty: "侦查系", major: "侦查学", className: "侦查2601区队", grade: "2026" },
  { no: "20260033", name: "顾明澈", faculty: "侦查系", major: "侦查学", className: "侦查2601区队", grade: "2026" },
  { no: "20240136", name: "陈清禾", faculty: "治安系", major: "治安学", className: "治安2601区队", grade: "2026" },
  { no: "20250107", name: "沈知夏", faculty: "治安系", major: "治安学", className: "治安2601区队", grade: "2026" },
  { no: "20260072", name: "陆景行", faculty: "治安系", major: "治安学", className: "治安2601区队", grade: "2026" },
  { no: "20240137", name: "许星野", faculty: "刑侦系", major: "刑事科学技术", className: "刑侦2501区队", grade: "2025" },
  { no: "20250128", name: "江予安", faculty: "刑侦系", major: "刑事科学技术", className: "刑侦2501区队", grade: "2025" },
];

const datasets = {
  "morning-exercise": [
    { 日期: "2026-08-03", 姓名: "林晓晨", 学号: "20260001", 区队: "侦查2601区队", 集合时间: "06:28", 缺勤原因: "无", 考勤状态: "正常" },
    { 日期: "2026-08-03", 姓名: "周言川", 学号: "20250017", 区队: "侦查2601区队", 集合时间: "06:35", 缺勤原因: "无", 考勤状态: "迟到" },
    { 日期: "2026-08-03", 姓名: "陈清禾", 学号: "20240136", 区队: "治安2601区队", 集合时间: "", 缺勤原因: "病假（已批）", 考勤状态: "请假" },
    { 日期: "2026-08-03", 姓名: "许星野", 学号: "20240137", 区队: "刑侦2501区队", 集合时间: "06:25", 缺勤原因: "无", 考勤状态: "正常" },
  ],
  "appearance-inspection": [
    { 检查日期: "2026-08-02", 姓名: "林晓晨", 学号: "20260001", 区队: "侦查2601区队", 检查项目: "着装与仪容", 扣分: "0", 检查结果: "合格", 检查人: "张卫国" },
    { 检查日期: "2026-08-02", 姓名: "周言川", 学号: "20250017", 区队: "侦查2601区队", 检查项目: "着装与仪容", 扣分: "2", 检查结果: "不合格", 检查人: "张卫国" },
    { 检查日期: "2026-08-02", 姓名: "沈知夏", 学号: "20250107", 区队: "治安2601区队", 检查项目: "内务与警容", 扣分: "0", 检查结果: "合格", 检查人: "李红梅" },
  ],
  "conduct-score": [
    { 记录日期: "2026-08-02", 姓名: "周言川", 学号: "20250017", 区队: "侦查2601区队", 加减分: "扣分", 事由: "警容风纪检查不合格", 分值: "2", 记录人: "张卫国" },
    { 记录日期: "2026-08-01", 姓名: "林晓晨", 学号: "20260001", 区队: "侦查2601区队", 加减分: "加分", 事由: "队列训练标兵", 分值: "3", 记录人: "张卫国" },
    { 记录日期: "2026-07-30", 姓名: "许星野", 学号: "20240137", 区队: "刑侦2501区队", 加减分: "加分", 事由: "执勤表现突出", 分值: "2", 记录人: "王强" },
  ],
  "conduct-score-stats": [
    { 统计维度: "侦查2601区队", 基础分: "100", 加分: "26", 扣分: "8", 当前得分: "118" },
    { 统计维度: "治安2601区队", 基础分: "100", 加分: "18", 扣分: "5", 当前得分: "113" },
    { 统计维度: "刑侦2501区队", 基础分: "100", 加分: "22", 扣分: "11", 当前得分: "111" },
  ],
  "physical-test": [
    { 测试日期: "2026-07-20", 姓名: "林晓晨", 学号: "20260001", 区队: "侦查2601区队", 测试项目: "1000米跑", 成绩: "4分05秒", 成绩评定: "良好" },
    { 测试日期: "2026-07-20", 姓名: "许星野", 学号: "20240137", 区队: "刑侦2501区队", 测试项目: "1000米跑", 成绩: "3分42秒", 成绩评定: "优秀" },
    { 测试日期: "2026-07-20", 姓名: "沈知夏", 学号: "20250107", 区队: "治安2601区队", 测试项目: "800米跑", 成绩: "3分58秒", 成绩评定: "优秀" },
    { 测试日期: "2026-07-21", 姓名: "周言川", 学号: "20250017", 区队: "侦查2601区队", 测试项目: "引体向上", 成绩: "8个", 成绩评定: "及格" },
  ],
  "police-training": [
    { 训练日期: "2026-08-01", 训练科目: "队列训练", 姓名: "林晓晨", 学号: "20260001", 区队: "侦查2601区队", 考勤状态: "出勤", 备注: "无" },
    { 训练日期: "2026-08-01", 训练科目: "队列训练", 姓名: "陈清禾", 学号: "20240136", 区队: "治安2601区队", 考勤状态: "请假", 备注: "病假（已批）" },
    { 训练日期: "2026-08-02", 训练科目: "擒敌拳", 姓名: "许星野", 学号: "20240137", 区队: "刑侦2501区队", 考勤状态: "出勤", 备注: "无" },
  ],
  "duty-assignment": [
    { 执勤日期: "2026-08-04", 执勤时段: "18:00-22:00", 执勤地点: "校门岗", 姓名: "顾明澈", 学号: "20260033", 区队: "侦查2601区队", 带队教师: "张卫国", 执勤状态: "待执勤" },
    { 执勤日期: "2026-08-03", 执勤时段: "06:00-08:00", 执勤地点: "操场", 姓名: "陆景行", 学号: "20260072", 区队: "治安2601区队", 带队教师: "李红梅", 执勤状态: "已完成" },
    { 执勤日期: "2026-08-02", 执勤时段: "20:00-23:00", 执勤地点: "学生宿舍区", 姓名: "江予安", 学号: "20250128", 区队: "刑侦2501区队", 带队教师: "王强", 执勤状态: "已完成" },
  ],
  "emergency-drill": [
    { 演练名称: "紧急集合演练", 演练类型: "紧急集合", 开展日期: "2026-07-15", 参与区队: "全体区队", 参与人数: "97", "完成用时(分)": "4.5", 演练评价: "良好", 组织者: "学生处" },
    { 演练名称: "消防疏散演练", 演练类型: "消防疏散", 开展日期: "2026-06-20", 参与区队: "侦查2601区队、治安2601区队", 参与人数: "62", "完成用时(分)": "6", 演练评价: "合格", 组织者: "保卫处" },
  ],
  "political-review": [
    { 姓名: "林晓晨", 学号: "20260001", 区队: "侦查2601区队", 审查类别: "入警资格审查", 提交日期: "2026-07-10", 审查意见: "政审材料齐全，审查通过", 审查状态: "已通过" },
    { 姓名: "周言川", 学号: "20250017", 区队: "侦查2601区队", 审查类别: "入警资格审查", 提交日期: "2026-07-12", 审查意见: "待补充家庭成员政审材料", 审查状态: "审查中" },
  ],
};

try {
  const admin = await pool.query(`select id from users where role = 'admin' limit 1`);
  const adminId = admin.rows[0]?.id ?? null;

  // 旧版独立的 platoon 记录已废弃（区队并入班级管理），一次性清理。
  await pool.query(`delete from business_records where feature_id = 'platoon'`);

  // 区队以班级形式幂等写入 classes（按班级代码先删后插，不动其它班级）。
  for (const data of platoonClasses) {
    await pool.query(
      `delete from business_records where feature_id = 'classes' and data_json->>'班级代码' = $1`,
      [data.班级代码],
    );
    await pool.query(
      `insert into business_records (id, feature_id, data_json, status, created_by, created_at, updated_at)
       values ($1, 'classes', $2, $3, $4, now(), now())`,
      [randomUUID(), JSON.stringify(data), "已提交", adminId],
    );
  }

  // 学生名册按学号幂等对齐区队（已有账号关联的 user_id 不动）。
  for (const s of rosterStudents) {
    const updated = await pool.query(
      `update students set name = $2, faculty = $3, major = $4, class_name = $5, grade = $6, updated_at = now() where no = $1`,
      [s.no, s.name, s.faculty, s.major, s.className, s.grade],
    );
    if (updated.rowCount === 0) {
      await pool.query(
        `insert into students (id, name, no, phone, gender, faculty, major, class_name, grade, status, created_at, updated_at)
         values ($1, $2, $3, $4, '未知', $5, $6, $7, $8, '在读', now(), now())`,
        [randomUUID(), s.name, s.no, `138${s.no.slice(-8)}`, s.faculty, s.major, s.className, s.grade],
      );
    }
  }

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

  const ids = [...Object.keys(datasets), "classes"].map((k) => `'${k}'`).join(",");
  const { rows: summary } = await pool.query(
    `select feature_id, count(*)::int as n from business_records where feature_id in (${ids}) group by feature_id order by feature_id`,
  );
  console.log("[seed-police-data] 完成:", summary.map((row) => `${row.feature_id}=${row.n}`).join(" "));
} finally {
  await pool.end();
}
