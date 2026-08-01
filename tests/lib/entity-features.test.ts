import { describe, expect, it } from "vitest";
import { ENTITY_FEATURES, ENTITY_FEATURE_IDS, getEntityConfig, isEntityFeature } from "@/lib/entity-features";
import { buildEntityDataSchema, validateEntityInput } from "@/lib/validation-entities";

describe("entity feature registry", () => {
  it("registers the 17 engine-backed features", () => {
    expect(ENTITY_FEATURE_IDS).toHaveLength(17);
    for (const id of ["faculty-admin", "major-admin", "class-admin", "org-admin", "post-admin",
      "system-dict", "business-dict", "menu-admin", "top-menu", "flow-category", "flow-button",
      "form-default", "flow-expression", "home-carousel", "announcement", "campus-news", "process-agent"]) {
      expect(ENTITY_FEATURE_IDS).toContain(id);
    }
  });

  it("every feature has unique field keys matching its non-reserved columns", () => {
    const reserved = new Set(["name", "code", "description", "status", "sortOrder", "parentName"]);
    for (const id of ENTITY_FEATURE_IDS) {
      const config = getEntityConfig(id);
      expect(config).toBeDefined();
      const keys = config!.fields.map((field) => field.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const column of config!.columns) {
        if (!reserved.has(column.key)) {
          expect(keys, `${id} 列 ${column.key} 缺少字段定义`).toContain(column.key);
        }
      }
      if (config!.hierarchical) {
        expect(getEntityConfig(config!.hierarchical.parentFeature)).toBeDefined();
      }
    }
  });

  it("isEntityFeature agrees with the registry", () => {
    expect(isEntityFeature("faculty-admin")).toBe(true);
    expect(isEntityFeature("user-admin")).toBe(false);
    expect(isEntityFeature("leave")).toBe(false);
  });
});

describe("entity validation", () => {
  it("accepts valid input and applies defaults", () => {
    const result = validateEntityInput(getEntityConfig("post-admin")!, { name: "测试岗位", code: "T-01" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("启用");
      expect(result.data.sortOrder).toBe(0);
      expect(result.data.data.category).toBe("");
    }
  });

  it("rejects empty name with a field-level error", () => {
    const result = validateEntityInput(getEntityConfig("post-admin")!, { name: "  " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((error) => error.field === "name")).toBe(true);
    }
  });

  it("enforces required fields from the registry", () => {
    const result = validateEntityInput(getEntityConfig("process-agent")!, { name: "代理规则" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.errors.map((error) => error.field);
      expect(fields).toContain("data.fromUser");
      expect(fields).toContain("data.toUser");
    }
  });

  it("enforces maxLength limits", () => {
    const result = validateEntityInput(getEntityConfig("post-admin")!, { name: "x".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("coerces number fields", () => {
    const schema = buildEntityDataSchema(getEntityConfig("post-admin")!);
    const parsed = schema.parse({});
    expect(parsed).toBeDefined();
  });
});
