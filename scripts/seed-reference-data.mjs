/**
 * Idempotent seed for reference/config data across modules
 * (payments, leave types, scholarships, discipline, clubs, classes, etc.).
 * Keys record data by the exact table column names used in the UI.
 *
 * Run: node --env-file=.env.local scripts/seed-reference-data.mjs
 */
import { randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("缺少 DATABASE_URL");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });

const datasets = {
  payments: [
    { 姓名: "陈清禾", 学号: "20240136", 缴费项目: "学费", 应缴金额: "6800", 实缴金额: "6800", 缴费时间: "2025-09-01", 缴费状态: "已缴费" },
    { 姓名: "周言川", 学号: "20250017", 缴费项目: "学费", 应缴金额: "6800", 实缴金额: "6800", 缴费时间: "2025-08-28", 缴费状态: "已缴费" },
    { 姓名: "林晓晨", 学号: "20260001", 缴费项目: "学费", 应缴金额: "6800", 实缴金额: "6800", 缴费时间: "2026-08-20", 缴费状态: "已缴费" },
    { 姓名: "何嘉树", 学号: "20260003", 缴费项目: "学费", 应缴金额: "7200", 实缴金额: "0", 缴费时间: "", 缴费状态: "未缴费" },
  ],
  "leave-type": [
    { 类型名称: "事假", 类型编码: "SJ", 最长天数: "7", 是否需要附件: "否", 审批层级: "辅导员", 启用状态: "启用" },
    { 类型名称: "病假", 类型编码: "BJ", 最长天数: "14", 是否需要附件: "是", 审批层级: "辅导员", 启用状态: "启用" },
    { 类型名称: "公假", 类型编码: "GJ", 最长天数: "30", 是否需要附件: "是", 审批层级: "院系管理员", 启用状态: "启用" },
  ],
  holiday: [
    { 假期名称: "2026年国庆节", 开始日期: "2026-10-01", 结束日期: "2026-10-08", 去向填报时间: "2026-09-25", 返校确认时间: "2026-10-09", 启用状态: "启用" },
    { 假期名称: "2026年寒假", 开始日期: "2027-01-18", 结束日期: "2027-02-28", 去向填报时间: "2027-01-10", 返校确认时间: "2027-03-01", 启用状态: "启用" },
  ],
  employers: [
    { 单位名称: "校图书馆", 单位类型: "校内部门", 联系人: "王老师", 联系电话: "021-66880001", 可用岗位数: "4", 启用状态: "启用" },
    { 单位名称: "信息化建设中心", 单位类型: "校内部门", 联系人: "赵老师", 联系电话: "021-66880002", 可用岗位数: "2", 启用状态: "启用" },
  ],
  jobs: [
    { 岗位名称: "图书整理员", 用人单位: "校图书馆", 招聘人数: "3", 薪资标准: "20元/小时", 工作时间: "周一至周五 16:00-18:00", 申请人数: "1", 招聘状态: "招聘中" },
    { 岗位名称: "前台借阅服务", 用人单位: "校图书馆", 招聘人数: "1", 薪资标准: "20元/小时", 工作时间: "周末 9:00-12:00", 申请人数: "0", 招聘状态: "招聘中" },
    { 岗位名称: "校园网运维助理", 用人单位: "信息化建设中心", 招聘人数: "2", 薪资标准: "25元/小时", 工作时间: "每周不少于6小时", 申请人数: "0", 招聘状态: "招聘中" },
  ],
  "hardship-type": [
    { 补助种类: "临时困难补助", 种类编码: "K01", 补助标准: "1000-3000元/次", 适用对象: "家庭突发困难学生", 所需材料: "困难证明、申请书", 启用状态: "启用" },
    { 补助种类: "冬令补助", 种类编码: "K02", 补助标准: "500元/人", 适用对象: "家庭经济困难学生", 所需材料: "申请书", 启用状态: "启用" },
  ],
  "grant-type": [
    { 助学金种类: "国家助学金", 种类编码: "G01", 等级数量: "3", 金额标准: "2000-4500元/年", 评定条件: "家庭经济困难认定通过", 启用状态: "启用" },
    { 助学金种类: "校级助学金", 种类编码: "G02", 等级数量: "2", 金额标准: "1000-2000元/年", 评定条件: "家庭经济困难认定通过", 启用状态: "启用" },
  ],
  "scholarship-type": [
    { 奖学金种类: "国家奖学金", 种类编码: "S01", 等级: "国家级", 金额标准: "8000元/年", 评定条件: "成绩排名前10%", 启用状态: "启用" },
    { 奖学金种类: "国家励志奖学金", 种类编码: "S02", 等级: "国家级", 金额标准: "5000元/年", 评定条件: "困难认定通过且成绩排名前30%", 启用状态: "启用" },
    { 奖学金种类: "校级一等奖学金", 种类编码: "S03", 等级: "校级", 金额标准: "2000元/年", 评定条件: "综合测评班级前5%", 启用状态: "启用" },
  ],
  "discipline-type": [
    { 违纪类型: "旷课", 类型编码: "W01", 违纪等级: "一般", 默认扣分: "2", 适用范围: "全体学生", 启用状态: "启用" },
    { 违纪类型: "考试作弊", 类型编码: "W02", 违纪等级: "严重", 默认扣分: "10", 适用范围: "全体学生", 启用状态: "启用" },
    { 违纪类型: "夜不归宿", 类型编码: "W03", 违纪等级: "一般", 默认扣分: "3", 适用范围: "住宿学生", 启用状态: "启用" },
  ],
  "punishment-type": [
    { 处分类型: "警告", 类型编码: "C01", 处分等级: "一级", 影响期限: "6个月", 撤销条件: "表现良好且无新违纪", 启用状态: "启用" },
    { 处分类型: "严重警告", 类型编码: "C02", 处分等级: "二级", 影响期限: "9个月", 撤销条件: "表现良好且无新违纪", 启用状态: "启用" },
    { 处分类型: "记过", 类型编码: "C03", 处分等级: "三级", 影响期限: "12个月", 撤销条件: "表现良好且无新违纪", 启用状态: "启用" },
  ],
  clubs: [
    { 社团名称: "摄影协会", 社团类别: "艺术类", 负责人: "陈清禾", 指导教师: "刘老师", 成员人数: "45", 成立日期: "2024-09-10", 运行状态: "运行中" },
    { 社团名称: "程序设计俱乐部", 社团类别: "科技类", 负责人: "周言川", 指导教师: "陈老师", 成员人数: "62", 成立日期: "2023-03-15", 运行状态: "运行中" },
  ],
  classes: [
    { 院系名称: "信息工程学院", 专业名称: "软件工程", 班级名称: "软件2401", 班级代码: "RJ2401", 所属年级: "2024", 班主任工号: "T2024001", 班级群号: "992837461" },
    { 院系名称: "信息工程学院", 专业名称: "软件工程", 班级名称: "软件2601", 班级代码: "RJ2601", 所属年级: "2026", 班主任工号: "T2026001", 班级群号: "883746251" },
    { 院系名称: "智能制造学院", 专业名称: "机械电子", 班级名称: "机电2601", 班级代码: "JD2601", 所属年级: "2026", 班主任工号: "T2026002", 班级群号: "774635219" },
  ],
};

// Config/list-type records use 启用 as default status where the data carries it;
// otherwise keep 已提交 so tables show a neutral state.
const statusByFeature = Object.fromEntries(Object.keys(datasets).map((key) => [key, "已提交"]));

try {
  const admin = await pool.query(`select id from users where role = 'admin' limit 1`);
  const adminId = admin.rows[0]?.id ?? null;

  for (const [featureId, rows] of Object.entries(datasets)) {
    await pool.query(`delete from business_records where feature_id = $1`, [featureId]);
    for (const data of rows) {
      await pool.query(
        `insert into business_records (id, feature_id, data_json, status, created_by, created_at, updated_at)
         values ($1, $2, $3, $4, $5, now(), now())`,
        [randomUUID(), featureId, JSON.stringify(data), statusByFeature[featureId], adminId],
      );
    }
  }

  const ids = Object.keys(datasets).map((k) => `'${k}'`).join(",");
  const { rows: summary } = await pool.query(
    `select feature_id, count(*)::int as n from business_records where feature_id in (${ids}) group by feature_id order by feature_id`,
  );
  console.log("[seed-reference-data] 完成:", summary.map((row) => `${row.feature_id}=${row.n}`).join(" "));
} finally {
  await pool.end();
}
