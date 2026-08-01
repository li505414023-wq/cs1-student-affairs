import { describe, expect, it } from "vitest";
import { canManageStudents, isAdminGroupVisible, isFeatureVisible, isShellFeature, systemsForRole } from "@/app/menu-policy";

describe("menu policy", () => {
  it("restricts visible systems by role", () => {
    expect(systemsForRole("student")).toEqual(["student"]);
    expect(systemsForRole("counselor")).toEqual(["student", "admin"]);
    expect(systemsForRole("dorm_manager")).toContain("dorm");
    expect(systemsForRole("admin")).toContain("welcome");
    expect(systemsForRole("unknown-role")).toEqual(["student"]);
  });

  it("restricts admin system groups for non-admin roles", () => {
    expect(isAdminGroupVisible("workflow", "counselor")).toBe(true);
    expect(isAdminGroupVisible("system-admin", "counselor")).toBe(false);
    expect(isAdminGroupVisible("permission", "counselor")).toBe(false);
    expect(isAdminGroupVisible("system-admin", "admin")).toBe(true);
    expect(isAdminGroupVisible("faculty-admin", "department_admin")).toBe(true);
    expect(isAdminGroupVisible("faculty-admin", "staff")).toBe(false);
  });

  it("limits students to whitelisted features only", () => {
    expect(isFeatureVisible("student-home", "student")).toBe(true);
    expect(isFeatureVisible("leave", "student")).toBe(true);
    expect(isFeatureVisible("student-card", "student")).toBe(true);
    expect(isFeatureVisible("scholarship-batch", "student")).toBe(false);
    expect(isFeatureVisible("user-admin", "student")).toBe(false);
    expect(isFeatureVisible("scholarship-batch", "counselor")).toBe(true);
  });

  it("hides student management actions from read-only roles", () => {
    expect(canManageStudents("admin")).toBe(true);
    expect(canManageStudents("counselor")).toBe(true);
    expect(canManageStudents("student")).toBe(false);
    expect(canManageStudents("viewer")).toBe(false);
  });

  it("no shelved features remain after batches 1-4", () => {
    for (const featureId of ["role-admin", "data-permission", "api-permission", "user-admin",
      "system-dict", "faculty-admin", "ops-schedule", "team-building", "headteacher-query",
      "api-log", "error-log", "usual-log", "leave"]) {
      expect(isShellFeature(featureId), featureId).toBe(false);
    }
  });
});
