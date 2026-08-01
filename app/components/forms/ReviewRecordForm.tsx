"use client";

import { FormSection } from "./FormSection";
import type { FieldSpec } from "./FormField";

type CurrentUser = { id: string; displayName: string; role: string } | null;

export function ReviewRecordForm({ featureId, feature, currentUser }: { featureId: string; feature: string; currentUser?: CurrentUser }) {
  const displayName = currentUser?.displayName ?? "当前审核人";

  const detailFields: FieldSpec[] = featureId.includes("scholarship") || featureId.includes("grant") || featureId.includes("hardship")
    ? [{ label: "申请种类", value: feature }, { label: "申请等级", value: "待审核" }, { label: "申请陈述", type: "textarea", value: "" }]
    : [{ label: "业务类型", value: feature }, { label: "申请时间", value: new Date().toISOString().slice(0, 10) }, { label: "申请陈述", type: "textarea", value: "" }];

  return <>
    <FormSection title="申请人信息" fields={[
      { label: "申请人", value: displayName },
      { label: "角色", value: currentUser?.role ?? "" },
    ]} />
    <FormSection title={`${feature}申请详情`} fields={detailFields} />
    <FormSection title="审核处理" fields={[
      { label: "审核结论", required: true, type: "select", options: ["同意", "退回修改", "不同意"] },
      { label: "审核意见", required: true, type: "textarea" },
      { label: "下一审核人", type: "select", options: ["院系管理员", "学工处管理员"] },
    ]} />
    <div className="audit-trail"><strong>审核记录</strong><ol><li><span />{displayName} 正在处理审核 <small>{new Date().toLocaleString("zh-CN")}</small></li></ol></div>
  </>;
}
