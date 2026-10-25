import { describe, expect, it } from "vitest";
import {
  isRateLimited,
  requiresAuditLog,
  validatePayload,
  validateSchoolPayload,
} from "../src/security-hardening.js";

describe("security hardening and pilot readiness rules", () => {
  it("blocks invalid payloads and applies rate limiting correctly", () => {
    const now = Date.now();

    expect(validatePayload({ title: "Test" })).toEqual({ valid: true });
    expect(validatePayload({ title: "" })).toEqual({
      valid: false,
      error: "title is required",
    });
    expect(isRateLimited([now - 1000, now - 2000, now - 3000], 6000)).toBe(
      false,
    );
    expect(
      isRateLimited(
        [
          now - 100,
          now - 200,
          now - 300,
          now - 400,
          now - 500,
          now - 600,
          now - 700,
        ],
        6000,
      ),
    ).toBe(true);
  });

  it("enforces school-scoped checks and audit logging requirements", () => {
    expect(
      validateSchoolPayload("school-a", "teacher-1", { title: "Draft exam" }),
    ).toEqual({ valid: true });
    expect(
      validateSchoolPayload("", "teacher-1", { title: "Draft exam" }),
    ).toEqual({
      valid: false,
      error: "schoolId is required",
    });
    expect(requiresAuditLog("publish_exam")).toBe(true);
    expect(requiresAuditLog("view_dashboard")).toBe(false);
  });
});
