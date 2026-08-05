"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { api, isNetworkError } from "@/lib/api-client";

type LogRow = {
  id: string;
  level: string;
  category: string;
  message: string;
  path: string | null;
  method: string | null;
  ip: string | null;
  detailJson: Record<string, unknown>;
  createdAt: string;
};

/** Error/system log viewer backed by /api/admin/system-logs (written by fail()). */
export function SystemLogModule({ feature }: { feature: string }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [level, setLevel] = useState("error");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pageSize = 20;

  const load = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: String(pageSize) });
      if (keyword.trim()) params.set("keyword", keyword.trim());
      if (level) params.set("level", level);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const data = await api.get<{ items: LogRow[]; pagination: { total: number } }>(`/api/admin/system-logs?${params.toString()}`);
      setRows(data.items);
      setTotal(data.pagination.total);
    } catch (error) {
      setNotice(isNetworkError(error) ? "网络连接异常,请检查后重试" : "日志加载失败,请重试");
    } finally {
      setIsLoading(false);
    }
  }, [keyword, level, from, to]);

  useEffect(() => { void load(page); }, [load, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="module-card">
      {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
      <div className="module-hero">
        <span className="module-mark">错</span>
        <div>
          <h2>{feature}</h2>
          <p>系统异常日志:API 5xx 错误与未捕获异常自动记录(含请求路径、IP、堆栈摘要)。</p>
        </div>
        <button className="ghost" onClick={() => void load(page)}>刷新</button>
      </div>

      <form className="module-filter" onSubmit={(event) => { event.preventDefault(); setPage(1); void load(1); }}>
        <label><span>关键词</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="错误信息关键词" /></label>
        <label><span>级别</span>
          <select value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="">全部级别</option><option value="error">error</option>
          </select>
        </label>
        <label><span>开始时间</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label><span>结束时间</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <button className="primary" type="submit">搜索</button>
        <button className="ghost" type="button" onClick={() => { setKeyword(""); setLevel("error"); setFrom(""); setTo(""); setPage(1); }}>清空</button>
      </form>

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead><tr><th>时间</th><th>级别</th><th>请求</th><th>错误信息</th><th>IP</th><th>操作</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} style={{ textAlign: "center", padding: 32 }}>加载中…</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={6}><div className="empty-state">暂无日志记录——这是好事</div></td></tr>}
              {!isLoading && rows.map((row) => (
                <Fragment key={row.id}>
                  <tr>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(row.createdAt).toLocaleString("zh-CN", { hour12: false })}</td>
                    <td><span className="status pending">{row.level}</span></td>
                    <td><code>{row.method ?? ""} {row.path ?? "—"}</code></td>
                    <td style={{ maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.message}</td>
                    <td>{row.ip ?? "—"}</td>
                    <td><button className="link-button" onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}>{expandedId === row.id ? "收起" : "详情"}</button></td>
                  </tr>
                  {expandedId === row.id && (
                    <tr>
                      <td colSpan={6}>
                        <pre style={{ margin: 0, padding: 12, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all", background: "var(--color-surface-muted, #f8fafc)", borderRadius: 8 }}>
                          {JSON.stringify({ category: row.category, detail: row.detailJson }, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="pagination">
          <span>共 {total} 条日志</span>
          <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
          <span>第 {Math.min(page, totalPages)} / {totalPages} 页</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
        </footer>
      </div>
    </section>
  );
}
