import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createDashboard} from './server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const [output,id,expected='PASS']=process.argv.slice(2);
if(!['PASS','HELD'].includes(expected)||!path.isAbsolute(output||'')||!/^bella-agent-flow-[A-Za-z0-9]{1,32}$/.test(id||''))throw Error('ABSOLUTE_OUTPUT_AND_PACKAGE_REQUIRED');
await mkdir(output,{recursive:true});let app,browser;
try{
  app=await createDashboard({root:path.join(os.homedir(),'.codex','agent-flow-evidence')});
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1500,height:1100}}),page=await context.newPage(),errors=[];
  page.on('pageerror',()=>errors.push('PAGE_ERROR'));
  await page.goto(app.url);await page.waitForFunction(()=>document.querySelector('#packages').children.length>0&&!document.querySelector('#refresh').disabled,{},{timeout:60000});
  const select=async()=>{await page.getByRole('button',{name:new RegExp('Run · '+id.replace('bella-agent-flow-',''))}).click();await page.locator('#notice').filter({hasText:'MATCH_RETAINED_SOURCES'}).waitFor({timeout:60000});};
  await select();const data=await (await page.request.get(app.origin+'/api/packages/'+id)).json();
  assert.equal(data.state,'AVAILABLE');assert.equal(data.executionOutcome,expected);assert.equal(data.validation,'MATCH_RETAINED_SOURCES');if(expected==='PASS'){assert.ok([4,7].includes(data.stages.length));assert.equal(data.commit?.matches,true);}else assert.equal(data.commit,null);
  if(expected==='PASS')assert.deepEqual(data.stages.slice(0,4).map(s=>s.activity),['PLAN','CODE_CHANGE','TEST_EXECUTION','INDEPENDENT_REVIEW']);
  for(const value of [data.taskId,data.factoryRunId,...(data.commit?[data.commit.sha]:[]),...data.stages.flatMap(s=>[s.binding.runId,s.binding.threadId,s.binding.turnId])])assert.ok(await page.getByText(value,{exact:true}).count()>0);
  if(expected==='PASS'){const verify=data.stages.at(-2);assert.equal(verify.test.exitCode,0);assert.equal(verify.test.counters.pass,verify.test.counters.tests);}assert.equal(new URL(page.url()).hash,'');
  for(const [label,width,height] of [['desktop',1500,1100],['mobile',390,844]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(output,'factory-'+label+'.png'),fullPage:true});}
  await page.getByRole('button',{name:'Làm mới'}).click();await page.waitForFunction(()=>document.querySelector('#packages').children.length>0&&!document.querySelector('#refresh').disabled,{},{timeout:60000});assert.ok(await page.getByText(data.factoryRunId,{exact:true}).count()>0);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#packages').children.length>0&&!document.querySelector('#refresh').disabled,{},{timeout:60000});await select();assert.ok(await page.getByText(data.factoryRunId,{exact:true}).count()>0);
  const anonymous=await browser.newContext();assert.equal((await anonymous.request.get(app.origin+'/api/packages')).status(),401);await anonymous.close();assert.equal((await page.request.post(app.origin+'/api/packages/'+id,{data:{}})).status(),405);assert.deepEqual(errors,[]);
  const report={status:expected==='PASS'?'PASS_SAME_RUN_MONITOR_BROWSER':'PASS_HELD_SAME_RUN_MONITOR_BROWSER',checkedAt:new Date().toISOString(),packageId:id,taskId:data.taskId,factoryRunId:data.factoryRunId,commit:data.commit,stages:data.stages,artifacts:data.artifacts,expiresAt:data.expiresAt,desktop:'1500x1100',mobile:'390x844',horizontalOverflow:false,refresh:'PASS',reloadSameRun:'PASS',anonymousStatus:401,writeMethodStatus:405,pageErrors:errors,scope:'Read-only retained evidence; no native query or store operation.'};
  await writeFile(path.join(output,'factory-browser-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,packageId:id,taskId:data.taskId,factoryRunId:data.factoryRunId,commit:data.commit?.sha,stages:data.stages.length,artifacts:data.artifacts.length}));
}catch{await writeFile(path.join(output,'factory-browser-failure.json'),JSON.stringify({status:'FAIL_BROWSER_PROOF',diagnostic:'Raw diagnostics omitted to protect browser capability.'}));console.error('FAIL_BROWSER_PROOF');process.exitCode=1;}finally{await browser?.close();await app?.close();}
