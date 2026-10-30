// Restricted to existing synthetic staging resources. Never resets an unknown password.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
const cwd=fileURLToPath(new URL('../',import.meta.url)),local=new URL('../../../.local/',import.meta.url);
const wrangler=fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url));
function cli(args){try{return execFileSync(process.execPath,[wrangler,...args],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false'},timeout:120000});}catch{throw Error('WRANGLER_OPERATION_FAILED');}}
const targets=[['examify-staging-control','wrangler.staging.json'],['examify-staging-school-1','wrangler.staging-school-1.json'],['examify-staging-school-2','wrangler.staging-school-2.json']];
function query(target,sql){const data=JSON.parse(cli(['d1','execute',target[0],'-c',target[1],'--remote','--json','--command',sql]));if(data.some(x=>!x.success))throw Error('D1_FAILED');return data[0].results;}
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
try{
 if(!process.argv.includes('--apply'))throw Error('EXPLICIT_APPLY_REQUIRED');
 const config=JSON.parse((await readFile(new URL('supabase-auth.json',local),'utf8')).replace(/^\uFEFF/,''));
 if(config.url!=='https://trrwrjetxfrgvysciihq.supabase.co')throw Error('PROJECT_MISMATCH');
 const credentials=JSON.parse(await readFile(new URL('staging-credentials.json',local),'utf8'));
 let pepper;try{pepper=await readFile(new URL('managed-auth-pepper.txt',local),'utf8');}catch(e){if(e.code!=='ENOENT')throw e;pepper=randomBytes(48).toString('hex');await writeFile(new URL('managed-auth-pepper.txt',local),pepper,{flag:'wx',mode:0o600});}
 const bundle=fileURLToPath(new URL('managed-auth-operator.mjs',local));
 await build({stdin:{contents:"export {ManagedAuth} from './src/managed-auth'; export {verifyPassword} from './src/passwords'; export {studentCredentials} from './src/credentials';",resolveDir:cwd},bundle:true,platform:'node',format:'esm',outfile:bundle,external:['node:*']});
 const {ManagedAuth,verifyPassword,studentCredentials}=await import(pathToFileURL(bundle).href);
 const auth=new ManagedAuth({SUPABASE_URL:config.url,SUPABASE_ADMIN_KEY:config.adminKey,AUTH_PASSWORD_PEPPER:pepper});
 const backup=new URL('managed-backup-'+Date.now()+'/',local);await mkdir(backup,{recursive:true});
 const plans=[];
 for(const target of targets){
  const cfg=JSON.parse(await readFile(new URL('../'+target[1],import.meta.url),'utf8'));
  if(!cfg.name.startsWith('examify-staging')||cfg.account_id!=='e746f9041a0f5eddfd51c206531b3393')throw Error('STAGING_TARGET_MISMATCH');
  cli(['d1','export',target[0],'-c',target[1],'--remote','--output',fileURLToPath(new URL(target[0]+'.sql',backup))]);
  const owner=target===targets[0],scope=owner?'platform':query(target,'SELECT school_id FROM tenant_identity WHERE singleton=1')[0]?.school_id;
  if(!scope)throw Error('TENANT_IDENTITY_MISSING');
  const users=query(target,owner?'SELECT * FROM owners':`SELECT u.*,c.class_name,c.section,e.roll_number FROM users u LEFT JOIN student_enrollments e ON e.student_id=u.id LEFT JOIN classes c ON c.id=e.class_id`);
  for(const user of users){
   if(user.password_hash==='managed:ready')continue;
   let password;
   if(owner&&user.email===credentials.ownerEmail)password=credentials.ownerPassword;
   else if(user.role==='school_admin')password=credentials.adminPassword;
   else if(user.role==='teacher'&&user.id===credentials.teacher?.id)password=credentials.teacher.initialPassword;
   else if(user.role==='student')password=studentCredentials({name:user.display_name,className:user.class_name,section:user.section,rollNumber:user.roll_number}).initialPassword;
   if(!password||!(await verifyPassword(password,user.password_hash)))throw Error('UNKNOWN_STAGING_PASSWORD_MIGRATION_STOPPED');
   plans.push({target,owner,scope,user,password});
  }
 }
 // Finish preflight before changing any D1 account; backups preserve all original hashes.
 for(const target of targets.slice(1))cli(['d1','migrations','apply',target[0],'-c',target[1],'--remote']);
 for(const plan of plans){
  const {target,owner,scope,user,password}=plan,identity={id:user.id,scope};
  await auth.ensure(identity,password);
  if(!(await auth.verify(identity,password)))throw Error('PROVIDER_PASSWORD_MISMATCH');
  const extra=owner?'':',managed_fingerprint='+quote(auth.fingerprint(identity,password));
  query(target,`UPDATE ${owner?'owners':'users'} SET password_hash='managed:ready',credential_version=credential_version+1${extra} WHERE id=${quote(user.id)} AND password_hash=${quote(user.password_hash)} AND credential_version=${Number(user.credential_version)}`);
 }
 const secrets=new URL('managed-staging-secrets.json',local);
 await writeFile(secrets,JSON.stringify({SUPABASE_ADMIN_KEY:config.adminKey,AUTH_PASSWORD_PEPPER:pepper}),{mode:0o600});
 for(const target of targets)cli(['secret','bulk',fileURLToPath(secrets),'-c',target[1]]);
 console.log(JSON.stringify({stagingAccountsMigrated:plans.length,backupsCreated:true,stagingSecretsUpdated:true}));
}catch(error){console.error(/^[A-Z_]+$/.test(error.message)?error.message:'STAGING_MIGRATION_FAILED');process.exitCode=1;}
