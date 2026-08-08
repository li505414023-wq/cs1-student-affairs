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
];
