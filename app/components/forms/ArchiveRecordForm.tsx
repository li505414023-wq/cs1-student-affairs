"use client";

import { FormSection } from "./FormSection";

export function ArchiveRecordForm({ feature }: { feature: string }) {
  return <><FormSection title={`${feature}归档信息`} fields={[{ label: "学生姓名", value: "林晓晨" }, { label: "学号", value: "20260001" }, { label: "归档学年", value: "2026-2027" }, { label: "最终结果", value: "已完成" }, { label: "归档编号", value: "ARCH-2026-001" }, { label: "归档日期", type: "date", value: "2026-07-18" }]} /><FormSection title="结果说明" fields={[{ label: "结果摘要", type: "textarea", value: "该业务流程已全部完成，结果进入历史档案。" }]} /></>;
}
