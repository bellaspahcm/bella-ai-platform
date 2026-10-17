// Scoped verifier: no dotenv/Next config loading, DB calls, Auth setup or external network.
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const cache = path.join(root, '.cache/containment-http');
mkdirSync(cache, { recursive: true });
const evidence = {
  scope: 'Real NextResponse handlers and loopback HTTP adapter; not Next routing/Auth/DB/E2E proof',
  baselineCommit: '0bc9bba1b888ca121dd4ae56eb9ff7ebb1c9831f',
  executedAt: new Date().toISOString(),
  commands: [],
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function run(name, args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024,
    windowsHide: true, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  const logFile = path.join(__dirname, `${name}.log`);
  writeFileSync(logFile, output);
  evidence.commands.push({ name, executable: 'node', args, exitCode: result.status,
    error: result.error?.message || null, log: path.relative(root, logFile).replaceAll('\\', '/'), outputSha256: sha256(output) });
  process.stdout.write(`${name}: ${result.status === 0 ? 'PASS' : 'FAIL'}\n${output}\n`);
}

const testFile = 'src/__tests__/preschool-containment.test.ts';
const config = {
  rootDir: root,
  testEnvironment: 'node',
  transform: { '^.+\\.[jt]sx?$': [path.join(root, 'node_modules/next/dist/build/swc/jest-transformer.js'), {}] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1', '^@bella/shared$': '<rootDir>/packages/shared/src/index.ts' },
  testMatch: ['<rootDir>/src/__tests__/preschool-containment.test.ts'],
  setupFilesAfterEnv: [],
};
const configPath = path.join(cache, 'jest.config.json');
writeFileSync(configPath, JSON.stringify(config, null, 2));
run('focused-jest', ['node_modules/jest/bin/jest.js', '--config', configPath, '--runInBand', '--no-cache', '--json', '--outputFile', path.join(cache, 'jest-result.json'), '--runTestsByPath', testFile]);
const jestResult = JSON.parse(readFileSync(path.join(cache, 'jest-result.json'), 'utf8'));
evidence.jest = { success: jestResult.success, suites: jestResult.numPassedTestSuites, passed: jestResult.numPassedTests, failed: jestResult.numFailedTests,
  tests: jestResult.testResults.flatMap((suite) => suite.assertionResults.map((test) => ({ title: test.fullName, status: test.status }))) };
run('focused-eslint', ['node_modules/eslint/bin/eslint.js', 'src/app/api/education/parent-daily/route.ts', 'src/app/api/education/courses/route.ts', testFile]);
run('education-typecheck', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.education.json', '--noEmit', '--incremental', 'false', '--pretty', 'false']);

const ts = require(path.join(root, 'node_modules/typescript'));
const tsconfig = ts.readConfigFile(path.join(root, 'tsconfig.education.json'), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, root);
const program = ts.createProgram([...parsed.fileNames, path.join(root, testFile)], { ...parsed.options, incremental: false });
const diagnostics = ts.getPreEmitDiagnostics(program);
evidence.testTypecheck = { diagnostics: diagnostics.length, files: [...new Set(diagnostics.map((item) => item.file ? path.relative(root, item.file.fileName).replaceAll('\\', '/') : null))] };
writeFileSync(path.join(__dirname, 'test-typecheck.log'), ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: (file) => file, getCurrentDirectory: () => root, getNewLine: () => '\n',
}));

const coursePath = 'src/app/api/education/courses/route.ts';
const baseline = spawnSync('git', ['show', `${evidence.baselineCommit}:${coursePath}`], { cwd: root, encoding: 'utf8', windowsHide: true });
if (baseline.status !== 0) throw new Error('Cannot resolve approved source baseline');
const normalize = (value) => value.replaceAll('\r\n', '\n');
const prefix = (value) => normalize(value).split('export async function POST(')[0];
const before = prefix(baseline.stdout);
const after = prefix(readFileSync(path.join(root, coursePath), 'utf8'));
evidence.courseGetUnchanged = { equal: before === after, baselinePrefixSha256: sha256(before), currentPrefixSha256: sha256(after), lineEndingsNormalized: true };
evidence.sourceHashes = Object.fromEntries(['src/app/api/education/parent-daily/route.ts', coursePath, testFile].map((file) => [file, sha256(readFileSync(path.join(root, file)))]));
evidence.result = evidence.commands.every((item) => item.exitCode === 0) && evidence.jest.failed === 0 && diagnostics.length === 0 && before === after ? 'PASS_SCOPED' : 'FAIL';
writeFileSync(path.join(__dirname, 'http-verification.json'), JSON.stringify(evidence, null, 2) + '\n');
process.stdout.write(`Test typecheck diagnostics: ${diagnostics.length}\nCourse GET unchanged: ${before === after}\nResult: ${evidence.result}\n`);
if (evidence.result !== 'PASS_SCOPED') process.exitCode = 1;
