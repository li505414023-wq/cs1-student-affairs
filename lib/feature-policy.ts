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
  "dorm-checkin": "declare",
  "dorm-transfer": "declare",
  "dorm-checkout": "declare",
  "holiday-dorm": "declare",
  "delayed-checkout": "declare",
};

export function isStudentApplyFeature(featureId: string): boolean {
  return STUDENT_APPLY_FEATURES.has(featureId);
}

export function modelKeyForFeature(featureId: string): string {
  return FEATURE_MODEL_MAP[featureId] ?? featureId;
}
