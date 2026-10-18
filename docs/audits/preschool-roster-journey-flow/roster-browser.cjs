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

  const phase = process.argv[2]; assert.ok(['before','after'].includes(phase));
  let browser; const results = [];
  try {
    browser = await chromium.launch({headless:true, executablePath:path.join(__dirname,'.cache/browser/chrome-headless-shell-win64/chrome-headless-shell.exe')});
    for(const theme of ['light','dark']) for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
      const result = {theme,device,viewport:{width,height},flows:[],contrast:[],pageErrors:[],unexpectedRequests:[],downloads:[]}; results.push(result);
      for(let journey=1;journey<=6;journey++) {
        const context = await browser.newContext({viewport:{width,height},colorScheme:theme});
        const page = await context.newPage(); page.setDefaultTimeout(5000);
        page.on('pageerror',e=>result.pageErrors.push(e.message)); page.on('download',d=>result.downloads.push(d.suggestedFilename()));
        await page.route('**/*',route=>{if(route.request().url()===origin+'/') return route.continue();result.unexpectedRequests.push(route.request().url());return route.abort();});
        const flow={journey:'J'+journey,steps:[]}; result.flows.push(flow);
        const check=async(name,fn)=>{try{await fn();flow.steps.push({name,result:'PASS'});}catch(e){if(e.code!=='ERR_ASSERTION')throw e;flow.steps.push({name,result:'FAIL',failure:e.message});}};
        try {
          await page.goto(origin+'/'); if(theme==='dark') await page.locator('#theme-toggle').click();
          const search=page.getByPlaceholder('Tìm tên trẻ, lớp...');
          const cls=page.getByLabel('Lọc theo lớp học',{exact:true}), status=page.getByLabel('Lọc theo trạng thái hồ sơ',{exact:true});
          const reset=()=>page.getByRole('button',{name:/^(Xóa bộ lọc|Bộ lọc)$/}).click();
          const box=name=>page.getByRole('checkbox',{name:'Chọn học sinh '+name,exact:true});
          const all=page.getByRole('checkbox',{name:'Chọn tất cả trẻ em trong danh sách',exact:true});
          const rows=page.locator('tbody tr');
          const selected=async()=>page.locator('tbody input:checked').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label').replace('Chọn học sinh ','')).sort());
          const selection=async(names)=>assert.deepEqual(await selected(),names.slice().sort());
          const count=async n=>assert.equal(await rows.count(),n);
          const empty=async()=>{
            const feedback=page.getByRole('status').filter({hasText:'Không tìm thấy hồ sơ minh họa phù hợp. Hãy điều chỉnh hoặc xóa bộ lọc.'});
            await check('Explicit visible empty recovery feedback',async()=>{assert.equal(await feedback.count(),1);assert.equal(await feedback.isVisible(),true);});
            if(await feedback.count()===1){const measured=await measureContrast(page,feedback,'J'+journey+'-'+theme+'-'+device);result.contrast.push(measured);await check('Empty feedback raw contrast >=4.5',async()=>assert.ok(measured.minimumRatio>=4.5));}
          };
          if(journey===1){
            await check('Eight available rows',()=>count(8));
            await check('Truthful roster header',async()=>assert.match(await page.getByRole('heading',{name:'Danh sách trẻ',exact:true}).locator('..').innerText(),/8 hồ sơ minh họa/));
            await check('Truthful roster footer',async()=>assert.match(await page.getByText(/^Hiển thị/).innerText(),/8\s*\/\s*8 hồ sơ minh họa/));
            await check('No enabled imaginary pages',async()=>{for(const n of ['2','3','4','5']) {const p=page.getByRole('button',{name:n,exact:true}); assert.ok(await p.count()===0 || await p.isDisabled());}});
          } else if(journey===2){
            await box('Nguyễn Minh An').check();await search.fill('Trần Bảo Ngọc');
            await check('Visible unchecked child does not inherit hidden selection',async()=>{assert.equal(await all.isChecked(),false);assert.equal(await box('Trần Bảo Ngọc').isChecked(),false);});
            await all.focus();await all.press('Space');await reset();
            await check('Bulk adds visible and preserves hidden IDs',()=>selection(['Nguyễn Minh An','Trần Bảo Ngọc']));
            await search.fill('Trần Bảo Ngọc');await all.click();await reset();
            await check('Bulk removes only visible ID',()=>selection(['Nguyễn Minh An']));
          } else if(journey===3){
            await box('Nguyễn Minh An').check();await search.fill('__ROSTER_NO_MATCH_92817__');
            await check('No rows',()=>count(0));await empty();
            await check('Zero visible select-all disabled or absent',async()=>assert.ok(await all.count()===0 || await all.isDisabled()));
            await check('Search retained',async()=>assert.equal(await search.inputValue(),'__ROSTER_NO_MATCH_92817__'));
            await reset();await check('Recovery eight rows and original selection',async()=>{await count(8);await selection(['Nguyễn Minh An']);});
            await check('Reset explicitly named',async()=>assert.equal(await page.getByRole('button',{name:'Xóa bộ lọc',exact:true}).count(),1));
          } else if(journey===4){
            await page.getByTitle('Dạng lưới thẻ',{exact:true}).click();await cls.selectOption('CHOI_B1');await status.selectOption('SUPPLEMENT');await search.fill('__ROSTER_NO_MATCH_92817__');await empty();
            await check('Grid filters retained',async()=>{assert.equal(await cls.inputValue(),'CHOI_B1');assert.equal(await status.inputValue(),'SUPPLEMENT');assert.equal(await search.inputValue(),'__ROSTER_NO_MATCH_92817__');});
            await reset();await check('Recovery preserves grid and eight cards',async()=>{assert.equal(await page.locator('table').count(),0);assert.equal(await page.locator('#root h3').filter({hasText:/^(Nguyễn Minh An|Trần Bảo Ngọc|Lê Gia Huy|Phạm Thảo My|Hoàng Tuấn Kiệt|Đặng Khánh Linh|Vũ Gia Hân|Ngô Nhật Minh)$/}).count(),8);});
          } else if(journey===5){
            await cls.selectOption('CHOI_B1');await status.selectOption('SUPPLEMENT');await search.fill('Trần Bảo Ngọc');await box('Trần Bảo Ngọc').check();
            await page.getByRole('button',{name:'Xem hồ sơ minh họa Trần Bảo Ngọc',exact:true}).click();
            const dialog=page.getByRole('dialog');
            await check('Correct filtered child profile and class',async()=>{assert.equal(await dialog.count(),1);assert.match(await dialog.innerText(),/Trần Bảo Ngọc/);assert.match(await dialog.innerText(),/Chồi B1/);assert.doesNotMatch(await dialog.innerText(),/Nguyễn Minh An/);});
            await dialog.getByRole('button',{name:'Đóng',exact:true}).click();
            await check('Close retains filters and selection',async()=>{assert.equal(await dialog.count(),0);assert.equal(await cls.inputValue(),'CHOI_B1');assert.equal(await status.inputValue(),'SUPPLEMENT');assert.equal(await search.inputValue(),'Trần Bảo Ngọc');await count(1);await selection(['Trần Bảo Ngọc']);});
            await reset();await check('Reset recovers all eight with selection',async()=>{await count(8);await selection(['Trần Bảo Ngọc']);});
          } else {
            await box('Nguyễn Minh An').focus();await box('Nguyễn Minh An').press('Space');await cls.selectOption('CHOI_B1');
            const cohort=await rows.locator('input').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label').replace('Chọn học sinh ','')));
            await check('Four Choi records',async()=>assert.equal(cohort.length,4));
            await all.focus();await all.press('Space');await reset();
            await check('Five exact selected IDs',()=>selection(['Nguyễn Minh An',...cohort]));
            await cls.selectOption('CHOI_B1');await check('All visible IDs selected',async()=>assert.equal(await all.isChecked(),true));await all.focus();await all.press('Space');await reset();
            await check('Only hidden MAM ID remains',()=>selection(['Nguyễn Minh An']));
          }
          if(phase==='after'&&journey===6) await page.screenshot({path:path.join(__dirname,'roster-'+theme+'-'+device+'.png'),fullPage:true,animations:'disabled'});
        } catch(e) {flow.steps.push({name:'Harness/runtime error',result:'ERROR',failure:e.stack});}
        finally {await context.close();}
        flow.result=flow.steps.every(s=>s.result==='PASS')?'PASS':flow.steps.some(s=>s.result==='ERROR')?'ERROR':'FAIL';
      }
    }
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
  const flows=results.flatMap(r=>r.flows), contrasts=results.flatMap(r=>r.contrast);
  const summary={checked:flows.length,passed:flows.filter(f=>f.result==='PASS').length,failed:flows.filter(f=>f.result==='FAIL').length,errors:flows.filter(f=>f.result==='ERROR').length,contrastCount:contrasts.length,contrastFailed:contrasts.filter(c=>c.result!=='PASS').length,minimumRatio:contrasts.length?Math.min(...contrasts.map(c=>c.minimumRatio)):null,pageErrors:results.flatMap(r=>r.pageErrors).length,unexpectedRequests:results.flatMap(r=>r.unexpectedRequests).length,downloads:results.flatMap(r=>r.downloads).length};
  const pass=summary.passed===24&&summary.contrastCount===8&&summary.contrastFailed===0&&summary.pageErrors===0&&summary.unexpectedRequests===0&&summary.downloads===0;
  const receipt={phase,recordedAt:new Date().toISOString(),command:'node docs/audits/preschool-roster-journey-flow/roster-browser.cjs '+phase,exitCode:pass?0:1,summary,sourceSha256:hash(fs.readFileSync(path.join(root,pagePath))),testSha256:hash(fs.readFileSync(__filename)),globalsSha256:hash(fs.readFileSync(cssPath)),compiledCssSha256:hash(css),bundleSha256:hash(js),limits:'Synthetic actual Grades component/globals; stubbed Next and tenant settings; loopback document only, no fonts/API/Auth/DB; contrast only empty feedback; fresh context/page per journey; server/browser closed in finally.',results};
  fs.writeFileSync(path.join(__dirname,'native-'+phase+'.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({phase,contexts:results.length,result:pass?'PASS':'FAIL',...summary}));process.exitCode=receipt.exitCode;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
