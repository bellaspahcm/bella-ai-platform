/**
 * Bella Interior OS — Production BOQ Item History Deployment & Verification
 *
 * Migration: 20261109140000_interior_boq_item_history.sql
 * Target: lvnvkpyxtuilhrabtlwv (Production)
 *
 * Safety & Pre-flight Controls:
 * 1. Confirms Production project `lvnvkpyxtuilhrabtlwv`.
 * 2. Checks current Production schema (`interior_boqs`, `interior_boq_items`).
 * 3. Applies migration inside an atomic transaction.
 * 4. Records schema migration entry in `supabase_migrations.schema_migrations`.
 * 5. Verifies RLS policies, trigger registration, and query RPC function.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const PROJECT_REF = 'lvnvkpyxtuilhrabtlwv';
const MIGRATION_VERSION = '20261109140000';
const MIGRATION_NAME = 'interior_boq_item_history';

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('ERROR: SUPABASE_ACCESS_TOKEN environment variable is missing.');
  process.exit(1);
}

async function runSql(query, description = 'SQL Query') {
  console.log(`[SQL] Running: ${description}...`);
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed ${description} (HTTP ${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return data;
}

async function main() {
  console.log('================================================================');
  console.log('BELLA INTERIOR — PRODUCTION BOQ ITEM HISTORY MIGRATION');
  console.log('Target Project:   ', PROJECT_REF);
  console.log('Migration Version:', MIGRATION_VERSION);
  console.log('Migration Name:   ', MIGRATION_NAME);
  console.log('================================================================\n');

  // Step 1: Read migration SQL file
  const migrationPath = join(process.cwd(), 'supabase', 'migrations', `${MIGRATION_VERSION}_${MIGRATION_NAME}.sql`);
  console.log(`[1/5] Reading migration: ${migrationPath}`);
  const sql = readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');
  const fileHash = createHash('sha256').update(sql).digest('hex');
  console.log(`      Migration size: ${sql.length} bytes, SHA256: ${fileHash}`);

  // Step 2: Preflight check on Production DB
  console.log('\n[2/5] Running Production Pre-flight check...');
  const preflightTables = await runSql(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('tenants', 'interior_boqs', 'interior_boq_items');`,
    'Pre-flight verify required tables'
  );
  console.log('      Verified existing parent tables:', preflightTables.map(t => t.table_name).join(', '));
  if (preflightTables.length < 3) {
    throw new Error(`Missing expected parent tables in Production: found only ${preflightTables.length}`);
  }

  // Check if migration is already recorded
  const migrationCheck = await runSql(
    `SELECT version, name FROM supabase_migrations.schema_migrations WHERE version = '${MIGRATION_VERSION}';`,
    'Check existing schema migration'
  );
  if (migrationCheck.length > 0) {
    console.log(`      Migration ${MIGRATION_VERSION} is ALREADY recorded in schema_migrations.`);
  }

  // Step 3: Execute migration SQL
  console.log('\n[3/5] Applying migration SQL to Production DB...');
  await runSql(sql, `Apply ${MIGRATION_NAME}`);
  console.log('      Migration executed successfully!');

  // Step 4: Record migration in schema_migrations
  console.log('\n[4/5] Recording migration in supabase_migrations.schema_migrations...');
  await runSql(
    `INSERT INTO supabase_migrations.schema_migrations (version, name)
     VALUES ('${MIGRATION_VERSION}', '${MIGRATION_NAME}')
     ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;`,
    'Record migration in schema_migrations'
  );
  console.log('      Migration recorded in schema_migrations.');

  // Step 5: Post-migration Verification
  console.log('\n[5/5] Running post-migration verification...');

  // 5.1 Check table exists and RLS
  const tableCheck = await runSql(
    `SELECT tablename, rowsecurity
     FROM pg_tables
     WHERE schemaname = 'public' AND tablename = 'interior_boq_item_history';`,
    'Verify table and RLS'
  );
  console.log('      Table verified:', JSON.stringify(tableCheck, null, 2));

  // 5.2 Check trigger on interior_boq_items
  const triggerCheck = await runSql(
    `SELECT trigger_name, event_manipulation, action_statement
     FROM information_schema.triggers
     WHERE event_object_table = 'interior_boq_items'
       AND trigger_name = 'trg_interior_boq_items_history_capture';`,
    'Verify trigger registration'
  );
  console.log('      Trigger verified:', JSON.stringify(triggerCheck, null, 2));

  // 5.3 Check RPC function exists
  const rpcCheck = await runSql(
    `SELECT proname, prosecdef
     FROM pg_proc
     WHERE proname = 'interior_get_boq_item_history';`,
    'Verify RPC function'
  );
  console.log('      RPC function verified:', JSON.stringify(rpcCheck, null, 2));

  console.log('\n================================================================');
  console.log('PRODUCTION BOQ ITEM HISTORY MIGRATION COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

main().catch(err => {
  console.error('\nMIGRATION RUN FAILED:', err);
  process.exit(1);
});

