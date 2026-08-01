"use client";

import { useState } from "react";
import { ModuleTitle } from "./ModuleTitle";
import { FormDesigner } from "./FormDesigner";
import type { WorkflowForm } from "./workflow-types";

type Props = {
  forms: WorkflowForm[];
  setForms: React.Dispatch<React.SetStateAction<WorkflowForm[]>>;
};

export function FormPage({ forms, setForms }: Props) {
  const [editor, setEditor] = useState<WorkflowForm | "new" | null>(null);
  const [notice, setNotice] = useState("");
  return <section className="workflow-workbench">
    {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
    <ModuleTitle title="表单设计" description="组合字段组件，形成可被流程模型引用的业务表单。" action="新建表单" onAction={() => setEditor("new")} />
    <div className="workflow-table"><table><thead><tr><th>表单名称</th><th>表单编码</th><th>表单类型</th><th>字段数量</th><th>状态</th><th>操作</th></tr></thead><tbody>{forms.map((form) => <tr key={form.id}><td><strong>{form.name}</strong></td><td><code>{form.key}</code></td><td>{form.type}</td><td>{form.fields.length}</td><td><span className="status">{form.status}</span></td><td><button className="link-button" onClick={() => setEditor(form)}>设计</button><button className="link-button" onClick={() => setForms((current) => current.map((item) => item.id === form.id ? { ...item, status: item.status === "启用" ? "停用" : "启用" } : item))}>{form.status === "启用" ? "停用" : "启用"}</button></td></tr>)}</tbody></table></div>
    {editor && <FormDesigner form={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSave={(form) => { setForms((current) => current.some((item) => item.id === form.id) ? current.map((item) => item.id === form.id ? form : item) : [form, ...current]); setEditor(null); setNotice(`${form.name}已保存`); }} />}
  </section>;
}
