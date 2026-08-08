import { describe, expect, it } from "vitest";
import { isStudentApplyFeature, modelKeyForFeature } from "@/lib/feature-policy";

describe("feature policy", () => {
  it("allows students to submit whitelisted apply features only", () => {
    expect(isStudentApplyFeature("leave")).toBe(true);
    expect(isStudentApplyFeature("dorm-checkin")).toBe(true);
    expect(isStudentApplyFeature("student-card")).toBe(true);
    expect(isStudentApplyFeature("scholarship")).toBe(false);
    expect(isStudentApplyFeature("punishment")).toBe(false);
    expect(isStudentApplyFeature("discipline")).toBe(false);
  });

  it("maps apply features to workflow model keys", () => {
    expect(modelKeyForFeature("leave")).toBe("leave");
    expect(modelKeyForFeature("dorm-transfer")).toBe("declare");
    expect(modelKeyForFeature("grants")).toBe("grants");
    // Features without an explicit mapping fall back to their own id
    expect(modelKeyForFeature("student-card")).toBe("student-card");
  });
});
