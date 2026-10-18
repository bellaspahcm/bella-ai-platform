// Isolated component verification; deliberately does not load project Jest
// setup, Next config or ENV files. Never use this as DB/auth/E2E evidence.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const envAttempts = [];
for (const method of ['readFileSync', 'readFile']) {
  const original = fs[method];
  fs[method] = function (file, ...args) {
    if (typeof file === 'string' && /^\.env(?:\.|$)/i.test(path.basename(file))) {
      envAttempts.push(path.basename(file));
      throw new Error('ENV reads prohibited in isolated component tests');
    }
    return original.call(this, file, ...args);
  };
}
const deny = () => { throw new Error('Outbound access prohibited in isolated component tests'); };
require('node:net').Socket.prototype.connect = deny;
require('node:http').request = deny;
require('node:http').get = deny;
require('node:https').request = deny;
require('node:https').get = deny;
global.fetch = deny;

(async () => {
  const createConfig = require('next/jest')({});
  const config = await createConfig({
    rootDir: root,
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/docs/audits/preschool-grades-trial/offline-setup.cjs'],
    moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    testMatch: [
      '<rootDir>/src/app/dashboard/education/grades/__tests__/page.test.tsx',

    ],
    cache: false,
    watchman: false,
  })();
  const { results } = await require('jest').runCLI({
    config: JSON.stringify(config),
    runInBand: true,
    silent: true,
    json: true,
    outputFile: path.join(__dirname, 'focused-tests.json'),
  }, [root]);
  fs.writeFileSync(path.join(__dirname, 'focused-tests.json'), JSON.stringify({
    result: results.success ? 'PASS_SCOPED' : 'FAIL',
    passed: results.numPassedTests, failed: results.numFailedTests, total: results.numTotalTests,
    tests: results.testResults.flatMap(suite => suite.testResults.map(test => ({ name: test.fullName, status: test.status }))),
    scope: 'Synthetic component interactions only; project ENV and network denied; no Auth/DB evidence',
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, 'offline-boundary.json'), JSON.stringify({
    executedAt: new Date().toISOString(),
    projectEnvSetupLoaded: false,
    nextConfigLoaded: false,
    envReadAttempts: envAttempts,
    outbound: 'DENIED',
    evidenceScope: 'Synthetic component interaction only; no Auth, DB, tenant isolation or full-page E2E proof',
  }, null, 2) + '\n');
  process.exitCode = results.success && envAttempts.length === 0 ? 0 : 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
