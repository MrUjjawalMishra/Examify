import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import type { TenantSession } from "./sessions";
import { json, rateLimit } from "./tenant-http";
export async function mediaRequest(
  req: Request,
  db: D1Database,
  bucket: R2Bucket,
  s: TenantSession,
): Promise<Response> {
  const path = new URL(req.url).pathname;
  if (path === "/api/media" && req.method === "GET")
    return json(
      (
        await db
          .prepare(
            "SELECT id,mime,size,created_at FROM media WHERE owner_id=? ORDER BY created_at DESC LIMIT 100",
          )
          .bind(s.userId)
          .all()
      ).results,
    );
  if (path === "/api/media" && req.method === "POST") {
    if (!(await rateLimit(db, `media:${s.userId}`, 30)))
      return json({ error: "RATE_LIMITED" }, 429);
    const usage = await db
      .prepare(
        "SELECT COALESCE(SUM(size),0) AS bytes FROM media WHERE owner_id=?",
      )
      .bind(s.userId)
      .first<{ bytes: number }>();
    if ((usage?.bytes ?? 0) >= 100 * 1024 * 1024)
      return json({ error: "STORAGE_QUOTA" }, 409);
    const reader = req.body?.getReader();
    if (!reader) return json({ error: "EMPTY_FILE" }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const n = await reader.read();
        if (n.done) break;
        size += n.value.length;
        if (size > 5 * 1024 * 1024) {
          await reader.cancel();
          return json({ error: "FILE_TOO_LARGE" }, 413);
        }
        chunks.push(n.value);
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
    const mime = req.headers.get("Content-Type");
    const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
      (x, i) => bytes[i] === x,
    );
    const jpeg =
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255 &&
      bytes[size - 2] === 255 &&
      bytes[size - 1] === 217;
    if (!((mime === "image/png" && png) || (mime === "image/jpeg" && jpeg)))
      return json({ error: "INVALID_FILE_SIGNATURE" }, 400);
    const id = crypto.randomUUID(),
      key = `${s.schoolId}/${id}`;
    await bucket.put(key, bytes, { httpMetadata: { contentType: mime } });
    try {
      await db.batch([
        db
          .prepare("INSERT INTO media VALUES(?,?,?,?,?,?)")
          .bind(id, s.userId, key, mime, size, Date.now()),
        db
          .prepare("INSERT INTO audit_events VALUES(?,?,?,?,?)")
          .bind(
            crypto.randomUUID(),
            s.userId,
            "media_uploaded",
            id,
            Date.now(),
          ),
      ]);
    } catch (e) {
      await bucket.delete(key);
      throw e;
    }
    return json({ id, size, mime }, 201);
  }
  const id = /^\/api\/media\/([a-f0-9-]{36})$/.exec(path)?.[1];
  if (!id) return json({ error: "NOT_FOUND" }, 404);
  const file = await db
    .prepare("SELECT * FROM media WHERE id=? AND owner_id=?")
    .bind(id, s.userId)
    .first<{ object_key: string; mime: string }>();
  if (!file || !file.object_key.startsWith(s.schoolId + "/"))
    return json({ error: "NOT_FOUND" }, 404);
  if (req.method === "GET") {
    const object = await bucket.get(file.object_key);
    if (!object) return json({ error: "NOT_FOUND" }, 404);
    if (object.size > 5 * 1024 * 1024)
      return json({ error: "INVALID_FILE_SIZE" }, 500);
    return new Response(await object.arrayBuffer(), {
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "attachment",
      },
    });
  }
  if (req.method === "DELETE") {
    await bucket.delete(file.object_key);
    await db.batch([
      db.prepare("DELETE FROM media WHERE id=?").bind(id),
      db
        .prepare("INSERT INTO audit_events VALUES(?,?,?,?,?)")
        .bind(crypto.randomUUID(), s.userId, "media_deleted", id, Date.now()),
    ]);
    return json({ ok: true });
  }
  return json({ error: "METHOD_NOT_ALLOWED" }, 405);
}
