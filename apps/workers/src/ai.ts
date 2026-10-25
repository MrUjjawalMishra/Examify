export type AIProvider = "mock" | "openai" | "anthropic" | "custom";

export type AIDraftRequest = {
  schoolId: string;
  userId: string;
  prompt: string;
  context?: Record<string, unknown>;
};

export type AIResponse = {
  ok: boolean;
  provider: AIProvider;
  content?: string;
  suggestions?: string[];
  error?: string;
};

export type AIRequestValidation =
  | { valid: true }
  | { valid: false; error: string };

export function requiresApproval(action: string): boolean {
  return [
    "publish_exam",
    "change_marks",
    "send_group_message",
    "change_permissions",
    "issue_warning",
  ].includes(action);
}

export function sanitizePromptForSchool(
  schoolId: string,
  prompt: string,
): string {
  const trimmedPrompt = prompt.trim();
  if (!schoolId) {
    return trimmedPrompt;
  }

  if (trimmedPrompt.toLowerCase().includes(schoolId.toLowerCase())) {
    return trimmedPrompt;
  }

  return `${trimmedPrompt} [school: ${schoolId}]`;
}

export function validateAIRequest(
  schoolId: string,
  userId: string,
  prompt: string,
): AIRequestValidation {
  if (!schoolId?.trim()) {
    return { valid: false, error: "schoolId is required" };
  }

  if (!userId?.trim()) {
    return { valid: false, error: "userId is required" };
  }

  if (!prompt?.trim()) {
    return { valid: false, error: "prompt is required" };
  }

  return { valid: true };
}

export class AIAdapter {
  provider: AIProvider;

  constructor(provider: AIProvider = "mock") {
    this.provider = provider;
  }

  async generateDraft(request: AIDraftRequest): Promise<AIResponse> {
    const validation = validateAIRequest(
      request.schoolId,
      request.userId,
      request.prompt,
    );

    if (!validation.valid) {
      return {
        ok: false,
        provider: this.provider,
        error: validation.error,
      };
    }

    if (this.provider === "mock") {
      return {
        ok: true,
        provider: "mock",
        content: `Draft AI suggestion for ${request.schoolId}: review this question before publishing.`,
        suggestions: [
          "Use a shorter answer format",
          "Add one conceptual check question",
        ],
      };
    }

    return {
      ok: false,
      provider: this.provider,
      error: "Real AI provider not configured yet.",
    };
  }
}
