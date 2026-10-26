import { describe, expect, it } from 'vitest';
import { assertGroupMembership, assertParentChildAccess, assertSchoolIsolation } from '../src/security';
import type { AuthSession } from '../src/auth';

describe('Multi-School Tenant Isolation & RBAC', () => {
  const teacherSchoolA: AuthSession = {
    userId: 'teacher-1',
    username: 'ujjawal.cs',
    schoolId: 'school-a',
    role: 'teacher',
  };

  it('allows access within the same school', () => {
    expect(() => assertSchoolIsolation(teacherSchoolA, 'school-a')).not.toThrow();
  });

  it('blocks access to another school tenant', () => {
    expect(() => assertSchoolIsolation(teacherSchoolA, 'school-b')).toThrow(/Cross-school tenant access denied/);
  });

  it('blocks students from unauthorized private class communities (e.g. 9A accessing 9C)', () => {
    const student9A: AuthSession = {
      userId: 'stu-9a',
      username: 'rahul.9a',
      schoolId: 'school-a',
      role: 'student',
    };
    expect(() => assertGroupMembership(student9A, 'school-a', ['stu-9c-1', 'teacher-1'])).toThrow(
      /not an authorized member/
    );
  });

  it('prevents a parent from viewing another student record', () => {
    const parentSession: AuthSession = {
      userId: 'parent-1',
      username: 'parent.sharma',
      schoolId: 'school-a',
      role: 'parent',
      verifiedChildIds: ['child-verified-1'],
    };
    expect(() => assertParentChildAccess(parentSession, 'other-student-99')).toThrow(/verified child/);
  });
});