export type PayloadLike = Record<string, unknown>;

export type PayloadValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export function validatePayload(payload: PayloadLike): PayloadValidationResult {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "payload is required" };
  }

  if (
    !("title" in payload) ||
    typeof payload.title !== "string" ||
    !payload.title.trim()
  ) {
    return { valid: false, error: "title is required" };
  }

  return { valid: true };
}

export function validateSchoolPayload(
  schoolId: string,
  userId: string,
  payload: PayloadLike,
): PayloadValidationResult {
  if (!schoolId?.trim()) {
    return { valid: false, error: "schoolId is required" };
  }

  if (!userId?.trim()) {
    return { valid: false, error: "userId is required" };
  }

  return validatePayload(payload);
}

export function isRateLimited(calls: number[], windowMs: number): boolean {
  if (!Array.isArray(calls) || calls.length === 0 || windowMs <= 0) {
    return false;
  }

  const now = Date.now();
  const recentCalls = calls.filter((time) => now - time < windowMs);
  return recentCalls.length > 6;
}

export function requiresAuditLog(action: string): boolean {
  return [
    "publish_exam",
    "change_marks",
    "send_group_message",
    "change_permissions",
    "issue_warning",
    "reassign_query",
  ].includes(action);
}
