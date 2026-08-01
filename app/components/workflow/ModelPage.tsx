"use client";

import { useState } from "react";
import { ModuleTitle } from "./ModuleTitle";
import { ModelDesigner } from "./ModelDesigner";
import { deployModelVersion, type WorkflowModel, type WorkflowDeployment } from "./workflow-types";

type Props = {
  models: WorkflowModel[];
  setModels: React.Dispatch<React.SetStateAction<WorkflowModel[]>>;
  forms: { id: string; key: string; name: string; type: string; status: string; fields: Array<{ id: string; type: string; label: string; required: boolean }> }[];
  setDeployments: React.Dispatch<React.SetStateAction<WorkflowDeployment[]>>;
};

export function ModelPage({ models, setModels, forms, setDeployments }: Props) {
  const [editor, setEditor] = useState<WorkflowModel | "new" | null>(null);
  const [keyword, setKeyword] = useState("");
  const [notice, setNotice] = useState("");
  const rows = models.filter((model) => `${model.name}${model.key}`.toLowerCase().includes(keyword.trim().toLowerCase()));
  return <section className="workflow-workbench">
    {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
    <ModuleTitle title="模型设计" description="选择业务表单，配置审批节点并生成可部署的流程模型。" action="新增模型" onAction={() => setEditor("new")} />
    <form className="workflow-search" onSubmit={(event) => event.preventDefault()}><label><span>模型key</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="请输入模型key或模型名称" /></label><button className="primary" type="submit">搜索</button><button className="ghost" type="button" onClick={() => setKeyword("")}>清空</button></form>
    <div className="workflow-table"><table><thead><tr><th>模型key</th><th>模型名称</th><th>分类</th><th>描述</th><th>版本</th><th>状态</th><th>操作</th></tr></thead><tbody>{rows.map((model) => <tr key={model.id}><td><code>{model.key}</code></td><td><strong>{model.name}</strong></td><td>{model.category}</td><td>{model.description}</td><td>v{model.version}</td><td><span className={`status ${model.status === "草稿" ? "pending" : ""}`}>{model.status}</span></td><td><button className="link-button" onClick={() => setEditor(model)}>设计</button><button className="link-button" onClick={() => { setDeployments((current) => deployModelVersion(current, model)); setModels((current) => current.map((item) => item.id === model.id ? { ...item, version: item.version + 1, status: "已部署" } : item)); setNotice(`${model.name}已部署新版本`); }}>部署</button></td></tr>)}</tbody></table></div>
    <footer className="pagination"><span>共 {rows.length} 条模型</span></footer>
    {editor && <ModelDesigner model={editor === "new" ? undefined : editor} forms={forms} onClose={() => setEditor(null)} onSave={(model) => { setModels((current) => current.some((item) => item.id === model.id) ? current.map((item) => item.id === model.id ? model : item) : [model, ...current]); setEditor(null); setNotice(`${model.name}模型已保存`); }} />}
  </section>;
}
