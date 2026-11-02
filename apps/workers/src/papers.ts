import type {D1Database} from '@cloudflare/workers-types';
import type {TenantSession} from './sessions';
import {body,json} from './tenant-http';
export interface PaperQuestion {prompt:string;kind:'choice'|'written';marks:number;options?:string[];correctIndex?:number;rubric?:string}
export function validatePaper(input:Record<string,unknown>){
 if(typeof input.title!=='string'||!input.title.trim()||input.title.length>160||typeof input.classId!=='string'||typeof input.subjectId!=='string'||typeof input.requestId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId)||!Array.isArray(input.questions)||input.questions.length<1||input.questions.length>20)throw Error('INVALID_PAPER');
 const questions:PaperQuestion[]=input.questions.map((value:unknown)=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_PAPER');
  const q=value as Record<string,unknown>;
  if(typeof q.prompt!=='string'||!q.prompt.trim()||q.prompt.length>2000||typeof q.marks!=='number'||!Number.isFinite(q.marks)||q.marks<=0||q.marks>100||Math.abs(q.marks*100-Math.round(q.marks*100))>1e-8)throw Error('INVALID_PAPER');
  if(q.kind==='choice'){
   if(!Array.isArray(q.options)||q.options.length<2||q.options.length>6||q.options.some(o=>typeof o!=='string'||!o.trim()||o.length>500)||!Number.isInteger(q.correctIndex)||Number(q.correctIndex)<0||Number(q.correctIndex)>=q.options.length)throw Error('INVALID_PAPER');
   const options=(q.options as string[]).map(o=>o.trim());if(new Set(options).size!==options.length)throw Error('INVALID_PAPER');
   return {prompt:q.prompt.trim(),kind:'choice',marks:Math.round(q.marks*100)/100,options,correctIndex:Number(q.correctIndex)};
  }
  if(q.kind!=='written'||typeof q.rubric!=='string'||!q.rubric.trim()||q.rubric.length>4000)throw Error('INVALID_PAPER');
  return {prompt:q.prompt.trim(),kind:'written',marks:Math.round(q.marks*100)/100,rubric:q.rubric.trim()};
 });
 const totalMarks=Math.round(questions.reduce((sum,q)=>sum+q.marks,0)*100)/100;
 if(totalMarks>1000)throw Error('INVALID_PAPER');
 return {title:input.title.trim(),classId:input.classId,subjectId:input.subjectId,requestId:input.requestId,questions,totalMarks};
}
export async function paperRequest(req:Request,db:D1Database,s:TenantSession){
 if(s.role!=='teacher'&&s.role!=='school_admin')return json({error:'FORBIDDEN'},403);
 const path=new URL(req.url).pathname;
 if(path==='/api/papers/options'&&req.method==='GET'){
  const rows=await db.prepare(`SELECT a.class_id,a.subject_id,c.class_name,c.section,sub.name AS subject FROM teacher_subjects a JOIN classes c ON c.id=a.class_id JOIN subjects sub ON sub.id=a.subject_id WHERE a.teacher_id=? ORDER BY c.class_name,c.section,sub.name`).bind(s.userId).all();
  return json(rows.results);
 }
 const allowed=s.role==='teacher'?`p.teacher_id=? AND EXISTS(SELECT 1 FROM teacher_subjects a WHERE a.teacher_id=p.teacher_id AND a.class_id=p.class_id AND a.subject_id=p.subject_id)`:'? IS NOT NULL';
 if(path==='/api/papers'&&req.method==='GET')return json((await db.prepare(`SELECT p.id,p.title,p.total_marks,p.created_at,c.class_name,c.section,sub.name AS subject FROM question_papers p JOIN classes c ON c.id=p.class_id JOIN subjects sub ON sub.id=p.subject_id WHERE ${allowed} ORDER BY p.created_at DESC LIMIT 100`).bind(s.userId).all()).results);
 const detail=/^\/api\/papers\/([a-f0-9-]{36})$/.exec(path);
 if(detail&&req.method==='GET'){
  const row=await db.prepare(`SELECT p.* FROM question_papers p WHERE ${allowed} AND p.id=?`).bind(s.userId,detail[1]).first<{questions_json:string;[key:string]:unknown}>();
  if(!row)return json({error:'NOT_FOUND'},404);
  const {questions_json,...rest}=row;return json({...rest,questions:JSON.parse(questions_json)});
 }
 if(path==='/api/papers'&&req.method==='POST'){
  if(s.role!=='teacher')return json({error:'FORBIDDEN'},403);
  let paper;try{paper=validatePaper(await body(req,65536));}catch{return json({error:'INVALID_PAPER'},400);}
  const assigned=await db.prepare('SELECT 1 FROM teacher_subjects WHERE teacher_id=? AND class_id=? AND subject_id=?').bind(s.userId,paper.classId,paper.subjectId).first();
  if(!assigned)return json({error:'FORBIDDEN'},403);
  const serialized=JSON.stringify(paper.questions);
  const existing=await db.prepare('SELECT id,title,class_id,subject_id,questions_json FROM question_papers WHERE teacher_id=? AND request_id=?').bind(s.userId,paper.requestId).first<{id:string;title:string;class_id:string;subject_id:string;questions_json:string}>();
  if(existing){if(existing.title!==paper.title||existing.class_id!==paper.classId||existing.subject_id!==paper.subjectId||existing.questions_json!==serialized)return json({error:'REQUEST_ID_CONFLICT'},409);return json({id:existing.id,replayed:true});}
  const id=crypto.randomUUID(),now=Date.now();
  await db.batch([
   db.prepare('INSERT INTO question_papers VALUES(?,?,?,?,?,?,?,?,?)').bind(id,s.userId,paper.classId,paper.subjectId,paper.title,serialized,paper.totalMarks,paper.requestId,now),
   db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),s.userId,'paper_created',id,now)
  ]);
  return json({id,totalMarks:paper.totalMarks,replayed:false},201);
 }
 return json({error:'NOT_FOUND'},404);
}
