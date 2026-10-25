import { describe, expect, it } from "vitest";
import {
  assignQuery,
  canAccessCommunity,
  canAccessQuery,
  canCreateQuery,
  isQueryOverdue,
  createNotification,
} from "../src/queries.js";

describe("query and community rules", () => {
  it("allows a valid school-scoped student query", () => {
    expect(canCreateQuery("student", "school-a")).toBe(true);
    expect(canAccessQuery("student", "school-a", "school-a")).toBe(true);
  });

  it("blocks cross-school query access and invalid assignments", () => {
    expect(canAccessQuery("student", "school-a", "school-b")).toBe(false);
    expect(assignQuery("teacher", "school-a", "school-b")).toBe(false);
    expect(assignQuery("student", "school-a", "school-a")).toBe(false);
  });

  it("marks overdue queries and allows only members into communities", () => {
    const dueAt = new Date(Date.now() - 3600 * 1000).toISOString();
    expect(isQueryOverdue("open", dueAt)).toBe(true);
    expect(canAccessCommunity("teacher", "school-a", "school-a", true)).toBe(
      true,
    );
    expect(canAccessCommunity("teacher", "school-a", "school-b", true)).toBe(
      false,
    );
    expect(canAccessCommunity("student", "school-a", "school-a", false)).toBe(
      false,
    );
  });

  it("creates notifications with proper school scoping", () => {
    const notification = createNotification(
      "school-a",
      "student",
      "Query updated",
      "A teacher replied to your ticket.",
    );

    expect(notification.schoolId).toBe("school-a");
    expect(notification.userRole).toBe("student");
    expect(notification.title).toBe("Query updated");
  });
});
