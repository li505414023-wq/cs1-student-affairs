export type Feature = {
  id: string;
  label: string;
  stage?: "config" | "batch" | "apply" | "review" | "archive";
};

export type FeatureGroup = {
  id: string;
  label: string;
  icon: string;
  children: Array<{ label: string; features: Feature[] }>;
};

export const featureGroups: FeatureGroup[] = [
  {
    id: "home",
    label: "我的首页",
    icon: "首",
    children: [{ label: "我的首页", features: [{ id: "student-home", label: "我的首页" }] }],
  },
  {
    id: "class",
    label: "班级管理",
    icon: "班",
    children: [{ label: "班级管理", features: [{ id: "classes", label: "班级管理" }] }],
  },
  {
    id: "student",
    label: "学生管理",
    icon: "学",
    children: [
      { label: "学生管理", features: [{ id: "students", label: "学生管理" }] },
      {
        label: "缴费管理",
        features: [
          { id: "payments", label: "缴费管理" },
          { id: "payment-proof", label: "缴费凭证" },
        ],
      },
    ],
  },
  {
    id: "affairs",
    label: "学生事务",
    icon: "事",
    children: [
      { label: "学生请假", features: [{ id: "leave", label: "请假管理", stage: "apply" }, { id: "leave-type", label: "请假类型", stage: "config" }] },
      { label: "学生销假", features: [{ id: "leave-cancel", label: "销假管理", stage: "review" }] },
      { label: "学生证补办", features: [{ id: "student-card", label: "学生证管理", stage: "apply" }] },
      { label: "节假日去向", features: [{ id: "return-school", label: "返校管理", stage: "review" }, { id: "holiday", label: "节假日管理", stage: "config" }] },
      { label: "投诉管理", features: [{ id: "complaints", label: "投诉管理", stage: "review" }] },
    ],
  },
  {
    id: "aid",
    label: "助困管理",
    icon: "助",
    children: [
      { label: "勤工助学", features: [{ id: "work-study", label: "勤工助学管理", stage: "review" }, { id: "employers", label: "用人单位管理", stage: "config" }, { id: "jobs", label: "岗位管理", stage: "config" }] },
      { label: "困难补助", features: [{ id: "hardship", label: "困难补助管理", stage: "review" }, { id: "hardship-type", label: "困难补助种类", stage: "config" }, { id: "hardship-batch", label: "困难补助批次", stage: "batch" }] },
      { label: "助学金", features: [{ id: "grants", label: "助学金评定", stage: "review" }, { id: "grant-type", label: "助学金种类", stage: "config" }, { id: "grant-batch", label: "助学金批次", stage: "batch" }, { id: "grant-mutex", label: "不可兼得设置", stage: "config" }] },
      { label: "学费减免", features: [{ id: "tuition-reduction", label: "学费减免申请", stage: "review" }] },
      { label: "助学贷款", features: [{ id: "loans", label: "贷款管理", stage: "review" }] },
    ],
  },
  {
    id: "reward",
    label: "奖罚管理",
    icon: "奖",
    children: [
      { label: "奖学金管理", features: [{ id: "scholarship", label: "奖学金评定", stage: "review" }, { id: "scholarship-type", label: "奖学金种类", stage: "config" }, { id: "scholarship-batch", label: "奖学金批次", stage: "batch" }, { id: "scholarship-mutex", label: "不可兼得设置", stage: "config" }] },
      { label: "荣誉称号管理", features: [{ id: "personal-honor", label: "个人荣誉称号管理", stage: "review" }, { id: "collective-honor", label: "集体荣誉称号管理", stage: "review" }, { id: "honor-type", label: "荣誉称号种类", stage: "config" }, { id: "honor-batch", label: "荣誉称号批次", stage: "batch" }] },
      { label: "违纪处分", features: [{ id: "discipline", label: "违纪管理", stage: "apply" }, { id: "discipline-view", label: "违纪查看", stage: "archive" }, { id: "punishment", label: "处分管理", stage: "review" }, { id: "appeal", label: "处分申诉", stage: "review" }, { id: "revoke", label: "处分撤销", stage: "review" }, { id: "discipline-type", label: "违纪类型", stage: "config" }, { id: "punishment-type", label: "处分类型", stage: "config" }] },
    ],
  },
  {
    id: "league",
    label: "团委工作",
    icon: "团",
    children: [
      { label: "社团管理", features: [{ id: "clubs", label: "学生社团" }, { id: "club-apply", label: "成立社团申请", stage: "apply" }, { id: "managed-clubs", label: "我管理的社团" }, { id: "started-clubs", label: "我发起的社团" }, { id: "joined-clubs", label: "我参加的社团" }] },
      { label: "团员团籍", features: [{ id: "league-member", label: "入团管理", stage: "review" }] },
      { label: "第二课堂", features: [{ id: "second-class", label: "第二课堂管理", stage: "review" }, { id: "transcript", label: "第二课堂成绩单", stage: "archive" }, { id: "second-class-rules", label: "第二课堂规则设置", stage: "config" }] },
    ],
  },
  {
    id: "graduation",
    label: "毕业离校管理",
    icon: "毕",
    children: [
      { label: "离校管理", features: [{ id: "leaving", label: "离校管理", stage: "review" }] },
      { label: "毕业生去向", features: [{ id: "graduate-direction", label: "毕业生去向管理", stage: "archive" }] },
    ],
  },
];

export const welcomeFeatureGroups: FeatureGroup[] = [
  { id: "welcome-online", label: "在线迎新", icon: "迎", children: [
    { label: "迎新报到", features: [{ id: "card-checkin", label: "刷卡报到", stage: "review" }, { id: "manual-checkin", label: "人工报到", stage: "review" }] },
  ] },
  { id: "welcome-payment", label: "缴费情况", icon: "费", children: [
    { label: "缴费管理", features: [{ id: "welcome-payment-list", label: "缴费管理", stage: "review" }, { id: "welcome-payment-proof", label: "缴费凭证", stage: "archive" }] },
  ] },
  { id: "welcome-stats", label: "迎新统计", icon: "统", children: [
    { label: "报到统计", features: [{ id: "faculty-checkin-stats", label: "学院报到统计", stage: "archive" }, { id: "class-checkin-stats", label: "班级报到统计", stage: "archive" }, { id: "live-checkin-stats", label: "报到实时分析", stage: "archive" }] },
    { label: "迎新统计", features: [{ id: "supplies-stats", label: "生活用品统计", stage: "archive" }, { id: "transport-stats", label: "乘车信息统计", stage: "archive" }, { id: "payment-stats", label: "缴费信息统计", stage: "archive" }, { id: "step-stats", label: "环节统计", stage: "archive" }, { id: "nation-stats", label: "民族统计", stage: "archive" }, { id: "welcome-dorm-stats", label: "宿舍统计", stage: "archive" }] },
  ] },
  { id: "welcome-publish", label: "迎新发布", icon: "发", children: [
    { label: "报到须知", features: [{ id: "welcome-notes", label: "报到须知", stage: "config" }] },
    { label: "常见问题", features: [{ id: "welcome-faq", label: "常见问题", stage: "config" }] },
  ] },
  { id: "welcome-config", label: "迎新配置", icon: "配", children: [
    { label: "迎新批次", features: [{ id: "welcome-batch", label: "批次设置", stage: "batch" }] },
    { label: "迎新流程", features: [{ id: "welcome-process", label: "迎新流程", stage: "config" }] },
  ] },
];

export const dormFeatureGroups: FeatureGroup[] = [
  { id: "dorm-base", label: "宿舍管理", icon: "宿", children: [
    { label: "楼栋管理", features: [{ id: "dorm-building", label: "楼栋管理", stage: "config" }] },
    { label: "宿舍管理", features: [{ id: "dorm-room", label: "宿舍管理", stage: "config" }] },
    { label: "入住情况", features: [{ id: "dorm-occupancy", label: "入住情况", stage: "archive" }] },
  ] },
  { id: "dorm-allocation", label: "学生排宿", icon: "排", children: [
    { label: "批次管理", features: [{ id: "dorm-batch", label: "批量排宿", stage: "batch" }] },
    { label: "分配管理", features: [{ id: "dorm-assign", label: "分配宿舍", stage: "review" }] },
  ] },
  { id: "dorm-application", label: "住宿申办", icon: "住", children: [
    { label: "住宿申办", features: [{ id: "dorm-checkin", label: "入住", stage: "apply" }, { id: "dorm-transfer", label: "调整宿舍", stage: "apply" }, { id: "dorm-checkout", label: "退宿", stage: "apply" }, { id: "holiday-dorm", label: "假期宿舍", stage: "apply" }, { id: "delayed-checkout", label: "延缓退宿", stage: "apply" }] },
  ] },
  { id: "dorm-movement", label: "住调退", icon: "调", children: [
    { label: "住调退", features: [{ id: "dorm-movement-list", label: "住调退", stage: "review" }, { id: "dorm-movement-log", label: "调动日志", stage: "archive" }] },
  ] },
  { id: "dorm-hygiene", label: "宿舍卫生", icon: "卫", children: [
    { label: "宿舍卫生", features: [{ id: "room-hygiene", label: "检查登记", stage: "review" }] },
    { label: "个人卫生", features: [{ id: "student-hygiene", label: "个人检查登记", stage: "review" }] },
    { label: "卫生管理", features: [{ id: "hygiene-deduction", label: "卫生扣分设置", stage: "config" }] },
  ] },
  { id: "dorm-discipline", label: "宿舍违纪", icon: "纪", children: [
    { label: "宿舍违纪", features: [{ id: "dorm-discipline", label: "宿舍违纪", stage: "review" }, { id: "dorm-discipline-type", label: "违纪类型", stage: "config" }] },
  ] },
  { id: "dorm-attendance", label: "宿舍考勤", icon: "勤", children: [
    { label: "宿舍考勤", features: [{ id: "dorm-attendance", label: "宿舍考勤", stage: "review" }, { id: "dorm-attendance-stats", label: "考勤统计", stage: "archive" }] },
    { label: "考勤管理", features: [{ id: "attendance-exception-type", label: "异常类型设置", stage: "config" }] },
    { label: "定位管理", features: [{ id: "location-rule", label: "定位规则", stage: "config" }] },
  ] },
  { id: "dorm-repair", label: "宿舍报修", icon: "修", children: [
    { label: "宿舍报修", features: [{ id: "dorm-repair", label: "宿舍报修", stage: "review" }] },
  ] },
];

export const policeFeatureGroups: FeatureGroup[] = [
  { id: "police-org", label: "组织架构", icon: "队", children: [
    { label: "区队管理", features: [{ id: "platoon", label: "区队管理", stage: "config" }] },
  ] },
  { id: "police-discipline", label: "日常纪律", icon: "纪", children: [
    { label: "早操管理", features: [{ id: "morning-exercise", label: "早操考勤", stage: "review" }] },
    { label: "警容风纪", features: [{ id: "appearance-inspection", label: "警容风纪检查", stage: "review" }] },
    { label: "操行分", features: [{ id: "conduct-score", label: "操行分登记", stage: "review" }, { id: "conduct-score-stats", label: "操行分统计", stage: "archive" }] },
  ] },
  { id: "police-training", label: "体能训练", icon: "训", children: [
    { label: "体能测试", features: [{ id: "physical-test", label: "体测记录", stage: "review" }] },
    { label: "警务训练", features: [{ id: "police-training", label: "训练考勤", stage: "review" }] },
  ] },
  { id: "police-duty", label: "执勤应急", icon: "勤", children: [
    { label: "执勤管理", features: [{ id: "duty-assignment", label: "执勤安排", stage: "review" }] },
    { label: "应急演练", features: [{ id: "emergency-drill", label: "应急演练记录", stage: "review" }] },
  ] },
  { id: "police-political", label: "政工档案", icon: "政", children: [
    { label: "政治审查", features: [{ id: "political-review", label: "政审档案", stage: "archive" }] },
  ] },
];

export const adminFeatureGroups: FeatureGroup[] = [
  { id: "workflow", label: "协同办公", icon: "流", children: [
    { label: "流程设计", features: [{ id: "model-design", label: "模型设计", stage: "config" }, { id: "form-design", label: "表单设计", stage: "config" }, { id: "deployment", label: "部署管理", stage: "config" }, { id: "flow-button", label: "流程按钮", stage: "config" }, { id: "flow-category", label: "流程分类", stage: "config" }, { id: "form-default", label: "表单默认值", stage: "config" }, { id: "flow-expression", label: "流程表达式", stage: "config" }] },
    { label: "我的事务", features: [{ id: "new-flow", label: "新建流程", stage: "apply" }, { id: "todo", label: "待办事宜", stage: "review" }, { id: "my-request", label: "我的请求", stage: "review" }, { id: "my-done", label: "我的已办", stage: "archive" }, { id: "finished", label: "办结事宜", stage: "archive" }, { id: "claim", label: "待签事务", stage: "review" }, { id: "copied", label: "抄送事宜", stage: "archive" }] },
    { label: "流程运维", features: [{ id: "ops-schedule", label: "运维调度", stage: "review" }, { id: "ops-finished", label: "办结流程", stage: "archive" }, { id: "process-list", label: "流程列表", stage: "archive" }, { id: "process-agent", label: "流程代理", stage: "config" }] },
  ] },
  { id: "political-work", label: "政工管理", icon: "政", children: [
    { label: "政工管理", features: [{ id: "team-building", label: "队伍建设", stage: "review" }, { id: "headteacher-query", label: "班主任任职查询", stage: "archive" }] },
  ] },
  { id: "campus-publish", label: "校内发布", icon: "发", children: [
    { label: "首页轮播", features: [{ id: "home-carousel", label: "首页轮播", stage: "config" }] },
    { label: "通知公告", features: [{ id: "announcement", label: "通知公告", stage: "config" }] },
    { label: "校内新闻", features: [{ id: "campus-news", label: "校内新闻", stage: "config" }] },
  ] },
  { id: "faculty-admin", label: "院系管理", icon: "院", children: [
    { label: "学院管理", features: [{ id: "faculty-admin", label: "学院管理", stage: "config" }] },
    { label: "专业管理", features: [{ id: "major-admin", label: "专业管理", stage: "config" }] },
    { label: "班级管理", features: [{ id: "class-admin", label: "班级管理", stage: "config" }] },
  ] },
  { id: "permission", label: "权限管理", icon: "权", children: [
    { label: "权限管理", features: [{ id: "role-admin", label: "角色管理", stage: "config" }, { id: "data-permission", label: "数据权限", stage: "config" }, { id: "api-permission", label: "接口权限", stage: "config" }] },
  ] },
  { id: "system-admin", label: "系统管理", icon: "系", children: [
    { label: "系统管理", features: [{ id: "user-admin", label: "用户管理", stage: "config" }, { id: "org-admin", label: "机构管理", stage: "config" }, { id: "post-admin", label: "岗位管理", stage: "config" }, { id: "system-dict", label: "系统字典", stage: "config" }, { id: "business-dict", label: "业务字典", stage: "config" }, { id: "menu-admin", label: "菜单管理", stage: "config" }, { id: "top-menu", label: "顶部菜单", stage: "config" }] },
  ] },
  { id: "monitor", label: "系统监控", icon: "监", children: [
    { label: "日志管理", features: [{ id: "usual-log", label: "通用日志", stage: "archive" }, { id: "api-log", label: "接口日志", stage: "archive" }, { id: "error-log", label: "错误日志", stage: "archive" }] },
  ] },
];

export type SystemId = "student" | "welcome" | "dorm" | "police" | "admin";
export const systems: Array<{ id: SystemId; label: string; shortLabel: string }> = [
  { id: "student", label: "学工管理系统", shortLabel: "学工" },
  { id: "welcome", label: "迎新管理系统", shortLabel: "迎新" },
  { id: "dorm", label: "宿舍管理系统", shortLabel: "宿舍" },
  { id: "police", label: "警务化管理系统", shortLabel: "警务" },
  { id: "admin", label: "后台管理系统", shortLabel: "后台" },
];

export const systemGroups: Record<SystemId, FeatureGroup[]> = {
  student: featureGroups,
  welcome: welcomeFeatureGroups,
  dorm: dormFeatureGroups,
  police: policeFeatureGroups,
  admin: adminFeatureGroups,
};

export const students = [
  { name: "林晓晨", no: "20260001", phone: "138****1201", gender: "女", faculty: "信息工程学院", major: "软件技术", className: "软件2601", grade: "2026", birthDate: "2008-03-12", address: "滨湖校区学生公寓" },
  { name: "周言川", no: "20260002", phone: "139****3520", gender: "男", faculty: "信息工程学院", major: "计算机应用", className: "计应2602", grade: "2026", birthDate: "2007-11-08", address: "滨湖校区学生公寓" },
  { name: "陈清禾", no: "20250018", phone: "136****6618", gender: "女", faculty: "商学院", major: "电子商务", className: "电商2501", grade: "2025", birthDate: "2007-05-19", address: "城南校区学生公寓" },
  { name: "许星野", no: "20240136", phone: "137****9036", gender: "男", faculty: "智能制造学院", major: "机电一体化", className: "机电2403", grade: "2024", birthDate: "2006-09-25", address: "城南校区学生公寓" },
  { name: "沈知夏", no: "20250107", phone: "135****5107", gender: "女", faculty: "艺术设计学院", major: "视觉传达", className: "视传2502", grade: "2025", birthDate: "2007-01-16", address: "滨湖校区学生公寓" },
  { name: "顾明澈", no: "20260033", phone: "132****4830", gender: "男", faculty: "信息工程学院", major: "软件技术", className: "软件2601", grade: "2026", birthDate: "2008-06-21", address: "滨湖校区学生公寓" },
  { name: "宋知遥", no: "20260046", phone: "131****7926", gender: "女", faculty: "商学院", major: "电子商务", className: "电商2602", grade: "2026", birthDate: "2008-02-14", address: "城南校区学生公寓" },
  { name: "江予安", no: "20250128", phone: "133****2461", gender: "男", faculty: "智能制造学院", major: "机电一体化", className: "机电2501", grade: "2025", birthDate: "2007-07-03", address: "城南校区学生公寓" },
  { name: "叶清欢", no: "20240211", phone: "134****8165", gender: "女", faculty: "艺术设计学院", major: "视觉传达", className: "视传2401", grade: "2024", birthDate: "2006-12-09", address: "滨湖校区学生公寓" },
  { name: "陆景行", no: "20260072", phone: "135****3478", gender: "男", faculty: "信息工程学院", major: "计算机应用", className: "计应2602", grade: "2026", birthDate: "2008-04-27", address: "滨湖校区学生公寓" },
  { name: "温书宁", no: "20250165", phone: "136****9254", gender: "女", faculty: "商学院", major: "电子商务", className: "电商2501", grade: "2025", birthDate: "2007-08-18", address: "城南校区学生公寓" },
  { name: "程叙白", no: "20240308", phone: "137****6082", gender: "男", faculty: "智能制造学院", major: "机电一体化", className: "机电2403", grade: "2024", birthDate: "2006-10-30", address: "城南校区学生公寓" },
];

export const workflow = ["基础配置", "批次发布", "学生申请", "分级审核", "结果归档"];
