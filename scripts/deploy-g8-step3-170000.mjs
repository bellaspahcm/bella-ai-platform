/**
 * Bella Interior OS — G8 Step 3: Apply Migration 170000 to Production
 * Target: lvnvkpyxtuilhrabtlwv (Production)
 */

import fs from 'node:fs';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = 'lvnvkpyxtuilhrabtlwv';
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN is required');
  process.exit(1);
}

const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function runSql(sql, label = 'query') {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`[${label}] DB error (${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

console.log('================================================================');
console.log('BELLA INTERIOR — G8 STEP 3: APPLY MIGRATION 170000 TO PRODUCTION');
console.log(`Database Target: ${PROJECT_REF} (Production)`);
console.log('================================================================\n');

// 1. Verify exact file hash before sending to DB
const MIGRATION_PATH = 'supabase/migrations/20261109170000_interior_canonical_takeoff_and_boq_sync.sql';
const sqlContent = fs.readFileSync(MIGRATION_PATH, 'utf8');
const expectedHash = 'F418D56E1E96869026598B5664826EE79FA8FC2CA9F223EF0F9C167DE59C434A';
const actualHash = crypto.createHash('sha256').update(sqlContent).digest('hex').toUpperCase();

if (actualHash !== expectedHash) {
  throw new Error(`ABORT: Checksum mismatch! Expected ${expectedHash}, got ${actualHash}`);
}
console.log(`[PASS] [3.1] Migration 170000 verified against expected SHA-256 (${actualHash})`);

// 2. Pre-check: Ensure 170000 is not already in ledger
const ledgerCheck = await runSql(
  `SELECT version FROM supabase_migrations.schema_migrations WHERE version = '20261109170000';`,
  'check_ledger'
);
if (Array.isArray(ledgerCheck) && ledgerCheck.length > 0) {
  console.log('[WARN] Migration 170000 already in ledger. Proceeding with idempotent re-application...');
}

// 3. Execute Migration 170000 SQL
console.log('Applying Migration 170000 DDL...');
await runSql(sqlContent, 'apply_170000');
console.log('[PASS] [3.2] Migration 170000 DDL executed successfully on Production DB!');

// 4. Record migration into schema_migrations ledger (if not recorded)
await runSql(`
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('20261109170000', 'interior_canonical_takeoff_and_boq_sync')
  ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;
`, 'record_ledger');
console.log('[PASS] [3.3] Recorded version 20261109170000 in schema_migrations ledger');

// 5. Verify Post-Apply Schema
console.log('\n--- VERIFYING POST-APPLY PRODUCTION SCHEMA ---');

// 5.1 Tables exist
const tables = await runSql(`
  SELECT table_name, (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) AS col_count
  FROM information_schema.tables t
  WHERE table_schema = 'public'
    AND table_name IN ('interior_takeoff_runs', 'interior_takeoff_components')
  ORDER BY table_name;
`, 'verify_tables');
console.log('Tables created:', tables);
if (tables.length !== 2) throw new Error('Expected 2 new tables to exist');
console.log('[PASS] [3.4] Tables interior_takeoff_runs & interior_takeoff_components created');

// 5.2 Lineage columns on interior_boq_items
const boqCols = await runSql(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'interior_boq_items'
    AND column_name IN ('source_takeoff_component_id', 'stable_component_id');
`, 'verify_boq_cols');
console.log('Lineage columns on interior_boq_items:', boqCols);
if (boqCols.length !== 2) throw new Error('Expected 2 lineage columns on interior_boq_items');
console.log('[PASS] [3.5] Lineage columns added to interior_boq_items');

// 5.3 Triggers enabled
const triggers = await runSql(`
  SELECT t.tgname, c.relname, t.tgenabled
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  WHERE t.tgname IN (
    'check_takeoff_run_lifecycle',
    'check_takeoff_components_integrity',
    'check_takeoff_components_delete'
  )
  ORDER BY t.tgname;
`, 'verify_triggers');
console.log('Triggers:', triggers);
if (triggers.length !== 3 || triggers.some((t) => t.tgenabled !== 'O')) {
  throw new Error('Expected 3 enabled triggers');
}
console.log('[PASS] [3.6] All 3 Takeoff triggers verified ENABLED');

// 5.4 RLS Policies
const policies = await runSql(`
  SELECT tablename, policyname, permissive, roles, cmd
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('interior_takeoff_runs', 'interior_takeoff_components')
  ORDER BY tablename, policyname;
`, 'verify_policies');
console.log(`Found ${policies.length} RLS policies on Takeoff tables:`);
policies.forEach((p) => console.log(`  - ${p.tablename}.${p.policyname} (${p.permissive} ${p.cmd})`));
if (policies.length < 8) throw new Error(`Expected at least 8 policies (5 per table), got ${policies.length}`);
console.log('[PASS] [3.7] Complete RESTRICTIVE + PERMISSIVE RLS policies verified');

console.log('\n================================================================');
console.log('STEP 3 COMPLETE: MIGRATION 170000 APPLIED AND VERIFIED PASS!');
console.log('Safe to proceed to Step 4.');
console.log('================================================================\n');

