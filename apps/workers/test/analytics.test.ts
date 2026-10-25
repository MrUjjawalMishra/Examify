import { describe, expect, it } from "vitest";
import {
  averageScore,
  calculateImprovement,
  calculateOverdueRate,
  canAccessDashboard,
  computeCompletionRate,
} from "../src/analytics.js";

describe("analytics and dashboard rules", () => {
  it("allows the platform owner and same-school users to access the correct dashboard", () => {
    expect(canAccessDashboard("platform_owner", "", "school-a")).toBe(true);
    expect(canAccessDashboard("teacher", "school-a", "school-a")).toBe(true);
    expect(canAccessDashboard("student", "school-a", "school-a")).toBe(true);
  });

  it("blocks cross-school dashboard access and computes completion correctly", () => {
    expect(canAccessDashboard("teacher", "school-a", "school-b")).toBe(false);
    expect(computeCompletionRate(18, 20)).toBe(90);
    expect(averageScore([80, 90, 70])).toBe(80);
  });

  it("calculates overdue and improvement metrics safely", () => {
    expect(calculateOverdueRate(2, 10)).toBe(20);
    expect(calculateImprovement(82, 76)).toBe(6);
  });
});
