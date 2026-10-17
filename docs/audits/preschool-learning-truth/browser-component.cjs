// Standalone component proof, not authenticated Next.js E2E or DB proof.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '../../..');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function measureContrast(page, locator, label) {
  await locator.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.evaluate(() => { for (const animation of document.getAnimations()) { try { animation.finish(); } catch {} } });
  const computed = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
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
      layers.push({ tag: node.tagName, backgroundColor: layer.backgroundColor, backgroundImage: layer.backgroundImage, opacity: layer.opacity, mixBlendMode: layer.mixBlendMode });
    }
    if (layers.some((layer) => layer.mixBlendMode !== 'normal')) throw new Error('Contrast method does not support mix-blend-mode');
    return { cssColor: style.color, foreground, textRects, layers, opacity, fontSize: style.fontSize, fontFamily: style.fontFamily, originalStyle: element.getAttribute('style') };
  });
  // Preserve fills, alpha, gradients and backdrop/ancestor compositing; remove text ink only.
  await locator.evaluate((element) => { element.style.setProperty('color', 'transparent', 'important'); element.style.setProperty('-webkit-text-fill-color', 'transparent', 'important'); element.style.setProperty('text-shadow', 'none', 'important'); });
  const image = await locator.screenshot({ animations: 'disabled' });
  await locator.evaluate((element, original) => { if (original === null) element.removeAttribute('style'); else element.setAttribute('style', original); }, computed.originalStyle);
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
  const cssPath=path.join(root,'src/app/globals.css');
  const css=(await postcss([tailwind({base:root})]).process(fs.readFileSync(cssPath,'utf8'),{from:cssPath})).css;
  const bundles={}; const sourceSha256={};
  for(const view of ['learning','communication']) {
    const pagePath='src/app/dashboard/education/'+view+'/page.tsx';
    sourceSha256[pagePath]=hash(fs.readFileSync(path.join(root,pagePath)));
    const bundled=await esbuild.build({
      stdin:{contents:"import React from 'react'; import {createRoot} from 'react-dom/client'; import Page from './"+pagePath+"'; createRoot(document.getElementById('root')).render(<Page/>);",resolveDir:root,loader:'tsx'},
      bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',
      define:{'process.env.NODE_ENV':'"production"'},
      plugins:[{name:'synthetic-presentation-boundaries',setup(build){
        build.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'synthetic'}));
        build.onResolve({filter:/dashboard-client-context$/},()=>({path:'tenant',namespace:'synthetic'}));
        build.onLoad({filter:/.*/,namespace:'synthetic'},args=>({contents:args.path==='tenant' ? 'export async function getCachedTenantSettings(){ return null; }' : "import React from 'react'; export default function Link({href,children,...props}){ return React.createElement('a',{href,...props},children); }",loader:'js',resolveDir:root}));
      }}],
    });
    bundles[view]=bundled.outputFiles[0].text;
  }
  const browser=await chromium.launch({headless:true}); const results=[];
  try {
    for(const theme of ['light','dark']) for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
      for(const view of ['learning','communication']) {
        const context=await browser.newContext({viewport:{width,height},colorScheme:theme});
        const page=await context.newPage(); const errors=[]; const unexpectedRequests=[]; const contrast=[];
        page.on('pageerror',error=>errors.push(error.message));
        await page.route('**/*',async route=>{
          const url=new URL(route.request().url());
          if(url.hostname!=='preschool-component.invalid') {unexpectedRequests.push(url.origin+url.pathname);await route.abort();return;}
          if(url.pathname==='/') return route.fulfill({contentType:'text/html',body:'<!doctype html><html class="'+(theme==='dark'?'dark':'')+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>'});
          if(url.pathname==='/app.js')return route.fulfill({contentType:'text/javascript',body:bundles[view]});
          if(url.pathname==='/app.css')return route.fulfill({contentType:'text/css',body:css});
          unexpectedRequests.push(url.pathname);await route.abort();
        });
        await page.goto('http://preschool-component.invalid/');
        await page.getByRole('note').waitFor();
        contrast.push(await measureContrast(page,page.getByRole('note'),view+'-sample-label'));
        if(view==='learning') {
          await page.getByRole('button',{name:/Ghi Nhận Quan Sát/}).click();
          await page.getByLabel(/Nội Dung Quan Sát/).fill('Synthetic browser observation');
          await page.getByRole('button',{name:/Lưu Quan Sát & Minh Chứng/}).click();
          assert.equal(await page.getByLabel(/Nội Dung Quan Sát/).inputValue(),'Synthetic browser observation');
          contrast.push(await measureContrast(page,page.getByRole('status'),'learning-save-unavailable'));
          await page.getByRole('button',{name:/Hồ Sơ Portfolio & Xuất Bản/}).click();
          await page.getByRole('button',{name:/Xuất Bản Portfolio Cho Phụ Huynh/}).click();
          assert.equal(await page.getByText(/PUBLISHED|SHA-256|Version \d+/).count(),0);
          contrast.push(await measureContrast(page,page.getByText('Bản minh họa · Chưa xuất bản',{exact:true}),'learning-sample-portfolio-status'));
          contrast.push(await measureContrast(page,page.getByRole('status'),'learning-publish-unavailable'));
          await page.screenshot({path:path.join(__dirname,view+'-'+theme+'-'+device+'.png'),animations:'disabled'});
          await page.getByRole('button',{name:/Parent View/}).click();
          contrast.push(await measureContrast(page,page.getByText(/Đây là bản xem trước minh họa/),'learning-parent-preview-not-loaded'));
        } else {
          const reply=page.getByPlaceholder('Nhập tin nhắn phản hồi...');
          await reply.fill('Synthetic browser unsent reply');
          await page.getByRole('button',{name:'Gửi tin nhắn',exact:true}).click();
          assert.equal(await reply.inputValue(),'Synthetic browser unsent reply');
          contrast.push(await measureContrast(page,page.getByRole('status').locator('span'),'communication-reply-unavailable'));
          await page.getByRole('button',{name:/Tạo lưu ý chăm sóc/}).click();
          contrast.push(await measureContrast(page,page.getByRole('status').locator('span'),'communication-care-unavailable'));
          await page.getByRole('button',{name:'Gửi thông báo',exact:true}).click();
          const modal=page.getByRole('dialog');
          await modal.getByLabel('Tiêu đề thông báo').fill('Synthetic browser title');
          await modal.getByLabel('Nội dung chi tiết').fill('Synthetic browser content');
          await modal.getByRole('button',{name:'Phát hành thông báo'}).click();
          assert.equal(await modal.isVisible(),true);
          assert.equal(await modal.getByLabel('Nội dung chi tiết').inputValue(),'Synthetic browser content');
          contrast.push(await measureContrast(page,modal.getByRole('status'),'communication-broadcast-unavailable'));
          await page.screenshot({path:path.join(__dirname,view+'-'+theme+'-'+device+'.png'),animations:'disabled'});
        }
        assert.deepEqual(errors,[]);assert.deepEqual(unexpectedRequests,[]);
        results.push({view,theme,device,contrast,pageErrors:errors,unexpectedRequests,result:'PASS_SCOPED_SYNTHETIC_COMPONENT'});
        await context.close();
      }
    }
  } finally {await browser.close();}
  const rows=results.flatMap(r=>r.contrast);
  const contrastSummary={result:rows.every(r=>r.result==='PASS')?'PASS_SCOPED':'FAIL',checked:rows.length,failed:rows.filter(r=>r.result!=='PASS').length,minimumRatio:Math.min(...rows.map(r=>r.minimumRatio)),threshold:4.5};
  fs.writeFileSync(path.join(__dirname,'browser-proof.json'),JSON.stringify({result:'PASS_SCOPED_SYNTHETIC_COMPONENT',recordedAt:new Date().toISOString(),contrastSummary,sourceSha256,globalsSha256:hash(fs.readFileSync(cssPath)),compiledCssSha256:hash(css),bundleSha256:Object.fromEntries(Object.entries(bundles).map(([k,v])=>[k,hash(v)])),limits:'Standalone React mount, Next Link stub, synthetic tenant-brand lookup returning null, actual compiled globals CSS; no Next fonts/layout/tenant preset/Auth/DB/full-page E2E or full-page contrast proof. Existing sample content is labelled. New sample and unavailable-action text only.',results},null,2)+'\n');
  console.log(JSON.stringify({cases:results.length,contrastSummary}));if(contrastSummary.failed)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
