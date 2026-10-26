import type { AuthSession, Role } from './auth';

export function assertSchoolIsolation(session: AuthSession, targetSchoolId: string): void {
  if (!targetSchoolId) {
    throw new Error('BAD_REQUEST: targetSchoolId is required');
  }
  if (session.role === 'platform_owner') {
    // Platform owner manages school metadata; private student content still requires audited scope
    return;
  }
  if (!session.schoolId || session.schoolId !== targetSchoolId) {
    throw new Error('FORBIDDEN: Cross-school tenant access denied');
  }
}

export function assertRoleAllowed(session: AuthSession, allowedRoles: Role[]): void {
  if (!allowedRoles.includes(session.role)) {
    throw new Error(`FORBIDDEN: Role '${session.role}' cannot perform this operation`);
  }
}

export function assertGroupMembership(
  session: AuthSession,
  groupSchoolId: string,
  memberUserIds: string[]
): void {
  assertSchoolIsolation(session, groupSchoolId);
  if (session.role === 'school_admin') return;
  if (!memberUserIds.includes(session.userId)) {
    throw new Error('FORBIDDEN: User is not an authorized member of this private class group');
  }
}

export function assertParentChildAccess(session: AuthSession, targetStudentId: string): void {
  if (session.role !== 'parent') return;
  const verified = session.verifiedChildIds ?? [];
  if (!verified.includes(targetStudentId)) {
    throw new Error('FORBIDDEN: Parent can only view verified child academic progress');
  }
}