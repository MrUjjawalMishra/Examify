import type { UserRole } from "./security.js";

export type DashboardRole =
  | "platform_owner"
  | "school_admin"
  | "teacher"
  | "student"
  | "parent";

export function canAccessDashboard(
  userRole: UserRole,
  userSchoolId: string,
  dashboardSchoolId: string,
): boolean {
  if (userRole === "platform_owner") {
    return true;
  }

  if (userSchoolId !== dashboardSchoolId) {
    return false;
  }

  const allowedRoles: UserRole[] = [
    "school_admin",
    "teacher",
    "student",
    "parent",
  ];

  return allowedRoles.includes(userRole);
}

export function computeCompletionRate(
  completedAttempts: number,
  assignedAttempts: number,
): number {
  if (assignedAttempts <= 0) return 0;
  return Math.round((completedAttempts / assignedAttempts) * 100);
}

export function averageScore(scores: number[]): number {
  if (!scores.length) return 0;
  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.round(total / scores.length);
}

export function calculateOverdueRate(
  overdueQueries: number,
  totalQueries: number,
): number {
  if (totalQueries <= 0) return 0;
  return Math.round((overdueQueries / totalQueries) * 100);
}

export function calculateImprovement(
  currentAverageScore: number,
  previousAverageScore: number,
): number {
  return currentAverageScore - previousAverageScore;
}
