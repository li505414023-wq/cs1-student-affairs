/**
 * Feature-level access policy shared by API routes.
 *
 * Students hold read-only role permissions, but the whole point of a student
 * affairs portal is that they can submit applications. These feature ids are
 * the ones a student may create records for (records are always created with
 * createdBy = the student themselves).
 */
export const STUDENT_APPLY_FEATURES: ReadonlySet<string> = new Set([
  "leave",
  "student-card",
  "club-apply",
  // 手册赋予学生的处分申诉权:接到决定书10日内可提交申诉。
  "appeal",
  "dorm-checkin",
  "dorm-transfer",
  "dorm-checkout",
  "holiday-dorm",
  "delayed-checkout",
  // 助困奖罚与事务申请（评审类：辅导员→院系→学校）
  "work-study",
  "hardship",
  "grants",
  "scholarship",
  "tuition-reduction",
  "loans",
  "personal-honor",
  "collective-honor",
  "leave-cancel",
  "complaints",
  "league-member",
  "leaving",
]);

/**
 * Maps an apply feature to the workflow model key that should be started
 * when a student submits it. Features absent from this map (and without a
 * model matching their own id) are rejected with 422 at submit time —
 * 申请类业务必须有流程，静默落库会造成"已提交但无人审批"。
 * 模型定义见 scripts/workflow-model-definitions.mjs。
 */
export const FEATURE_MODEL_MAP: Readonly<Record<string, string>> = {
  leave: "leave",
  // 宿舍类申请统一走已部署的住宿申办流程（设计器与种子脚本中的模型 key 为 declare）。
  "dorm-checkin": "declare",
  "dorm-transfer": "declare",
  "dorm-checkout": "declare",
  "holiday-dorm": "declare",
  "delayed-checkout": "declare",
};

/**
 * Features a student may browse in read-only mode (own profile / home page)
 * but never submit records for. Combined with STUDENT_APPLY_FEATURES this is
 * the single source of truth for student-visible menus (see app/menu-policy).
 */
export const STUDENT_READ_ONLY_FEATURES: ReadonlySet<string> = new Set([
  "student-home",
  "students",
]);

export function isStudentApplyFeature(featureId: string): boolean {
  return STUDENT_APPLY_FEATURES.has(featureId);
}

export function modelKeyForFeature(featureId: string): string {
  return FEATURE_MODEL_MAP[featureId] ?? featureId;
}
