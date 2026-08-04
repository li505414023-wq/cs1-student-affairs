import type { SystemId } from "./system-data";

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

/** Features a student may see inside the student affairs system. */
const STUDENT_VISIBLE_FEATURES: ReadonlySet<string> = new Set([
  "student-home",
  "students",
  "leave",
  "student-card",
  "complaints",
  "hardship",
  "grants",
  "scholarship",
  "club-apply",
  "return-school",
  "appeal",
]);

export function isFeatureVisible(featureId: string, role: string): boolean {
  if (role !== "student") return true;
  return STUDENT_VISIBLE_FEATURES.has(featureId);
}

/** Roles that may create/edit data through the student management UI. */
export function canManageStudents(role: string): boolean {
  return role !== "student" && role !== "viewer";
}

/**
 * Features whose backend is not implemented yet. They render an honest
 * "暂未开放" placeholder instead of a broken/placeholder records UI.
 */
// All previously shelved features are now implemented (batches 1-4).
// The set is kept for future use; isShellFeature currently returns false for everything.
const SHELL_FEATURES: ReadonlySet<string> = new Set([]);

export function isShellFeature(featureId: string): boolean {
  return SHELL_FEATURES.has(featureId);
}
