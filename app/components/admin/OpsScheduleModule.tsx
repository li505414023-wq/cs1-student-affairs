"use client";

import { useCallback, useEffect, useState } from "react";
import { CountUp } from "../shared/use-count-up";

type OpsStats = { running: number; overdue: number; awaitingClaim: number; pending: number; total: number };
type OpsInstance = {
  id: string;
  title: string | null;
  modelName: string | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  timeoutAt: string | null;
  overdue: boolean;
};

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

/** Workflow operations dashboard: stats, running instances, overdue alerts, admin cancel. */
export function OpsScheduleModule({ csrfToken }: { csrfToken: string }) {
  const [stats, setStats] = useState<OpsStats | null>(null);
  const [instances, setInstances] = useState<OpsInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/ops-schedule", { credentials: "same-origin" });
      if (!response.ok) { setNotice("运维数据加载失败,请重试"); return; }
      const payload = await response.json() as { data: { stats: OpsStats; items: OpsInstance[] } };
      setStats(payload.data.stats);
      setInstances(payload.data.items);
    } catch {
      setNotice("网络连接异常,请检查后重试");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cancel = async (instance: OpsInstance) => {
    if (!window.confirm(`确认管理员强制撤回「${instance.title ?? "流程实例"}」吗?`)) return;
    setBusyId(instance.id);
    try {
      const response = await fetch(`/api/workflow/instances/${instance.id}`, {
        method: "DELETE", credentials: "same-origin",
        headers: { "x-csrf-token": csrfToken },
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) { setNotice(payload?.error ?? "撤回失败,请重试"); return; }
      setNotice(`已撤回:${instance.title ?? "流程实例"}`);
      void load();
    } catch {
      setNotice("网络异常,撤回未完成");
    } finally {
      setBusyId(null);
    }
  };

  const statCards = stats ? [
    { label: "运行中流程", value: stats.running, alert: false },
    { label: "已超时(需催办)", value: stats.overdue, alert: stats.overdue > 0 },
    { label: "待签收任务", value: stats.awaitingClaim, alert: false },
    { label: "待处理任务", value: stats.pending, alert: false },
    { label: "历史流程总数", value: stats.total, alert: false },
  ] : [];

  return (
    <section className="module-card">
      {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
      <div className="module-hero">
        <span className="module-mark">运</span>
        <div>
          <h2>运维调度</h2>
          <p>工作流运行监控:超时流程自动标记(催办通知由定时任务每 30 分钟发送给发起人),管理员可强制撤回滞留流程。</p>
        </div>
        <button className="ghost" onClick={() => void load()}>刷新</button>
      </div>

      <div className="metric-grid" style={{ margin: "12px 0" }}>
        {statCards.map((card) => (
          <article key={card.label}>
            <span>{card.label}</span>
            <strong style={card.alert ? { color: "var(--color-error, #d8453c)" } : undefined}><CountUp value={card.value} /></strong>
          </article>
        ))}
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead><tr><th>流程标题</th><th>模型</th><th>状态</th><th>发起时间</th><th>停留(分钟)</th><th>超时</th><th>操作</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} style={{ textAlign: "center", padding: 32 }}>加载中…</td></tr>}
              {!isLoading && instances.length === 0 && <tr><td colSpan={7}><div className="empty-state">暂无流程实例</div></td></tr>}
              {!isLoading && instances.map((instance) => (
                <tr key={instance.id}>
                  <td>{instance.title || "(无标题)"}</td>
                  <td>{instance.modelName ?? "—"}</td>
                  <td><span className={`status ${instance.status === "运行中" ? "pending" : ""}`}>{instance.status}</span></td>
                  <td>{new Date(instance.startedAt).toLocaleString("zh-CN", { hour12: false })}</td>
                  <td>{instance.status === "运行中" ? minutesSince(instance.startedAt) : "—"}</td>
                  <td>{instance.overdue ? <span className="status pending">已超时</span> : "—"}</td>
                  <td>
                    {instance.status === "运行中" && (
                      <button className="link-button" disabled={busyId === instance.id} onClick={() => void cancel(instance)}>强制撤回</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
