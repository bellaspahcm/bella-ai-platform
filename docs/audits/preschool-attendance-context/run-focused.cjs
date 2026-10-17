// Offline UI proof only. nextJest has no `dir`, so it does not load Next config or .env.
const path = require('node:path');
const fs = require('node:fs');
const rootDir = path.resolve(__dirname, '../../..');
const nextJest = require('next/jest');
const { runCLI } = require('jest');

const readFileSync = fs.readFileSync;
fs.readFileSync = function (file, ...args) {
  if (typeof file === 'string' && /^\.env(?:\.|$)/.test(path.basename(file))) {
    throw new Error('ENV file access denied by attendance UI proof');
  }
  return readFileSync.call(this, file, ...args);
};

const createConfig = nextJest({});
async function main() {
  const config = await createConfig({
    rootDir,
    testEnvironment: 'jsdom',
    moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    setupFiles: ['<rootDir>/docs/audits/preschool-attendance-context/offline-guard.cjs'],
    testMatch: ['<rootDir>/src/app/dashboard/education/attendance/__tests__/page.test.tsx'],
    cache: false,
  })();
  const result = await runCLI({
    config: JSON.stringify(config),
    runInBand: true,
    json: true,
    outputFile: path.join(__dirname, 'focused-tests.json'),
  }, [rootDir]);
  process.exitCode = result.results.success ? 0 : 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
