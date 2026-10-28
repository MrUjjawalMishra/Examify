import type { D1Database } from '@cloudflare/workers-types';

export interface TenantSession {
  userId: string;
  username: string;
  role: 'school_admin' | 'teacher' | 'student';
  schoolId: string;
}

export const SESSION_COOKIE = '__Host-examify';
const LIFETIME_SECONDS = 8 * 60 * 60;

async function digest(token: string): Promise<string> {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function sessionCookie(token: string, maxAge = LIFETIME_SECONDS): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function readToken(request: Request): string | null {
  const matches = (request.headers.get('Cookie') ?? '').split(';').map(s => s.trim())
    .filter(s => s.startsWith(`${SESSION_COOKIE}=`));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(SESSION_COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

/** Call only after successful password verification. School is deployment identity, not request input. */
export async function createSession(db: D1Database, schoolId: string, userId: string, verifiedCredentialVersion: number, now = Date.now()) {
  if (!Number.isSafeInteger(verifiedCredentialVersion) || verifiedCredentialVersion < 1) throw new Error('UNAUTHORIZED');
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  const hash = await digest(token);
  const result = await db.prepare(`INSERT INTO sessions (token_hash, user_id, credential_version, created_at, expires_at)
    SELECT ?, u.id, u.credential_version, ?, ? FROM users u, tenant_identity t
    WHERE u.id = ? AND u.credential_version = ? AND u.active = 1
      AND t.singleton = 1 AND t.school_id = ? AND t.status = 'active'`)
    .bind(hash, now, now + LIFETIME_SECONDS * 1000, userId, verifiedCredentialVersion, schoolId).run();
  if (result.meta.changes !== 1) throw new Error('UNAUTHORIZED');
  return { cookie: sessionCookie(token), expiresAt: now + LIFETIME_SECONDS * 1000 };
}

export async function getSession(db: D1Database, schoolId: string, request: Request, now = Date.now()): Promise<TenantSession | null> {
  const token = readToken(request);
  if (!token) return null;
  return db.prepare(`SELECT u.id AS userId, u.username, u.role, t.school_id AS schoolId
    FROM sessions s JOIN users u ON u.id = s.user_id CROSS JOIN tenant_identity t
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1
      AND s.credential_version = u.credential_version
      AND t.singleton = 1 AND t.school_id = ? AND t.status = 'active'`)
    .bind(await digest(token), now, schoolId).first<TenantSession>();
}

export async function revokeSession(db: D1Database, request: Request): Promise<string> {
  const token = readToken(request);
  if (token) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await digest(token)).run();
  return sessionCookie('', 0);
}

export function assertSameOrigin(request: Request): void {
  if (request.headers.get('Origin') !== new URL(request.url).origin ||
      request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new Error('FORBIDDEN_ORIGIN');
}
