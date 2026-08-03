"use client";

import { useEffect, useState } from "react";
import { CountUp } from "../shared/use-count-up";

type CurrentUser = { id: string; displayName: string; role: string } | null;

type InstanceSummary = { id: string; title: string | null; status: string; startedAt: string };
type NotificationSummary = { id: string; title: string; content: string; read: boolean; createdAt: string };

const QUICK_ACTIONS: Array<{ label: string; featureId: string; description: string }> = [
  { label: "发起请假", featureId: "leave", description: "事假、病假、公假在线申请" },
  { label: "学生证补办", featureId: "student-card", description: "遗失补办、损坏换发" },
  { label: "困难补助", featureId: "hardship", description: "查看补助申请与结果" },
  { label: "我的档案", featureId: "students", description: "查看个人学籍信息" },
];

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("zh-CN", { hour12: false });
}

/**
 * Student landing page: quick actions, own application overview, and the
 * latest notifications — so students land somewhere useful instead of the
 * admin-oriented student list.
 */
export function StudentHomeModule({ currentUser, onNavigate }: { currentUser: CurrentUser; onNavigate: (featureId: string) => void }) {
  const [instances, setInstances] = useState<InstanceSummary[]>([]);
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/workflow/instances?pageSize=50", { credentials: "same-origin" })
      .then(async (r) => { if (!r.ok || !active) return; const payload = await r.json() as { data: { items: InstanceSummary[] } }; setInstances(payload.data.items); })
      .catch(() => {});
    fetch("/api/notifications", { credentials: "same-origin" })
      .then(async (r) => { if (!r.ok || !active) return; const payload = await r.json() as { data: { items: NotificationSummary[] } }; setNotifications(payload.data.items.slice(0, 5)); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const statusCount = (status: string) => instances.filter((item) => item.status === status).length;

  return (
    <section className="module-card">
      <div className="module-hero">
        <span className="module-mark">首</span>
        <div>
          <h2>您好，{currentUser?.displayName ?? "同学"}</h2>
          <p>这里是您的学工事务首页，可以快速发起申请、查看审批进度和最新通知。</p>
        </div>
      </div>

      <section style={{ padding: "0 16px 8px" }}>
        <h3>快捷入口</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 8 }}>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.featureId}
              onClick={() => onNavigate(action.featureId)}
              style={{ textAlign: "left", padding: 14, borderRadius: 10, border: "1px solid var(--color-border, #e5e7eb)", background: "var(--color-surface-muted, #f8fafc)", cursor: "pointer" }}
            >
              <strong style={{ display: "block" }}>{action.label}</strong>
              <small style={{ opacity: 0.75 }}>{action.description}</small>
            </button>
          ))}
        </div>
      </section>

      <section style={{ padding: "8px 16px" }}>
        <h3>我的申请</h3>
        <div className="metric-grid" style={{ marginTop: 8 }}>
          <article><span>进行中</span><strong><CountUp value={statusCount("运行中")} /></strong><small>等待审批</small></article>
          <article><span>退回待修改</span><strong><CountUp value={statusCount("退回待修改")} /></strong><small>需修改后重提</small></article>
          <article><span>已完成</span><strong><CountUp value={statusCount("已完成")} /></strong><small>审批通过</small></article>
          <article><span>已拒绝</span><strong><CountUp value={statusCount("已拒绝")} /></strong><small>未通过</small></article>
          <article><span>已撤回</span><strong><CountUp value={statusCount("已撤回")} /></strong><small>主动撤回</small></article>
        </div>
        {instances.length > 0 && (
          <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
            {instances.slice(0, 5).map((item) => (
              <li key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--color-border, #f0f0f0)" }}>
                <span>{item.title || "（无标题）"}</span>
                <span><em style={{ fontStyle: "normal", marginRight: 8 }}>{item.status}</em><small style={{ opacity: 0.6 }}>{formatTime(item.startedAt)}</small></span>
              </li>
            ))}
          </ul>
        )}
        {instances.length === 0 && <p style={{ opacity: 0.7 }}>您还没有发起过申请，试试上面的快捷入口。</p>}
      </section>

      <section style={{ padding: "8px 16px 16px" }}>
        <h3>最新通知</h3>
        {notifications.length === 0 ? <p style={{ opacity: 0.7 }}>暂无通知。</p> : (
          <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
            {notifications.map((item) => (
              <li key={item.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--color-border, #f0f0f0)" }}>
                <strong style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {!item.read && <span aria-label="未读" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-error, #e5484d)", flexShrink: 0 }} />}
                  {item.title}
                </strong>
                <small style={{ opacity: 0.7 }}>{formatTime(item.createdAt)}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
