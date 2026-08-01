import { describe, expect, it } from "vitest";
import { canAccessInstance, canOperateTask, isFullAccessRole, userIdentities } from "@/lib/workflow/access";

const admin = { id: "u-admin", role: "admin", roleTags: ["管理员"] };
const counselor = { id: "u-counselor", role: "counselor", roleTags: ["辅导员"] };
const student = { id: "u-student", role: "student", roleTags: ["学生"] };
const other = { id: "u-other", role: "staff", roleTags: ["工作人员"] };

describe("workflow access control", () => {
  describe("isFullAccessRole", () => {
    it("treats admin and department_admin as school-wide roles", () => {
      expect(isFullAccessRole("admin")).toBe(true);
      expect(isFullAccessRole("department_admin")).toBe(true);
      expect(isFullAccessRole("counselor")).toBe(false);
      expect(isFullAccessRole("student")).toBe(false);
    });
  });

  describe("canAccessInstance", () => {
    const instance = { startedBy: "u-student" };
    const tasks = [{ assigneeValue: "辅导员", claimedBy: null }];

    it("lets the starter view their own instance", () => {
      expect(canAccessInstance(instance, tasks, student)).toBe(true);
    });

    it("lets a matching assignee role view the instance", () => {
      expect(canAccessInstance(instance, tasks, counselor)).toBe(true);
    });

    it("denies unrelated users", () => {
      expect(canAccessInstance(instance, tasks, other)).toBe(false);
      expect(canAccessInstance({ startedBy: "someone-else" }, [], student)).toBe(false);
    });

    it("lets school-wide roles view any instance", () => {
      expect(canAccessInstance({ startedBy: "someone-else" }, [], admin)).toBe(true);
    });

    it("lets the claimer view the instance", () => {
      const claimed = [{ assigneeValue: "辅导员", claimedBy: "u-other" }];
      expect(canAccessInstance({ startedBy: "x" }, claimed, other)).toBe(true);
    });
  });

  describe("canOperateTask", () => {
    it("allows the assignee matched by role tag", () => {
      expect(canOperateTask({ assigneeValue: "辅导员", claimedBy: null }, counselor)).toBe(true);
    });

    it("denies users whose identities do not match the assignee", () => {
      expect(canOperateTask({ assigneeValue: "辅导员", claimedBy: null }, student)).toBe(false);
    });

    it("allows the claimer regardless of assignee value", () => {
      expect(canOperateTask({ assigneeValue: "辅导员", claimedBy: "u-other" }, other)).toBe(true);
    });

    it("allows admin to operate any task", () => {
      expect(canOperateTask({ assigneeValue: "辅导员", claimedBy: null }, admin)).toBe(true);
    });
  });

  describe("userIdentities", () => {
    it("collects id, role and role tags, tolerating null tags", () => {
      expect(userIdentities({ id: "a", role: "counselor", roleTags: null })).toEqual(new Set(["a", "counselor"]));
      expect(userIdentities(counselor)).toEqual(new Set(["u-counselor", "counselor", "辅导员"]));
    });
  });
});
