"use client";

import { FormSection } from "./FormSection";
import type { FieldSpec } from "./FormField";

export function BatchRecordForm({ featureId, feature }: { featureId: string; feature: string }) {
  const allocationFields: FieldSpec[] = featureId === "dorm-batch" ? [{ label: "适用性别", type: "select", options: ["男", "女"] }, { label: "适用院系", type: "select", options: ["全部院系", "信息工程学院", "商学院"] }, { label: "可分配楼栋", type: "select", options: ["全部楼栋", "海棠1号楼", "梧桐3号楼"] }, { label: "排宿方式", type: "select", options: ["按班级集中", "按学院集中", "随机分配"] }] : [{ label: "适用院系", type: "select", options: ["全部院系", "信息工程学院", "商学院"] }, { label: "院系名额", type: "number" }];
  return <><FormSection title={`${feature}基本信息`} fields={[{ label: "批次名称", required: true }, { label: "学年", required: true, type: "select", options: ["2026-2027", "2025-2026"] }, { label: "申请开始时间", required: true, type: "date" }, { label: "申请结束时间", required: true, type: "date" }, { label: featureId === "dorm-batch" ? "计划人数" : "总名额", required: true, type: "number" }, { label: "发布状态", type: "select", options: ["草稿", "已发布", "已结束"] }, { label: "批次说明", type: "textarea" }]} /><FormSection title={featureId === "dorm-batch" ? "排宿范围与规则" : "院系名额分配"} fields={allocationFields} /></>;
}
