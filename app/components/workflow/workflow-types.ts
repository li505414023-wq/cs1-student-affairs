export type WorkflowNode = { id: string; type: string; name: string; assignee?: string };
export type WorkflowModel = { id: string; key: string; name: string; category: string; description: string; formId: string; version: number; status: string; nodes: WorkflowNode[] };
export type WorkflowField = { id: string; type: string; label: string; required: boolean };
export type WorkflowForm = { id: string; key: string; name: string; type: string; status: string; fields: WorkflowField[] };
export type WorkflowDeployment = { id: string; modelKey: string; modelName: string; category: string; version: number; status: string; deployedAt: string };

export { deployModelVersion, toggleDeploymentStatus } from "@/app/workflow-utils.js";
