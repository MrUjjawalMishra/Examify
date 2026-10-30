import {createHmac,createHash} from 'node:crypto';

export interface ManagedAuthConfig {AUTH_MODE?:'supabase';SUPABASE_URL?:string;SUPABASE_ADMIN_KEY?:string;AUTH_PASSWORD_PEPPER?:string}
export interface AuthIdentity {id:string;scope:string}
type User={id:string;email?:string;app_metadata?:Record<string,unknown>};
/** Only provider password processing is external. No provider token grants Examify access. */
export class ManagedAuth {
 private readonly origin:string;
 constructor(private readonly config:ManagedAuthConfig,private readonly transport:typeof fetch=fetch){
  const url=new URL(config.SUPABASE_URL??'https://unconfigured.invalid');
  if(url.protocol!=='https:'||! /^[a-z0-9]+\.supabase\.co$/.test(url.hostname)||url.pathname!=='/'||url.search||url.hash||url.username||url.password||!config.SUPABASE_ADMIN_KEY||!config.AUTH_PASSWORD_PEPPER||config.AUTH_PASSWORD_PEPPER.length<64)throw Error('AUTH_PROVIDER_UNCONFIGURED');
  this.origin=url.origin;
 }
 email(identity:AuthIdentity){this.validate(identity);return `${identity.id}@accounts.examify.invalid`;}
 private validate(identity:AuthIdentity){if(!/^[a-f0-9-]{36}$/.test(identity.id)||!identity.scope)throw Error('INVALID_AUTH_IDENTITY');}
 private password(identity:AuthIdentity,password:string){
  this.validate(identity);if(!password||Buffer.byteLength(password)>256)throw Error('INVALID_PASSWORD');
  // Keyed prehash preserves short classroom passwords and avoids bcrypt truncation.
  // This value is never persisted: Supabase stores its salted bcrypt hash.
  return 'Ex!9'+createHmac('sha256',this.config.AUTH_PASSWORD_PEPPER!).update(JSON.stringify(['examify-password-v1',identity.scope,identity.id,password])).digest('hex');
 }
 fingerprint(identity:AuthIdentity,password:string){return createHash('sha256').update(this.password(identity,password)).digest('hex');}
 initialPassword(identity:AuthIdentity){this.validate(identity);return 'T!'+createHmac('sha256',this.config.AUTH_PASSWORD_PEPPER!).update(JSON.stringify(['examify-initial-v1',identity.scope,identity.id])).digest('hex').slice(0,24);}
 private async request(path:string,method:string,data?:unknown):Promise<{status:number;data:Record<string,unknown>}>{
  const headers:Record<string,string>={apikey:this.config.SUPABASE_ADMIN_KEY!,'Content-Type':'application/json','User-Agent':'Examify-Server/1.0'};
  if(this.config.SUPABASE_ADMIN_KEY!.startsWith('eyJ'))headers.Authorization='Bearer '+this.config.SUPABASE_ADMIN_KEY!;
  let response:Response;
  try{response=await this.transport(this.origin+'/auth/v1'+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data),redirect:'error',signal:AbortSignal.timeout(8000)});}catch{throw Error('AUTH_PROVIDER_UNAVAILABLE');}
  if(response.status===429)throw Error('AUTH_PROVIDER_QUOTA');
  if(response.status>=500)throw Error('AUTH_PROVIDER_UNAVAILABLE');
  // Bound upstream responses and never surface provider text, tokens or secrets.
  const reader=response.body?.getReader();const chunks:Uint8Array[]=[];let length=0;
  if(reader)try{for(;;){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>65536){await reader.cancel();throw Error('AUTH_PROVIDER_RESPONSE');}chunks.push(next.value);}}finally{reader.releaseLock();}
  let parsed:Record<string,unknown>;try{const value:unknown=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();parsed=value as Record<string,unknown>;}catch{throw Error('AUTH_PROVIDER_RESPONSE');}
  return {status:response.status,data:parsed};
 }
 private matches(value:unknown,identity:AuthIdentity){if(!value||typeof value!=='object'||Array.isArray(value))return false;const user=value as User;return user.id===identity.id&&user.email===this.email(identity)&&user.app_metadata?.examify_scope===identity.scope;}
 async verify(identity:AuthIdentity,password:string):Promise<boolean>{
  const response=await this.request('/token?grant_type=password','POST',{email:this.email(identity),password:this.password(identity,password)});
  if(response.status===400||response.status===401||response.status===422)return false;
  if(response.status!==200)throw Error('AUTH_PROVIDER_REJECTED');
  // The TLS response from the configured provider is verified against the D1 identity.
  // Access/refresh tokens are deliberately discarded, never forwarded to the browser.
  return this.matches(response.data.user,identity);
 }
 async ensure(identity:AuthIdentity,password:string):Promise<void>{
  const found=await this.request('/admin/users/'+identity.id,'GET');
  if(found.status===200){if(!this.matches(found.data as unknown as User,identity))throw Error('AUTH_IDENTITY_CONFLICT');return;}
  if(found.status!==404)throw Error('AUTH_PROVIDER_REJECTED');
  const created=await this.request('/admin/users','POST',{id:identity.id,email:this.email(identity),password:this.password(identity,password),email_confirm:true,app_metadata:{examify_scope:identity.scope}});
  if(created.status===200||created.status===201){if(!this.matches(created.data as unknown as User,identity))throw Error('AUTH_IDENTITY_CONFLICT');return;}
  // A timed-out or concurrent create is reconciled by immutable provider ID.
  if(created.status===422){const again=await this.request('/admin/users/'+identity.id,'GET');if(again.status===200&&this.matches(again.data as unknown as User,identity))return;}
  throw Error('AUTH_PROVIDER_REJECTED');
 }
 async change(identity:AuthIdentity,password:string):Promise<void>{
  const found=await this.request('/admin/users/'+identity.id,'GET');
  if(found.status!==200||!this.matches(found.data as unknown as User,identity))throw Error('AUTH_IDENTITY_CONFLICT');
  const updated=await this.request('/admin/users/'+identity.id,'PUT',{password:this.password(identity,password)});
  if(updated.status!==200||!this.matches(updated.data as unknown as User,identity))throw Error('AUTH_PROVIDER_REJECTED');
 }
}

export function provisioningId(scope:string,actor:string,requestId:string){
 const hex=createHash('sha256').update(JSON.stringify(['examify-account-v1',scope,actor,requestId])).digest('hex');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
