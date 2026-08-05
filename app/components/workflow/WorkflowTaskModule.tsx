"use client";

import { useCallback, useEffect, useState } from "react";
import { api, apiErrorMessage, isNetworkError } from "@/lib/api-client";

const WORKFLOW_TASK_FEATURES = new Set(["todo", "claim", "my-request", "my-done", "finished", "copied", "new-flow"]);

export function isWorkflowTaskFeature(featureId: string) {
  return WORKFLOW_TASK_FEATURES.has(featureId);
}

type CurrentUser = { id: string; displayName: string; role: string; roleTags?: string[] } | null;

type TaskItem = {
  id: string;
  instanceId: string;
  nodeId: string;
  nodeName: string | null;
  nodeType: string | null;
  assigneeValue: string | null;
  status: string | null;
  claimedBy: string | null;
  result: string | null;
  comment: string | null;
  createdAt: string;
  completedAt: string | null;
  instanceTitle: string;
  instanceStatus: string;
};

type InstanceItem = {
  id: string;
  title: string | null;
  modelName: string | null;
  status: string;
  startedBy: string | null;
  startedAt: string;
  completedAt: string | null;
  formDataJson: Record<string, unknown>;
};

type InstanceDetail = {
  instance: InstanceItem;
  tasks: Array<{ id: string; nodeId: string; nodeName: string | null; status: string | null; result: string | null; comment: string | null; completedAt: string | null; claimedBy: string | null }>;
  events: Array<{ id: string; event: string; createdAt: string }>;
};

type Deployment = { id: string; modelKey: string; modelName: string; category: string; status: string };
type WorkflowForm = { id: string; key: string; fields: Array<{ id: string; type: string; label: string; required: boolean }> };
type WorkflowModel = { id: string; key: string; name: string; formId: string | null };

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN", { hour12: false });
}

export function WorkflowTaskModule({ featureId, feature, csrfToken, currentUser, focusInstanceId, onConsumedFocus }: {
  featureId: string;
  feature: string;
  csrfToken: string;
  currentUser?: CurrentUser;
  focusInstanceId?: string | null;
  onConsumedFocus?: () => void;
}) {
  void csrfToken; // CSRF 由 api-client 统一携带
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [designData, setDesignData] = useState<{ forms: WorkflowForm[]; models: WorkflowModel[]; deployments: Deployment[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState<InstanceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [startForm, setStartForm] = useState<{ deployment: Deployment; fields: Array<{ label: string; type: string; required: boolean }> } | null>(null);

  const usesTasks = featureId === "todo" || featureId === "claim" || featureId === "my-done";
  const usesInstances = featureId === "my-request" || featureId === "finished";

  const load = useCallback(async () => {
    setIsLoading(true);
    let failureMessage = "数据加载失败，请重试";
    try {
      if (usesTasks) {
        failureMessage = "待办数据加载失败，请重试";
        const type = featureId === "todo" ? "todo" : featureId === "claim" ? "claim" : "done";
        const data = await api.get<{ tasks: TaskItem[] }>(`/api/workflow/tasks?type=${type}`);
        setTasks(data.tasks);
      } else if (usesInstances) {
        failureMessage = "流程数据加载失败，请重试";
        const query = featureId === "finished" ? "?status=已完成&pageSize=50" : "?pageSize=50";
        const data = await api.get<{ items: InstanceItem[] }>(`/api/workflow/instances${query}`);
        setInstances(data.items);
      } else if (featureId === "new-flow") {
        failureMessage = "流程配置加载失败，请重试";
        const data = await api.get<{ forms: WorkflowForm[]; models: WorkflowModel[]; deployments: Deployment[] }>("/api/workflows");
        setDesignData(data);
      }
    } catch (error) {
      setNotice(isNetworkError(error) ? "网络连接异常，请检查后重试" : apiErrorMessage(error, failureMessage));
    } finally {
      setIsLoading(false);
    }
  }, [featureId, usesTasks, usesInstances]);

  useEffect(() => { void load(); }, [load]);

  const openInstance = useCallback(async (instanceId: string, task: TaskItem | null) => {
    setDetailLoading(true);
    setActiveTask(task);
    setComment("");
    try {
      const data = await api.get<InstanceDetail>(`/api/workflow/instances/${instanceId}`);
      setDetail(data);
    } catch (error) {
      setNotice(isNetworkError(error) ? "网络连接异常，无法打开流程详情" : apiErrorMessage(error, "无法打开流程详情"));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Open the instance referenced by a notification (deep link).
  useEffect(() => {
    if (!focusInstanceId) return;
    void openInstance(focusInstanceId, null);
    onConsumedFocus?.();
  }, [focusInstanceId, openInstance, onConsumedFocus]);

  const decide = async (action: "approve" | "reject" | "return") => {
    if (!detail || !activeTask) return;
    setBusy(true);
    try {
      await api.post(`/api/workflow/instances/${detail.instance.id}`, {
        nodeId: activeTask.nodeId, action,
        result: action === "approve" ? "同意" : action === "reject" ? "拒绝" : "退回",
        comment,
      });
      setNotice(`已处理：${detail.instance.title ?? "流程实例"}（${action === "approve" ? "同意" : action === "reject" ? "拒绝" : "退回"}）`);
      setDetail(null);
      void load();
    } catch (error) {
      setNotice(isNetworkError(error) ? "网络异常，处理未完成" : apiErrorMessage(error, "处理失败，请重试"));
    } finally {
      setBusy(false);
    }
  };

  const claimTask = async (task: TaskItem) => {
    setBusy(true);
    try {
      await api.post("/api/workflow/tasks", { taskId: task.id, action: "claim" });
      setNotice(`已签收：${task.instanceTitle || task.nodeName || "流程任务"}`);
      void load();
    } catch (error) {
      setNotice(isNetworkError(error) ? "网络异常，签收未完成" : apiErrorMessage(error, "签收失败，请重试"));
    } finally {
      setBusy(false);
    }
  };

  const resubmitInstance = async (instance: InstanceItem) => {
    setBusy(true);
    try {
      await api.post(`/api/workflow/instances/${instance.id}`, { action: "resubmit" });
      setNotice(`已重新提交：${instance.title ?? "流程实例"}`);
      void load();
    } catch (error) {
      setNotice(isNetworkError(error) ? "网络异常，重新提交未完成" : apiErrorMessage(error, "重新提交失败，请重试"));
    } finally {
      setBusy(false);
    }
  };

  const cancelInstance = async (instance: InstanceItem) => {
    setBusy(true);
    try {
      await api.del(`/api/workflow/instances/${instance.id}`);
      setNotice(`已撤回：${instance.title ?? "流程实例"}`);
      void load();
    } catch (error) {
      setNotice(isNetworkError(error) ? "网络异常，撤回未完成" : apiErrorMessage(error, "撤回失败，请重试"));
    } finally {
      setBusy(false);
    }
  };

  const startInstance = async (formData: Record<string, string>) => {
    if (!startForm) return;
    setBusy(true);
    try {
      await api.post("/api/workflow/instances", { modelKey: startForm.deployment.modelKey, formData });
      setNotice(`已发起：${startForm.deployment.modelName}`);
      setStartForm(null);
    } catch (error) {
      setNotice(isNetworkError(error) ? "网络异常，发起未完成" : apiErrorMessage(error, "发起流程失败，请重试"));
    } finally {
      setBusy(false);
    }
  };

  const openStartForm = (deployment: Deployment) => {
    const model = designData?.models.find((m) => m.key === deployment.modelKey);
    const form = designData?.forms.find((f) => f.id === model?.formId);
    const fields = (form?.fields ?? []).map((f) => ({ label: f.label, type: f.type, required: f.required }));
    setStartForm({ deployment, fields: fields.length > 0 ? fields : [{ label: "申请说明", type: "多行文本", required: true }] });
  };

  const canWrite = currentUser ? currentUser.role !== "student" && currentUser.role !== "viewer" : false;

  return (
    <section className="module-card">
      {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
      <div className="module-hero">
        <span className="module-mark">{feature.slice(0, 1)}</span>
        <div>
          <h2>{feature}</h2>
          <p>{featureId === "todo" && "分配给您且已就绪的审批任务，点击「处理」查看申请详情并给出审批意见。"}
            {featureId === "claim" && "按角色分派的公共任务，签收后进入您的待办事宜。"}
            {featureId === "my-request" && "您发起的全部流程实例及当前状态，运行中的流程可以撤回，退回待修改的流程可以重新提交。"}
            {featureId === "my-done" && "您已经处理完成的任务记录。"}
            {featureId === "finished" && "已办结的流程实例归档。"}
            {featureId === "copied" && "抄送事宜功能将在后续版本开放。"}
            {featureId === "new-flow" && "选择已部署的流程模型，填写表单后发起新的审批流程。"}</p>
        </div>
        <button className="ghost" onClick={() => void load()}>刷新</button>
      </div>

      {isLoading ? <p style={{ padding: "16px" }}>加载中…</p> : (
        <>
          {usesTasks && (
            <div className="table-scroll">
              <table>
                <thead><tr><th>流程标题</th><th>当前节点</th><th>分派对象</th><th>任务状态</th><th>到达时间</th><th>操作</th></tr></thead>
                <tbody>
                  {tasks.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: "24px" }}>暂无{feature}数据</td></tr>}
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td>{task.instanceTitle || "（无标题）"}</td>
                      <td>{task.nodeName ?? "—"}</td>
                      <td>{task.assigneeValue ?? "—"}</td>
                      <td>{task.status ?? "—"}</td>
                      <td>{formatTime(task.createdAt)}</td>
                      <td style={{ display: "flex", gap: 8 }}>
                        {featureId === "claim"
                          ? <button className="primary" disabled={busy} onClick={() => void claimTask(task)}>签收</button>
                          : <button className="primary" onClick={() => void openInstance(task.instanceId, featureId === "todo" ? task : null)}>查看详情</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {usesInstances && (
            <div className="table-scroll">
              <table>
                <thead><tr><th>流程标题</th><th>流程类型</th><th>状态</th><th>发起时间</th><th>完成时间</th><th>操作</th></tr></thead>
                <tbody>
                  {instances.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: "24px" }}>暂无{feature}数据</td></tr>}
                  {instances.map((instance) => (
                    <tr key={instance.id}>
                      <td>{instance.title || "（无标题）"}</td>
                      <td>{instance.modelName ?? "—"}</td>
                      <td>{instance.status}</td>
                      <td>{formatTime(instance.startedAt)}</td>
                      <td>{formatTime(instance.completedAt)}</td>
                      <td style={{ display: "flex", gap: 8 }}>
                        <button className="ghost" onClick={() => void openInstance(instance.id, null)}>详情</button>
                        {featureId === "my-request" && instance.status === "运行中" && (
                          <button className="ghost" disabled={busy} onClick={() => void cancelInstance(instance)}>撤回</button>
                        )}
                        {featureId === "my-request" && instance.status === "退回待修改" && (
                          <button className="primary" disabled={busy} onClick={() => void resubmitInstance(instance)}>重新提交</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {featureId === "copied" && <p style={{ padding: "24px", textAlign: "center" }}>抄送事宜功能将在后续版本开放，敬请期待。</p>}

          {featureId === "new-flow" && (
            <div className="table-scroll">
              <table>
                <thead><tr><th>流程名称</th><th>分类</th><th>部署状态</th><th>操作</th></tr></thead>
                <tbody>
                  {(designData?.deployments ?? []).filter((d) => d.status === "激活").length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "24px" }}>暂无已激活的流程模型，请联系管理员部署</td></tr>
                  )}
                  {(designData?.deployments ?? []).filter((d) => d.status === "激活").map((deployment) => (
                    <tr key={deployment.id}>
                      <td>{deployment.modelName}</td>
                      <td>{deployment.category}</td>
                      <td>{deployment.status}</td>
                      <td>{canWrite
                        ? <button className="primary" onClick={() => openStartForm(deployment)}>发起流程</button>
                        : <span>当前角色无发起权限</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {(detailLoading || detail) && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setDetail(null)}>
          <section className="import-dialog" role="dialog" aria-modal="true" aria-label="流程详情" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h2>{detail?.instance.title ?? "流程详情"}</h2>
              <button aria-label="关闭" onClick={() => setDetail(null)}>×</button>
            </header>
            {detailLoading || !detail ? <p style={{ padding: "16px" }}>加载中…</p> : (
              <div className="import-body">
                <p><strong>状态：</strong>{detail.instance.status}　<strong>发起时间：</strong>{formatTime(detail.instance.startedAt)}</p>
                <section>
                  <h3>申请内容</h3>
                  <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "4px 16px" }}>
                    {Object.entries(detail.instance.formDataJson ?? {}).filter(([key]) => key !== "title").map(([key, value]) => (
                      <div key={key} style={{ display: "contents" }}>
                        <dt style={{ fontWeight: 600 }}>{key}</dt>
                        <dd>{String(value ?? "—")}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
                <section>
                  <h3>审批进度</h3>
                  <ol style={{ paddingLeft: 20 }}>
                    {detail.tasks.map((task) => (
                      <li key={task.id}>
                        {task.nodeName ?? "节点"} — {task.status ?? "—"}
                        {task.result ? `（${task.result}）` : ""}
                        {task.comment ? `：${task.comment}` : ""}
                        {task.completedAt ? <small style={{ color: "var(--color-text-muted, #888)" }}> {formatTime(task.completedAt)}</small> : null}
                      </li>
                    ))}
                  </ol>
                </section>
                {activeTask && detail.instance.status === "运行中" && (
                  <section>
                    <h3>审批意见</h3>
                    <textarea
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder="选填：填写审批意见…"
                      rows={3}
                      style={{ width: "100%", padding: 8 }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button className="primary" disabled={busy} onClick={() => void decide("approve")}>同意</button>
                      <button className="ghost" disabled={busy} onClick={() => void decide("return")}>退回</button>
                      <button className="ghost" disabled={busy} onClick={() => void decide("reject")}>拒绝</button>
                    </div>
                  </section>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {startForm && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setStartForm(null)}>
          <section className="import-dialog" role="dialog" aria-modal="true" aria-label="发起流程" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h2>发起{startForm.deployment.modelName}</h2>
              <button aria-label="关闭" onClick={() => setStartForm(null)}>×</button>
            </header>
            <form
              className="import-body"
              onSubmit={(event) => {
                event.preventDefault();
                const values = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([key, value]) => [key, String(value)]));
                void startInstance(values);
              }}
            >
              {startForm.fields.map((field) => (
                <label key={field.label} style={{ display: "block", marginBottom: 12 }}>
                  <span style={{ display: "block", marginBottom: 4 }}>{field.label}{field.required ? " *" : ""}</span>
                  {field.type === "多行文本"
                    ? <textarea name={field.label} required={field.required} rows={3} style={{ width: "100%", padding: 8 }} />
                    : <input name={field.label} required={field.required} type={field.type === "日期" ? "date" : field.type === "金额" ? "number" : "text"} style={{ width: "100%", padding: 8 }} />}
                </label>
              ))}
              <footer style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="ghost" type="button" onClick={() => setStartForm(null)}>取消</button>
                <button className="primary" type="submit" disabled={busy}>提交发起</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
