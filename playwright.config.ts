/**
 * Playwright config for Bella Spa ERP E2E tests.
 *
 * Run:
 *   npm run e2e              # headless, all tests
 *   npm run e2e:ui           # interactive UI mode
 *   npm run e2e:headed       # headed browser
 *   npm run e2e:debug        # debug mode
 *   npm run e2e:report       # open last report
 *
 * Behaviour:
 *   - Auto-starts `next dev` on the configured local E2E port.
 *   - Reads .env.local for Supabase URL / publishable key / secret key (test seed/teardown).
 *   - Single browser project (chromium) — add Firefox/WebKit later.
 *   - Retries 1 in CI, 0 locally.
 */

import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Load .env.local manually so tests can use service-role key.
// E2E_ENV_FILE lets local runs point at a temporary pulled env file without
// writing secrets into the workspace .env.local.
const tempE2eEnvPath = join(tmpdir(), "bella-spa-e2e.env");
const envPath = process.env.AUTOMOVE_RC_SHA ? undefined : [
  process.env.E2E_ENV_FILE,
  tempE2eEnvPath,
  resolve(process.cwd(), ".env.local"),
]
  .filter((filePath): filePath is string => Boolean(filePath))
  .map((filePath) => resolve(filePath))
  .find((filePath) => existsSync(filePath));

if (envPath) {
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      const rawValue = m[2].trim();
      const unquotedValue = (
        (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'"))
      )
        ? rawValue.slice(1, -1)
        : rawValue;
      process.env[m[1]] = unquotedValue;
    }
  }
}

const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL?.trim() || `http://localhost:${PORT}`;
const IS_CI = !!process.env.CI;
const REUSE_EXISTING_SERVER = process.env.E2E_REUSE_SERVER
  ? process.env.E2E_REUSE_SERVER !== "0"
  : !IS_CI;
const DEV_SERVER_BUNDLER_ARGS = process.env.E2E_NEXT_DEV_BUNDLER === "webpack" ? " --webpack" : "";
const VERCEL_PROTECTION_BYPASS_SECRET =
  process.env.E2E_VERCEL_AUTOMATION_BYPASS_SECRET ?? process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";
const VERCEL_PROTECTION_HEADERS = VERCEL_PROTECTION_BYPASS_SECRET
  ? {
      "x-vercel-protection-bypass": VERCEL_PROTECTION_BYPASS_SECRET,
      "x-vercel-set-bypass-cookie": "true",
    }
  : undefined;

function isLocalBaseUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

const SHOULD_START_DEV_SERVER = isLocalBaseUrl(BASE_URL) && !process.env.SKIP_WEBSERVER;

export default defineConfig({
  testDir: "./e2e/tests",
  testMatch: "**/*.spec.ts",

  // Test execution
  fullyParallel: false, // Bella flows touch shared DB rows — run serial
  forbidOnly: IS_CI,
  retries: IS_CI ? 1 : 0,
  workers: 1, // Single worker — same reason as above
  timeout: 60_000, // 60s per test
  expect: { timeout: 10_000 },

  // Reporter
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "playwright-results.json" }],
  ],

  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    extraHTTPHeaders: VERCEL_PROTECTION_HEADERS,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Uncomment when needed:
    // { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
    // { name: 'mobile-android', use: { ...devices['Pixel 7'] } },
  ],

  // Auto-start dev server on the same port used by baseURL.
  webServer: SHOULD_START_DEV_SERVER
    ? {
        command: `npm run dev --${DEV_SERVER_BUNDLER_ARGS} --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: REUSE_EXISTING_SERVER,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          NODE_ENV: "development", // enables local mock_user_email bypass for E2E
        },
      }
    : undefined,
});
