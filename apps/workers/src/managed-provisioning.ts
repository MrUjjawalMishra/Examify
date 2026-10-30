import type {D1Database} from '@cloudflare/workers-types';
import type {TenantSession} from './sessions';
import {ManagedAuth,provisioningId} from './managed-auth';
import {studentCredentials,teacherUsername} from './credentials';

/** Reserve in D1 first; provider retries reconcile by immutable, server-derived ID. */
export async function createManagedAccount(db:D1Database,actor:TenantSession,input:Record<string,unknown>,auth:ManagedAuth){
 if(!['school_admin','teacher'].includes(actor.role))throw Error('FORBIDDEN');
 if(typeof input.name!=='string'||!input.name.trim()||input.name.length>100||typeof input.requestId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId))throw Error('INVALID_ACCOUNT');
 const role=actor.role==='school_admin'?'teacher':'student';
 const prior=await db.prepare(`SELECT u.id,u.username,u.display_name,u.password_hash,u.role,e.class_id,e.roll_number FROM provisioning_requests p JOIN users u ON u.id=p.user_id LEFT JOIN student_enrollments e ON e.student_id=u.id WHERE p.actor_id=? AND p.request_id=?`).bind(actor.userId,input.requestId).first<{id:string;username:string;display_name:string;password_hash:string;role:string;class_id:string|null;roll_number:string|null}>();
 if(prior&&prior.password_hash!=='managed:pending')return {id:prior.id,replayed:true};
 if(prior&&(prior.display_name!==input.name.trim()||prior.role!==role||(role==='student'&&(prior.class_id!==input.classId||prior.roll_number!==input.rollNumber))))throw Error('ACCOUNT_CONFLICT');
 const id=prior?.id??provisioningId(actor.schoolId,actor.userId,input.requestId);
 const identity={id,scope:actor.schoolId};
 let username:string,password:string,classId:string|null=null,roll:string|null=null;
 if(role==='teacher'){username=teacherUsername(input.name);password=auth.initialPassword(identity);}
 else{
  if(typeof input.classId!=='string'||typeof input.rollNumber!=='string')throw Error('INVALID_ACCOUNT');
  const classroom=await db.prepare('SELECT c.id,c.class_name,c.section FROM classes c JOIN teacher_assignments a ON a.class_id=c.id WHERE a.teacher_id=? AND c.id=?').bind(actor.userId,input.classId).first<{id:string;class_name:string;section:string}>();
  if(!classroom)throw Error('FORBIDDEN');
  const credentials=studentCredentials({name:input.name,className:classroom.class_name,section:classroom.section,rollNumber:input.rollNumber});
  username=credentials.username;password=credentials.initialPassword;classId=classroom.id;roll=credentials.rollNumber;
 }
 if(!prior){
  const statements=[db.prepare("INSERT INTO users(id,username,display_name,role,password_hash,active,created_at,managed_fingerprint) VALUES(?,?,?,?,'managed:pending',0,?,?)").bind(id,username,input.name.trim(),role,Date.now(),auth.fingerprint(identity,password))];
  if(classId)statements.push(db.prepare('INSERT INTO student_enrollments VALUES(?,?,?)').bind(id,classId,roll));
  statements.push(db.prepare('INSERT INTO provisioning_requests VALUES(?,?,?)').bind(actor.userId,input.requestId,id));
  await db.batch(statements);
 }
 await auth.ensure(identity,password);
 const activated=await db.batch([
  db.prepare("UPDATE users SET active=1,password_hash='managed:ready' WHERE id=? AND password_hash='managed:pending'").bind(id),
  db.prepare("INSERT INTO audit_events SELECT ?,?,'account_created',?,? WHERE changes()=1").bind(crypto.randomUUID(),actor.userId,id,Date.now())
 ]);
 if(activated[0].meta.changes!==1)return {id,replayed:true};
 return {id,username,initialPassword:password,role,replayed:false};
}
