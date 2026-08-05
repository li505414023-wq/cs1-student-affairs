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
]);

/**
 * Maps an apply feature to the workflow model key that should be started
 * when a student submits it. Features absent from this map (and without a
 * model matching their own id) are stored as plain records without a flow.
 */
export const FEATURE_MODEL_MAP: Readonly<Record<string, string>> = {
  leave: "leave",
  grants: "grants",
  // 宿舍类申请统一走已部署的住宿申办流程（模型 key 必须与 workflow_models 一致）。
  "dorm-checkin": "dorm-checkin",
  "dorm-transfer": "dorm-checkin",
  "dorm-checkout": "dorm-checkin",
  "holiday-dorm": "dorm-checkin",
  "delayed-checkout": "dorm-checkin",
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
