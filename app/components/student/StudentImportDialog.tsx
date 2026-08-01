"use client";

import { useState, useRef } from "react";
import { parseCsv, validateStudentRows, createStudentTemplateCsv } from "@/app/student-import.js";
import type { ImportError, ImportedRecord, StudentRecord } from "./student-types";

export function StudentImportDialog({ onClose, onImported }: { onClose: () => void; onImported: (rows: StudentRecord[]) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [validRows, setValidRows] = useState<ImportedRecord[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const readFile = async (file: File) => {
    setFileName(file.name);
    setValidRows([]);
    setErrors([]);
    setCompletedCount(0);
    if (file.size > 10 * 1024 * 1024) {
      setErrors([{ row: 0, message: "文件不能超过 10MB" }]);
      return;
    }
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setErrors([{ row: 0, message: "仅支持 .xlsx 或 .csv 文件" }]);
      return;
    }

    setIsReading(true);
    try {
      let rows: Array<Array<string | number | boolean | Date | null>>;
      if (/\.csv$/i.test(file.name)) {
        rows = parseCsv(await file.text());
      } else {
        const { default: readXlsxFile } = await import("read-excel-file/browser");
        rows = await readXlsxFile(file) as unknown as Array<Array<string | number | boolean | Date | null>>;
      }
      if (rows.length > 5001) {
        setErrors([{ row: 0, message: "单次最多导入 5000 名学生，请拆分文件" }]);
        return;
      }
      const normalizedRows = rows.map((row) => row.map((cell) => cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell ?? "").trim()));
      const result = validateStudentRows(normalizedRows) as { validRows: ImportedRecord[]; errors: ImportError[] };
      setValidRows(result.validRows);
      setErrors(result.errors);
    } catch {
      setErrors([{ row: 0, message: "文件读取失败，请确认文件未加密且格式正确" }]);
    } finally {
      setIsReading(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([createStudentTemplateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "学生批量导入模板.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const confirmImport = () => {
    if (validRows.length === 0 || errors.length > 0) return;
    const imported = validRows.map((record) => ({
      name: record["姓名"], no: record["学号"], phone: record["移动电话"], gender: record["性别"],
      faculty: record["院系名称"], major: record["专业名称"], className: record["班级名称"], grade: record["入学年级"],
      birthDate: record["出生日期"], address: "待完善",
    }));
    onImported(imported);
    setCompletedCount(imported.length);
  };

  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}><section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={(event) => event.stopPropagation()}><header><h2 id="import-title">学生数据导入</h2><button onClick={onClose} aria-label="关闭">×</button></header><div className="import-body"><div className="import-notes"><strong>注：</strong><ol><li>学生导入大约耗时3-5分钟，请耐心等待！</li><li>导入时间建议在无人使用时进行导入！</li><li>导入时请勿执行其他操作！</li></ol></div><div className="import-actions"><button className="template-button" onClick={downloadTemplate}>模板下载 ↓</button><button className="import" onClick={() => fileInput.current?.click()}>数据导入 ⇧</button><input ref={fileInput} className="file-input" type="file" accept=".xlsx,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); event.target.value = ""; }} /></div><div className={`drop-zone ${isDragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); const file = event.dataTransfer.files[0]; if (file) void readFile(file); }}><span>⇧</span><strong>{isReading ? "正在读取并校验…" : "拖入学生 Excel/CSV 文件"}</strong><small>支持 .xlsx、.csv，最大 10MB，单次最多 5000 行</small>{fileName && <em>{fileName}</em>}</div>{completedCount > 0 && <div className="import-success">✓ 已成功导入 {completedCount} 名学生，本地列表已更新。</div>}{validRows.length > 0 && <div className="import-summary"><span>有效数据 <strong>{validRows.length}</strong> 行</span><span>异常数据 <strong className={errors.length ? "danger" : ""}>{errors.length}</strong> 条</span></div>}<section className="preview-table"><h3>数据预览</h3><div className="table-scroll"><table><thead><tr><th>学号</th><th>姓名</th><th>性别</th><th>院系名称</th><th>专业名称</th><th>班级名称</th><th>入学年级</th></tr></thead><tbody>{validRows.slice(0, 5).map((record) => <tr key={record["学号"]}><td>{record["学号"]}</td><td>{record["姓名"]}</td><td>{record["性别"]}</td><td>{record["院系名称"]}</td><td>{record["专业名称"]}</td><td>{record["班级名称"]}</td><td>{record["入学年级"]}</td></tr>)}</tbody></table></div>{validRows.length === 0 && <p>暂无数据</p>}</section><section className="error-log"><h3>错误日志</h3><div className="table-scroll"><table><thead><tr><th>异常行</th><th>异常信息</th></tr></thead><tbody>{errors.map((error, index) => <tr key={`${error.row}-${index}`}><td>{error.row || "文件"}</td><td>{error.message}</td></tr>)}</tbody></table></div>{errors.length === 0 && <p>暂无数据</p>}</section></div><footer><button className="ghost" onClick={onClose}>取消</button><button className="primary" disabled={validRows.length === 0 || errors.length > 0 || completedCount > 0} onClick={confirmImport}>确认导入 {validRows.length > 0 && `(${validRows.length})`}</button></footer></section></div>;
}
