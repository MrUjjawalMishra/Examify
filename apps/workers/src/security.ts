export type UserRole =
  | "platform_owner"
  | "school_admin"
  | "teacher"
  | "student"
  | "parent";

export function ensureTenantMatch(
  userSchoolId: string,
  targetSchoolId: string,
): boolean {
  return userSchoolId === targetSchoolId;
}

export function canAccessRole(
  userRole: UserRole,
  allowedRoles: UserRole[],
): boolean {
  return allowedRoles.includes(userRole);
}

export function canAccessSchoolData(
  userRole: UserRole,
  userSchoolId: string,
  targetSchoolId: string,
): boolean {
  if (!ensureTenantMatch(userSchoolId, targetSchoolId)) {
    return false;
  }

  const allowedRoles: UserRole[] = [
    "platform_owner",
    "school_admin",
    "teacher",
    "student",
    "parent",
  ];
  return canAccessRole(userRole, allowedRoles);
}
