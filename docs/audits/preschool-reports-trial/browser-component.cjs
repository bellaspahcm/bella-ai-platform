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
  const pagePath = 'src/app/dashboard/education/reports/page.tsx';
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
  const html = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="' + csp + '"><title>Preschool — thử giao diện báo cáo bằng dữ liệu minh họa</title><style>' + css + '</style></head><body><button id="theme-toggle" type="button" class="m-4 rounded-xl bg-slate-800 px-4 py-2 text-sm text-white">Đổi sáng / tối</button><div id="root"></div><script>' + js + '</script></body></html>';
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
      const documents = ['Báo cáo tổng hợp tháng 09/2026', 'Tài liệu chuyên cần', 'Báo cáo học phí', 'Báo cáo tăng trưởng theo WHO'];
      const immediateFeedback = [];
      async function attempt(button, statusId) {
        await button.click();
        const status = page.locator('#' + statusId);
        await status.waitFor({ state: 'visible' });
        const viewport = await status.evaluate((element) => {
          const status = element.getBoundingClientRect();
          const button = document.querySelector('[aria-describedby="' + element.id + '"]').getBoundingClientRect();
          return { statusTop: status.top, statusBottom: status.bottom, buttonTop: button.top, buttonBottom: button.bottom, height: innerHeight };
        });
        assert.ok(viewport.statusTop >= 0 && viewport.statusBottom <= height && viewport.buttonTop >= 0 && viewport.buttonBottom <= height, 'Feedback and clicked control visible before any measurement scroll: ' + statusId + JSON.stringify(viewport));
        assert.match(await status.innerText(), /Chưa (xuất|tải)/);
        assert.match(await status.innerText(), /Không có file được tạo/);
        immediateFeedback.push({ id: statusId, ...viewport, result: 'PASS' });
        return status;
      }
      contrast.push(await measureContrast(page, page.getByRole('note'), 'workspace-sample-label'));
      contrast.push(await measureContrast(page, page.locator('#reports-period-note'), 'period-no-refresh'));
      const header = page.getByRole('button', { name: 'Xuất báo cáo', exact: true });
      const exportStatus = await attempt(header, 'reports-export-status');
      await attempt(header, 'reports-export-status');
      contrast.push(await measureContrast(page, header.locator('span'), 'header-export-control'));
      contrast.push(await measureContrast(page, exportStatus, 'header-export-unavailable'));
      contrast.push(await measureContrast(page, page.getByText(/Các nhận định mẫu dưới đây/), 'ai-sample-not-analysis'));
      for (let i = 0; i < documents.length; i++) {
        const button = page.getByRole('button', { name: 'Tải báo cáo nhanh: ' + documents[i], exact: true });
        const status = await attempt(button, 'reports-quick-r' + (i + 1) + '-status');
        assert.ok((await status.innerText()).includes(documents[i]));
        contrast.push(await measureContrast(page, button, 'quick-control-r' + (i + 1)));
        contrast.push(await measureContrast(page, status, 'quick-unavailable-r' + (i + 1)));
      }
      for (const period of ['Tháng 08/2026', 'Học kỳ I (2026-2027)', 'Tháng 09/2026']) {
        await page.getByRole('combobox', { name: 'Chọn kỳ minh họa' }).selectOption(period);
        assert.ok((await page.locator('#reports-period-note').innerText()).includes(period));
        assert.match(await page.locator('#reports-period-note').innerText(), /không được tải lại/);
        assert.equal(await page.getByRole('status').count(), 5);
      }
      for (const tab of ['Chuyên cần', 'Tài chính', 'Tăng trưởng', 'Phụ huynh', 'Tổng quan', 'Báo cáo chi tiết']) {
        await page.getByRole('button', { name: tab, exact: true }).click();
        assert.match(await page.getByRole('note').innerText(), /chưa tải từ dữ liệu thật/);
      }
      for (let i = 0; i < documents.length; i++) {
        const button = page.getByRole('button', { name: 'Tải báo cáo chi tiết: ' + documents[i], exact: true });
        const status = await attempt(button, 'reports-detail-r' + (i + 1) + '-status');
        assert.ok((await status.innerText()).includes(documents[i]));
        contrast.push(await measureContrast(page, button, 'detail-control-r' + (i + 1)));
        contrast.push(await measureContrast(page, status, 'detail-unavailable-r' + (i + 1)));
      }
      await page.screenshot({ path: path.join(__dirname, 'reports-' + theme + '-' + device + '.png'), animations: 'disabled' });
      assert.equal(await page.locator('a[download]').count(), 0);
      assert.deepEqual(errors, []); assert.deepEqual(unexpectedRequests, []); assert.deepEqual(downloads, []);
      results.push({ theme, device, contrast, immediateFeedback, testedOutputControls: 9, periodSelections: 3, tabsVisited: 6, pageErrors: errors, unexpectedRequests, downloads, result: 'PASS_SCOPED_SYNTHETIC_COMPONENT' });
      await context.close();
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
  const rows = results.flatMap(result => result.contrast);
  const contrastSummary = { result: rows.every(row => row.result === 'PASS') ? 'PASS_SCOPED' : 'FAIL', checked: rows.length, failed: rows.filter(row => row.result !== 'PASS').length, minimumRatio: Math.min(...rows.map(row => row.minimumRatio)), threshold: 4.5 };
  const rawPath = path.join(cachePath, 'browser-proof.raw.json');
  const raw = JSON.stringify({ results }, null, 2) + '\n';
  fs.writeFileSync(rawPath, raw);
  fs.writeFileSync(path.join(__dirname, 'browser-proof.json'), JSON.stringify({
    result: contrastSummary.failed ? 'FAIL' : 'PASS_SCOPED_SYNTHETIC_COMPONENT', recordedAt: new Date().toISOString(), contrastSummary,
    sourceSha256: { [pagePath]: hash(fs.readFileSync(path.join(root, pagePath))) },
    globalsSha256: hash(fs.readFileSync(cssPath)), compiledCssSha256: hash(css), bundleSha256: hash(js), previewSha256: hash(html),
    previewPath: 'docs/audits/preschool-reports-trial/.cache/preview.html', csp,
    rawMeasurementPath: 'docs/audits/preschool-reports-trial/.cache/browser-proof.raw.json', rawMeasurementSha256: hash(raw),
    contrastMethod: 'Actual compiled CSS; Chromium CSS-to-sRGB foreground and native raster background with text ink removed; every pixel under rendered rects including compositing; raw WCAG ratio >= 4.5. Quick icon controls use SVG rect/currentColor and the same stricter threshold.',
    network: 'HTTP bound 127.0.0.1 with ephemeral port; exact document only; connect-src none; server closed',
    limits: 'Standalone React mount and stubbed Link, actual globals CSS; no Next layout/fonts/Auth/API/DB/tenant isolation or full-page E2E. Targeted changed controls and text only.',
    results: results.map(({ contrast, ...result }) => ({ ...result, contrast: contrast.map(({ label, minimumRatio, worstBackground, worstForeground, threshold, result, cssColor }) => ({ label, minimumRatio, worstBackground, worstForeground, threshold, result, cssColor })) })),
  }, null, 2) + '\n');
  console.log(JSON.stringify({ cases: results.length, contrastSummary }));
  if (contrastSummary.failed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
