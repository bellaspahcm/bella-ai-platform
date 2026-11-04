const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const mode = process.argv[2] || 'education';
const out = __dirname;
const env = { ...process.env, NODE_ENV: 'test', NEXT_PUBLIC_SUPABASE_URL: 'https://mock.supabase.co', SUPABASE_URL: 'https://mock.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'mock-anon-key', SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key', SUPABASE_SECRET_KEY: 'mock-service-role-key', DATABASE_URL: 'postgresql://audit:audit@127.0.0.1:1/audit', SUPABASE_DB_URL: 'postgresql://audit:audit@127.0.0.1:1/audit', SUPABASE_DATABASE_URL: 'postgresql://audit:audit@127.0.0.1:1/audit', NEXT_TELEMETRY_DISABLED: '1' };
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
const roots = ['src/products/bella-education', 'src/platform/education', 'src/app/api/education', 'src/app/dashboard/education'];
const testFiles = roots.flatMap(walk).filter(f => /\.test\.[jt]sx?$/.test(f) && !/real-db/.test(f));
const command = mode === 'healthcare' ? ['npm', ['run', 'healthcare:verify']] : ['node', ['node_modules/jest/bin/jest.js', '--runInBand', '--runTestsByPath', ...testFiles, '--json', `--outputFile=${path.join(out,'education-jest.json')}`]];
const startedAt = new Date().toISOString();
const result = spawnSync(command[0], command[1], { env, encoding: 'utf8', shell: mode === 'healthcare', timeout: 420000, maxBuffer: 32*1024*1024 });
fs.writeFileSync(path.join(out, `${mode}-tests.log`), (result.stdout || '') + '\n' + (result.stderr || ''));
const summary = { mode, startedAt, finishedAt: new Date().toISOString(), command: [command[0], ...command[1]], exitCode: result.status, signal: result.signal, errorCode: result.error?.code, testFiles: mode === 'education' ? testFiles.length : undefined, environment: 'Offline/mock Supabase; real DB suites excluded; no production credentials passed' };
if (mode === 'education' && fs.existsSync(path.join(out,'education-jest.json'))) { const j=JSON.parse(fs.readFileSync(path.join(out,'education-jest.json'),'utf8')); Object.assign(summary, { suites: { total:j.numTotalTestSuites, passed:j.numPassedTestSuites, failed:j.numFailedTestSuites, pending:j.numPendingTestSuites }, tests: { total:j.numTotalTests, passed:j.numPassedTests, failed:j.numFailedTests, pending:j.numPendingTests }, failures: j.testResults.filter(t => t.status !== 'passed').map(t => ({ file:path.relative(process.cwd(),t.name), status:t.status, message:t.message.slice(0,1800) })) }); }
fs.writeFileSync(path.join(out,`${mode}-summary.json`), JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
process.exitCode = result.status === 0 ? 0 : 1;
