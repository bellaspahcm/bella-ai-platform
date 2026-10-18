// Title-only synthetic proof. Rendering/measurement adapted from browser-component.cjs;
// the previous suite is neither imported nor executed.
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
  const pagePath = 'src/app/dashboard/education/reports/page.tsx';
  const built = await esbuild.build({
    absWorkingDir: root, tsconfigRaw: {},
    stdin: { contents: "import React from 'react'; import {createRoot} from 'react-dom/client'; import Page from './" + pagePath + "'; createRoot(document.getElementById('root')).render(<Page/>); document.getElementById('theme-toggle').onclick=()=>document.documentElement.classList.toggle('dark');", resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, minify: true, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'bounded-local-resolution', setup(build) {
      // Node resolves the installed dependency junction without esbuild scanning denied ancestors.
      build.onResolve({ filter: /.*/ }, args => {
        if (/^next\/(link|image)$|dashboard-client-context$/.test(args.path)) return;
        const request = args.path.startsWith('.') ? path.resolve(args.resolveDir || root, args.path) : args.path;
        return { path: require.resolve(request, { paths: [args.resolveDir || root] }), namespace: 'local-file' };
      });
      build.onLoad({ filter: /.*/, namespace: 'local-file' }, args => ({
        contents: fs.readFileSync(args.path, 'utf8'),
        loader: args.path.endsWith('.tsx') ? 'tsx' : args.path.endsWith('.json') ? 'json' : 'js',
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
  const browser = await chromium.launch({ headless: true, executablePath: path.resolve(__dirname, '.cache/browser/chrome-headless-shell-win64/chrome-headless-shell.exe') });
  const phase = process.argv[2];
  assert.ok(['before', 'after'].includes(phase), 'Use before or after');
  const results = [];
  try {
    for (const theme of ['light', 'dark']) for (const [device, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
      const page = await context.newPage(); const errors = []; const requests = []; const downloads = []; const contrast = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('download', download => downloads.push(download.suggestedFilename()));
      await page.route('**/*', route => {
        if (route.request().url() === origin + '/') return route.continue();
        requests.push(route.request().url()); return route.abort();
      });
      await page.goto(origin + '/');
      if (theme === 'dark') await page.getByRole('button', { name: 'Đổi sáng / tối' }).click();
      const documents = ['Báo cáo tổng hợp tháng 09/2026', 'Tài liệu chuyên cần', 'Báo cáo học phí', 'Báo cáo tăng trưởng theo WHO'];
      for (const list of ['quick', 'detail']) {
        if (list === 'detail') await page.getByRole('button', { name: 'Báo cáo chi tiết', exact: true }).click();
        for (let index = 0; index < documents.length; index++) {
          const title = page.getByText(documents[index], { exact: true });
          assert.equal(await title.count(), 1, list + ' title must be unique');
          assert.equal(await title.evaluate(element => element.tagName), 'P');
          contrast.push(await measureContrast(page, title, list + '-r' + (index + 1)));
        }
      }
      if (phase === 'after') await page.screenshot({ path: path.join(__dirname, 'native-titles-' + theme + '-' + device + '.png'), fullPage: true, animations: 'disabled' });
      assert.deepEqual(errors, []); assert.deepEqual(requests, []); assert.deepEqual(downloads, []);
      results.push({ theme, device, viewport: { width, height }, contrast, pageErrors: errors, unexpectedRequests: requests, downloads });
      await context.close();
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
  const rows = results.flatMap(result => result.contrast);
  assert.equal(rows.length, 32);
  const failed = rows.filter(row => row.result !== 'PASS').length;
  const summary = { result: failed ? 'FAIL' : 'PASS', checked: rows.length, passed: rows.length - failed, failed, minimumRatio: Math.min(...rows.map(row => row.minimumRatio)), threshold: 4.5 };
  const receipt = {
    phase, recordedAt: new Date().toISOString(), command: 'node docs/audits/preschool-report-titles-flow/title-contrast.cjs ' + phase,
    exitCode: failed ? 1 : 0, summary,
    sourceSha256: hash(fs.readFileSync(path.join(root, pagePath))), testSha256: hash(fs.readFileSync(__filename)),
    globalsSha256: hash(fs.readFileSync(cssPath)), compiledCssSha256: hash(css), bundleSha256: hash(js),
    method: 'Chromium canvas CSS-to-sRGB foreground, native raster backgrounds with text ink removed; every pixel under rendered text rectangles; unrounded WCAG ratio >= 4.5.',
    limits: 'Synthetic React mount; actual Reports component and globals.css; stubbed Next Link, no Next layout or downloaded fonts. No Auth/API/DB/runtime readiness proof. Only loopback document allowed; server closed.',
    results: results.map(row => ({ ...row, contrast: row.contrast.map(({ label, minimumRatio, sampledPixels, worstBackground, worstForeground, threshold, result, cssColor }) => ({ label, minimumRatio, sampledPixels, worstBackground, worstForeground, threshold, result, cssColor })) }))
  };
  fs.writeFileSync(path.join(__dirname, 'native-' + phase + '.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ phase, cases: results.length, ...summary }));
  process.exitCode = receipt.exitCode;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
