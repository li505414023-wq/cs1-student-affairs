"use client";

import type React from "react";
import { FormField, type FieldSpec } from "./FormField";

export function FormSection({ title, fields, children, readOnly = false, errors }: { title: string; fields?: FieldSpec[]; children?: React.ReactNode; readOnly?: boolean; errors?: Record<string, string> }) {
  return <section className="form-section"><header><span className="section-icon">▣</span><h2>{title}</h2><span className="section-line" /></header>{fields && <div className="form-grid">{fields.map((field) => <FormField key={field.label} field={field} readOnly={readOnly} error={errors?.[field.label]} />)}</div>}{children}</section>;
}
