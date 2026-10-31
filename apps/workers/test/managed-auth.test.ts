import {expect,it} from 'vitest';
import {ManagedAuth,provisioningId} from '../src/managed-auth';
const config={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ADMIN_KEY:'test-key',AUTH_PASSWORD_PEPPER:'f'.repeat(64)};
const identity={id:provisioningId('school-a','teacher','request'),scope:'school-a'};
it('rejects provider redirects without forwarding credentials',async()=>{
 const auth=new ManagedAuth(config,async(_url,init)=>{
  expect(init?.redirect).toBe('manual');
  return new Response(null,{status:302,headers:{Location:'https://other.invalid'}});
 });
 await expect(auth.verify(identity,'password')).rejects.toThrow('AUTH_PROVIDER_REDIRECT');
});
it('does not bind the Workers global fetch function to the adapter instance',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=function(this:unknown){
   expect(this).not.toBeInstanceOf(ManagedAuth);
   return Promise.resolve(Response.json({user:{id:identity.id,email:identity.id+'@accounts.examify.invalid',app_metadata:{examify_scope:identity.scope}}}));
  };
  expect(await new ManagedAuth(config).verify(identity,'password')).toBe(true);
 }finally{globalThis.fetch=original;}
});
it('uses server headers and reserves Bearer authorization for legacy JWT keys',async()=>{
 for(const key of ['sb_secret_test','eyJlegacy']){
  const auth=new ManagedAuth({...config,SUPABASE_ADMIN_KEY:key},async(_url,init)=>{
   const headers=new Headers(init?.headers);
   expect(headers.get('apikey')).toBe(key);
   expect(headers.get('user-agent')).toBe('Examify-Server/1.0');
   expect(headers.get('authorization')).toBe(key.startsWith('eyJ')?'Bearer '+key:null);
   return Response.json({user:{id:identity.id,email:identity.id+'@accounts.examify.invalid',app_metadata:{examify_scope:identity.scope}}});
  });
  expect(await auth.verify(identity,'password')).toBe(true);
 }
});
it('keeps managed identity and password preprocessing scoped to the school',()=>{
 const auth=new ManagedAuth(config);expect(auth.fingerprint(identity,'a.1b1')).not.toBe(auth.fingerprint({...identity,scope:'school-b'},'a.1b1'));
 expect(provisioningId('school-a','teacher','request')).toBe(identity.id);expect(provisioningId('school-b','teacher','request')).not.toBe(identity.id);
});
it('accepts only a provider identity matching the server-selected school',async()=>{
 let sent:Record<string,string>={};
 const transport:typeof fetch=async(_url,init)=>{sent=JSON.parse(String(init?.body));return Response.json({user:{id:identity.id,email:identity.id+'@accounts.examify.invalid',app_metadata:{examify_scope:'school-b'}}});};
 const auth=new ManagedAuth(config,transport);expect(await auth.verify(identity,'a.1b1')).toBe(false);expect(sent.password).toHaveLength(68);expect(sent.password).not.toContain('a.1b1');
});
it('fails closed on quota exhaustion and provider outages without exposing response bodies',async()=>{
 for(const [status,message] of [[429,'AUTH_PROVIDER_QUOTA'],[503,'AUTH_PROVIDER_UNAVAILABLE']] as const){const auth=new ManagedAuth(config,async()=>new Response('private provider details',{status}));await expect(auth.verify(identity,'password')).rejects.toThrow(message);}
});
it('reconciles an already created identity without resetting its password',async()=>{
 const methods:string[]=[];const auth=new ManagedAuth(config,async(_url,init)=>{methods.push(init!.method!);return Response.json({id:identity.id,email:identity.id+'@accounts.examify.invalid',app_metadata:{examify_scope:identity.scope}});});
 await auth.ensure(identity,'password');expect(methods).toEqual(['GET']);
});
it('rejects unconfigured, insecure or arbitrary provider endpoints',()=>{
 expect(()=>new ManagedAuth({...config,SUPABASE_URL:'http://example.supabase.co'})).toThrow();expect(()=>new ManagedAuth({...config,SUPABASE_URL:'https://attacker.test'})).toThrow();
});
it('rejects malformed provider response envelopes without issuing authentication',async()=>{
 for(const value of [null,[],42,'unexpected']){
  const auth=new ManagedAuth(config,async()=>Response.json(value));
  await expect(auth.verify(identity,'password')).rejects.toThrow('AUTH_PROVIDER_RESPONSE');
 }
 for(const user of [null,[],42,'unexpected',{}]){
  const auth=new ManagedAuth(config,async()=>Response.json({user}));
  expect(await auth.verify(identity,'password')).toBe(false);
 }
});
