import { z } from "zod";

// Friendly default messages (per-field .regex/.min messages still take precedence).
z.setErrorMap((issue) => {
  if (issue.code === z.ZodIssueCode.invalid_value) return { message: "请从下拉选项中选择" };
  return { message: "格式不正确" };
});

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

const studentSchema = z.object({
  name: z.string().trim().min(1, "姓名不能为空").max(30, "姓名不能超过30个字符"),
  no: z.string().trim().regex(/^[A-Za-z0-9_-]{4,24}$/, "学号格式不正确"),
  phone: z.string().trim().regex(/^1[3-9][\d*]{9}$/, "手机号格式不正确(脱敏号码亦允许)"),
  gender: z.enum(["男", "女", "未知"], { error: "请选择性别" }).optional().default("未知"),
  faculty: optionalText(80),
  major: optionalText(80),
  className: optionalText(80),
  grade: z.string().trim().regex(/^\d{4}$/, "年级格式不正确").optional().default(""),
  birthDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "出生日期格式不正确").optional().default(""),
  address: optionalText(200),
  status: z.enum(["在读", "休学", "退学", "毕业"], { error: "请选择学生当前状态" }).optional().default("在读"),
  concernType: optionalText(30),
  crisisLevel: optionalText(30),
  crisisRelief: optionalText(30),
});

export type StudentInput = z.infer<typeof studentSchema>;

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationError {
  success: false;
  errors: Array<{ field: string; message: string }>;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

export function validateStudentInput(payload: unknown): ValidationResult<StudentInput> {
  const result = studentSchema.safeParse(payload);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  };
}

const recordSchema = z.object({
  data: z.record(z.string(), z.unknown()).refine(isBoundedRecordData, { message: "记录字段数量或内容超出限制" }),
  status: z.string().trim().min(1).max(30).optional().default("草稿"),
});

const MAX_RECORD_FIELDS = 200;
const MAX_FIELD_KEY_LENGTH = 120;
const MAX_STRING_LENGTH = 2000;
const MAX_ARRAY_ITEMS = 200;
const MAX_NESTING = 2;

/**
 * Bound arbitrary business-record payloads: finite key count, bounded key
 * length, bounded string values, and shallow nesting — prevents DB bloat via
 * the generic record endpoints while keeping nested form data compatible.
 */
function isBoundedRecordData(data: Record<string, unknown>): boolean {
  const entries = Object.entries(data);
  return entries.length <= MAX_RECORD_FIELDS
    && entries.every(([key, value]) => key.length <= MAX_FIELD_KEY_LENGTH && isBoundedValue(value));
}

function isBoundedValue(value: unknown, depth = 0): boolean {
  if (depth > MAX_NESTING) return false;
  if (value === null || typeof value === "boolean" || typeof value === "number") return true;
  if (typeof value === "string") return value.length <= MAX_STRING_LENGTH;
  if (Array.isArray(value)) {
    return value.length <= MAX_ARRAY_ITEMS && value.every((item) => isBoundedValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length <= MAX_RECORD_FIELDS
      && entries.every(([key, val]) => key.length <= MAX_FIELD_KEY_LENGTH && isBoundedValue(val, depth + 1));
  }
  return false;
}

export type RecordInput = z.infer<typeof recordSchema>;

export function validateRecordInput(payload: unknown): ValidationResult<RecordInput> {
  const result = recordSchema.safeParse(payload);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  };
}

const registerSchema = z.object({
  no: z.string().trim().regex(/^[A-Za-z0-9_-]{4,24}$/, "学号格式不正确"),
  name: z.string().trim().min(1, "姓名不能为空").max(30, "姓名不能超过30个字符"),
  idCard: z.string().trim().regex(/^\d{15}$|^\d{17}[\dXx]$/, "身份证号格式不正确"),
  password: z.string().min(10, "密码至少10个字符").max(128, "密码过长"),
  confirmPassword: z.string().min(1, "请再次输入密码").max(128, "密码过长"),
}).refine((value) => value.password === value.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"],
});

export type RegisterInput = z.infer<typeof registerSchema>;

export function validateRegisterInput(payload: unknown): ValidationResult<RegisterInput> {
  const result = registerSchema.safeParse(payload);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  };
}
