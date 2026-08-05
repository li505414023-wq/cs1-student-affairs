"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { systems, workflow } from "./system-data";
import { api, apiErrorMessage, isNetworkError } from "@/lib/api-client";
import { ChangePasswordDialog } from "./components/ChangePasswordDialog";
import { initialWorkflowDeployments, initialWorkflowForms, initialWorkflowModels, type WorkflowDeployment, type WorkflowForm, type WorkflowModel } from "./WorkflowDesignModule";
import { LoginPanel } from "./components/LoginPanel";
import { NotificationPanel } from "./components/NotificationPanel";
import { StudentRecordDialog } from "./components/student/StudentRecordDialog";
import { emptyStudentQuery, type StudentEditor, type StudentQuery, type StudentRecord } from "./components/student/student-types";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NavigationProvider, useNavigation } from "./contexts/NavigationContext";
import { NotificationProvider, useNotifications } from "./contexts/NotificationContext";
import { Topbar } from "./components/layout/Topbar";
import { Sidebar } from "./components/layout/Sidebar";
import { Workspace } from "./components/layout/Workspace";

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
  return (
    <AuthProvider>
      <ThemeProvider>
        <NavigationProvider>
          <NotificationProvider>
            <AppShell />
          </NotificationProvider>
        </NavigationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

function AppShell() {
  const { auth, authNotice, setAuth, setAuthNotice } = useAuth();
  const nav = useNavigation();
  const { showNotifications, setShowNotifications, setUnreadCount } = useNotifications();

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [studentRows, setStudentRows] = useState<StudentRecord[]>([]);
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
    const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
    if (query.keyword.trim()) params.set("keyword", query.keyword.trim());
    if (query.faculty.trim()) params.set("faculty", query.faculty.trim());
    if (query.major.trim()) params.set("major", query.major.trim());
    if (query.className.trim()) params.set("className", query.className.trim());
    if (query.grade.trim()) params.set("grade", query.grade.trim());
    try {
      const data = await api.get<{ items: StudentRecord[]; pagination: { total: number } }>(`/api/students?${params.toString()}`);
      setStudentRows(data.items);
      setStudentTotal(data.pagination.total);
    } catch (error) {
      setAuthNotice(isNetworkError(error) ? "网络异常，无法加载学生数据" : "学生数据加载失败，请检查网络连接后刷新");
    }
  }, [setAuthNotice]);

  // Reset navigation for student role + initial data load
  useEffect(() => {
    if (auth && auth !== "loading") {
      if (auth.user.role === "student") nav.resetNavigation();
      void refreshStudents(emptyStudentQuery);
    }
  }, [auth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close flow panel when switching modules
  useEffect(() => {
    setShowFlow(false);
    setStudentEditor(null);
  }, [nav.activeFeature]); // eslint-disable-line react-hooks/exhaustive-deps

  // Workflow design sync (admin only)
  useEffect(() => {
    if (!auth || auth === "loading" || workflowReady.current) return;
    if (auth.user.role !== "admin") return;
    let active = true;
    void api.get<{ forms: WorkflowForm[]; models: WorkflowModel[]; deployments: WorkflowDeployment[] }>("/api/workflows")
      .then(async (data) => {
        if (!active) return;
        const hasSavedDesign = data.forms.length > 0 || data.models.length > 0 || data.deployments.length > 0;
        workflowReady.current = true;
        if (hasSavedDesign) {
          setWorkflowForms(data.forms);
          setWorkflowModels(data.models);
          setWorkflowDeployments(data.deployments);
        } else {
          await api.put("/api/workflows", { forms: initialWorkflowForms, models: initialWorkflowModels, deployments: initialWorkflowDeployments }).catch(() => {});
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [auth]);

  useEffect(() => {
    if (!auth || auth === "loading" || !workflowReady.current || auth.user.role !== "admin") return;
    if (workflowTimer.current) clearTimeout(workflowTimer.current);
    workflowTimer.current = setTimeout(() => {
      void api.put("/api/workflows", { forms: workflowForms, models: workflowModels, deployments: workflowDeployments }).catch(() => {});
    }, 350);
    return () => { if (workflowTimer.current) clearTimeout(workflowTimer.current); };
  }, [auth, workflowDeployments, workflowForms, workflowModels]);

  const saveStudent = async (record: StudentRecord) => {
    if (!auth || auth === "loading") return;
    const existingId = studentEditor?.student?.id;
    const body = { ...record, status: record.status ?? "在读" };
    try {
      if (existingId) {
        await api.put(`/api/students/${existingId}`, body);
      } else {
        await api.post("/api/students", body);
      }
    } catch (error) {
      setAuthNotice(apiErrorMessage(error, "学生信息保存失败"));
      return;
    }
    setStudentEditor(null);
    setAuthNotice("学生信息已保存");
    void refreshStudents(studentQuery);
  };

  const importStudents = async (rows: StudentRecord[]) => {
    if (!auth || auth === "loading") return;
    let result: { saved: StudentRecord[]; errors: Array<{ index: number; message: string }>; total: number; savedCount: number };
    try {
      result = await api.post("/api/students/batch", { students: rows.map((r) => ({ ...r, status: "在读" })) });
    } catch {
      setAuthNotice("批量导入失败");
      return;
    }
    void refreshStudents({ ...studentQuery, page: 1 });
    if (result.errors.length > 0) {
      setAuthNotice(`成功导入 ${result.savedCount} / ${result.total} 条，${result.errors.length} 条失败: ${result.errors.slice(0, 3).map((e) => e.message).join("; ")}${result.errors.length > 3 ? "…" : ""}`);
    } else {
      setAuthNotice(`已将 ${result.savedCount} 条学生记录写入数据库`);
    }
  };

  const { activeSystem, activeGroup, sidebarOpen, currentGroups, active } = nav;
  // Students see their own record page under a friendlier name than “学生管理”.
  const pageTitle =
    auth !== null && auth !== "loading" && auth.user.role === "student" && active?.id === "students"
      ? "我的档案"
      : active?.label ?? "学生管理";

  // Not logged in: show login panel
  if (auth === null) {
    return (
      <main className="app-shell">
        <LoginPanel onAuthenticated={(session) => {
          setAuth(session);
          setAuthNotice("登录成功，已连接 PostgreSQL 数据库");
          if (session.user.role === "student") nav.resetNavigation();
          void refreshStudents(emptyStudentQuery);
        }} />
      </main>
    );
  }

  return (
    <main className={`app-shell${sidebarOpen ? " sidebar-open" : ""}`}>
      <Topbar onShowChangePassword={() => setShowChangePassword(true)} />
      <Sidebar />

      <section className="workspace">
        {authNotice && <div className="action-notice" role="status">{authNotice}<button aria-label="关闭提示" onClick={() => setAuthNotice("")}>×</button></div>}
        {studentEditor ? (
          <StudentRecordDialog editor={studentEditor} onClose={() => setStudentEditor(null)} onSave={(record) => { void saveStudent(record); }} />
        ) : (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">{systems.find((s) => s.id === activeSystem)?.label} / {currentGroups.find((g) => g.id === activeGroup)?.label}</p>
                <h1>{pageTitle}</h1>
              </div>
              <div className="heading-actions">
                <div className="business-steps" aria-label="业务主线">{workflow.map((step) => <span key={step}>{step}</span>)}</div>
                <button className="flow-button" onClick={() => setShowFlow((v) => !v)}>业务关系图</button>
              </div>
            </div>

            {showFlow && (
              <section className="flow-card" aria-label="业务流程">
                <div><strong>通用业务主线</strong><p>组织、学生与角色权限贯穿每个业务域。</p></div>
                <ol>{workflow.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol>
              </section>
            )}

            <Workspace
              studentRows={studentRows}
              studentTotal={studentTotal}
              studentQuery={studentQuery}
              onStudentQueryChange={(next) => { setStudentQuery(next); void refreshStudents(next); }}
              onStudentAdd={() => setStudentEditor({ mode: "create" })}
              onStudentOpenRecord={(mode, student) => setStudentEditor({ mode, student })}
              onStudentImported={(rows) => { void importStudents(rows); }}
              studentEditor={studentEditor}
              workflowModels={workflowModels}
              setWorkflowModels={setWorkflowModels}
              workflowForms={workflowForms}
              setWorkflowForms={setWorkflowForms}
              workflowDeployments={workflowDeployments}
              setWorkflowDeployments={setWorkflowDeployments}
              moduleDescriptions={moduleDescriptions}
            />
          </>
        )}
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
          onJump={nav.jumpToInstance}
          onUnreadChanged={setUnreadCount}
        />
      )}
    </main>
  );
}
