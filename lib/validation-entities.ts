import { z } from "zod";
import type { EntityFeatureConfig } from "./entity-features";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Array<{ field: string; message: string }> };

export type EntityInput = {
  code: string;
  name: string;
  description: string;
  parentCode: string;
  sortOrder: number;
  status: string;
  data: Record<string, unknown>;
};

/** Auto-build a zod schema for a feature's data fields from the registry specs. */
export function buildEntityDataSchema(config: EntityFeatureConfig): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of config.fields) {
    if (field.type === "number") {
      shape[field.key] = field.required
        ? z.coerce.number({ message: `${field.label}必须是数字` })
        : z.union([z.coerce.number(), z.literal("")]).optional();
      continue;
    }
    let schema: z.ZodString = z.string().trim();
    if (field.required) schema = schema.min(1, `${field.label}不能为空`);
    if (field.maxLength) schema = schema.max(field.maxLength, `${field.label}不能超过 ${field.maxLength} 个字符`);
    shape[field.key] = field.required ? schema : schema.optional().default("");
  }
  return z.object(shape);
}

export function buildEntityEnvelopeSchema(config: EntityFeatureConfig) {
  return z.object({
    code: z.string().trim().max(60, "编码不能超过 60 个字符").optional().default(""),
    name: z.string().trim().min(1, `${config.nameLabel}不能为空`).max(100, `${config.nameLabel}不能超过 100 个字符`),
    description: z.string().trim().max(500, "备注不能超过 500 个字符").optional().default(""),
    parentCode: z.string().trim().max(60).optional().default(""),
    sortOrder: z.coerce.number().int().min(0).max(99999).optional().default(0),
    status: z.enum(["启用", "停用"]).optional().default("启用"),
    data: z.preprocess((value) => value ?? {}, buildEntityDataSchema(config)),
  });
}

export function validateEntityInput(config: EntityFeatureConfig, payload: unknown): ValidationResult<EntityInput> {
  const result = buildEntityEnvelopeSchema(config).safeParse(payload);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  };
}
