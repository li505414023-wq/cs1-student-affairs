"use client";

import { Fragment, useEffect, useState } from "react";
import { API_ROUTE_INVENTORY } from "@/lib/api-routes";

type RoleRow = { id: string; code: string; name: string; permissions: string[]; status: string };

/** Can a role with the given permissions access an endpoint requiring `level`? */
function canAccess(permissions: string[], level: string, roleCode: string): boolean {
  if (level === "public") return true;
  if (level === "session") return true; // any active account
  if (roleCode === "admin") return true; // hard guard, mirrors lib/security.ts
  return permissions.includes(level);
}

/**
 * Read-only matrix of API routes × roles, derived from the static route
 * inventory (lib/api-routes.ts) and live role permissions. Mirrors the
 * actual requirePermission enforcement — no separate configuration surface.
 */
export function ApiPermissionModule() {
  const [roleRows, setRoleRows] = useState<RoleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/roles", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok || !active) { if (active) setNotice("角色列表加载失败"); return; }
        const payload = await response.json() as { data: { items: RoleRow[] } };
        setRoleRows(payload.data.items.filter((role) => role.status === "启用"));
      })
      .catch(() => { if (active) setNotice("网络连接异常"); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const modules = [...new Set(API_ROUTE_INVENTORY.map((entry) => entry.module))];

  return (
    <section className="module-card">
      {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
      <div className="module-hero">
        <span className="module-mark">接</span>
        <div>
          <h2>接口权限</h2>
          <p>各 API 接口所需权限级别与角色访问矩阵(只读,与代码中的 requirePermission 执行一致;调整角色权限请到「角色管理」)。</p>
        </div>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>接口</th>
                <th>方法</th>
                <th>所需级别</th>
                {isLoading ? <th>加载中…</th> : roleRows.map((role) => <th key={role.id}>{role.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {modules.map((moduleName) => (
                <Fragment key={moduleName}>
                  <tr style={{ background: "var(--color-surface-muted, #f8fafc)" }}>
                    <td colSpan={3 + roleRows.length}><strong>{moduleName}</strong></td>
                  </tr>
                  {API_ROUTE_INVENTORY.filter((entry) => entry.module === moduleName).map((entry) => (
                    <tr key={`${entry.method} ${entry.path}`}>
                      <td><code>{entry.path}</code><div style={{ fontSize: 12, opacity: 0.65 }}>{entry.description}</div></td>
                      <td>{entry.method}</td>
                      <td><span className={`status ${entry.level === "admin" ? "pending" : ""}`}>{entry.level}</span></td>
                      {!isLoading && roleRows.map((role) => (
                        <td key={role.id} style={{ textAlign: "center" }}>
                          {canAccess(role.permissions, entry.level, role.code)
                            ? <span aria-label="可访问" style={{ color: "var(--color-success, #2f9e62)" }}>✓</span>
                            : <span aria-label="不可访问" style={{ opacity: 0.35 }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p style={{ margin: 12, opacity: 0.75 }}>说明:实际判定以角色拥有的权限项为准;业务记录接口对学生申请类功能存在额外放行规则(见业务记录模块说明)。</p>
    </section>
  );
}
