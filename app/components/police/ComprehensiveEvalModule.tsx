"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { filterTableRows } from "@/app/interaction-utils.js";
import { getPresentation } from "@/app/feature-metadata";
import { downloadCsv } from "@/app/components/shared/download-csv";
import { FeatureTable } from "@/app/components/generic/FeatureTable";
import { ColumnSettingsDialog } from "@/app/components/generic/ColumnSettingsDialog";

type EvalRow = Record<string, string | number>;

/**
 * 综合素质考核(学生手册第四章):总分100 = 德育30 + 智育60 + 体育10。
 * 数据由 /api/comprehensive-eval 基于操行分、课程成绩、体测记录实时聚合,
 * 按年级×专业排名,并列出一票否决原因(操行<65 / 单科<60 / 体测不合格)。
 */
export function ComprehensiveEvalModule() {
  const presentation = getPresentation("comprehensive-eval", "archive");
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [term, setTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [filterDraft, setFilterDraft] = useState<Record<string, string>>({});
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [showColumns, setShowColumns] = useState(false);
  const [detail, setDetail] = useState<EvalRow | null>(null);
  const columns = visibleColumns.length ? visibleColumns : presentation.columns;

  const fetchData = useCallback(() => {
    setIsLoading(true);
    fetch("/api/comprehensive-eval", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) { setNotice("考核数据加载失败,请重试"); return; }
        const payload = await response.json() as { data: { items: EvalRow[]; term: string } };
        setRows(payload.data.items);
        setTerm(payload.data.term);
      })
      .catch(() => setNotice("网络连接异常,请检查后重试"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredRows = useMemo<EvalRow[]>(() => filterTableRows(rows, appliedFilters), [rows, appliedFilters]);
  const vetoCount = rows.filter((row) => String(row["考核结果"]).includes("一票否决")).length;

  return (
    <section className="module-card">
      {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
      <div className="module-hero">
        <span className="module-mark">评</span>
        <div>
          <h2>综合素质考核</h2>
          <p>{term ? `${term} · ` : ""}总分100 = 德育30(操行分×30%) + 智育60(课程均分×60%) + 体育10(体测两次×5分)。按年级×专业排名,操行分低于65、单科低于60或体测不合格者一票否决,不得评优。</p>
        </div>
      </div>

      <form className="module-filter" onSubmit={(event) => { event.preventDefault(); setAppliedFilters({ ...filterDraft }); }}>
        {presentation.filters.map((filter) => (
          <label key={filter}><span>{filter}</span>
            <input value={filterDraft[filter] ?? ""} onChange={(event) => setFilterDraft((current) => ({ ...current, [filter]: event.target.value }))} placeholder={`请输入${filter}`} />
          </label>
        ))}
        <button className="primary" type="submit">搜索</button>
        <button className="ghost" type="button" onClick={() => { setFilterDraft({}); setAppliedFilters({}); }}>清空</button>
      </form>

      <div className="stage-line">
        <div className="done"><span>人</span><p>考核人数 {rows.length}</p></div>
        <div className="done"><span>合</span><p>合格 {rows.length - vetoCount}</p></div>
        <div className={vetoCount > 0 ? "" : "done"}><span>否</span><p>一票否决 {vetoCount}</p></div>
      </div>

      <FeatureTable
        featureId="comprehensive-eval" feature="综合素质考核" columns={columns} rows={filteredRows}
        rowAction="详情" isLoading={isLoading}
        onView={(row) => setDetail(row)}
        onExport={() => downloadCsv("综合素质考核.csv", columns, filteredRows.map((row) => columns.map((column) => String(row[column] ?? ""))))}
        onRefresh={() => { fetchData(); setFilterDraft({}); setAppliedFilters({}); }}
        onColumns={() => setShowColumns(true)}
      />

      {detail && (
        <div className="full-form-page">
          <div className="form-page-head">
            <div><p className="eyebrow">综合素质考核 / 详情</p><h1>{String(detail["姓名"])}（{String(detail["学号"])}）</h1></div>
            <button className="ghost" onClick={() => setDetail(null)}>关闭</button>
          </div>
          <div className="form-card">
            <p className="form-section-title">{String(detail["年级"])}级 {String(detail["专业"])} · {String(detail["区队"])} · 专业排名 第{String(detail["排名"])}名</p>
            <div className="form-grid">
              <label><span>德育分(满分30)</span><input value={String(detail["德育分"])} readOnly /></label>
              <label><span>智育分(满分60)</span><input value={String(detail["智育分"])} readOnly /></label>
              <label><span>体育分(满分10)</span><input value={String(detail["体育分"])} readOnly /></label>
              <label><span>总分(满分100)</span><input value={String(detail["总分"])} readOnly /></label>
            </div>
            <p className="privacy-note">考核结果:{String(detail["考核结果"])}</p>
            <div className="form-actions"><button className="ghost" type="button" onClick={() => setDetail(null)}>关闭</button></div>
          </div>
        </div>
      )}

      {showColumns && <ColumnSettingsDialog columns={presentation.columns} visibleColumns={columns} onChange={setVisibleColumns} onClose={() => setShowColumns(false)} />}
    </section>
  );
}
