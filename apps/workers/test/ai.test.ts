import { describe, expect, it } from "vitest";
import {
  AIAdapter,
  requiresApproval,
  sanitizePromptForSchool,
  validateAIRequest,
} from "../src/ai.js";

describe("ai safety and approval rules", () => {
  it("returns mock suggestions and keeps school scoping", async () => {
    const adapter = new AIAdapter("mock");
    const result = await adapter.generateDraft({
      schoolId: "school-a",
      userId: "teacher-1",
      prompt: "Generate a revision question for Biology",
    });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe("mock");
    expect(result.content).toContain("review");
    expect(
      sanitizePromptForSchool("school-a", "Generate for school-a"),
    ).toContain("school-a");
  });

  it("requires approval for consequential actions and rejects invalid requests", () => {
    expect(requiresApproval("publish_exam")).toBe(true);
    expect(requiresApproval("read_only_summary")).toBe(false);
    expect(
      validateAIRequest("school-a", "teacher-1", "Generate a draft question"),
    ).toEqual({ valid: true });
    expect(
      validateAIRequest("", "teacher-1", "Generate a draft question"),
    ).toEqual({
      valid: false,
      error: "schoolId is required",
    });
  });
});
