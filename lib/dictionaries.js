/**
 * 业务领域字典（选项列表唯一来源）。
 * 前端筛选器（app/feature-metadata.ts）、申请表单（app/components/forms/）、
 * 后端业务校验（lib/records-hooks.ts）与种子脚本（scripts/seed-*.mjs）统一引用此处，
 * 避免同一份选项散落多处导致"前端能选、后端 422"。
 * 注意：规则映射（如处分→操行扣分）属于 lib/handbook-rules.ts，不在此列。
 */

/** 请假类型 */
export const LEAVE_TYPES = ["事假", "病假", "公假", "其他"];

/** 处分类型（学生手册五级） */
export const PUNISHMENT_TYPES = ["警告", "严重警告", "记过", "留校察看", "开除学籍"];

/** 违纪等级（不含开除学籍） */
export const VIOLATION_LEVELS = ["警告", "严重警告", "记过", "留校察看"];

/** 学籍异动类型 */
export const STATUS_CHANGE_TYPES = ["休学", "复学", "学业警示", "留级", "退学", "转专业", "转系"];
