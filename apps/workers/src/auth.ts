export type Role = 'platform_owner' | 'school_admin' | 'teacher' | 'student' | 'parent';

export interface AuthSession {
  userId: string;
  username: string;
  schoolId: string | null;
  role: Role;
  assignedSectionIds?: string[];
  verifiedChildIds?: string[];
}

export function formatSyntheticEmail(username: string, schoolCode?: string): string {
  const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (!cleanUser) {
    throw new Error('Username is required');
  }
  const tenantPart = schoolCode
    ? schoolCode.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    : 'platform';
  return `${cleanUser}@${tenantPart}.examify.internal`;
}

export function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function assertAuthenticated(session: AuthSession | null): AuthSession {
  if (!session || !session.userId) {
    throw new Error('UNAUTHORIZED: Valid session required');
  }
  return session;
}