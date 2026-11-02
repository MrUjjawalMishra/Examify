import {it,expect} from 'vitest';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile,readdir} from 'node:fs/promises';
import {tenantFetch} from '../src/tenant-http';
import {createSession} from '../src/sessions';
import {validatePaper} from '../src/papers';
const input={title:'Fractions',classId:'9b',subjectId:'math',requestId:'paper-request-0001',questions:[{prompt:'One half plus one half?',kind:'choice',marks:2,options:['0','1','2'],correctIndex:1},{prompt:'Explain your reasoning.',kind:'written',marks:3,rubric:'One mark for common denominators, two for explanation.'}]};
it('validates paper questions, answer keys and marks on the server',()=>{
 expect(validatePaper(input).totalMarks).toBe(5);
 for(const questions of [[],[{...input.questions[0],correctIndex:5}],[{...input.questions[0],marks:-1}],[{...input.questions[0],marks:NaN}],[{...input.questions[0],options:['same','same']}],[{...input.questions[1],rubric:''}]])expect(()=>validatePaper({...input,questions})).toThrow('INVALID_PAPER');
});
it('persists papers through authenticated HTTP with staff assignment and school isolation',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-10-28',d1Databases:['A','B']}));
 try{
  const a=await mf.getD1Database('A'),b=await mf.getD1Database('B');
  for(const [db,school] of [[a,'C8'],[b,'ABC']] as const){
   for(const file of (await readdir(new URL('../migrations/tenant/',import.meta.url))).sort()){
    const sql=await readFile(new URL('../migrations/tenant/'+file,import.meta.url),'utf8');
    const triggers=sql.match(/CREATE TRIGGER[\s\S]*?END;/g)??[];
    for(const s of sql.replace(/CREATE TRIGGER[\s\S]*?END;/g,'').split(';').filter(s=>s.trim()))await db.prepare(s).run();
    for(const s of triggers)await db.prepare(s).run();
   }
   await db.prepare("INSERT INTO tenant_identity VALUES(1,?,'active')").bind(school).run();
   for(const [id,role] of [['teacher','teacher'],['other','teacher'],['student','student'],['admin','school_admin']])await db.prepare("INSERT INTO users(id,username,display_name,role,password_hash,created_at) VALUES(?,?,?,?,'test-only',0)").bind(id,id,id,role).run();
   await db.prepare("INSERT INTO classes VALUES('9b','9','b')").run();await db.prepare("INSERT INTO subjects VALUES('math','Mathematics')").run();
   await db.prepare("INSERT INTO teacher_subjects VALUES('teacher','9b','math')").run();await db.prepare("INSERT INTO teacher_subjects VALUES('other','9b','math')").run();
  }
  const cookies:Record<string,string>={};for(const role of ['teacher','other','student','admin'])cookies[role]=(await createSession(a,'C8',role,1)).cookie.split(';')[0];
  const call=(path:string,data?:unknown,role='teacher',db=a,school='C8')=>tenantFetch(new Request('https://school.test/api'+path,{method:data===undefined?'GET':'POST',headers:{Origin:'https://school.test','Content-Type':'application/json',Cookie:cookies[role]??''},body:data===undefined?undefined:JSON.stringify(data)}),{DB:db,SCHOOL_ID:school});
  expect((await call('/papers',input,'none')).status).toBe(401);
  expect((await call('/papers',input,'student')).status).toBe(403);
  expect((await call('/papers',input,'admin')).status).toBe(403);
  expect((await call('/papers',{...input,subjectId:'other'})).status).toBe(403);
  const created=await call('/papers',input);expect(created.status).toBe(201);const paper=await created.json() as {id:string};
  expect(await (await call('/papers',input)).json()).toMatchObject({id:paper.id,replayed:true});
  expect((await call('/papers',{...input,title:'Changed'})).status).toBe(409);
  expect((await call('/papers/'+paper.id,undefined,'other')).status).toBe(404);
  expect((await call('/papers/'+paper.id,undefined,'student')).status).toBe(403);
  expect((await call('/papers/'+paper.id,undefined,'teacher',b,'ABC')).status).toBe(401);
  expect(await (await call('/papers/'+paper.id,undefined,'admin')).json()).toMatchObject({questions:input.questions,total_marks:5});
  expect(await a.prepare('SELECT COUNT(*) AS n FROM question_papers').first()).toEqual({n:1});
  expect(await a.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='paper_created'").first()).toEqual({n:1});
  await a.prepare("DELETE FROM teacher_subjects WHERE teacher_id='teacher'").run();
  expect((await call('/papers/'+paper.id)).status).toBe(404);
  expect((await call('/papers',{...input,requestId:'paper-request-0002'})).status).toBe(403);
 }finally{await mf.dispose();}
},60000);
