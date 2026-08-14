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

/** 谈心谈话方式 */
export const TALK_WAYS = ["面谈", "电话", "家访", "线上"];

/** 心理危机等级（一级最严重） */
export const CRISIS_LEVELS = ["一级", "二级", "三级"];

/** 危机发现方式 */
export const CRISIS_DISCOVER_WAYS = ["本人求助", "同学反馈", "辅导员发现", "其他人发现", "心理中心转介", "其他"];

/** 危机状态 */
export const CRISIS_STATUSES = ["跟踪中", "已解除"];

/** 学业帮扶状态 */
export const HELP_STATUSES = ["帮扶中", "已见效", "已结项"];

/** 学生关注类型 */
export const CONCERN_TYPES = ["学业", "经济", "心理", "就业", "其他"];

/** 预警解除状态 */
export const CRISIS_RELIEF_STATUSES = ["已解除", "待核实", "持续跟进"];
