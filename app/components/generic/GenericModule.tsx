"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { getPresentation, filterOptionsFor } from "@/app/feature-metadata";
import { filterTableRows } from "@/app/interaction-utils.js";
import { downloadCsv } from "@/app/components/shared/download-csv";
import { api, apiErrorMessage, isNetworkError } from "@/lib/api-client";
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
  void csrfToken; // CSRF 由 api-client 统一携带
  const [recordMode, setRecordMode] = useState<"create" | "view" | "edit" | null>(null);
  const [filterDraft, setFilterDraft] = useState<Record<string, string>>({});
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(true);
  useEffect(() => {
    // 移动端默认收起筛选，桌面端保持展开（effect 在水合后运行，避免 SSR 不一致）。
    if (window.matchMedia("(max-width: 680px)").matches) setFiltersOpen(false);
  }, []);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [showColumns, setShowColumns] = useState(false);
  const [showGenericImport, setShowGenericImport] = useState(false);
  const [notice, setNotice] = useState("");
  const [persistedRows, setPersistedRows] = useState<Array<Record<string, string | number>>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [formFields, setFormFields] = useState<Array<{ id: string; type: string; label: string; required: boolean }>>([]);
  const [workflowModelKey, setWorkflowModelKey] = useState("");
  const [selectedRow, setSelectedRow] = useState<Record<string, string | number> | null>(null);
  const [stats, setStats] = useState<{ total: number; byStatus: Array<{ status: string; count: number }>; sums: Record<string, number> } | null>(null);
  const RECORDS_PAGE_SIZE = 20;
  const presentation = getPresentation(featureId, stage);
  const primaryAction = presentation.primaryAction;
  const columns = visibleColumns.length ? visibleColumns : presentation.columns;

  // Real data fetch with loading state, server-side pagination, error handling
  const fetchRecords = useCallback(() => {
    setIsLoading(true);
    api.get<{ items: Array<{ id: string; status?: string; data: Record<string, string | number>; workflow?: { node: string; status: string; instanceId: string } | null }>; pagination?: { total: number } }>(
      `/api/records/${featureId}?page=${page}&pageSize=${RECORDS_PAGE_SIZE}`,
    )
      .then((data) => {
        setPersistedRows(data.items.map((item) => ({
          id: item.id,
          status: item.status ?? "",
          // Workflow tables expose record id/status as business columns
          ...(presentation.variant === "workflow" ? { 申请编号: String(item.id).slice(0, 8), 当前节点: item.workflow?.node ?? "", 审核状态: item.status ?? item.workflow?.status ?? "", 流程实例ID: item.workflow?.instanceId ?? "" } : {}),
          ...item.data,
        })));
        setTotalRecords(data.pagination?.total ?? data.items.length);
      })
      .catch((error) => { setNotice(isNetworkError(error) ? "网络连接异常，请检查后重试" : "数据加载失败，请重试"); })
      .finally(() => setIsLoading(false));
  }, [featureId, page, presentation.variant]);

  // Server-side aggregation over the full scoped set (not the current page).
  useEffect(() => {
    if (presentation.variant !== "statistics") { setStats(null); return; }
    let active = true;
    api.get<{ total: number; byStatus: Array<{ status: string; count: number }>; sums: Record<string, number> }>(
      `/api/records/${featureId}/stats?columns=${encodeURIComponent(presentation.columns.join(","))}`,
    )
      .then((data) => { if (active) setStats(data); })
      .catch(() => {});
    return () => { active = false; };
  }, [featureId, presentation.variant]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Fetch workflow form fields for this feature (for dynamic form rendering)
  useEffect(() => {
    api.get<{ forms: Array<{ id: string; key: string; fields: Array<{ id: string; type: string; label: string; required: boolean }> }>; models: Array<{ key: string; formId: string }> }>("/api/workflows")
      .then((data) => {
        const model = data.models.find((m) => m.key === featureId);
        if (model) {
          setWorkflowModelKey(model.key);
          const form = data.forms.find((f) => f.id === model.formId);
          if (form?.fields?.length) setFormFields(form.fields);
        }
      })
      .catch(() => {});
  }, [featureId]);

  // Only show real data — no demo rows mixed in
  const tableRows = persistedRows;
  const filteredRows = useMemo<Array<Record<string, string | number>>>(() => filterTableRows(tableRows, appliedFilters), [tableRows, appliedFilters]);
  const activeFilterCount = Object.values(appliedFilters).filter((value) => value && value !== "全部").length;

  const importRecords = async (rows: Array<Record<string, string>>) => {
    setShowGenericImport(false);
    try {
      const { savedCount, total, errors } = await api.post<{ savedCount: number; total: number; errors: Array<{ message: string }> }>(
        `/api/records/${featureId}/batch`,
        { records: rows.map((row) => ({ data: row, status: "已提交" })) },
      );
      setNotice(errors.length > 0
        ? `成功导入 ${savedCount} / ${total} 条，${errors.length} 条失败: ${errors.slice(0, 3).map((e) => e.message).join("; ")}${errors.length > 3 ? "…" : ""}`
        : `已将 ${savedCount} 条${feature}记录写入数据库`);
      fetchRecords();
    } catch (error) {
      setNotice(isNetworkError(error) ? "网络异常，批量导入未完成，请重试" : apiErrorMessage(error, `${feature}批量导入失败`));
    }
  };

  const saveRecord = async (data: Record<string, string>) => {
    // 编辑模式：更新既有记录（PUT），不新增。
    if (recordMode === "edit" && selectedRow?.id) {
      try {
        await api.put(`/api/records/${featureId}/${selectedRow.id}`, { data, status: String(selectedRow.status ?? "已提交") });
      } catch (error) {
        setNotice(isNetworkError(error) ? "网络异常，更新未完成，请重试" : apiErrorMessage(error, `${feature}更新失败`));
        return;
      }
      fetchRecords();
      setRecordMode(null);
      setSelectedRow(null);
      setNotice(`${feature}记录已更新`);
      return;
    }
    const submitStatus = stage === "review" || workflowModelKey ? "已提交" : "草稿";
    let created: { id: string; data: Record<string, string | number> };
    try {
      created = await api.post(`/api/records/${featureId}`, { data, status: submitStatus });
    } catch (error) {
      setNotice(apiErrorMessage(error, `${feature}保存失败`));
      return;
    }
    // Start the approval workflow when a deployed model exists for this feature
    if (workflowModelKey && recordMode === "create") {
      try {
        await api.post("/api/workflow/instances", { modelKey: workflowModelKey, recordId: created.id, formData: data });
      } catch {
        setNotice(`${feature}记录已保存，但审批流程发起失败`);
      }
    }
    // Re-fetch so business columns (申请编号/当前节点/审核状态) come from the server
    fetchRecords();
    setRecordMode(null);
    setNotice(recordMode === "create" ? `${feature}记录已保存` : `${feature}处理结果已提交`);
  };

  const resubmitRecord = async (row: Record<string, string | number>) => {
    const instanceId = String(row["流程实例ID"] ?? "");
    if (!instanceId) { setNotice("该记录没有可重新提交流程"); return; }
    try {
      await api.post(`/api/workflow/instances/${instanceId}`, { action: "resubmit" });
      setNotice(`${feature}已重新提交审批`);
      fetchRecords();
    } catch (error) {
      setNotice(isNetworkError(error) ? "网络异常，重新提交未完成，请重试" : apiErrorMessage(error, "重新提交失败"));
    }
  };

  const deleteRecord = async () => {
    if (!selectedRow?.id) return;
    try {
      await api.del(`/api/records/${featureId}/${selectedRow.id}`);
    } catch (error) {
      setNotice(isNetworkError(error) ? "网络异常，删除未完成，请重试" : apiErrorMessage(error, `${feature}删除失败`));
      return;
    }
    fetchRecords();
    setRecordMode(null);
    setSelectedRow(null);
    setNotice(`${feature}记录已删除`);
  };

  if (recordMode) {
    const rowData = selectedRow && recordMode !== "create"
      ? { status: String(selectedRow.status ?? ""), data: Object.fromEntries(Object.entries(selectedRow).filter(([key]) => key !== "id" && key !== "status")) }
      : undefined;
    return (
      <BusinessRecordForm
        featureId={featureId} feature={feature} stage={stage ?? "review"} mode={recordMode}
        onClose={() => { setRecordMode(null); setSelectedRow(null); }} onSave={saveRecord}
        currentUser={currentUser}
        formFields={formFields}
        record={rowData}
        onDelete={recordMode === "edit" ? deleteRecord : undefined}
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

      <div className="filter-toggle-row">
        <button className="ghost" type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
          {filtersOpen ? "收起筛选" : `展开筛选${activeFilterCount > 0 ? `（${activeFilterCount} 个条件）` : ""}`}
        </button>
      </div>
      {filtersOpen && (
      <form className="module-filter" onSubmit={(event) => { event.preventDefault(); setAppliedFilters({ ...filterDraft }); }}>
        {presentation.filters.map((filter) => {
          const options = filterOptionsFor(filter);
          return (
            <label key={filter}><span>{filter}</span>
              {options ? (
                <select value={filterDraft[filter] ?? ""} onChange={(event) => setFilterDraft((current) => ({ ...current, [filter]: event.target.value }))}>
                  <option value="">请选择{filter}</option><option>全部</option>
                  {options.map((option) => <option key={option}>{option}</option>)}
                </select>
              ) : (
                <input value={filterDraft[filter] ?? ""} onChange={(event) => setFilterDraft((current) => ({ ...current, [filter]: event.target.value }))}
                  type={filter.includes("时间") || filter.includes("日期") ? "date" : "text"} placeholder={`请输入${filter}`} />
              )}
            </label>
          );
        })}
        <button className="primary" type="submit">搜索</button>
        <button className="ghost" type="button" onClick={() => { setFilterDraft({}); setAppliedFilters({}); }}>清空</button>
      </form>
      )}

      {presentation.variant === "statistics" && stats && <StatisticsOverview feature={feature} total={stats.total} byStatus={stats.byStatus} sums={stats.sums} />}

      <FeatureTable
        featureId={featureId} feature={feature} columns={columns} rows={filteredRows} rowAction={presentation.rowAction}
        isLoading={isLoading}
        onView={(row) => { setSelectedRow(row); setRecordMode(presentation.rowAction === "编辑" && presentation.variant !== "workflow" ? "edit" : "view"); }}
        onResubmit={presentation.variant === "workflow" ? resubmitRecord : undefined}
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
