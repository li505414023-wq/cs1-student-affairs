/**
 * Idempotent seed for welcome (迎新) reference data.
 * Keys record data by the exact table column names used in the UI.
 *
 * Run: node --env-file=.env.local scripts/seed-welcome-data.mjs
 */
import { randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("缺少 DATABASE_URL");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });

const batches = [
  { 批次名称: "2026级秋季迎新批次", 入学年份: "2026", 报到开始时间: "2026-08-28", 报到结束时间: "2026-08-30", 新生人数: "3", 流程数量: "5", 发布状态: "已发布" },
  { 批次名称: "2025级秋季迎新批次", 入学年份: "2025", 报到开始时间: "2025-08-29", 报到结束时间: "2025-08-31", 新生人数: "1", 流程数量: "5", 发布状态: "已归档" },
];

const processes = [
  { 环节名称: "资格审查", 办理顺序: "1", 责任部门: "招生办", 是否必办: "是", 启用状态: "启用" },
  { 环节名称: "缴费确认", 办理顺序: "2", 责任部门: "财务处", 是否必办: "是", 启用状态: "启用" },
  { 环节名称: "宿舍分配", 办理顺序: "3", 责任部门: "宿管中心", 是否必办: "是", 启用状态: "启用" },
  { 环节名称: "校园卡办理", 办理顺序: "4", 责任部门: "信息化中心", 是否必办: "否", 启用状态: "启用" },
  { 环节名称: "档案登记", 办理顺序: "5", 责任部门: "学工处", 是否必办: "是", 启用状态: "启用" },
];

const cardCheckins = [
  { 姓名: "林晓晨", 学号: "20260001", 院系: "信息工程学院", 班级: "软件2601", 报到状态: "已报到", 报到时间: "2026-08-28 08:32" },
  { 姓名: "苏念安", 学号: "20260002", 院系: "信息工程学院", 班级: "软件2601", 报到状态: "已报到", 报到时间: "2026-08-28 09:15" },
  { 姓名: "何嘉树", 学号: "20260003", 院系: "智能制造学院", 班级: "机电2601", 报到状态: "待报到", 报到时间: "" },
];

const manualCheckins = [
  { 姓名: "林晓晨", 学号: "20260001", 院系: "信息工程学院", 缴费状态: "已缴费", 宿舍: "海棠2号楼216", 报到环节: "档案登记", 报到状态: "已报到" },
  { 姓名: "苏念安", 学号: "20260002", 院系: "信息工程学院", 缴费状态: "已缴费", 宿舍: "海棠2号楼218", 报到环节: "宿舍分配", 报到状态: "已报到" },
  { 姓名: "何嘉树", 学号: "20260003", 院系: "智能制造学院", 缴费状态: "未缴费", 宿舍: "", 报到环节: "资格审查", 报到状态: "待报到" },
];

const paymentList = [
  { 姓名: "林晓晨", 学号: "20260001", 应缴金额: "6800", 实缴金额: "6800", 缴费方式: "线上支付", 缴费时间: "2026-08-20", 缴费状态: "已缴费" },
  { 姓名: "苏念安", 学号: "20260002", 应缴金额: "6800", 实缴金额: "6800", 缴费方式: "银行代扣", 缴费时间: "2026-08-21", 缴费状态: "已缴费" },
  { 姓名: "何嘉树", 学号: "20260003", 应缴金额: "7200", 实缴金额: "0", 缴费方式: "", 缴费时间: "", 缴费状态: "未缴费" },
];

const notes = [
  { 须知标题: "2026级新生报到流程说明", 迎新批次: "2026级秋季迎新批次", 发布范围: "全体新生", 发布时间: "2026-08-15", 阅读人数: "3", 发布状态: "已发布" },
  { 须知标题: "报到当天交通与接站安排", 迎新批次: "2026级秋季迎新批次", 发布范围: "全体新生", 发布时间: "2026-08-18", 阅读人数: "2", 发布状态: "已发布" },
  { 须知标题: "宿舍入住注意事项", 迎新批次: "2026级秋季迎新批次", 发布范围: "全体新生", 发布时间: "2026-08-20", 阅读人数: "1", 发布状态: "草稿" },
];

const faqs = [
  { 问题标题: "报到需要携带哪些材料？", 问题分类: "报到材料", 答案摘要: "录取通知书、身份证原件、一寸照片两张、党团关系材料。", 显示排序: "1", 更新时间: "2026-08-10", 启用状态: "启用" },
  { 问题标题: "可以提前一天到校吗？", 问题分类: "报到安排", 答案摘要: "可以，提前到校的新生请到南门接待站登记，学校提供临时住宿。", 显示排序: "2", 更新时间: "2026-08-12", 启用状态: "启用" },
  { 问题标题: "缴费遇到问题怎么办？", 问题分类: "缴费问题", 答案摘要: "请携带银行卡到财务处现场缴费窗口办理，或联系辅导员协助。", 显示排序: "3", 更新时间: "2026-08-14", 启用状态: "启用" },
];

const facultyStats = [
  { 统计维度: "信息工程学院", 应到人数: "2", 已到人数: "2", 未到人数: "0", 报到率: "100%" },
  { 统计维度: "智能制造学院", 应到人数: "1", 已到人数: "0", 未到人数: "1", 报到率: "0%" },
];

const classStats = [
  { 班级: "软件2601", 应到人数: "2", 已到人数: "2", 未到人数: "0", 报到率: "100%" },
  { 班级: "机电2601", 应到人数: "1", 已到人数: "0", 未到人数: "1", 报到率: "0%" },
];

const paymentStats = [
  { 学院: "信息工程学院", 应缴人数: "2", 已缴人数: "2", 应缴金额: "13600", 实缴金额: "13600", 缴费率: "100%" },
  { 学院: "智能制造学院", 应缴人数: "1", 已缴人数: "0", 应缴金额: "7200", 实缴金额: "0", 缴费率: "0%" },
];

try {
  const admin = await pool.query(`select id from users where role = 'admin' limit 1`);
  const adminId = admin.rows[0]?.id ?? null;

  const datasets = [
    { featureId: "welcome-batch", rows: batches },
    { featureId: "welcome-process", rows: processes },
    { featureId: "card-checkin", rows: cardCheckins },
    { featureId: "manual-checkin", rows: manualCheckins },
    { featureId: "welcome-payment-list", rows: paymentList },
    { featureId: "welcome-notes", rows: notes },
    { featureId: "welcome-faq", rows: faqs },
    { featureId: "faculty-checkin-stats", rows: facultyStats },
    { featureId: "class-checkin-stats", rows: classStats },
    { featureId: "payment-stats", rows: paymentStats },
  ];

  for (const { featureId, rows } of datasets) {
    await pool.query(`delete from business_records where feature_id = $1`, [featureId]);
    for (const data of rows) {
      const status = featureId === "welcome-faq" || featureId === "welcome-process" ? "启用" : featureId === "welcome-notes" ? "已发布" : "已提交";
      await pool.query(
        `insert into business_records (id, feature_id, data_json, status, created_by, created_at, updated_at)
         values ($1, $2, $3, $4, $5, now(), now())`,
        [randomUUID(), featureId, JSON.stringify(data), status, adminId],
      );
    }
  }

  const { rows: summary } = await pool.query(
    `select feature_id, count(*)::int as n from business_records
     where feature_id in ('welcome-batch','welcome-process','card-checkin','manual-checkin','welcome-payment-list','welcome-notes','welcome-faq','faculty-checkin-stats','class-checkin-stats','payment-stats')
     group by feature_id order by feature_id`,
  );
  console.log("[seed-welcome-data] 完成:", summary.map((row) => `${row.feature_id}=${row.n}`).join(" "));
} finally {
  await pool.end();
}
