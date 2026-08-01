"use client";

import { useCallback, useEffect, useState } from "react";

type RoleRow = { id: string; code: string; name: string; dataScope: string; builtin: boolean; status: string; userCount: number };

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

  useEffect(() => { void load(); }, [load]);

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
