import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='https://examify-staging.mr-ujjawalmishra.workers.dev';
const c=JSON.parse(await readFile(new URL('../../../.local/staging-credentials.json',import.meta.url),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(20000);
const timeout=setTimeout(()=>{console.error('Paper acceptance exceeded 120 seconds');process.exit(1)},120000);
const checks=[];const record=x=>{checks.push(x);console.log('PASS '+x)};
try{
 await page.goto(origin);await page.getByLabel('Find your school').fill('C8');await page.getByRole('button',{name:'Search',exact:true}).click();await page.locator('select').first().selectOption('C8');
 async function login(username,password){await page.getByLabel('Account ID',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'Sign out'}).waitFor();}
 await login(c.teacher.username,c.teacher.initialPassword);
 const title='Staging fractions '+Date.now();
 await page.getByLabel('Paper title',{exact:true}).fill(title);
 await page.getByLabel('Assigned class and subject').selectOption('0');
 await page.getByLabel('Question text',{exact:true}).fill('What is one half plus one half?');
 for(let i=1;i<=4;i++)await page.getByLabel('Option '+i,{exact:true}).fill(String(i-1));
 await page.getByLabel('Correct option',{exact:true}).selectOption('1');await page.getByLabel('Marks',{exact:true}).fill('2');
 await page.getByRole('button',{name:'Add question',exact:true}).click();
 await page.getByLabel('Question type',{exact:true}).nth(1).selectOption('written');await page.getByLabel('Question text',{exact:true}).nth(1).fill('Explain your reasoning.');await page.getByLabel('Marks',{exact:true}).nth(1).fill('3');await page.getByLabel('Marking criteria',{exact:true}).fill('One mark for common denominators and two for explanation.');
 const saved=page.waitForResponse(r=>r.url()===origin+'/s/C8/api/papers'&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Save question paper',exact:true}).click();const response=await saved;assert.equal(response.status(),201);const paper=await response.json();
 await page.getByRole('status').filter({hasText:'Question paper saved'}).waitFor();record('Teacher created objective and written questions through the browser');
 await page.reload();await page.getByRole('button',{name:'View paper: '+title,exact:true}).click();
 const detail=page.getByRole('region',{name:'Saved paper'});await detail.getByText('1 (correct)',{exact:true}).waitFor();await detail.getByText(/Marking criteria: One mark/).waitFor();record('Paper, answer key and rubric persisted across reload');
 assert.equal((await context.request.get(origin+'/s/ABC/api/papers/'+paper.id)).status(),401);record('Cross-school paper request denied');
 await page.getByRole('button',{name:'Sign out'}).click();await login('test.student.9b3','test.9b3');
 assert.equal((await context.request.get(origin+'/s/C8/api/papers/'+paper.id)).status(),403);assert.equal(await page.getByRole('heading',{name:'Question papers',exact:true}).count(),0);record('Student denied staff answer-key API and interface');
 await mkdir(new URL('../../../test-results/',import.meta.url),{recursive:true});await writeFile(new URL('../../../test-results/staging-papers.json',import.meta.url),JSON.stringify({origin,checkedAt:new Date().toISOString(),checks},null,2));
}catch(e){console.error('Paper acceptance failed: '+e.message.split('\n')[0]);throw e;}finally{clearTimeout(timeout);const shutdown=setTimeout(()=>process.exit(1),10000);await browser.close();clearTimeout(shutdown);}
