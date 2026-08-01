"use client";

export function ColumnSettingsDialog({ columns, visibleColumns, onChange, onClose }: { columns: string[]; visibleColumns: string[]; onChange: (columns: string[]) => void; onClose: () => void }) {
  const toggle = (column: string) => {
    if (visibleColumns.includes(column)) {
      if (visibleColumns.length === 1) return;
      onChange(visibleColumns.filter((item) => item !== column));
    } else {
      onChange(columns.filter((item) => item === column || visibleColumns.includes(item)));
    }
  };
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="columns-title" onMouseDown={(event) => event.stopPropagation()}><header><h2 id="columns-title">表格列设置</h2><button aria-label="关闭" onClick={onClose}>×</button></header><p>选择需要显示的字段，至少保留一列。</p><div className="column-options">{columns.map((column) => <label key={column}><input type="checkbox" checked={visibleColumns.includes(column)} onChange={() => toggle(column)} />{column}</label>)}</div><footer><button className="ghost" onClick={() => onChange(columns)}>恢复默认</button><button className="primary" onClick={onClose}>完成</button></footer></section></div>;
}
