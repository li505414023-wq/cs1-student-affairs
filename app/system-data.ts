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
      { label: "学籍异动", features: [{ id: "status-change", label: "学籍异动管理", stage: "review" }] },
      { label: "学生干部", features: [{ id: "student-cadre", label: "学生干部管理", stage: "review" }] },
      { label: "节假日去向", features: [{ id: "return-school", label: "返校管理", stage: "review" }, { id: "holiday", label: "节假日管理", stage: "config" }] },
      { label: "投诉管理", features: [{ id: "complaints", label: "投诉管理", stage: "review" }] },
      { label: "处分申诉", features: [{ id: "appeal", label: "处分申诉", stage: "apply" }] },
    ],
  },
  {
    id: "aid",
    label: "助困管理",
    icon: "助",
    children: [
      { label: "勤工助学", features: [{ id: "work-study", label: "勤工助学管理", stage: "review" }, { id: "employers", label: "用人单位管理", stage: "config" }, { id: "jobs", label: "岗位管理", stage: "config" }] },
      { label: "困难补助", features: [{ id: "hardship", label: "困难补助", stage: "review" }] },
      { label: "助学金", features: [{ id: "grants", label: "助学金评定", stage: "review" }] },
      { label: "学费减免", features: [{ id: "tuition-reduction", label: "学费减免申请", stage: "review" }] },
      { label: "助学贷款", features: [{ id: "loans", label: "贷款管理", stage: "review" }] },
    ],
  },
  {
    id: "reward",
    label: "奖罚管理",
    icon: "奖",
    children: [
      { label: "奖学金管理", features: [{ id: "scholarship", label: "奖学金评定", stage: "review" }] },
      { label: "荣誉称号管理", features: [{ id: "honor", label: "荣誉称号", stage: "review" }] },
      { label: "违纪处分", features: [{ id: "discipline", label: "违纪管理", stage: "apply" }, { id: "punishment", label: "处分管理", stage: "review" }, { id: "revoke", label: "处分撤销", stage: "review" }, { id: "discipline-type", label: "违纪类型", stage: "config" }, { id: "punishment-type", label: "处分类型", stage: "config" }] },
    ],
  },
  {
    id: "league",
    label: "团委工作",
    icon: "团",
    children: [
      { label: "社团管理", features: [{ id: "clubs", label: "学生社团" }, { id: "club-apply", label: "成立社团申请", stage: "apply" }] },
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
    { label: "迎新统计", features: [{ id: "welcome-stats", label: "迎新统计", stage: "archive" }] },
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
    { label: "押金管理", features: [{ id: "dorm-deposit", label: "宿舍押金管理", stage: "review" }] },
  ] },
  { id: "dorm-allocation", label: "学生排宿", icon: "排", children: [
    { label: "批次管理", features: [{ id: "dorm-batch", label: "批量排宿", stage: "batch" }] },
    { label: "分配管理", features: [{ id: "dorm-assign", label: "分配宿舍", stage: "review" }] },
  ] },
  { id: "dorm-application", label: "住宿申办", icon: "住", children: [
    { label: "住宿申办", features: [{ id: "dorm-checkin", label: "住宿申办", stage: "apply" }] },
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
    { label: "学生大队", features: [{ id: "corps-admin", label: "学生大队管理", stage: "config" }] },
  ] },
  { id: "police-discipline", label: "日常纪律", icon: "纪", children: [
    { label: "早操管理", features: [{ id: "morning-exercise", label: "早操考勤", stage: "review" }] },
    { label: "警容风纪", features: [{ id: "appearance-inspection", label: "警容风纪检查", stage: "review" }] },
    { label: "操行分", features: [{ id: "conduct-score", label: "操行分登记", stage: "review" }, { id: "conduct-score-stats", label: "操行分统计", stage: "archive" }] },
    { label: "课堂考勤", features: [{ id: "class-attendance", label: "课前集队考勤", stage: "review" }, { id: "evening-rollcall", label: "晚点名考勤", stage: "review" }, { id: "absence-warning", label: "旷课累计预警", stage: "archive" }] },
  ] },
  { id: "police-eval", label: "综合素质", icon: "评", children: [
    { label: "课程成绩", features: [{ id: "course-scores", label: "课程成绩管理", stage: "review" }] },
    { label: "综合素质考核", features: [{ id: "comprehensive-eval", label: "综合素质考核", stage: "archive" }] },
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
    { label: "我的事务", features: [{ id: "new-flow", label: "新建流程", stage: "apply" }, { id: "todo", label: "待办事宜", stage: "review" }, { id: "my-request", label: "我的请求", stage: "review" }, { id: "done", label: "已办结", stage: "archive" }] },
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

export const workflow = ["基础配置", "批次发布", "学生申请", "分级审核", "结果归档"];
