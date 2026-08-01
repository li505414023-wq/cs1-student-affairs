import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createStudentTemplateCsv, parseCsv, validateStudentRows } from "../app/student-import.js";
import { createCsv, filterTableRows } from "../app/interaction-utils.js";

async function render() {
  const html = await readFile(new URL("../.next/server/app/index.html", import.meta.url), "utf8");
  return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
}

test("renders the complete smart student affairs shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /<title>智慧学工管理系统 · 本地原型<\/title>/i);
  assert.match(html, /智慧学工管理系统/);
  assert.match(html, /班级管理/);
  assert.match(html, /学生事务/);
  assert.match(html, /助困管理/);
  assert.match(html, /奖罚管理/);
  assert.match(html, /团委工作/);
  assert.match(html, /毕业离校管理/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("renders student-management controls with synthetic records", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /请输入姓名/);
  assert.match(html, /添加学生/);
  assert.match(html, /批量导入/);
  assert.match(html, /林晓晨/);
  assert.match(html, /20260001/);
  assert.match(html, /PostgreSQL/);
  assert.doesNotMatch(html, /18761665823|黄春辉/);
});

test("exposes the reconstructed business flow", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /基础配置/);
  assert.match(html, /批次发布/);
  assert.match(html, /学生申请/);
  assert.match(html, /分级审核/);
  assert.match(html, /结果归档/);
});

test("implements the complete four-section student form", async () => {
  const source = await readFile(new URL("../app/StudentAffairsApp.tsx", import.meta.url), "utf8");

  assert.match(source, /基本信息/);
  assert.match(source, /学籍信息/);
  assert.match(source, /个人信息/);
  assert.match(source, /迎新信息/);
  assert.match(source, /身份证件号/);
  assert.match(source, /政治面貌/);
  assert.match(source, /是否属于迎新批次/);
  assert.match(source, /建议上传一寸免冠照片/);
});

test("gives every business stage a real record form", async () => {
  const source = await readFile(new URL("../app/StudentAffairsApp.tsx", import.meta.url), "utf8");

  assert.match(source, /ConfigRecordForm/);
  assert.match(source, /BatchRecordForm/);
  assert.match(source, /ApplicationRecordForm/);
  assert.match(source, /ReviewRecordForm/);
  assert.match(source, /ArchiveRecordForm/);
  assert.match(source, /审核意见/);
  assert.match(source, /申请开始时间/);
  assert.match(source, /附件材料/);
});

test("implements all four top-level systems and their menus", async () => {
  const [appSource, dataSource] = await Promise.all([
    readFile(new URL("../app/StudentAffairsApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/system-data.ts", import.meta.url), "utf8"),
  ]);

  assert.match(appSource, /setActiveSystem/);
  assert.match(appSource, /systemGroups/);
  assert.match(dataSource, /welcomeFeatureGroups/);
  assert.match(dataSource, /dormFeatureGroups/);
  assert.match(dataSource, /adminFeatureGroups/);
  assert.match(dataSource, /刷卡报到/);
  assert.match(dataSource, /批量排宿/);
  assert.match(dataSource, /数据权限/);
  assert.match(dataSource, /错误日志/);
});

test("defines page-specific fields across welcome, dormitory, and admin systems", async () => {
  const metadata = await readFile(new URL("../app/feature-metadata.ts", import.meta.url), "utf8");

  assert.match(metadata, /card-checkin/);
  assert.match(metadata, /报到状态/);
  assert.match(metadata, /dorm-building/);
  assert.match(metadata, /楼栋名称/);
  assert.match(metadata, /dorm-attendance/);
  assert.match(metadata, /考勤状态/);
  assert.match(metadata, /dorm-repair/);
  assert.match(metadata, /维修状态/);
  assert.match(metadata, /data-permission/);
  assert.match(metadata, /数据范围/);
  assert.match(metadata, /error-log/);
  assert.match(metadata, /异常信息/);
});

test("parses and validates student import rows", () => {
  const rows = parseCsv("学号,姓名,性别,院系名称,专业名称,班级名称,入学年级,出生日期,民族,学制,移动电话\n20260088,顾明澈,男,信息工程学院,软件技术,软件2601,2026,2008-03-12,汉族,3,13800001234");
  const result = validateStudentRows(rows);

  assert.equal(result.validRows.length, 1);
  assert.equal(result.errors.length, 0);
  assert.equal(result.validRows[0]["学号"], "20260088");
});

test("reports missing columns, invalid values, and duplicate student numbers", () => {
  const missingColumn = validateStudentRows([["学号", "姓名"], ["1", "测试学生"]]);
  assert.ok(missingColumn.errors.some((error) => error.message.includes("缺少必填列")));

  const duplicateRows = parseCsv("学号,姓名,性别,院系名称,专业名称,班级名称,入学年级,出生日期,民族,学制,移动电话\n20260001,甲,未知,信息工程学院,软件技术,软件2601,20,错误日期,汉族,0,123\n20260001,乙,女,信息工程学院,软件技术,软件2601,2026,2008-03-12,汉族,3,13800001234");
  const duplicateResult = validateStudentRows(duplicateRows);
  assert.ok(duplicateResult.errors.some((error) => error.message.includes("性别")));
  assert.ok(duplicateResult.errors.some((error) => error.message.includes("重复学号")));
});

test("generates an Excel-compatible student CSV template", () => {
  const template = createStudentTemplateCsv();
  assert.ok(template.startsWith("\uFEFF学号,姓名,性别"));
  assert.match(template, /院系名称,专业名称,班级名称/);
});

test("implements the full student import dialog and workflow", async () => {
  const source = await readFile(new URL("../app/StudentAffairsApp.tsx", import.meta.url), "utf8");
  assert.match(source, /StudentImportDialog/);
  assert.match(source, /模板下载/);
  assert.match(source, /学生导入大约耗时3-5分钟/);
  assert.match(source, /错误日志/);
  assert.match(source, /\.xlsx,\.csv/);
  assert.match(source, /确认导入/);
  assert.match(source, /validateStudentRows/);
});

test("filters generic table rows without mutating the source records", () => {
  const rows = [
    { name: "林晓晨", grade: "2026", status: "正常" },
    { name: "陈清禾", grade: "2025", status: "待审核" },
  ];
  const result = filterTableRows(rows, { name: "林", grade: "2026" });

  assert.deepEqual(result, [rows[0]]);
  assert.equal(rows.length, 2);
});

test("creates an Excel-compatible CSV export with escaped cells", () => {
  const csv = createCsv(["姓名", "备注"], [["顾明澈", "含,逗号"], ["宋知遥", '含"引号']]);

  assert.ok(csv.startsWith("\uFEFF姓名,备注"));
  assert.match(csv, /顾明澈,"含,逗号"/);
  assert.match(csv, /宋知遥,"含""引号"/);
});

test("wires every user-facing button to an action or native form behavior", async () => {
  const source = await readFile(new URL("../app/StudentAffairsApp.tsx", import.meta.url), "utf8");
  const buttonTags = source.match(/<button\b[^>]*>/g) ?? [];
  const inertButtons = buttonTags.filter((tag) => !/onClick=|type="(?:submit|reset)"|disabled/.test(tag));

  assert.deepEqual(inertButtons, []);
  assert.match(source, /ColumnSettingsDialog/);
  assert.match(source, /downloadCsv/);
  assert.match(source, /StudentRecordDialog/);
  assert.match(source, /role="status"/);
});

test("routes every non-student import action through a real file import dialog", async () => {
  const source = await readFile(new URL("../app/StudentAffairsApp.tsx", import.meta.url), "utf8");

  assert.match(source, /GenericImportDialog/);
  assert.match(source, /primaryAction\.includes\("导入"\)/);
  assert.match(source, /通用数据导入模板/);
  assert.match(source, /导入预览/);
});

test("gives every non-student feature an explicit page presentation", async () => {
  const [dataSource, metadataSource] = await Promise.all([
    readFile(new URL("../app/system-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/feature-metadata.ts", import.meta.url), "utf8"),
  ]);
  const featureBlocks = [...dataSource.matchAll(/features:\s*\[(.*?)\]/gs)];
  const featureIds = featureBlocks.flatMap((block) =>
    [...block[1].matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1]),
  );
  const configuredIds = new Set(
    [...metadataSource.matchAll(/^\s{2}(?:"([^"]+)"|([A-Za-z][\w-]*)):\s*\{\s*variant:/gm)]
      .map((match) => match[1] || match[2]),
  );
  const missing = featureIds.filter((id) => id !== "students" && !configuredIds.has(id));

  assert.deepEqual(missing, []);
  assert.equal(featureIds.length, 127);
});

test("matches the source student list filters, columns, and pagination controls", async () => {
  const source = await readFile(new URL("../app/StudentAffairsApp.tsx", import.meta.url), "utf8");

  for (const filter of ["姓名", "学号", "手机号", "院系名称", "专业名称", "班级名称", "年级"]) {
    assert.match(source, new RegExp(`label: "${filter}"`));
  }
  assert.match(source, /"出生日期", "现住址"/);
  assert.match(source, /每页 10 条/);
  assert.match(source, /跳至/);
  assert.match(source, /setCurrentPage/);
});

test("implements a usable three-step workflow model designer", async () => {
  const source = await readFile(new URL("../app/WorkflowDesignModule.tsx", import.meta.url), "utf8");

  assert.match(source, /WorkflowDesignModule/);
  assert.match(source, /ModelDesigner/);
  assert.match(source, /选择表单/);
  assert.match(source, /设计流程/);
  assert.match(source, /完成发布/);
  assert.match(source, /添加审批节点/);
  assert.match(source, /添加抄送节点/);
});

test("supports form design, workflow deployment versions, and activation", async () => {
  const [source, appSource] = await Promise.all([
    readFile(new URL("../app/WorkflowDesignModule.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/StudentAffairsApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(source, /FormDesigner/);
  assert.match(source, /字段组件库/);
  assert.match(source, /部署新版本/);
  assert.match(source, /挂起/);
  assert.match(source, /激活/);
  assert.match(source, /更改分类/);
  assert.match(appSource, /<WorkflowDesignModule key=\{activeFeature\}/);
});

test("updates workflow nodes and deployments immutably", async () => {
  const { appendWorkflowNode, deployModelVersion, toggleDeploymentStatus } = await import("../app/workflow-utils.js");
  const nodes = [{ id: "start", type: "start", name: "开始" }, { id: "end", type: "end", name: "结束" }];
  const nextNodes = appendWorkflowNode(nodes, "approval");

  assert.equal(nodes.length, 2);
  assert.equal(nextNodes.length, 3);
  assert.equal(nextNodes[1].type, "approval");

  const deployments = [{ id: "leave:1", modelKey: "leave", version: 1, status: "激活" }];
  const nextDeployments = deployModelVersion(deployments, { key: "leave", name: "请假申请", category: "学生事务" });
  assert.equal(deployments.length, 1);
  assert.equal(nextDeployments[0].version, 2);
  assert.equal(nextDeployments[0].status, "激活");

  const suspended = toggleDeploymentStatus(nextDeployments, nextDeployments[0].id);
  assert.equal(suspended[0].status, "挂起");
  assert.equal(nextDeployments[0].status, "激活");
});
