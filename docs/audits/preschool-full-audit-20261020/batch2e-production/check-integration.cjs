const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const summary = JSON.parse(fs.readFileSync(path.join(__dirname, 'source-groups-summary.json'))), task = process.argv[2];
const root = process.cwd(), dir = path.join(root, 'docs/audits/preschool-full-audit-20261020/batch2j-delivery'); fs.mkdirSync(dir, { recursive: true });
const files = summary.groups.flatMap(group => group.files);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const gitBlob = (cwd, ref, file) => {
  const run = cp.spawnSync('git', ['rev-parse', ref + ':' + file], { cwd, encoding: 'utf8', windowsHide: true });
  if (run.status !== 0) throw Error('Cannot prove committed blob identity'); return run.stdout.trim();
};
const composition = summary.groups.flatMap(group => {
  const seal = JSON.parse(fs.readFileSync(path.join(__dirname, group.group + '-local-commit.json')));
  return group.files.map(file => {
    const original = fs.readFileSync(path.join(group.root, file.file)), integrated = fs.readFileSync(path.join(root, file.file));
    const expectedBlob = gitBlob(group.root, seal.commit, file.file), actualBlob = gitBlob(root, 'HEAD', file.file);
    return { file: file.file, expectedWorkingSha256: file.sha256, originalWorkingSha256: hash(original), integratedWorkingSha256: hash(integrated),
      normalizedBytesEqual: hash(original.toString('utf8').replace(/\r\n/g, '\n')) === hash(integrated.toString('utf8').replace(/\r\n/g, '\n')),
      originalCommit: seal.commit, expectedBlob, actualBlob, committedBlobEqual: expectedBlob === actualBlob };
  });
});
const validComposition = composition.every(row => row.originalWorkingSha256 === row.expectedWorkingSha256 && row.normalizedBytesEqual && row.committedBlobEqual);
fs.writeFileSync(path.join(dir, 'source-composition.json'), JSON.stringify({ capturedAt: new Date().toISOString(), criterion: 'Exact committed Git blob identity plus original working SHA256 and CRLF-only working representation comparison', files: composition, result: validComposition ? 'PASS' : 'FAIL' }, null, 2) + '\n');
if (!validComposition) throw Error('Integrated source differs from reviewed group');
const names = files.map(file => file.file);
const commands = {
  jest: ['node_modules/jest/bin/jest.js', '--runInBand', '--runTestsByPath', ...names.filter(file => file.endsWith('.test.ts')), '--json', '--outputFile=' + path.join(dir, 'jest-results.json')],
  lint: ['node_modules/eslint/bin/eslint.js', ...names], typecheck: ['scripts/ci-run-typecheck.mjs', 'changed'], secrets: ['scripts/check-secret-leaks.mjs', ...names],
};
if (!commands[task]) throw Error('Unknown integration task');
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_URL: 'http://127.0.0.1:1', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-offline-anon-key', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-offline-anon-key', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-offline-service-key', SUPABASE_SECRET_KEY: 'synthetic-offline-service-key', NEXTAUTH_SECRET: 'synthetic-offline-signing-key', GEMINI_API_KEY: '', GOOGLE_API_KEY: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '', CI_SCOPE_AFFECTED_PRODUCTS: 'education_preschool', CI_BASE_REF: summary.baseline };
for (const name of Object.keys(env)) if (/(?:DATABASE|SUPABASE_DB|POSTGRES|E2E_SUPABASE_DB).*URL|DB_PASSWORD/.test(name)) env[name] = '';
const head = cp.spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim();
const startedAt = new Date().toISOString();
const run = cp.spawnSync(process.execPath, commands[task], { cwd: root, env, encoding: 'utf8', timeout: 300000, maxBuffer: 50000000, windowsHide: true });
const output = ((run.stdout || '') + (run.stderr || '')).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');
fs.writeFileSync(path.join(dir, task + '.log'), output);
const report = { task, startedAt, finishedAt: new Date().toISOString(), sourceHead: head, sourceMatchesReviewedGroups: true, command: [process.execPath, ...commands[task]], exitCode: run.status, errorCode: run.error?.code || null, signal: run.signal || null, environment: 'Combined source; loopback offline DB, synthetic keys; no real Auth/DB/model operations' };
fs.writeFileSync(path.join(dir, task + '-command.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report)); console.log(output.slice(-2500)); if (run.status !== 0) process.exitCode = 1;
