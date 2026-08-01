import { describe, expect, it } from "vitest";
import { BUILTIN_ROLES, getAvailableRoles, getRoleCodes } from "@/lib/role-catalog";

describe("role catalog", () => {
  it("provides roles with unique codes (DB-backed, with builtin fallback)", async () => {
    const roles = await getAvailableRoles();
    expect(roles.length).toBeGreaterThanOrEqual(7);
    const codes = await getRoleCodes();
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of ["admin", "department_admin", "counselor", "dorm_manager", "staff", "viewer", "student"]) {
      expect(codes).toContain(code);
    }
  });

  it("keeps the static builtin catalog intact", () => {
    expect(BUILTIN_ROLES).toHaveLength(7);
  });

  it("every builtin role has a label and description", () => {
    for (const role of BUILTIN_ROLES) {
      expect(role.label.length).toBeGreaterThan(0);
      expect(role.description.length).toBeGreaterThan(0);
    }
  });
});
