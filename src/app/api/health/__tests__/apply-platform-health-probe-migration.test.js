const {
  EXPECTED_VERSION,
  EXPECTED_SHA256,
  assertProductionTarget,
  decideMigrationAction,
} = require('../../../../../scripts/apply-platform-health-probe-migration.cjs');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const projectRef = 'lvnvkpyxtuilhrabtlwv';

it('accepts only direct or pooler PostgreSQL URLs for the configured Production project', () => {
  expect(() => assertProductionTarget(
    `postgresql://postgres:${projectRef}@db.${projectRef}.supabase.co:5432/postgres`,
  )).not.toThrow();
  expect(() => assertProductionTarget(
    `postgresql://postgres.${projectRef}:password@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres`,
  )).not.toThrow();
  expect(() => assertProductionTarget(
    'postgresql://postgres:password@db.aaaaaaaaaaaaaaaaaaaa.supabase.co:5432/postgres',
  )).toThrow(/does not match/);
});

it('applies only the single expected pending migration', () => {
  const local = ['20261027020000', EXPECTED_VERSION];
  expect(decideMigrationAction(local, ['20261027020000'])).toBe('apply');
  expect(decideMigrationAction(local, ['20261027020000', EXPECTED_VERSION])).toBe('already-applied');
});

it('refuses any other pending migration or a remote-only ledger entry', () => {
  expect(() => decideMigrationAction(
    ['20261027020000', '20261028090000', EXPECTED_VERSION],
    ['20261027020000'],
  )).toThrow(/expected only/);

  expect(() => decideMigrationAction(
    ['20261027020000', EXPECTED_VERSION],
    ['20261027020000', '20261028080000'],
  )).toThrow(/missing from Git/);
});

it('pins the exact reviewed migration content', () => {
  const path = join(process.cwd(), 'supabase', 'migrations', `${EXPECTED_VERSION}_platform_health_rest_database_probe.sql`);
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase();
  expect(actual).toBe(EXPECTED_SHA256);
});
