"use client";

import { filterOptionsFor } from "@/app/feature-metadata";

export type FieldSpec = { label: string; required?: boolean; type?: "text" | "select" | "date" | "number" | "textarea" | "url"; placeholder?: string; options?: string[]; value?: string };

export function FormField({ field, readOnly = false, error }: { field: FieldSpec; readOnly?: boolean; error?: string }) {
  const label = <span>{field.required && <b className="required">*</b>}{field.label}</span>;
  const err = error ? <span className="field-error" role="alert">{error}</span> : null;
  const options = field.options ?? filterOptionsFor(field.label) ?? ["是", "否"];
  const selectableOptions = field.value && !options.includes(field.value) ? [field.value, ...options] : options;
  if (field.type === "textarea") return <label className="wide-field">{label}<textarea name={field.label} required={field.required} disabled={readOnly} defaultValue={field.value} placeholder={field.placeholder ?? `请输入${field.label}`} aria-invalid={!!error} />{err}</label>;
  if (field.type === "select") return <label>{label}<select name={field.label} required={field.required} disabled={readOnly} defaultValue={field.value ?? ""} aria-invalid={!!error}><option value="">请选择{field.label}</option>{selectableOptions.map((option) => <option key={option}>{option}</option>)}</select>{err}</label>;
  return <label>{label}<input name={field.label} required={field.required} disabled={readOnly} type={field.type ?? "text"} defaultValue={field.value} placeholder={field.placeholder ?? `请输入${field.label}`} aria-invalid={!!error} />{err}</label>;
}
