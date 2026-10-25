import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const CODE_FILE_PATTERN = /\.(ts|tsx|js|jsx)$/;
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx)$/;
const DIRECT_TEST_EXCLUDED_PATTERNS = [
  // These suites provision controlled local DB fixtures and are deliberately
  // excluded from related-test discovery below as well. Keep their target guards;
  // they are not mockable unit coverage or evidence of CI database execution.
  /^tests\/products\/bella-education\/finance\/p7[12]-finance-(billing|communication)\.integration\.test\.ts$/,
  /^tests\/products\/bella-education\/finance\/preschool-finance-canonical-identity\.test\.ts$/,
  /^src\/platform\/education\/__tests__\/enrollment-event-recovery-real-db\.test\.ts$/,
  /^e2e\//,
  /^src\/__tests__\/bella-auto-phase5-experience\.test\.ts$/,
  /^src\/__tests__\/e2e-(order-lifecycle-real|refund-full|accounting-gl-verification|payroll-month-close)\.test\.ts$/,
  /^src\/app\/api\/english-center\/__tests__\/post-rc-real-db-validation\.test\.ts$/,
  /^src\/__tests__\/haircut-f3-debt-real-db-diagnostic\.test\.ts$/,
  /^src\/products\/beauty-spa-v2\/__tests__\/beauty-spa-v2-real-db\.test\.ts$/,
  /^src\/products\/bella-education\/__tests__\/preschool-chain-real-db\.test\.ts$/,
  /^src\/products\/bella-hospitality\/__tests__\/(tenant-profile|housekeeping|maintenance)-real-db\.test\.ts$/,
];
const EXCLUDED_PATTERNS = [
  /^scripts\//,
  /^\.github\//,
  /^src\/__tests__\/bella-auto-phase5-experience\.test\.ts$/,
  /\.(test|spec)\.(ts|tsx|js|jsx)$/,
];
const RELATED_TEST_EXCLUDED_PATTERNS = [
  '/node_modules/',
  '/.next/',
  '/e2e/',
  '/playwright-report/',
  '/tests/unit/runtime/',
  '/tests/integration/runtime/',
  '/tests/e2e/runtime/',
  'tests/remediation',
  'tests/integration/',
  'integration.test',
  'real-db',
  'real-e2e',
  'e2e-',
  'database.test',
  'src/__tests__/integration',
  'real-estate-module-isolation.test',
  'bella-english-center/__tests__/enrollment.service.test',
  'bella-english-center/__tests__/program-course-class.service.test',
  'bella-english-center/__tests__/teacher.service.test',
  'verification-gates',
  'phase_d',
  'performance-slo-benchmark',
  '[\\\\/]tests[\\\\/]remediation[\\\\/]',
  '[\\\\/]tests[\\\\/]integration[\\\\/]',
  '\\.integration\\.test\\.[jt]sx?$',
  'real-db.*\\.test\\.[jt]sx?$',
  'real.*e2e.*\\.test\\.[jt]sx?$',
  'e2e-.*\\.test\\.[jt]sx?$',
  'database\\.test\\.[jt]sx?$',
  '[\\\\/]src[\\\\/]__tests__[\\\\/]integration[\\\\/]',
  'verification-gates\\.test\\.[jt]sx?$',
  'phase_d\\d+_.*\\.test\\.[jt]sx?$',
  '[\\\\/]src[\\\\/]__tests__[\\\\/]phase_d\\d+_.*\\.test\\.ts$',
  '[\\\\/]src[\\\\/]__tests__[\\\\/]performance-slo-benchmark\\.test\\.ts$',
  '/src/__tests__/bella-auto-phase5-experience\\.test\\.ts$',
  '/src/__tests__/e2e-order-lifecycle-real\\.test\\.ts$',
  '/src/__tests__/e2e-refund-full\\.test\\.ts$',
  '/src/__tests__/e2e-accounting-gl-verification\\.test\\.ts$',
  '/src/__tests__/e2e-payroll-month-close\\.test\\.ts$',
  '/src/__tests__/auto-phase3-journey-engine\\.test\\.ts$',
  '/src/__tests__/create-booking-payment-status\\.test\\.ts$',
  '/src/__tests__/e2e-salary-comprehensive\\.test\\.ts$',
  '/src/__tests__/healthcare-hospital-inpatient\\.test\\.ts$',
  '/src/__tests__/hospital-clinical-alerts\\.test\\.ts$',
  '/src/app/api/rules/__tests__/rules-api\\.test\\.ts$',
  '/src/modules/bookings/actions/__tests__/service-items-actions\\.test\\.ts$',
  '/tests/products/bella-education/.+\\.integration\\.test\\.ts$',
  '/tests/products/bella-education/finance/preschool-finance-canonical-identity\\.test\\.ts$',
  '/src/platform/finance/__tests__/finance-f1-ledger-verification\\.test\\.ts$',
  '/src/platform/finance/__tests__/finance-f2-projection-worker\\.test\\.ts$',
  '/src/platform/finance/__tests__/finance-f2-concurrency\\.test\\.ts$',
  '/src/platform/finance/__tests__/finance-f2-reconstruction\\.test\\.ts$',
  '/src/platform/finance/__tests__/finance-f2-reporting-api\\.test\\.ts$',
  '/src/platform/real-estate/__tests__/real-estate-kernel\\.integration\\.test\\.ts$',
  '/src/products/bella-english-center/__tests__/enrollment\\.service\\.test\\.ts$',
  '/src/products/bella-english-center/__tests__/program-course-class\\.service\\.test\\.ts$',
  '/src/products/bella-english-center/__tests__/teacher\\.service\\.test\\.ts$',
];
const T1_EDUCATION_TEST_FILES = new Set([
  'src/platform/education/__tests__/verification-gates.test.ts',
  'src/platform/education/__tests__/course-contract-real-db.integration.test.ts',
  'src/platform/education/__tests__/kernel-invariants.integration.test.ts',
]);
const T1_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'BELLA_DISPOSABLE_FIXTURE_MANIFEST',
  'BELLA_FIXTURE_RECEIPT_DIR',
];
const JEST_COUNT_KEYS = [
  'numFailedTestSuites', 'numFailedTests', 'numPassedTestSuites', 'numPassedTests',
  'numPendingTestSuites', 'numPendingTests', 'numRuntimeErrorTestSuites',
  'numTodoTests', 'numTotalTestSuites', 'numTotalTests',
];
const SNAPSHOT_COUNT_KEYS = [
  'added', 'filesAdded', 'filesRemoved', 'filesUnmatched', 'filesUpdated',
  'matched', 'total', 'unchecked', 'unmatched', 'updated',
];

function normalizedPath(file) {
  const resolved = path.resolve(file).replace(/\\/g, '/');
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isT1EducationTest(file) {
  const normalized = file.replace(/\\/g, '/');
  return [...T1_EDUCATION_TEST_FILES].some((test) => normalized === test || normalized.endsWith(`/${test}`));
}

function t1TestEnvironment() {
  const envFile = process.env.BELLA_T1_TEST_ENV_FILE;
  if (!envFile) {
    if (process.env.BELLA_T1_ENV_REQUIRED === 'true') throw new Error('T1_TEST_ENV_FILE_REQUIRED');
    return process.env;
  }
  const values = JSON.parse(readFileSync(envFile, 'utf8'));
  if (!values || Array.isArray(values) || typeof values !== 'object'
      || Object.keys(values).length !== T1_ENV_KEYS.length
      || T1_ENV_KEYS.some((key) => typeof values[key] !== 'string' || !values[key])) {
    throw new Error('T1_TEST_ENV_FILE_INVALID');
  }
  if (values.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:24631') {
    throw new Error('T1_TEST_API_IDENTITY_MISMATCH');
  }
  return { ...process.env, ...values };
}

function readJestResult(outputFile, expectedFiles) {
  if (!existsSync(outputFile)) throw new Error('JEST_JSON_MISSING');
  const result = JSON.parse(readFileSync(outputFile, 'utf8'));
  if (!result || !Array.isArray(result.testResults)
      || JEST_COUNT_KEYS.some((key) => !Number.isInteger(result[key]) || result[key] < 0)
      || typeof result.success !== 'boolean' || typeof result.wasInterrupted !== 'boolean'
      || !Number.isFinite(result.startTime) || !Array.isArray(result.openHandles)
      || !result.snapshot || typeof result.snapshot !== 'object'
      || SNAPSHOT_COUNT_KEYS.some((key) => !Number.isInteger(result.snapshot[key]) || result.snapshot[key] < 0)
      || typeof result.snapshot.didUpdate !== 'boolean'
      || typeof result.snapshot.failure !== 'boolean'
      || !Array.isArray(result.snapshot.filesRemovedList)
      || !Array.isArray(result.snapshot.uncheckedKeysByFile)) {
    throw new Error('JEST_JSON_INVALID');
  }
  const expected = new Set(expectedFiles.map(normalizedPath));
  const observed = result.testResults.map((test) => normalizedPath(test.name));
  if (expected.size !== expectedFiles.length || observed.length !== expected.size
      || observed.some((name) => !expected.has(name)) || new Set(observed).size !== observed.length
      || result.numTotalTestSuites !== observed.length) {
    throw new Error('JEST_SUITE_MISSING_DUPLICATED_OR_UNEXPECTED');
  }
  if (result.testResults.some((test) => !Array.isArray(test.assertionResults))) {
    throw new Error('JEST_ASSERTIONS_INVALID');
  }
  if (result.wasInterrupted || result.numRuntimeErrorTestSuites > 0
      || (!result.success && result.numFailedTests === 0)) {
    throw new Error('JEST_RUNTIME_OR_SUITE_FAILURE');
  }
  return result;
}

function mergeJestResults(results) {
  const combined = {
    ...results[0],
    testResults: results.flatMap((result) => result.testResults),
    openHandles: results.flatMap((result) => result.openHandles ?? []),
    startTime: Math.min(...results.map((result) => result.startTime)),
    success: results.every((result) => result.success),
    wasInterrupted: results.some((result) => result.wasInterrupted),
    snapshot: {
      ...results[0].snapshot,
      didUpdate: results.some((result) => result.snapshot.didUpdate),
      failure: results.some((result) => result.snapshot.failure),
      filesRemovedList: results.flatMap((result) => result.snapshot.filesRemovedList),
      uncheckedKeysByFile: results.flatMap((result) => result.snapshot.uncheckedKeysByFile),
    },
  };
  for (const key of JEST_COUNT_KEYS) {
    combined[key] = results.reduce((total, result) => total + result[key], 0);
  }
  for (const key of SNAPSHOT_COUNT_KEYS) {
    combined.snapshot[key] = results.reduce((total, result) => total + result.snapshot[key], 0);
  }
  if (combined.testResults.length !== combined.numTotalTestSuites) {
    throw new Error('JEST_MERGED_SUITE_COUNT_MISMATCH');
  }
  return combined;
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  });
}

function gitOutput(args) {
  const result = run('git', args);
  if (result.status !== 0) {
    return '';
  }
  return result.stdout.trim();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const jsonOutputIndex = args.indexOf('--jest-json-output');
  const jestJsonOutput = jsonOutputIndex === -1 ? undefined : args[jsonOutputIndex + 1];
  const changedFiles = args.filter((arg, index) => (
    arg !== '--jest-json-output'
    && (jsonOutputIndex === -1 || index !== jsonOutputIndex + 1)
  ));

  return { jestJsonOutput, changedFiles };
}

function writeEmptyJestResult(outputPath) {
  const emptyResult = {
    numFailedTests: 0,
    numPassedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    numTotalTests: 0,
    success: true,
    testResults: [],
  };

  writeFileSync(outputPath, `${JSON.stringify(emptyResult)}\n`, 'utf8');
}

function runJestRuns(sourceFiles, directTestFiles, jestJsonOutput) {
  let relatedTestFiles = [];
  if (sourceFiles.length > 0) {
    const args = ['jest', '--listTests', '--findRelatedTests', ...sourceFiles];
    for (const pattern of RELATED_TEST_EXCLUDED_PATTERNS) {
      args.push('--testPathIgnorePatterns', pattern);
    }
    const result = run('npx', args);
    if (result.status !== 0) return result.status ?? 1;
    relatedTestFiles = (result.stdout ?? '').split(/\r?\n/).map((file) => file.trim()).filter(Boolean);
  }

  const testFiles = [...new Map([...relatedTestFiles, ...directTestFiles]
    .map((file) => [normalizedPath(file), file])).values()];
  if (testFiles.length === 0) {
    if (jestJsonOutput) writeEmptyJestResult(jestJsonOutput);
    console.log('No related or changed Jest tests were selected.');
    return 0;
  }

  const normalTests = testFiles.filter((file) => !isT1EducationTest(file));
  const educationTests = testFiles.filter(isT1EducationTest);
  const educationEnv = educationTests.length > 0 ? t1TestEnvironment() : undefined;
  const normalEnv = { ...process.env };
  delete normalEnv.BELLA_T1_TEST_ENV_FILE;
  if (educationEnv && process.env.BELLA_T1_TEST_ENV_FILE) {
    for (const key of T1_ENV_KEYS) {
      if (normalEnv[key] === educationEnv[key]) delete normalEnv[key];
    }
  }
  const groups = [
    { name: 'normal', files: normalTests, env: normalEnv },
    ...(educationTests.length > 0
      ? [{ name: 'education-t1', files: educationTests, env: educationEnv }]
      : []),
  ].filter((group) => group.files.length > 0);
  const results = [];
  let exitCode = 0;
  for (const group of groups) {
    const groupOutput = jestJsonOutput && groups.length > 1
      ? `${jestJsonOutput}.${group.name}.partial.json`
      : jestJsonOutput;
    if (groupOutput && existsSync(groupOutput)) unlinkSync(groupOutput);
    const jestArgs = ['jest', '--runInBand', '--runTestsByPath', ...group.files];
    if (groupOutput) jestArgs.push('--json', '--outputFile', groupOutput);
    const jest = run('npx', jestArgs, { stdio: 'inherit', env: group.env });
    if (jest.error || jest.signal || !Number.isInteger(jest.status)) {
      throw new Error(`JEST_PROCESS_FAILED:${group.name}`);
    }
    if (jest.status !== 0) exitCode = jest.status;
    if (groupOutput) {
      results.push(readJestResult(groupOutput, group.files));
      if (groupOutput !== jestJsonOutput) unlinkSync(groupOutput);
    }
  }
  if (jestJsonOutput && results.length > 1) {
    writeFileSync(jestJsonOutput, `${JSON.stringify(mergeJestResults(results))}\n`, 'utf8');
  }
  return exitCode;
}

function resolveChangedFiles(explicitChangedFiles) {
  if (explicitChangedFiles.length > 0) {
    return explicitChangedFiles;
  }

  const eventName = process.env.GITHUB_EVENT_NAME;
  const baseRef = process.env.GITHUB_BASE_REF;

  if (eventName === 'pull_request' && baseRef) {
    run('git', ['fetch', '--no-tags', '--depth=1', 'origin', baseRef], { stdio: 'ignore' });
    const diff = gitOutput(['diff', '--name-only', `origin/${baseRef}...HEAD`]);
    return diff ? diff.split(/\r?\n/) : [];
  }

  const originMain = gitOutput(['rev-parse', '--verify', 'origin/main']);
  if (originMain) {
    const diff = gitOutput(['diff', '--name-only', 'origin/main...HEAD']);
    if (diff) {
      return diff.split(/\r?\n/);
    }
  }

  const previousCommit = gitOutput(['rev-parse', '--verify', 'HEAD^']);
  if (previousCommit) {
    const diff = gitOutput(['diff', '--name-only', 'HEAD^', 'HEAD']);
    return diff ? diff.split(/\r?\n/) : [];
  }

  return [];
}

const { jestJsonOutput, changedFiles: explicitChangedFiles } = parseArgs();
if (jestJsonOutput && existsSync(jestJsonOutput)) unlinkSync(jestJsonOutput);
const changedFiles = resolveChangedFiles(explicitChangedFiles);
const sourceFiles = changedFiles.filter((file) => (
  CODE_FILE_PATTERN.test(file)
  && !EXCLUDED_PATTERNS.some((pattern) => pattern.test(file))
));
const testFiles = changedFiles.filter((file) => (
  TEST_FILE_PATTERN.test(file)
  && !DIRECT_TEST_EXCLUDED_PATTERNS.some((pattern) => pattern.test(file))
));

if (sourceFiles.length === 0) {
  if (testFiles.length > 0) {
    console.log(`Running ${testFiles.length} changed Jest test file(s):`);
    for (const file of testFiles) {
      console.log(`- ${file}`);
    }

    process.exit(runJestRuns([], testFiles, jestJsonOutput));
  }

  console.log('No changed application source files with related Jest coverage.');
  if (jestJsonOutput) {
    writeEmptyJestResult(jestJsonOutput);
  }
  process.exit(0);
}

console.log(`Running Jest tests related to ${sourceFiles.length} changed source file(s):`);
for (const file of sourceFiles) {
  console.log(`- ${file}`);
}
if (testFiles.length > 0) {
  console.log(`Running ${testFiles.length} changed Jest test file(s) directly:`);
  for (const file of testFiles) console.log(`- ${file}`);
}
process.exit(runJestRuns(sourceFiles, testFiles, jestJsonOutput));
