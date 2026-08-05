import { describe, expect, it } from "vitest";
import { canManageStudents, isAdminGroupVisible, isFeatureVisible, isShellFeature, systemsForRole, STUDENT_VISIBLE_FEATURES } from "@/app/menu-policy";
import { STUDENT_APPLY_FEATURES, STUDENT_READ_ONLY_FEATURES } from "@/lib/feature-policy";

describe("menu policy", () => {
  it("restricts visible systems by role", () => {
    expect(systemsForRole("student")).toEqual(["student"]);
    expect(systemsForRole("counselor")).toEqual(["student", "police", "admin"]);
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
    expect(isFeatureVisible("appeal", "student")).toBe(true);
    expect(isFeatureVisible("scholarship-batch", "student")).toBe(false);
    expect(isFeatureVisible("user-admin", "student")).toBe(false);
    expect(isFeatureVisible("scholarship-batch", "counselor")).toBe(true);
  });

  it("hides review-stage admin features from students (no 403-on-submit menus)", () => {
    // 投诉/困难补助/奖学金评定/返校(及助学金)是管理端 review 类功能，
    // 后端 STUDENT_APPLY_FEATURES 不允许学生提交，前端菜单必须同步收敛。
    for (const featureId of ["complaints", "hardship", "scholarship", "return-school", "grants"]) {
      expect(isFeatureVisible(featureId, "student"), featureId).toBe(false);
      expect(STUDENT_VISIBLE_FEATURES.has(featureId), featureId).toBe(false);
    }
  });

  it("cross-check: writable subset of visible features stays within the backend apply whitelist", () => {
    // 防漂移不变量：学生可见名单 = 可写申请名单 ∪ 只读名单，
    // 任何可见且可写（非只读）的 feature 必须在后端白名单内。
    for (const featureId of STUDENT_VISIBLE_FEATURES) {
      if (!STUDENT_READ_ONLY_FEATURES.has(featureId)) {
        expect(STUDENT_APPLY_FEATURES.has(featureId), featureId).toBe(true);
      }
    }
    // 反向：后端允许申请的 feature 一定对学生可见。
    for (const featureId of STUDENT_APPLY_FEATURES) {
      expect(STUDENT_VISIBLE_FEATURES.has(featureId), featureId).toBe(true);
    }
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
