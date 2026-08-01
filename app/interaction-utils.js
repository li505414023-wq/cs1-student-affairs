export function filterTableRows(rows, filters) {
  const activeFilters = Object.entries(filters)
    .map(([key, value]) => [key, String(value ?? "").trim().toLowerCase()])
    .filter(([, value]) => value && value !== "全部");

  if (activeFilters.length === 0) return [...rows];
  return rows.filter((row) => activeFilters.every(([key, value]) => {
    const cell = String(row[key] ?? "").toLowerCase();
    return cell.includes(value);
  }));
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createCsv(columns, rows) {
  return `\uFEFF${[columns, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}`;
}
