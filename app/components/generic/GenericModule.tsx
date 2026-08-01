"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { workflow } from "@/app/system-data";
import { getPresentation } from "@/app/feature-metadata";
import { filterTableRows } from "@/app/interaction-utils.js";
import { downloadCsv } from "@/app/components/shared/download-csv";
import { FeatureTable } from "./FeatureTable";
import { ColumnSettingsDialog } from "./ColumnSettingsDialog";
import { StatisticsOverview } from "./StatisticsOverview";
import { GenericImportDialog } from "./GenericImportDialog";
import { BusinessRecordForm } from "../forms/BusinessRecordForm";

type CurrentUser = { id: string; displayName: string; role: string } | null;

export function GenericModule({ featureId, feature, description, stage, csrfToken, currentUser }: {
  featureId: string; feature: string; description?: string; stage?: string; csrfToken: string;
  currentUser?: CurrentUser;
}) {
  const [recordMode, setRecordMode] = useState<"create" | "view" | null>(null);
  const [filterDraft, setFilterDraft] = useState<Record<string, string>>({});
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [showColumns, setShowColumns] = useState(false);
  const [showGenericImport, setShowGenericImport] = useState(false);
  const [notice, setNotice] = useState("");
  const [persistedRows, setPersistedRows] = useState<Array<Record<string, string | number>>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [formFields, setFormFields] = useState<Array<{ id: string; type: string; label: string; required: boolean }>>([]);
  const [stats, setStats] = useState<{ total: number; byStatus: Array<{ status: string; count: number }>; sums: Record<string, number> } | null>(null);
  const RECORDS_PAGE_SIZE = 20;
  const stageIndex = Math.max(0, ["config", "batch", "apply", "review", "archive"].indexOf(stage ?? "review"));
  const presentation = getPresentation(featureId, stage);
  const primaryAction = presentation.primaryAction;
  const columns = visibleColumns.length ? visibleColumns : presentation.columns;

  // Real data fetch with loading state, server-side pagination, error handling
  const fetchRecords = useCallback(() => {
    setIsLoading(true);
    fetch(`/api/records/${featureId}?page=${page}&pageSize=${RECORDS_PAGE_SIZE}`, { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) { setNotice("数据加载失败，请重试"); return; }
        const payload = await response.json() as { data: { items: Array<{ id: string; status?: string; data: Record<string, string | number> }>; pagination?: { total: number } } };
        setPersistedRows(payload.data.items.map((item) => ({ id: item.id, status: item.status ?? "", ...item.data })));
        setTotalRecords(payload.data.pagination?.total ?? payload.data.items.length);
      })
      .catch(() => { setNotice("网络连接异常，请检查后重试"); })
      .finally(() => setIsLoading(false));
  }, [featureId, page]);

  // Server-side aggregation over the full scoped set (not the current page).
  useEffect(() => {
    if (presentation.variant !== "statistics") { setStats(null); return; }
    let active = true;
    fetch(`/api/records/${featureId}/stats?columns=${encodeURIComponent(presentation.columns.join(","))}`, { credentials: "same-origin" })
      .then(async (r) => (r.ok ? (await r.json() as { data: { total: number; byStatus: Array<{ status: string; count: number }>; sums: Record<string, number> } }).data : null))
      .then((d) => { if (active && d) setStats(d); })
      .catch(() => {});
    return () => { active = false; };
  }, [featureId, presentation.variant]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Fetch workflow form fields for this feature (for dynamic form rendering)
  useEffect(() => {
    fetch("/api/workflows", { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) return;
        const payload = await r.json() as { data: { forms: Array<{ id: string; key: string; fields: Array<{ id: string; type: string; label: string; required: boolean }> }>; models: Array<{ key: string; formId: string }> } };
        const model = payload.data.models.find((m) => m.key === featureId);
        if (model) {
          const form = payload.data.forms.find((f) => f.id === model.formId);
          if (form?.fields?.length) setFormFields(form.fields);
        }
      })
      .catch(() => {});
  }, [featureId]);

  // Only show real data — no demo rows mixed in
  const tableRows = persistedRows;
  const filteredRows = useMemo<Array<Record<string, string | number>>>(() => filterTableRows(tableRows, appliedFilters), [tableRows, appliedFilters]);

  const importRecords = async (rows: Array<Record<string, string>>) => {
    setShowGenericImport(false);
    try {
      const response = await fetch(`/api/records/${featureId}/batch`, {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ records: rows.map((row) => ({ data: row, status: "已提交" })) }),
      });
      const payload = await response.json() as { data?: { savedCount: number; total: number; errors: Array<{ message: string }> }; error?: string };
      if (!response.ok || !payload.data) { setNotice(payload.error ?? `${feature}批量导入失败`); return; }
      const { savedCount, total, errors } = payload.data;
      setNotice(errors.length > 0
        ? `成功导入 ${savedCount} / ${total} 条，${errors.length} 条失败: ${errors.slice(0, 3).map((e) => e.message).join("; ")}${errors.length > 3 ? "…" : ""}`
        : `已将 ${savedCount} 条${feature}记录写入数据库`);
      fetchRecords();
    } catch {
      setNotice("网络异常，批量导入未完成，请重试");
    }
  };

  const saveRecord = async (data: Record<string, string>) => {
    const response = await fetch(`/api/records/${featureId}`, {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify({ data, status: stage === "review" ? "已提交" : "草稿" }),
    });
    const payload = await response.json() as { data?: { id: string; data: Record<string, string | number> }; error?: string };
    if (!response.ok || !payload.data) { setNotice(payload.error ?? `${feature}保存失败`); return; }
    setPersistedRows((current) => [{ id: payload.data!.id, ...data }, ...current]);
    setRecordMode(null);
    setNotice(recordMode === "create" ? `${feature}记录已保存` : `${feature}处理结果已提交`);
  };

  if (recordMode) {
    return (
      <BusinessRecordForm
        featureId={featureId} feature={feature} stage={stage ?? "review"} mode={recordMode}
        onClose={() => setRecordMode(null)} onSave={saveRecord}
        currentUser={currentUser}
        formFields={formFields}
      />
    );
  }

  return (
    <section className="module-card">
      {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
      <div className="module-hero">
        <span className="module-mark">{feature.slice(0, 1)}</span>
        <div>
          <h2>{feature}</h2>
          <p>{description ?? `用于维护${feature}相关记录、审批状态与归档结果。`}</p>
        </div>
        {primaryAction && (
          <button className="primary" onClick={() => primaryAction.includes("导入") ? setShowGenericImport(true) : setRecordMode("create")}>
            ＋ {primaryAction}
          </button>
        )}
      </div>

      {presentation.variant === "workflow" && (
        <div className="stage-line">
          {workflow.map((step, index) => <div className={index <= stageIndex ? "done" : ""} key={step}><span>{index + 1}</span><p>{step}</p></div>)}
        </div>
      )}

      <form className="module-filter" onSubmit={(event) => { event.preventDefault(); setAppliedFilters({ ...filterDraft }); }}>
        {presentation.filters.map((filter) => (
          <label key={filter}><span>{filter}</span>
            {filter.includes("状态") || filter.includes("方式") || filter.includes("范围") ? (
              <select value={filterDraft[filter] ?? ""} onChange={(event) => setFilterDraft((current) => ({ ...current, [filter]: event.target.value }))}>
                <option value="">请选择{filter}</option><option>全部</option><option>正常</option>
              </select>
            ) : (
              <input value={filterDraft[filter] ?? ""} onChange={(event) => setFilterDraft((current) => ({ ...current, [filter]: event.target.value }))}
                type={filter.includes("时间") || filter.includes("日期") ? "date" : "text"} placeholder={`请输入${filter}`} />
            )}
          </label>
        ))}
        <button className="primary" type="submit">搜索</button>
        <button className="ghost" type="button" onClick={() => { setFilterDraft({}); setAppliedFilters({}); }}>清空</button>
      </form>

      {presentation.variant === "statistics" && stats && <StatisticsOverview feature={feature} total={stats.total} byStatus={stats.byStatus} sums={stats.sums} />}

      <FeatureTable
        featureId={featureId} feature={feature} columns={columns} rows={filteredRows} rowAction={presentation.rowAction}
        isLoading={isLoading}
        onView={() => setRecordMode("view")}
        onExport={() => { downloadCsv(`${feature}.csv`, columns, filteredRows.map((row) => columns.map((column) => String(row[column] ?? "")))); }}
        onRefresh={() => { fetchRecords(); setFilterDraft({}); setAppliedFilters({}); }}
        onColumns={() => setShowColumns(true)}
      />

      {totalRecords > RECORDS_PAGE_SIZE && (
        <footer className="pagination" style={{ marginTop: 12 }}>
          <span>共 {totalRecords} 条记录</span>
          <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
          <span>第 {page} / {Math.max(1, Math.ceil(totalRecords / RECORDS_PAGE_SIZE))} 页</span>
          <button disabled={page >= Math.ceil(totalRecords / RECORDS_PAGE_SIZE)} onClick={() => setPage((p) => p + 1)}>›</button>
        </footer>
      )}

      {showColumns && <ColumnSettingsDialog columns={presentation.columns} visibleColumns={columns} onChange={setVisibleColumns} onClose={() => setShowColumns(false)} />}
      {showGenericImport && <GenericImportDialog feature={feature} columns={presentation.columns} onClose={() => setShowGenericImport(false)} onImported={(rows) => { void importRecords(rows); }} />}
    </section>
  );
}
