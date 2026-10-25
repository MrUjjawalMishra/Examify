export type SessionUser = {
  id: string;
  email: string;
  schoolId: string;
  role: "platform_owner" | "school_admin" | "teacher" | "student" | "parent";
};

export function parseBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}

export function isValidUserSession(user: SessionUser | null): boolean {
  if (!user) return false;
  return Boolean(user.id && user.schoolId && user.email);
}
