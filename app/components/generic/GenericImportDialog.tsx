"use client";

import { useState, useRef } from "react";
import { parseCsv } from "@/app/student-import.js";
import { downloadCsv } from "@/app/components/shared/download-csv";

export function GenericImportDialog({ feature, columns, onClose, onImported }: { feature: string; columns: string[]; onClose: () => void; onImported: (rows: Array<Record<string, string>>) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Array<Record<string, string>>>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isReading, setIsReading] = useState(false);
  const readFile = async (file: File) => {
    setFileName(file.name); setPreview([]); setErrors([]);
    if (file.size > 10 * 1024 * 1024) { setErrors(["文件不能超过 10MB"]); return; }
    if (!/\.(xlsx|csv)$/i.test(file.name)) { setErrors(["仅支持 .xlsx 或 .csv 文件"]); return; }
    setIsReading(true);
    try {
      let rows: Array<Array<string | number | boolean | Date | null>>;
      if (/\.csv$/i.test(file.name)) rows = parseCsv(await file.text());
      else { const { default: readXlsxFile } = await import("read-excel-file/browser"); rows = await readXlsxFile(file) as unknown as Array<Array<string | number | boolean | Date | null>>; }
      if (rows.length > 5001) { setErrors(["单次最多导入 5000 条记录，请拆分文件"]); return; }
      const normalized = rows.map((row) => row.map((cell) => cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell ?? "").trim()));
      const headers = normalized[0] ?? [];
      const missing = columns.filter((column) => !headers.includes(column));
      if (missing.length) { setErrors([`缺少模板列：${missing.join("、")}`]); return; }
      const records = normalized.slice(1).filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
      if (records.length === 0) { setErrors(["文件中没有可导入的数据"]); return; }
      setPreview(records);
    } catch { setErrors(["文件读取失败，请确认文件未加密且格式正确"]); }
    finally { setIsReading(false); }
  };
  const templateColumns = columns;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}><section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="generic-import-title" onMouseDown={(event) => event.stopPropagation()}><header><h2 id="generic-import-title">{feature}数据导入</h2><button aria-label="关闭" onClick={onClose}>×</button></header><div className="import-body"><div className="import-notes"><strong>注：</strong><ol><li>请先下载模板并保持表头名称不变。</li><li>确认导入后数据将写入数据库，请勿重复导入同一文件。</li><li>单次最多导入 5000 条记录。</li></ol></div><div className="import-actions"><button className="template-button" onClick={() => downloadCsv("通用数据导入模板.csv", templateColumns, [])}>模板下载 ↓</button><button className="import" onClick={() => fileInput.current?.click()}>选择文件 ⇧</button><input ref={fileInput} className="file-input" type="file" accept=".xlsx,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); event.target.value = ""; }} /></div><div className="drop-zone"><span>⇧</span><strong>{isReading ? "正在读取并校验…" : "选择 CSV/XLSX 数据文件"}</strong><small>最大 10MB，表头必须与模板一致</small>{fileName && <em>{fileName}</em>}</div>{preview.length > 0 && <div className="import-summary"><span>有效数据 <strong>{preview.length}</strong> 行</span><span>异常数据 <strong>0</strong> 条</span></div>}<section className="preview-table"><h3>导入预览</h3><div className="table-scroll"><table><thead><tr>{columns.slice(0, 6).map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{preview.slice(0, 5).map((record, index) => <tr key={index}>{columns.slice(0, 6).map((column) => <td key={column}>{record[column]}</td>)}</tr>)}</tbody></table></div>{preview.length === 0 && <p>暂无数据</p>}</section><section className="error-log"><h3>错误日志</h3>{errors.length ? <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul> : <p>暂无数据</p>}</section></div><footer><button className="ghost" onClick={onClose}>取消</button><button className="primary" disabled={preview.length === 0 || errors.length > 0} onClick={() => onImported(preview)}>确认导入 {preview.length > 0 && `(${preview.length})`}</button></footer></section></div>;
}
