"use client";

import { useEffect, useState } from "react";
import { FormSection } from "../forms/FormSection";
import type { FieldSpec } from "../forms/FormField";
import type { EntityFeatureConfig } from "@/lib/entity-features";
import { api, isNetworkError, type ApiClientError } from "@/lib/api-client";

export type EntityItem = {
  id?: string;
  code: string;
  name: string;
  description: string;
  parentCode: string;
  sortOrder: number;
  status: string;
  data: Record<string, unknown>;
};

type ParentOption = { code: string; name: string };

/**
 * Create/edit dialog for managed entities. Form inputs are named by field
 * label (FormField convention) and mapped back to stable registry keys here.
 */
export function EntityDialog({ config, item, csrfToken, onClose, onSaved }: {
  config: EntityFeatureConfig;
  item: EntityItem | null;
  csrfToken: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  void csrfToken; // CSRF 由 api-client 统一携带
  const [parentOptions, setParentOptions] = useState<ParentOption[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(item?.id);

  useEffect(() => {
    if (!config.hierarchical) return;
    let active = true;
    api.get<{ items: Array<{ id: string; code: string; name: string }> }>(`/api/admin/entities/${config.hierarchical.parentFeature}?pageSize=200&status=启用`)
      .then((data) => {
        if (!active) return;
        // Self-hierarchical features (dict/menu/org): exclude self to avoid self-parenting.
        setParentOptions(
          data.items
            .filter((entry) => entry.id !== item?.id)
            .map((entry) => ({ code: entry.code, name: entry.name })),
        );
      })
      .catch(() => {});
    return () => { active = false; };
  }, [config, item?.id]);

  const baseFields: FieldSpec[] = [
    { label: config.nameLabel, required: true, value: item?.name ?? "" },
    ...(config.hasCode ? [{ label: "编码", required: false, value: item?.code ?? "", placeholder: "留空则不设置编码" }] : []),
    ...(config.hierarchical ? [{
      label: config.hierarchical.parentLabel,
      type: "select" as const,
      options: parentOptions.map((option) => option.name),
      value: parentOptions.find((option) => option.code === (item?.parentCode ?? ""))?.name ?? "",
    }] : []),
  ];

  const registryFields: FieldSpec[] = config.fields.map((field) => ({
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.options,
    value: field.type === "number" ? String(item?.data[field.key] ?? "") : String(item?.data[field.key] ?? ""),
  }));

  const miscFields: FieldSpec[] = [
    { label: "排序", type: "number", value: String(item?.sortOrder ?? 0) },
    { label: "状态", type: "select", options: ["启用", "停用"], value: item?.status ?? "启用" },
    { label: "备注", type: "textarea", value: item?.description ?? "" },
  ];

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData(event.currentTarget);
      const get = (label: string) => String(fd.get(label) ?? "").trim();
      const parentLabel = config.hierarchical?.parentLabel;
      const parentName = parentLabel ? get(parentLabel) : "";
      const parentCode = parentOptions.find((option) => option.name === parentName)?.code ?? "";
      const payload = {
        name: get(config.nameLabel),
        code: config.hasCode ? get("编码") : "",
        parentCode,
        description: get("备注"),
        sortOrder: Number(get("排序")) || 0,
        status: get("状态") || "启用",
        data: Object.fromEntries(config.fields.map((field) => [field.key, get(field.label)])),
      };
      if (isEdit) {
        await api.put(`/api/admin/entities/${config.featureId}/${item?.id}`, payload);
      } else {
        await api.post(`/api/admin/entities/${config.featureId}`, payload);
      }
      onSaved(`${config.label}记录已${isEdit ? "更新" : "创建"}`);
    } catch (error) {
      if (isNetworkError(error)) {
        setNotice("网络异常,保存未完成");
      } else {
        const apiError = error as ApiClientError;
        const details = Array.isArray(apiError.details) ? (apiError.details as Array<{ field?: string; message?: string }>) : [];
        const detail = details.map((entry) => entry.message).join(";");
        setNotice(detail || apiError.message || "保存失败,请重试");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${isEdit ? "编辑" : "新增"}${config.label}`}
        onMouseDown={(event) => event.stopPropagation()}
        style={{ width: "min(640px, calc(100vw - 32px))", maxHeight: "88vh", overflowY: "auto", background: "var(--color-surface, #fff)", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,.18)" }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--color-border, #e5e7eb)" }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>{isEdit ? `编辑${config.label}` : `新增${config.label}`}</h2>
          <button aria-label="关闭" onClick={onClose}>×</button>
        </header>
        <form className="form-card" onSubmit={submit} style={{ border: "none", margin: 0 }}>
          {notice && <div className="action-notice" role="alert" style={{ position: "static" }}>{notice}</div>}
          <FormSection title="基础信息" fields={baseFields} />
          {registryFields.length > 0 && <FormSection title={`${config.label}信息`} fields={registryFields} />}
          <FormSection title="其他" fields={miscFields} />
          <div className="form-actions">
            <button className="primary" type="submit" disabled={busy}>{busy ? "保存中…" : "保存"}</button>
            <button className="ghost" type="button" onClick={onClose}>取消</button>
          </div>
        </form>
      </section>
    </div>
  );
}
