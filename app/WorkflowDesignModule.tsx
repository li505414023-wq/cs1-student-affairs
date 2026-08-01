"use client";

import type { Dispatch, SetStateAction } from "react";
import { ModelPage } from "./components/workflow/ModelPage";
import { FormPage } from "./components/workflow/FormPage";
import { DeploymentPage } from "./components/workflow/DeploymentPage";
import { WorkflowSettingsPage } from "./components/workflow/WorkflowSettingsPage";
import type { WorkflowModel, WorkflowForm, WorkflowDeployment } from "./components/workflow/workflow-types";

export type { WorkflowNode, WorkflowModel, WorkflowField, WorkflowForm, WorkflowDeployment } from "./components/workflow/workflow-types";

const workflowDesignIds = new Set(["model-design", "form-design", "deployment", "flow-button", "flow-category", "form-default", "flow-expression"]);

export function isWorkflowDesignFeature(featureId: string) { return workflowDesignIds.has(featureId); }

const baseNodes: WorkflowModel["nodes"] = [
  { id: "start", type: "start", name: "开始" },
  { id: "submit", type: "submit", name: "申请人提交", assignee: "流程发起人" },
  { id: "approve", type: "approval", name: "辅导员审批", assignee: "辅导员" },
  { id: "end", type: "end", name: "结束" },
];

export const initialWorkflowForms: WorkflowForm[] = [
  { id: "form-leave", key: "leave_form", name: "学生请假申请表", type: "内置表单", status: "启用", fields: [
    { id: "f1", type: "下拉选择", label: "请假类型", required: true },
    { id: "f2", type: "日期", label: "开始日期", required: true },
    { id: "f3", type: "多行文本", label: "请假原因", required: true },
  ] },
  { id: "form-dorm", key: "dorm_form", name: "住宿申办表", type: "内置表单", status: "启用", fields: [
    { id: "f4", type: "下拉选择", label: "申办类型", required: true },
    { id: "f5", type: "多行文本", label: "申办说明", required: true },
  ] },
  { id: "form-award", key: "award_form", name: "奖助申请表", type: "节点独立表单", status: "启用", fields: [
    { id: "f6", type: "金额", label: "申请金额", required: true },
    { id: "f7", type: "附件", label: "证明材料", required: false },
  ] },
];

export const initialWorkflowModels: WorkflowModel[] = [
  { id: "model-leave", key: "leave", name: "请假申请", category: "学生事务", description: "学生请假分级审批流程", formId: "form-leave", version: 1, status: "已部署", nodes: baseNodes },
  { id: "model-dorm", key: "declare", name: "住宿申办", category: "宿舍事务", description: "入住、调宿、退宿统一办理", formId: "form-dorm", version: 1, status: "已部署", nodes: [...baseNodes.slice(0, 2), { id: "dorm-review", type: "approval", name: "宿管审核", assignee: "宿管员" }, ...baseNodes.slice(3)] },
  { id: "model-award", key: "grants", name: "助学金申请", category: "助困事务", description: "院系与学工处两级评审", formId: "form-award", version: 1, status: "草稿", nodes: [...baseNodes.slice(0, 3), { id: "school-review", type: "approval", name: "学工处审批", assignee: "学工处管理员" }, ...baseNodes.slice(3)] },
];

export const initialWorkflowDeployments: WorkflowDeployment[] = initialWorkflowModels.slice(0, 2).map((model) => ({
  id: `${model.key}:1:demo`, modelKey: model.key, modelName: model.name, category: model.category,
  version: 1, status: "激活", deployedAt: "2026-07-19 09:30:00",
}));

type Props = {
  featureId: string;
  models: WorkflowModel[];
  setModels: Dispatch<SetStateAction<WorkflowModel[]>>;
  forms: WorkflowForm[];
  setForms: Dispatch<SetStateAction<WorkflowForm[]>>;
  deployments: WorkflowDeployment[];
  setDeployments: Dispatch<SetStateAction<WorkflowDeployment[]>>;
};

export default function WorkflowDesignModule(props: Props) {
  if (props.featureId === "model-design") return <ModelPage {...props} />;
  if (props.featureId === "form-design") return <FormPage {...props} />;
  if (props.featureId === "deployment") return <DeploymentPage {...props} />;
  return <WorkflowSettingsPage featureId={props.featureId} />;
}
