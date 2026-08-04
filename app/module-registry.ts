"use client";

import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { isEntityFeature } from "@/lib/entity-features";
import { isWorkflowDesignFeature } from "./WorkflowDesignModule";
import { isWorkflowTaskFeature } from "./components/workflow/WorkflowTaskModule";
import { isShellFeature } from "./menu-policy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;

// Lazy-loaded module components (code splitting)
const LazyEntityModule = lazy(() => import("./components/admin/EntityModule").then((m) => ({ default: m.EntityModule })));
const LazyUserAdminModule = lazy(() => import("./components/admin/UserAdminModule").then((m) => ({ default: m.UserAdminModule })));
const LazyRoleAdminModule = lazy(() => import("./components/admin/RoleAdminModule").then((m) => ({ default: m.RoleAdminModule })));
const LazyDataPermissionModule = lazy(() => import("./components/admin/DataPermissionModule").then((m) => ({ default: m.DataPermissionModule })));
const LazyApiPermissionModule = lazy(() => import("./components/admin/ApiPermissionModule").then((m) => ({ default: m.ApiPermissionModule })));
const LazyTeamBuildingModule = lazy(() => import("./components/admin/TeamBuildingModule").then((m) => ({ default: m.TeamBuildingModule })));
const LazyHeadteacherQueryModule = lazy(() => import("./components/admin/HeadteacherQueryModule").then((m) => ({ default: m.HeadteacherQueryModule })));
const LazyOpsScheduleModule = lazy(() => import("./components/admin/OpsScheduleModule").then((m) => ({ default: m.OpsScheduleModule })));
const LazySystemLogModule = lazy(() => import("./components/admin/SystemLogModule").then((m) => ({ default: m.SystemLogModule })));
const LazyAuditLogModule = lazy(() => import("./components/admin/AuditLogModule").then((m) => ({ default: m.AuditLogModule })));
const LazyGenericModule = lazy(() => import("./components/generic/GenericModule").then((m) => ({ default: m.GenericModule })));
const LazyComprehensiveEvalModule = lazy(() => import("./components/police/ComprehensiveEvalModule").then((m) => ({ default: m.ComprehensiveEvalModule })));

/** Module category determines which props the Workspace should pass. */
export type ModuleCategory = "entity" | "admin-csrf" | "admin-plain" | "log" | "generic" | "shell";

interface RegistryEntry {
  component: LazyExoticComponent<AnyComponent>;
  category: ModuleCategory;
  /** Override label for log modules */
  logLabel?: string;
}

const registry = new Map<string, RegistryEntry>();

function register(featureId: string, component: LazyExoticComponent<AnyComponent>, category: ModuleCategory, logLabel?: string) {
  registry.set(featureId, { component, category, logLabel });
}

// Admin modules requiring csrfToken
register("user-admin", LazyUserAdminModule, "admin-csrf");
register("role-admin", LazyRoleAdminModule, "admin-csrf");
register("data-permission", LazyDataPermissionModule, "admin-csrf");
register("ops-schedule", LazyOpsScheduleModule, "admin-csrf");

// Admin modules with no props
register("api-permission", LazyApiPermissionModule, "admin-plain");
register("team-building", LazyTeamBuildingModule, "admin-plain");
register("headteacher-query", LazyHeadteacherQueryModule, "admin-plain");

// 警务化管理:综合素质考核(实时聚合模块,无需 csrf)
register("comprehensive-eval", LazyComprehensiveEvalModule, "admin-plain");

// Log modules
register("usual-log", LazyAuditLogModule, "log", "通用日志");
register("api-log", LazyAuditLogModule, "log", "接口日志(API 操作审计)");
register("error-log", LazySystemLogModule, "log", "错误日志");

export interface ResolvedModule {
  component: LazyExoticComponent<AnyComponent>;
  category: ModuleCategory;
  logLabel?: string;
}

/**
 * Resolve a featureId to its module. Priority:
 * 1. Exact registry match
 * 2. Entity features (17 engine-backed CRUD modules)
 * 3. Shell features (placeholder)
 * 4. GenericModule fallback
 */
export function resolveModule(featureId: string): ResolvedModule {
  // Exact match in registry
  const entry = registry.get(featureId);
  if (entry) return entry;

  // Entity features
  if (isEntityFeature(featureId)) {
    return { component: LazyEntityModule, category: "entity" };
  }

  // Shell features (not yet implemented)
  if (isShellFeature(featureId)) {
    return { component: LazyGenericModule, category: "shell" };
  }

  // Fallback: GenericModule handles all record-based features
  return { component: LazyGenericModule, category: "generic" };
}

/** Check if a feature is handled by the special (non-registry) rendering path. */
export function isSpecialFeature(featureId: string, activeSystem: string): boolean {
  if (featureId === "student-home") return true;
  if (activeSystem === "student" && featureId === "students") return true;
  if (activeSystem === "admin" && isWorkflowDesignFeature(featureId)) return true;
  if (isWorkflowTaskFeature(featureId)) return true;
  return false;
}
