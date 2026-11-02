import {it,expect} from 'vitest';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile,readdir} from 'node:fs/promises';
import {examinationRequest,finalizeExpired} from '../src/examinations';
import type {TenantSession} from '../src/sessions';
it('runs a 50-question shuffled examination with CAS autosaves, expiry, grading and publication',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-10-28',d1Databases:['A','B']}));
 try{
  const db=await mf.getD1Database('A'),other=await mf.getD1Database('B');
  for(const [database,school] of [[db,'C8'],[other,'ABC']] as const){
   for(const file of (await readdir(new URL('../migrations/tenant/',import.meta.url))).sort()){
    const sql=await readFile(new URL('../migrations/tenant/'+file,import.meta.url),'utf8'),triggers=sql.match(/CREATE TRIGGER[\s\S]*?END;/g)??[];
    for(const q of sql.replace(/CREATE TRIGGER[\s\S]*?END;/g,'').split(';').filter(s=>s.trim()))await database.prepare(q).run();for(const q of triggers)await database.prepare(q).run();
   }
   await database.prepare("INSERT INTO tenant_identity VALUES(1,?,'active')").bind(school).run();
   for(const [id,role] of [['teacher','teacher'],['student','student'],['second','student']])await database.prepare("INSERT INTO users(id,username,display_name,role,password_hash,created_at) VALUES(?,?,?,?,'test-only',0)").bind(id,id,id,role).run();
   await database.prepare("INSERT INTO classes VALUES('class','9','b')").run();await database.prepare("INSERT INTO subjects VALUES('subject','Cyber Safety')").run();await database.prepare("INSERT INTO teacher_subjects VALUES('teacher','class','subject')").run();await database.prepare("INSERT INTO student_enrollments VALUES('student','class','1'),('second','class','2')").run();
  }
  const now=Date.now(),teacher:TenantSession={userId:'teacher',username:'teacher',role:'teacher',schoolId:'C8'},student:TenantSession={userId:'student',username:'student',role:'student',schoolId:'C8'};
  const questions=Array.from({length:50},(_,i)=>({prompt:`Cyber safety question ${i+1}`,kind:'choice',marks:2,options:['Safe','Unsafe','Unsure'],correctIndex:0}));
  const paperId=crypto.randomUUID();await db.prepare('INSERT INTO question_papers VALUES(?,?,?,?,?,?,?,?,?)').bind(paperId,'teacher','class','subject','Cyber Safety',JSON.stringify(questions),100,'paper-request-0001',now).run();
  const call=(path:string,data?:unknown,s=student,time=now,database=db)=>examinationRequest(new Request('https://exam.test/api'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)}),database,s,time);
  const setup={paperId,classId:'class',requestId:'exam-request-0001',startsAt:now-1000,endsAt:now+600000,durationMinutes:5,shuffleQuestions:true,shuffleOptions:true,negativePercent:25,showAnswers:false,integrityMode:'strict'};
  expect((await call('/exams',setup,student)).status).toBe(403);
  const scheduled=await call('/exams',setup,teacher);expect(scheduled.status).toBe(201);const {id:exam}=await scheduled.json() as {id:string};
  expect((await call('/exams',setup,teacher,now+120000)).status).toBe(200);
  expect((await call('/exams',{...setup,durationMinutes:6},teacher)).status).toBe(409);
  expect((await call('/exams/'+exam+'/start',{},student,now-2000)).status).toBe(409);
  const starts=await Promise.all([call('/exams/'+exam+'/start',{}),call('/exams/'+exam+'/start',{})]);const first=await starts[0].json() as any,second=await starts[1].json() as any;expect(first.id).toBe(second.id);expect(first.questions).toEqual(second.questions);expect(first.questions).toHaveLength(50);expect(JSON.stringify(first)).not.toMatch(/correctIndex|rubric|snapshot_json|negative_percent/);
  expect((await call('/attempts/'+first.id,undefined,{...student,userId:'second'})).status).toBe(403);
  expect((await call('/attempts/'+first.id,undefined,{...student,schoolId:'ABC'},now,other)).status).toBe(404);
  const answer={questionId:first.questions[0].id,value:first.questions[0].options.indexOf('Safe'),revision:0,operationId:crypto.randomUUID(),marked:true};
  expect((await call('/attempts/'+first.id+'/answers',answer)).status).toBe(200);
  expect(await (await call('/attempts/'+first.id+'/answers',answer)).json()).toMatchObject({revision:1,replayed:true});
  expect((await call('/attempts/'+first.id+'/answers',{...answer,value:(answer.value+1)%3,operationId:crypto.randomUUID()})).status).toBe(409);
  const recovered=await (await call('/attempts/'+first.id)).json() as any;expect(recovered.deadline).toBe(first.deadline);expect(recovered.answers[0]).toMatchObject({revision:1,marked:true,value:answer.value});
  for(const q of first.questions.slice(1))expect((await call('/attempts/'+first.id+'/answers',{questionId:q.id,value:q.options.indexOf('Safe'),revision:0,operationId:crypto.randomUUID(),marked:false})).status).toBe(200);
  expect((await call('/exams/'+exam+'/result')).status).toBe(404);
  expect((await call('/attempts/'+first.id+'/submit',{})).status).toBe(200);expect((await call('/attempts/'+first.id+'/submit',{})).status).toBe(200);
  expect((await call('/attempts/'+first.id+'/answers',{...answer,revision:1,operationId:crypto.randomUUID()})).status).toBe(409);
  expect(await db.prepare('SELECT COUNT(*) AS n,SUM(units) AS total FROM exam_grades WHERE attempt_id=?').bind(first.id).first()).toEqual({n:50,total:10000});
  expect((await call('/exams/'+exam+'/publish',{},teacher)).status).toBe(409);
  // Browser-closed second student: expiry is finalized by bounded background processing.
  const abandoned=await (await call('/exams/'+exam+'/start',{}, {...student,userId:'second'})).json() as any;
  expect((await call('/attempts/'+abandoned.id+'/answers',{...answer,operationId:crypto.randomUUID()},{...student,userId:'second'},now+300001)).status).toBe(409);
  await finalizeExpired(db,now+600001);expect(await db.prepare('SELECT state,reason FROM exam_attempts WHERE id=?').bind(abandoned.id).first()).toEqual({state:'finalized',reason:'expired'});
  expect((await call('/exams/'+exam+'/publish',{},teacher,now+600001)).status).toBe(200);
  const result=await (await call('/exams/'+exam+'/result',undefined,student,now+600002)).json() as any;expect(result.obtainedUnits).toBe(10000);expect(result.percentage).toBe(100);expect(JSON.stringify(result)).not.toMatch(/correctAnswer|correctIndex|rubric/);
  expect((await call('/attempts/'+first.id+'/grade',{questionId:0,units:99999,revision:1,confirmed:true,flagged:false,comment:''},teacher)).status).toBe(400);
  // Written answers require an explicit, revision-checked teacher decision.
  const writtenPaper=crypto.randomUUID();await db.prepare('INSERT INTO question_papers VALUES(?,?,?,?,?,?,?,?,?)').bind(writtenPaper,'teacher','class','subject','Written safety',JSON.stringify([{prompt:'Explain phishing',kind:'written',marks:5,rubric:'Identify impersonation and unsafe links'}]),5,'paper-written-0001',now).run();
  const writtenExam=await (await call('/exams',{...setup,paperId:writtenPaper,requestId:'exam-written-0001'},teacher)).json() as any;
  const extended={minutes:1,expectedEndsAt:setup.endsAt};
  expect((await call('/exams/'+writtenExam.id+'/extend',extended,teacher)).status).toBe(200);
  expect((await call('/exams/'+writtenExam.id+'/extend',extended,teacher)).status).toBe(409);
  const written=await (await call('/exams/'+writtenExam.id+'/start',{})).json() as any;
  expect((await call('/attempts/'+written.id+'/answers',{questionId:0,value:'Impersonation to steal credentials.',revision:0,operationId:crypto.randomUUID(),marked:false})).status).toBe(200);
  await call('/attempts/'+written.id+'/submit',{});
  await call('/exams/'+writtenExam.id+'/end',{},teacher);
  expect((await call('/exams/'+writtenExam.id+'/publish',{},teacher)).status).toBe(409);
  const grade={questionId:0,units:400,comment:'Explain link verification too.',confirmed:false,flagged:false,revision:1};
  expect((await call('/attempts/'+written.id+'/grade',grade,teacher)).status).toBe(200);
  expect((await call('/attempts/'+written.id+'/grade',grade,teacher)).status).toBe(409);
  expect((await call('/exams/'+writtenExam.id+'/publish',{},teacher)).status).toBe(409);
  expect((await call('/attempts/'+written.id+'/grade',{...grade,revision:2,confirmed:true,flagged:true},teacher)).status).toBe(200);
  expect((await call('/exams/'+writtenExam.id+'/publish',{},teacher)).status).toBe(409);
  expect((await call('/attempts/'+written.id+'/grade',{...grade,revision:3,confirmed:true},teacher)).status).toBe(200);
  expect((await call('/exams/'+writtenExam.id+'/publish',{},teacher)).status).toBe(200);
  const writtenResult=await (await call('/exams/'+writtenExam.id+'/result')).json() as any;
  expect(writtenResult.obtainedUnits).toBe(400);expect(writtenResult.percentage).toBe(80);
  expect(await db.prepare('SELECT COUNT(*) AS n FROM exam_grade_history WHERE attempt_id=?').bind(written.id).first()).toEqual({n:3});
  await expect(db.prepare('DELETE FROM exam_grade_history WHERE attempt_id=?').bind(written.id).run()).rejects.toThrow(/append-only/);
 }finally{await mf.dispose();}
},120000);

