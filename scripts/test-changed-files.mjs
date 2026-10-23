import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const CODE_FILE_PATTERN = /\.(ts|tsx|js|jsx)$/;
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx)$/;
const DIRECT_TEST_EXCLUDED_PATTERNS = [
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

function mergeJestResults(outputPath, resultPaths) {
  const suitesByName = new Map();
  for (const resultPath of resultPaths) {
    if (!resultPath) continue;
    const result = JSON.parse(readFileSync(resultPath, 'utf8'));
    if (!Array.isArray(result.testResults)) {
      throw new Error(`Jest output is missing testResults: ${resultPath}`);
    }
    for (const suite of result.testResults) {
      suitesByName.set(suite.name, suite);
    }
  }

  const testResults = [...suitesByName.values()];
  const assertionResults = testResults.flatMap((suite) => suite.assertionResults ?? []);
  const counts = {
    numFailedTests: assertionResults.filter((test) => test.status === 'failed').length,
    numPassedTests: assertionResults.filter((test) => test.status === 'passed').length,
    numPendingTests: assertionResults.filter((test) => test.status === 'pending').length,
    numTodoTests: assertionResults.filter((test) => test.status === 'todo').length,
    numFailedTestSuites: testResults.filter((suite) => suite.status === 'failed').length,
    numPassedTestSuites: testResults.filter((suite) => suite.status === 'passed').length,
    numPendingTestSuites: testResults.filter((suite) => suite.status === 'pending').length,
    numRuntimeErrorTestSuites: testResults.filter((suite) => suite.status === 'failed' && !(suite.assertionResults?.length)).length,
  };
  writeFileSync(outputPath, `${JSON.stringify({
    ...counts,
    numTotalTests: assertionResults.length,
    numTotalTestSuites: testResults.length,
    success: counts.numFailedTests === 0 && counts.numFailedTestSuites === 0,
    testResults,
  })}\n`, 'utf8');
}

function runJestRuns(sourceFiles, directTestFiles, jestJsonOutput) {
  const resultPaths = [];
  let exitCode = 0;
  const runs = [];
  if (sourceFiles.length > 0) {
    const args = ['jest', '--findRelatedTests', ...sourceFiles, '--runInBand', '--passWithNoTests'];
    for (const pattern of RELATED_TEST_EXCLUDED_PATTERNS) {
      args.push('--testPathIgnorePatterns', pattern);
    }
    runs.push({ args, suffix: 'related' });
  }
  if (directTestFiles.length > 0) {
    runs.push({ args: ['jest', '--runInBand', '--runTestsByPath', ...directTestFiles], suffix: 'direct' });
  }

  for (const { args, suffix } of runs) {
    let outputPath;
    if (jestJsonOutput) {
      outputPath = `${jestJsonOutput}.${suffix}.json`;
      args.push('--json', '--outputFile', outputPath);
      resultPaths.push(outputPath);
    }
    const result = run('npx', args, { stdio: 'inherit' });
    if (result.status !== 0) exitCode = result.status ?? 1;
  }

  if (jestJsonOutput) {
    mergeJestResults(jestJsonOutput, resultPaths);
    for (const resultPath of resultPaths) unlinkSync(resultPath);
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
