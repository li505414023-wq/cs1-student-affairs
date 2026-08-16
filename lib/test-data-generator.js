const surnames = ["林", "周", "陈", "许", "沈", "顾", "宋", "江", "叶", "陆", "苏", "程", "夏", "温", "唐", "乔", "方", "何", "罗", "秦"];
const givenNames = ["晓晨", "言川", "清禾", "星野", "知夏", "明澈", "知遥", "予安", "清欢", "景行", "云舟", "书宁", "若溪", "怀瑾", "嘉树", "思齐", "雨桐", "嘉言", "子衿", "望舒"];
const faculties = [
  { faculty: "信息工程学院", majors: ["软件技术", "计算机应用", "大数据技术"], classes: ["软件2601", "计应2502", "大数据2401"] },
  { faculty: "商学院", majors: ["电子商务", "现代物流", "市场营销"], classes: ["电商2601", "物流2501", "营销2402"] },
  { faculty: "智能制造学院", majors: ["机电一体化", "工业机器人", "数控技术"], classes: ["机电2602", "机器人2501", "数控2401"] },
  { faculty: "艺术设计学院", majors: ["视觉传达", "环境艺术", "数字媒体"], classes: ["视传2601", "环艺2502", "数媒2401"] },
  { faculty: "人文教育学院", majors: ["学前教育", "商务英语", "旅游管理"], classes: ["学前2603", "商英2501", "旅游2402"] },
];
const statuses = ["正常", "待审核", "已通过", "处理中", "已完成", "已归档"];
const categories = ["学生事务", "助困事务", "奖惩事务", "宿舍事务", "迎新事务"];

function seedHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFactory(seed) {
  let state = seedHash(seed) || 1;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(items, random) {
  return items[Math.floor(random() * items.length)];
}

function deterministicId(prefix, index, random) {
  const token = Math.floor(random() * 0xffffffff).toString(16).padStart(8, "0");
  return `${prefix}-${String(index + 1).padStart(4, "0")}-${token}`;
}

function dateAt(index, daySpan = 365) {
  const base = Date.UTC(2026, 6, 19, 8, 0, 0);
  return new Date(base - (index % daySpan) * 86_400_000 - (index % 24) * 3_600_000);
}

export function extractFeatureIds(source) {
  const blocks = [...String(source).matchAll(/features:\s*\[(.*?)\]/gs)];
  const ids = blocks.flatMap((block) => [...block[1].matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1]));
  return [...new Set(ids)];
}

function createStudents(count, random) {
  return Array.from({ length: count }, (_, index) => {
    const organization = faculties[index % faculties.length];
    const grade = String(2024 + (index % 3));
    const sequence = String(index + 1).padStart(4, "0");
    const name = `${pick(surnames, random)}${pick(givenNames, random)}`;
    return {
      id: deterministicId("student", index, random),
      name,
      no: `TEST${grade}${sequence}`,
      phone: `199${String(index).padStart(8, "0")}`,
      gender: index % 2 === 0 ? "女" : "男",
      faculty: organization.faculty,
      major: organization.majors[index % organization.majors.length],
      className: organization.classes[index % organization.classes.length],
      grade,
      birthDate: `${2006 + (index % 3)}-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 27) + 1).padStart(2, "0")}`,
      address: `${index % 2 === 0 ? "滨湖" : "城南"}校区${pick(["海棠", "梧桐", "银杏", "玉兰"], random)}公寓${(index % 8) + 1}号楼`,
      status: index % 31 === 0 ? "休学" : "在读",
    };
  });
}

function businessData(featureId, index, student, random) {
  const status = statuses[index % statuses.length];
  const amount = 500 + (index % 20) * 250;
  const createdAt = dateAt(index + Math.floor(random() * 30));
  return {
    编号: `${featureId.toUpperCase()}-${String(index + 1).padStart(5, "0")}`,
    业务名称: `${featureId}测试记录${index + 1}`,
    姓名: student.name,
    学号: student.no,
    手机号: student.phone,
    院系: student.faculty,
    院系名称: student.faculty,
    专业: student.major,
    专业名称: student.major,
    班级: student.className,
    班级名称: student.className,
    年级: student.grade,
    校区: index % 2 === 0 ? "滨湖校区" : "城南校区",
    楼栋名称: `${pick(["海棠", "梧桐", "银杏", "玉兰"], random)}${(index % 8) + 1}号楼`,
    房间号: String(101 + (index % 500)),
    床位号: `${(index % 6) + 1}号床`,
    类型名称: pick(["日常事务", "专项申请", "临时事项", "综合业务"], random),
    批次名称: `${student.grade}-${Number(student.grade) + 1}学年测试批次`,
    申请日期: createdAt.toISOString().slice(0, 10),
    创建时间: createdAt.toISOString().replace("T", " ").slice(0, 19),
    金额: amount,
    应到人数: 320 + (index % 80),
    已到人数: 280 + (index % 40),
    未到人数: 20 + (index % 20),
    报到率: `${88 + (index % 11)}%`,
    状态: status,
    审核状态: status,
    启用状态: index % 9 === 0 ? "停用" : "启用",
    住宿状态: index % 7 === 0 ? "待入住" : "在住",
    考勤状态: index % 13 === 0 ? "晚归" : "正常",
    维修状态: pick(["待派单", "维修中", "已完成"], random),
    备注: "系统随机生成的虚构测试数据",
  };
}

function createWorkflows(random) {
  const forms = Array.from({ length: 12 }, (_, index) => ({
    id: deterministicId("test-form", index, random),
    key: `test_form_${String(index + 1).padStart(2, "0")}`,
    name: `${pick(categories, random)}测试表单${index + 1}`,
    type: pick(["内置表单", "节点独立表单"], random),
    status: "启用",
    fields: [
      { id: `field-${index}-1`, type: "单行文本", label: "申请事项", required: true },
      { id: `field-${index}-2`, type: "多行文本", label: "申请说明", required: true },
      { id: `field-${index}-3`, type: "附件", label: "证明材料", required: false },
    ],
  }));
  const models = Array.from({ length: 16 }, (_, index) => ({
    id: deterministicId("test-model", index, random),
    key: `test_flow_${String(index + 1).padStart(2, "0")}`,
    name: `${pick(categories, random)}审批流程${index + 1}`,
    category: categories[index % categories.length],
    description: "系统随机生成的流程模型，用于本地全链路测试",
    formId: forms[index % forms.length].id,
    version: (index % 4) + 1,
    status: index < 12 ? "已部署" : "草稿",
    nodes: [
      { id: `node-${index}-start`, type: "start", name: "开始" },
      { id: `node-${index}-submit`, type: "submit", name: "申请人提交", assignee: "流程发起人" },
      { id: `node-${index}-review`, type: "approval", name: index % 2 === 0 ? "辅导员审批" : "院系审批", assignee: index % 2 === 0 ? "辅导员" : "院系管理员" },
      { id: `node-${index}-end`, type: "end", name: "结束" },
    ],
  }));
  const deployments = models.slice(0, 12).map((model, index) => ({
    id: deterministicId("test-deployment", index, random),
    modelKey: model.key,
    modelName: model.name,
    category: model.category,
    version: model.version,
    status: index % 7 === 0 ? "挂起" : "激活",
    deployedAt: dateAt(index, 60).toISOString(),
  }));
  return { forms, models, deployments };
}

export function createTestDataset({ seed, featureIds, studentCount = 500, recordsPerFeature = 8 }) {
  if (!Array.isArray(featureIds) || featureIds.length === 0) throw new RangeError("至少需要一个功能标识");
  if (!Number.isInteger(studentCount) || studentCount < 1 || studentCount > 10_000) throw new RangeError("学生数量必须在 1 到 10000 之间");
  if (!Number.isInteger(recordsPerFeature) || recordsPerFeature < 1 || recordsPerFeature > 1000) throw new RangeError("每个功能的记录数量必须在 1 到 1000 之间");
  const uniqueFeatureIds = [...new Set(featureIds)];
  const random = randomFactory(seed);
  const students = createStudents(studentCount, random);
  // 审批人匹配靠「用户 role + role_tags 中文标签」与流程节点 assignee 对齐，
  // 必须建成真实审批角色，否则三级评审的院系审核/宿管审核节点无人认领。
  const users = [
    { id: deterministicId("test-user", 0, random), username: "test_counselor_01", displayName: "测试辅导员一", role: "counselor", roleTags: ["辅导员", "班主任"] },
    { id: deterministicId("test-user", 1, random), username: "test_counselor_02", displayName: "测试辅导员二", role: "counselor", roleTags: ["辅导员", "班主任"] },
    { id: deterministicId("test-user", 2, random), username: "test_faculty", displayName: "测试院系管理员", role: "department_admin", roleTags: ["院系管理员", "部门管理员"] },
    { id: deterministicId("test-user", 3, random), username: "test_dorm", displayName: "测试宿管员", role: "dorm_manager", roleTags: ["宿管员", "宿舍管理员"] },
    { id: deterministicId("test-user", 4, random), username: "test_viewer_01", displayName: "测试只读用户一", role: "viewer", roleTags: ["观察员"] },
    { id: deterministicId("test-user", 5, random), username: "test_viewer_02", displayName: "测试只读用户二", role: "viewer", roleTags: ["观察员"] },
  ];
  const businessRecords = uniqueFeatureIds.flatMap((featureId, featureIndex) => Array.from({ length: recordsPerFeature }, (_, index) => {
    const student = students[(featureIndex * recordsPerFeature + index) % students.length];
    return {
      id: deterministicId("record", featureIndex * recordsPerFeature + index, random),
      featureId,
      data: businessData(featureId, index + featureIndex, student, random),
      status: statuses[(featureIndex + index) % statuses.length],
      createdAt: dateAt(featureIndex * recordsPerFeature + index, 540).toISOString(),
    };
  }));
  const workflows = createWorkflows(random);
  const auditLogs = Array.from({ length: Math.max(200, studentCount) }, (_, index) => ({
    id: deterministicId("test-audit", index, random),
    userIndex: index % users.length,
    action: pick(["create", "update", "review", "approve", "export", "login"], random),
    resourceType: index % 3 === 0 ? "student" : uniqueFeatureIds[index % uniqueFeatureIds.length],
    resourceId: index % 3 === 0 ? students[index % students.length].id : businessRecords[index % businessRecords.length].id,
    detail: { source: "full-test-data", synthetic: true, sequence: index + 1 },
    createdAt: dateAt(index, 180).toISOString(),
  }));
  return { seed: String(seed), users, students, businessRecords, workflowForms: workflows.forms, workflowModels: workflows.models, workflowDeployments: workflows.deployments, auditLogs };
}

