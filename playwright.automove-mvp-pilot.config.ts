import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const base = new URL(process.env.FACTORY_MVP_BASE_URL || 'http://invalid');
let proxy: URL;
try {
  proxy = new URL(process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '');
  if (proxy.protocol !== 'http:' || !proxy.port || Number(proxy.port) < 1 ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(proxy.hostname) || proxy.username || proxy.password || proxy.pathname !== '/' || proxy.search || proxy.hash) throw new Error();
  for (const key of ['HTTP_PROXY', 'HTTPS_PROXY']) {
    if (process.env[key] && new URL(process.env[key]).href !== proxy.href) throw new Error();
  }
} catch {
  throw new Error('Use the supervised AutoMove MVP pilot runner with the loopback policy proxy.');
}
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || !base.port || !process.env.FACTORY_MVP_OUTPUT ||
    !/^[a-f0-9]{64}$/.test(process.env.FACTORY_MVP_CANDIDATE || '') || process.env.NODE_USE_ENV_PROXY !== '1') {
  throw new Error('Use the supervised AutoMove MVP pilot runner with the loopback policy proxy.');
}

export default defineConfig({
  build: { external: ['**/scripts/agent-flow/mvp-pilot-runner.mjs'] },
  testDir: './e2e/tests', testMatch: '47-automove-customer-preferences-pilot.spec.ts',
  forbidOnly: true, retries: 0, workers: 1, fullyParallel: false, timeout: 180000,
  preserveOutput: 'never',
  outputDir: resolve(process.env.FACTORY_MVP_OUTPUT, 'browser'),
  reporter: [['json']],
  expect: { timeout: 60000 },
  use: { ...devices['Desktop Chrome'], baseURL: base.href, trace: 'off', video: 'off', screenshot: 'off',
    ignoreHTTPSErrors: false,
    launchOptions: { proxy: { server: proxy.href, bypass: '127.0.0.1,localhost' } },
    actionTimeout: 60000, navigationTimeout: 60000, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' },
});
