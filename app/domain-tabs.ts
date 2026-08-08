/**
 * 业务域合并配置：把原先拆成多个菜单入口的同域功能收进一个域页面的页内 Tab。
 * 键是域入口的 featureId（system-data.ts 导航中保留的唯一入口），
 * 值是该域包含的子功能（各自仍是独立的 records featureId，数据隔离不变）。
 *
 * 注意：scripts/seed-full-test-data.mjs 的 domainSubFeatures 需与此处保持同步。
 */

export type DomainTab = { featureId: string; label: string; stage?: "config" | "batch" | "apply" | "review" | "archive" };

export const DOMAIN_TABS: Record<string, DomainTab[]> = {
  scholarship: [
    { featureId: "scholarship", label: "评定", stage: "review" },
    { featureId: "scholarship-type", label: "种类设置", stage: "config" },
    { featureId: "scholarship-batch", label: "批次", stage: "batch" },
    { featureId: "scholarship-mutex", label: "不可兼得", stage: "config" },
  ],
  grants: [
    { featureId: "grants", label: "评定", stage: "review" },
    { featureId: "grant-type", label: "种类设置", stage: "config" },
    { featureId: "grant-batch", label: "批次", stage: "batch" },
    { featureId: "grant-mutex", label: "不可兼得", stage: "config" },
  ],
  hardship: [
    { featureId: "hardship", label: "申请审核", stage: "review" },
    { featureId: "hardship-type", label: "种类设置", stage: "config" },
    { featureId: "hardship-batch", label: "批次", stage: "batch" },
  ],
  honor: [
    { featureId: "personal-honor", label: "个人荣誉", stage: "review" },
    { featureId: "collective-honor", label: "集体荣誉", stage: "review" },
    { featureId: "honor-type", label: "种类设置", stage: "config" },
    { featureId: "honor-batch", label: "批次", stage: "batch" },
  ],
  "dorm-checkin": [
    { featureId: "dorm-checkin", label: "入住", stage: "apply" },
    { featureId: "dorm-transfer", label: "调整宿舍", stage: "apply" },
    { featureId: "dorm-checkout", label: "退宿", stage: "apply" },
    { featureId: "holiday-dorm", label: "假期宿舍", stage: "apply" },
    { featureId: "delayed-checkout", label: "延缓退宿", stage: "apply" },
  ],
  "welcome-stats": [
    { featureId: "faculty-checkin-stats", label: "学院报到", stage: "archive" },
    { featureId: "class-checkin-stats", label: "班级报到", stage: "archive" },
    { featureId: "live-checkin-stats", label: "实时分析", stage: "archive" },
    { featureId: "supplies-stats", label: "生活用品", stage: "archive" },
    { featureId: "transport-stats", label: "乘车信息", stage: "archive" },
    { featureId: "payment-stats", label: "缴费信息", stage: "archive" },
    { featureId: "step-stats", label: "环节统计", stage: "archive" },
    { featureId: "nation-stats", label: "民族统计", stage: "archive" },
    { featureId: "welcome-dorm-stats", label: "宿舍统计", stage: "archive" },
  ],
};

export function isDomainFeature(featureId: string): boolean {
  return Object.prototype.hasOwnProperty.call(DOMAIN_TABS, featureId);
}
