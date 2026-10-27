// UI fixture only: compile the unchanged Copilot JSX fragment and real global CSS.
// No Next layout, authentication, API, DB, or production readiness claim.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { gzipSync } = require('node:zlib');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const http = require('node:http');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const ts = require('typescript');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '../../..');
const cache = path.join(root, '.cache/copilot-theme');
fs.mkdirSync(cache, { recursive: true });
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const pageFile = path.join(root, 'src/app/dashboard/education/page.tsx');
const baselineCommit = 'ecfaf23ab06d043c5f2caec38ea67856705b6c26';
const before = execFileSync('git', ['show', baselineCommit + ':src/app/dashboard/education/page.tsx'], { cwd: root, encoding: 'utf8' });
fs.writeFileSync(path.join(cache, 'page.before.tsx'), before);
const after = fs.readFileSync(pageFile, 'utf8');
const phase = process.argv[2];
assert.ok(['before', 'after'].includes(phase));
// Compare the entire page AST after removing presentation attributes only.
function withoutClasses(source) {
  source = source.replace(/\r\n/g, '\n');
  const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result = ts.transform(tree, [context => function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(tree) === 'className') return undefined;
    return ts.visitEachChild(node, visit, context);
  }]);
  const output = ts.createPrinter({ removeComments: true }).printFile(result.transformed[0]);
  result.dispose(); return output.replace(/[ \t]+$/gm, '');
}
assert.equal(withoutClasses(after), withoutClasses(before), 'Only className attributes may change');
const fragment = source => source.slice(source.indexOf('      <div', source.indexOf('{/* ── 2.3 EXECUTIVE')), source.indexOf('      {/* ── 2.5 LAYER'));
const source = phase === 'before' ? before : after;
const brief = { generatedAt: '2026-10-21T01:00:00Z', executiveSummary: 'Tổng hợp tình hình toàn trường từ dữ liệu minh họa.', actionableRecommendations: ['Kiểm tra lớp có cảnh báo và trao đổi với giáo viên.'], criticalAlerts: ['Lớp minh họa cần theo dõi sức khỏe.'] };
const compliance = { complianceScore: 82, compliant: false, inspectedClassesCount: 6, violations: ['Một lớp minh họa cần rà soát sĩ số.'], warnings: ['Cần kiểm tra tỷ lệ giáo viên.'] };
const entry = `import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
import {Sparkles,Loader2,FileText,ShieldAlert,CheckCircle,ShieldCheck,Send} from 'lucide-react';
import {resolveDynamicThemeTokens,TENANT_BRAND_STYLE_PRESETS} from './src/lib/business-rules/tenant-modules';
window.themeCases=TENANT_BRAND_STYLE_PRESETS.map(stylePreset=>({name:stylePreset,tokens:resolveDynamicThemeTokens({stylePreset})}));
window.themeCases.push(...[{name:'custom-dark',primaryColor:'#5B217A'},{name:'custom-light',primaryColor:'#FFD54F'}].map(c=>({name:c.name,tokens:resolveDynamicThemeTokens(c)})));
function Fixture({scenario}) {
const [activeCopilotTab,setActiveCopilotTab]=useState(scenario.tab),[executiveQuestion,setExecutiveQuestion]=useState('');
const totalKidsCount=186,presentCount=172,attendanceRate=92,healthIncidents=2;
const isAiBriefingLoading=!!scenario.loading,isComplianceAuditLoading=!!scenario.loading,isExecutiveAsking=!!scenario.loading;
const executiveBriefing=scenario.result?{...${JSON.stringify(brief)},criticalAlerts:scenario.success?[]:${JSON.stringify(brief.criticalAlerts)}}:null;
const complianceResult=scenario.result?{...${JSON.stringify(compliance)},compliant:!!scenario.success,violations:scenario.success?[]:${JSON.stringify(compliance.violations)},warnings:scenario.success?[]:${JSON.stringify(compliance.warnings)}}:null;
const executiveQnAMessages=[{id:'ai',sender:'copilot',text:'Tôi có thể hỗ trợ rà soát dữ liệu quản trị mầm non.',time:'08:00'},{id:'user',sender:'user',text:'Cho tôi xem tình hình hôm nay.',time:'08:01'}];
const handleGenerateBriefing=()=>{},handleRunComplianceAudit=()=>{},handleSendExecutiveQuestion=()=>{};
return <main className="preschool-ui p-4 font-sans">${fragment(source)}</main>; }
const mount=createRoot(document.getElementById('root'));let seq=0;window.renderCase=scenario=>mount.render(<Fixture key={++seq} scenario={scenario}/>);`;

async function measure(page) {
  await page.mouse.move(0, 0);
  const values = await page.locator('main > div').evaluate(element => {
    const origin = element.getBoundingClientRect();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = css => { ctx.clearRect(0,0,1,1); ctx.fillStyle=css; ctx.fillRect(0,0,1,1); return [...ctx.getImageData(0,0,1,1).data]; };
    const rows = []; const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node=walker.currentNode, parent=node.parentElement;
      if (!node.textContent.trim()) continue;
      const style=getComputedStyle(parent), range=document.createRange(); range.selectNodeContents(node);
      const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>({x:r.x-origin.x,y:r.y-origin.y,width:r.width,height:r.height}));
      if (!rects.length || style.visibility==='hidden') continue;
      let opacity=1; for(let p=parent;p;p=p.parentElement) opacity*=Number(getComputedStyle(p).opacity);
      rows.push({label:node.textContent.trim(),rgba:rgba(style.color),opacity,rects});
    }
    const input=element.querySelector('input');
    if(input) {
      const style=getComputedStyle(input,input.value?'':'::placeholder'),box=input.getBoundingClientRect(),base=getComputedStyle(input);
      rows.push({label:input.value||'input-placeholder',rgba:rgba(style.color),opacity:Number(style.opacity),rects:[{x:box.x-origin.x+parseFloat(base.paddingLeft),y:box.y-origin.y+parseFloat(base.paddingTop),width:Math.min(100,box.width/2),height:parseFloat(base.fontSize)}]});
    }
    return rows;
  });
  const hide = await page.addStyleTag({content:'main > div, main > div * { -webkit-text-fill-color: transparent !important; } main input::placeholder { -webkit-text-fill-color: transparent !important; }'});
  const png=await page.locator('main > div').screenshot({animations:'disabled'});
  await hide.evaluate(node=>node.remove());
  return page.evaluate(async ({png,values})=> {
    const img=new Image();img.src='data:image/png;base64,'+png;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,img.width,img.height).data;
    const lum=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    return values.map(row=>{let minimum=Infinity,samples=0;for(const r of row.rects)for(let y=Math.max(0,Math.ceil(r.y));y<Math.min(img.height,r.y+r.height);y++)for(let x=Math.max(0,Math.ceil(r.x));x<Math.min(img.width,r.x+r.width);x++) {
      const offset=(y*img.width+x)*4,bg=[...pixels.slice(offset,offset+3)],alpha=row.rgba[3]/255*row.opacity,fg=bg.map((v,i)=>row.rgba[i]*alpha+v*(1-alpha)),l1=lum(fg),l2=lum(bg);minimum=Math.min(minimum,(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05));samples++;
    }return {label:row.label,ratio:minimum,samples,pass:samples>0&&minimum>=4.5};});
  },{png:png.toString('base64'),values});
}

async function main() {
  const cssPath=path.join(root,'src/app/globals.css');
  // Explicitly include both fragments so BEFORE and AFTER use identical compiled CSS.
  const css=(await postcss([tailwind({base:root})]).process(fs.readFileSync(cssPath,'utf8')+'\n@source "../../.cache/copilot-theme/page.before.tsx";',{from:cssPath})).css;
  const bundle=await esbuild.build({absWorkingDir:root,tsconfigRaw:{},stdin:{contents:entry,resolveDir:root,loader:'tsx'},bundle:true,write:false,minify:true,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
  const html='<!doctype html><html data-tenant-module="bella_education"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'\n:root{--font-sans:Arial,sans-serif} *{animation:none!important;transition:none!important}</style></head><body><div id="root"></div><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script></body></html>';
  const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});const results=[],errors=[],requests=[];
  const scenarios=[{name:'briefing-empty',tab:'briefing'},{name:'briefing-alerts',tab:'briefing',result:true},{name:'briefing-success',tab:'briefing',result:true,success:true},{name:'briefing-loading',tab:'briefing',loading:true},{name:'compliance-empty',tab:'compliance'},{name:'compliance-warnings',tab:'compliance',result:true},{name:'compliance-success',tab:'compliance',result:true,success:true},{name:'compliance-loading',tab:'compliance',loading:true},{name:'qa',tab:'qa'},{name:'qa-loading',tab:'qa',loading:true}];
  try {
    const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>route.request().url()===origin+'/'?route.continue():(requests.push(route.request().url()),route.abort()));
    await page.goto(origin);await page.waitForFunction(()=>window.themeCases);
    for(const color of await page.evaluate(()=>window.themeCases))for(const dark of [false,true])for(const width of [390,1440]) {
      await page.setViewportSize({width,height:1100});await page.evaluate(({color,dark})=>{
        document.documentElement.classList.toggle('dark',dark);document.documentElement.dataset.tenantBrandPreset=color.name;
        for(const [name,key]of Object.entries({primary:'primary','primary-hover':'primaryHover','primary-foreground':'primaryForeground',accent:'accent',ring:'ring'}))document.documentElement.style.setProperty('--'+name,color.tokens[key],'important');
      },{color,dark});
      for(const scenario of scenarios) {
        await page.evaluate(s=>window.renderCase(s),scenario);await page.getByRole('heading',{name:'Trợ lý Điều hành AI — Ban Giám Hiệu'}).waitFor();
        // React may commit the new fixture after the stable heading is already present.
        await page.waitForTimeout(35);
        const text=await measure(page);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
        const interactions=[],styleChecks={};
        if(scenario.name==='qa') {
          const send=page.getByRole('button',{name:'Gửi',exact:true});
          styleChecks.disabled=await send.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el.querySelector('span')).color}));
          await send.hover();
          styleChecks.disabledHover=await send.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el.querySelector('span')).color}));
          await page.locator('input').fill('Rà soát hôm nay');await page.locator('input').focus();
          styleChecks.enabled=await send.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el.querySelector('span')).color}));
          if(phase==='after') {
            assert.deepEqual(styleChecks.disabledHover,styleChecks.disabled,'Disabled Send must keep its neutral appearance on hover');
            assert.notEqual(styleChecks.disabled.background,styleChecks.enabled.background,'Disabled Send must differ from enabled Send');
          }
          interactions.push(...await measure(page));await send.hover();interactions.push(...await measure(page));
        }
        if(scenario.name==='compliance-warnings'&&phase==='after') {
          for(const [label,hue]of [['Một lớp minh họa cần rà soát sĩ số.','rose'],['Cần kiểm tra tỷ lệ giáo viên.','amber']]) {
            styleChecks[hue]=await page.getByText(label,{exact:true}).evaluate((el,{hue,dark})=>{
              const probe=document.createElement('span');probe.style.color=`var(--color-${hue}-${dark?'300':'700'})`;document.body.appendChild(probe);
              const actual=getComputedStyle(el).color,expected=getComputedStyle(probe).color;probe.remove();return {actual,expected};
            },{hue,dark});
            assert.equal(styleChecks[hue].actual,styleChecks[hue].expected,'Status hue must survive the global CSS cascade');
          }
        }
        if(scenario.name==='briefing-empty') {
          const action=page.getByRole('button',{name:'Tạo điểm tin đầu ngày'});await action.hover();interactions.push(...await measure(page));
          await page.getByRole('button',{name:'Rà soát TT52',exact:true}).click();await page.getByText('Kiểm định định mức mầm non (Thông tư 52/2020/TT-BGDĐT)').waitFor();
          await page.getByRole('button',{name:'Hỏi đáp BGH',exact:true}).click();await page.locator('input').waitFor();
        }
        const contrast=[...text,...interactions];
        if(phase==='after') assert.deepEqual(contrast.filter(row=>!row.pass),[],JSON.stringify({preset:color.name,dark,width,scenario:scenario.name}));
        results.push({preset:color.name,dark,width,scenario:scenario.name,overflow,styleChecks,contrast});
        if(phase==='after'&&color.name==='ocean_clean'&&scenario.name==='briefing-alerts') await page.locator('main > div').screenshot({path:path.join(__dirname,`preview-${dark?'dark':'light'}-${width}.png`)});
      }
      console.log(JSON.stringify({preset:color.name,dark,width,cases:scenarios.length}));
    }
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
  const rows=results.flatMap(r=>r.contrast),failed=rows.filter(r=>!r.pass),overflows=results.filter(r=>r.overflow);
  const summary={phase,result:failed.length||overflows.length||errors.length||requests.length?'FAIL':'PASS',cases:results.length,measurements:rows.length,failed:failed.length,minimumRatio:Math.min(...rows.map(r=>r.ratio)),overflows:overflows.length,pageErrors:errors,unexpectedRequests:requests,astPreservation:'PASS'};
  const receipt={summary,sourceSha256:hash(source),globalsSha256:hash(fs.readFileSync(cssPath)),cssSha256:hash(css),harnessSha256:hash(fs.readFileSync(__filename)),limits:'Actual Copilot JSX fragment + globals.css; synthetic states/handlers; six resolved presets + two custom examples, light/dark, desktop/mobile. Arial fallback without Next font/layout. Native raster background, CSS-to-sRGB foreground, raw WCAG ratio >= 4.5 for all text sizes. No full Next route/Auth/API/DB/production proof.'};
  const detailsFile=phase+'.details.json.gz',details=gzipSync(JSON.stringify({...receipt,results}));
  fs.writeFileSync(path.join(__dirname,detailsFile),details);
  fs.writeFileSync(path.join(__dirname,phase+'.json'),JSON.stringify({...receipt,details:{file:detailsFile,sha256:hash(details),encoding:'gzip'}},null,2)+'\n');
  console.log(JSON.stringify(summary));process.exitCode=summary.result==='PASS'?0:1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
