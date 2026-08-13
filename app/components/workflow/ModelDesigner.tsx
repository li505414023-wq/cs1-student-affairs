"use client";

import { useState } from "react";
import { appendWorkflowNode } from "@/app/workflow-utils.js";
import type { WorkflowModel, WorkflowNode } from "./workflow-types";

const workflowCategories = ["全部", "学生事务", "助困事务", "奖惩事务", "宿舍事务", "其他事务"];
const baseNodes: WorkflowNode[] = [
  { id: "start", type: "start", name: "开始" },
  { id: "submit", type: "submit", name: "申请人提交", assignee: "流程发起人" },
  { id: "approve", type: "approval", name: "辅导员审批", assignee: "辅导员" },
  { id: "end", type: "end", name: "结束" },
];

type Form = { id: string; key: string; name: string; type: string; status: string; fields: Array<{ id: string; type: string; label: string; required: boolean }> };

export function ModelDesigner({ model, forms, onClose, onSave }: { model?: WorkflowModel; forms: Form[]; onClose: () => void; onSave: (model: WorkflowModel) => void }) {
  const [step, setStep] = useState(1);
  const [formType, setFormType] = useState("内置表单");
  const [formId, setFormId] = useState(model?.formId ?? forms[0]?.id ?? "");
  const [name, setName] = useState(model?.name ?? "");
  const [key, setKey] = useState(model?.key ?? "");
  const [category, setCategory] = useState(model?.category ?? "学生事务");
  const [description, setDescription] = useState(model?.description ?? "");
  const [nodes, setNodes] = useState<WorkflowNode[]>(model?.nodes ?? baseNodes);
  const selectedForm = forms.find((form) => form.id === formId);
  const finish = () => {
    if (!name.trim() || !key.trim() || !formId) return;
    onSave({ id: model?.id ?? `model-${Date.now()}`, key: key.trim(), name: name.trim(), category, description: description.trim(), formId, version: model?.version ?? 0, status: model?.status ?? "草稿", nodes });
  };
  return <div className="dialog-backdrop" role="presentation"><section className="workflow-designer" role="dialog" aria-modal="true" aria-labelledby="model-designer-title">
    <header><div><h2 id="model-designer-title">{model ? `设计流程：${model.name}` : "新增流程模型"}</h2><p>按原系统的三步顺序完成模型配置</p></div><button aria-label="关闭" onClick={onClose}>×</button></header>
    <ol className="designer-steps"><li className={step >= 1 ? "active" : ""}><span>1</span>选择表单</li><li className={step >= 2 ? "active" : ""}><span>2</span>设计流程</li><li className={step >= 3 ? "active" : ""}><span>3</span>完成发布</li></ol>
    <div className="designer-body">
      {step === 1 && <div className="form-selection"><section><h3>选择表单</h3><div className="radio-row">{["内置表单", "外置表单", "节点独立表单"].map((type) => <label key={type}><input type="radio" name="formType" checked={formType === type} onChange={() => setFormType(type)} />{type}</label>)}</div><label><span>关联表单</span><select value={formId} onChange={(event) => setFormId(event.target.value)}><option value="">请选择表单</option>{forms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}</select></label></section><section className="form-preview"><h3>表单预览</h3>{selectedForm ? <><strong>{selectedForm.name}</strong>{selectedForm.fields.map((field) => <label key={field.id}><span>{field.required && "*"}{field.label}</span><input disabled placeholder={field.type} /></label>)}</> : <p>请选择表单</p>}</section></div>}
      {step === 2 && <div className="process-design"><aside><h3>节点组件</h3><button onClick={() => setNodes((current) => appendWorkflowNode(current, "approval"))}>＋ 添加审批节点</button><button onClick={() => setNodes((current) => appendWorkflowNode(current, "copy"))}>＋ 添加抄送节点</button><button onClick={() => setNodes((current) => appendWorkflowNode(current, "condition"))}>＋ 添加条件分支</button></aside><section><div className="process-toolbar"><strong>流程画布</strong><span>{nodes.length} 个节点</span></div><div className="process-canvas">{nodes.map((node, index) => <article className={`process-node ${node.type}`} key={node.id}><span className="node-order">{index + 1}</span><div><strong>{node.name}</strong><small>{node.assignee ?? "系统节点"}</small></div>{node.type === "condition" ? (
  <div className="condition-config">
    <input
      aria-label={`${node.name}条件表达式`}
      placeholder="如: ${days} > 3"
      value={(node as Record<string, string>).conditionExpression ?? ""}
      onChange={(event) => setNodes((current) => current.map((item) => item.id === node.id ? { ...item, conditionExpression: event.target.value } : item))}
    />
    <label>满足时
      <select aria-label={`${node.name}满足时跳转`} value={(node as Record<string, string>).trueNodeId ?? ""} onChange={(event) => setNodes((current) => current.map((item) => item.id === node.id ? { ...item, trueNodeId: event.target.value || undefined } : item))}>
        <option value="">线性下一节点</option>
        {nodes.filter((other) => other.id !== node.id && !["start", "submit"].includes(other.type)).map((other) => <option key={other.id} value={other.id}>{other.name}</option>)}
      </select>
    </label>
    <label>否则
      <select aria-label={`${node.name}否则跳转`} value={(node as Record<string, string>).falseNodeId ?? ""} onChange={(event) => setNodes((current) => current.map((item) => item.id === node.id ? { ...item, falseNodeId: event.target.value || undefined } : item))}>
        <option value="">线性下一节点</option>
        {nodes.filter((other) => other.id !== node.id && !["start", "submit"].includes(other.type)).map((other) => <option key={other.id} value={other.id}>{other.name}</option>)}
      </select>
    </label>
  </div>
) : !["start", "end"].includes(node.type) && (
  <select aria-label={`${node.name}办理人`} value={node.assignee ?? ""} onChange={(event) => setNodes((current) => current.map((item) => item.id === node.id ? { ...item, assignee: event.target.value } : item))}>
    <option value="辅导员">辅导员</option><option value="院系管理员">院系管理员</option><option value="学工处管理员">学工处管理员</option><option value="宿管员">宿管员</option><option value="班主任">班主任</option><option value="工作人员">工作人员</option>
  </select>
)}
{!["start", "end"].includes(node.type) && <button aria-label={`删除${node.name}`} onClick={() => setNodes((current) => current.filter((item) => item.id !== node.id))}>×</button>}</article>)}</div></section></div>}
      {step === 3 && <div className="model-completion"><h3>模型基本信息</h3><div className="form-grid"><label><span>* 模型名称</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：请假申请" /></label><label><span>* 模型key</span><input value={key} onChange={(event) => setKey(event.target.value)} placeholder="例如：leave" /></label><label><span>流程分类</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{workflowCategories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label><span>关联表单</span><input disabled value={selectedForm?.name ?? ""} /></label><label className="wide-field"><span>模型描述</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="说明流程适用范围和审批规则" /></label></div><div className="completion-summary"><span>表单 <strong>{selectedForm?.name}</strong></span><span>节点 <strong>{nodes.length}</strong></span><span>保存后状态 <strong>{model?.status ?? "草稿"}</strong></span></div></div>}
    </div>
    <footer><button className="ghost" onClick={onClose}>取消</button>{step > 1 && <button className="ghost" onClick={() => setStep((current) => current - 1)}>上一步</button>}{step < 3 ? <button className="primary" disabled={step === 1 && !formId} onClick={() => setStep((current) => current + 1)}>下一步</button> : <button className="primary" disabled={!name.trim() || !key.trim()} onClick={finish}>完成发布</button>}</footer>
  </section></div>;
}
