const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const [group, task] = process.argv.slice(2);
const groups = {
  portal: { folder: 'batch2h-parent-access', files: [
    'src/app/api/education/portal/token/route.ts',
    'src/products/bella-education/parent-portal/services/preschool-parent-portal.service.ts',
    'src/products/bella-education/parent-portal/repositories/parent-portal.repository.ts',
    'src/app/api/education/portal/[token]/route.ts',
    'src/app/api/education/portal/[token]/chat/route.ts',
    'src/app/api/education/portal/[token]/copilot/route.ts',
    'src/products/bella-education/__tests__/preschool-parent-portal.service.test.ts',
    'src/app/api/education/portal/token/__tests__/access.test.ts',
    'src/app/api/education/portal/__tests__/access.test.ts',
    'src/products/bella-education/__tests__/preschool-parent-portal-security.test.ts',
  ] },
  announcements: { folder: 'batch2i-announcements', files: ['src/app/api/education/announcements/route.ts', 'src/app/api/education/announcements/__tests__/access.test.ts'] },
};
const config = groups[group]; if (!config) throw Error('Unknown group');
const root = process.cwd(), dir = path.join(root, 'docs/audits/preschool-full-audit-20261020', config.folder);
const commands = {
  jest: ['node_modules/jest/bin/jest.js', '--runInBand', '--runTestsByPath', ...config.files.filter(f => f.endsWith('.test.ts')), '--json', '--outputFile=' + path.join(dir, 'jest-results.json')],
  lint: ['node_modules/eslint/bin/eslint.js', ...config.files],
  typecheck: ['scripts/ci-run-typecheck.mjs', 'changed'],
  secrets: ['scripts/check-secret-leaks.mjs', ...config.files],
};
if (!commands[task]) throw Error('Unknown task');
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_URL: 'http://127.0.0.1:1',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-offline-anon-key', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-offline-anon-key', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-offline-service-key', SUPABASE_SECRET_KEY: 'synthetic-offline-service-key', NEXTAUTH_SECRET: 'synthetic-offline-signing-key',
  GEMINI_API_KEY: '', GOOGLE_API_KEY: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '', CI_SCOPE_AFFECTED_PRODUCTS: 'education_preschool', CI_BASE_REF: '30134055d1ff5b846584e57833816f076034cdea' };
for (const name of Object.keys(env)) if (/(?:DATABASE|SUPABASE_DB|POSTGRES|E2E_SUPABASE_DB).*URL|DB_PASSWORD/.test(name)) env[name] = '';
const startedAt = new Date().toISOString();
const run = cp.spawnSync(process.execPath, commands[task], { cwd: root, env, encoding: 'utf8', timeout: 300000, maxBuffer: 50000000, windowsHide: true });
const output = ((run.stdout || '') + (run.stderr || '')).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');
fs.writeFileSync(path.join(dir, task + '.log'), output);
const report = { group, task, startedAt, finishedAt: new Date().toISOString(), command: [process.execPath, ...commands[task]], exitCode: run.status, errorCode: run.error?.code || null, signal: run.signal || null, environment: 'Process-scoped loopback offline endpoints and synthetic keys; no production business/model calls' };
fs.writeFileSync(path.join(dir, task + '-command.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report)); console.log(output.slice(-3500)); if (run.status !== 0) process.exitCode = 1;
