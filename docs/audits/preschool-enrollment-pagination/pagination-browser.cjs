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
  const pagePath = 'src/app/dashboard/education/enrollments/page.tsx';
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
          : "import React from 'react'; export default function Link({children,...props}){return React.createElement('a',{...props,onClick:e=>e.preventDefault()},children);}", loader: 'js', resolveDir: root }));
    } }],
  });
  const phase=process.argv[2]; assert.ok(['before','after'].includes(phase));
  const js=built.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
  const csp="default-src 'none'; script-src 'sha256-"+crypto.createHash('sha256').update(js).digest('base64')+"'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; font-src 'none'; base-uri 'none'; form-action 'none'";
  const html='<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><button id="theme-toggle">Theme</button><div id="root"></div><script>'+js+'</script></body></html>';
  const fixture=Array.from({length:73},(_,i)=>({id:'SYNTHETIC-'+String(i+1).padStart(3,'0'),name:'SYNTHETIC Student '+(i+1),nickname:'Synthetic only',dateOfBirth:'2022-03-12',gender:'Nam',className:i%2?'Lá 1':'Chồi 2',parentName:'SYNTHETIC Guardian',parentPhone:'0000000000',hasHealthAlert:false,medicalNote:'',status:'Đang học',statusKey:'active'}));
  let late=false,held=[];
  const serverRequests=[];
  const server=http.createServer((req,res)=>{
    serverRequests.push({method:req.method,url:req.url});
    if(req.method!=='GET'){res.writeHead(403);return res.end();}
    if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':csp});return res.end(html);}
    if(req.url==='/api/education/enrollments'){
      if(late){held.push(res);return;}
      res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({success:true,students:fixture}));
    }
    res.writeHead(403);res.end();
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const results=[];let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:path.join(__dirname,'.cache/browser/chrome-headless-shell-win64/chrome-headless-shell.exe')});
    for(const theme of ['light','dark'])for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
      const result={theme,device,assertions:[],contrast:[],pageErrors:[],unexpectedRequests:[],mutations:[],blockedImages:[]};results.push(result);
      const context=await browser.newContext({viewport:{width,height},colorScheme:theme,serviceWorkers:'block'});
      const page=await context.newPage();page.setDefaultTimeout(1800);
      page.on('pageerror',e=>result.pageErrors.push(e.message));
      await context.route('**/*',route=>{
        const req=route.request(),url=req.url(),method=req.method();
        if(method!=='GET'){result.mutations.push({method,url});return route.abort();}
        if(url===origin+'/'&&req.isNavigationRequest()||url===origin+'/api/education/enrollments')return route.continue();
        if(req.resourceType()==='image'){result.blockedImages.push(url);return route.abort();}
        result.unexpectedRequests.push({method,url});return route.abort();
      });
      const check=async(name,fn)=>{try{await fn();result.assertions.push({name,result:'PASS'});}catch(e){result.assertions.push({name,result:e.code==='ERR_ASSERTION'?'FAIL':'ERROR',failure:e.message});}};
      try{
        await page.goto(origin+'/');if(theme==='dark')await page.locator('#theme-toggle').click();
        await page.getByRole('link',{name:'SYNTHETIC Student 1',exact:true}).waitFor();
        const search=page.getByPlaceholder('Tìm tên trẻ, mã hồ sơ, tên phụ huynh, SĐT...');
        const next=page.getByRole('button',{name:'Trang kế tiếp',exact:true}),prev=page.getByRole('button',{name:'Trang trước',exact:true});
        const footer=page.locator('span').filter({hasText:/^Hiển thị \d+ trên tổng \d+ trẻ$/});
        const controls=next.locator('..');
        const size=page.locator('select').filter({has:page.locator('option[value="50"]')});
        const ids=()=>page.locator('tbody tr td:nth-child(3)').allTextContents();
        const current=()=>controls.locator('[aria-current="page"]');
        await page.getByRole('button',{name:'Tất cả trẻ (280)',exact:true}).click();
        await size.selectOption('50');const first=await ids();
        await next.click();const second=await ids();
        const known=[...new Set([...first,...second].map(s=>s.trim()))];result.renderedKnownIds=known;
        await check('Fixture census includes all synthetic and preserved sample rows',async()=>{assert.equal(known.filter(s=>s.startsWith('SYNTHETIC-')).length,fixture.length);assert.ok(known.includes('HS0001'));});
        await size.selectOption('10');
        const pages=Math.ceil(known.length/10);
        await check('Many pages expose real last page and no phantom 28',async()=>{assert.equal(await controls.getByRole('button',{name:String(pages),exact:true}).count(),1);assert.equal(await controls.getByRole('button',{name:'28',exact:true}).count(),0);});
        const last=controls.getByRole('button',{name:String(pages),exact:true});
        if(await last.count())await last.click();else for(let i=1;i<pages;i++)await next.click();
        await check('Last page rows and Next bound match rendered fixture census',async()=>{assert.deepEqual((await ids()).map(s=>s.trim()),known.slice((pages-1)*10));assert.equal(await next.isDisabled(),true);});
        await prev.click();await check('Previous goes back one real page',async()=>assert.deepEqual((await ids()).map(s=>s.trim()),known.slice((pages-2)*10,(pages-1)*10)));
        await controls.getByRole('button',{name:'1',exact:true}).click();
        await check('First page restores rows and disables Previous',async()=>{assert.deepEqual((await ids()).map(s=>s.trim()),known.slice(0,10));assert.equal(await prev.isDisabled(),true);});
        await next.click();await size.selectOption('20');
        await check('Page size resets to first page and changes visible rows',async()=>assert.deepEqual((await ids()).map(s=>s.trim()),known.slice(0,20)));
        await next.click();await search.fill('SYNTHETIC-001');
        await check('Filter resets, one page disables Next and removes phantom 28',async()=>{assert.deepEqual((await ids()).map(s=>s.trim()),['SYNTHETIC-001']);assert.equal(await next.isDisabled(),true);assert.equal(await controls.getByRole('button',{name:'28',exact:true}).count(),0);});
        await check('Filtered footer reports actual count',async()=>assert.equal(await footer.innerText(),'Hiển thị 1 trên tổng 1 trẻ'));
        await search.fill('NO-SUCH-SYNTHETIC-RECORD');
        await check('Zero matches has truthful footer and bounded controls',async()=>{assert.equal(await footer.innerText(),'Hiển thị 0 trên tổng 0 trẻ');assert.equal(await next.isDisabled(),true);assert.equal(await prev.isDisabled(),true);});
        await search.fill('SYNTHETIC');await size.selectOption('10');
        const link=page.getByRole('link',{name:'SYNTHETIC Student 1',exact:true});
        await check('Record link keeps identity',async()=>assert.equal(await link.getAttribute('href'),'/dashboard/education/enrollments/SYNTHETIC-001'));
        const box=page.getByRole('checkbox',{name:'Chọn học sinh SYNTHETIC Student 1',exact:true});await box.check();await next.click();await prev.click();
        await check('Selection survives pagination',async()=>assert.equal(await box.isChecked(),true));
        await check('Current page is accessible and keyboard can navigate',async()=>{assert.equal(await current().count(),1);assert.equal(await current().innerText(),'1');await next.focus();await page.keyboard.press('Enter');assert.equal(await current().innerText(),'2');});
        if(await current().count())result.contrast.push(await measureContrast(page,current(),'current page'));
        result.contrast.push(await measureContrast(page,footer,'filtered footer'));
        if(phase==='after'){await footer.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(__dirname,'pagination-'+theme+'-'+device+'.png'),animations:'disabled'});}
        // The preset initially fits one production-sized page. A synthetic size=1 option
        // exercises a valid later page before the first asynchronous GET shrinks it.
        late=true;await page.reload();if(theme==='dark')await page.locator('#theme-toggle').click();
        await page.getByRole('link',{name:'Nguyễn Minh An',exact:true}).waitFor();
        await size.evaluate(el=>{const o=document.createElement('option');o.value='1';o.text='Synthetic late-load probe size 1';el.append(o);});await size.selectOption('1');await next.click();await next.click();
        result.lateBeforeIds=await ids();
        const shrink=Array.from({length:10},(_,i)=>({...fixture[0],id:'HS'+String(i+1).padStart(4,'0'),name:'SYNTHETIC replacement '+i,statusKey:i===0?'active':'pending'}));
        for(const res of held.splice(0)){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({success:true,students:shrink}));}late=false;
        await page.getByRole('link',{name:'SYNTHETIC replacement 0',exact:true}).waitFor().catch(()=>{});
        await check('Late async shrink clamps a previously later valid page',async()=>{assert.deepEqual((await ids()).map(s=>s.trim()),['HS0001']);assert.equal(await next.isDisabled(),true);assert.equal(await prev.isDisabled(),true);assert.equal(await current().innerText(),'1');});
        await check('No unexpected network, business writes, or runtime errors',async()=>{assert.deepEqual(result.unexpectedRequests,[]);assert.deepEqual(result.mutations,[]);assert.deepEqual(result.pageErrors,[]);});
      }catch(e){result.assertions.push({name:'Harness/runtime error',result:'ERROR',failure:e.stack});}
      finally{late=false;for(const res of held.splice(0)){res.writeHead(503);res.end('{}');}await context.close();}
      result.result=result.assertions.some(x=>x.result==='ERROR')?'ERROR':result.assertions.some(x=>x.result==='FAIL')||result.contrast.some(x=>x.result!=='PASS')?'FAIL':'PASS';
    }
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
  const assertions=results.flatMap(r=>r.assertions),contrasts=results.flatMap(r=>r.contrast);
  const summary={journeys:results.length,passed:results.filter(r=>r.result==='PASS').length,assertions:assertions.length,failed:assertions.filter(x=>x.result==='FAIL').length,errors:assertions.filter(x=>x.result==='ERROR').length,contrastCount:contrasts.length,contrastFailed:contrasts.filter(x=>x.result!=='PASS').length,minimumRatio:contrasts.length?Math.min(...contrasts.map(x=>x.minimumRatio)):null};
  const pass=summary.passed===4&&summary.contrastCount===8;
  const receipt={phase,recordedAt:new Date().toISOString(),command:'node docs/audits/preschool-enrollment-pagination/pagination-browser.cjs '+phase,exitCode:pass?0:1,summary,sourceSha256:hash(fs.readFileSync(path.join(root,pagePath))),testSha256:hash(fs.readFileSync(__filename)),globalsSha256:hash(fs.readFileSync(cssPath)),bundleSha256:hash(js),compiledCssSha256:hash(css),limits:'Actual component and globals.css. Next Link presentation boundary only. Loopback synthetic GET only. Remote images blocked by CSP and routing. Late load uses test-only size 1 through actual select handler because preset has only 10 records. No API/DB/Auth proof.',serverRequests,results};
  const file=path.join(__dirname,'native-'+phase+'.json');assert.ok(!fs.existsSync(file),'Never overwrite receipts');fs.writeFileSync(file,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({phase,...summary}));process.exitCode=receipt.exitCode;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
