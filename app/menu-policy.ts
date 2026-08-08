import type { SystemId } from "./system-data";
import { dormFeatureGroups, featureGroups, policeFeatureGroups, welcomeFeatureGroups } from "./system-data";
import { DOMAIN_TABS } from "./domain-tabs";
import { STUDENT_APPLY_FEATURES, STUDENT_READ_ONLY_FEATURES } from "../lib/feature-policy";

/**
 * Role-based navigation policy: which systems, sidebar groups, and features
 * each role can see. Hiding entries a role cannot use prevents the "100 menus,
 * everything 403s" experience (especially for students).
 */

const SYSTEMS_BY_ROLE: Record<string, SystemId[]> = {
  admin: ["student", "welcome", "dorm", "police", "admin"],
  department_admin: ["student", "police", "admin"],
  counselor: ["student", "police", "admin"],
  staff: ["student", "police", "admin"],
  dorm_manager: ["student", "dorm", "admin"],
  viewer: ["student", "police", "admin"],
  student: ["student"],
};

export function systemsForRole(role: string): SystemId[] {
  return SYSTEMS_BY_ROLE[role] ?? ["student"];
}

const ADMIN_GROUPS_BY_ROLE: Record<string, Set<string>> = {
  department_admin: new Set(["workflow", "faculty-admin"]),
  counselor: new Set(["workflow"]),
  staff: new Set(["workflow"]),
  dorm_manager: new Set(["workflow"]),
  viewer: new Set(["workflow"]),
};

/** Groups visible inside the admin (后台管理) system for non-admin roles. */
export function isAdminGroupVisible(groupId: string, role: string): boolean {
  if (role === "admin") return true;
  const allowed = ADMIN_GROUPS_BY_ROLE[role];
  return allowed ? allowed.has(groupId) : false;
}

/**
 * Features a student may see inside the student affairs system.
 * Derived from lib/feature-policy (the single source of truth shared with the
 * records API): writable apply features + read-only browse features. Never
 * hardcode a second list here — a visible menu whose backend rejects writes
 * reproduces the "menu shows but submit 403s" bug.
 */
export const STUDENT_VISIBLE_FEATURES: ReadonlySet<string> = new Set([
  ...STUDENT_APPLY_FEATURES,
  ...STUDENT_READ_ONLY_FEATURES,
]);

export function isFeatureVisible(featureId: string, role: string): boolean {
  if (role !== "student") return true;
  return STUDENT_VISIBLE_FEATURES.has(featureId);
}

/**
 * 业务系统(学工/迎新/宿舍/警务)中 config/batch 阶段属于管理配置，只对 admin 显示。
 * 辅导员/宿管等执行角色的日常是审批与登记，不应面对成片的"种类/批次设置"。
 * 后台(admin)系统不受此限，由其分组级 isAdminGroupVisible 管控。
 */
export function isStageVisible(role: string, stage?: string): boolean {
  if (role === "admin") return true;
  return stage !== "config" && stage !== "batch";
}

/** 业务系统 featureId → 阶段（含域 Tab 子功能）；后台管理系统不在此列。 */
const FEATURE_STAGE: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const groups of [featureGroups, welcomeFeatureGroups, dormFeatureGroups, policeFeatureGroups]) {
    for (const group of groups) {
      for (const child of group.children) {
        for (const feature of child.features) {
          if (feature.stage) map.set(feature.id, feature.stage);
        }
      }
    }
  }
  for (const tabs of Object.values(DOMAIN_TABS)) {
    for (const tab of tabs) {
      if (tab.stage) map.set(tab.featureId, tab.stage);
    }
  }
  return map;
})();

/**
 * isStageVisible 的服务端闸门：菜单隐藏只是表现层，业务系统的 config/batch
 * 数据写入（新建/修改/删除/批量导入）必须在这里同样拦截，仅 admin 可维护。
 */
export function canWriteFeatureStage(featureId: string, role: string): boolean {
  const stage = FEATURE_STAGE.get(featureId);
  if (stage !== "config" && stage !== "batch") return true;
  return role === "admin";
}

/** Roles that may create/edit data through the student management UI. */
export function canManageStudents(role: string): boolean {
  return role !== "student" && role !== "viewer";
}
