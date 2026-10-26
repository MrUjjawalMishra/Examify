import { describe, expect, it } from 'vitest';
import { computeQueryStatus, transitionQueryStatus, validateResolutionDeadlineHours } from '../src/queries';

describe('Student Query SLA & Lifecycle', () => {
  it('enforces teacher deadline selection between 48 hours and 7 days (168h)', () => {
    expect(() => validateResolutionDeadlineHours(24)).toThrow(/INVALID_DEADLINE/);
    expect(() => validateResolutionDeadlineHours(72)).not.toThrow();
    expect(() => validateResolutionDeadlineHours(200)).toThrow(/INVALID_DEADLINE/);
  });

  it('marks unresolved queries past deadline as overdue', () => {
    const pastIso = new Date(Date.now() - 3600_000).toISOString();
    expect(computeQueryStatus('assigned', pastIso)).toBe('overdue');
    expect(computeQueryStatus('resolved', pastIso)).toBe('resolved');
  });

  it('allows students to reopen a resolved query within their own school', () => {
    const student = { userId: 's-1', username: 'stu1', schoolId: 'sch-1', role: 'student' as const };
    expect(transitionQueryStatus(student, 'sch-1', 'resolved', 'reopened')).toBe('reopened');
  });
});