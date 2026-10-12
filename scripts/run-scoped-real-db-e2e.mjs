import { spawnSync } from 'node:child_process';

const REAL_DB_CONFIG_PATTERN = /^jest\.real-db\.(config|setup)\.ts$/;
const MIGRATION_PATTERN = /^(supabase\/migrations\/|migrations\/|database\/|prisma\/|.*\.sql$)/;

const REAL_DB_TEST_BY_PATH = [
  /^src\/__tests__\/bella-auto-phase5-experience\.test\.ts$/,
  /^src\/__tests__\/beauty-v2-(attendance-branch|payroll-branch|commission-branch|finance-branch|go-live-payroll-commission)-real-db\.test\.ts$/,
  /^src\/__tests__\/e2e-(order-lifecycle-real|refund-full|accounting-gl-verification|payroll-month-close)\.test\.ts$/,
  /^src\/app\/api\/english-center\/__tests__\/post-rc-real-db-validation\.test\.ts$/,
  /^src\/__tests__\/haircut-f3-debt-real-db-diagnostic\.test\.ts$/,
  /^src\/__tests__\/haircut-nail-chain-seal-real-db\.test\.ts$/,
  /^src\/__tests__\/inventory-session-consumption-real-db\.test\.ts$/,
  /^src\/platform\/logistics\/warehouse\/__tests__\/stock-(out-production-consumption|in-production-order)-real-db\.test\.ts$/,
  /^src\/platform\/manufacturing\/__tests__\/manufacturing-(slice1|full-chain)-real-db\.test\.ts$/,
  /^src\/platform\/agriculture\/__tests__\/agriculture-foundation-real-db\.test\.ts$/,
  /^src\/products\/beauty-spa-v2\/__tests__\/beauty-spa-v2-real-db\.test\.ts$/,
  /^src\/products\/bella-education\/__tests__\/preschool-chain-real-db\.test\.ts$/,
  /^src\/products\/bella-hospitality\/__tests__\/(tenant-profile|housekeeping|maintenance)-real-db\.test\.ts$/,
];

const SCOPED_REAL_DB_SUITES = [
  {
    name: 'Agriculture OS foundation',
    patterns: [
      /^src\/platform\/agriculture\//,
      /^supabase\/migrations\/20261012030000_create_agriculture_os_foundation\.sql$/,
    ],
    tests: [
      'src/platform/agriculture/__tests__/agriculture-foundation-real-db.test.ts',
    ],
  },
  {
    name: 'Manufacturing operational readiness',
    patterns: [
      /^src\/platform\/manufacturing\//,
      /^src\/app\/api\/manufacturing\//,
      /^src\/app\/dashboard\/manufacturing\//,
      /^src\/platform\/registry\/product-registry\.ts$/,
      /^src\/platform\/registry\/__tests__\/manufacturing-product-identity\.test\.ts$/,
      /^e2e\/tests\/41-manufacturing-operational-readiness\.spec\.ts$/,
    ],
    tests: [
      'src/platform/manufacturing/__tests__/manufacturing-slice1-real-db.test.ts',
      'src/platform/manufacturing/__tests__/manufacturing-full-chain-real-db.test.ts',
    ],
  },
  {
    name: 'Logistics production stock movement',
    patterns: [
      /^src\/platform\/logistics\/warehouse\/stock-(in|out)/,
      /^src\/platform\/logistics\/warehouse\/postgres-stock-(in|out)-ports\.ts$/,
      /^src\/platform\/logistics\/warehouse\/__tests__\/stock-(out-production-consumption|in-production-order)-real-db\.test\.ts$/,
    ],
    tests: [
      'src/platform/logistics/warehouse/__tests__/stock-out-production-consumption-real-db.test.ts',
      'src/platform/logistics/warehouse/__tests__/stock-in-production-order-real-db.test.ts',
    ],
  },
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
  if (result.status !== 0) return '';
  return result.stdout.trim();
}

function resolveChangedFiles(explicitChangedFiles) {
  if (explicitChangedFiles.length > 0) return explicitChangedFiles;

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
    if (diff) return diff.split(/\r?\n/);
  }

  const previousCommit = gitOutput(['rev-parse', '--verify', 'HEAD^']);
  if (previousCommit) {
    const diff = gitOutput(['diff', '--name-only', 'HEAD^', 'HEAD']);
    return diff ? diff.split(/\r?\n/) : [];
  }

  return [];
}

function normalizePath(file) {
  return file.replace(/\\/g, '/');
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    changedFiles: args.filter((arg) => arg !== '--list-only').filter(Boolean).map(normalizePath),
    listOnly: args.includes('--list-only'),
  };
}

function shouldRunFullSuite(files) {
  return files.some((file) => REAL_DB_CONFIG_PATTERN.test(file) || MIGRATION_PATTERN.test(file));
}

function addTest(tests, file) {
  tests.add(file);
}

function selectScopedTests(files) {
  const selectedTests = new Set();

  for (const file of files) {
    if (REAL_DB_TEST_BY_PATH.some((pattern) => pattern.test(file))) {
      addTest(selectedTests, file);
    }
  }

  for (const suite of SCOPED_REAL_DB_SUITES) {
    if (files.some((file) => suite.patterns.some((pattern) => pattern.test(file)))) {
      for (const test of suite.tests) {
        addTest(selectedTests, test);
      }
    }
  }

  return [...selectedTests];
}

const { changedFiles: explicitChangedFiles, listOnly } = parseArgs();
const changedFiles = resolveChangedFiles(explicitChangedFiles).map(normalizePath);

if (changedFiles.length === 0 || shouldRunFullSuite(changedFiles)) {
  console.log('Running full real database business E2E suite.');
  if (listOnly) {
    process.exit(0);
  }
  const jest = run('npx', ['jest', '--config', 'jest.real-db.config.ts', '--runInBand'], {
    stdio: 'inherit',
  });
  process.exit(jest.status ?? 1);
}

const scopedTests = selectScopedTests(changedFiles);
if (scopedTests.length === 0) {
  console.log('No scoped real database business E2E tests matched changed files.');
  process.exit(0);
}

console.log('Running scoped real database business E2E tests:');
for (const test of scopedTests) {
  console.log(`- ${test}`);
}
if (listOnly) {
  process.exit(0);
}

const jest = run('npx', ['jest', '--config', 'jest.real-db.config.ts', '--runInBand', ...scopedTests], {
  stdio: 'inherit',
});

process.exit(jest.status ?? 1);
