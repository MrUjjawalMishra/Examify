import type { AuthSession } from './auth';
import { assertRoleAllowed, assertSchoolIsolation } from './security';

export type QueryLifecycleStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'reopened'
  | 'overdue';

const MIN_SLA_HOURS = 48;
const MAX_SLA_HOURS = 168; // 7 days

export function validateResolutionDeadlineHours(hours: number, schoolMin = MIN_SLA_HOURS, schoolMax = MAX_SLA_HOURS): void {
  const effectiveMin = Math.max(MIN_SLA_HOURS, schoolMin);
  const effectiveMax = Math.min(MAX_SLA_HOURS, schoolMax);
  if (hours < effectiveMin || hours > effectiveMax) {
    throw new Error(`INVALID_DEADLINE: Resolution deadline must be between ${effectiveMin} hours (48h) and ${effectiveMax} hours (7 days)`);
  }
}

export function computeQueryStatus(
  currentStatus: QueryLifecycleStatus,
  deadlineIso: string,
  nowMs = Date.now()
): QueryLifecycleStatus {
  if (currentStatus === 'resolved') return 'resolved';
  const deadlineMs = new Date(deadlineIso).getTime();
  if (nowMs > deadlineMs) {
    return 'overdue';
  }
  return currentStatus;
}

export function transitionQueryStatus(
  session: AuthSession,
  schoolId: string,
  from: QueryLifecycleStatus,
  to: QueryLifecycleStatus
): QueryLifecycleStatus {
  assertSchoolIsolation(session, schoolId);

  if (to === 'reopened') {
    assertRoleAllowed(session, ['student', 'school_admin']);
    if (from !== 'resolved') {
      throw new Error('INVALID_TRANSITION: Only resolved queries can be reopened');
    }
    return 'reopened';
  }

  if (to === 'resolved' || to === 'in_progress') {
    assertRoleAllowed(session, ['teacher', 'school_admin']);
    return to;
  }

  return to;
}