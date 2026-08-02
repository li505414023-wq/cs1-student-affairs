"use client";

import { useState } from "react";

export function FeatureTable({ featureId, feature, columns, rows, rowAction, onView, onExport, onRefresh, onColumns, isLoading }: {
  featureId: string; feature: string; columns: string[]; rows: Array<Record<string, string | number>>;
  rowAction?: string; onView: () => void; onExport: () => void; onRefresh: () => void; onColumns: () => void;
  isLoading?: boolean;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Status color: check actual status value, not row.id hack
  function statusClass(row: Record<string, string | number>) {
    const s = String(row["状态"] ?? row["status"] ?? "");
    if (s.includes("待") || s.includes("中")) return "pending";
    if (s.includes("拒绝") || s.includes("停用") || s.includes("异常")) return "danger";
    return "";
  }

  return (
    <div className="feature-table">
      <div className="feature-table-head">
        <strong>{feature}记录</strong>
        <div className="round-actions">
          <button aria-label="导出" onClick={onExport}>↓</button>
          <button aria-label="刷新" onClick={onRefresh} disabled={isLoading}>↻</button>
          <button aria-label="列设置" onClick={onColumns}>⚙</button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}<th>操作</th></tr></thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={columns.length + 1} style={{ textAlign: "center", padding: "40px" }}>加载中…</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={columns.length + 1}><div className="empty-state">暂无数据</div></td></tr>
            ) : (
              pageRows.map((row) => (
                <tr key={`${featureId}-${row.id}`}>
                  {columns.map((column) => (
                    <td key={column} data-label={column}>
                      {column.includes("状态") || column === "status" ? (
                        <span className={`status ${statusClass(row)}`}>{row[column]}</span>
                      ) : row[column]}
                    </td>
                  ))}
                  <td data-label="操作"><button className="link-button" onClick={onView}>{rowAction ?? "查看"}</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <footer className="pagination">
        <span>共 {rows.length} 条记录</span>
        <select aria-label="每页条数" disabled><option value={pageSize}>每页 {pageSize} 条</option></select>
        <button disabled={safePage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>‹</button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          const start = Math.max(1, Math.min(safePage - 3, totalPages - 6));
          const page = start + i;
          if (page > totalPages) return null;
          return <button key={page} className={safePage === page ? "active" : ""} aria-current={safePage === page ? "page" : undefined} onClick={() => setCurrentPage(page)}>{page}</button>;
        })}
        <button disabled={safePage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>›</button>
      </footer>
    </div>
  );
}
