import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { timingSafeEqual } from "node:crypto";
import { tenantFetch, body, json } from "./tenant-http";
import { hashPassword, validPassword } from "./passwords";
interface Env {
  DB: D1Database;
  INTERNAL_KEY: string;
  FILES?: R2Bucket;
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const supplied = Buffer.from(req.headers.get("X-Examify-Key") ?? ""),
      expected = Buffer.from(env.INTERNAL_KEY ?? "");
    if (
      expected.length < 32 ||
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return json({ error: "NOT_FOUND" }, 404);
    const path = new URL(req.url).pathname;
    try {
      if (path === "/internal/provision" && req.method === "POST") {
        const d = await body(req);
        if (
          typeof d.schoolId !== "string" ||
          typeof d.adminId !== "string" ||
          !validPassword(d.password) ||
          d.password.length < 12
        )
          return json({ error: "INVALID_SETUP" }, 400);
        const identity = await env.DB.prepare(
          "SELECT school_id FROM tenant_identity WHERE singleton=1",
        ).first<{ school_id: string }>();
        if (identity) {
          const admin = await env.DB.prepare(
            "SELECT id FROM users WHERE role='school_admin' AND active=1",
          ).first();
          return identity.school_id === d.schoolId && admin
            ? json({ ok: true })
            : json({ error: "TENANT_CONFLICT" }, 409);
        }
        const hash = await hashPassword(d.password),
          id = crypto.randomUUID();
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO tenant_identity VALUES(1,?,'active')",
          ).bind(d.schoolId),
          env.DB.prepare(
            "INSERT INTO users(id,username,display_name,role,password_hash,created_at) VALUES(?,?,?,'school_admin',?,?)",
          ).bind(id, d.adminId, "School administrator", hash, Date.now()),
          env.DB.prepare("INSERT INTO audit_events VALUES(?,?,?,?,?)").bind(
            crypto.randomUUID(),
            id,
            "school_initialized",
            d.schoolId,
            Date.now(),
          ),
        ]);
        return json({ ok: true });
      }
      if (path === "/internal/status" && req.method === "POST") {
        const d = await body(req);
        if (!["active", "suspended"].includes(String(d.status)))
          return json({ error: "INVALID_STATUS" }, 400);
        const r = await env.DB.prepare(
          "UPDATE tenant_identity SET status=? WHERE school_id=?",
        )
          .bind(d.status, d.schoolId)
          .run();
        return json(
          { ok: r.meta.changes === 1 },
          r.meta.changes === 1 ? 200 : 409,
        );
      }
      const identity = await env.DB.prepare(
        "SELECT school_id FROM tenant_identity WHERE singleton=1",
      ).first<{ school_id: string }>();
      if (!identity) return json({ error: "NOT_READY" }, 503);
      return tenantFetch(req, {
        DB: env.DB,
        SCHOOL_ID: identity.school_id,
        FILES: env.FILES,
      });
    } catch {
      return json({ error: "INTERNAL_ERROR" }, 500);
    }
  },
};
