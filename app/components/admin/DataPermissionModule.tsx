"use client";

import { useCallback, useEffect, useState } from "react";

type RoleRow = { id: string; code: string; name: string; dataScope: string; builtin: boolean; status: string; userCount: number };
type BindingRow = { id: string; userId: string; faculty: string | null; className: string; grade: string | null };
type CounselorOption = { id: string; displayName: string; role: string; roleTags: string[] | null };
type ClassOption = { name: string; grade: string };

const SCOPES = [
  { value: "all", label: "全部数据", description: "可访问全校范围的数据" },
  { value: "faculty", label: "本院系/班级", description: "仅所带班级/院系范围(辅导员按辅导员-班级绑定生效)" },
  { value: "self", label: "仅本人", description: "仅本人创建或关联的数据(学生默认此范围)" },
];

/**
 * Data scope configuration matrix.
 * Honest scope note: the listed scopes are declarative; row-level isolation
 * is currently enforced by built-in code rules (students → own records,
 * counselors/department admins → assigned classes via counselor-classes).
 * Declared scopes for custom roles take full effect in a later version.
 */
export function DataPermissionModule({ csrfToken }: { csrfToken: string }) {
  const [roleRows, setRoleRows] = useState<RoleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [bindings, setBindings] = useState<BindingRow[]>([]);
  const [counselors, setCounselors] = useState<CounselorOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedCounselor, setSelectedCounselor] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [bindingBusy, setBindingBusy] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/roles", { credentials: "same-origin" });
      if (!response.ok) { setNotice("角色列表加载失败,请重试"); return; }
      const payload = await response.json() as { data: { items: RoleRow[] } };
      setRoleRows(payload.data.items);
    } catch {
      setNotice("网络连接异常,请检查后重试");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadBindings = useCallback(async () => {
    try {
      const [bindingRes, counselorRes, classRes] = await Promise.all([
        fetch("/api/counselor-classes", { credentials: "same-origin" }),
        fetch("/api/admin/users?role=counselor&pageSize=100", { credentials: "same-origin" }),
        fetch("/api/records/classes?pageSize=100", { credentials: "same-origin" }),
      ]);
      if (bindingRes.ok) {
        const payload = await bindingRes.json() as { data: BindingRow[] };
        setBindings(payload.data);
      }
      if (counselorRes.ok) {
        const payload = await counselorRes.json() as { data: { items: CounselorOption[] } };
        setCounselors(payload.data.items);
      }
      if (classRes.ok) {
        // 班级与警务区队统一存于 business_records(feature_id=classes)，同名班级/区队去重。
        const payload = await classRes.json() as { data: { items: Array<{ data?: Record<string, string> }> } };
        const seen = new Map<string, ClassOption>();
        for (const row of payload.data.items ?? []) {
          const name = row.data?.["班级名称"] ?? "";
          if (name && !seen.has(name)) seen.set(name, { name, grade: row.data?.["所属年级"] ?? "" });
        }
        setClasses([...seen.values()]);
      }
    } catch {
      /* 绑定面板加载失败不阻塞角色配置区 */
    }
  }, []);

  useEffect(() => { void load(); void loadBindings(); }, [load, loadBindings]);

  const counselorName = (userId: string) => counselors.find((c) => c.id === userId)?.displayName ?? userId;

  const addBinding = async () => {
    if (!selectedCounselor || !selectedClass) { setNotice("请选择辅导员和班级后再绑定"); return; }
    setBindingBusy(true);
    try {
      const counselor = counselors.find((c) => c.id === selectedCounselor);
      const faculty = counselor?.roleTags?.find((tag) => tag !== "辅导员") ?? "";
      const classItem = classes.find((c) => c.name === selectedClass);
      const grade = classItem?.grade ?? "";
      const response = await fetch("/api/counselor-classes", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ userId: selectedCounselor, className: selectedClass, faculty, grade }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) { setNotice(payload?.error ?? "绑定失败"); return; }
      setNotice(`已绑定 ${counselor?.displayName ?? "辅导员"} → ${selectedClass}`);
      setSelectedCounselor(""); setSelectedClass("");
      void loadBindings();
    } catch { setNotice("网络异常,绑定未完成"); } finally { setBindingBusy(false); }
  };

  const removeBinding = async (binding: BindingRow) => {
    if (!window.confirm(`确认解除 ${counselorName(binding.userId)} 与 ${binding.className} 的绑定？`)) return;
    setBindingBusy(true);
    try {
      const response = await fetch("/api/counselor-classes", {
        method: "DELETE", credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ id: binding.id }),
      });
      if (!response.ok) { setNotice("解除绑定失败"); return; }
      setNotice(`已解除 ${binding.className} 的绑定`);
      void loadBindings();
    } catch { setNotice("网络异常,解除绑定未完成"); } finally { setBindingBusy(false); }
  };

  const setScope = async (role: RoleRow, dataScope: string) => {
    setBusyId(role.id);
    try {
      const response = await fetch(`/api/admin/roles/${role.id}`, {
        method: "PUT", credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ dataScope }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) { setNotice(payload?.error ?? "保存失败"); return; }
      setNotice(`已更新 ${role.name} 的数据范围`);
      void load();
    } catch { setNotice("网络异常,保存未完成"); } finally { setBusyId(null); }
  };

  return (
    <section className="module-card">
      {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
      <div className="module-hero">
        <span className="module-mark">数</span>
        <div>
          <h2>数据权限</h2>
          <p>配置各角色的数据可见范围。</p>
        </div>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead><tr><th>角色</th><th>数据范围</th><th>范围说明</th><th>用户数</th><th>状态</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} style={{ textAlign: "center", padding: 32 }}>加载中…</td></tr>}
              {!isLoading && roleRows.map((role) => (
                <tr key={role.id}>
                  <td><strong>{role.name}</strong> <code style={{ opacity: 0.7 }}>{role.code}</code></td>
                  <td>
                    <select
                      value={role.dataScope}
                      disabled={busyId === role.id}
                      onChange={(event) => void setScope(role, event.target.value)}
                      style={{ padding: 6 }}
                    >
                      {SCOPES.map((scope) => <option key={scope.value} value={scope.value}>{scope.label}</option>)}
                    </select>
                  </td>
                  <td>{SCOPES.find((scope) => scope.value === role.dataScope)?.description ?? "—"}</td>
                  <td>{role.userCount}</td>
                  <td><span className={`status ${role.status === "停用" ? "pending" : ""}`}>{role.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <section style={{ margin: 16, padding: 16, borderRadius: 10, border: "1px solid var(--color-border, #e5e7eb)", background: "var(--color-surface-muted, #f8fafc)" }}>
        <strong>辅导员-班级绑定</strong>
        <p style={{ margin: "6px 0 10px", opacity: 0.75 }}>辅导员与院系管理员的学生/业务记录数据范围按此绑定限制到所带班级；未绑定任何班级的辅导员看不到学生数据。</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <select value={selectedCounselor} onChange={(event) => setSelectedCounselor(event.target.value)} style={{ padding: 6 }} aria-label="选择辅导员">
            <option value="">选择辅导员…</option>
            {counselors.map((c) => <option key={c.id} value={c.id}>{c.displayName}（{c.roleTags?.filter((tag) => tag !== "辅导员").join("/") || "未设院系"}）</option>)}
          </select>
          <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} style={{ padding: 6 }} aria-label="选择班级">
            <option value="">选择班级/区队…</option>
            {classes.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <button className="primary" type="button" disabled={bindingBusy} onClick={() => void addBinding()}>添加绑定</button>
        </div>
        <div className="table-card">
          <div className="table-scroll">
            <table>
              <thead><tr><th>辅导员</th><th>班级/区队</th><th>院系</th><th>年级</th><th>操作</th></tr></thead>
              <tbody>
                {bindings.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: 20, opacity: 0.6 }}>暂无绑定，请在上方添加</td></tr>}
                {bindings.map((binding) => (
                  <tr key={binding.id}>
                    <td><strong>{counselorName(binding.userId)}</strong></td>
                    <td>{binding.className}</td>
                    <td>{binding.faculty ?? "—"}</td>
                    <td>{binding.grade ?? "—"}</td>
                    <td><button className="link-button" type="button" disabled={bindingBusy} onClick={() => void removeBinding(binding)}>解除绑定</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section style={{ margin: 16, padding: 16, borderRadius: 10, border: "1px solid var(--color-border, #e5e7eb)", background: "var(--color-surface-muted, #f8fafc)" }}>
        <strong>当前实际生效的行级隔离规则(代码内置)</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.9 }}>
          <li><strong>学生(student)</strong>:仅可见本人学籍档案、本人创建的业务记录与本人发起的流程实例。</li>
          <li><strong>辅导员(counselor)/ 院系管理员(department_admin)</strong>:学生数据与业务记录按「辅导员-班级绑定」限制到所带班级范围。</li>
          <li><strong>管理员(admin)</strong>:全校范围,含用户/角色/审计等管理接口。</li>
          <li>其他角色:按接口级权限(read/write/delete/admin)放行,行级范围不受限。</li>
        </ul>
        <p style={{ marginTop: 8, opacity: 0.75, marginBottom: 0 }}>说明:上表的数据范围为声明性配置,自定义角色的声明范围将在后续版本由通用隔离中间件全面接管。</p>
      </section>
    </section>
  );
}
