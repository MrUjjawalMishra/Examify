import type { UserRole } from "./security.js";

export type QueryStatus = "open" | "assigned" | "resolved" | "overdue";
export type QueryPriority = "normal" | "urgent";
export type CommunityVisibility = "public" | "private";

export type QueryTicket = {
  id: string;
  schoolId: string;
  studentId: string;
  teacherId?: string;
  priority: QueryPriority;
  status: QueryStatus;
  dueAt?: string;
};

export type Community = {
  id: string;
  schoolId: string;
  name: string;
  visibility: CommunityVisibility;
  isMember: boolean;
};

export type Notification = {
  schoolId: string;
  userRole: UserRole;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export function canCreateQuery(
  userRole: UserRole,
  userSchoolId: string,
): boolean {
  const allowedRoles: UserRole[] = [
    "student",
    "parent",
    "teacher",
    "school_admin",
  ];
  return userSchoolId.length > 0 && allowedRoles.includes(userRole);
}

export function canAccessQuery(
  userRole: UserRole,
  userSchoolId: string,
  querySchoolId: string,
): boolean {
  if (userSchoolId !== querySchoolId) {
    return false;
  }

  const allowedRoles: UserRole[] = [
    "student",
    "parent",
    "teacher",
    "school_admin",
  ];
  return allowedRoles.includes(userRole);
}

export function assignQuery(
  userRole: UserRole,
  userSchoolId: string,
  targetSchoolId: string,
): boolean {
  if (userSchoolId !== targetSchoolId) {
    return false;
  }

  const allowedRoles: UserRole[] = ["teacher", "school_admin"];
  return allowedRoles.includes(userRole);
}

export function isQueryOverdue(
  status: QueryStatus,
  dueAt: string | null | undefined,
): boolean {
  if (!dueAt || status === "resolved") {
    return false;
  }

  const dueDate = new Date(dueAt).getTime();
  if (Number.isNaN(dueDate)) {
    return false;
  }

  return status === "open" || status === "assigned" || status === "overdue"
    ? dueDate <= Date.now()
    : false;
}

export function canAccessCommunity(
  userRole: UserRole,
  userSchoolId: string,
  communitySchoolId: string,
  isMember: boolean,
): boolean {
  if (userSchoolId !== communitySchoolId) {
    return false;
  }

  const allowedRoles: UserRole[] = [
    "teacher",
    "school_admin",
    "student",
    "parent",
  ];
  if (!allowedRoles.includes(userRole)) {
    return false;
  }

  return isMember || userRole === "teacher" || userRole === "school_admin";
}

export function createNotification(
  schoolId: string,
  userRole: UserRole,
  title: string,
  body: string,
): Notification {
  return {
    schoolId,
    userRole,
    title,
    body,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
}
