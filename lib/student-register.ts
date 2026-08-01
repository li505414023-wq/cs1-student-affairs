/**
 * Pure helpers for student self-registration identity verification.
 * Kept dependency-free so they can be unit-tested and reused on the client
 * (live ID-card format hint) without pulling in server modules.
 *
 * Security note: the register endpoint returns REGISTER_DENIED_MSG for every
 * failure case (no record / name mismatch / id mismatch / already linked) so
 * the response is not an oracle for "does this 学号 exist".
 */

export const REGISTER_DENIED_MSG =
  "学籍信息不匹配，或该学号已注册。如已注册请直接登录，否则请核对学号、姓名与身份证号。";

const ID_CARD_RE = /^\d{15}$|^\d{17}[\dXx]$/;

export function tail6(value: string | null | undefined): string {
  return String(value ?? "").trim().slice(-6).toUpperCase();
}

export function isValidIdCard(value: string | null | undefined): boolean {
  return ID_CARD_RE.test(String(value ?? "").trim());
}

/**
 * Compare the last 6 digits of the entered ID card against the value stored on
 * the student record. Returns false on any empty / malformed input so callers
 * can collapse every mismatch into the single denied message.
 */
export function idCardTailMatches(
  entered: string | null | undefined,
  onFile: string | null | undefined,
): boolean {
  if (!entered || !onFile) return false;
  if (!isValidIdCard(entered) || !isValidIdCard(onFile)) return false;
  return tail6(entered) === tail6(onFile);
}
