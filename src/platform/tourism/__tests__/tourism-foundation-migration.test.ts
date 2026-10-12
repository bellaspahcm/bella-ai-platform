import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20261012010000_create_tourism_os_foundation.sql',
);

const migrationSql = fs.readFileSync(migrationPath, 'utf8');

describe('Tourism OS foundation migration', () => {
  it('creates only the approved Tourism OS tables for the foundation scope', () => {
    const createdTables = Array.from(migrationSql.matchAll(/CREATE TABLE IF NOT EXISTS public\.(tourism_[a-z_]+)/g)).map(
      (match) => match[1],
    );

    expect(createdTables.sort()).toEqual(
      [
        'tourism_audit_events',
        'tourism_bookings',
        'tourism_command_idempotency',
        'tourism_departures',
        'tourism_itinerary_days',
        'tourism_itinerary_segments',
        'tourism_participants',
        'tourism_tour_packages',
        'tourism_tours',
      ].sort(),
    );
  });

  it('does not register a product or couple the OS migration to product identity', () => {
    expect(migrationSql).not.toMatch(/ProductRegistry/i);
    expect(migrationSql).not.toMatch(/product_key/i);
    expect(migrationSql).not.toMatch(/bella_tourism/i);
    expect(migrationSql).not.toMatch(/src\/products/i);
  });

  it('does not introduce adjacent domain kernels or ledgers', () => {
    expect(migrationSql).not.toMatch(/accounting_outbox/i);
    expect(migrationSql).not.toMatch(/ledger/i);
    expect(migrationSql).not.toMatch(/hospitality_/i);
    expect(migrationSql).not.toMatch(/logistics_/i);
    expect(migrationSql).not.toMatch(/resource_kernel/i);
    expect(migrationSql).not.toMatch(/fleet/i);
    expect(migrationSql).not.toMatch(/loyalty/i);
    expect(migrationSql).not.toMatch(/dynamic_pricing/i);
  });

  it('enforces tenant isolation and authenticated-only access for every Tourism table', () => {
    const tables = [
      'tourism_tours',
      'tourism_tour_packages',
      'tourism_itinerary_days',
      'tourism_itinerary_segments',
      'tourism_departures',
      'tourism_bookings',
      'tourism_participants',
      'tourism_command_idempotency',
      'tourism_audit_events',
    ];

    for (const table of tables) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migrationSql).toContain(`REVOKE ALL ON public.${table} FROM anon`);
    }
    expect(migrationSql).toContain("current_setting(''app.current_tenant_id'', true)");
    expect(migrationSql).toContain('GRANT SELECT, INSERT');
  });

  it('defines OS-level capacity, idempotency, participant, and audit controls', () => {
    expect(migrationSql).toContain('capacity_reserved + capacity_confirmed <= capacity_total');
    expect(migrationSql).toContain('UNIQUE (tenant_id, operation, business_key)');
    expect(migrationSql).toContain('tourism_assert_booking_party_tenant');
    expect(migrationSql).toContain('tourism_assert_participant_party_tenant');
    expect(migrationSql).toContain('tourism_assert_booking_departure');
    expect(migrationSql).toContain('tourism_audit_events');
  });
});
