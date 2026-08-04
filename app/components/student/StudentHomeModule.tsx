"use client";

import { useEffect, useState } from "react";
import { CountUp } from "../shared/use-count-up";

type CurrentUser = { id: string; displayName: string; role: string } | null;

type InstanceSummary = { id: string; title: string | null; status: string; startedAt: string };
type NotificationSummary = { id: string; title: string; content: string; read: boolean; createdAt: string };
type TaskSummary = { id: string; instanceTitle: string; instanceStatus: string; status: string; createdAt?: string };

const STUDENT_ACTIONS: Array<{ label: string; featureId: string; description: string }> = [
  { label: "发起请假", featureId: "leave", description: "事假、病假、公假在线申请" },
  { label: "学生证补办", featureId: "student-card", description: "遗失补办、损坏换发" },
  { label: "困难补助", featureId: "hardship", description: "查看补助申请与结果" },
  { label: "我的档案", featureId: "students", description: "查看个人学籍信息" },
];

const STAFF_ACTIONS: Array<{ label: string; featureId: string; description: string }> = [
  { label: "待办审批", featureId: "todo", description: "处理等待我审批的申请" },
  { label: "待签事务", featureId: "claim", description: "认领可审批的流程" },
  { label: "学生管理", featureId: "students", description: "查看所带范围内的学生" },
  { label: "操行分登记", featureId: "conduct-score", description: "警务化操行分登记" },
];

const ADMIN_ACTIONS: Array<{ label: string; featureId: string; description: string }> = [
  { label: "待办审批", featureId: "todo", description: "处理等待我审批的申请" },
  { label: "用户管理", featureId: "user-admin", description: "账号、角色与状态管理" },
  { label: "数据权限", featureId: "data-permission", description: "辅导员-班级绑定与数据范围" },
  { label: "通知公告", featureId: "announcement", description: "发布校内通知与公告" },
];

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Date(value).toLocaleString("zh-CN", { hour12: false });
}

/**
 * Role-aware landing page:
 * - students see quick apply actions + own application overview;
 * - counselors/staff see approval worklist + class-scope entries;
 * - admins see management entries + approval worklist.
 * Latest notifications are shared by all roles.
 */
export function StudentHomeModule({ currentUser, csrfToken, onNavigate }: { currentUser: CurrentUser; csrfToken: string; onNavigate: (featureId: string) => void }) {
  const role = currentUser?.role ?? "student";
  const isStaff = role !== "student";
  const [instances, setInstances] = useState<InstanceSummary[]>([]);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [claimTasks, setClaimTasks] = useState<TaskSummary[]>([]);
  const [doneTasks, setDoneTasks] = useState<TaskSummary[]>([]);
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [notice, setNotice] = useState("");

  const refresh = () => {
    if (!isStaff) {
      fetch("/api/workflow/instances?pageSize=50", { credentials: "same-origin" })
        .then(async (r) => { if (!r.ok) return; const payload = await r.json() as { data: { items: InstanceSummary[] } }; setInstances(payload.data.items); })
        .catch(() => {});
    } else {
      fetch("/api/workflow/tasks?type=todo", { credentials: "same-origin" })
        .then(async (r) => { if (!r.ok) return; const payload = await r.json() as { data: { tasks: TaskSummary[] } }; setTasks(payload.data.tasks); })
        .catch(() => {});
      fetch("/api/workflow/tasks?type=claim", { credentials: "same-origin" })
        .then(async (r) => { if (!r.ok) return; const payload = await r.json() as { data: { tasks: TaskSummary[] } }; setClaimTasks(payload.data.tasks); })
        .catch(() => {});
      fetch("/api/workflow/tasks?type=done", { credentials: "same-origin" })
        .then(async (r) => { if (!r.ok) return; const payload = await r.json() as { data: { tasks: TaskSummary[] } }; setDoneTasks(payload.data.tasks); })
        .catch(() => {});
    }
    fetch("/api/notifications", { credentials: "same-origin" })
      .then(async (r) => { if (!r.ok) return; const payload = await r.json() as { data: { items: NotificationSummary[] } }; setNotifications(payload.data.items.slice(0, 5)); })
      .catch(() => {});
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const resubmit = async (instance: InstanceSummary) => {
    try {
      const response = await fetch(`/api/workflow/instances/${instance.id}`, {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ action: "resubmit" }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) { setNotice(payload?.error ?? "重新提交失败，请重试"); return; }
      setNotice(`已重新提交：${instance.title ?? "申请"}`);
      refresh();
    } catch {
      setNotice("网络异常，重新提交未完成");
    }
  };

  const statusCount = (status: string) => instances.filter((item) => item.status === status).length;
  const quickActions = role === "admin" ? ADMIN_ACTIONS : isStaff ? STAFF_ACTIONS : STUDENT_ACTIONS;
  const greeting = role === "admin" ? "系统管理员" : role === "counselor" ? "辅导员" : role === "student" ? "同学" : "老师";

  return (
    <section className="module-card">
      <div className="module-hero">
        <span className="module-mark">首</span>
        <div>
          <h2>您好，{currentUser?.displayName ?? greeting}</h2>
          <p>{isStaff ? "这里是您的工作台，可以处理审批、查看待办与最新通知。" : "这里是您的学工事务首页，可以快速发起申请、查看审批进度和最新通知。"}</p>
        </div>
      </div>

      <section style={{ padding: "0 16px 8px" }}>
        <h3>快捷入口</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 8 }}>
          {quickActions.map((action) => (
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

      {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}

      {!isStaff && (
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
                <li key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--color-border, #f0f0f0)", alignItems: "center" }}>
                  <span>{item.title || "（无标题）"}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {item.status === "退回待修改" && (
                      <button className="primary" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => void resubmit(item)}>重新提交</button>
                    )}
                    <em style={{ fontStyle: "normal", marginRight: 8 }}>{item.status}</em><small style={{ opacity: 0.6 }}>{formatTime(item.startedAt)}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {instances.length === 0 && <p style={{ opacity: 0.7 }}>您还没有发起过申请，试试上面的快捷入口。</p>}
        </section>
      )}

      {isStaff && (
        <section style={{ padding: "8px 16px" }}>
          <h3>审批工作台账</h3>
          <div className="metric-grid" style={{ marginTop: 8 }}>
            <article><span>待办</span><strong><CountUp value={tasks.length} /></strong><small>等待我审批</small></article>
            <article><span>待签</span><strong><CountUp value={claimTasks.length} /></strong><small>可认领审批</small></article>
            <article><span>我的已办</span><strong><CountUp value={doneTasks.length} /></strong><small>历史处理</small></article>
          </div>
          {tasks.length > 0 && (
            <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
              {tasks.slice(0, 5).map((item) => (
                <li key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--color-border, #f0f0f0)", alignItems: "center" }}>
                  <span>{item.instanceTitle || "（无标题）"}</span>
                  <button className="link-button" onClick={() => onNavigate("todo")}>去处理</button>
                </li>
              ))}
            </ul>
          )}
          {tasks.length === 0 && <p style={{ opacity: 0.7 }}>当前没有等待您审批的事项。</p>}
        </section>
      )}

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
