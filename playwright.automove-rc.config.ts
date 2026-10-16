import { defineConfig } from '@playwright/test';
import base from './playwright.config';

if (!/^[a-f0-9]{40}$/.test(process.env.AUTOMOVE_RC_SHA || '') || !process.env.AUTOMOVE_RC_BUILD_ID || !process.env.AUTOMOVE_RC_PROOF_PATH) {
  throw new Error('Use the supervised exact-SHA RC build/start runner.');
}

export default defineConfig(base, {
  testMatch: '**/42-automove-dashboard-sales-chain.spec.ts',
  retries: 0, workers: 1, forbidOnly: true,
  reporter: [['list'], ['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_FILE }]],
  webServer: undefined,
  use: { trace: 'off', video: 'off', actionTimeout: 60_000 },
});
