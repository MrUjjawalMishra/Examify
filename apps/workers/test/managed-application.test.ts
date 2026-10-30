import {it,expect,vi} from 'vitest';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile} from 'node:fs/promises';
import {ManagedAuth,provisioningId} from '../src/managed-auth';
import tenantEntry from '../src/tenant-entry';
import {controlFetch} from '../src/control';
import {tenantFetch} from '../src/tenant-http';
import {changeManagedPassword} from '../src/managed-credentials';

it('integrates managed authentication with real D1, thirty students, recovery and session revocation',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-10-19',d1Databases:['A','B','CONTROL','C','D']}));
 const provider=new Map<string,{id:string;email:string;password:string;app_metadata:Record<string,string>}>();
 let outage=false;
 // Provider contract double; real provider smoke is a separate explicit script.
 const transport:typeof fetch=async(url,init)=>{
  if(outage)return Response.json({},{status:503});
  const path=new URL(String(url)).pathname,body=init?.body?JSON.parse(String(init.body)):{};
  if(path.endsWith('/token')){const user=[...provider.values()].find(u=>u.email===body.email&&u.password===body.password);return Response.json(user?{user}: {},{status:user?200:400});}
  if(path.endsWith('/admin/users')&&init?.method==='POST'){provider.set(body.id,body);return Response.json(body,{status:201});}
  const user=provider.get(path.split('/').at(-1)!);
  if(!user)return Response.json({},{status:404});
  if(init?.method==='PUT')user.password=body.password;
  return Response.json(user);
 };
 vi.stubGlobal('fetch',transport);
 const config={AUTH_MODE:'supabase' as const,SUPABASE_URL:'https://example.supabase.co',SUPABASE_ADMIN_KEY:'sb_secret_test',AUTH_PASSWORD_PEPPER:'f'.repeat(64)};
 try{
  const a=await mf.getD1Database('A'),b=await mf.getD1Database('B');
  for(const [db,school] of [[a,'C8'],[b,'ABC'],[await mf.getD1Database('C'),'C'],[await mf.getD1Database('D'),'D']] as const){
   for(const file of ['0001_identity.sql','0002_auth_limits.sql','0003_enrollment.sql','0005_managed_auth.sql']){
    const sql=(await readFile(new URL('../migrations/tenant/'+file,import.meta.url),'utf8')).split('CREATE TRIGGER')[0];
    for(const statement of sql.split(';').filter(s=>s.trim()))await db.prepare(statement).run();
   }
   if(school==='C8'||school==='ABC')await db.prepare("INSERT INTO tenant_identity VALUES(1,?,'active')").bind(school).run();
  }
  const auth=new ManagedAuth(config),admin=provisioningId('C8','platform','admin');
  const control=await mf.getD1Database('CONTROL');
  for(const statement of (await readFile(new URL('../migrations/control/0001_control.sql',import.meta.url),'utf8')).split(';').filter(s=>s.trim()))await control.prepare(statement).run();
  const owner=provisioningId('platform','operator','owner');
  await auth.ensure({id:owner,scope:'platform'},'OwnerPassword!9');
  await control.prepare("INSERT INTO owners(id,email,password_hash) VALUES(?,'owner@example.test','managed:ready')").bind(owner).run();
  const internalKey='test-internal-key-at-least-32-characters';
  const c=await mf.getD1Database('C'),d=await mf.getD1Database('D');
  const gateway={...config,CONTROL:control,INTERNAL_KEY:internalKey,TENANT_1:{fetch:(r:Request)=>tenantEntry.fetch(r,{...config,DB:c,INTERNAL_KEY:internalKey})},TENANT_2:{fetch:(r:Request)=>tenantEntry.fetch(r,{...config,DB:d,INTERNAL_KEY:internalKey})}};
  const gatewayCall=(path:string,data:unknown,cookie='')=>controlFetch(new Request('https://school.test'+path,{method:'POST',headers:{Origin:'https://school.test','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(data)}),gateway);
  const ownerResponse=await gatewayCall('/api/owner/login',{email:'owner@example.test',password:'OwnerPassword!9'});expect(ownerResponse.status).toBe(200);
  const ownerCookie=ownerResponse.headers.get('set-cookie')!.split(';')[0];
  for(const code of ['C8','ABC']){
   const created=await gatewayCall('/api/owner/schools',{code,name:'School '+code,requestId:'school-request-0000'+code,adminId:'admin',password:'AdminPassword!9'},ownerCookie);expect(created.status).toBe(201);
   const login=await gatewayCall('/s/'+code+'/api/auth/login',{username:'admin',password:'AdminPassword!9'});expect(login.status).toBe(200);
  }

  await auth.ensure({id:admin,scope:'C8'},'AdminPassword!9');
  await a.prepare("INSERT INTO users VALUES(?,'admin','Admin','school_admin','managed:ready',1,1,0,?)").bind(admin,auth.fingerprint({id:admin,scope:'C8'},'AdminPassword!9')).run();
  const call=(path:string,data?:unknown,cookie?:string,db=a,school='C8')=>tenantFetch(new Request('https://school.test/api/'+path,{method:data===undefined?'GET':'POST',headers:{Origin:'https://school.test','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)}),{...config,DB:db,SCHOOL_ID:school});
  const cookie=(r:Response)=>r.headers.get('set-cookie')!.split(';')[0];
  expect((await call('users',{name:'Denied',requestId:'denied-request-0001'})).status).toBe(401);
  const adminSession=cookie(await call('auth/login',{username:'admin',password:'AdminPassword!9'}));
  const teacherInput={name:'Ujjwal Mishra',requestId:'teacher-request-0001'};
  outage=true;expect((await call('users',teacherInput,adminSession)).status).toBe(503);
  expect(await a.prepare("SELECT active,password_hash FROM users WHERE role='teacher'").first()).toMatchObject({active:0,password_hash:'managed:pending'});
  outage=false;const response=await call('users',teacherInput,adminSession);expect(response.status).toBe(201);
  const teacher=await response.json() as {id:string;username:string;initialPassword:string};
  expect(await (await call('users',teacherInput,adminSession)).json()).toMatchObject({id:teacher.id,replayed:true});
  const teacherSession=cookie(await call('auth/login',{username:teacher.username,password:teacher.initialPassword}));
  await a.prepare("INSERT INTO classes VALUES('9b','9','b')").run();
  await a.prepare("INSERT INTO teacher_assignments VALUES(?,'9b')").bind(teacher.id).run();
  let student:{id:string;username:string;initialPassword:string}|undefined;
  for(let n=1;n<=30;n++){
   const r=await call('users',{name:'Ujjwal Mishra',classId:'9b',rollNumber:String(n),requestId:'student-request-'+String(n).padStart(4,'0')},teacherSession);
   expect(r.status).toBe(201);if(n===15)student=await r.json() as typeof student;
  }
  expect(student!.username).toBe('ujjwal.mishra.9b15');expect(student!.initialPassword).toBe('ujjwal.9b15');
  expect((await call('auth/login',{username:student!.username,password:student!.initialPassword},undefined,b,'ABC')).status).toBe(401);
  const original=cookie(await call('auth/login',{username:student!.username,password:student!.initialPassword}));
  const oldProviderPassword=provider.get(student!.id)!.password;
  expect((await call('auth/password',{currentPassword:student!.initialPassword,newPassword:'ChangedPassword!9'},original)).status).toBe(200);
  expect((await call('auth/me',undefined,original)).status).toBe(401);
  const newProviderPassword=provider.get(student!.id)!.password;
  provider.get(student!.id)!.password=oldProviderPassword;
  expect((await call('auth/login',{username:student!.username,password:student!.initialPassword})).status).toBe(401);
  provider.get(student!.id)!.password=newProviderPassword;
  const changed=cookie(await call('auth/login',{username:student!.username,password:'ChangedPassword!9'}));
  outage=true;expect((await call('students/reset-password',{studentId:student!.id},teacherSession)).status).toBe(503);
  expect((await call('auth/me',undefined,changed)).status).toBe(401);
  outage=false;expect((await call('students/reset-password',{studentId:student!.id},teacherSession)).status).toBe(200);
  await expect(changeManagedPassword(a,auth,'C8',student!.id,'StalePassword!9',student!.id,1)).rejects.toThrow('CREDENTIAL_OPERATION_PENDING');
  expect((await call('auth/login',{username:student!.username,password:student!.initialPassword})).status).toBe(200);
  await a.prepare("UPDATE tenant_identity SET status='suspended'").run();
  expect((await call('auth/me',undefined,teacherSession)).status).toBe(401);
 }finally{vi.unstubAllGlobals();await mf.dispose();}
},120000);
