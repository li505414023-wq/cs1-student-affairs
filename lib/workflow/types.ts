export type WorkflowStatus = "运行中" | "已完成" | "已拒绝" | "已撤回" | "已挂起" | "已过期" | "退回待修改";

export type NodeAction = "submit" | "approve" | "reject" | "return" | "auto";

export type TaskStatus = "待签收" | "待处理" | "已完成" | "已跳过" | "已过期";

export type TaskResult = "同意" | "退回" | "拒绝";

export interface WorkflowNode {
  id: string;
  type: "start" | "end" | "approval" | "copy" | "condition" | "parallel" | "exclusive" | "submit";
  name: string;
  assignee?: string;
  assigneeType?: "user" | "role" | "creator" | "variable";
  assigneeValue?: string;
  formId?: string;
  conditionExpression?: string;
  dueHours?: number;
  multiInstance?: "sequential" | "parallel";
  requiredVotes?: number;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
  priority?: number;
  default?: boolean;
}

export interface WorkflowModel {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string;
  formId: string;
  version: number;
  status: string;
  nodes: WorkflowNode[];
  edges?: WorkflowEdge[];
}

export interface AdvanceInput {
  instanceId: string;
  nodeId: string;
  action: NodeAction;
  userId: string;
  userRole: string;
  userRoleTags?: string[];
  comment?: string;
  result?: TaskResult;
}

/** Engine-level error carrying an HTTP status for the API layer to surface. */
export class WorkflowError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface ExpressionContext {
  formData: Record<string, unknown>;
  user: { id: string; role: string };
}
