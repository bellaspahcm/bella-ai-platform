const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
async function main(){
  const browser=await chromium.launch({headless:true});const context=await browser.newContext();
  const blocked=[];
  await context.route('**/*',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.request().method())){blocked.push({path:new URL(r.request().url()).pathname,method:r.request().method()});return r.abort('blockedbyclient');}return r.continue();});
  const page=await context.newPage();const api=[];
  page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/education/portal/'))api.push({status:r.status(),path:new URL(r.url()).pathname.replace('audit-invalid-token','[invalid-token]')});});
  const res=await page.goto('http://localhost:3000/portal/education/audit-invalid-token',{waitUntil:'networkidle',timeout:45000});
  const ui=await page.evaluate(()=>({headings:[...document.querySelectorAll('h1,h2')].map(e=>e.textContent?.trim()),errorVisible:/không hợp lệ|hết hạn|invalid|lỗi/i.test(document.body.innerText)}));
  const direct=await fetch('http://localhost:3000/api/education/portal/audit-invalid-token',{signal:AbortSignal.timeout(15000)});const data=await direct.json();
  const report={checkedAt:new Date().toISOString(),route:'/portal/education/[invalid-token]',httpStatus:res.status(),ui,api,directInvalidToken:{status:direct.status,errorCategory:typeof data.error==='string'?data.error.split(':')[0]:null},blocked,scope:'Invalid token only; no valid portal payload GET because the service can create a chat thread during aggregation; no token issued, business data fetched or changed'};
  fs.writeFileSync(path.join(__dirname,'browser-portal.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await context.close();await browser.close();
}
main().catch(e=>{console.error(e.name);process.exitCode=1;});
