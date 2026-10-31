import {it,expect} from 'vitest';
import {buildSync} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {fileURLToPath} from 'node:url';
it('performs managed authentication using the actual workerd fetch implementation',async()=>{
 const script=buildSync({stdin:{contents:`import {ManagedAuth} from './src/managed-auth';export default {async fetch(){try{const auth=new ManagedAuth({SUPABASE_URL:'https://example.supabase.co',SUPABASE_ADMIN_KEY:'sb_secret_test',AUTH_PASSWORD_PEPPER:'f'.repeat(64)});return Response.json({verified:await auth.verify({id:'12345678-1234-5123-a123-123456789012',scope:'test'},'password')});}catch(e){return Response.json({error:e.message});}}}`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,write:false,platform:'node',format:'esm',external:['node:*']}).outputFiles[0].text;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script,compatibilityDate:'2026-10-28',compatibilityFlags:['nodejs_compat'],outboundService:async()=>Response.json({user:{id:'12345678-1234-5123-a123-123456789012',email:'12345678-1234-5123-a123-123456789012@accounts.examify.invalid',app_metadata:{examify_scope:'test'}}})}));
 try{expect(await (await mf.dispatchFetch('https://test/')).json()).toEqual({verified:true});}finally{await mf.dispose();}
});
