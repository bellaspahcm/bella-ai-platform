const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const {chromium} = require('@playwright/test');
const http = require('node:http');
const root = path.resolve(__dirname, '../../..');
const hash = v => crypto.createHash('sha256').update(v).digest('hex');
process.env.TEMP = process.env.TMP = path.join(__dirname,'.cache/tmp');
async function main() {
  const cachePath = path.join(__dirname, '.cache');
  fs.mkdirSync(cachePath, { recursive: true });
  const cssPath = path.join(root, 'src/app/globals.css');
  const css = (await postcss([tailwind({ base: root })]).process(fs.readFileSync(cssPath, 'utf8'), { from: cssPath })).css;
  const pagePath = 'src/app/dashboard/education/grades/page.tsx';
  const built = await esbuild.build({
    absWorkingDir: root, tsconfigRaw: {},
    stdin: { contents: "import React from 'react'; import {createRoot} from 'react-dom/client'; import Page from './" + pagePath + "'; createRoot(document.getElementById('root')).render(<Page/>); document.getElementById('theme-toggle').onclick=()=>document.documentElement.classList.toggle('dark');", resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, minify: true, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'bounded-local-resolution', setup(build) {
      // Node resolves the installed dependency junction without esbuild scanning denied ancestors.
      build.onResolve({ filter: /.*/ }, args => {
        if (/^next\/(link|image)$|dashboard-client-context$/.test(args.path)) return;
        const request = args.path.startsWith('@/') ? path.join(root, 'src', args.path.slice(2)) : args.path.startsWith('.') ? path.resolve(args.resolveDir || root, args.path) : args.path;
        const local = path.isAbsolute(request) ? [request, request+'.ts', request+'.tsx', path.join(request,'index.ts'), path.join(request,'index.tsx')].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile()) : null; return { path: local || require.resolve(request, { paths: [args.resolveDir || root] }), namespace: 'local-file' };
      });
      build.onLoad({ filter: /.*/, namespace: 'local-file' }, args => ({
        contents: fs.readFileSync(args.path, 'utf8'),
        loader: args.path.endsWith('.tsx') ? 'tsx' : args.path.endsWith('.ts') ? 'ts' : args.path.endsWith('.json') ? 'json' : 'js',
        resolveDir: path.dirname(args.path),
      }));
    } }, { name: 'synthetic-presentation-boundaries', setup(build) {
      build.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'synthetic' }));
      build.onResolve({ filter: /^next\/image$/ }, () => ({ path: 'image', namespace: 'synthetic' }));
      build.onResolve({ filter: /dashboard-client-context$/ }, () => ({ path: 'tenant', namespace: 'synthetic' }));
      build.onLoad({ filter: /.*/, namespace: 'synthetic' }, args => ({ contents: args.path === 'tenant'
        ? 'export async function getCachedTenantSettings(){return null;}'
        : args.path === 'image'
          ? "import React from 'react'; export default function Image({alt,width,height,className}){return React.createElement('span',{'role':'img','aria-label':alt,style:{width,height,display:'inline-block',background:'#cbd5e1'},className});}"
          : "import React from 'react'; export default function Link({children,...props}){return React.createElement('a',{...props,href:'#',onClick:e=>e.preventDefault()},children);}", loader: 'js', resolveDir: root }));
    } }],
  });
  const js = built.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const jsHash = crypto.createHash('sha256').update(js).digest('base64');
  const csp = "default-src 'none'; script-src 'sha256-" + jsHash + "'; style-src 'unsafe-inline'; connect-src 'none'; img-src data:; font-src 'none'; base-uri 'none'; form-action 'none'";
  const html = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="' + csp + '"><title>Preschool — thử giao diện báo cáo bằng dữ liệu minh họa</title><style>' + css + '</style></head><body><button id="theme-toggle" type="button" class="m-4 rounded-xl bg-slate-800 px-4 py-2 text-sm text-white">Đổi sáng / tối</button><div id="root"></div><script>' + js + '</script></body></html>';
  fs.writeFileSync(path.join(cachePath, 'preview.html'), html);
  const server = http.createServer((request, response) => {
    if (request.url !== '/') { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': csp }); response.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;


  const phase=process.argv[2]; assert.ok(['before','after'].includes(phase));
  const results=[]; let browser;
  try {
    browser=await chromium.launch({headless:true,executablePath:path.join(__dirname,'.cache/browser/chrome-headless-shell-win64/chrome-headless-shell.exe')});
    for(const theme of ['light','dark']) for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
      for(let j=1;j<=7;j++) {
        const result={journey:'J'+j,theme,device,viewport:{width,height},assertions:[],pageErrors:[],unexpectedRequests:[],downloads:[]};results.push(result);
        const context=await browser.newContext({viewport:{width,height},colorScheme:theme});
        try {
          const page=await context.newPage();page.setDefaultTimeout(2500);
          page.on('pageerror',e=>result.pageErrors.push(e.message));page.on('download',d=>result.downloads.push(d.suggestedFilename()));
          await page.route('**/*',route=>{if(route.request().url()===origin+'/')return route.continue();result.unexpectedRequests.push(route.request().url());return route.abort();});
          const settle=()=>page.waitForTimeout(180);
          const check=async(name,fn)=>{try{await fn();result.assertions.push({name,result:'PASS'});}catch(e){if(e.code!=='ERR_ASSERTION')throw e;result.assertions.push({name,result:'FAIL',failure:e.message});}};
          await page.goto(origin+'/');if(theme==='dark')await page.locator('#theme-toggle').click();
          const dialog=page.getByRole('dialog');
          const global=page.getByRole('button',{name:'Nhập quan sát mới',exact:true});
          const search=page.getByPlaceholder('Tìm tên trẻ, lớp...');
          const cls=page.getByLabel('Lọc theo lớp học',{exact:true}), status=page.getByLabel('Lọc theo trạng thái hồ sơ',{exact:true});
          const opener=page.getByRole('button',{name:'Xem hồ sơ minh họa Trần Bảo Ngọc',exact:true});
          const open=async trigger=>{await trigger.focus();await trigger.press('Enter');await settle();assert.equal(await dialog.count(),1);};
          const inside=async()=>assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);
          const returned=async trigger=>assert.equal(await trigger.evaluate(el=>el===document.activeElement&&el.isConnected&&!el.disabled),true);
          const closed=async()=>assert.equal(await dialog.count(),0);
          const escape=async trigger=>{await page.keyboard.press('Escape');await settle();await check('Escape dismisses dialog',closed);if(await dialog.count()===0)await check('Focus restores usable opener',()=>returned(trigger));};
          const recover=async()=>{if(await dialog.count())await dialog.getByRole('button',{name:/^(Đóng|Đóng nhập quan sát|Đóng gợi ý minh họa)$/}).last().click();await settle();};
          const filter=async()=>{await cls.selectOption('CHOI_B1');await status.selectOption('SUPPLEMENT');await search.fill('Trần Bảo Ngọc');await page.getByRole('checkbox',{name:'Chọn học sinh Trần Bảo Ngọc',exact:true}).check();};
          const retained=async()=>{assert.equal(await cls.inputValue(),'CHOI_B1');assert.equal(await status.inputValue(),'SUPPLEMENT');assert.equal(await search.inputValue(),'Trần Bảo Ngọc');assert.equal(await page.locator('tbody tr').count(),1);assert.equal(await page.getByRole('checkbox',{name:'Chọn học sinh Trần Bảo Ngọc',exact:true}).isChecked(),true);};
          const loop=async()=>{
            const controls=dialog.locator('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]').filter({visible:true});
            assert.ok(await controls.count()>0);
            await controls.first().focus();await page.keyboard.press('Shift+Tab');await settle();await check('Shift+Tab at first stays inside',inside);
            await controls.last().focus();await page.keyboard.press('Tab');await settle();await check('Tab at last stays inside',inside);
          };
          const fields=['student','domain','progression','skill','note','photos'];
          const values=async()=>Promise.all(fields.map(f=>page.locator('#new-observation-'+f).inputValue()));
          const fill=async()=>{await page.locator('#new-observation-student').selectOption({index:2});await page.locator('#new-observation-domain').selectOption({index:0});await page.locator('#new-observation-progression').selectOption({index:1});await page.locator('#new-observation-skill').fill('SYNTHETIC skill');await page.locator('#new-observation-note').fill('SYNTHETIC observation');await page.locator('#new-observation-photos').fill('3');return values();};
          if(j===1||j===2){
            await filter();await open(opener);await check('Initial focus enters profile',inside);
            await check('Correct child profile',async()=>{assert.match(await dialog.innerText(),/Trần Bảo Ngọc/);assert.match(await dialog.innerText(),/Chồi B1/);assert.doesNotMatch(await dialog.innerText(),/Nguyễn Minh An/);});
            if(j===1){await dialog.getByRole('button',{name:'Đóng',exact:true}).click();await settle();await check('Visible close dismisses',closed);await check('Exact row opener restored',()=>returned(opener));}
            else {await loop();await escape(opener);}
            await recover();await check('Filters and selection retained',retained);
          }else if(j===3){
            await open(global);await check('Initial focus enters observation',inside);const draft=await fill();await escape(global);await recover();await open(global);await check('Every draft value retained after Escape',async()=>assert.deepEqual(await values(),draft));await recover();await check('Global opener restored',()=>returned(global));await check('No new sample row',async()=>assert.equal(await page.locator('tbody tr').count(),8));
          }else if(j===4){
            await search.fill('Trần Bảo Ngọc');const month=await page.getByLabel('Chọn tháng đánh giá').inputValue();await open(global);await loop();
            const skill=page.locator('#new-observation-skill'), note=page.locator('#new-observation-note');
            await skill.fill('abc');await skill.press('End');await skill.press('Space');await skill.press('x');await skill.press('ArrowLeft');await skill.press('Shift+ArrowLeft');await skill.press('z');
            await check('Input space and cursor selection work',async()=>assert.equal(await skill.inputValue(),'abczx'));
            await note.fill('line');await note.press('End');await note.press('Enter');await note.press('Space');await note.press('x');await check('Textarea newline and space work',async()=>assert.equal(await note.inputValue(),'line\n x'));
            await escape(global);await recover();await check('Background values unchanged',async()=>{assert.equal(await search.inputValue(),'Trần Bảo Ngọc');assert.equal(await page.getByLabel('Chọn tháng đánh giá').inputValue(),month);});
          }else if(j===5){
            await filter();await open(global);const defaults=await values();await recover();await open(opener);const action=dialog.getByRole('button',{name:'Thêm quan sát mới',exact:true});await action.focus();await action.press('Enter');await settle();
            await check('Exactly one observation dialog',async()=>{assert.equal(await dialog.count(),1);assert.match(await dialog.innerText(),/Nhập quan sát sư phạm mới/);});await check('Transition focus enters observation',inside);await check('Preview draft not retargeted',async()=>assert.deepEqual(await values(),defaults));await escape(global);await recover();await check('Selection/filter retained',retained);
          }else if(j===6){
            const ai=page.getByRole('button',{name:/Gợi ý AI sư phạm minh họa Nội dung mẫu/});await open(ai);await check('Initial focus enters AI sample',inside);await check('Honest sample disclaimer retained',async()=>assert.match(await dialog.innerText(),/Chưa có phân tích AI.*hồ sơ thật/));await loop();await escape(ai);
          }else{
            await open(global);const draft=await fill();await dialog.getByRole('button',{name:'Đóng và giữ bản nháp',exact:true}).click();await settle();await check('Explicit close dismisses',closed);await open(global);await check('Explicit close retains every draft value',async()=>assert.deepEqual(await values(),draft));await dialog.getByRole('button',{name:'Lưu quan sát',exact:true}).click();await check('Save honestly unavailable',async()=>assert.match(await dialog.getByRole('status').innerText(),/Chưa lưu quan sát: chức năng lưu chưa khả dụng/));await check('Save retains dialog and exact draft',async()=>{assert.equal(await dialog.count(),1);assert.deepEqual(await values(),draft);});await check('No new sample record',async()=>assert.equal(await page.locator('tbody tr').count(),8));
            if(phase==='after')await page.screenshot({path:path.join(__dirname,'keyboard-'+theme+'-'+device+'.png'),animations:'disabled'});
          }
        }catch(e){result.assertions.push({name:'Harness/runtime error',result:'ERROR',failure:e.stack});}finally{await context.close();}
        result.result=result.assertions.some(a=>a.result==='ERROR')?'ERROR':result.assertions.some(a=>a.result==='FAIL')?'FAIL':'PASS';
      }
    }
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
  const summary={checked:results.length,passed:results.filter(r=>r.result==='PASS').length,failed:results.filter(r=>r.result==='FAIL').length,errors:results.filter(r=>r.result==='ERROR').length,pageErrors:results.flatMap(r=>r.pageErrors).length,unexpectedRequests:results.flatMap(r=>r.unexpectedRequests).length,downloads:results.flatMap(r=>r.downloads).length};
  const pass=summary.passed===28&&summary.errors===0&&summary.pageErrors===0&&summary.unexpectedRequests===0&&summary.downloads===0;
  const command='node docs/audits/preschool-dialog-journey-flow/dialog-browser.cjs '+phase;
  const receipt={phase,recordedAt:new Date().toISOString(),command,commandSha256:hash(command),exitCode:pass?0:1,summary,sourceSha256:hash(fs.readFileSync(path.join(root,pagePath))),testSha256:hash(fs.readFileSync(__filename)),globalsSha256:hash(fs.readFileSync(cssPath)),compiledCssSha256:hash(css),bundleSha256:hash(js),limits:'Actual Grades and shared modal code with real globals; synthetic Next link/image and tenant only. Loopback CSP; fresh browser context per journey; finally cleanup. No Auth/DB/full Next proof. Contrast NOT_APPLICABLE.',results};
  fs.writeFileSync(path.join(__dirname,'native-'+phase+'.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({phase,...summary}));process.exitCode=receipt.exitCode;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
