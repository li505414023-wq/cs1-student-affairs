"use client";

import { useState } from "react";
import type { WorkflowForm, WorkflowField } from "./workflow-types";

const fieldTypes = ["单行文本", "多行文本", "下拉选择", "日期", "附件", "金额"];

export function FormDesigner({ form, onClose, onSave }: { form?: WorkflowForm; onClose: () => void; onSave: (form: WorkflowForm) => void }) {
  const [name, setName] = useState(form?.name ?? "");
  const [key, setKey] = useState(form?.key ?? "");
  const [type, setType] = useState(form?.type ?? "内置表单");
  const [fields, setFields] = useState<WorkflowField[]>(form?.fields ?? []);
  const addField = (fieldType: string) => setFields((current) => [...current, { id: `field-${Date.now()}-${current.length}`, type: fieldType, label: `${fieldType}${current.length + 1}`, required: false }]);
  return <div className="dialog-backdrop" role="presentation"><section className="form-designer" role="dialog" aria-modal="true" aria-labelledby="form-designer-title"><header><div><h2 id="form-designer-title">{form ? `设计表单：${form.name}` : "新建表单"}</h2><p>从左侧组件库添加字段，并在画布中配置字段属性。</p></div><button aria-label="关闭" onClick={onClose}>×</button></header><div className="form-designer-body"><aside><h3>字段组件库</h3>{fieldTypes.map((fieldType) => <button key={fieldType} onClick={() => addField(fieldType)}>＋ {fieldType}</button>)}</aside><section><div className="form-meta"><label><span>表单名称</span><input value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>表单编码</span><input value={key} onChange={(event) => setKey(event.target.value)} /></label><label><span>表单类型</span><select value={type} onChange={(event) => setType(event.target.value)}><option>内置表单</option><option>外置表单</option><option>节点独立表单</option></select></label></div><div className="field-canvas"><h3>表单画布 <span>{fields.length} 个字段</span></h3>{fields.length === 0 && <p>点击左侧字段组件开始设计</p>}{fields.map((field) => <article key={field.id}><span className="field-type">{field.type}</span><input aria-label={`${field.type}字段名称`} value={field.label} onChange={(event) => setFields((current) => current.map((item) => item.id === field.id ? { ...item, label: event.target.value } : item))} /><label><input type="checkbox" checked={field.required} onChange={(event) => setFields((current) => current.map((item) => item.id === field.id ? { ...item, required: event.target.checked } : item))} />必填</label><button aria-label={`删除${field.label}`} onClick={() => setFields((current) => current.filter((item) => item.id !== field.id))}>删除</button></article>)}</div></section></div><footer><button className="ghost" onClick={onClose}>取消</button><button className="primary" disabled={!name.trim() || !key.trim() || fields.length === 0} onClick={() => onSave({ id: form?.id ?? `form-${Date.now()}`, name: name.trim(), key: key.trim(), type, status: form?.status ?? "启用", fields })}>保存表单</button></footer></section></div>;
}
