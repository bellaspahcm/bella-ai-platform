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
const http = require('node:http');
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
  const cachePath = path.join(__dirname, '.cache');
  fs.mkdirSync(cachePath, { recursive: true });
  const cssPath = path.join(root, 'src/app/globals.css');
  const css = (await postcss([tailwind({ base: root })]).process(fs.readFileSync(cssPath, 'utf8'), { from: cssPath })).css;
  const pagePath = 'src/app/dashboard/education/grades/page.tsx';
  const built = await esbuild.build({
    stdin: { contents: "import React from 'react'; import {createRoot} from 'react-dom/client'; import Page from './" + pagePath + "'; createRoot(document.getElementById('root')).render(<Page/>); document.getElementById('theme-toggle').onclick=()=>document.documentElement.classList.toggle('dark');", resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, minify: true, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'synthetic-presentation-boundaries', setup(build) {
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
  const html = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="' + csp + '"><title>Preschool — thử giao diện đánh giá bằng dữ liệu minh họa</title><style>' + css + '</style></head><body><button id="theme-toggle" type="button" class="m-4 rounded-xl bg-slate-800 px-4 py-2 text-sm text-white">Đổi sáng / tối</button><div id="root"></div><script>' + js + '</script></body></html>';
  fs.writeFileSync(path.join(cachePath, 'preview.html'), html);
  const server = http.createServer((request, response) => {
    if (request.url !== '/') { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': csp }); response.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const theme of ['light', 'dark']) for (const [device, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
      const page = await context.newPage(); const errors = []; const unexpectedRequests = []; const downloads = []; const contrast = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('download', download => downloads.push(download.suggestedFilename()));
      await page.route('**/*', route => {
        if (route.request().url() === origin + '/') return route.continue();
        unexpectedRequests.push(route.request().url()); return route.abort();
      });
      await page.goto(origin + '/');
      if (theme === 'dark') await page.getByRole('button', { name: 'Đổi sáng / tối' }).click();
      contrast.push(await measureContrast(page, page.getByRole('note'), 'workspace-sample-label'));
      await page.getByRole('button', { name: 'Xuất báo cáo' }).click();
      assert.match(await page.getByRole('status').innerText(), /Chưa xuất báo cáo/);
      const exportFeedbackViewport = await page.getByRole('status').evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, height: innerHeight };
      });
      assert.ok(exportFeedbackViewport.top >= 0 && exportFeedbackViewport.bottom <= exportFeedbackViewport.height, 'Unavailable export feedback must be visible immediately after click');
      contrast.push(await measureContrast(page, page.getByRole('status').locator('span'), 'export-unavailable'));
      await page.getByRole('button', { name: 'Nhập quan sát mới', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Nhập quan sát sư phạm mới' });
      const fields = [['Chọn trẻ', 'STU-002'], ['Lĩnh vực NAEYC', 'Nhận Thức & Tư Duy'], ['Mức độ tiến trình', 'Đang phát triển'], ['Kỹ năng quan sát cụ thể', 'Synthetic browser skill'], ['Ghi chép hành vi khách quan', 'Synthetic browser note'], ['Số lượng ảnh / video bằng chứng đính kèm', '4']];
      for (const [label, value] of fields) {
        const field = dialog.getByLabel(label, { exact: true });
        if (await field.evaluate(element => element.tagName) === 'SELECT') await field.selectOption(value); else await field.fill(value);
      }
      await dialog.getByRole('button', { name: 'Lưu quan sát' }).click();
      const feedbackViewport = await dialog.getByRole('status').evaluate(element => {
        const rect = element.getBoundingClientRect();
        const modal = element.closest('[role="dialog"]').getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, modalTop: modal.top, modalBottom: modal.bottom, height: innerHeight };
      });
      assert.ok(feedbackViewport.top >= feedbackViewport.modalTop && feedbackViewport.bottom <= feedbackViewport.modalBottom && feedbackViewport.top >= 0 && feedbackViewport.bottom <= feedbackViewport.height, 'Unavailable save feedback must be visible immediately after click');
      await dialog.getByRole('button', { name: 'Lưu quan sát' }).click();
      assert.equal(await dialog.isVisible(), true);
      assert.match(await dialog.getByRole('status').innerText(), /Chưa lưu quan sát/);
      for (const [label, value] of fields) assert.equal(await dialog.getByLabel(label, { exact: true }).inputValue(), value);
      contrast.push(await measureContrast(page, dialog.locator('#new-observation-draft-note'), 'local-draft-limit'));
      contrast.push(await measureContrast(page, dialog.getByRole('status'), 'save-unavailable'));
      contrast.push(await measureContrast(page, dialog.locator('label[for="new-observation-skill"]'), 'form-label'));
      contrast.push(await measureContrast(page, dialog.getByRole('button', { name: 'Đóng và giữ bản nháp' }), 'close-retain-draft'));
      const box = await dialog.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width);
      await page.screenshot({ path: path.join(__dirname, 'grades-' + theme + '-' + device + '.png'), animations: 'disabled' });
      await dialog.getByRole('button', { name: 'Đóng và giữ bản nháp' }).click();
      await page.getByRole('button', { name: 'Nhập quan sát mới', exact: true }).click();
      for (const [label, value] of fields) assert.equal(await dialog.getByLabel(label, { exact: true }).inputValue(), value);
      await dialog.getByRole('button', { name: 'Đóng nhập quan sát' }).click();
      await page.getByRole('button', { name: /Gợi ý AI sư phạm minh họa/ }).click();
      const ai = page.getByRole('dialog', { name: 'Gợi ý AI sư phạm minh họa' });
      contrast.push(await measureContrast(page, ai.getByText(/Gợi ý minh họa để thử giao diện/), 'ai-not-actual-analysis'));
      await ai.getByRole('button', { name: 'Đóng gợi ý minh họa', exact: true }).click();
      await page.getByRole('button', { name: 'Xem hồ sơ minh họa Nguyễn Minh An' }).click();
      const portfolio = page.getByRole('dialog', { name: 'Hồ sơ trẻ minh họa' });
      contrast.push(await measureContrast(page, portfolio.getByText(/Hồ sơ minh họa:/), 'portfolio-sample-evidence'));
      assert.deepEqual(errors, []); assert.deepEqual(unexpectedRequests, []); assert.deepEqual(downloads, []);
      results.push({ theme, device, contrast, exportFeedbackViewport, saveFeedbackViewport: feedbackViewport, retainedFields: fields.length, modalFitsViewport: true, pageErrors: errors, unexpectedRequests, downloads, result: 'PASS_SCOPED_SYNTHETIC_COMPONENT' });
      await context.close();
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
  const rows = results.flatMap(result => result.contrast);
  const contrastSummary = { result: rows.every(row => row.result === 'PASS') ? 'PASS_SCOPED' : 'FAIL', checked: rows.length, failed: rows.filter(row => row.result !== 'PASS').length, minimumRatio: Math.min(...rows.map(row => row.minimumRatio)), threshold: 4.5 };
  fs.writeFileSync(path.join(__dirname, 'browser-proof.json'), JSON.stringify({ result: contrastSummary.failed ? 'FAIL' : 'PASS_SCOPED_SYNTHETIC_COMPONENT', recordedAt: new Date().toISOString(), contrastSummary, sourceSha256: { [pagePath]: hash(fs.readFileSync(path.join(root, pagePath))) }, globalsSha256: hash(fs.readFileSync(cssPath)), compiledCssSha256: hash(css), bundleSha256: hash(js), previewSha256: hash(html), previewPath: 'docs/audits/preschool-grades-trial/.cache/preview.html', csp, network: 'HTTP bound 127.0.0.1 with ephemeral port; exact document only, connect-src none; server closed', limits: 'Standalone React component mount, synthetic tenant lookup, stubbed Link/Image, actual compiled globals CSS; no Next layout/fonts/Auth/API/DB/tenant isolation or full-page E2E. Contrast checks only changed sample, draft and unavailable-action text.', results }, null, 2) + '\n');
  console.log(JSON.stringify({ cases: results.length, contrastSummary }));
  if (contrastSummary.failed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
