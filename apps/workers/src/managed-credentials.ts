import type {D1Database} from '@cloudflare/workers-types';
import type {ManagedAuth} from './managed-auth';
/** Durable reset intent: revoke first; keep login disabled until provider and D1 agree. */
export async function changeManagedPassword(db:D1Database,auth:ManagedAuth,scope:string,userId:string,password:string,actorId:string,verifiedVersion?:number){
 const identity={id:userId,scope},fingerprint=auth.fingerprint(identity,password);
 let pending=await db.prepare('SELECT fingerprint,version FROM credential_operations WHERE user_id=?').bind(userId).first<{fingerprint:string;version:number}>();
 if(pending&&verifiedVersion!==undefined)throw Error('CREDENTIAL_OPERATION_PENDING');
 if(!pending){
  const user=await db.prepare("SELECT credential_version FROM users WHERE id=? AND password_hash='managed:ready'").bind(userId).first<{credential_version:number}>();
  if(!user||(verifiedVersion!==undefined&&user.credential_version!==verifiedVersion))throw Error('CREDENTIAL_OPERATION_PENDING');
  const results=await db.batch([
   db.prepare("UPDATE users SET credential_version=credential_version+1,password_hash='managed:updating',managed_fingerprint=? WHERE id=? AND credential_version=? AND password_hash='managed:ready'").bind(fingerprint,userId,user.credential_version),
   db.prepare('INSERT INTO credential_operations SELECT ?,?,?,? WHERE changes()=1').bind(userId,fingerprint,user.credential_version+1,Date.now())
  ]);
  if(results[0].meta.changes!==1)throw Error('CREDENTIAL_OPERATION_PENDING');
  pending={fingerprint,version:user.credential_version+1};
 }
 if(pending.fingerprint!==fingerprint)throw Error('CREDENTIAL_OPERATION_PENDING');
 await auth.change(identity,password);
 const finished=await db.batch([
  db.prepare("UPDATE users SET password_hash='managed:ready' WHERE id=? AND credential_version=? AND password_hash='managed:updating'").bind(userId,pending.version),
  db.prepare("INSERT INTO audit_events SELECT ?,?,'password_changed',?,? WHERE changes()=1").bind(crypto.randomUUID(),actorId,userId,Date.now()),
  db.prepare("DELETE FROM credential_operations WHERE user_id=? AND fingerprint=? AND version=? AND EXISTS(SELECT 1 FROM users WHERE id=credential_operations.user_id AND credential_version=credential_operations.version AND password_hash='managed:ready')").bind(userId,fingerprint,pending.version)
 ]);
 if(finished[0].meta.changes!==1){const ready=await db.prepare("SELECT id FROM users WHERE id=? AND credential_version=? AND password_hash='managed:ready'").bind(userId,pending.version).first();if(!ready)throw Error('CREDENTIAL_OPERATION_PENDING');}
}
