import { describe, expect, it } from "vitest";
import {
  canAccessRole,
  ensureTenantMatch,
  canAccessSchoolData,
} from "../src/security.js";

describe("tenant and role guards", () => {
  it("allows matching tenant and valid role", () => {
    expect(ensureTenantMatch("school-a", "school-a")).toBe(true);
    expect(canAccessRole("teacher", ["teacher", "school_admin"])).toBe(true);
    expect(canAccessSchoolData("teacher", "school-a", "school-a")).toBe(true);
  });

  it("blocks cross-school access", () => {
    expect(ensureTenantMatch("school-a", "school-b")).toBe(false);
    expect(canAccessSchoolData("student", "school-a", "school-b")).toBe(false);
  });

  it("blocks forbidden role combinations", () => {
    expect(canAccessRole("student", ["school_admin", "teacher"])).toBe(false);
  });
});
