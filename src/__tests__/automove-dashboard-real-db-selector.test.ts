import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const select = (...paths: string[]) => {
  const result = spawnSync(process.execPath, [resolve('scripts/run-scoped-real-db-e2e.mjs'), '--list-only', ...paths], {
    encoding: 'utf8',
  });
  expect(result.status).toBe(0);
  return result.stdout;
};

it.each([
  'supabase/migrations/20261015030000_guard_automove_active_identity_access.sql',
  'scripts/verify-automove-active-identity-access.ts',
  'src/__tests__/automove-active-identity-migration.test.ts',
  'scripts/verify-automove-sales-chain-rls-hardening.ts',
])('selects the durable active identity proof with rolled-back fixtures for %s', path => {
  const output = select(path);
  expect(output).toContain('scripts/verify-automove-active-identity-access.ts');
  expect(output).not.toContain('--test-migration');
  expect(output).not.toContain('Running full real database business E2E suite.');
  expect(output).not.toContain('No scoped real database business E2E work matched');
});

it('selects the approved catalog verifier instead of unrelated full-suite work', () => {
  const output = select('supabase/migrations/20261015010000_authorize_automove_catalog_tenant_reads.sql');
  expect(output).toContain('scripts/verify-automove-catalog-reads.ts');
  expect(output).not.toContain('Running full real database business E2E suite.');
});

it.each([
  ['src/modules/bella-auto/services/AutoMoveBookingAllocationService.ts', 'scripts/verify-automove-booking-allocation.ts'],
  ['src/modules/bella-auto/services/AutoMoveDepositConfirmationHttp.ts', 'scripts/verify-automove-deposit-idempotency.ts'],
  ['e2e/tests/43-automove-deposit-confirmation-api.spec.ts', 'scripts/verify-automove-deposit-idempotency.ts'],
])('selects actual rollback proof for %s', (path, verifier) => {
  const output = select(path);
  expect(output).toContain(verifier);
  expect(output).not.toContain('No scoped real database business E2E work matched');
});

it('keeps existing recognition proof and deduplicates commands in the dashboard batch', () => {
  const output = select('src/app/api/bella-auto/bookings/route.ts',
    'src/app/api/bella-auto/bookings/[id]/confirm-deposit/route.ts',
    'src/components/bella-auto/BookingListTable.tsx', 'e2e/tests/42-automove-dashboard-sales-chain.spec.ts',
    'supabase/migrations/20261015010000_authorize_automove_catalog_tenant_reads.sql');
  for (const verifier of ['catalog-reads', 'booking-allocation', 'deposit-idempotency', 'handover-recognition-e2e', 'sales-chain-real-db-alignment']) {
    expect(output.split(`scripts/verify-automove-${verifier}.ts`)).toHaveLength(2);
  }
  expect(output).not.toContain('Running full real database business E2E suite.');
});

it.each(['supabase/migrations/unknown-migration.sql', 'jest.real-db.config.ts'])('preserves full-suite fallback for %s', path => {
  expect(select(path)).toContain('Running full real database business E2E suite.');
});

it.each([
  'supabase/migrations/20261015020000_create_automove_post_sale_receipts.sql',
  'src/modules/bella-auto/services/AutoMoveSalePaymentService.ts',
  'src/modules/bella-auto/services/AutoMoveSalePaymentHttp.ts',
  'src/components/bella-auto/VehicleSalePayments.tsx',
  'src/app/api/bella-auto/bookings/[id]/sale-payments/route.ts',
])('selects post-sale payment Real DB proof for %s', path => {
  const output = select(path);
  expect(output).toContain('scripts/verify-automove-post-sale-payments.ts');
  expect(output).not.toContain('Running full real database business E2E suite.');
});

it.each([
  'src/modules/bella-auto/services/FinancialReportingService.ts',
  'src/app/api/bella-auto/analytics/recognized-sales/route.ts',
  'src/components/bella-auto/BellaAutoAnalyticsDashboard.tsx',
  'src/components/bella-auto/AutoAnalyticsCharts.tsx',
  'src/app/dashboard/bella-auto/page.tsx',
  'scripts/verify-automove-dashboard-recognized-sales.ts',
])('selects the actual authenticated reporting service proof for %s', path => {
  const output = select(path);
  expect(output.split('scripts/verify-automove-dashboard-recognized-sales.ts')).toHaveLength(2);
  expect(output).not.toContain('Running full real database business E2E suite.');
});
