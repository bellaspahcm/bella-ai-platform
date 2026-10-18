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
async function measureContrast(page, locator, label) {
  await locator.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.evaluate(() => { for (const animation of document.getAnimations()) { try { animation.finish(); } catch {} } });
  const computed = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    if (style.textShadow !== 'none' || style.webkitTextFillColor !== style.color)
      throw new Error('FAIL: unsupported text shadow or independent text fill');
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = style.color; ctx.fillRect(0, 0, 1, 1);
    const foreground = Array.from(ctx.getImageData(0, 0, 1, 1).data);
    const rect = element.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(element);
    const textRects = Array.from(range.getClientRects()).filter((item) => item.width > 0 && item.height > 0).map((item) => ({ x: item.x - rect.x, y: item.y - rect.y, width: item.width, height: item.height }));
    const layers = []; let opacity = 1;
    for (let node = element; node; node = node.parentElement) {
      const layer = getComputedStyle(node); opacity *= Number(layer.opacity);
      if (Number(layer.opacity) !== 1 || layer.filter !== 'none' || layer.transform !== 'none')
        throw new Error('FAIL: unsupported group opacity, filter or transform');
      layers.push({ tag: node.tagName, backgroundColor: layer.backgroundColor, backgroundImage: layer.backgroundImage, opacity: layer.opacity, mixBlendMode: layer.mixBlendMode });
    }
    if (layers.some((layer) => layer.mixBlendMode !== 'normal')) throw new Error('Contrast method does not support mix-blend-mode');
    return { cssColor: style.color, foreground, textRects, layers, opacity, fontSize: style.fontSize, fontFamily: style.fontFamily, originalStyle: element.getAttribute('style') };
  });
  // Preserve fills, alpha, gradients and backdrop/ancestor compositing; remove text ink only.
  const originalInkStyles = await locator.evaluate((element) => [element, ...element.querySelectorAll('*')].map(node => { const style = node.getAttribute('style'); node.style.setProperty('color', 'transparent', 'important'); node.style.setProperty('-webkit-text-fill-color', 'transparent', 'important'); node.style.setProperty('text-shadow', 'none', 'important'); return style; }));
  const image = await locator.screenshot({ animations: 'disabled' });
  await locator.evaluate((element, originals) => { [element, ...element.querySelectorAll('*')].forEach((node, index) => { const original = originals[index]; if (original === null) node.removeAttribute('style'); else node.setAttribute('style', original); }); }, originalInkStyles);
  const measured = await page.evaluate(async ({ png, values }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, img.width, img.height).data;
    const luminance = (rgb) => rgb.map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    let minimumRatio = Infinity; let worstBackground; let worstForeground; let sampledPixels = 0;
    for (const rect of values.textRects) {
      for (let y = Math.max(0, Math.ceil(rect.y)); y < Math.min(img.height, rect.y + rect.height); y++) {
        for (let x = Math.max(0, Math.ceil(rect.x)); x < Math.min(img.width, rect.x + rect.width); x++) {
          const index = (y * img.width + x) * 4; const bg = Array.from(pixels.slice(index, index + 3));
          const alpha = values.foreground[3] / 255 * values.opacity;
          const fg = bg.map((value, channel) => values.foreground[channel] * alpha + value * (1 - alpha));
          const l1 = luminance(fg), l2 = luminance(bg);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          if (ratio < minimumRatio) { minimumRatio = ratio; worstBackground = bg; worstForeground = fg; }
          sampledPixels++;
        }
      }
    }
    if (!sampledPixels) throw new Error('No text background samples');
    return { minimumRatio, sampledPixels, worstBackground, worstForeground, threshold: 4.5, result: minimumRatio >= 4.5 ? 'PASS' : 'FAIL' };
  }, { png: image.toString('base64'), values: computed });
  return { label, ...measured, cssColor: computed.cssColor, resolvedForegroundRgba: computed.foreground, effectiveOpacity: computed.opacity, fontSize: computed.fontSize, fontFamily: computed.fontFamily, ancestorLayers: computed.layers, method: 'Chromium canvas CSS-to-sRGB foreground; native raster background with text ink removed, sampling every pixel under actual text rects including ancestor/gradient/alpha/backdrop compositing; WCAG relative luminance; raw ratio compared to 4.5 without rounding.' };
}


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
  assert.equal(fs.existsSync(path.join(__dirname,'native-'+phase+'.json')),false,'Never overwrite a receipt');
  const source=fs.readFileSync(path.join(root,pagePath),'utf8');
  const roster=source.split('const ROSTER_STUDENTS:')[1].split('export default function')[0];
  const ids=Object.fromEntries([...roster.matchAll(/id: '(STU-\d+)',[\s\S]*?name: '([^']+)'/g)].map(m=>[m[2],m[1]]));
  const names=['Nguyễn Minh An','Trần Bảo Ngọc','Phạm Thảo My'];
  const [A,B,C]=names.map(n=>{assert.ok(ids[n],n);return ids[n];});
  const defaults=['Ngôn Ngữ & Giao Tiếp','Đạt kỳ vọng','','','1'];
  const draftA=['Thể chất & Vận động','Đang phát triển','SYNTHETIC A skill','SYNTHETIC A note\nsecond line','3'];
  const draftB=['Thẩm Mỹ & Sáng Tạo','Thành thạo','SYNTHETIC B skill','SYNTHETIC B note\nsecond line','7'];
  const results=[]; let browser;
  try {
    browser=await chromium.launch({headless:true,executablePath:path.join(__dirname,'.cache/browser/chrome-headless-shell-win64/chrome-headless-shell.exe')});
    for(const theme of ['light','dark']) for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]) for(let j=1;j<=7;j++) {
      const result={journey:'J'+j,theme,device,viewport:{width,height},assertions:[],pageErrors:[],unexpectedRequests:[],downloads:[]};results.push(result);
      const context=await browser.newContext({viewport:{width,height},colorScheme:theme});
      try {
        const page=await context.newPage();page.setDefaultTimeout(2500);
        page.on('pageerror',e=>result.pageErrors.push(e.message));page.on('download',d=>result.downloads.push(d.suggestedFilename()));
        await page.route('**/*',route=>{if(route.request().url()===origin+'/')return route.continue();result.unexpectedRequests.push(route.request().url());return route.abort();});
        const settle=()=>page.waitForTimeout(180);
        const check=async(name,fn)=>{try{await fn();result.assertions.push({name,result:'PASS'});}catch(e){if(e.code!=='ERR_ASSERTION')throw e;result.assertions.push({name,result:'FAIL',failure:e.message});}};
        await page.goto(origin+'/');if(theme==='dark')await page.locator('#theme-toggle').click();
        const dialog=page.getByRole('dialog'), global=page.getByRole('button',{name:'Nhập quan sát mới',exact:true});
        const search=page.getByPlaceholder('Tìm tên trẻ, lớp...');
        const cls=page.getByLabel('Lọc theo lớp học',{exact:true}),status=page.getByLabel('Lọc theo trạng thái hồ sơ',{exact:true});
        const field=f=>page.locator('#new-observation-'+f);
        const fields=['domain','progression','skill','note','photos'];
        const values=()=>Promise.all(fields.map(f=>field(f).inputValue()));
        const snapshot=async(id,expected)=>{assert.equal(await field('student').inputValue(),id);assert.deepEqual(await values(),expected);};
        const expectDraft=(label,id,expected)=>check(label,()=>snapshot(id,expected));
        const fill=async data=>{for(let i=0;i<fields.length;i++){const el=field(fields[i]);if(i<2)await el.selectOption(data[i]);else await el.fill(data[i]);}};
        const choose=async id=>{await field('student').selectOption(id);};
        const open=async()=>{await global.focus();await global.press('Enter');await settle();};
        const close=async()=>{await dialog.getByRole('button',{name:'Đóng và giữ bản nháp',exact:true}).click();await settle();};
        const profile=async name=>{const trigger=page.getByRole('button',{name:'Xem hồ sơ minh họa '+name,exact:true});await trigger.focus();await trigger.press('Enter');await settle();const action=dialog.getByRole('button',{name:'Thêm quan sát mới',exact:true});await action.focus();await action.press('Enter');await settle();};
        const inside=()=>check('One dialog and focus inside',async()=>{assert.equal(await dialog.count(),1);assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);});
        const escape=async()=>{await page.keyboard.press('Escape');await settle();await check('Escape closes and returns connected global opener',async()=>{assert.equal(await dialog.count(),0);assert.equal(await global.evaluate(el=>el===document.activeElement&&el.isConnected&&!el.disabled),true);});};
        const rows=await page.locator('tbody tr').count(); assert.equal(rows,8);
        if(j===1){
          await cls.selectOption('CHOI_B1');await status.selectOption('SUPPLEMENT');await search.fill(names[1]);await page.getByRole('checkbox',{name:'Chọn học sinh '+names[1],exact:true}).check();
          await profile(names[1]);await expectDraft('Profile B hands off B with exact defaults',B,defaults);await inside();await escape();
          await check('Roster filters and selection unchanged',async()=>{assert.equal(await cls.inputValue(),'CHOI_B1');assert.equal(await status.inputValue(),'SUPPLEMENT');assert.equal(await search.inputValue(),names[1]);assert.equal(await page.locator('tbody tr').count(),1);assert.equal(await page.getByRole('checkbox',{name:'Chọn học sinh '+names[1],exact:true}).isChecked(),true);});
        }else if(j===2){
          await open();await choose(A);await fill(draftA);await close();await search.fill(names[1]);await page.getByRole('checkbox',{name:'Chọn học sinh '+names[1],exact:true}).check();await profile(names[1]);
          await expectDraft('B has its own untouched defaults, never A content',B,defaults);await choose(A);await expectDraft('A full draft retained despite roster selection/filter',A,draftA);
          await close();await check('Roster filter and selected child remain independent',async()=>{assert.equal(await search.inputValue(),names[1]);assert.equal(await page.getByRole('checkbox',{name:'Chọn học sinh '+names[1],exact:true}).isChecked(),true);});
        }else if(j===3){
          await open();await choose(A);await fill(draftA);await choose(B);await expectDraft('Manual B starts exact defaults',B,defaults);await fill(draftB);
          for(let k=0;k<3;k++){await choose(A);await expectDraft('Repeated A restores all fields '+k,A,draftA);await choose(B);await expectDraft('Repeated B restores all fields '+k,B,draftB);}
        }else if(j===4){
          await open();await expectDraft('Initial exact defaults',A,defaults);await fill(draftA);await close();await open();await expectDraft('Close and keep retains full same-child draft',A,draftA);await escape();await open();await expectDraft('Escape retains full same-child draft',A,draftA);await inside();
        }else if(j===5){
          await open();await fill(draftA);await close();await profile(names[0]);await expectDraft('Same profile A never resets draft',A,draftA);await close();
          await profile(names[1]);await expectDraft('Profile B receives exact defaults',B,defaults);await close();await profile(names[2]);await expectDraft('Profile C receives exact defaults',C,defaults);await choose(A);await expectDraft('Return from C retains A',A,draftA);
        }else if(j===6){
          await open();await choose(B);await fill(draftB);await close();await open();await expectDraft('Global reopen retains active B and full draft',B,draftB);await close();
          await profile(names[0]);await expectDraft('Profile A has exact defaults',A,defaults);await choose(A);await fill(draftA);await choose(B);await expectDraft('Back to B retains full B draft',B,draftB);
          await dialog.getByRole('button',{name:'Lưu quan sát',exact:true}).click();await check('Save honestly unavailable and no success',async()=>{assert.match(await dialog.getByRole('status').innerText(),/Chưa lưu quan sát: chức năng lưu chưa khả dụng/);assert.match(await dialog.getByRole('status').innerText(),/chưa có hồ sơ mới được tạo/);});await expectDraft('Unavailable save preserves B',B,draftB);
          if(phase==='after'){
            result.contrast=[await measureContrast(page,page.locator('#new-observation-draft-note'),'Per-child draft note')];await check('Draft note raw contrast >=4.5',async()=>assert.ok(result.contrast[0].minimumRatio>=4.5));
            await dialog.getByRole('status').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(__dirname,'draft-'+theme+'-'+device+'.png'),animations:'disabled'});
          }
          await choose(A);await expectDraft('Unavailable save leaves A intact',A,draftA);await close();await check('No new sample row',async()=>assert.equal(await page.locator('tbody tr').count(),rows));
        }else{
          await open();await fill(draftA);await choose(B);await fill(draftB);await page.reload();if(theme==='dark')await page.locator('#theme-toggle').click();await open();await expectDraft('Remount resets active child and exact defaults',A,defaults);await choose(B);await expectDraft('Remount discards all B text and restores defaults',B,defaults);
          await check('Synthetic nonpersistent disclaimer',async()=>{const text=await page.locator('#new-observation-draft-note').innerText();assert.match(text,/chưa lưu vào hồ sơ/);assert.match(text,/tải lại hoặc rời trang sẽ mất bản nháp/);assert.match(text,/Chỉ nhập dữ liệu giả/);});
        }
      }catch(e){result.assertions.push({name:'Harness/runtime error',result:'ERROR',failure:e.stack});}finally{await context.close();}
      result.result=result.assertions.some(a=>a.result==='ERROR')?'ERROR':result.assertions.some(a=>a.result==='FAIL')?'FAIL':'PASS';
    }
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
  const summary={checked:results.length,passed:results.filter(r=>r.result==='PASS').length,failed:results.filter(r=>r.result==='FAIL').length,errors:results.filter(r=>r.result==='ERROR').length,pageErrors:results.flatMap(r=>r.pageErrors).length,unexpectedRequests:results.flatMap(r=>r.unexpectedRequests).length,downloads:results.flatMap(r=>r.downloads).length};
  const pass=summary.passed===28&&summary.errors===0&&summary.pageErrors===0&&summary.unexpectedRequests===0&&summary.downloads===0;
  const command='node docs/audits/preschool-observation-drafts-flow/observation-browser.cjs '+phase;
  const receipt={phase,recordedAt:new Date().toISOString(),command,commandSha256:hash(command),exitCode:pass?0:1,summary,sourceSha256:hash(fs.readFileSync(path.join(root,pagePath))),testSha256:hash(fs.readFileSync(__filename)),globalsSha256:hash(fs.readFileSync(cssPath)),compiledCssSha256:hash(css),bundleSha256:hash(js),limits:'Actual Grades and shared modal code with real globals; synthetic Next link/image and tenant only. Loopback CSP; fresh browser context per journey; finally cleanup. No Auth/DB/full Next proof. Contrast measured for draft note in four after contexts.',contrast:results.flatMap(r=>r.contrast||[]),results};
  fs.writeFileSync(path.join(__dirname,'native-'+phase+'.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({phase,...summary}));process.exitCode=receipt.exitCode;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
