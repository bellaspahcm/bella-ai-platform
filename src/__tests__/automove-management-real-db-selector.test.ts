import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

it.each([
  'supabase/migrations/20261015050000_authorize_automove_customer_profile_management.sql',
  'supabase/migrations/20261015050100_limit_automove_profile_preference_columns.sql',
  'src/modules/bella-auto/services/AutoMoveManagementHttp.ts',
  'src/modules/bella-auto/services/AutoCustomerProvider.ts',
  'src/app/api/bella-auto/customers/route.ts',
  'src/app/api/bella-auto/customers/[id]/profile/route.ts',
  'src/app/api/bella-auto/vehicles/route.ts',
  'src/app/dashboard/bella-auto/customers/page.tsx',
  'src/app/dashboard/bella-auto/vehicles/page.tsx',
  'e2e/tests/44-automove-management-persistence.spec.ts',
])('selects the management proof, not unrelated full DB suite, for %s', path => {
  const result = spawnSync(process.execPath, [resolve('scripts/run-scoped-real-db-e2e.mjs'), '--list-only', path], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('scripts/verify-automove-management-persistence.ts');
  expect(result.stdout).not.toContain('Running full real database business E2E suite.');
  expect(result.stdout).not.toContain('No scoped real database business E2E work matched');
});
