'use strict';
// Attribution only. Never supplies real credentials or enables real-DB fixtures.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..');
const baseline = path.resolve(root, '../../preschool-care-catalog-contract-20261021/BELLA SPA ERP');
const expectedHead = '6b031511fd37e5ee22288676b833cf855d40b43f';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw Error('GIT_INSPECTION_FAILED');
  return result.stdout.trim();
}
const environmentFiles = ['.env', '.env.local', '.env.test', '.env.test.local', '.env.production', '.env.production.local'];
for (const cwd of [root, baseline]) {
  if (git(['rev-parse', 'HEAD'], cwd) !== expectedHead) throw Error('SOURCE_REVISION_CHANGED');
  if (environmentFiles.some(file => fs.existsSync(path.join(cwd, file)))) throw Error('DOTENV_NOT_ALLOWED');
}
if (git(['status', '--porcelain', '--', 'src', 'packages', 'package.json', 'package-lock.json', 'jest.config.ts', 'jest.setup.ts', 'next.config.ts'], baseline)) throw Error('BASELINE_RUNTIME_NOT_PRISTINE');
const frozen = JSON.parse(fs.readFileSync(path.join(root, 'docs/audits/preschool-full-audit-20261020/batch2o-care-catalog/FROZEN_BEFORE.json'))).files;
for (const [file, sha] of Object.entries(frozen)) for (const cwd of [root, baseline]) {
  if (hash(fs.readFileSync(path.join(cwd, file))) !== sha) throw Error('FROZEN_SOURCE_CHANGED');
}
const variables = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA'];
const env = Object.fromEntries(variables.filter(key => process.env[key]).map(key => [key, process.env[key]]));
Object.assign(env, { NODE_ENV: 'test', NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'https://mock.supabase.co', SUPABASE_URL: 'https://mock.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key', SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key' });
const evidence = { capturedAt: new Date().toISOString(), intent: 'BASELINE_ATTRIBUTION_ONLY',
  baselineHead: expectedHead, baseline, current: root, existingFrozenFilesUnchanged: Object.keys(frozen).length,
  credentialsSupplied: false, dotenvFilesAllowed: false, productionTarget: false, e2eTarget: false,
  commands: [], reseal: 'HELD', fullRegression: 'NOT_PROVEN' };
function save() { fs.writeFileSync(path.join(__dirname, `baseline-comparison-${stamp}.json`), JSON.stringify(evidence, null, 2) + '\n'); }
for (const name of ['education:verify', 'healthcare:verify']) {
  console.log(JSON.stringify({ stage: 'BASELINE_START', command: `npm run ${name}` }));
  const startedAt = new Date().toISOString();
  const command = spawnSync(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', `npm run ${name}`],
    { cwd: baseline, env, encoding: 'utf8', windowsHide: true, timeout: 8 * 60_000, maxBuffer: 16 * 1024 * 1024 });
  const logName = `baseline-${name.split(':')[0]}-${stamp}.log`;
  const output = `${command.stdout || ''}\n${command.stderr || ''}`;
  // Only placeholder credentials exist in the child, and no DB row is reachable.
  if (/sb_(?:secret|publishable)_[A-Za-z0-9_-]+|postgres(?:ql)?:\/\/[^\s]+|eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(output)) throw Error('OUTPUT_SECRET_PATTERN_REJECTED');
  fs.writeFileSync(path.join(__dirname, logName), output);
  const priorDir = name.startsWith('education') ? 'batch2o-care-catalog' : 'batch2n-care-browser';
  const prior = fs.readFileSync(path.join(root, `docs/audits/preschool-full-audit-20261020/${priorDir}/${name.split(':')[0]}-verify.log`), 'utf8');
  const failedSuites = value => [...new Set([...value.matchAll(/^FAIL[ \t]+([^\r\n]+?\.(?:test|spec)\.[jt]sx?)(?:[ \t]+\([^\r\n]*\))?[ \t]*$/gm)].map(match => match[1].replaceAll('\\', '/')))].sort();
  const suiteDifference = (left, right) => left.filter(file => !right.includes(file));
  const baselineFailed = failedSuites(output), currentFailed = failedSuites(prior);
  const item = { command: `npm run ${name}`, startedAt, finishedAt: new Date().toISOString(),
    actualNativeExitCode: command.status, signal: command.signal, spawnError: command.error?.code || null,
    log: logName, failedSuitesBaseline: baselineFailed, failedSuitesCurrentPriorRun: currentFailed,
    onlyBaseline: suiteDifference(baselineFailed, currentFailed), onlyCurrent: suiteDifference(currentFailed, baselineFailed),
    summaries: output.split(/\r?\n/).filter(line => /^(Test Suites:|Tests:)/.test(line)),
    mockDnsFailureObserved: output.includes('ENOTFOUND mock.supabase.co'),
    result: command.status === 1 && baselineFailed.length && !suiteDifference(baselineFailed, currentFailed).length && !suiteDifference(currentFailed, baselineFailed).length
      ? 'SAME_FAILED_SUITE_SET_ON_PRISTINE_BASELINE' : 'INSPECT_DIFFERENCE' };
  evidence.commands.push(item); save();
  console.log(JSON.stringify({ stage: 'BASELINE_DONE', command: item.command, actualNativeExitCode: item.actualNativeExitCode,
    failedSuites: baselineFailed.length, result: item.result, log: logName }));
}
evidence.finishedAt = new Date().toISOString();
evidence.priorEvidenceApplicability = 'Current comparison uses retained raw executions, not a fresh rerun. Equal suite sets do not prove all causes or test outcomes equal.';
save();
console.log(JSON.stringify({ result: 'ATTRIBUTION_RECORDED_RESEAL_HELD', evidence: `baseline-comparison-${stamp}.json` }));
