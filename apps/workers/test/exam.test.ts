import { describe, expect, it } from 'vitest';
import { evaluateIntegrityViolation, finalizeAnswerGrade } from '../src/exam';
import type { AuthSession } from '../src/auth';

describe('Examination Integrity & Teacher Grading Authority', () => {
  it('warns on initial tab switch and pauses attempt on threshold violation', () => {
    const first = evaluateIntegrityViolation(0, { maxViolations: 3 });
    expect(first.action).toBe('warn');

    const third = evaluateIntegrityViolation(2, { maxViolations: 3 });
    expect(third.action).toBe('pause_attempt');
  });

  it('blocks saving AI-suggested marks without explicit teacher confirmation', () => {
    const teacher: AuthSession = {
      userId: 't-1',
      username: 'teacher1',
      schoolId: 'school-a',
      role: 'teacher',
    };
    expect(() =>
      finalizeAnswerGrade(teacher, {
        schoolId: 'school-a',
        questionMaxMarks: 5,
        aiSuggestedMarks: 4,
        teacherFinalMarks: 4,
        teacherConfirmed: false,
      })
    ).toThrow(/APPROVAL_REQUIRED/);
  });
});