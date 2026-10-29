import { expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

it('supports the selected password work factor inside workerd', async () => {
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-19',script:`
    import {scrypt} from 'node:crypto';
    export default {async fetch(){
      const key=await new Promise((resolve,reject)=>scrypt('test-password','test-salt',32,{N:16384,r:8,p:5,maxmem:33554432},(err,key)=>err?reject(err):resolve(key)));
      return Response.json({bytes:key.length});
    }}
  `}));
  try { const response=await mf.dispatchFetch('https://runtime.test'); expect(response.status).toBe(200); expect(await response.json()).toEqual({bytes:32}); }
  finally {await mf.dispose();}
},30000);
