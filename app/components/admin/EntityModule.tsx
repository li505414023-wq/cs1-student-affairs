"use client";

import { useCallback, useEffect, useState } from "react";
import { getEntityConfig } from "@/lib/entity-features";
import { api, apiErrorMessage, isNetworkError } from "@/lib/api-client";
import { EntityDialog, type EntityItem } from "./EntityDialog";

type ItemRow = EntityItem & { id: string; parentName: string; createdAt: string };

function cellValue(row: ItemRow, key: string): string {
  if (key === "name") return row.name;
  if (key === "code") return row.code || "—";
  if (key === "description") return row.description || "—";
  if (key === "status") return row.status;
  if (key === "sortOrder") return String(row.sortOrder);
  if (key === "parentName") return row.parentName || "—";
  const value = row.data?.[key];
  return value === undefined || value === null || value === "" ? "—" : String(value);
}

/**
 * Generic admin page for managed_items-backed features:
 * list + search/status/parent filters + server pagination + create/edit/toggle/delete.
 */
export function EntityModule({ featureId, csrfToken }: { featureId: string; csrfToken: string }) {
  const config = getEntityConfig(featureId);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [parentFilter, setParentFilter] = useState("");
  const [parentOptions, setParentOptions] = useState<Array<{ code: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EntityItem | null>(null);
  const pageSize = 15;

  const load = useCallback(async (targetPage: number) => {
    if (!config) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: String(pageSize) });
      if (keyword.trim()) params.set("keyword", keyword.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (parentFilter) params.set("parentCode", parentFilter);
      const data = await api.get<{ items: ItemRow[]; pagination: { total: number } }>(`/api/admin/entities/${featureId}?${params.toString()}`);
      setItems(data.items);
      setTotal(data.pagination.total);
    } catch (error) {
      setNotice(isNetworkError(error) ? "网络连接异常,请检查后重试" : "数据加载失败,请重试");
    } finally {
      setIsLoading(false);
    }
  }, [config, featureId, keyword, statusFilter, parentFilter]);

  useEffect(() => { void load(page); }, [load, page]);

  // Parent filter options for hierarchical features
  useEffect(() => {
    if (!config?.hierarchical) return;
    let active = true;
    api.get<{ items: Array<{ code: string; name: string }> }>(`/api/admin/entities/${config.hierarchical.parentFeature}?pageSize=200`)
      .then((data) => { if (active) setParentOptions(data.items.filter((entry) => entry.code)); })
      .catch(() => {});
    return () => { active = false; };
  }, [config]);

  if (!config) return <section className="module-card"><div className="empty-state">未知的功能配置</div></section>;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const search = () => { setPage(1); void load(1); };

  const toggleStatus = async (row: ItemRow) => {
    setBusyId(row.id);
    try {
      await api.put(`/api/admin/entities/${featureId}/${row.id}`, { name: row.name, code: row.code, description: row.description, parentCode: row.parentCode, sortOrder: row.sortOrder, status: row.status === "启用" ? "停用" : "启用", data: row.data });
      setNotice(`已${row.status === "启用" ? "停用" : "启用"}:${row.name}`);
      void load(page);
    } catch (error) {
      setNotice(isNetworkError(error) ? "网络异常,操作未完成" : apiErrorMessage(error, "操作失败,请重试"));
    } finally { setBusyId(null); }
  };

  const remove = async (row: ItemRow) => {
    if (!window.confirm(`确认删除「${row.name}」吗?此操作不可恢复。`)) return;
    setBusyId(row.id);
    try {
      await api.del(`/api/admin/entities/${featureId}/${row.id}`);
      setNotice(`已删除:${row.name}`);
      void load(page);
    } catch (error) {
      setNotice(isNetworkError(error) ? "网络异常,删除未完成" : apiErrorMessage(error, "删除失败,请重试"));
    } finally { setBusyId(null); }
  };

  return (
    <section className="module-card">
      {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
      <div className="module-hero">
        <span className="module-mark">{config.label.slice(0, 1)}</span>
        <div>
          <h2>{config.label}</h2>
          <p>{config.description}</p>
        </div>
        <button className="primary" onClick={() => { setEditingItem(null); setEditorOpen(true); }}>＋ 新增{config.label.replace(/管理$/, "")}</button>
      </div>

      <form className="module-filter" onSubmit={(event) => { event.preventDefault(); search(); }}>
        <label><span>关键词</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="名称 / 编码" /></label>
        <label><span>启用状态</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">全部状态</option><option>启用</option><option>停用</option>
          </select>
        </label>
        {config.hierarchical && (
          <label><span>{config.hierarchical.parentLabel}</span>
            <select value={parentFilter} onChange={(event) => setParentFilter(event.target.value)}>
              <option value="">全部(含根节点)</option>
              <option value="__root__">仅根节点</option>
              {parentOptions.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
            </select>
          </label>
        )}
        <button className="primary" type="submit">搜索</button>
        <button className="ghost" type="button" onClick={() => { setKeyword(""); setStatusFilter(""); setParentFilter(""); setPage(1); }}>清空</button>
      </form>

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead><tr>{config.columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>操作</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={config.columns.length + 1} style={{ textAlign: "center", padding: 32 }}>加载中…</td></tr>}
              {!isLoading && items.length === 0 && <tr><td colSpan={config.columns.length + 1}><div className="empty-state">暂无数据,点击右上角新增</div></td></tr>}
              {!isLoading && items.map((row) => (
                <tr key={row.id}>
                  {config.columns.map((column) => (
                    <td key={column.key}>
                      {column.key === "status"
                        ? <span className={`status ${row.status === "停用" ? "pending" : ""}`}>{row.status}</span>
                        : cellValue(row, column.key)}
                    </td>
                  ))}
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="link-button" onClick={() => { setEditingItem(row); setEditorOpen(true); }}>编辑</button>
                    <button className="link-button" disabled={busyId === row.id} onClick={() => void toggleStatus(row)}>{row.status === "启用" ? "停用" : "启用"}</button>
                    <button className="link-button" disabled={busyId === row.id} onClick={() => void remove(row)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="pagination">
          <span>共 {total} 条记录</span>
          <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
          <span>第 {Math.min(page, totalPages)} / {totalPages} 页</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
        </footer>
      </div>

      {editorOpen && (
        <EntityDialog
          config={config}
          item={editingItem}
          csrfToken={csrfToken}
          onClose={() => setEditorOpen(false)}
          onSaved={(message) => { setEditorOpen(false); setNotice(message); void load(page); }}
        />
      )}
    </section>
  );
}
