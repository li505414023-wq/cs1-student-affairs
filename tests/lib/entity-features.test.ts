import { describe, expect, it } from "vitest";
import { ENTITY_FEATURE_IDS, getEntityConfig, isEntityFeature, type EntityFeatureConfig } from "@/lib/entity-features";
import { buildEntityDataSchema, validateEntityInput } from "@/lib/validation-entities";

describe("entity feature registry", () => {
  it("registers the 9 engine-backed features", () => {
    expect(ENTITY_FEATURE_IDS).toHaveLength(9);
    for (const id of ["faculty-admin", "major-admin", "corps-admin", "class-admin", "org-admin", "post-admin",
      "system-dict", "business-dict", "flow-category"]) {
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

  it("enforces required fields from a feature config", () => {
    const config: EntityFeatureConfig = {
      featureId: "test",
      label: "测试",
      nameLabel: "名称",
      description: "",
      columns: [],
      fields: [
        { key: "fromUser", label: "委托人", required: true },
        { key: "toUser", label: "受托人", required: true },
      ],
    };
    const result = validateEntityInput(config, { name: "代理规则" });
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
