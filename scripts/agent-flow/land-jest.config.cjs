const path = require('node:path');

// This slice mocks its read boundaries. Do not load Next config, dotenv or
// the repository setup that initializes business integrations.
module.exports = {
  rootDir: path.resolve(__dirname, '../..'),
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  testMatch: ['<rootDir>/src/app/dashboard/real-estate/__tests__/agent-flow-read-truth.test.tsx'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: { '^.+\\.[jt]sx?$': ['next/dist/build/swc/jest-transformer', {}] },
  transformIgnorePatterns: ['/node_modules/'],
};
