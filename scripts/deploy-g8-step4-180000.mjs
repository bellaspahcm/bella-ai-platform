/**
 * Bella Interior OS — G8 Step 4: Apply Migration 180000 to Production
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
console.log('BELLA INTERIOR — G8 STEP 4: APPLY MIGRATION 180000 TO PRODUCTION');
console.log(`Database Target: ${PROJECT_REF} (Production)`);
console.log('================================================================\n');

// 1. Verify exact file hash before sending to DB
const MIGRATION_PATH = 'supabase/migrations/20261109180000_interior_boq_history_lineage_fix.sql';
const sqlContent = fs.readFileSync(MIGRATION_PATH, 'utf8');
const expectedHash = '92F6436F9AEA2DA8582F0B547780281C9A3209A04A16A404F390B7C5D4B0DBC9';
const actualHash = crypto.createHash('sha256').update(sqlContent).digest('hex').toUpperCase();

if (actualHash !== expectedHash) {
  throw new Error(`ABORT: Checksum mismatch! Expected ${expectedHash}, got ${actualHash}`);
}
console.log(`[PASS] [4.1] Migration 180000 verified against expected SHA-256 (${actualHash})`);

// 2. Execute Migration 180000 SQL
console.log('Applying Migration 180000 DDL...');
await runSql(sqlContent, 'apply_180000');
console.log('[PASS] [4.2] Migration 180000 DDL executed successfully on Production DB!');

// 3. Record migration into schema_migrations ledger
await runSql(`
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('20261109180000', 'interior_boq_history_lineage_fix')
  ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;
`, 'record_ledger');
console.log('[PASS] [4.3] Recorded version 20261109180000 in schema_migrations ledger');

// 4. Verify Post-Apply Function & Trigger
console.log('\n--- VERIFYING POST-APPLY FUNCTION & TRIGGER ---');

// 4.1 Verify function source contains lineage columns in substantive change filter
const fnCheck = await runSql(`
  SELECT p.proname, p.prosecdef,
         p.prosrc LIKE '%OLD.source_takeoff_component_id IS DISTINCT FROM NEW.source_takeoff_component_id%' AS has_source,
         p.prosrc LIKE '%OLD.stable_component_id IS DISTINCT FROM NEW.stable_component_id%' AS has_stable,
         p.prosrc LIKE '%jsonb_build_object%source_takeoff_component_id%' AS has_meta
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'trg_record_interior_boq_item_history';
`, 'verify_fn');
console.log('Function inspection:', fnCheck[0]);

if (!fnCheck[0]?.has_source || !fnCheck[0]?.has_stable || !fnCheck[0]?.has_meta) {
  throw new Error('Function definition does not contain all required lineage triggers!');
}
console.log('[PASS] [4.4] Function trg_record_interior_boq_item_history verified with lineage change filter & metadata');

// 4.2 Verify trigger binding is ENABLED
const triggerCheck = await runSql(`
  SELECT t.tgname, c.relname, t.tgenabled
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.relname = 'interior_boq_items'
    AND t.tgname = 'trg_interior_boq_items_history_capture';
`, 'verify_trigger');
console.log('Trigger status:', triggerCheck[0]);

if (triggerCheck[0]?.tgenabled !== 'O') {
  throw new Error('Trigger trg_interior_boq_items_history_capture is NOT enabled!');
}
console.log('[PASS] [4.5] Trigger trg_interior_boq_items_history_capture is ENABLED on interior_boq_items');

console.log('\n================================================================');
console.log('STEP 4 COMPLETE: MIGRATION 180000 APPLIED AND VERIFIED PASS!');
console.log('Safe to proceed to Step 5 (Live Production E2E).');
console.log('================================================================\n');

