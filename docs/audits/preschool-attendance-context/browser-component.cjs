// Standalone component proof, not authenticated Next.js E2E or DB proof.
const fs = require('node:fs');
const path = require('node:path');
const readFileSync = fs.readFileSync;
fs.readFileSync = function (file, ...args) { if (typeof file === 'string' && /^\.env(?:\.|$)/.test(path.basename(file))) throw new Error('ENV file access denied by Attendance component proof'); return readFileSync.call(this, file, ...args); };
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '../../..');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const pagePath = 'src/app/dashboard/education/attendance/page.tsx';
async function main() {
  const bundled = await esbuild.build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import AttendancePage from './${pagePath}'; createRoot(document.getElementById('root')).render(<AttendancePage/>);`, resolveDir: root, loader: 'tsx' },
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
  const roster = (id) => ({ enrollmentId: 'enrollment-' + id, studentId: 'student-' + id, studentPartyId: 'party-' + id, studentCode: 'SYN-' + id, name: 'Synthetic ' + id, gender: null, dob: null, enrollmentStatus: 'active', attendance: null, authorizedGuardians: [{ authorizationId: 'authorization-' + id, studentPartyId: 'party-' + id, guardianPartyId: 'guardian-' + id, displayName: 'Guardian ' + id, phone: '', status: 'authorized' }] });
  const courses = ['A', 'B'].map((id) => ({ id: 'course-' + id, code: id, name: 'Synthetic Class ' + id, students: 1, maxStudents: 10, todayStatus: { present: 0, excused: 0, unmarked: 1, healthAlerts: 0 } }));
  try {
    for (const theme of ['light', 'dark']) {
      for (const [device, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
        const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
        const page = await context.newPage();
        const errors = [], unexpectedRequests = [], gets = [], commands = [], contrast = [];
        const getWaiters = new Map(), postWaiters = new Map();
        const waitGet = (index) => gets[index] ? Promise.resolve(gets[index]) : new Promise((resolve) => getWaiters.set(index, resolve));
        const waitPost = (index) => commands[index] ? Promise.resolve(commands[index]) : new Promise((resolve) => postWaiters.set(index, resolve));
        const returnRoster = (request, id) => request.route.fulfill({ json: { success: true, roster: [roster(id)] } });
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route('**/*', async (route) => {
          const url = new URL(route.request().url());
          if (url.hostname !== 'preschool-component.invalid') {
            unexpectedRequests.push(url.origin + url.pathname); await route.abort(); return;
          }
          if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html class="${theme === 'dark' ? 'dark' : ''}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>` });
          if (url.pathname === '/app.js') return route.fulfill({ contentType: 'text/javascript', body: bundle });
          if (url.pathname === '/app.css') return route.fulfill({ contentType: 'text/css', body: css });
          if (url.pathname === '/api/education/courses') return route.fulfill({ json: { success: true, classrooms: courses } });
          if (url.pathname === '/api/education/attendance' && route.request().method() === 'GET') {
            const request = { route, courseId: url.searchParams.get('courseId'), date: url.searchParams.get('date') };
            const index = gets.push(request) - 1;
            getWaiters.get(index)?.(request); return;
          }
          if (['/api/education/attendance', '/api/education/attendance/handover'].includes(url.pathname) && route.request().method() === 'POST') {
            const command = { route, path: url.pathname, body: route.request().postDataJSON() };
            const index = commands.push(command) - 1;
            postWaiters.get(index)?.(command); return;
          }
          unexpectedRequests.push(url.pathname); await route.abort();
        });
        await page.goto('http://preschool-component.invalid/');
        const first = await waitGet(0);
        await page.getByRole('button', { name: /Synthetic Class B/ }).click();
        const second = await waitGet(1);
        assert.equal(first.courseId, 'course-A'); assert.equal(second.courseId, 'course-B');
        await returnRoster(second, 'B');
        await page.getByRole('table').getByText('Synthetic B', { exact: true }).waitFor();
        await returnRoster(first, 'A');
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await page.getByText('Synthetic A', { exact: true }).count(), 0);
        await page.getByRole('table').getByText('Synthetic B', { exact: true }).waitFor();
        const date = page.getByLabel('Ngày điểm danh');
        const currentDay = await date.inputValue();
        const nextDay = currentDay === '2026-10-18' ? '2026-10-19' : '2026-10-18';
        await date.fill(nextDay);
        const third = await waitGet(2);
        assert.equal(await page.getByText('Synthetic B', { exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Bàn giao', exact: true }).count(), 0);
        assert.equal(third.date, nextDay);
        await returnRoster(third, 'DAY');
        await page.getByRole('table').getByText('Synthetic DAY', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Có Mặt', exact: true }).click();
        const attendancePost = await waitPost(0);
        assert.deepEqual(attendancePost.body, { enrollmentId: 'enrollment-DAY', status: 'present', date: nextDay });
        assert.equal(await date.isDisabled(), true);
        assert.equal(await page.getByRole('button', { name: /Synthetic Class A/ }).isDisabled(), true);
        await attendancePost.route.fulfill({ json: { success: true } });
        const attendanceReadback = await waitGet(3);
        assert.equal(await date.isDisabled(), true);
        await attendanceReadback.route.fulfill({ status: 503, json: { success: false, error: 'Synthetic readback unavailable' } });
        await page.getByRole('alert').waitFor();
        assert.ok((await page.getByRole('alert').textContent()).includes('Đã ghi nhận điểm danh nhưng chưa tải lại'));
        contrast.push(await measureContrast(page, page.getByRole('alert'), 'attendance-saved-readback-failed'));
        contrast.push(await measureContrast(page, page.getByRole('button', { name: 'Thử tải lại danh sách' }), 'retry-roster'));
        await page.getByRole('button', { name: 'Thử tải lại danh sách' }).click();
        await returnRoster(await waitGet(4), 'FRESH');
        await page.getByRole('button', { name: 'Bàn giao', exact: true }).click();
        const pickupPost = await waitPost(1);
        assert.deepEqual(pickupPost.body, { studentPartyId: 'party-FRESH', guardianPartyId: 'guardian-FRESH', pickupAuthorizationId: 'authorization-FRESH' });
        assert.equal(await date.isDisabled(), true);
        await pickupPost.route.fulfill({ json: { success: true } });
        const pickupReadback = await waitGet(5);
        await pickupReadback.route.fulfill({ status: 503, json: { success: false, error: 'Synthetic readback unavailable' } });
        await page.getByRole('alert').waitFor();
        assert.ok((await page.getByRole('alert').textContent()).includes('Đã ghi nhận bàn giao nhưng chưa tải lại'));
        contrast.push(await measureContrast(page, page.getByRole('alert'), 'handover-saved-readback-failed'));
        const viewportCheck = await page.evaluate(() => ({ width: innerWidth, contentWidth: document.documentElement.scrollWidth }));
        assert.ok(viewportCheck.contentWidth <= viewportCheck.width, JSON.stringify(viewportCheck));
        const screenshot = `component-${theme}-${device}.png`;
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: path.join(__dirname, screenshot), animations: 'disabled', fullPage: true });
        assert.deepEqual(errors, []); assert.deepEqual(unexpectedRequests, []);
        results.push({ theme, device, viewportCheck, screenshot, pageErrors: errors, unexpectedRequests, gets: gets.map(({ courseId, date }) => ({ courseId, date })), commands: commands.map(({ path, body }) => ({ path, body })), contrast, result: 'PASS_SCOPED_SYNTHETIC_COMPONENT' });
        await context.close();
      }
    }
  } finally { await browser.close(); }
  const contrastRows = results.flatMap((result) => result.contrast);
  const contrastSummary = { result: contrastRows.every((row) => row.result === 'PASS') ? 'PASS_SCOPED' : 'FAIL', checked: contrastRows.length, failed: contrastRows.filter((row) => row.result !== 'PASS').length, minimumRatio: Math.min(...contrastRows.map((row) => row.minimumRatio)), threshold: 4.5 };
  fs.writeFileSync(path.join(__dirname, 'browser-proof.json'), JSON.stringify({ result: 'PASS_SCOPED_SYNTHETIC_COMPONENT', contrastSummary, recordedAt: new Date().toISOString(), limits: 'Standalone React mount; Next Link stub; intercepted synthetic HTTP only; actual compiled globals CSS; no Next-managed fonts/preset/layout, authenticated page/Auth/DB/E2E or complete Attendance contrast proof.', sourceSha256: hash(fs.readFileSync(path.join(root, pagePath))), globalsSha256: hash(fs.readFileSync(cssPath)), compiledCssSha256: hash(css), bundleSha256: hash(bundle), results }, null, 2) + '\n');
  console.log(JSON.stringify({ result: 'PASS_SCOPED_SYNTHETIC_COMPONENT', cases: results.length, contrastSummary }));
  if (contrastSummary.failed) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
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
