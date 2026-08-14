/**
 * 学生申请类业务对应的真实工作流模型定义（唯一来源）。
 * seed-workflow-models.mjs（幂等补种）与 seed-full-test-data.mjs（演示数据）共用，
 * 避免两处各写一份导致模型 key 漂移（曾发生 dorm-checkin vs declare 不匹配）。
 *
 * 注意：模型 key 必须与 lib/feature-policy.ts 的 FEATURE_MODEL_MAP 对齐。
 */

const standardNodes = [
  { id: "start", name: "开始", type: "start" },
  { id: "submit", name: "申请人提交", type: "submit", assignee: "流程发起人" },
  { id: "approve", name: "辅导员审批", type: "approval", assignee: "辅导员" },
  { id: "end", name: "结束", type: "end" },
];

// 三级评审审批链（助困奖罚：辅导员 → 院系 → 学校）
const reviewThreeLevelNodes = [
  { id: "start", name: "开始", type: "start" },
  { id: "submit", name: "申请人提交", type: "submit", assignee: "流程发起人" },
  { id: "counselor-review", name: "辅导员审核", type: "approval", assignee: "辅导员" },
  { id: "department-review", name: "院系审核", type: "approval", assignee: "院系管理员" },
  { id: "school-review", name: "学校终审", type: "approval", assignee: "系统管理员" },
  { id: "end", name: "结束", type: "end" },
];

// 两级审批链（辅导员 → 学工处）
const reviewTwoLevelNodes = [
  { id: "start", name: "开始", type: "start" },
  { id: "submit", name: "申请人提交", type: "submit", assignee: "流程发起人" },
  { id: "counselor-review", name: "辅导员审核", type: "approval", assignee: "辅导员" },
  { id: "school-review", name: "学工处审核", type: "approval", assignee: "学工处管理员" },
  { id: "end", name: "结束", type: "end" },
];

// 单级审批链（学工处直接处理）
const singleLevelSchoolNodes = [
  { id: "start", name: "开始", type: "start" },
  { id: "submit", name: "申请人提交", type: "submit", assignee: "流程发起人" },
  { id: "school-review", name: "学工处审核", type: "approval", assignee: "学工处管理员" },
  { id: "end", name: "结束", type: "end" },
];

export const REAL_WORKFLOW_MODELS = [
  {
    modelKey: "leave",
    modelName: "请假申请",
    category: "学生事务",
    description: "学生请假分级审批流程（审批链由学生手册规则计算）。",
    formKey: "form-leave",
    formName: "学生请假申请表",
    fields: [
      { id: "f1", type: "下拉选择", label: "请假类型", required: true },
      { id: "f2", type: "日期", label: "开始日期", required: true },
      { id: "f3", type: "多行文本", label: "请假原因", required: true },
    ],
    nodes: standardNodes,
  },
  {
    modelKey: "student-card",
    modelName: "学生证申请",
    category: "学生事务",
    description: "学生证申领/补办申请，辅导员审批。",
    formKey: "form-card",
    formName: "学生证申请表",
    fields: [
      { id: "c1", type: "下拉选择", label: "申请类型", required: true },
      { id: "c2", type: "多行文本", label: "申请说明", required: true },
    ],
    nodes: standardNodes,
  },
  {
    modelKey: "club-apply",
    modelName: "社团申请",
    category: "学生事务",
    description: "社团成立/加入申请，辅导员审批。",
    formKey: "form-club",
    formName: "社团申请表",
    fields: [
      { id: "u1", type: "单行文本", label: "社团名称", required: true },
      { id: "u2", type: "多行文本", label: "申请说明", required: true },
    ],
    nodes: standardNodes,
  },
  {
    modelKey: "appeal",
    modelName: "处分申诉",
    category: "学生事务",
    description: "学生对处分决定提出申诉，接到决定书10日内提交，学申委复查。",
    formKey: "form-appeal",
    formName: "处分申诉表",
    fields: [
      { id: "a1", type: "单行文本", label: "原处分决定", required: true },
      { id: "a2", type: "多行文本", label: "申诉理由", required: true },
    ],
    nodes: [
      { id: "start", name: "开始", type: "start" },
      { id: "submit", name: "申请人提交", type: "submit", assignee: "流程发起人" },
      { id: "appeal-review", name: "学申委复查", type: "approval", assignee: "学工处管理员" },
      { id: "end", name: "结束", type: "end" },
    ],
  },
  {
    modelKey: "declare",
    modelName: "住宿申办",
    category: "宿舍事务",
    description: "入住、调宿、退宿、假期留宿、延缓退宿统一办理流程。",
    formKey: "form-dorm",
    formName: "住宿申办表",
    fields: [
      { id: "f4", type: "下拉选择", label: "申办类型", required: true },
      { id: "f5", type: "多行文本", label: "申办说明", required: true },
    ],
    nodes: [
      { id: "start", name: "开始", type: "start" },
      { id: "submit", name: "申请人提交", type: "submit", assignee: "流程发起人" },
      { id: "dorm-review", name: "宿管审核", type: "approval", assignee: "宿管员" },
      { id: "end", name: "结束", type: "end" },
    ],
  },
  {
    modelKey: "work-study",
    modelName: "勤工助学岗位申请",
    category: "助困事务",
    description: "学生申请勤工助学岗位，辅导员审核后由学工处复核。",
    formKey: "form-work-study",
    formName: "勤工助学申请表",
    fields: [
      { id: "ws1", type: "下拉选择", label: "岗位名称", required: true },
      { id: "ws2", type: "多行文本", label: "申请陈述", required: true },
    ],
    nodes: reviewTwoLevelNodes,
  },
  {
    modelKey: "hardship",
    modelName: "困难补助申请",
    category: "助困事务",
    description: "家庭经济困难学生申请困难补助，辅导员→院系→学校三级评审。",
    formKey: "form-hardship",
    formName: "困难补助申请表",
    fields: [
      { id: "hs1", type: "下拉选择", label: "申请种类", required: true },
      { id: "hs2", type: "下拉选择", label: "申请等级", required: true },
      { id: "hs3", type: "多行文本", label: "申请陈述", required: true },
    ],
    nodes: reviewThreeLevelNodes,
  },
  {
    modelKey: "grants",
    modelName: "助学金申请",
    category: "助困事务",
    description: "学生申请国家助学金，辅导员→院系→学校三级评审。",
    formKey: "form-grants",
    formName: "助学金申请表",
    fields: [
      { id: "gr1", type: "下拉选择", label: "助学金种类", required: true },
      { id: "gr2", type: "下拉选择", label: "申请等级", required: true },
      { id: "gr3", type: "多行文本", label: "申请陈述", required: true },
    ],
    nodes: reviewThreeLevelNodes,
  },
  {
    modelKey: "scholarship",
    modelName: "奖学金申请",
    category: "奖惩事务",
    description: "学生申请奖学金，评优评奖前置校验通过后三级评审。",
    formKey: "form-scholarship",
    formName: "奖学金申请表",
    fields: [
      { id: "sc1", type: "下拉选择", label: "奖学金种类", required: true },
      { id: "sc2", type: "下拉选择", label: "申请等级", required: true },
      { id: "sc3", type: "多行文本", label: "申请陈述", required: true },
    ],
    nodes: reviewThreeLevelNodes,
  },
  {
    modelKey: "tuition-reduction",
    modelName: "学费减免申请",
    category: "助困事务",
    description: "学生申请学费减免，辅导员→院系→学校三级评审。",
    formKey: "form-tuition",
    formName: "学费减免申请表",
    fields: [
      { id: "tr1", type: "多行文本", label: "减免原因", required: true },
      { id: "tr2", type: "多行文本", label: "申请陈述", required: true },
    ],
    nodes: reviewThreeLevelNodes,
  },
  {
    modelKey: "loans",
    modelName: "助学贷款登记",
    category: "助困事务",
    description: "学生登记助学贷款申请，辅导员→院系→学校三级审核。",
    formKey: "form-loans",
    formName: "助学贷款登记表",
    fields: [
      { id: "ln1", type: "单行文本", label: "贷款银行", required: true },
      { id: "ln2", type: "单行文本", label: "贷款金额", required: true },
      { id: "ln3", type: "多行文本", label: "申请陈述", required: true },
    ],
    nodes: reviewThreeLevelNodes,
  },
  {
    modelKey: "personal-honor",
    modelName: "个人荣誉申报",
    category: "奖惩事务",
    description: "学生申报个人荣誉，评优前置校验通过后三级评审。",
    formKey: "form-personal-honor",
    formName: "个人荣誉申报表",
    fields: [
      { id: "ph1", type: "下拉选择", label: "荣誉称号", required: true },
      { id: "ph2", type: "多行文本", label: "申报事迹", required: true },
    ],
    nodes: reviewThreeLevelNodes,
  },
  {
    modelKey: "collective-honor",
    modelName: "集体荣誉申报",
    category: "奖惩事务",
    description: "集体荣誉申报，评优前置校验通过后三级评审。",
    formKey: "form-collective-honor",
    formName: "集体荣誉申报表",
    fields: [
      { id: "ch1", type: "下拉选择", label: "荣誉称号", required: true },
      { id: "ch2", type: "多行文本", label: "申报事迹", required: true },
    ],
    nodes: reviewThreeLevelNodes,
  },
  {
    modelKey: "leave-cancel",
    modelName: "销假申请",
    category: "学生事务",
    description: "请假结束后的销假/返校确认，辅导员审核。",
    formKey: "form-leave-cancel",
    formName: "销假申请表",
    fields: [
      { id: "lc1", type: "多行文本", label: "销假说明", required: true },
    ],
    nodes: standardNodes,
  },
  {
    modelKey: "complaints",
    modelName: "投诉登记",
    category: "学生事务",
    description: "学生提交投诉，学工处按投诉类型归口处理。",
    formKey: "form-complaints",
    formName: "投诉登记表",
    fields: [
      { id: "cp1", type: "下拉选择", label: "投诉类型", required: true },
      { id: "cp2", type: "多行文本", label: "投诉内容", required: true },
    ],
    nodes: singleLevelSchoolNodes,
  },
  {
    modelKey: "league-member",
    modelName: "入团申请",
    category: "团委事务",
    description: "学生提交入团申请，辅导员审核后团委审批。",
    formKey: "form-league",
    formName: "入团申请表",
    fields: [
      { id: "lm1", type: "多行文本", label: "入团动机", required: true },
    ],
    nodes: reviewTwoLevelNodes,
  },
  {
    modelKey: "leaving",
    modelName: "毕业离校申请",
    category: "毕业事务",
    description: "学生发起离校申请，辅导员审核后学工处办结。",
    formKey: "form-leaving",
    formName: "离校申请表",
    fields: [
      { id: "lv1", type: "多行文本", label: "离校说明", required: true },
    ],
    nodes: reviewTwoLevelNodes,
  },
];
