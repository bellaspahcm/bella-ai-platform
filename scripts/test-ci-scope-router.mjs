import assert from 'node:assert/strict';
import { classifyFiles } from './ci-scope-router.mjs';

function route(files) {
  return classifyFiles(files);
}

function assertIncludes(actual, expected, message) {
  assert.ok(actual.includes(expected), `${message}: expected ${actual.join(',')} to include ${expected}`);
}

const cases = [
  {
    name: 'ALLOW product-only English Center change',
    files: ['src/products/bella-english-center/services/enrollment.service.ts'],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.scope_level, 'product');
      assert.deepEqual(result.products, ['english_center']);
      assert.equal(result.typecheck_mode, 'changed');
      assert.equal(result.needs_migration_gates, false);
      assert.equal(result.needs_dependency_security_deep, false);
      assert.equal(result.needs_security_lightweight, true);
    },
  },
  {
    name: 'ALLOW Education OS change and expand affected products',
    files: ['src/platform/education/contracts/enrollment.contract.ts'],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.scope_level, 'os');
      assert.deepEqual(result.os, ['education']);
      assertIncludes(result.affected_products, 'education_preschool', 'preschool should be affected by Education OS');
      assertIncludes(result.affected_products, 'english_center', 'English Center should be affected by Education OS');
      assert.equal(result.typecheck_mode, 'affected');
    },
  },
  {
    name: 'ALLOW platform change and require full evidence',
    files: ['src/core/runtime/tenant-context.ts'],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.scope_level, 'platform');
      assert.equal(result.typecheck_mode, 'full');
      assert.equal(result.needs_real_db_e2e, true);
      assert.equal(result.needs_build, true);
    },
  },
  {
    name: 'SKIP migration gates when no migration changed',
    files: ['src/products/bella-english-center/types/class.types.ts'],
    expect(result) {
      assert.equal(result.needs_migration_gates, false);
    },
  },
  {
    name: 'RUN migration gates when migration changed',
    files: ['supabase/migrations/202609140001_add_english_center_table.sql'],
    expect(result) {
      assert.equal(result.needs_migration_gates, true);
      assert.equal(result.needs_build, false);
      assert.equal(result.needs_real_db_e2e, true);
      assert.equal(result.typecheck_mode, 'skip');
    },
  },
  {
    name: 'SKIP API docs when no API/docs surface changed',
    files: ['src/products/bella-english-center/services/teacher.service.ts'],
    expect(result) {
      assert.equal(result.needs_api_docs, false);
    },
  },
  {
    name: 'RUN API docs when API surface changed',
    files: ['src/app/api/english-center/classes/route.ts'],
    expect(result) {
      assert.equal(result.needs_api_docs, true);
    },
  },
  {
    name: 'RUN dependency deep security on dependency file change',
    files: ['package-lock.json'],
    expect(result) {
      assert.equal(result.scope_level, 'platform');
      assert.equal(result.dependencies_changed, true);
      assert.equal(result.needs_dependency_security_deep, true);
      assert.equal(result.needs_real_db_e2e, false);
      assert.equal(result.typecheck_mode, 'full');
    },
  },
  {
    name: 'SKIP typecheck for workflow-only CI policy change',
    files: ['.github/workflows/ci-tests.yml', 'scripts/ci-scope-router.mjs'],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.scope_level, 'platform');
      assert.equal(result.needs_typecheck, false);
      assert.equal(result.typecheck_mode, 'skip');
      assert.equal(result.needs_real_db_e2e, false);
    },
  },
  {
    name: 'RUN affected typecheck for scoped Education tsconfig change',
    files: ['tsconfig.education.json', 'tsconfig.english-center.json'],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.scope_level, 'os');
      assert.equal(result.needs_typecheck, true);
      assert.equal(result.typecheck_mode, 'affected');
      assert.equal(result.needs_real_db_e2e, false);
      assertIncludes(result.affected_products, 'english_center', 'English Center should be affected by scoped Education config');
    },
  },
  {
    name: 'RUN real database E2E only for platform runtime DB surface',
    files: ['src/services/database/transaction-boundary.ts'],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.scope_level, 'platform');
      assert.equal(result.has_db_runtime_surface, true);
      assert.equal(result.needs_real_db_e2e, true);
    },
  },
  {
    name: 'SKIP real database E2E for Beauty typography presentation-only CSS and shell class',
    files: [
      'ARCHITECTURE_GATE_RESULT.md',
      'src/app/globals.css',
      'src/components/layout/DashboardLoadingShell.tsx',
    ],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.scope_level, 'platform');
      assert.equal(result.has_db_runtime_surface, false);
      assert.equal(result.needs_real_db_e2e, false);
      assert.equal(result.needs_build, true);
      assert.equal(result.needs_typecheck, true);
      assert.equal(result.typecheck_mode, 'full');
    },
  },
  {
    name: 'RUN real database E2E for Bella Auto service surface',
    files: [
      'src/modules/bella-auto/services/CustomerHealthScoreService.ts',
      'src/modules/bella-auto/services/FinancialReportingService.ts',
      'src/modules/bella-auto/services/RepairOrderService.ts',
    ],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.needs_tests, true);
      assert.equal(result.needs_real_db_e2e, true);
      assert.equal(result.typecheck_mode, 'changed');
    },
  },
  {
    name: 'RUN real database E2E when real-db Jest config changes',
    files: [
      'jest.real-db.config.ts',
      'jest.real-db.setup.ts',
    ],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.needs_tests, true);
      assert.equal(result.needs_real_db_e2e, true);
      assert.equal(result.has_real_db_test_config, true);
    },
  },
  {
    name: 'RUN real database E2E when real-db test file changes',
    files: ['src/products/bella-hospitality/__tests__/housekeeping-real-db.test.ts'],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.scope_level, 'product');
      assert.deepEqual(result.products, ['hospitality']);
      assert.equal(result.needs_tests, true);
      assert.equal(result.needs_real_db_e2e, true);
      assert.equal(result.has_real_db_test_file, true);
    },
  },
  {
    name: 'RUN real database E2E when Beauty V2 branch Real DB proof changes',
    files: [
      'src/__tests__/beauty-v2-commission-branch-real-db.test.ts',
      'src/__tests__/beauty-v2-finance-branch-real-db.test.ts',
    ],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.needs_tests, true);
      assert.equal(result.needs_real_db_e2e, true);
      assert.equal(result.has_real_db_test_file, true);
    },
  },
  {
    name: 'RUN real database E2E when Manufacturing Slice 1 Real DB proof changes',
    files: ['src/platform/manufacturing/__tests__/manufacturing-slice1-real-db.test.ts'],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.needs_tests, true);
      assert.equal(result.needs_real_db_e2e, true);
      assert.equal(result.has_real_db_test_file, true);
    },
  },
  {
    name: 'RUN real database E2E when Manufacturing full-chain Real DB proof changes',
    files: ['src/platform/manufacturing/__tests__/manufacturing-full-chain-real-db.test.ts'],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.needs_tests, true);
      assert.equal(result.needs_real_db_e2e, true);
      assert.equal(result.has_real_db_test_file, true);
    },
  },
  {
    name: 'RUN real database E2E and browser E2E for Manufacturing operational product surface',
    files: [
      'src/app/api/manufacturing/operational-readiness/route.ts',
      'src/app/dashboard/manufacturing/page.tsx',
      'e2e/tests/41-manufacturing-operational-readiness.spec.ts',
    ],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.scope_level, 'product');
      assert.deepEqual(result.products, ['manufacturing']);
      assert.equal(result.needs_tests, true);
      assert.equal(result.needs_e2e, true);
      assert.equal(result.needs_real_db_e2e, true);
      assert.equal(result.has_manufacturing_real_db_surface, true);
    },
  },
  {
    name: 'RUN real database E2E when Manufacturing OS runtime surface changes',
    files: [
      'src/platform/manufacturing/operational-runtime.ts',
      'src/platform/manufacturing/manufacturing-slice1.service.ts',
    ],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.scope_level, 'os');
      assert.deepEqual(result.os, ['manufacturing']);
      assertIncludes(result.affected_products, 'manufacturing', 'Manufacturing product should be affected by Manufacturing OS');
      assert.equal(result.needs_tests, true);
      assert.equal(result.needs_real_db_e2e, true);
      assert.equal(result.has_manufacturing_real_db_surface, true);
    },
  },
  {
    name: 'RUN real database E2E when Logistics production consumption Real DB proof changes',
    files: ['src/platform/logistics/warehouse/__tests__/stock-out-production-consumption-real-db.test.ts'],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.scope_level, 'os');
      assert.deepEqual(result.os, ['logistics']);
      assert.equal(result.needs_tests, true);
      assert.equal(result.needs_real_db_e2e, true);
      assert.equal(result.has_real_db_test_file, true);
    },
  },
  {
    name: 'RUN real database E2E when Logistics production-order stock-in Real DB proof changes',
    files: ['src/platform/logistics/warehouse/__tests__/stock-in-production-order-real-db.test.ts'],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.scope_level, 'os');
      assert.deepEqual(result.os, ['logistics']);
      assert.equal(result.needs_tests, true);
      assert.equal(result.needs_real_db_e2e, true);
      assert.equal(result.has_real_db_test_file, true);
    },
  },
  {
    name: 'RUN real database E2E when Hospitality maintenance real-db test changes',
    files: ['src/products/bella-hospitality/__tests__/maintenance-real-db.test.ts'],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.scope_level, 'product');
      assert.deepEqual(result.products, ['hospitality']);
      assert.equal(result.needs_tests, true);
      assert.equal(result.needs_real_db_e2e, true);
      assert.equal(result.has_real_db_test_file, true);
    },
  },
  {
    name: 'RUN real database E2E when Hospitality Hotel Core browser Real DB proof changes',
    files: ['e2e/tests/38-hospitality-hotel-core-chain-browser-e2e.spec.ts'],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.scope_level, 'product');
      assert.deepEqual(result.products, ['hospitality']);
      assert.equal(result.needs_tests, true);
      assert.equal(result.needs_e2e, true);
      assert.equal(result.needs_real_db_e2e, true);
      assert.equal(result.has_real_db_test_file, true);
    },
  },
  {
    name: 'BLOCK multi-product product-only contamination',
    files: [
      'src/products/bella-english-center/services/class.service.ts',
      'src/products/bella-land/services/reservation.service.ts',
    ],
    expect(result) {
      assert.equal(result.scope_status, 'BLOCK');
      assert.equal(result.scope_level, 'product');
    },
  },
];

for (const testCase of cases) {
  const result = route(testCase.files);
  testCase.expect(result);
  console.log(`PASS ${testCase.name}`);
}
