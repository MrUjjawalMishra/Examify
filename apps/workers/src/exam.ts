import type { AuthSession } from './auth';
import { assertRoleAllowed, assertSchoolIsolation } from './security';

export type ViolationAction = 'allow' | 'warn' | 'pause_attempt';

export interface IntegrityPolicy {
  maxViolations: number;
}

export function evaluateIntegrityViolation(
  currentViolations: number,
  policy: IntegrityPolicy
): { nextCount: number; action: ViolationAction; message: string } {
  const nextCount = currentViolations + 1;
  if (nextCount >= policy.maxViolations) {
    return {
      nextCount,
      action: 'pause_attempt',
      message: `Attempt paused after ${nextCount} focus/tab violations. Teacher authorization required to resume.`,
    };
  }
  return {
    nextCount,
    action: 'warn',
    message: `Focus change recorded (${nextCount}/${policy.maxViolations}). Repeated tab switches will lock this attempt.`,
  };
}

export interface GradeApprovalInput {
  schoolId: string;
  questionMaxMarks: number;
  aiSuggestedMarks?: number;
  teacherFinalMarks: number;
  teacherConfirmed: boolean;
}

export function finalizeAnswerGrade(session: AuthSession, input: GradeApprovalInput): {
  awardedMarks: number;
  approvedBy: string;
  approvedAt: string;
} {
  assertSchoolIsolation(session, input.schoolId);
  assertRoleAllowed(session, ['teacher', 'school_admin']);

  if (!input.teacherConfirmed) {
    throw new Error('APPROVAL_REQUIRED: AI-suggested marks cannot be saved as final without explicit teacher approval');
  }
  if (input.teacherFinalMarks < 0 || input.teacherFinalMarks > input.questionMaxMarks) {
    throw new Error(`INVALID_MARKS: Marks must be between 0 and ${input.questionMaxMarks}`);
  }

  return {
    awardedMarks: Number(input.teacherFinalMarks.toFixed(2)),
    approvedBy: session.userId,
    approvedAt: new Date().toISOString(),
  };
}