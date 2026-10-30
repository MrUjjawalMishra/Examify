import {ManagedAuth, type ManagedAuthConfig} from './managed-auth';
import {createManagedAccount} from './managed-provisioning';
import {changeManagedPassword} from './managed-credentials';
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import {
  assertSameOrigin,
  createSession,
  getSession,
  revokeSession,
} from "./sessions";
import {
  DUMMY_HASH,
  hashPassword,
  validPassword,
  verifyPassword,
} from "./passwords";
import { createAccount, resetStudent } from "./accounts";
import {
  dashboard,
  assignClass,
  setAccountStatus,
  editStudent,
} from "./management";
import { mediaRequest } from "./media";

export interface TenantBindings extends ManagedAuthConfig {
  DB: D1Database;
  SCHOOL_ID: string;
  FILES?: R2Bucket;
}
export function json(data: unknown, status = 200, cookie?: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  if (cookie) headers["Set-Cookie"] = cookie;
  return new Response(JSON.stringify(data), { status, headers });
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    throw new Error("INVALID_BODY");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_BODY");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new Error("INVALID_BODY");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("INVALID_BODY");
  return data as Record<string, unknown>;
}
export async function rateLimit(
  db: D1Database,
  key: string,
  max: number,
): Promise<boolean> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  const hashed = Array.from(new Uint8Array(digest), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
  const window = Math.floor(Date.now() / 900000);
  const row = await db
    .prepare(
      `INSERT INTO auth_limits(key,window,hits) VALUES(?,?,1)
    ON CONFLICT(key) DO UPDATE SET window=excluded.window,
    hits=CASE WHEN auth_limits.window=excluded.window THEN auth_limits.hits+1 ELSE 1 END RETURNING hits`,
    )
    .bind(hashed, window)
    .first<{ hits: number }>();
  return !!row && row.hits <= max;
}

/** SCHOOL_ID and DB are deployment bindings. The HTTP body cannot select either. */
export async function tenantFetch(
  request: Request,
  env: TenantBindings,
): Promise<Response> {
  const path = new URL(request.url).pathname;
  try {
    const auth=env.AUTH_MODE==='supabase'?new ManagedAuth(env):undefined;
    if (!["GET", "HEAD"].includes(request.method)) assertSameOrigin(request);
    if (path === "/api/auth/login" && request.method === "POST") {
      const ip = request.headers.get("CF-Connecting-IP") ?? "local";
      if (!(await rateLimit(env.DB, `ip:${ip}`, 100)))
        return json({ error: "RATE_LIMITED" }, 429);
      const data = await body(request);
      if (
        typeof data.username !== "string" ||
        data.username.length > 128 ||
        !validPassword(data.password)
      )
        return json({ error: "INVALID_CREDENTIALS" }, 401);
      const username = data.username.normalize("NFKC").trim().toLowerCase();
      if (!(await rateLimit(env.DB, `account:${username}`, 10)))
        return json({ error: "RATE_LIMITED" }, 429);
      const user = await env.DB.prepare(
        `SELECT u.id,u.password_hash,u.credential_version,${auth?'u.managed_fingerprint':'NULL AS managed_fingerprint'} FROM users u,tenant_identity t
        WHERE u.username=? AND u.active=1 AND t.singleton=1 AND t.school_id=? AND t.status='active'`,
      )
        .bind(username, env.SCHOOL_ID)
        .first<{
          id: string;
          password_hash: string;
          managed_fingerprint: string|null;
          credential_version: number;
        }>();
      if(auth&&user?.password_hash==='managed:updating'&&user.managed_fingerprint===auth.fingerprint({id:user.id,scope:env.SCHOOL_ID},data.password)){
        // The durable intent was authorized before revocation. Possession of the
        // exact intended password permits recovery, never a different password.
        await changeManagedPassword(env.DB,auth,env.SCHOOL_ID,user.id,data.password,user.id);
        return json({error:'CREDENTIALS_CHANGED_RETRY_LOGIN'},409);
      }
      const verified = auth ? !!user && user.password_hash==='managed:ready' && user.managed_fingerprint===auth.fingerprint({id:user.id,scope:env.SCHOOL_ID},data.password) && await auth.verify({id:user.id,scope:env.SCHOOL_ID},data.password) : await verifyPassword(
        data.password,
        user?.password_hash ?? DUMMY_HASH,
      );
      if (!user || !verified)
        return json({ error: "INVALID_CREDENTIALS" }, 401);
      const session = await createSession(
        env.DB,
        env.SCHOOL_ID,
        user.id,
        user.credential_version,
      );
      return json({ expiresAt: session.expiresAt }, 200, session.cookie);
    }
    if (path === "/api/auth/logout" && request.method === "POST")
      return json({ ok: true }, 200, await revokeSession(env.DB, request));
    const session = await getSession(env.DB, env.SCHOOL_ID, request);
    if (!session) return json({ error: "UNAUTHORIZED" }, 401);
    if (path === "/api/auth/me" && request.method === "GET")
      return json(session);
    if (path === "/api/dashboard" && request.method === "GET")
      return json(await dashboard(env.DB, session));
    if (path === "/api/assignments" && request.method === "POST")
      return json(await assignClass(env.DB, session, await body(request)));
    if (path === "/api/account-status" && request.method === "POST")
      return json(await setAccountStatus(env.DB, session, await body(request)));
    if (path === "/api/students/profile" && request.method === "POST")
      return json(await editStudent(env.DB, session, await body(request)));
    if (path.startsWith("/api/media"))
      return env.FILES
        ? mediaRequest(request, env.DB, env.FILES, session)
        : json({ error: "STORAGE_UNAVAILABLE" }, 503);
    if (path === "/api/users" && request.method === "POST") {
      if (!(await rateLimit(env.DB, `provision:${session.userId}`, 350)))
        return json({ error: "RATE_LIMITED" }, 429);
      return json(
        auth ? await createManagedAccount(env.DB,session,await body(request),auth) : await createAccount(env.DB, session, await body(request)),
        201,
      );
    }
    if (path === "/api/students/reset-password" && request.method === "POST") {
      if (!(await rateLimit(env.DB, `reset:${session.userId}`, 20)))
        return json({ error: "RATE_LIMITED" }, 429);
      const data = await body(request);
      if (typeof data.studentId !== "string")
        return json({ error: "INVALID_ACCOUNT" }, 400);
      return json(await resetStudent(env.DB, session, data.studentId,auth));
    }
    if (path === "/api/auth/password" && request.method === "POST") {
      if (!(await rateLimit(env.DB, `password:${session.userId}`, 10)))
        return json({ error: "RATE_LIMITED" }, 429);
      const data = await body(request);
      if (
        !validPassword(data.currentPassword) ||
        !validPassword(data.newPassword) ||
        data.newPassword.length < 8
      )
        return json({ error: "INVALID_PASSWORD" }, 400);
      const user = await env.DB.prepare(
        auth ? 'SELECT password_hash,credential_version,managed_fingerprint FROM users WHERE id=?' : 'SELECT password_hash,credential_version,NULL AS managed_fingerprint FROM users WHERE id=?',
      )
        .bind(session.userId)
        .first<{ password_hash: string; managed_fingerprint:string|null; credential_version: number }>();
      if (
        !user ||
        !(auth ? user.password_hash==='managed:ready' && user.managed_fingerprint===auth.fingerprint({id:session.userId,scope:env.SCHOOL_ID},data.currentPassword) && await auth.verify({id:session.userId,scope:env.SCHOOL_ID},data.currentPassword) : await verifyPassword(data.currentPassword, user.password_hash))
      )
        return json({ error: "INVALID_CREDENTIALS" }, 401);
      if(auth){await changeManagedPassword(env.DB,auth,env.SCHOOL_ID,session.userId,data.newPassword,session.userId,user.credential_version);return json({ok:true},200,await revokeSession(env.DB,request));}
      const hash = await hashPassword(data.newPassword);
      // Audit insertion is conditional on the successful CAS in the same transaction.
      const results = await env.DB.batch([
        env.DB.prepare(
          "UPDATE users SET password_hash=?,credential_version=credential_version+1 WHERE id=? AND credential_version=?",
        ).bind(hash, session.userId, user.credential_version),
        env.DB.prepare(
          `INSERT INTO audit_events(id,actor_id,action,target_id,created_at)
          SELECT ?,?,'password_changed',?,? WHERE changes()=1`,
        ).bind(crypto.randomUUID(), session.userId, session.userId, Date.now()),
      ]);
      if (results[0].meta.changes !== 1)
        return json({ error: "CREDENTIALS_CHANGED" }, 409);
      return json({ ok: true }, 200, await revokeSession(env.DB, request));
    }
    return json({ error: "NOT_FOUND" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if(message.startsWith('AUTH_PROVIDER_'))return json({error:message},message==='AUTH_PROVIDER_QUOTA'?429:503);
    if(message==='CREDENTIAL_OPERATION_PENDING'||message==='AUTH_IDENTITY_CONFLICT')return json({error:message},409);
    if (message === "FORBIDDEN_ORIGIN") return json({ error: message }, 403);
    if (message === "FORBIDDEN") return json({ error: message }, 403);
    if (message === "INVALID_ACCOUNT" || message.startsWith("INVALID_"))
      return json({ error: "INVALID_ACCOUNT" }, 400);
    if (
      message === "ACCOUNT_CONFLICT" ||
      message.includes("UNIQUE constraint failed")
    )
      return json({ error: "ACCOUNT_CONFLICT" }, 409);
    if (message === "UNAUTHORIZED")
      return json({ error: "INVALID_CREDENTIALS" }, 401);
    if (message === "INVALID_BODY" || error instanceof SyntaxError)
      return json({ error: "INVALID_BODY" }, 400);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
}
export default { fetch: tenantFetch };
