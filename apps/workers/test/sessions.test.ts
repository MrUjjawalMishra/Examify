import { describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { assertSameOrigin, createSession, getSession, revokeSession } from '../src/sessions';

describe('Persistent sessions in isolated D1 databases', () => {
  it('enforces tenant identity, expiration, suspension, reset and logout', async () => {
    const mf = new Miniflare(convertV4MiniflareOptions({modules: true, script: 'export default {fetch(){return new Response("test")}}',
      compatibilityDate: '2026-10-19', d1Databases: ['SCHOOL_A', 'SCHOOL_B']}));
    try {
      const a = await mf.getD1Database('SCHOOL_A');
      const b = await mf.getD1Database('SCHOOL_B');
      const schema = await readFile(new URL('../migrations/tenant/0001_identity.sql', import.meta.url), 'utf8');
      for (const [db, school] of [[a, 'a'], [b, 'b']] as const) {
        // exec expects one statement per line; triggers require prepared execution.
        const base = schema.slice(0, schema.indexOf('CREATE TRIGGER'));
        for (const sql of base.split(';').filter(s => s.trim())) await db.prepare(sql).run();
        await db.prepare("INSERT INTO tenant_identity VALUES (1, ?, 'active')").bind(school).run();
        await db.prepare("INSERT INTO users VALUES ('u','student.9b15','Student','student','test-only',1,1,0)").run();
      }
      const now = Date.now();
      const session = await createSession(a, 'a', 'u', 1, now);
      const request = new Request('https://examify.test/api/me', {headers: {Cookie: session.cookie.split(';')[0]}});
      expect((await getSession(a, 'a', request, now))?.userId).toBe('u');
      expect(await getSession(b, 'b', request, now)).toBeNull();
      expect(await getSession(a, 'b', request, now)).toBeNull();
      expect(await getSession(a, 'a', request, session.expiresAt)).toBeNull();
      const stored = await a.prepare('SELECT token_hash FROM sessions').first<{token_hash: string}>();
      expect(session.cookie).not.toContain(stored!.token_hash);
      await a.prepare("UPDATE tenant_identity SET status='suspended'").run();
      expect(await getSession(a, 'a', request, now)).toBeNull();
      await expect(createSession(a, 'a', 'u', 1, now)).rejects.toThrow('UNAUTHORIZED');
      await a.prepare("UPDATE tenant_identity SET status='active'").run();
      await a.prepare('UPDATE users SET credential_version=2').run();
      expect(await getSession(a, 'a', request, now)).toBeNull();
      await expect(createSession(a, 'a', 'u', 1, now)).rejects.toThrow('UNAUTHORIZED');
      const fresh = await createSession(a, 'a', 'u', 2, now);
      const freshRequest = new Request(request.url, {headers: {Cookie: fresh.cookie.split(';')[0]}});
      await revokeSession(a, freshRequest);
      expect(await getSession(a, 'a', freshRequest, now)).toBeNull();
    } finally { await mf.dispose(); }
  }, 30000);

  it('rejects cross-origin writes and missing Origin', () => {
    expect(() => assertSameOrigin(new Request('https://examify.test', {headers:{Origin:'https://attacker.test'}}))).toThrow();
    expect(() => assertSameOrigin(new Request('https://examify.test'))).toThrow();
    expect(() => assertSameOrigin(new Request('https://examify.test', {headers:{Origin:'https://examify.test'}}))).not.toThrow();
  });
});
