const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const root = 'C:/Users/DELL/.codex/worktrees/shared-identity-containment-20261021/BELLA SPA ERP';
const dir = path.join(root, 'docs/audits/preschool-full-audit-20261020/batch2f-disable-medication');
const task = process.argv[2];
const files = ['src/app/api/education/care/medication/route.ts', 'src/app/api/education/care/medication/__tests__/route.test.ts'];
const args = { lint: ['node_modules/eslint/bin/eslint.js', ...files],
  typecheck: ['scripts/ci-run-typecheck.mjs', 'changed'], secrets: ['scripts/check-secret-leaks.mjs', ...files] }[task];
if (!args) throw Error('Unknown medication check');
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_URL: 'http://127.0.0.1:1',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-offline-anon-key', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-offline-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-offline-service-key', SUPABASE_SECRET_KEY: 'synthetic-offline-service-key',
  CI_SCOPE_AFFECTED_PRODUCTS: 'education_preschool', CI_BASE_REF: '30134055d1ff5b846584e57833816f076034cdea' };
for (const key of Object.keys(env)) if (/(?:DATABASE|SUPABASE_DB|POSTGRES|E2E_SUPABASE_DB).*URL|DB_PASSWORD|GEMINI_API_KEY|GOOGLE_API_KEY/.test(key)) env[key] = '';
const start = new Date().toISOString();
const result = cp.spawnSync(process.execPath, args, { cwd: root, env, encoding: 'utf8', timeout: 300000, maxBuffer: 10000000 });
const output = (result.stdout || '') + (result.stderr || '');
fs.writeFileSync(path.join(dir, task + '.log'), output);
const report = { startedAt: start, finishedAt: new Date().toISOString(), task, command: ['node', ...args], exitCode: result.status,
  errorCode: result.error?.code || null, nextVersion: '16.3.8', environment: 'Offline loopback/synthetic keys; source-only verification' };
fs.writeFileSync(path.join(dir, task + '-command.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report)); console.log(output.slice(-900));
if (result.status !== 0) process.exitCode = 1;
