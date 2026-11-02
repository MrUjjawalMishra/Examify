import {it,expect,vi} from 'vitest';
import {NvidiaAI,NVIDIA_MODEL} from '../src/nvidia-ai';
const reply=(value:unknown)=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}],usage:{prompt_tokens:20,completion_tokens:10}}));
it('validates real-provider-shaped question output and preserves mandatory review',async()=>{
 const transport=vi.fn(async()=>reply({questions:[{prompt:'Explain phishing',kind:'written',marks:2,rubric:'Explain impersonation.'}]}));
 const result=await new NvidiaAI('test-only',transport).convert('Explain phishing.','Safety');
 expect(result.requiresTeacherApproval).toBe(true);expect(result.questions).toHaveLength(1);expect(result.usage.promptTokens).toBe(20);
 const options=transport.mock.calls[0] as unknown as [string,RequestInit];expect(options[0]).toBe('https://integrate.api.nvidia.com/v1/chat/completions');expect(JSON.parse(String(options[1].body)).model).toBe(NVIDIA_MODEL);expect(options[1].redirect).toBe('manual');
});
it('rejects quota errors and redirects without inventing fallback content',async()=>{
 for(const status of [402,429,302,500])await expect(new NvidiaAI('test-only',async()=>new Response('',{status})).convert('Source','Subject')).rejects.toThrow(status===402||status===429?'AI_QUOTA_UNAVAILABLE':'AI_PROVIDER_UNAVAILABLE');
});
it('rejects malformed and out-of-range scores and returns only provisional suggestions',async()=>{
 await expect(new NvidiaAI('test-only',async()=>reply({units:501,feedback:'Good'})).suggestGrade('Question','Rubric','Answer',500)).rejects.toThrow('AI_INVALID_RESPONSE');
 const result=await new NvidiaAI('test-only',async()=>reply({units:250,feedback:'Needs explanation',confirmed:true})).suggestGrade('Question','Rubric','Answer',500);expect(result.suggestion).toEqual({units:250,feedback:'Needs explanation',requiresTeacherApproval:true});
 await expect(new NvidiaAI('',async()=>reply({})).convert('Source','Subject')).rejects.toThrow('AI_NOT_CONFIGURED');
});
