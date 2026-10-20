const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const task = process.argv[2], root = process.cwd(), dir = __dirname;
const files = ['src/app/api/education/care/bulk/route.ts', 'src/app/api/education/care/bulk/request-context.ts', 'src/app/api/education/care/bulk/__tests__/access.test.ts'];
const commands = {
  jest: ['node_modules/jest/bin/jest.js', '--runInBand', '--runTestsByPath', files[2], '--json', '--outputFile=' + path.join(dir, 'jest-results.json')],
  lint: ['node_modules/eslint/bin/eslint.js', ...files],
  typecheck: ['scripts/ci-run-typecheck.mjs', 'changed'],
  secrets: ['scripts/check-secret-leaks.mjs', ...files],
};
if (!commands[task]) throw Error('Unknown task');
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_URL: 'http://127.0.0.1:1',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-offline-anon-key', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-offline-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-offline-service-key', SUPABASE_SECRET_KEY: 'synthetic-offline-service-key',
  GEMINI_API_KEY: '', GOOGLE_API_KEY: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '',
  CI_SCOPE_AFFECTED_PRODUCTS: 'education_preschool', CI_BASE_REF: '30134055d1ff5b846584e57833816f076034cdea',
};
for (const name of Object.keys(env)) if (/(?:DATABASE|SUPABASE_DB|POSTGRES|E2E_SUPABASE_DB).*URL|DB_PASSWORD/.test(name)) env[name] = '';
const startedAt = new Date().toISOString();
const run = cp.spawnSync(process.execPath, commands[task], { cwd: root, env, encoding: 'utf8', timeout: 300000, maxBuffer: 50000000, windowsHide: true });
const output = ((run.stdout || '') + (run.stderr || '')).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');
fs.writeFileSync(path.join(dir, task + '.log'), output);
const report = { startedAt, finishedAt: new Date().toISOString(), task, command: [process.execPath, ...commands[task]], exitCode: run.status, errorCode: run.error?.code || null, signal: run.signal || null, environment: 'Process-scoped loopback offline endpoints, synthetic keys; no production business/model calls' };
fs.writeFileSync(path.join(dir, task + '-command.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report)); console.log(output.slice(-1800));
if (run.status !== 0) process.exitCode = 1;
