"use client";

import { createCsv } from "@/app/interaction-utils.js";

export function downloadCsv(fileName: string, columns: string[], rows: string[][]) {
  const blob = new Blob([createCsv(columns, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
