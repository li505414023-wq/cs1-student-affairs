"use client";

import { useEffect, useState } from "react";
import { SearchIcon } from "@/app/components/shared/SearchIcon";
import { downloadCsv } from "@/app/components/shared/download-csv";
import { ColumnSettingsDialog } from "@/app/components/generic/ColumnSettingsDialog";
import { canManageStudents } from "@/app/menu-policy";
import { StudentImportDialog } from "./StudentImportDialog";
import { studentColumns, studentCell, type StudentQuery, type StudentRecord } from "./student-types";

type FilterDraft = { keyword: string; faculty: string; major: string; className: string; grade: string };
const emptyDraft: FilterDraft = { keyword: "", faculty: "", major: "", className: "", grade: "" };

const filterSpecs: Array<{ key: keyof FilterDraft; label: string; placeholder: string }> = [
  { key: "keyword", label: "关键词", placeholder: "姓名 / 学号 / 手机号" },
  { key: "faculty", label: "院系名称", placeholder: "请输入院系名称" },
  { key: "major", label: "专业名称", placeholder: "请输入专业名称" },
  { key: "className", label: "班级名称", placeholder: "请输入班级名称" },
  { key: "grade", label: "年级", placeholder: "请选择年级" },
];

/** Visible page buttons around the current page (keeps the pager compact). */
function pageWindow(current: number, totalPages: number, width = 5): number[] {
  const half = Math.floor(width / 2);
  let start = Math.max(1, current - half);
  const end = Math.min(totalPages, start + width - 1);
  start = Math.max(1, end - width + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function StudentPage({ rows, total, query, onQueryChange, role, onAdd, onOpenRecord, onImported }: {
  rows: StudentRecord[]; total: number; query: StudentQuery;
  onQueryChange: (query: StudentQuery) => void; role: string;
  onAdd: () => void; onOpenRecord: (mode: "view" | "edit", student: StudentRecord) => void;
  onImported: (rows: StudentRecord[]) => void;
}) {
  const [showImport, setShowImport] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(studentColumns);
  const [draft, setDraft] = useState<FilterDraft>({
    keyword: query.keyword, faculty: query.faculty, major: query.major, className: query.className, grade: query.grade,
  });
  const [notice, setNotice] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  useEffect(() => {
    // 移动端默认收起筛选，桌面端保持展开（effect 在水合后运行，避免 SSR 不一致）。
    if (window.matchMedia("(max-width: 680px)").matches) setFiltersOpen(false);
  }, []);
  const manageable = canManageStudents(role);
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const safePage = Math.min(query.page, totalPages);
  const gotoPage = (page: number) => onQueryChange({ ...query, page: Math.min(totalPages, Math.max(1, page)) });
  const submitSearch = () => { onQueryChange({ ...query, ...draft, page: 1 }); setNotice("筛选条件已应用"); };
  const resetSearch = () => { setDraft(emptyDraft); onQueryChange({ ...query, ...emptyDraft, page: 1 }); setNotice("筛选条件已清空"); };
  const activeFilterCount = [query.keyword, query.faculty, query.major, query.className, query.grade].filter((value) => value.trim() !== "").length;
  const exportRows = () => {
    downloadCsv("学生列表(当前页).csv", visibleColumns, rows.map((student) => visibleColumns.map((column) => studentCell(student, column))));
    setNotice(`已导出当前页 ${rows.length} 条学生记录`);
  };
  return (
    <>
      {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
      <div className="filter-toggle-row">
        <button className="ghost" type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
          {filtersOpen ? "收起筛选" : `展开筛选${activeFilterCount > 0 ? `（${activeFilterCount} 个条件）` : ""}`}
        </button>
      </div>
      {filtersOpen && (
      <form className="filter-card student-filter-card" onSubmit={(event) => { event.preventDefault(); submitSearch(); }}>
        {filterSpecs.map((field) => <label key={field.key}><span>{field.label}</span>{field.key === "grade" ? <select value={draft.grade} onChange={(event) => setDraft((current) => ({ ...current, grade: event.target.value }))}><option value="">{field.placeholder}</option><option>2026</option><option>2025</option><option>2024</option></select> : <input value={draft[field.key]} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} />}</label>)}
        <div className="student-filter-actions"><button className="primary" type="submit"><SearchIcon /> 搜索</button><button className="ghost" type="button" onClick={resetSearch}>清空</button></div>
      </form>
      )}
      <section className="table-card">
        <div className="table-toolbar"><div>{manageable && <><button className="primary" onClick={onAdd}>＋ 添加学生</button><button className="import" onClick={() => setShowImport(true)}>⇧ 批量导入</button></>}</div><div className="round-actions"><button aria-label="下载当前页" title="导出 CSV" onClick={exportRows}>↓</button><button aria-label="刷新" title="刷新" onClick={() => { onQueryChange({ ...query }); setNotice("学生列表已刷新"); }}>↻</button><button aria-label="表格设置" title="列设置" onClick={() => setShowColumns(true)}>⚙</button></div></div>
        <div className="table-scroll"><table className="student-table"><thead><tr>{visibleColumns.map((column) => <th key={column}>{column}</th>)}<th className="operation-column">操作</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={visibleColumns.length + 1} style={{ textAlign: "center", padding: 24 }}>没有符合条件的学生记录</td></tr>}
            {rows.map((student) => <tr key={student.no}>{visibleColumns.map((column) => <td key={column} data-label={column}>{column === "姓名" ? <strong>{studentCell(student, column)}</strong> : studentCell(student, column)}</td>)}<td className="operation-column" data-label="操作"><button className="link-button" onClick={() => onOpenRecord("view", student)}>查看</button>{manageable && <button className="link-button" onClick={() => onOpenRecord("edit", student)}>编辑</button>}</td></tr>)}
          </tbody></table></div>
        <footer className="pagination"><span>共 {total} 条记录</span><button disabled={safePage === 1} onClick={() => gotoPage(safePage - 1)}>‹</button>{pageWindow(safePage, totalPages).map((page) => <button key={page} className={safePage === page ? "active" : ""} aria-current={safePage === page ? "page" : undefined} onClick={() => gotoPage(page)}>{page}</button>)}{totalPages > 5 && safePage < totalPages - 2 && <span>…</span>}{totalPages > 5 && safePage < totalPages - 2 && <button onClick={() => gotoPage(totalPages)}>{totalPages}</button>}<button disabled={safePage === totalPages} onClick={() => gotoPage(safePage + 1)}>›</button></footer>
      </section>
      {showImport && <StudentImportDialog onClose={() => setShowImport(false)} onImported={onImported} />}
      {showColumns && <ColumnSettingsDialog columns={studentColumns} visibleColumns={visibleColumns} onChange={setVisibleColumns} onClose={() => setShowColumns(false)} />}
    </>
  );
}
