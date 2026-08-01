"use client";

import { useCallback, useEffect, useState } from "react";

type RoleRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  permissions: string[];
  tags: string[];
  dataScope: string;
  builtin: boolean;
  status: string;
  userCount: number;
};

const PERMISSIONS = [
  { code: "read", label: "读取" },
  { code: "write", label: "写入" },
  { code: "delete", label: "删除" },
  { code: "admin", label: "管理" },
] as const;

const SCOPE_LABELS: Record<string, string> = { all: "全部数据", faculty: "本院系/班级", self: "仅本人" };

/** Role CRUD + permission assignment backed by /api/admin/roles (dynamic RBAC). */
export function RoleAdminModule({ csrfToken }: { csrfToken: string }) {
  const [roleRows, setRoleRows] = useState<RoleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RoleRow | "new" | null>(null);

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

  const remove = async (role: RoleRow) => {
    if (!window.confirm(`确认删除角色「${role.name}」吗?`)) return;
    setBusyId(role.id);
    try {
      const response = await fetch(`/api/admin/roles/${role.id}`, { method: "DELETE", credentials: "same-origin", headers: { "x-csrf-token": csrfToken } });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) { setNotice(payload?.error ?? "删除失败"); return; }
      setNotice(`已删除角色:${role.name}`);
      void load();
    } catch { setNotice("网络异常,删除未完成"); } finally { setBusyId(null); }
  };

  const toggleStatus = async (role: RoleRow) => {
    setBusyId(role.id);
    try {
      const response = await fetch(`/api/admin/roles/${role.id}`, {
        method: "PUT", credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ status: role.status === "启用" ? "停用" : "启用" }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) { setNotice(payload?.error ?? "操作失败"); return; }
      setNotice(`已${role.status === "启用" ? "停用" : "启用"}角色:${role.name}`);
      void load();
    } catch { setNotice("网络异常,操作未完成"); } finally { setBusyId(null); }
  };

  return (
    <section className="module-card">
      {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
      <div className="module-hero">
        <span className="module-mark">角</span>
        <div>
          <h2>角色管理</h2>
          <p>动态角色与权限:创建自定义角色并分配读取/写入/删除/管理权限,保存后 1 分钟内(或立即)对全站生效。系统管理员角色的权限受保护不可修改。</p>
        </div>
        <button className="primary" onClick={() => setEditing("new")}>＋ 新增角色</button>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead><tr><th>角色名称</th><th>编码</th><th>权限</th><th>数据范围</th><th>用户数</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} style={{ textAlign: "center", padding: 32 }}>加载中…</td></tr>}
              {!isLoading && roleRows.map((role) => (
                <tr key={role.id}>
                  <td><strong>{role.name}</strong>{role.builtin && <span className="status" style={{ marginLeft: 6 }}>内置</span>}<div style={{ fontSize: 12, opacity: 0.65 }}>{role.description}</div></td>
                  <td><code>{role.code}</code></td>
                  <td>{role.code === "admin" ? "全部权限(受保护)" : role.permissions.map((p) => PERMISSIONS.find((x) => x.code === p)?.label ?? p).join("、") || "—"}</td>
                  <td>{SCOPE_LABELS[role.dataScope] ?? role.dataScope}</td>
                  <td>{role.userCount}</td>
                  <td><span className={`status ${role.status === "停用" ? "pending" : ""}`}>{role.status}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="link-button" onClick={() => setEditing(role)}>编辑</button>
                    <button className="link-button" disabled={busyId === role.id || role.code === "admin"} onClick={() => void toggleStatus(role)}>{role.status === "启用" ? "停用" : "启用"}</button>
                    {!role.builtin && <button className="link-button" disabled={busyId === role.id} onClick={() => void remove(role)}>删除</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <RoleDialog
          role={editing === "new" ? null : editing}
          csrfToken={csrfToken}
          onClose={() => setEditing(null)}
          onSaved={(message) => { setEditing(null); setNotice(message); void load(); }}
        />
      )}
    </section>
  );
}

function RoleDialog({ role, csrfToken, onClose, onSaved }: {
  role: RoleRow | null;
  csrfToken: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isEdit = Boolean(role);
  const isAdminRole = role?.code === "admin";
  const [form, setForm] = useState({
    code: role?.code ?? "",
    name: role?.name ?? "",
    description: role?.description ?? "",
    permissions: new Set<string>(role?.permissions ?? ["read"]),
    tags: (role?.tags ?? []).join(","),
    dataScope: role?.dataScope ?? "self",
  });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const togglePermission = (code: string) => setForm((current) => {
    const next = new Set(current.permissions);
    if (next.has(code)) next.delete(code); else next.add(code);
    return { ...current, permissions: next };
  });

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const body = {
        ...(isEdit ? {} : { code: form.code }),
        name: form.name,
        description: form.description,
        permissions: [...form.permissions],
        tags: form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
        dataScope: form.dataScope,
      };
      const response = await fetch(isEdit ? `/api/admin/roles/${role?.id}` : "/api/admin/roles", {
        method: isEdit ? "PUT" : "POST", credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) { setNotice(payload?.error ?? "保存失败,请重试"); return; }
      onSaved(`角色已${isEdit ? "更新" : "创建"},权限变更即时生效`);
    } catch { setNotice("网络异常,保存未完成"); } finally { setBusy(false); }
  };

  const inputStyle = { width: "100%", padding: 8 };
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-label={isEdit ? "编辑角色" : "新增角色"} onMouseDown={(event) => event.stopPropagation()}
        style={{ width: "min(560px, calc(100vw - 32px))", maxHeight: "88vh", overflowY: "auto", background: "var(--color-surface, #fff)", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,.18)" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--color-border, #e5e7eb)" }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>{isEdit ? `编辑角色:${role?.name}` : "新增角色"}</h2>
          <button aria-label="关闭" onClick={onClose}>×</button>
        </header>
        <form onSubmit={submit} style={{ padding: 16, display: "grid", gap: 12 }}>
          {notice && <div className="action-notice" role="alert" style={{ position: "static" }}>{notice}</div>}
          {!isEdit && (
            <label style={{ display: "grid", gap: 4 }}>角色编码 *
              <input style={inputStyle} value={form.code} onChange={(event) => setForm((c) => ({ ...c, code: event.target.value }))} placeholder="小写字母/数字/下划线,创建后不可修改" required />
            </label>
          )}
          <label style={{ display: "grid", gap: 4 }}>角色名称 *
            <input style={inputStyle} value={form.name} onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))} required maxLength={30} />
          </label>
          <fieldset style={{ border: "1px solid var(--color-border, #e5e7eb)", borderRadius: 8, padding: 12 }} disabled={isAdminRole}>
            <legend style={{ fontSize: 13, opacity: 0.75 }}>权限 {isAdminRole && "(系统管理员受保护,不可修改)"}</legend>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {PERMISSIONS.map((permission) => (
                <label key={permission.code} style={{ display: "inline-flex", gap: 6, alignItems: "center", minWidth: 120, color: "var(--color-text-primary)" }}>
                  <input type="checkbox" style={{ width: 18, height: 18, flex: "0 0 auto" }} checked={isAdminRole ? true : form.permissions.has(permission.code)} onChange={() => togglePermission(permission.code)} />
                  <span>{permission.label}({permission.code})</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label style={{ display: "grid", gap: 4 }}>数据范围(声明性)
            <select style={inputStyle} value={form.dataScope} onChange={(event) => setForm((c) => ({ ...c, dataScope: event.target.value }))}>
              <option value="all">全部数据</option>
              <option value="faculty">本院系/班级</option>
              <option value="self">仅本人</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>角色标签(逗号分隔,用于工作流任务匹配)
            <input style={inputStyle} value={form.tags} onChange={(event) => setForm((c) => ({ ...c, tags: event.target.value }))} placeholder="如:辅导员,班主任" />
          </label>
          <label style={{ display: "grid", gap: 4 }}>描述
            <textarea style={inputStyle} value={form.description} onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))} maxLength={200} rows={2} />
          </label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="ghost" type="button" onClick={onClose}>取消</button>
            <button className="primary" type="submit" disabled={busy}>{busy ? "保存中…" : "保存"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
