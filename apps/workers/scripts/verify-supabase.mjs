import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const local=new URL('../../../.local/',import.meta.url);
const config=JSON.parse((await readFile(new URL('supabase-auth.json',local),'utf8')).replace(/^\uFEFF/,''));
if(config.url!=='https://trrwrjetxfrgvysciihq.supabase.co'||!config.adminKey)throw Error('INVALID_PROJECT_CONFIG');
const headers={apikey:config.adminKey,'User-Agent':'Examify-Server/1.0','Content-Type':'application/json'};
if(config.adminKey.startsWith('eyJ'))headers.Authorization='Bearer '+config.adminKey;
async function call(path,method='GET',body){
 const response=await fetch(config.url+'/auth/v1'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
 return {status:response.status,data:await response.json()};
}
function check(ok,label){if(!ok)throw Error(label+'_FAILED');console.log(label+'_PASSED');}
try{
 const settings=await call('/settings');
 check(settings.status===200&&settings.data.disable_signup===true,'PUBLIC_SIGNUP_DISABLED');
 check(settings.data.external?.anonymous_users===false,'ANONYMOUS_SIGNIN_DISABLED');
 const denied=await call('/signup','POST',{email:'denial-'+randomUUID()+'@accounts.examify.invalid',password:randomUUID()+'Aa!9'});
 check(denied.status===422&&denied.data.error_code==='signup_disabled','PUBLIC_SIGNUP_REJECTED');
 const anonymous=await call('/signup','POST',{});
 check(anonymous.status===422&&anonymous.data.error_code==='anonymous_provider_disabled','ANONYMOUS_SIGNUP_REJECTED');
 if(process.argv.includes('--provision-test')){
  const file=new URL('supabase-smoke-user.json',local);
  let fixture;
  try{fixture=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;const id=randomUUID();fixture={id,email:id+'@accounts.examify.invalid',password:randomUUID()+'Aa!9'};await writeFile(file,JSON.stringify(fixture),{flag:'wx',mode:0o600});}
  if(fixture.password.length>72){fixture.password=fixture.password.slice(0,60)+'Aa!9';await writeFile(file,JSON.stringify(fixture),{mode:0o600});}
  let user=await call('/admin/users/'+fixture.id);
  if(user.status===404)user=await call('/admin/users','POST',{...fixture,email_confirm:true,app_metadata:{examify_scope:'provider-smoke-only'}});
  check([200,201].includes(user.status)&&user.data.id===fixture.id&&user.data.app_metadata?.examify_scope==='provider-smoke-only','ADMIN_PROVISIONING');
  const login=await call('/token?grant_type=password','POST',{email:fixture.email,password:fixture.password});
  check(login.status===200&&login.data.user?.id===fixture.id,'PROVIDER_PASSWORD_LOGIN');
  // Synthetic provider-only identity is retained for idempotent verification.
  // It has no D1 account, role, or Examify session access.
 }
}catch(error){console.error(/^[A-Z_]+$/.test(error.message)?error.message:'PROVIDER_VERIFICATION_FAILED');process.exitCode=1;}
