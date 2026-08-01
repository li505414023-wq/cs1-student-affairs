"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { systemGroups, systems, workflow, type SystemId } from "./system-data";
import { isAdminGroupVisible, isFeatureVisible, isShellFeature, systemsForRole } from "./menu-policy";
import { isEntityFeature } from "@/lib/entity-features";
import { EntityModule } from "./components/admin/EntityModule";
import { UserAdminModule } from "./components/admin/UserAdminModule";
import { RoleAdminModule } from "./components/admin/RoleAdminModule";
import { DataPermissionModule } from "./components/admin/DataPermissionModule";
import { ApiPermissionModule } from "./components/admin/ApiPermissionModule";
import { TeamBuildingModule } from "./components/admin/TeamBuildingModule";
import { HeadteacherQueryModule } from "./components/admin/HeadteacherQueryModule";
import { OpsScheduleModule } from "./components/admin/OpsScheduleModule";
import { SystemLogModule } from "./components/admin/SystemLogModule";
import { StudentHomeModule } from "./components/student/StudentHomeModule";
import { AuditLogModule } from "./components/admin/AuditLogModule";
import { ChangePasswordDialog } from "./components/ChangePasswordDialog";
import WorkflowDesignModule, { initialWorkflowDeployments, initialWorkflowForms, initialWorkflowModels, isWorkflowDesignFeature, type WorkflowDeployment, type WorkflowForm, type WorkflowModel } from "./WorkflowDesignModule";
import { LoginPanel } from "./components/LoginPanel";
import { StudentPage } from "./components/student/StudentPage";
import { GenericModule } from "./components/generic/GenericModule";
import { NotificationPanel } from "./components/NotificationPanel";
import { WorkflowTaskModule, isWorkflowTaskFeature } from "./components/workflow/WorkflowTaskModule";
import { StudentRecordDialog } from "./components/student/StudentRecordDialog";
import { emptyStudentQuery, type AuthSession, type StudentEditor, type StudentQuery, type StudentRecord } from "./components/student/student-types";

const moduleDescriptions: Record<string, string> = {
  students: "维护学生主档、组织归属与在校状态，是全部学工业务的数据基础。",
  leave: "学生发起请假，按时长与类型进入辅导员、院系分级审核，返校后完成销假。",
  hardship: "依据补助种类与批次组织申请、资格核验、名额分配和公示归档。",
  scholarship: "配置奖项、批次和互斥规则，对学生申请进行院系评审并形成获奖结果。",
  punishment: "从违纪事实登记生成处分决定，支持申诉、撤销并保留完整流程记录。",
  clubs: "管理社团成立、成员、负责人及学生参与关系，并连接第二课堂积分。",
  leaving: "汇总毕业生各部门离校事项，完成核验后归档毕业去向。",
};

export default function StudentAffairsApp() {
  const [auth, setAuth] = useState<AuthSession | "loading" | null>("loading");
  const [authNotice, setAuthNotice] = useState("");
  const [sidebarFilter, setSidebarFilter] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationFocus, setNotificationFocus] = useState<string | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Poll unread notification count
  useEffect(() => {
    if (!auth || auth === "loading") return;
    const poll = () => {
      fetch("/api/notifications?unread=true", { credentials: "same-origin" })
        .then(async (r) => { if (r.ok) { const j = await r.json() as { data: { unreadCount: number } }; setUnreadCount(j.data.unreadCount); } })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [auth]);

  // Initialize theme from localStorage, then system preference
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  // Mirror theme state to DOM attribute and persist
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);
  const [activeSystem, setActiveSystem] = useState<SystemId>("student");
  const [studentRows, setStudentRows] = useState<StudentRecord[]>([]);
  const [activeGroup, setActiveGroup] = useState("student");
  const [activeFeature, setActiveFeature] = useState("students");
  const [expanded, setExpanded] = useState(() => new Set(["student"]));
  const [studentQuery, setStudentQuery] = useState<StudentQuery>(emptyStudentQuery);
  const [studentTotal, setStudentTotal] = useState(0);
  const [showFlow, setShowFlow] = useState(false);
  const [studentEditor, setStudentEditor] = useState<StudentEditor>(null);
  const [workflowModels, setWorkflowModels] = useState(initialWorkflowModels);
  const [workflowForms, setWorkflowForms] = useState(initialWorkflowForms);
  const [workflowDeployments, setWorkflowDeployments] = useState(initialWorkflowDeployments);
  const workflowReady = useRef(false);
  const workflowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshStudents = useCallback(async (query: StudentQuery = emptyStudentQuery) => {
    try {
      const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
      if (query.keyword.trim()) params.set("keyword", query.keyword.trim());
      if (query.faculty.trim()) params.set("faculty", query.faculty.trim());
      if (query.major.trim()) params.set("major", query.major.trim());
      if (query.className.trim()) params.set("className", query.className.trim());
      if (query.grade.trim()) params.set("grade", query.grade.trim());
      const response = await fetch(`/api/students?${params.toString()}`, { credentials: "same-origin" });
      if (!response.ok) { setAuthNotice("学生数据加载失败，请检查网络连接后刷新"); return; }
      const payload = await response.json() as { data: { items: StudentRecord[]; pagination: { total: number } } };
      setStudentRows(payload.data.items);
      setStudentTotal(payload.data.pagination.total);
    } catch { setAuthNotice("网络异常，无法加载学生数据"); }
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { credentials: "same-origin" }).then(async (response) => {
      if (!active) return;
      if (!response.ok) { setAuth(null); return; }
      const payload = await response.json() as { data: AuthSession };
      setAuth(payload.data);
      if (payload.data.user.role === "student") {
        setActiveSystem("student");
        setActiveGroup("home");
        setActiveFeature("student-home");
        setExpanded(new Set(["home"]));
      }
      await refreshStudents(emptyStudentQuery);
    }).catch(() => { if (active) setAuth(null); });
    return () => { active = false; };
  }, [refreshStudents]);

  useEffect(() => {
    if (!auth || auth === "loading" || workflowReady.current) return;
    // Design sync is admin-only; other roles neither render the designer nor
    // may push to it, so skip the fetch entirely (avoids a futile 403 PUT).
    if (auth.user.role !== "admin") return;
    let active = true;
    void fetch("/api/workflows", { credentials: "same-origin" }).then(async (response) => {
      if (!response.ok || !active) return;
      const payload = await response.json() as { data: { forms: WorkflowForm[]; models: WorkflowModel[]; deployments: WorkflowDeployment[] } };
      const hasSavedDesign = payload.data.forms.length > 0 || payload.data.models.length > 0 || payload.data.deployments.length > 0;
      workflowReady.current = true;
      if (hasSavedDesign) {
        setWorkflowForms(payload.data.forms);
        setWorkflowModels(payload.data.models);
        setWorkflowDeployments(payload.data.deployments);
      } else {
        await fetch("/api/workflows", { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json", "x-csrf-token": auth.csrfToken }, body: JSON.stringify({ forms: initialWorkflowForms, models: initialWorkflowModels, deployments: initialWorkflowDeployments }) });
      }
    });
    return () => { active = false; };
  }, [auth]);

  useEffect(() => {
    if (!auth || auth === "loading" || !workflowReady.current || auth.user.role !== "admin") return;
    if (workflowTimer.current) clearTimeout(workflowTimer.current);
    workflowTimer.current = setTimeout(() => {
      void fetch("/api/workflows", { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json", "x-csrf-token": auth.csrfToken }, body: JSON.stringify({ forms: workflowForms, models: workflowModels, deployments: workflowDeployments }) });
    }, 350);
    return () => { if (workflowTimer.current) clearTimeout(workflowTimer.current); };
  }, [auth, workflowDeployments, workflowForms, workflowModels]);

  const saveStudent = async (record: StudentRecord) => {
    if (!auth || auth === "loading") return;
    const existingId = studentEditor?.student?.id;
    const response = await fetch(existingId ? `/api/students/${existingId}` : "/api/students", {
      method: existingId ? "PUT" : "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-csrf-token": auth.csrfToken },
      body: JSON.stringify({ ...record, status: record.status ?? "在读" }),
    });
    const payload = await response.json() as { data: StudentRecord; error?: string };
    if (!response.ok) { setAuthNotice(payload.error ?? "学生信息保存失败"); return; }
    setStudentEditor(null);
    setAuthNotice("学生信息已保存");
    void refreshStudents(studentQuery);
  };

  const importStudents = async (rows: StudentRecord[]) => {
    if (!auth || auth === "loading") return;
    const response = await fetch("/api/students/batch", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-csrf-token": auth.csrfToken },
      body: JSON.stringify({ students: rows.map((r) => ({ ...r, status: "在读" })) }),
    });
    const payload = await response.json() as { data: { saved: StudentRecord[]; errors: Array<{ index: number; message: string }>; total: number; savedCount: number } };
    if (!response.ok) { setAuthNotice(payload.data?.errors?.[0]?.message ?? "批量导入失败"); return; }
    const result = payload.data;
    void refreshStudents({ ...studentQuery, page: 1 });
    if (result.errors.length > 0) {
      setAuthNotice(`成功导入 ${result.savedCount} / ${result.total} 条，${result.errors.length} 条失败: ${result.errors.slice(0, 3).map((e) => e.message).join("; ")}${result.errors.length > 3 ? "…" : ""}`);
    } else {
      setAuthNotice(`已将 ${result.savedCount} 条学生记录写入数据库`);
    }
  };

  const currentRole = auth && auth !== "loading" ? auth.user.role : "viewer";
  const allowedSystems = systemsForRole(currentRole);
  const currentGroups = systemGroups[activeSystem]
    .filter((group) => activeSystem !== "admin" || isAdminGroupVisible(group.id, currentRole))
    .map((group) => ({
      ...group,
      children: group.children
        .map((child) => ({ ...child, features: child.features.filter((feature) => isFeatureVisible(feature.id, currentRole)) }))
        .filter((child) => child.features.length > 0),
    }))
    .filter((group) => group.children.length > 0);
  const active = currentGroups
    .flatMap((group) => group.children.flatMap((child) => child.features))
    .find((feature) => feature.id === activeFeature);

  const toggleGroup = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const chooseFeature = (groupId: string, featureId: string) => {
    setActiveGroup(groupId);
    setActiveFeature(featureId);
    setStudentEditor(null);
    setShowFlow(false);
    setSidebarOpen(false);
  };

  const navigateToFeature = (featureId: string) => {
    const group = systemGroups.student.find((g) => g.children.some((child) => child.features.some((f) => f.id === featureId)));
    setActiveSystem("student");
    setActiveGroup(group?.id ?? "student");
    setActiveFeature(featureId);
    setExpanded(new Set([group?.id ?? "student"]));
    setStudentEditor(null);
    setShowFlow(false);
    setSidebarOpen(false);
  };

  const jumpToInstance = (instanceId: string) => {
    setActiveSystem("admin");
    setActiveGroup("workflow");
    setActiveFeature("my-request");
    setExpanded(new Set(["workflow"]));
    setStudentEditor(null);
    setShowFlow(false);
    setSidebarOpen(false);
    setNotificationFocus(instanceId);
  };

  const switchSystem = (systemId: SystemId) => {
    const firstGroup = systemGroups[systemId][0];
    const firstFeature = firstGroup.children[0].features[0];
    setActiveSystem(systemId);
    setActiveGroup(firstGroup.id);
    setActiveFeature(firstFeature.id);
    setExpanded(new Set([firstGroup.id]));
    setStudentEditor(null);
    setShowFlow(false);
    setSidebarOpen(false);
  };

  return (
    <main className={`app-shell${sidebarOpen ? " sidebar-open" : ""}`}>
      <header className="topbar">
        <button className="hamburger" aria-label="菜单" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((v) => !v)}>
          <span /><span /><span />
        </button>
        <div className="brand">智慧学工管理系统</div>
        <nav className="system-switcher" aria-label="系统切换">
          {systems.filter((system) => allowedSystems.includes(system.id)).map((system) => <button key={system.id} className={activeSystem === system.id ? "active" : ""} onClick={() => switchSystem(system.id)}>{activeSystem === system.id && "◉ "}{system.label}</button>)}
        </nav>
        <div className="profile">
          <button className="logout-button" style={{ position: "relative" }} onClick={() => setShowNotifications(true)} title="通知" aria-label={`通知（${unreadCount} 条未读）`}>
            🔔{unreadCount > 0 && <span style={{ position: "absolute", top: -4, right: -6, background: "var(--color-error)", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>{unreadCount}</span>}
          </button>
          <button className="logout-button" onClick={() => setTheme((t) => t === "light" ? "dark" : "light")} title="切换主题">{theme === "light" ? "☀" : "☾"}</button>{auth && auth !== "loading" && <><span className="profile-name">{auth.user.displayName}</span><button className="logout-button" onClick={() => setShowChangePassword(true)} title="修改密码" aria-label="修改密码">🔑</button><button className="logout-button" onClick={async () => { await fetch("/api/auth/session", { method: "DELETE", headers: { "x-csrf-token": auth.csrfToken } }); setAuth(null); }}>退出</button></>}<span className="avatar">{auth && auth !== "loading" ? auth.user.displayName.slice(0, 1) : "管"}</span></div>
      </header>

      {sidebarOpen && <div className="sidebar-overlay" aria-hidden="true" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar${sidebarOpen ? " is-open" : ""}`}>
        <nav className="mobile-system-switcher" aria-label="移动端系统切换">
          {systems.filter((system) => allowedSystems.includes(system.id)).map((system) => <button key={system.id} className={activeSystem === system.id ? "active" : ""} onClick={() => switchSystem(system.id)}>{system.shortLabel}</button>)}
        </nav>
        <div className="sidebar-title">{systems.find((system) => system.id === activeSystem)?.shortLabel}功能导航 <span>{currentGroups.reduce((count, group) => count + group.children.flatMap((child) => child.features).length, 0)} 项</span></div>
        <div className="sidebar-search">
          <input
            placeholder="搜索功能…"
            value={sidebarFilter}
            onChange={(event) => setSidebarFilter(event.target.value)}
            aria-label="搜索功能模块"
          />
        </div>
        {currentGroups.map((group) => {
          const filterText = sidebarFilter.trim().toLowerCase();
          const filteredChildren = filterText
            ? group.children.map((child) => ({
                ...child,
                features: child.features.filter((f) => f.label.toLowerCase().includes(filterText) || f.id.toLowerCase().includes(filterText)),
              })).filter((child) => child.features.length > 0)
            : group.children;
          if (filterText && filteredChildren.length === 0) return null;
          const showExpanded = expanded.has(group.id) || !!filterText;

          return (
          <section className="nav-group" key={group.id}>
            <button
              className={`nav-group-button ${activeGroup === group.id ? "current" : ""}`}
              aria-expanded={showExpanded}
              onClick={() => toggleGroup(group.id)}
            >
              <span className="nav-icon">{group.icon}</span><span>{group.label}</span><span className="chevron">{showExpanded ? "⌃" : "⌄"}</span>
            </button>
            {showExpanded && (
              <div className="nav-children">
                {filteredChildren.map((child) => (
                  <div className="nav-section" key={child.label}>
                    <p>{child.label}</p>
                    {child.features.map((feature) => (
                      <button
                        key={feature.id}
                        className={activeFeature === feature.id ? "active" : ""}
                        onClick={() => chooseFeature(group.id, feature.id)}
                      >{feature.label}</button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        )})}
      </aside>

      <section className="workspace">
        {authNotice && <div className="action-notice" role="status">{authNotice}<button aria-label="关闭提示" onClick={() => setAuthNotice("")}>×</button></div>}
        {studentEditor ? <StudentRecordDialog editor={studentEditor} onClose={() => setStudentEditor(null)} onSave={(record) => {
          void saveStudent(record);
        }} /> : <><div className="page-heading">
          <div><p className="eyebrow">{systems.find((system) => system.id === activeSystem)?.label} / {currentGroups.find((group) => group.id === activeGroup)?.label}</p><h1>{active?.label ?? "学生管理"}</h1></div>
          <div className="heading-actions"><div className="business-steps" aria-label="业务主线">{workflow.map((step) => <span key={step}>{step}</span>)}</div><button className="flow-button" onClick={() => setShowFlow((value) => !value)}>业务关系图</button></div>
        </div>

        {showFlow && (
          <section className="flow-card" aria-label="业务流程">
            <div><strong>通用业务主线</strong><p>组织、学生与角色权限贯穿每个业务域。</p></div>
            <ol>{workflow.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol>
          </section>
        )}

        {activeFeature === "student-home" ? (
          <StudentHomeModule
            currentUser={auth && auth !== "loading" ? { id: auth.user.id, displayName: auth.user.displayName, role: auth.user.role } : null}
            onNavigate={navigateToFeature}
          />
        ) : activeSystem === "student" && activeFeature === "students" ? (
          <StudentPage
            rows={studentRows}
            total={studentTotal}
            query={studentQuery}
            onQueryChange={(next) => { setStudentQuery(next); void refreshStudents(next); }}
            role={currentRole}
            onAdd={() => setStudentEditor({ mode: "create" })}
            onOpenRecord={(mode, student) => setStudentEditor({ mode, student })}
            onImported={(rows) => { void importStudents(rows); }}
          />
        ) : activeSystem === "admin" && isWorkflowDesignFeature(activeFeature) ? (
          <WorkflowDesignModule key={activeFeature} featureId={activeFeature} models={workflowModels} setModels={setWorkflowModels} forms={workflowForms} setForms={setWorkflowForms} deployments={workflowDeployments} setDeployments={setWorkflowDeployments} />
        ) : isWorkflowTaskFeature(activeFeature) ? (
          <WorkflowTaskModule key={activeFeature} featureId={activeFeature} feature={active?.label ?? "我的事务"} csrfToken={auth && auth !== "loading" ? auth.csrfToken : ""} currentUser={auth && auth !== "loading" ? { id: auth.user.id, displayName: auth.user.displayName, role: auth.user.role } : null} focusInstanceId={notificationFocus} onConsumedFocus={() => setNotificationFocus(null)} />
        ) : activeFeature === "usual-log" ? (
          <AuditLogModule feature={active?.label ?? "通用日志"} />
        ) : isEntityFeature(activeFeature) ? (
          <EntityModule key={activeFeature} featureId={activeFeature} csrfToken={auth && auth !== "loading" ? auth.csrfToken : ""} />
        ) : activeFeature === "user-admin" ? (
          <UserAdminModule csrfToken={auth && auth !== "loading" ? auth.csrfToken : ""} />
        ) : activeFeature === "role-admin" ? (
          <RoleAdminModule csrfToken={auth && auth !== "loading" ? auth.csrfToken : ""} />
        ) : activeFeature === "data-permission" ? (
          <DataPermissionModule csrfToken={auth && auth !== "loading" ? auth.csrfToken : ""} />
        ) : activeFeature === "api-permission" ? (
          <ApiPermissionModule />
        ) : activeFeature === "team-building" ? (
          <TeamBuildingModule />
        ) : activeFeature === "headteacher-query" ? (
          <HeadteacherQueryModule />
        ) : activeFeature === "ops-schedule" ? (
          <OpsScheduleModule csrfToken={auth && auth !== "loading" ? auth.csrfToken : ""} />
        ) : activeFeature === "api-log" ? (
          <AuditLogModule feature="接口日志(API 操作审计)" />
        ) : activeFeature === "error-log" ? (
          <SystemLogModule feature="错误日志" />
        ) : isShellFeature(activeFeature) ? (
          <section className="module-card">
            <div className="module-hero"><span className="module-mark">{(active?.label ?? "功").slice(0, 1)}</span><div><h2>{active?.label ?? "功能模块"}</h2><p>该功能尚未开放，敬请期待。</p></div></div>
            <div className="empty-state" style={{ margin: 16, padding: 32 }}>「{active?.label}」暂未开放，将在后续版本提供。</div>
          </section>
        ) : (
          <GenericModule key={activeFeature} featureId={activeFeature} feature={active?.label ?? "业务模块"} description={moduleDescriptions[activeFeature]} stage={active?.stage} csrfToken={auth && auth !== "loading" ? auth.csrfToken : ""} currentUser={auth && auth !== "loading" ? { id: auth.user.id, displayName: auth.user.displayName, role: auth.user.role } : null} />
        )}
        </>}
      </section>
      {showChangePassword && auth && auth !== "loading" && (
        <ChangePasswordDialog
          csrfToken={auth.csrfToken}
          onClose={() => setShowChangePassword(false)}
          onChanged={() => { setShowChangePassword(false); setAuthNotice("密码修改成功，其他设备上的会话已下线"); }}
        />
      )}
      {showNotifications && auth && auth !== "loading" && (
        <NotificationPanel
          csrfToken={auth.csrfToken}
          onClose={() => setShowNotifications(false)}
          onJump={jumpToInstance}
          onUnreadChanged={setUnreadCount}
        />
      )}
      {auth === null && <LoginPanel onAuthenticated={(session) => {
        setAuth(session);
        setAuthNotice("登录成功，已连接 PostgreSQL 数据库");
        if (session.user.role === "student") {
          setActiveSystem("student");
          setActiveGroup("home");
          setActiveFeature("student-home");
          setExpanded(new Set(["home"]));
        }
        void refreshStudents(emptyStudentQuery);
      }} />}
    </main>
  );
}
