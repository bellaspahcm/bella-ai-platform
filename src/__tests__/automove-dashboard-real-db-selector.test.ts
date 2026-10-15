import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const select = (...paths: string[]) => {
  const result = spawnSync(process.execPath, [resolve('scripts/run-scoped-real-db-e2e.mjs'), '--list-only', ...paths], {
    encoding: 'utf8',
  });
  expect(result.status).toBe(0);
  return result.stdout;
};

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
