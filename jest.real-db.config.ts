import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts', '<rootDir>/jest.real-db.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '<rootDir>/src/__tests__/bella-auto-phase5-experience.test.ts',
    '<rootDir>/src/__tests__/e2e-order-lifecycle-real.test.ts',
    '<rootDir>/src/__tests__/e2e-refund-full.test.ts',
    '<rootDir>/src/__tests__/e2e-accounting-gl-verification.test.ts',
    '<rootDir>/src/__tests__/e2e-payroll-month-close.test.ts',
    '<rootDir>/src/app/api/english-center/__tests__/post-rc-real-db-validation.test.ts',
    '<rootDir>/src/__tests__/haircut-f3-debt-real-db-diagnostic.test.ts',
    '<rootDir>/src/__tests__/haircut-nail-chain-seal-real-db.test.ts',
    '<rootDir>/src/__tests__/inventory-session-consumption-real-db.test.ts',
    '<rootDir>/src/__tests__/beauty-v2-attendance-branch-real-db.test.ts',
    '<rootDir>/src/__tests__/beauty-v2-payroll-branch-real-db.test.ts',
    '<rootDir>/src/__tests__/beauty-v2-commission-branch-real-db.test.ts',
    '<rootDir>/src/__tests__/beauty-v2-finance-branch-real-db.test.ts',
    '<rootDir>/src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts',
    '<rootDir>/src/platform/beauty/application/__tests__/beauty-history-real-db.test.ts',
    '<rootDir>/src/platform/logistics/warehouse/__tests__/stock-in-production-order-real-db.test.ts',
    '<rootDir>/src/platform/logistics/warehouse/__tests__/stock-out-production-consumption-real-db.test.ts',
    '<rootDir>/src/platform/manufacturing/__tests__/manufacturing-full-chain-real-db.test.ts',
    '<rootDir>/src/platform/manufacturing/__tests__/manufacturing-slice1-real-db.test.ts',
    '<rootDir>/src/platform/agriculture/__tests__/agriculture-foundation-real-db.test.ts',
    '<rootDir>/src/platform/construction/__tests__/construction-foundation-real-db.test.ts',
    '<rootDir>/src/products/beauty-spa-v2/__tests__/beauty-spa-v2-real-db.test.ts',
    '<rootDir>/src/products/bella-education/__tests__/preschool-chain-real-db.test.ts',
    '<rootDir>/src/products/bella-hospitality/__tests__/tenant-profile-real-db.test.ts',
    '<rootDir>/src/products/bella-hospitality/__tests__/housekeeping-real-db.test.ts',
    '<rootDir>/src/products/bella-hospitality/__tests__/maintenance-real-db.test.ts',
  ],
}

export default createJestConfig(config)
