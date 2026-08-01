"use client";

import { useCallback, useEffect, useState } from "react";
import { BUILTIN_ROLES } from "@/lib/role-defs";

type UserRow = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  roleTags: string[];
  phone: string | null;
  email: string | null;
  orgId: string | null;
  postId: string | null;
  active: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
};

type NamedOption = { id: string; name: string };
type RoleOption = { code: string; label: string; description: string };
type DialogMode = "create" | "edit" | "password" | null;

function roleLabel(roles: RoleOption[], code: string) {
  return roles.find((r) => r.code === code)?.label ?? code;
}

function isLocked(row: UserRow) {
  return Boolean(row.lockedUntil && new Date(row.lockedUntil).getTime() > Date.now());
}

/**
 * User management page backed by /api/admin/users:
 * search/filter/pagination, create, edit, password reset, unlock,
 * enable/disable, force logout, last-admin protection (server-enforced).
 */
export function UserAdminModule({ csrfToken }: { csrfToken: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [orgs, setOrgs] = useState<NamedOption[]>([]);
  const [posts, setPosts] = useState<NamedOption[]>([]);
  const [rolesList, setRolesList] = useState<RoleOption[]>(BUILTIN_ROLES.map((r) => ({ code: r.code, label: r.label, description: r.description })));
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ mode: DialogMode; user: UserRow | null }>({ mode: null, user: null });

  const pageSize = 15;
  const load = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: String(pageSize) });
      if (keyword.trim()) params.set("keyword", keyword.trim());
      if (roleFilter) params.set("role", roleFilter);
      if (activeFilter) params.set("active", activeFilter);
      const response = await fetch(`/api/admin/users?${params.toString()}`, { credentials: "same-origin" });
      if (!response.ok) { setNotice("用户列表加载失败,请重试"); return; }
      const payload = await response.json() as { data: { items: UserRow[]; pagination: { total: number } } };
      setUsers(payload.data.items);
      setTotal(payload.data.pagination.total);
    } catch {
      setNotice("网络连接异常,请检查后重试");
    } finally {
      setIsLoading(false);
    }
  }, [keyword, roleFilter, activeFilter]);

  useEffect(() => { void load(page); }, [load, page]);

  useEffect(() => {
    let active = true;
    const loadOptions = async (featureId: string, setter: (options: NamedOption[]) => void) => {
      try {
        const response = await fetch(`/api/admin/entities/${featureId}?pageSize=200&status=启用`, { credentials: "same-origin" });
        if (!response.ok || !active) return;
        const payload = await response.json() as { data: { items: Array<{ id: string; name: string }> } };
        setter(payload.data.items.map((item) => ({ id: item.id, name: item.name })));
      } catch { /* optional enhancement */ }
    };
    void loadOptions("org-admin", (options) => setOrgs(options));
    void loadOptions("post-admin", (options) => setPosts(options));
    return () => { active = false; };
  }, []);

  // Role options come from the dynamic roles table (falls back to builtins).
  useEffect(() => {
    let active = true;
    fetch("/api/admin/roles", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok || !active) return;
        const payload = await response.json() as { data: { items: Array<{ code: string; name: string; description: string; status: string }> } };
        const items = payload.data.items.filter((i) => i.status === "启用").map((i) => ({ code: i.code, label: i.name, description: i.description }));
        if (items.length > 0) setRolesList(items);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const nameOf = (options: NamedOption[], id: string | null) => (id ? options.find((o) => o.id === id)?.name ?? "—" : "—");

  const act = async (user: UserRow, action: string, body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(user.id);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT", credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) { setNotice(payload?.error ?? "操作失败,请重试"); return; }
      setNotice(action);
      void load(page);
    } catch {
      setNotice("网络异常,操作未完成");
    } finally {
      setBusyId(null);
    }
  };

  const forceLogout = async (user: UserRow) => {
    if (!window.confirm(`确认强制 ${user.displayName} 下线吗?`)) return;
    setBusyId(user.id);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/sessions`, {
        method: "DELETE", credentials: "same-origin",
        headers: { "x-csrf-token": csrfToken },
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) { setNotice(payload?.error ?? "操作失败,请重试"); return; }
      setNotice(`已强制 ${user.displayName} 下线`);
      void load(page);
    } catch {
      setNotice("网络异常,操作未完成");
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="module-card">
      {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
      <div className="module-hero">
        <span className="module-mark">用</span>
        <div>
          <h2>用户管理</h2>
          <p>创建与维护系统账号:分配角色、重置密码、解锁与强制下线。最后一个启用的管理员账号受保护,不可停用或降级。</p>
        </div>
        <button className="primary" onClick={() => setDialog({ mode: "create", user: null })}>＋ 新增用户</button>
      </div>

      <form className="module-filter" onSubmit={(event) => { event.preventDefault(); setPage(1); void load(1); }}>
        <label><span>关键词</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="账号 / 姓名 / 手机号" /></label>
        <label><span>角色</span>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">全部角色</option>
            {rolesList.map((role) => <option key={role.code} value={role.code}>{role.label}</option>)}
          </select>
        </label>
        <label><span>状态</span>
          <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
            <option value="">全部状态</option><option value="true">启用</option><option value="false">停用</option>
          </select>
        </label>
        <button className="primary" type="submit">搜索</button>
        <button className="ghost" type="button" onClick={() => { setKeyword(""); setRoleFilter(""); setActiveFilter(""); setPage(1); }}>清空</button>
      </form>

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead><tr><th>账号</th><th>姓名</th><th>角色</th><th>机构 / 岗位</th><th>手机号</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} style={{ textAlign: "center", padding: 32 }}>加载中…</td></tr>}
              {!isLoading && users.length === 0 && <tr><td colSpan={7}><div className="empty-state">没有符合条件的用户</div></td></tr>}
              {!isLoading && users.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.username}</strong></td>
                  <td>{user.displayName}</td>
                  <td>{roleLabel(rolesList, user.role)}</td>
                  <td>{nameOf(orgs, user.orgId)} / {nameOf(posts, user.postId)}</td>
                  <td>{user.phone ?? "—"}</td>
                  <td>
                    <span className={`status ${user.active ? "" : "pending"}`}>{user.active ? "启用" : "停用"}</span>
                    {isLocked(user) && <span className="status pending" style={{ marginLeft: 6 }}>已锁定</span>}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="link-button" onClick={() => setDialog({ mode: "edit", user })}>编辑</button>
                    <button className="link-button" onClick={() => setDialog({ mode: "password", user })}>重置密码</button>
                    {isLocked(user) && <button className="link-button" disabled={busyId === user.id} onClick={() => void act(user, `已解锁:${user.displayName}`, { unlock: true })}>解锁</button>}
                    <button className="link-button" disabled={busyId === user.id} onClick={() => void forceLogout(user)}>强制下线</button>
                    <button className="link-button" disabled={busyId === user.id} onClick={() => void act(user, `已${user.active ? "停用" : "启用"}:${user.displayName}`, { active: !user.active }, `确认${user.active ? "停用" : "启用"}「${user.displayName}」吗?`)}>{user.active ? "停用" : "启用"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="pagination">
          <span>共 {total} 个用户</span>
          <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
          <span>第 {Math.min(page, totalPages)} / {totalPages} 页</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
        </footer>
      </div>

      {dialog.mode && (
        <UserDialog
          mode={dialog.mode}
          user={dialog.user}
          orgs={orgs}
          posts={posts}
          roles={rolesList}
          csrfToken={csrfToken}
          onClose={() => setDialog({ mode: null, user: null })}
          onSaved={(message) => { setDialog({ mode: null, user: null }); setNotice(message); void load(page); }}
        />
      )}
    </section>
  );
}

function UserDialog({ mode, user, orgs, posts, roles, csrfToken, onClose, onSaved }: {
  mode: "create" | "edit" | "password";
  user: UserRow | null;
  orgs: NamedOption[];
  posts: NamedOption[];
  roles: RoleOption[];
  csrfToken: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState({
    username: user?.username ?? "",
    displayName: user?.displayName ?? "",
    password: "",
    role: user?.role ?? "staff",
    phone: user?.phone ?? "",
    email: user?.email ?? "",
    orgId: user?.orgId ?? "",
    postId: user?.postId ?? "",
  });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const title = mode === "create" ? "新增用户" : mode === "password" ? `重置密码:${user?.displayName ?? ""}` : `编辑用户:${user?.displayName ?? ""}`;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "password") {
        if (form.password.length < 10) { setNotice("密码至少需要 10 个字符"); return; }
        const response = await fetch(`/api/admin/users/${user?.id}`, {
          method: "PUT", credentials: "same-origin",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ password: form.password }),
        });
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok) { setNotice(payload?.error ?? "重置失败,请重试"); return; }
        onSaved(`密码已重置,该用户的其他会话已下线`);
        return;
      }
      const body = mode === "create"
        ? { username: form.username, password: form.password, displayName: form.displayName, role: form.role, phone: form.phone, email: form.email, orgId: form.orgId, postId: form.postId }
        : { displayName: form.displayName, role: form.role, phone: form.phone, email: form.email, orgId: form.orgId, postId: form.postId };
      const response = await fetch(mode === "create" ? "/api/admin/users" : `/api/admin/users/${user?.id}`, {
        method: mode === "create" ? "POST" : "PUT", credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) { setNotice(payload?.error ?? "保存失败,请重试"); return; }
      onSaved(mode === "create" ? "用户已创建" : "用户信息已更新");
    } catch {
      setNotice("网络异常,保存未完成");
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = { width: "100%", padding: 8 };
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}
        style={{ width: "min(560px, calc(100vw - 32px))", maxHeight: "88vh", overflowY: "auto", background: "var(--color-surface, #fff)", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,.18)" }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--color-border, #e5e7eb)" }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
          <button aria-label="关闭" onClick={onClose}>×</button>
        </header>
        <form onSubmit={submit} style={{ padding: 16, display: "grid", gap: 12 }}>
          {notice && <div className="action-notice" role="alert" style={{ position: "static" }}>{notice}</div>}
          {mode !== "password" && (
            <>
              <label style={{ display: "grid", gap: 4 }}>账号 {mode === "create" && <b style={{ color: "var(--color-error)" }}>*</b>}
                <input style={inputStyle} value={form.username} onChange={set("username")} disabled={mode === "edit"} placeholder="字母/数字/下划线,创建后不可修改" required={mode === "create"} />
              </label>
              <label style={{ display: "grid", gap: 4 }}>姓名
                <input style={inputStyle} value={form.displayName} onChange={set("displayName")} placeholder="显示名称" />
              </label>
            </>
          )}
          <label style={{ display: "grid", gap: 4 }}>
            {mode === "password" ? "新密码(至少 10 位,重置后其他会话下线)" : mode === "create" ? <>密码 <b style={{ color: "var(--color-error)" }}>*</b></> : "密码(留空不修改)"}
            <input style={inputStyle} type="password" value={form.password} onChange={set("password")} autoComplete="new-password" placeholder="至少 10 位" required={mode !== "edit"} minLength={10} />
          </label>
          {mode !== "password" && (
            <>
              <label style={{ display: "grid", gap: 4 }}>角色
                <select style={inputStyle} value={form.role} onChange={set("role")}>
                  {roles.map((role) => <option key={role.code} value={role.code}>{role.label} — {role.description}</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: 4 }}>机构
                <select style={inputStyle} value={form.orgId} onChange={set("orgId")}>
                  <option value="">未指定</option>
                  {orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: 4 }}>岗位
                <select style={inputStyle} value={form.postId} onChange={set("postId")}>
                  <option value="">未指定</option>
                  {posts.map((post) => <option key={post.id} value={post.id}>{post.name}</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: 4 }}>手机号
                <input style={inputStyle} value={form.phone} onChange={set("phone")} placeholder="选填" />
              </label>
              <label style={{ display: "grid", gap: 4 }}>邮箱
                <input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="选填" />
              </label>
            </>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="ghost" type="button" onClick={onClose}>取消</button>
            <button className="primary" type="submit" disabled={busy}>{busy ? "提交中…" : mode === "create" ? "创建" : mode === "password" ? "确认重置" : "保存"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
