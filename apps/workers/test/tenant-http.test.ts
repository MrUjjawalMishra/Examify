import { describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { hashPassword, verifyPassword } from '../src/passwords';
import { tenantFetch } from '../src/tenant-http';

describe('HTTP school authentication with D1', () => {
  it('logs in all school roles and enforces isolation, password changes, CSRF and suspension', async () => {
    const mf = new Miniflare(convertV4MiniflareOptions({modules:true,
      script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-10-19',d1Databases:['A','B']}));
    try {
      const a = await mf.getD1Database('A'), b = await mf.getD1Database('B');
      const sql = await readFile(new URL('../migrations/tenant/0001_identity.sql',import.meta.url),'utf8');
      const limits = await readFile(new URL('../migrations/tenant/0002_auth_limits.sql',import.meta.url),'utf8');
      const enrollment = await readFile(new URL('../migrations/tenant/0003_enrollment.sql',import.meta.url),'utf8');
      const password = 'ujjwal.9b15';
      const hash = await hashPassword(password);
      expect(hash).not.toContain(password);
      expect(await verifyPassword('incorrect-password',hash)).toBe(false);
      for (const [db,school] of [[a,'a'],[b,'b']] as const) {
        for (const stmt of sql.slice(0,sql.indexOf('CREATE TRIGGER')).split(';').filter(s=>s.trim())) await db.prepare(stmt).run();
        await db.prepare(limits).run();
        for (const stmt of enrollment.split(';').filter(s=>s.trim())) await db.prepare(stmt).run();
        await db.prepare("INSERT INTO tenant_identity VALUES(1,?,'active')").bind(school).run();
        for (const role of ['school_admin','teacher','student'])
          await db.prepare('INSERT INTO users VALUES(?,?,?,?,?,1,1,0)').bind(role,role,role,role,hash).run();
      }
      const env = {DB:a,SCHOOL_ID:'a'};
      const call = (path:string,data?:unknown,cookie?:string,origin='https://school.test') => tenantFetch(new Request(`https://school.test/api/auth/${path}`,{
        method:data === undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},
        ...(data === undefined?{}:{body:JSON.stringify(data)})}),env);
      expect((await call('me')).status).toBe(401);
      expect((await call('login',{username:'student',password},undefined,'https://evil.test')).status).toBe(403);
      expect((await call('login',{username:'student',password:'incorrect-password'})).status).toBe(401);
      let studentCookie='';
      let adminCookie='';
      for (const role of ['school_admin','teacher','student']) {
        const response = await call('login',{username:role,password,schoolId:'b',role:'platform_owner'});
        expect(response.status).toBe(200);
        const cookie = response.headers.get('Set-Cookie')!;
        expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('Secure');
        const me = await call('me',undefined,cookie.split(';')[0]);
        expect(await me.json()).toMatchObject({role,schoolId:'a'});
        if(role==='student') studentCookie=cookie.split(';')[0];
        if(role==='school_admin') adminCookie=cookie.split(';')[0];
      }
      const post = (path:string,data:unknown,cookie?:string) => tenantFetch(new Request(`https://school.test${path}`,{
        method:'POST',headers:{Origin:'https://school.test','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)}),env);
      expect((await post('/api/users',{name:'Denied',requestId:'denied-request-0001'})).status).toBe(401);
      expect((await post('/api/users',{name:'Denied',requestId:'denied-request-0002'},studentCookie)).status).toBe(403);
      const teacherResponse=await post('/api/users',{name:'Ujjwal Mishra',requestId:'teacher-request-0001'},adminCookie);
      expect(teacherResponse.status).toBe(201);
      const teacher=await teacherResponse.json() as {id:string;username:string;initialPassword:string};
      expect(teacher.username).toBe('t-ujjwal.mishra');
      const teacherLogin=await call('login',{username:teacher.username,password:teacher.initialPassword});
      const teacherCookie=teacherLogin.headers.get('Set-Cookie')!.split(';')[0];
      await a.prepare("INSERT INTO classes VALUES('9b','9','b')").run();
      await a.prepare("INSERT INTO teacher_assignments VALUES(?,'9b')").bind(teacher.id).run();
      const input={name:'Ujjwal Mishra',classId:'9b',rollNumber:'15',requestId:'student-request-0001'};
      const created=await post('/api/users',input,teacherCookie);
      expect(created.status).toBe(201);
      const pupil=await created.json() as {id:string;username:string;initialPassword:string};
      expect(pupil.username).toBe('ujjwal.mishra.9b15'); expect(pupil.initialPassword).toBe('ujjwal.9b15');
      const retry=await post('/api/users',input,teacherCookie);
      expect(await retry.json()).toMatchObject({id:pupil.id,replayed:true});
      const pupilLogin=await call('login',{username:pupil.username,password:pupil.initialPassword});
      expect(pupilLogin.status).toBe(200);
      const pupilCookie=pupilLogin.headers.get('Set-Cookie')!.split(';')[0];
      expect((await post('/api/students/reset-password',{studentId:pupil.id},studentCookie)).status).toBe(403);
      expect((await post('/api/students/reset-password',{studentId:pupil.id},teacherCookie)).status).toBe(200);
      expect((await call('me',undefined,pupilCookie)).status).toBe(401);
      const cross = await tenantFetch(new Request('https://school.test/api/auth/me',{headers:{Cookie:studentCookie}}),{DB:b,SCHOOL_ID:'b'});
      expect(cross.status).toBe(401);
      expect((await call('password',{currentPassword:password,newPassword:'new-password-123'},studentCookie)).status).toBe(200);
      expect((await call('me',undefined,studentCookie)).status).toBe(401);
      expect((await call('login',{username:'student',password})).status).toBe(401);
      const logged = await call('login',{username:'student',password:'new-password-123'});
      expect(logged.status).toBe(200);
      const fresh = logged.headers.get('Set-Cookie')!.split(';')[0];
      expect((await call('logout',{},fresh)).status).toBe(200);
      expect((await call('me',undefined,fresh)).status).toBe(401);
      const audit = await a.prepare("SELECT count(*) AS n FROM audit_events WHERE action='password_changed'").first<{n:number}>();
      expect(audit?.n).toBe(1);
      await a.prepare("UPDATE tenant_identity SET status='suspended'").run();
      expect((await call('login',{username:'teacher',password})).status).toBe(401);
      for(let i=0;i<10;i++) await call('login',{username:'unknown',password});
      expect((await call('login',{username:'unknown',password})).status).toBe(429);
    } finally {await mf.dispose();}
  },60000);
});
