"use client";

import { useState, useMemo } from "react";
import { ModuleTitle } from "./ModuleTitle";
import { deployModelVersion, toggleDeploymentStatus, type WorkflowModel, type WorkflowDeployment } from "./workflow-types";

const workflowCategories = ["全部", "学生事务", "助困事务", "奖惩事务", "宿舍事务", "其他事务"];

type Props = {
  models: WorkflowModel[];
  setModels: React.Dispatch<React.SetStateAction<WorkflowModel[]>>;
  deployments: WorkflowDeployment[];
  setDeployments: React.Dispatch<React.SetStateAction<WorkflowDeployment[]>>;
};

export function DeploymentPage({ models, setModels, deployments, setDeployments }: Props) {
  const [category, setCategory] = useState("全部");
  const [keyword, setKeyword] = useState("");
  const [notice, setNotice] = useState("");
  const rows = useMemo(() => deployments.filter((item) => (category === "全部" || item.category === category) && `${item.modelName}${item.modelKey}`.toLowerCase().includes(keyword.trim().toLowerCase())), [category, deployments, keyword]);
  const deployable = models.filter((model) => !deployments.some((item) => item.modelKey === model.key));
  return <section className="workflow-workbench deployment-layout">
    <aside className="category-tree"><input aria-label="过滤流程分类" placeholder="输入关键字进行过滤" /><strong>流程分类</strong>{workflowCategories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>▣ {item}</button>)}</aside>
    <div className="deployment-main">{notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}<ModuleTitle title="部署管理" description="管理流程版本、分类以及激活或挂起状态。" />
      {deployable.length > 0 && <div className="deploy-drafts"><strong>待部署模型</strong>{deployable.map((model) => <button key={model.id} onClick={() => { setDeployments((current) => deployModelVersion(current, model)); setModels((current) => current.map((item) => item.id === model.id ? { ...item, version: 1, status: "已部署" } : item)); setNotice(`${model.name}已完成首次部署`); }}>部署 {model.name}</button>)}</div>}
      <form className="workflow-search" onSubmit={(event) => event.preventDefault()}><label><span>流程名称 / 标识</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="请输入流程名称或标识" /></label><button className="primary" type="submit">搜索</button><button className="ghost" type="button" onClick={() => setKeyword("")}>清空</button></form>
      <div className="workflow-table"><table><thead><tr><th>id</th><th>流程名称</th><th>流程标识</th><th>分类</th><th>版本</th><th>状态</th><th>部署时间</th><th>操作</th></tr></thead><tbody>{rows.map((deployment) => { const model = models.find((item) => item.key === deployment.modelKey); return <tr key={deployment.id}><td><code>{deployment.id}</code></td><td><strong>{deployment.modelName}</strong></td><td>{deployment.modelKey}</td><td>{deployment.category}</td><td>v{deployment.version}</td><td><span className={`status ${deployment.status === "挂起" ? "pending" : ""}`}>{deployment.status}</span></td><td>{deployment.deployedAt}</td><td><button className="link-button" onClick={() => { setDeployments((current) => toggleDeploymentStatus(current, deployment.id)); setNotice(`${deployment.modelName}已${deployment.status === "激活" ? "挂起" : "激活"}`); }}>{deployment.status === "激活" ? "挂起" : "激活"}</button>{model && <button className="link-button" onClick={() => { setDeployments((current) => deployModelVersion(current, model)); setModels((current) => current.map((item) => item.id === model.id ? { ...item, version: item.version + 1, status: "已部署" } : item)); setNotice(`${model.name}已部署新版本`); }}>部署新版本</button>}<button className="link-button" onClick={() => setDeployments((current) => current.map((item) => item.id === deployment.id ? { ...item, category: item.category === "其他事务" ? "学生事务" : "其他事务" } : item))}>更改分类</button></td></tr>; })}</tbody></table></div><footer className="pagination"><span>共 {rows.length} 条部署记录</span></footer>
    </div>
  </section>;
}
