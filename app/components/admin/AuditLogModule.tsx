"use client";

import { useCallback, useEffect, useState } from "react";

type LogRow = {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  detailJson: Record<string, unknown>;
  ip: string;
  createdAt: string;
};

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN", { hour12: false });
}

/**
 * Audit log viewer backed by GET /api/admin/logs (multi-dimensional filters,
 * server-side pagination). Visible to admin only (lives in the monitor group).
 */
export function AuditLogModule({ feature }: { feature: string }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const PAGE_SIZE = 20;

  const load = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (action.trim()) params.set("action", action.trim());
    if (resourceType.trim()) params.set("resourceType", resourceType.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/admin/logs?${params.toString()}`, { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) { setNotice("审计日志加载失败，请重试"); return; }
        const payload = await response.json() as { data: { items: LogRow[]; pagination: { total: number } } };
        setRows(payload.data.items);
        setTotal(payload.data.pagination.total);
      })
      .catch(() => setNotice("网络连接异常，请检查后重试"))
      .finally(() => setIsLoading(false));
  }, [page, action, resourceType, from, to]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const resetFilters = () => { setAction(""); setResourceType(""); setFrom(""); setTo(""); setPage(1); };

  return (
    <section className="module-card">
      {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
      <div className="module-hero">
        <span className="module-mark">审</span>
        <div>
          <h2>{feature}</h2>
          <p>按操作类型、资源、时间范围追溯系统操作记录（登录、用户管理、审批、导入等）。</p>
        </div>
        <button className="ghost" onClick={() => load()}>刷新</button>
      </div>

      <form className="module-filter" onSubmit={(event) => { event.preventDefault(); setPage(1); load(); }}>
        <label><span>操作类型</span><input value={action} onChange={(e) => setAction(e.target.value)} placeholder="如 login / create / advance_workflow" /></label>
        <label><span>资源类型</span><input value={resourceType} onChange={(e) => setResourceType(e.target.value)} placeholder="如 user / workflow_instance" /></label>
        <label><span>开始时间</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label><span>结束时间</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button className="primary" type="submit">搜索</button>
        <button className="ghost" type="button" onClick={resetFilters}>清空</button>
      </form>

      <div className="table-scroll">
        <table>
          <thead><tr><th>时间</th><th>操作人</th><th>操作</th><th>资源类型</th><th>资源ID</th><th>IP</th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={{ textAlign: "center", padding: 24 }}>加载中…</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 24 }}>没有符合条件的日志</td></tr>}
            {!isLoading && rows.map((row) => (
              <tr key={row.id}>
                <td>{formatTime(row.createdAt)}</td>
                <td>{row.userId ? <code>{row.userId.slice(0, 8)}…</code> : "—"}</td>
                <td><strong>{row.action}</strong></td>
                <td>{row.resourceType}</td>
                <td>{row.resourceId ? <code>{row.resourceId.slice(0, 8)}…</code> : "—"}</td>
                <td>{row.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="pagination" style={{ marginTop: 12 }}>
        <span>共 {total} 条日志</span>
        <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
        <span>第 {Math.min(page, totalPages)} / {totalPages} 页</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
      </footer>
    </section>
  );
}
