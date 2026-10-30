import {ManagedAuth, type ManagedAuthConfig} from './managed-auth';
import type { D1Database } from "@cloudflare/workers-types";
import { createHash, randomBytes } from "node:crypto";
import { assertSameOrigin } from "./sessions";
import { body, json, rateLimit } from "./tenant-http";
import { DUMMY_HASH, validPassword, verifyPassword } from "./passwords";

interface HttpService {
  fetch(request: Request): Promise<Response>;
}
export interface ControlEnv extends ManagedAuthConfig {
  CONTROL: D1Database;
  TENANT_1: HttpService;
  TENANT_2: HttpService;
  INTERNAL_KEY: string;
  ASSETS?: HttpService;
}
interface School {
  id: string;
  code: string;
  name: string;
  status: string;
  slot: "TENANT_1" | "TENANT_2";
}
const cookieName = "__Host-examify-owner";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const cookie = (s: string, age = 28800) =>
  `${cookieName}=${s}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}`;
function token(req: Request) {
  const parts = (req.headers.get("Cookie") ?? "")
    .split(";")
    .map((x) => x.trim())
    .filter((x) => x.startsWith(cookieName + "="));
  return parts.length === 1 ? parts[0].slice(cookieName.length + 1) : "";
}
async function internal(
  env: ControlEnv,
  school: School,
  path: string,
  data: unknown,
) {
  return env[school.slot].fetch(
    new Request(`https://internal${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Examify-Key": env.INTERNAL_KEY,
      },
      body: JSON.stringify(data),
    }),
  );
}
export async function controlFetch(
  req: Request,
  env: ControlEnv,
): Promise<Response> {
  try {
    const url = new URL(req.url),
      path = url.pathname;
    if (req.method === "POST") assertSameOrigin(req);
    if (path === "/api/schools" && req.method === "GET") {
      const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
      const rows = await env.CONTROL.prepare(
        "SELECT id,code,name FROM schools WHERE status='active' AND (instr(lower(name),lower(?))>0 OR instr(lower(code),lower(?))>0) ORDER BY name LIMIT 30",
      )
        .bind(q, q)
        .all();
      return json(rows.results);
    }
    const tenant = /^\/s\/([a-zA-Z0-9-]{1,24})(\/api\/.*)$/.exec(path);
    if (tenant) {
      const school = await env.CONTROL.prepare(
        "SELECT * FROM schools WHERE code=? AND status='active'",
      )
        .bind(tenant[1])
        .first<School>();
      if (!school) return json({ error: "SCHOOL_UNAVAILABLE" }, 403);
      const headers = new Headers(req.headers);
      headers.set("X-Examify-Key", env.INTERNAL_KEY);
      const routed = new URL(req.url);
      routed.pathname = tenant[2];
      return env[school.slot].fetch(
        new Request(routed, {
          method: req.method,
          headers,
          body: req.body,
          ...(req.body ? { duplex: "half" } : {}),
          redirect: "manual",
        }),
      );
    }
    if (path === "/api/owner/login" && req.method === "POST") {
      if (
        !(await rateLimit(
          env.CONTROL,
          "owner-ip:" + (req.headers.get("CF-Connecting-IP") ?? "local"),
          40,
        ))
      )
        return json({ error: "RATE_LIMITED" }, 429);
      const data = await body(req);
      if (typeof data.email !== "string" || !validPassword(data.password))
        return json({ error: "INVALID_CREDENTIALS" }, 401);
      const email = data.email.trim().toLowerCase();
      if (!(await rateLimit(env.CONTROL, "owner:" + email, 10)))
        return json({ error: "RATE_LIMITED" }, 429);
      const owner = await env.CONTROL.prepare(
        "SELECT * FROM owners WHERE email=? AND active=1",
      )
        .bind(email)
        .first<{
          id: string;
          password_hash: string;
          credential_version: number;
        }>();
      const auth=env.AUTH_MODE==='supabase'?new ManagedAuth(env):undefined;
      const verified = auth ? !!owner && owner.password_hash==='managed:ready' && await auth.verify({id:owner.id,scope:'platform'},data.password) : await verifyPassword(
        data.password,
        owner?.password_hash ?? DUMMY_HASH,
      );
      if (!owner || !verified)
        return json({ error: "INVALID_CREDENTIALS" }, 401);
      const raw = randomBytes(32).toString("hex");
      const result = await env.CONTROL.prepare(
        "INSERT INTO owner_sessions SELECT ?,id,credential_version,? FROM owners WHERE id=? AND active=1 AND credential_version=?",
      )
        .bind(
          hash(raw),
          Date.now() + 28800000,
          owner.id,
          owner.credential_version,
        )
        .run();
      if (result.meta.changes !== 1)
        return json({ error: "INVALID_CREDENTIALS" }, 401);
      return json({ ok: true }, 200, cookie(raw));
    }
    if (path === "/api/owner/logout" && req.method === "POST") {
      await env.CONTROL.prepare("DELETE FROM owner_sessions WHERE token_hash=?")
        .bind(hash(token(req)))
        .run();
      return json({ ok: true }, 200, cookie("", 0));
    }
    if (path.startsWith("/api/owner/")) {
      const owner = await env.CONTROL.prepare(
        "SELECT o.id,o.email FROM owners o JOIN owner_sessions s ON s.owner_id=o.id WHERE s.token_hash=? AND s.expires_at>? AND s.credential_version=o.credential_version AND o.active=1",
      )
        .bind(hash(token(req)), Date.now())
        .first<{ id: string; email: string }>();
      if (!owner) return json({ error: "UNAUTHORIZED" }, 401);
      if (path === "/api/owner/me" && req.method === "GET")
        return json({ ...owner, role: "platform_owner" });
      if (path === "/api/owner/schools" && req.method === "GET")
        return json(
          (
            await env.CONTROL.prepare(
              "SELECT id,code,name,status,created_at FROM schools ORDER BY created_at DESC",
            ).all()
          ).results,
        );
      if (path === "/api/owner/schools" && req.method === "POST") {
        const d = await body(req);
        if (
          typeof d.code !== "string" ||
          !/^[a-zA-Z0-9-]{1,24}$/.test(d.code) ||
          typeof d.name !== "string" ||
          !d.name.trim() ||
          d.name.length > 120 ||
          typeof d.requestId !== "string" ||
          !/^[a-zA-Z0-9-]{16,80}$/.test(d.requestId) ||
          typeof d.adminId !== "string" ||
          !/^[a-zA-Z0-9._-]{1,64}$/.test(d.adminId) ||
          !validPassword(d.password) ||
          d.password.length < 12
        )
          return json({ error: "INVALID_SCHOOL" }, 400);
        let school = await env.CONTROL.prepare(
          "SELECT * FROM schools WHERE request_id=?",
        )
          .bind(d.requestId)
          .first<School>();
        if (
          school &&
          (school.code !== d.code.toUpperCase() ||
            school.name !== d.name.trim())
        )
          return json({ error: "REQUEST_ID_CONFLICT" }, 409);
        if (school && school.status !== "provisioning")
          return json({ id: school.id, status: school.status, replayed: true });
        if (!school) {
          const used = (
            await env.CONTROL.prepare("SELECT slot FROM schools").all<{
              slot: string;
            }>()
          ).results.map((x) => x.slot);
          const slot = (["TENANT_1", "TENANT_2"] as const).find(
            (s) => !used.includes(s),
          );
          if (!slot) return json({ error: "CAPACITY_REQUIRES_OPERATOR" }, 409);
          school = {
            id: crypto.randomUUID(),
            code: d.code.toUpperCase(),
            name: d.name.trim(),
            slot,
            status: "provisioning",
          };
          await env.CONTROL.batch([
            env.CONTROL.prepare(
              "INSERT INTO schools VALUES(?,?,?,'provisioning',?,?,?)",
            ).bind(
              school.id,
              school.code,
              school.name,
              slot,
              d.requestId,
              Date.now(),
            ),
            env.CONTROL.prepare(
              "INSERT INTO audit_events VALUES(?,?,?,?,?)",
            ).bind(
              crypto.randomUUID(),
              owner.id,
              "school_reserved",
              school.id,
              Date.now(),
            ),
          ]);
        }
        const provisioned = await internal(env, school, "/internal/provision", {
          schoolId: school.id,
          adminId: d.adminId.toLowerCase(),
          password: d.password,
        });
        if (!provisioned.ok)
          return json(
            { error: "PROVISIONING_RETRY_REQUIRED", schoolId: school.id },
            503,
          );
        await env.CONTROL.batch([
          env.CONTROL.prepare(
            "UPDATE schools SET status='active' WHERE id=? AND status='provisioning'",
          ).bind(school.id),
          env.CONTROL.prepare(
            "INSERT INTO audit_events VALUES(?,?,?,?,?)",
          ).bind(
            crypto.randomUUID(),
            owner.id,
            "school_activated",
            school.id,
            Date.now(),
          ),
        ]);
        return json({ id: school.id, status: "active" }, 201);
      }
      if (path === "/api/owner/school-status" && req.method === "POST") {
        const d = await body(req);
        if (
          typeof d.id !== "string" ||
          !["active", "suspended"].includes(String(d.status))
        )
          return json({ error: "INVALID_STATUS" }, 400);
        const school = await env.CONTROL.prepare(
          "SELECT * FROM schools WHERE id=? AND status!='provisioning'",
        )
          .bind(d.id)
          .first<School>();
        if (!school) return json({ error: "NOT_FOUND" }, 404);
        // Central denial first for suspension; tenant activation first for reactivation.
        if (d.status === "suspended")
          await env.CONTROL.prepare(
            "UPDATE schools SET status='suspended' WHERE id=?",
          )
            .bind(school.id)
            .run();
        const response = await internal(env, school, "/internal/status", {
          schoolId: school.id,
          status: d.status,
        });
        if (!response.ok) return json({ error: "STATUS_RETRY_REQUIRED" }, 503);
        await env.CONTROL.batch([
          env.CONTROL.prepare("UPDATE schools SET status=? WHERE id=?").bind(
            d.status,
            school.id,
          ),
          env.CONTROL.prepare(
            "INSERT INTO audit_events VALUES(?,?,?,?,?)",
          ).bind(
            crypto.randomUUID(),
            owner.id,
            "school_" + d.status,
            school.id,
            Date.now(),
          ),
        ]);
        return json({ ok: true });
      }
      return json({ error: "NOT_FOUND" }, 404);
    }
    if (path.startsWith("/api/")) return json({ error: "NOT_FOUND" }, 404);
    return env.ASSETS
      ? env.ASSETS.fetch(req)
      : json({ error: "NOT_FOUND" }, 404);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if(message.startsWith('AUTH_PROVIDER_'))return json({error:message},message==='AUTH_PROVIDER_QUOTA'?429:503);
    if (message === "FORBIDDEN_ORIGIN") return json({ error: message }, 403);
    if (message.includes("UNIQUE constraint"))
      return json({ error: "CONFLICT_RETRY" }, 409);
    if (e instanceof SyntaxError || message === "INVALID_BODY")
      return json({ error: "INVALID_BODY" }, 400);
    console.error(
      JSON.stringify({
        event: "control_request_failed",
        error: message.slice(0, 200),
      }),
    );
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
}
