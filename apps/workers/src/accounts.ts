import type { D1Database } from '@cloudflare/workers-types';
import type { TenantSession } from './sessions';
import { hashPassword } from './passwords';
import { studentCredentials, teacherUsername } from './credentials';

export async function createAccount(db:D1Database, actor:TenantSession, input:Record<string,unknown>) {
  if (actor.role !== 'school_admin' && actor.role !== 'teacher') throw new Error('FORBIDDEN');
  if (typeof input.name !== 'string' || input.name.trim().length < 1 || input.name.length > 100 ||
      typeof input.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId)) throw new Error('INVALID_ACCOUNT');
  const role = actor.role === 'school_admin' ? 'teacher' : 'student';
  const prior = await db.prepare('SELECT user_id AS id FROM provisioning_requests WHERE actor_id=? AND request_id=?')
    .bind(actor.userId,input.requestId).first<{id:string}>();
  if (prior) return {...prior,replayed:true};
  let username:string, initialPassword:string;
  let classId:string | null = null, rollNumber:string | null = null;
  if (role === 'teacher') {
    username=teacherUsername(input.name);
    initialPassword=crypto.randomUUID();
  } else {
    if(typeof input.classId !== 'string' || typeof input.rollNumber !== 'string') throw new Error('INVALID_ACCOUNT');
    const classroom=await db.prepare(`SELECT c.id,c.class_name,c.section FROM classes c JOIN teacher_assignments a ON a.class_id=c.id
      WHERE a.teacher_id=? AND c.id=?`).bind(actor.userId,input.classId).first<{id:string;class_name:string;section:string}>();
    if(!classroom) throw new Error('FORBIDDEN');
    const credentials=studentCredentials({name:input.name,className:classroom.class_name,section:classroom.section,rollNumber:input.rollNumber});
    username=credentials.username; initialPassword=credentials.initialPassword; classId=classroom.id; rollNumber=credentials.rollNumber;
  }
  if(await db.prepare('SELECT id FROM users WHERE username=?').bind(username).first()) throw new Error('ACCOUNT_CONFLICT');
  const id=crypto.randomUUID(), hash=await hashPassword(initialPassword), now=Date.now();
  const statements=[db.prepare('INSERT INTO users(id,username,display_name,role,password_hash,created_at) VALUES(?,?,?,?,?,?)')
    .bind(id,username,input.name.trim(),role,hash,now)];
  if(classId) statements.push(db.prepare('INSERT INTO student_enrollments VALUES(?,?,?)').bind(id,classId,rollNumber));
  statements.push(db.prepare('INSERT INTO provisioning_requests VALUES(?,?,?)').bind(actor.userId,input.requestId,id),
    db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor.userId,'account_created',id,now));
  await db.batch(statements);
  return {id,username,initialPassword,role,replayed:false};
}

export async function resetStudent(db:D1Database,actor:TenantSession,studentId:string) {
  if(actor.role !== 'teacher') throw new Error('FORBIDDEN');
  const student=await db.prepare(`SELECT u.display_name,c.class_name,c.section,e.roll_number,u.credential_version
    FROM users u JOIN student_enrollments e ON e.student_id=u.id JOIN classes c ON c.id=e.class_id
    JOIN teacher_assignments a ON a.class_id=c.id
    WHERE u.id=? AND u.role='student' AND a.teacher_id=?`)
    .bind(studentId,actor.userId).first<{display_name:string;class_name:string;section:string;roll_number:string;credential_version:number}>();
  if(!student) throw new Error('FORBIDDEN');
  const {initialPassword}=studentCredentials({name:student.display_name,className:student.class_name,section:student.section,rollNumber:student.roll_number});
  const hash=await hashPassword(initialPassword);
  const result=await db.batch([
    db.prepare('UPDATE users SET password_hash=?,credential_version=credential_version+1 WHERE id=? AND credential_version=?')
      .bind(hash,studentId,student.credential_version),
    db.prepare("INSERT INTO audit_events SELECT ?,?,'password_reset',?,? WHERE changes()=1")
      .bind(crypto.randomUUID(),actor.userId,studentId,Date.now()),
  ]);
  if(result[0].meta.changes !== 1) throw new Error('ACCOUNT_CONFLICT');
  return {initialPassword};
}
