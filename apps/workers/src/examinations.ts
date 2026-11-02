import {createHash} from 'node:crypto';
import type {D1Database} from '@cloudflare/workers-types';
import type {TenantSession} from './sessions';
import type {PaperQuestion} from './papers';
import {body,json,rateLimit} from './tenant-http';
type Question=PaperQuestion&{units:number};
interface Exam {id:string;teacher_id:string;class_id:string;subject_id:string;title:string;snapshot_json:string;total_units:number;starts_at:number;ends_at:number;duration_ms:number;state:string;shuffle_questions:number;shuffle_options:number;negative_percent:number;show_answers:number;integrity_mode:string;published_at:number|null}
interface Attempt {id:string;exam_id:string;student_id:string;started_at:number;deadline:number;state:string;order_json:string;submitted_at:number|null;reason:string|null}
interface Order {questions:number[];options:Record<string,number[]>}
const opid=/^[a-zA-Z0-9-]{16,80}$/;
const ints=(n:number)=>Array.from({length:n},(_,i)=>i);
function shuffle(values:number[]){for(let i=values.length-1;i>0;i--){const bound=i+1,limit=Math.floor(0x100000000/bound)*bound;let r;do{r=crypto.getRandomValues(new Uint32Array(1))[0];}while(r>=limit);const j=r%bound;[values[i],values[j]]=[values[j],values[i]];}return values;}
export function attemptOrder(q:Question[],sq:boolean,so:boolean):Order {return {questions:sq?shuffle(ints(q.length)):ints(q.length),options:Object.fromEntries(q.map((x,i)=>[i,x.kind==='choice'?(so?shuffle(ints(x.options!.length)):ints(x.options!.length)):[]]))};}
export function studentQuestions(exam:Exam,attempt:Attempt){const q=JSON.parse(exam.snapshot_json) as Question[],order=JSON.parse(attempt.order_json) as Order;return order.questions.map(index=>({id:index,prompt:q[index].prompt,kind:q[index].kind,marks:q[index].units/100,...(q[index].kind==='choice'?{options:order.options[index].map(i=>q[index].options![i])}:{})}));}
async function owned(db:D1Database,s:TenantSession,id:string){
 if(s.role!=='teacher')return null;
 return db.prepare(`SELECT e.* FROM examinations e WHERE e.id=? AND e.teacher_id=? AND EXISTS(SELECT 1 FROM teacher_subjects t WHERE t.teacher_id=e.teacher_id AND t.class_id=e.class_id AND t.subject_id=e.subject_id)`).bind(id,s.userId).first<Exam>();
}
async function eligible(db:D1Database,s:TenantSession,id:string){
 if(s.role!=='student')return null;
 return db.prepare('SELECT e.* FROM examinations e JOIN student_enrollments n ON n.class_id=e.class_id WHERE e.id=? AND n.student_id=?').bind(id,s.userId).first<Exam>();
}
/** Freeze before reading answers. One SQL insert grades all questions without 100 subrequests. */
export async function finalizeAttempt(db:D1Database,id:string,now:number,manual=false){
 await db.prepare(`UPDATE exam_attempts SET state='submitted',submitted_at=?,reason=CASE WHEN deadline<=? OR EXISTS(SELECT 1 FROM examinations e WHERE e.id=exam_id AND (e.ends_at<=? OR e.state='ended')) THEN 'expired' ELSE 'manual' END WHERE id=? AND state='in_progress' AND (?=1 OR deadline<=? OR EXISTS(SELECT 1 FROM examinations e WHERE e.id=exam_id AND (e.ends_at<=? OR e.state='ended')))`)
 .bind(now,now,now,id,manual?1:0,now,now).run();
 await db.batch([
  db.prepare(`INSERT OR IGNORE INTO exam_grades(attempt_id,question_index,units,max_units,confirmed)
   SELECT a.id,CAST(q.key AS INTEGER),CASE WHEN json_extract(q.value,'$.kind')='written' THEN 0
    WHEN ans.value_json IS NULL OR ans.value_json='null' THEN 0
    WHEN json_extract(ans.value_json,'$')=json_extract(q.value,'$.correctIndex') THEN json_extract(q.value,'$.units')
    ELSE -CAST(json_extract(q.value,'$.units')*e.negative_percent/100 AS INTEGER) END,
    json_extract(q.value,'$.units'),CASE WHEN json_extract(q.value,'$.kind')='choice' THEN 1 ELSE 0 END
   FROM exam_attempts a JOIN examinations e ON e.id=a.exam_id JOIN json_each(e.snapshot_json) q
   LEFT JOIN exam_answers ans ON ans.attempt_id=a.id AND ans.question_index=CAST(q.key AS INTEGER)
   WHERE a.id=? AND a.state='submitted'`).bind(id),
  db.prepare(`UPDATE exam_attempts SET state='finalized' WHERE id=? AND state='submitted' AND (SELECT COUNT(*) FROM exam_grades g WHERE g.attempt_id=exam_attempts.id)=(SELECT json_array_length(snapshot_json) FROM examinations WHERE id=exam_id)`).bind(id),
  db.prepare(`INSERT INTO audit_events SELECT ?,student_id,'attempt_finalized',id,? FROM exam_attempts WHERE id=? AND changes()=1`).bind(crypto.randomUUID(),now,id)
 ]);
}
/** Bounded work per invocation; access-time finalization remains authoritative. */
export async function finalizeExpired(db:D1Database,now=Date.now(),limit=5){
 const rows=await db.prepare(`SELECT a.id FROM exam_attempts a JOIN examinations e ON e.id=a.exam_id WHERE a.state='submitted' OR (a.state='in_progress' AND (a.deadline<=? OR e.ends_at<=? OR e.state='ended')) ORDER BY a.deadline LIMIT ?`).bind(now,now,limit).all<{id:string}>();
 for(const row of rows.results)await finalizeAttempt(db,row.id,now);return rows.results.length;
}
async function safeAttempt(db:D1Database,e:Exam,a:Attempt,now:number){
 const answers=(await db.prepare('SELECT question_index,value_json,revision,marked FROM exam_answers WHERE attempt_id=?').bind(a.id).all<{question_index:number;value_json:string;revision:number;marked:number}>()).results;
 const order=JSON.parse(a.order_json) as Order,q=JSON.parse(e.snapshot_json) as Question[];
 return {id:a.id,examId:e.id,title:e.title,state:a.state,reason:a.reason,serverNow:now,deadline:Math.min(a.deadline,e.ends_at),questions:studentQuestions(e,a),integrityMode:e.integrity_mode,answers:answers.map(x=>({questionId:x.question_index,value:q[x.question_index].kind==='choice'&&x.value_json!=='null'?order.options[x.question_index].indexOf(JSON.parse(x.value_json)):JSON.parse(x.value_json),revision:x.revision,marked:!!x.marked}))};
}
export async function examinationRequest(req:Request,db:D1Database,s:TenantSession,now=Date.now()):Promise<Response>{
 const path=new URL(req.url).pathname;
 const respond=(data:unknown,status=200)=>json(data,status);
 if(req.method==='POST'&&!(await rateLimit(db,`exam:${s.userId}`,s.role==='student'?600:150)))return respond({error:'RATE_LIMITED'},429);
 if(path==='/api/exams'&&req.method==='GET'){
  const clause=s.role==='student'?'EXISTS(SELECT 1 FROM student_enrollments n WHERE n.student_id=? AND n.class_id=e.class_id)':s.role==='teacher'?'e.teacher_id=? AND EXISTS(SELECT 1 FROM teacher_subjects t WHERE t.teacher_id=e.teacher_id AND t.class_id=e.class_id AND t.subject_id=e.subject_id)':'? IS NOT NULL';
  const rows=await db.prepare(`SELECT e.id,e.title,e.starts_at,e.ends_at,e.duration_ms,e.state,e.total_units,e.integrity_mode,sub.name AS subject,c.class_name,c.section FROM examinations e JOIN subjects sub ON sub.id=e.subject_id JOIN classes c ON c.id=e.class_id WHERE ${clause} ORDER BY e.starts_at DESC LIMIT 100`).bind(s.userId).all();return respond({exams:rows.results,serverNow:now});
 }
 if(path==='/api/exams'&&req.method==='POST'){
  if(s.role!=='teacher')return respond({error:'FORBIDDEN'},403);
  const d=await body(req);if(typeof d.paperId!=='string'||typeof d.classId!=='string'||typeof d.requestId!=='string'||!opid.test(d.requestId)||!Number.isSafeInteger(d.startsAt)||!Number.isSafeInteger(d.endsAt)||!Number.isInteger(d.durationMinutes)||Number(d.durationMinutes)<1||Number(d.durationMinutes)>240||Number(d.endsAt)<=Number(d.startsAt)||Number(d.endsAt)-Number(d.startsAt)>86400000||![0,25,50,100].includes(Number(d.negativePercent))||!['off','standard','strict'].includes(String(d.integrityMode))||['shuffleQuestions','shuffleOptions','showAnswers'].some(k=>typeof d[k]!=='boolean'))return respond({error:'INVALID_EXAM'},400);
  const digest=createHash('sha256').update(JSON.stringify([d.paperId,d.classId,d.startsAt,d.endsAt,d.durationMinutes,d.shuffleQuestions,d.shuffleOptions,d.negativePercent,d.showAnswers,d.integrityMode])).digest('hex');
  const prior=await db.prepare('SELECT id,request_digest FROM examinations WHERE teacher_id=? AND request_id=?').bind(s.userId,d.requestId).first<{id:string;request_digest:string}>();if(prior)return prior.request_digest===digest?respond({id:prior.id,replayed:true}):respond({error:'REQUEST_ID_CONFLICT'},409);
  if(Number(d.startsAt)<now-60000||Number(d.endsAt)<=now)return respond({error:'INVALID_EXAM'},400);
  const paper=await db.prepare(`SELECT p.* FROM question_papers p WHERE p.id=? AND p.teacher_id=? AND EXISTS(SELECT 1 FROM teacher_subjects t WHERE t.teacher_id=? AND t.class_id=? AND t.subject_id=p.subject_id)`).bind(d.paperId,s.userId,s.userId,d.classId).first<{id:string;subject_id:string;title:string;questions_json:string}>();if(!paper)return respond({error:'FORBIDDEN'},403);
  const questions=(JSON.parse(paper.questions_json) as PaperQuestion[]).map(q=>({...q,units:Math.round(q.marks*100)})),total=questions.reduce((n,q)=>n+q.units,0),id=crypto.randomUUID();
  await db.batch([
   db.prepare(`INSERT INTO examinations VALUES(?,?,?,?,?,?,?,?,?,?,?,'scheduled',?,?,?,?,?,?,?,NULL,?)`).bind(id,paper.id,s.userId,d.classId,paper.subject_id,paper.title,JSON.stringify(questions),total,d.startsAt,d.endsAt,Number(d.durationMinutes)*60000,d.shuffleQuestions?1:0,d.shuffleOptions?1:0,d.negativePercent,d.showAnswers?1:0,d.integrityMode,d.requestId,now,digest),
   db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),s.userId,'exam_scheduled',id,now)
  ]);return respond({id},201);
 }
 const examRoute=/^\/api\/exams\/([a-f0-9-]{36})\/(start|preview|monitor|end|extend|publish|result)$/.exec(path);
 if(examRoute){
  const [,id,action]=examRoute;
  if(action==='start'&&req.method==='POST'){
   const e=await eligible(db,s,id);if(!e)return respond({error:'FORBIDDEN'},403);
   let a=await db.prepare('SELECT * FROM exam_attempts WHERE exam_id=? AND student_id=?').bind(id,s.userId).first<Attempt>();
   if(!a){if(e.state!=='scheduled'||now<e.starts_at||now>=e.ends_at)return respond({error:'EXAM_UNAVAILABLE'},409);
    const attemptId=crypto.randomUUID(),order=attemptOrder(JSON.parse(e.snapshot_json),!!e.shuffle_questions,!!e.shuffle_options);
    await db.prepare(`INSERT OR IGNORE INTO exam_attempts(id,exam_id,student_id,started_at,deadline,state,order_json) SELECT ?,id,?,?,MIN(?,ends_at),'in_progress',? FROM examinations WHERE id=? AND state='scheduled' AND starts_at<=? AND ends_at>?`).bind(attemptId,s.userId,now,now+e.duration_ms,JSON.stringify(order),id,now,now).run();
    a=await db.prepare('SELECT * FROM exam_attempts WHERE exam_id=? AND student_id=?').bind(id,s.userId).first<Attempt>();
   }
   if(!a)return respond({error:'EXAM_UNAVAILABLE'},409);if(now>=Math.min(a.deadline,e.ends_at)||e.state!=='scheduled'){await finalizeAttempt(db,a.id,now);a=(await db.prepare('SELECT * FROM exam_attempts WHERE id=?').bind(a.id).first<Attempt>())!;}
   return respond(await safeAttempt(db,e,a,now));
  }
  if(action==='result'&&req.method==='GET'){
   const e=await eligible(db,s,id);if(!e||e.state!=='published')return respond({error:'RESULT_UNAVAILABLE'},404);
   const a=await db.prepare("SELECT * FROM exam_attempts WHERE exam_id=? AND student_id=? AND state='finalized'").bind(id,s.userId).first<Attempt>();if(!a)return respond({error:'RESULT_UNAVAILABLE'},404);
   const grades=(await db.prepare('SELECT question_index,units,max_units,comment FROM exam_grades WHERE attempt_id=? ORDER BY question_index').bind(a.id).all<{question_index:number;units:number;max_units:number;comment:string}>()).results;
   const q=JSON.parse(e.snapshot_json) as Question[],total=Math.max(0,grades.reduce((n,g)=>n+g.units,0)),student=await db.prepare('SELECT display_name,username FROM users WHERE id=?').bind(s.userId).first(),subject=await db.prepare('SELECT name FROM subjects WHERE id=?').bind(e.subject_id).first();
   return respond({title:e.title,student,subject,totalUnits:e.total_units,obtainedUnits:total,percentage:Math.round(total/e.total_units*10000)/100,publishedAt:e.published_at,grades:grades.map(g=>({...g,prompt:q[g.question_index].prompt,...(e.show_answers&&q[g.question_index].kind==='choice'?{correctAnswer:q[g.question_index].options![q[g.question_index].correctIndex!]}:{})}))});
  }
  const e=await owned(db,s,id);if(!e)return respond({error:'FORBIDDEN'},403);
  if(action==='preview'&&req.method==='GET'){const q=JSON.parse(e.snapshot_json);return respond({title:e.title,questions:q.map((x:Question)=>({prompt:x.prompt,kind:x.kind,marks:x.units/100,...(x.kind==='choice'?{options:x.options}:{})}))});}
  if(action==='monitor'&&req.method==='GET'){
   const rows=await db.prepare(`SELECT a.*,u.display_name,(SELECT COUNT(*) FROM exam_integrity_events v WHERE v.attempt_id=a.id) AS events,(SELECT COUNT(*) FROM exam_grades g WHERE g.attempt_id=a.id AND g.confirmed=0) AS pendingGrades FROM exam_attempts a JOIN users u ON u.id=a.student_id WHERE a.exam_id=? ORDER BY a.started_at LIMIT 500`).bind(id).all<Attempt&{display_name:string;events:number;pendingGrades:number}>();
   for(const a of rows.results.filter(a=>a.state!=='finalized').slice(0,5))if(a.state==='submitted'||(a.state==='in_progress'&&(now>=Math.min(a.deadline,e.ends_at)||e.state==='ended')))await finalizeAttempt(db,a.id,now);
   return respond({exam:{...e,snapshot_json:undefined},attempts:rows.results.map(({order_json,...a})=>a),serverNow:now});
  }
  if(action==='end'&&req.method==='POST'){await db.batch([db.prepare("UPDATE examinations SET state='ended',ends_at=MIN(ends_at,?) WHERE id=? AND state='scheduled'").bind(now,id),db.prepare("INSERT INTO audit_events SELECT ?,?,'exam_ended',?,? WHERE changes()=1").bind(crypto.randomUUID(),s.userId,id,now)]);return respond({ok:true});}
  if(action==='extend'&&req.method==='POST'){
   const d=await body(req);if(d.expectedEndsAt!==e.ends_at||!Number.isInteger(d.minutes)||Number(d.minutes)<1||Number(d.minutes)>120||e.state!=='scheduled'||now>=e.ends_at||e.ends_at+Number(d.minutes)*60000-e.starts_at>86400000)return respond({error:'INVALID_EXTENSION'},409);
   const extra=Number(d.minutes)*60000;const updated=await db.batch([db.prepare("UPDATE examinations SET ends_at=ends_at+? WHERE id=? AND state='scheduled' AND ends_at=?").bind(extra,id,e.ends_at),db.prepare("INSERT INTO audit_events SELECT ?,?,'exam_extended',?,? WHERE changes()=1").bind(crypto.randomUUID(),s.userId,id,now),db.prepare("UPDATE exam_attempts SET deadline=deadline+? WHERE exam_id=? AND state='in_progress' AND deadline>? AND changes()=1").bind(extra,id,now)]);return respond(updated[0].meta.changes?{ok:true}:{error:'EXTENSION_CONFLICT'},updated[0].meta.changes?200:409);
  }
  if(action==='publish'&&req.method==='POST'){
   if(e.state==='published')return respond({ok:true,replayed:true});if(e.state==='scheduled'&&e.ends_at>now)return respond({error:'END_EXAM_FIRST'},409);
   const r=await db.batch([db.prepare(`UPDATE examinations SET state='published',published_at=? WHERE id=? AND state!='published' AND NOT EXISTS(SELECT 1 FROM exam_attempts a WHERE a.exam_id=examinations.id AND a.state!='finalized') AND NOT EXISTS(SELECT 1 FROM exam_grades g JOIN exam_attempts a ON a.id=g.attempt_id WHERE a.exam_id=examinations.id AND (g.confirmed=0 OR g.flagged=1))`).bind(now,id),db.prepare("INSERT INTO audit_events SELECT ?,?,'results_published',?,? WHERE changes()=1").bind(crypto.randomUUID(),s.userId,id,now)]);return respond(r[0].meta.changes?{ok:true}:{error:'REVIEW_INCOMPLETE'},r[0].meta.changes?200:409);
  }
 }
 const route=/^\/api\/attempts\/([a-f0-9-]{36})(?:\/(answers|submit|events|review|grade))?$/.exec(path);
 if(route){
  const [,id,action]=route;let a=await db.prepare('SELECT * FROM exam_attempts WHERE id=?').bind(id).first<Attempt>();if(!a)return respond({error:'NOT_FOUND'},404);
  if(action==='review'||action==='grade'){
   const e=await owned(db,s,a.exam_id);if(!e)return respond({error:'FORBIDDEN'},403);if(a.state==='submitted'||now>=Math.min(a.deadline,e.ends_at)||e.state==='ended'){await finalizeAttempt(db,id,now);a=(await db.prepare('SELECT * FROM exam_attempts WHERE id=?').bind(id).first<Attempt>())!;}
   if(a.state!=='finalized')return respond({error:'ATTEMPT_NOT_FINAL'},409);
   if(action==='review'&&req.method==='GET')return respond({attempt:a,examState:e.state,questions:JSON.parse(e.snapshot_json),answers:(await db.prepare('SELECT * FROM exam_answers WHERE attempt_id=?').bind(id).all()).results,grades:(await db.prepare('SELECT * FROM exam_grades WHERE attempt_id=? ORDER BY question_index').bind(id).all()).results});
   if(action==='grade'&&req.method==='POST'){
    const d=await body(req),q=(JSON.parse(e.snapshot_json) as Question[])[Number(d.questionId)];
    if(e.state==='published'||!Number.isInteger(d.questionId)||!q||!Number.isInteger(d.units)||Number(d.units)<0||Number(d.units)>q.units||typeof d.comment!=='string'||d.comment.length>2000||typeof d.confirmed!=='boolean'||typeof d.flagged!=='boolean'||!Number.isInteger(d.revision))return respond({error:'INVALID_GRADE'},400);
    const r=await db.batch([db.prepare(`UPDATE exam_grades SET units=?,comment=?,confirmed=?,flagged=?,revision=revision+1 WHERE attempt_id=? AND question_index=? AND revision=? AND EXISTS(SELECT 1 FROM examinations WHERE id=? AND state!='published')`).bind(d.units,d.comment,d.confirmed?1:0,d.flagged?1:0,id,d.questionId,d.revision,e.id),db.prepare('INSERT INTO exam_grade_history SELECT ?,?,?,?,units,comment,confirmed,revision,? FROM exam_grades WHERE attempt_id=? AND question_index=? AND changes()=1').bind(crypto.randomUUID(),id,d.questionId,s.userId,now,id,d.questionId)]);return respond(r[0].meta.changes?{ok:true}:{error:'GRADE_CONFLICT'},r[0].meta.changes?200:409);
   }
  }
  const e=await eligible(db,s,a.exam_id);if(!e||a.student_id!==s.userId)return respond({error:'FORBIDDEN'},403);
  if(a.state==='submitted'||now>=Math.min(a.deadline,e.ends_at)||e.state==='ended'){await finalizeAttempt(db,id,now);a=(await db.prepare('SELECT * FROM exam_attempts WHERE id=?').bind(id).first<Attempt>())!;}
  if(!action&&req.method==='GET')return respond(await safeAttempt(db,e,a,now));
  if(action==='submit'&&req.method==='POST'){await finalizeAttempt(db,id,now,true);return respond({ok:true,state:'finalized'});}
  if(a.state!=='in_progress'||e.state!=='scheduled')return respond({error:'ATTEMPT_CLOSED'},409);
  if(action==='answers'&&req.method==='POST'){
   const d=await body(req,16384),q=(JSON.parse(e.snapshot_json) as Question[])[Number(d.questionId)],order=JSON.parse(a.order_json) as Order;
   if(!Number.isInteger(d.questionId)||!q||!Number.isInteger(d.revision)||Number(d.revision)<0||typeof d.operationId!=='string'||!opid.test(d.operationId)||typeof d.marked!=='boolean')return respond({error:'INVALID_ANSWER'},400);
   let value=d.value;if(q.kind==='choice'){if(value!==null&&(!Number.isInteger(value)||Number(value)<0||Number(value)>=q.options!.length))return respond({error:'INVALID_ANSWER'},400);value=value===null?null:order.options[Number(d.questionId)][Number(value)];}else if(typeof value!=='string'||value.length>10000)return respond({error:'INVALID_ANSWER'},400);
   const serialized=JSON.stringify(value),prior=await db.prepare('SELECT * FROM exam_answers WHERE attempt_id=? AND question_index=?').bind(id,d.questionId).first<{value_json:string;revision:number;operation_id:string;marked:number}>();
   if(prior?.operation_id===d.operationId){if(prior.value_json!==serialized||prior.marked!==(d.marked?1:0))return respond({error:'ANSWER_CONFLICT'},409);return respond({revision:prior.revision,serverNow:now,replayed:true});}
   const r=await db.prepare(`INSERT INTO exam_answers SELECT ?,?,?,1,?,?,? WHERE ?=0 AND EXISTS(SELECT 1 FROM exam_attempts a JOIN examinations e ON e.id=a.exam_id WHERE a.id=? AND a.state='in_progress' AND a.deadline>? AND e.ends_at>? AND e.state='scheduled')
    ON CONFLICT(attempt_id,question_index) DO UPDATE SET value_json=excluded.value_json,revision=exam_answers.revision+1,operation_id=excluded.operation_id,marked=excluded.marked,saved_at=excluded.saved_at WHERE exam_answers.revision=?`).bind(id,d.questionId,serialized,d.operationId,d.marked?1:0,now,prior?0:d.revision,id,now,now,d.revision).run();
   if(!r.meta.changes)return respond({error:'ANSWER_CONFLICT'},409);return respond({revision:Number(d.revision)+1,serverNow:now});
  }
  if(action==='events'&&req.method==='POST'){
   const d=await body(req);if(typeof d.eventId!=='string'||!opid.test(d.eventId)||!['hidden','blur','fullscreen_exit','disconnect'].includes(String(d.kind)))return respond({error:'INVALID_EVENT'},400);
   if(e.integrity_mode==='off')return respond({strikes:0,reviewRequired:false});
   await db.prepare('INSERT OR IGNORE INTO exam_integrity_events VALUES(?,?,?,?)').bind(id,d.eventId,d.kind,now).run();
   const count=await db.prepare("SELECT COUNT(DISTINCT CAST(created_at/10000 AS INTEGER)) AS n FROM exam_integrity_events WHERE attempt_id=? AND kind!='disconnect'").bind(id).first<{n:number}>();const strikes=count?.n??0;return respond({strikes,reviewRequired:strikes>=(e.integrity_mode==='strict'?3:10),message:'Events are recorded for teacher review, not proof of cheating.'});
  }
 }
 return respond({error:'NOT_FOUND'},404);
}
