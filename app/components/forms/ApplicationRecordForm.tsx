"use client";

import { FormSection } from "./FormSection";
import type { FieldSpec } from "./FormField";

type CurrentUser = { id: string; displayName: string; role: string } | null;
type FormField = { id: string; type: string; label: string; required: boolean };

export function ApplicationRecordForm({ featureId, feature, currentUser, formFields }: {
  featureId: string; feature: string;
  currentUser?: CurrentUser;
  formFields?: FormField[];
}) {
  const displayName = currentUser?.displayName ?? "当前用户";
  const userId = currentUser?.id ?? "";

  const domainFields: Record<string, FieldSpec[]> = {
    leave: [{ label: "姓名", required: true }, { label: "学号", required: true }, { label: "请假类型", required: true, type: "select", options: ["事假", "病假", "公假", "其他"] }, { label: "开始时间", required: true, type: "date" }, { label: "结束时间", required: true, type: "date" }, { label: "请假天数", required: true, type: "number" }, { label: "请假原因", required: true, type: "textarea" }],
    discipline: [{ label: "违纪类型", required: true, type: "select", options: ["校纪校规", "考试纪律", "宿舍纪律"] }, { label: "违纪时间", required: true, type: "date" }, { label: "违纪地点", required: true }, { label: "违纪事实", required: true, type: "textarea" }],
    "club-apply": [{ label: "社团名称", required: true }, { label: "社团类别", required: true, type: "select", options: ["学术科技", "文化体育", "公益实践"] }, { label: "指导教师", required: true }, { label: "社团简介", required: true, type: "textarea" }],
    "student-card": [{ label: "申办类型", required: true, type: "select", options: ["遗失补办", "损坏换发"] }, { label: "申请原因", required: true, type: "textarea" }],
  };

  // Use FormDesigner fields when available, otherwise fall back to hardcoded domain fields
  let fields: FieldSpec[];
  if (formFields && formFields.length > 0) {
    // Map FormDesigner field types to FieldSpec
    const typeMap: Record<string, FieldSpec["type"]> = {
      "单行文本": "text", "多行文本": "textarea", "下拉选择": "select",
      "日期": "date", "金额": "number", "附件": "text",
    };
    fields = formFields.map((f) => ({
      label: f.label,
      required: f.required,
      type: typeMap[f.type] ?? "text",
    }));
  } else {
    fields = domainFields[featureId] ?? [
      { label: "申请类型", required: true, type: "select", options: ["个人申请", "集体申请"] },
      { label: "申请陈述", required: true, type: "textarea" },
    ];
  }

  return (
    <>
      <FormSection title="申请人信息" fields={[{ label: "申请人", value: displayName }, { label: "用户ID", value: userId }]} />
      <FormSection title={`${feature}申请信息`} fields={fields} />
      <FormSection title="附件材料" fields={[{ label: "附件材料", placeholder: "选择或拖入证明材料" }, { label: "补充说明", type: "textarea" }]} />
    </>
  );
}
