const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const task = process.argv[2], dir = __dirname, root = process.cwd();
const files = ['src/app/api/education/ai/copilot/route.ts',
  'src/app/api/education/ai/copilot/__tests__/access.test.ts',
  'src/products/bella-education/__tests__/preschool-ai-copilot.test.ts',
  'src/products/bella-education/__tests__/preschool-admin-ai-copilot.test.ts'];
const tests = [files[1], files[2], files[3]];
const nodeCommands = {
  jest: ['node_modules/jest/bin/jest.js', '--runInBand', '--runTestsByPath', ...tests,
    '--json', '--outputFile=' + path.join(dir, 'jest-results.json')],
  lint: ['node_modules/eslint/bin/eslint.js', ...files],
  typecheck: ['scripts/ci-run-typecheck.mjs', 'changed'],
  secrets: ['scripts/check-secret-leaks.mjs', ...files],
};
if (!nodeCommands[task] && !['education', 'healthcare'].includes(task)) throw Error('Unknown check');
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_URL: 'http://127.0.0.1:1',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-offline-anon-key',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-offline-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-offline-service-key', SUPABASE_SECRET_KEY: 'synthetic-offline-service-key',
  GEMINI_API_KEY: '', GOOGLE_API_KEY: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '',
  CI_SCOPE_AFFECTED_PRODUCTS: 'education_preschool', CI_BASE_REF: '30134055d1ff5b846584e57833816f076034cdea',
};
for (const name of Object.keys(env)) {
  if (/(?:DATABASE|SUPABASE_DB|POSTGRES|E2E_SUPABASE_DB).*URL|DB_PASSWORD/.test(name)) env[name] = '';
}
const command = nodeCommands[task] ? process.execPath : process.env.ComSpec || 'cmd.exe';
const args = nodeCommands[task] || ['/d', '/s', '/c', 'npm run ' + task + ':verify'];
const startedAt = new Date().toISOString();
const result = cp.spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 300000,
  maxBuffer: 50000000, windowsHide: true });
const output = ((result.stdout || '') + (result.stderr || '')).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');
fs.writeFileSync(path.join(dir, task + '.log'), output);
const report = { startedAt, finishedAt: new Date().toISOString(), task,
  command: [command, ...args], exitCode: result.status, errorCode: result.error?.code || null,
  signal: result.signal || null, environment: 'Process-scoped loopback offline endpoints and synthetic keys; no production business/model calls' };
fs.writeFileSync(path.join(dir, task + '-command.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
console.log(output.slice(-1800));
if (result.status !== 0) process.exitCode = 1;
