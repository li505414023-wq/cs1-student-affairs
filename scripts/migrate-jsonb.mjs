// 数据迁移：businessRecords JSONB → 领域真表（幂等，可重复执行）。
// 只复制不删除：businessRecords 原数据保留，验证无误后再另行清理。
// 用法: node --env-file=.env.local scripts/migrate-jsonb.mjs
import pg from "pg";

const url = process.env.DATABASE_URL?.trim();
if (!url) throw new Error("缺少 DATABASE_URL");

const pool = new pg.Pool({ connectionString: url, max: 2 });

const str = (value) => (typeof value === "number" ? String(value) : typeof value === "string" ? value : "");
const num = (value) => {
  const n = Number(str(value));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
// 区队(警务化)与班级(学工)两种键名并存，取值时兼容。
const classNameOf = (d) => str(d["区队"] ?? d["班级"] ?? d["班级名称"] ?? "");

// 每个域：featureId → 表名 + 核心列提取器（返回 {列名: 值}，data_json 由脚本统一携带）。
const DOMAINS = [
  {
    feature: "punishment",
    table: "punishments",
    map: (d) => ({
      student_no: str(d["学号"]),
      student_name: str(d["姓名"]),
      class_name: classNameOf(d),
      punishment_type: str(d["处分类型"]),
      punishment_level: str(d["处分等级"]),
      status: str(d["处分状态"] ?? d["处理状态"] ?? d["状态"] ?? "生效中"),
    }),
  },
  {
    feature: "conduct-score",
    table: "conduct_scores",
    map: (d) => ({
      student_no: str(d["学号"]),
      student_name: str(d["姓名"]),
      class_name: classNameOf(d),
      direction: str(d["加减分"] ?? "加分"),
      score: num(d["分值"]),
      reason: str(d["事由"]),
      record_date: str(d["记录日期"] ?? d["申请日期"] ?? ""),
    }),
  },
  {
    feature: "course-scores",
    table: "course_scores",
    map: (d) => ({
      student_no: str(d["学号"]),
      student_name: str(d["姓名"]),
      class_name: classNameOf(d),
      term: str(d["学年学期"] ?? d["学期"] ?? ""),
      course_name: str(d["课程名称"]),
      score: num(d["课程成绩"]),
      pass_status: str(d["及格状态"]),
    }),
  },
  {
    feature: "physical-test",
    table: "physical_tests",
    map: (d) => ({
      student_no: str(d["学号"]),
      student_name: str(d["姓名"]),
      class_name: classNameOf(d),
      item: str(d["测试项目"]),
      score: str(d["成绩"]),
      result: str(d["成绩评定"]),
    }),
  },
  {
    feature: "class-attendance",
    table: "attendances",
    map: (d) => ({
      student_no: str(d["学号"]),
      student_name: str(d["姓名"]),
      class_name: classNameOf(d),
      source_feature: "class-attendance",
      attendance_date: str(d["日期"] ?? d["考勤日期"] ?? ""),
      slot: str(d["集队时段"] ?? ""),
      attendance_status: str(d["点名结果"] ?? d["考勤状态"] ?? ""),
    }),
  },
  {
    feature: "evening-rollcall",
    table: "attendances",
    map: (d) => ({
      student_no: str(d["学号"]),
      student_name: str(d["姓名"]),
      class_name: classNameOf(d),
      source_feature: "evening-rollcall",
      attendance_date: str(d["日期"] ?? d["考勤日期"] ?? ""),
      slot: "",
      attendance_status: str(d["点名结果"] ?? d["考勤状态"] ?? ""),
    }),
  },
  {
    feature: "morning-exercise",
    table: "attendances",
    map: (d) => ({
      student_no: str(d["学号"]),
      student_name: str(d["姓名"]),
      class_name: classNameOf(d),
      source_feature: "morning-exercise",
      attendance_date: str(d["日期"] ?? d["考勤日期"] ?? ""),
      slot: "",
      attendance_status: str(d["考勤状态"] ?? d["点名结果"] ?? ""),
    }),
  },
  {
    feature: "absence-warning",
    table: "absence_warnings",
    map: (d) => ({
      student_no: str(d["学号"]),
      student_name: str(d["姓名"]),
      class_name: classNameOf(d),
      term: str(d["学期"] ?? ""),
      total_hours: num(d["累计旷课课时"]),
      warning_level: str(d["预警等级"]),
      status: str(d["状态"] ?? "预警中"),
    }),
  },
  {
    feature: "leave",
    table: "leaves",
    map: (d) => ({
      student_no: str(d["学号"]),
      student_name: str(d["姓名"]),
      class_name: classNameOf(d),
      leave_type: str(d["请假类型"]),
      start_at: str(d["开始时间"] ?? d["开始日期"] ?? ""),
      end_at: str(d["结束时间"] ?? d["结束日期"] ?? ""),
      days: num(d["请假天数"]),
      approval_chain: str(d["审批链"] ?? ""),
      status: str(d["审核状态"] ?? d["状态"] ?? "已提交"),
    }),
  },
  {
    feature: "status-change",
    table: "status_changes",
    map: (d) => ({
      student_no: str(d["学号"]),
      student_name: str(d["姓名"]),
      class_name: classNameOf(d),
      change_type: str(d["异动类型"]),
      effective_date: str(d["生效日期"] ?? ""),
      status: str(d["处理状态"] ?? d["状态"] ?? "待处理"),
    }),
  },
];

async function migrate() {
  const client = await pool.connect();
  try {
    let total = 0;
    for (const domain of DOMAINS) {
      const { rows } = await client.query(
        "SELECT id, data_json, status, created_by, created_at, updated_at FROM business_records WHERE feature_id = $1",
        [domain.feature],
      );
      for (const row of rows) {
        const d = row.data_json ?? {};
        const mapped = domain.map(d);
        // 学号是领域表的主键维度，缺失则跳过该条（无法参与联动/权限）。
        if (!mapped.student_no) continue;
        const columns = ["id", ...Object.keys(mapped), "data_json", "created_by", "created_at", "updated_at"];
        const values = [row.id, ...Object.values(mapped), d, row.created_by, row.created_at, row.updated_at];
        const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
        await client.query(
          `INSERT INTO ${domain.table} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
          values,
        );
        total += 1;
      }
      console.log(`${domain.feature} → ${domain.table}: ${rows.length} 条源记录`);
    }
    console.log(`迁移完成，共写入 ${total} 条（幂等：已存在则跳过）`);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("迁移失败:", error);
  process.exit(1);
});
