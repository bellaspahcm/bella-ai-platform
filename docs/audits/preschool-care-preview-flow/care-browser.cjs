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
  const pagePath = 'src/app/dashboard/education/care/page.tsx';
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
  const phase=process.argv[2]; assert.ok(['before','after'].includes(phase));
  const js=built.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
  const csp="default-src 'none'; script-src 'sha256-"+crypto.createHash('sha256').update(js).digest('base64')+"'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; font-src 'none'; base-uri 'none'; form-action 'none'";
  const html='<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><button id="theme-toggle">Theme</button><div id="root"></div><script>'+js+'</script></body></html>';
  const serverRequests=[];
  const server=http.createServer((req,res)=>{
    serverRequests.push({method:req.method,url:req.url});
    if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':csp});res.end(html);}
    else if(req.method==='GET'&&req.url==='/api/education/courses'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({success:false,classrooms:[]}));}
    else{res.writeHead(403);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const results=[];let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:path.join(__dirname,'.cache/browser/chrome-headless-shell-win64/chrome-headless-shell.exe')});
    for(const theme of ['light','dark'])for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]])for(const entry of ['toolbar','row','detail']){
      const result={theme,device,entry,assertions:[],contrast:[],pageErrors:[],unexpectedRequests:[],mutations:[],catalogGets:[],downloads:[]};results.push(result);
      const context=await browser.newContext({viewport:{width,height},colorScheme:theme,serviceWorkers:'block'});
      try{
        const page=await context.newPage();page.setDefaultTimeout(2500);
        page.on('pageerror',e=>result.pageErrors.push(e.message));page.on('download',d=>result.downloads.push(d.suggestedFilename()));
        await context.route('**/*',route=>{
          const req=route.request(),url=req.url(),method=req.method();
          if(method!=='GET'){result.mutations.push({method,url});return route.abort();}
          if(url===origin+'/'&&req.isNavigationRequest())return route.continue();
          if(url===origin+'/api/education/courses'){result.catalogGets.push({method,url});return route.continue();}
          result.unexpectedRequests.push({method,url});return route.abort();
        });
        const check=async(name,fn)=>{try{await fn();result.assertions.push({name,result:'PASS'});}catch(e){if(e.code!=='ERR_ASSERTION')throw e;result.assertions.push({name,result:'FAIL',failure:e.message});}};
        await page.goto(origin+'/');if(theme==='dark')await page.locator('#theme-toggle').click();
        await page.locator('select').first().selectOption('choi-b1');
        const snapshot=async()=>({table:await page.locator('table').innerText(),kpis:await page.locator('.grid.grid-cols-1.sm\\:grid-cols-2').innerText(),history:await page.getByText('Hoạt động gần đây',{exact:true}).locator('../..').innerText()});
        const initial=await snapshot();
        const pageNotice=page.locator('#care-preview-notice');
        await check('Page discloses roster KPIs history are sample not real loaded care',async()=>{assert.equal(await pageNotice.count(),1);assert.match(await pageNotice.innerText(),/Danh sách trẻ, chỉ số và lịch sử.*minh họa.*chưa tải dữ liệu chăm sóc thực tế/);});
        if(entry==='toolbar'&&await pageNotice.count())result.contrast.push(await measureContrast(page,pageNotice,'page notice'));
        const open=async()=>{
          if(entry==='toolbar')await page.getByRole('button',{name:'Ghi nhận nhanh',exact:true}).click();
          else if(entry==='row'){await page.locator('tbody tr').first().getByTitle('Tùy chọn').click();await page.getByRole('button',{name:'Cập nhật nhanh',exact:true}).click();}
          else{await page.getByRole('button',{name:'Nguyễn Minh An',exact:true}).click();await page.getByRole('button',{name:'Cập Nhật Thông Tin',exact:true}).click();}
        };
        const modal=page.locator('.fixed > div').filter({has:page.getByRole('heading',{name:'Ghi Nhận Chăm Sóc Nhanh',exact:true})});
        await open();
        const fields=modal.locator('select'),note=modal.locator('textarea');
        const values=async()=>({dropdowns:await fields.evaluateAll(ns=>ns.map(n=>n.value)),note:await note.inputValue()});
        const defaults=await values();
        const fill=async()=>{for(let i=0;i<4;i++)await fields.nth(i).selectOption({index:i===2?3:2});await note.fill('SYNTHETIC ONLY — dòng 1\n  dòng 2 giữ nguyên  ');return values();};
        const draftNotice=modal.locator('#care-draft-notice');
        await check('Modal explains synthetic only no save and discard on close/leave',async()=>{assert.equal(await draftNotice.count(),1);assert.match(await draftNotice.innerText(),/Chỉ nhập dữ liệu giả lập.*không được lưu.*Đóng hoặc rời trang.*mất/);});
        await check('Dialog and labels associated',async()=>{assert.equal(await modal.getAttribute('role'),'dialog');assert.equal(await modal.getAttribute('aria-modal'),'true');for(const label of ['Bữa ăn','Giấc ngủ trưa','Thân nhiệt & Sức khỏe','Vệ sinh cá nhân','Ghi chú cho phụ huynh / giáo viên ca sau'])assert.equal(await modal.getByLabel(label,{exact:true}).count(),1);});
        if(entry==='toolbar'&&await draftNotice.count())result.contrast.push(await measureContrast(page,draftNotice,'draft notice'));
        const draft=await fill();
        for(let attempt=1;attempt<=2;attempt++){
          await modal.getByRole('button',{name:'Lưu Ghi Nhận',exact:true}).click();
          await check('Save '+attempt+' retains open form and all exact values',async()=>{assert.equal(await modal.count(),1);assert.deepEqual(await values(),draft);});
          await check('Save '+attempt+' explicitly unavailable and not saved',async()=>{const status=page.locator('#care-save-status');assert.equal(await status.count(),1);assert.match(await status.innerText(),/Chưa lưu.*chưa khả dụng/);assert.equal(await status.getAttribute('role'),'status');});
          await check('Save '+attempt+' preserves preview rows KPIs history',async()=>assert.deepEqual(await snapshot(),initial));
          if(!await modal.count()){await open();await fill();}
        }
        if(entry==='toolbar'&&await page.locator('#care-save-status').count()){
          result.contrast.push(await measureContrast(page,page.locator('#care-save-status'),'not saved status'));
          if(phase==='after')await page.screenshot({path:path.join(__dirname,'care-'+theme+'-'+device+'.png'),animations:'disabled'});
        }
        await check('Modal can scroll controls inside viewport',async()=>{await modal.getByRole('button',{name:'Lưu Ghi Nhận',exact:true}).scrollIntoViewIfNeeded();const b=await modal.getByRole('button',{name:'Lưu Ghi Nhận',exact:true}).boundingBox();assert.ok(b.y>=0&&b.y+b.height<=height);});
        await modal.getByRole('button',{name:'Hủy bỏ',exact:true}).click();
        await check('Cancel closes',async()=>assert.equal(await modal.count(),0));await open();
        await check('Cancel discards fields and stale save status',async()=>{assert.deepEqual(await values(),defaults);assert.equal(await page.locator('#care-save-status').count(),0);});
        await fill();await modal.locator('button').first().click();
        await check('X closes',async()=>assert.equal(await modal.count(),0));await open();
        await check('X discards fields and stale save status',async()=>{assert.deepEqual(await values(),defaults);assert.equal(await page.locator('#care-save-status').count(),0);});
        await check('Class and roster unchanged',async()=>{assert.equal(await page.locator('select').first().inputValue(),'choi-b1');assert.deepEqual(await snapshot(),initial);});
        await check('Only declared synthetic catalog GET',async()=>assert.equal(result.catalogGets.length,1));
      }catch(e){result.assertions.push({name:'Harness/runtime error',result:'ERROR',failure:e.stack});}finally{await context.close();}
      result.result=result.assertions.some(x=>x.result==='ERROR')?'ERROR':result.assertions.some(x=>x.result==='FAIL')||result.contrast.some(x=>x.result!=='PASS')?'FAIL':'PASS';
    }
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
  const all=results.flatMap(r=>r.assertions),contrasts=results.flatMap(r=>r.contrast);
  const summary={journeys:results.length,passed:results.filter(r=>r.result==='PASS').length,failed:results.filter(r=>r.result==='FAIL').length,errors:all.filter(a=>a.result==='ERROR').length,assertions:all.length,assertionsPassed:all.filter(a=>a.result==='PASS').length,assertionsFailed:all.filter(a=>a.result==='FAIL').length,contrastCount:contrasts.length,contrastFailed:contrasts.filter(c=>c.result!=='PASS').length,minimumRatio:contrasts.length?Math.min(...contrasts.map(c=>c.minimumRatio)):null,pageErrors:results.flatMap(r=>r.pageErrors).length,unexpectedRequests:results.flatMap(r=>r.unexpectedRequests).length,mutations:results.flatMap(r=>r.mutations).length,downloads:results.flatMap(r=>r.downloads).length,catalogGets:results.flatMap(r=>r.catalogGets).length};
  const pass=summary.passed===12&&summary.contrastCount===12&&summary.contrastFailed===0&&summary.pageErrors===0&&summary.unexpectedRequests===0&&summary.mutations===0&&summary.downloads===0;
  const command='node docs/audits/preschool-care-preview-flow/care-browser.cjs '+phase;
  const receipt={phase,recordedAt:new Date().toISOString(),command,exitCode:pass?0:1,summary,sourceSha256:hash(fs.readFileSync(path.join(root,pagePath))),testSha256:hash(fs.readFileSync(__filename)),globalsSha256:hash(fs.readFileSync(cssPath)),bundleSha256:hash(js),compiledCssSha256:hash(css),limits:'Actual Care and globals. Only Next image/link and tenant settings stubbed. Synthetic catalog GET failure exercises existing fallback; no backend/Auth/DB/persistence proof. Fresh context per entry/theme/viewport. Raster contrast only three changed messages.',serverRequests,results};
  const file=path.join(__dirname,'native-'+phase+'.json');assert.ok(!fs.existsSync(file),'Never overwrite receipts');fs.writeFileSync(file,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({phase,...summary}));process.exitCode=receipt.exitCode;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
