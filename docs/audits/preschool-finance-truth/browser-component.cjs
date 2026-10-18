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
const pagePath = 'src/app/dashboard/education/finance/page.tsx';
const student = { enrollmentId: 'synthetic-enrollment', courseId: 'synthetic-course', studentPartyId: 'synthetic-party', studentId: 'synthetic-student', studentCode: 'SYN-01', displayName: 'Synthetic Browser Student' };
const period = { id: 'synthetic-period', tenantId: 'synthetic-tenant', periodName: 'Synthetic browser term', startDate: '2027-01-01', endDate: '2027-01-31', dueDate: '2027-01-15', status: 'ACTIVE', createdBy: 'synthetic-staff' };

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
  const bundled = await esbuild.build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import FinancePage from './${pagePath}'; createRoot(document.getElementById('root')).render(<FinancePage/>);`, resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'standalone-next-link', setup(build) {
      build.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'standalone' }));
      build.onLoad({ filter: /.*/, namespace: 'standalone' }, () => ({ contents: "import React from 'react'; export default function Link({href,children,...props}) { return React.createElement('a',{href,...props},children); }", loader: 'js', resolveDir: root }));
    } }],
  });
  const bundle = bundled.outputFiles[0].text;
  const cssPath = path.join(root, 'src/app/globals.css');
  const css = (await postcss([tailwind({ base: root })]).process(fs.readFileSync(cssPath, 'utf8'), { from: cssPath })).css;
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const theme of ['light', 'dark']) {
      for (const [device, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
        const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
        const page = await context.newPage();
        const errors = [];
        const unexpectedRequests = [];
        const commands = [];
        const contrast = [];
        let failNextGet = true;
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route('**/*', async (route) => {
          const url = new URL(route.request().url());
          if (url.hostname !== 'preschool-component.invalid') {
            unexpectedRequests.push(url.origin + url.pathname); await route.abort(); return;
          }
          if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html class="${theme === 'dark' ? 'dark' : ''}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>` });
          if (url.pathname === '/app.js') return route.fulfill({ contentType: 'text/javascript', body: bundle });
          if (url.pathname === '/app.css') return route.fulfill({ contentType: 'text/css', body: css });
          if (url.pathname === '/api/education/finance') {
            if (route.request().method() === 'POST') {
              commands.push(route.request().postDataJSON());
              return route.fulfill({ json: { success: false, error: 'Synthetic command stop: no DB write' }, status: 400 });
            }
            if (failNextGet) { failNextGet = false; return route.fulfill({ json: { success: false, error: 'Synthetic load failure' }, status: 400 }); }
            return route.fulfill({ json: { success: true, students: [student], billingPeriods: [period], invoices: [], payments: [], exceptions: [], servicePeriodCompletions: [] } });
          }
          unexpectedRequests.push(url.pathname); await route.abort();
        });
        await page.goto('http://preschool-component.invalid/');
        await page.getByRole('alert').waitFor();
        contrast.push(await measureContrast(page, page.getByRole('alert').locator('p'), 'load-error-text'));
        contrast.push(await measureContrast(page, page.getByRole('button', { name: 'Thử lại' }), 'load-retry-button'));
        await page.getByRole('button', { name: 'Thử lại' }).click();
        await page.getByText('Chưa có hóa đơn.', { exact: true }).waitFor();
        contrast.push(await measureContrast(page, page.getByText('Chưa có hóa đơn.', { exact: true }), 'invoice-empty-text'));
        assert.equal(await page.getByTestId('btn-compile-invoice').isDisabled(), true);
        await page.getByLabel('Chọn học sinh').selectOption(student.studentPartyId);
        await page.getByLabel(/^Kỳ thu/).selectOption(period.id);
        await page.getByTestId('btn-compile-invoice').click();
        const dialog = page.getByRole('dialog');
        await dialog.getByText(student.displayName, { exact: true }).waitFor();
        await dialog.getByText('Kỳ thu: ' + period.periodName).waitFor();
        assert.equal(await dialog.getByText(/Chưa có số tiền xem trước/).isVisible(), true);
        for (const [label, locator] of [
          ['preview-title', dialog.locator('h3')],
          ['preview-period', dialog.getByText('Kỳ thu: ' + period.periodName)],
          ['preview-student', dialog.getByText(student.displayName, { exact: true })],
          ['preview-explanation', dialog.getByText(/Chưa có số tiền xem trước/)],
          ['preview-close-button', dialog.getByRole('button', { name: 'Đóng', exact: true })],
          ['preview-confirm-button', dialog.getByRole('button', { name: 'Xác nhận lập nháp' }).locator('span')],
        ]) contrast.push(await measureContrast(page, locator, label));
        const viewportCheck = await page.evaluate(() => ({ width: innerWidth, contentWidth: document.documentElement.scrollWidth }));
        assert.ok(viewportCheck.contentWidth <= viewportCheck.width, JSON.stringify(viewportCheck));
        const screenshot = `component-${theme}-${device}.png`;
        await page.screenshot({ path: path.join(__dirname, screenshot), animations: 'disabled' });
        const dialogStyles = await dialog.evaluate((element) => ({ opacity: getComputedStyle(element).opacity, color: getComputedStyle(element).color, backgroundColor: getComputedStyle(element).backgroundColor }));
        await dialog.getByRole('button', { name: 'Xác nhận lập nháp' }).click();
        await page.getByText(/Synthetic command stop/).waitFor();
        assert.deepEqual(commands, [{ action: 'compileDraftInvoice', studentPartyId: student.studentPartyId, billingPeriodId: period.id }]);
        assert.deepEqual(errors, []);
        assert.deepEqual(unexpectedRequests, []);
        results.push({ theme, device, viewportCheck, dialogStyles, screenshot, pageErrors: errors, unexpectedRequests, commands, contrast, result: 'PASS_SCOPED_SYNTHETIC_COMPONENT' });
        await context.close();
      }
    }
  } finally { await browser.close(); }
  const contrastRows = results.flatMap((result) => result.contrast);
  const contrastSummary = { result: contrastRows.every((row) => row.result === 'PASS') ? 'PASS_SCOPED' : 'FAIL', checked: contrastRows.length, failed: contrastRows.filter((row) => row.result !== 'PASS').length, minimumRatio: Math.min(...contrastRows.map((row) => row.minimumRatio)), threshold: 4.5 };
  fs.writeFileSync(path.join(__dirname, 'browser-proof.json'), JSON.stringify({ result: 'PASS_SCOPED_SYNTHETIC_COMPONENT', contrastSummary, recordedAt: new Date().toISOString(), limits: 'Standalone React mount; Next Link stub; intercepted synthetic HTTP responses; actual compiled globals CSS; no Next-managed fonts/preset/layout, authenticated page/Auth/DB/E2E or complete Finance contrast proof.', sourceSha256: hash(fs.readFileSync(path.join(root, pagePath))), globalsSha256: hash(fs.readFileSync(cssPath)), compiledCssSha256: hash(css), bundleSha256: hash(bundle), results }, null, 2) + '\n');
  console.log(JSON.stringify({ result: 'PASS_SCOPED_SYNTHETIC_COMPONENT', cases: results.length, contrastSummary }));
  if (contrastSummary.failed) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
