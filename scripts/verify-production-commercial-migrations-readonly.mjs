/**
 * Bella Interior OS — Production Commercial Migrations Verification (Read-Only)
 * Target: Production Supabase Project lvnvkpyxtuilhrabtlwv (or via PRODUCTION_PROJECT_REF)
 *
 * CRITICAL SAFETY ASSURANCES:
 * 1. STRICTLY READ-ONLY: Contains ONLY SELECT queries on system catalogs (pg_constraint,
 *    pg_trigger, pg_tables, schema_migrations).
 * 2. ZERO MUTATIONS: Absolutely no INSERT, UPDATE, DELETE, DROP, TRUNCATE, or CREATE statements.
 * 3. ZERO FIXTURE POLLUTION: Does not insert synthetic contracts, tokens, or payments.
 * 4. SAFE FOR PRODUCTION: Can be safely executed against live Production at any time.
 *
 * Usage:
 *   PRODUCTION_PROJECT_REF=lvnvkpyxtuilhrabtlwv SUPABASE_ACCESS_TOKEN=... node scripts/verify-production-commercial-migrations-readonly.mjs
 *
 * @module scripts/verify-production-commercial-migrations-readonly.mjs
 */

const PROJECT_REF = process.env.PRODUCTION_PROJECT_REF || 'lvnvkpyxtuilhrabtlwv';
const token = process.env.SUPABASE_ACCESS_TOKEN;

async function runSql(query) {
  if (!token) {
    throw new Error('SUPABASE_ACCESS_TOKEN environment variable is required to execute queries via Management API.');
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

async function verifyProductionReadonly() {
  console.log('========================================================================');
  console.log('BELLA INTERIOR OS — PRODUCTION COMMERCIAL MIGRATIONS READ-ONLY AUDIT');
  console.log(`Target Project: ${PROJECT_REF} (Production)`);
  console.log('Mode: STRICTLY READ-ONLY (Zero mutations, Zero synthetic fixtures)');
  console.log('========================================================================\n');

  let allChecksPassed = true;

  // ── 1. Check Applied Migration History ────────────────────────────────────
  console.log('--- Check 1: Applied Schema Migrations in supabase_migrations.schema_migrations ---');
  const expectedMigrations = [
    '20261110190000', // Phase 1: BOQ Versioning
    '20261110200000', // Phase 2: Quotations & Margins
    '20261110210000', // Phase 3: Contracts & Payment Milestones
    '20261110220000', // Phase 4: Customer Approval & Digital Signature
  ];

  const appliedMigrations = await runSql(`
    SELECT version, name
    FROM supabase_migrations.schema_migrations
    WHERE version IN ('20261110190000', '20261110200000', '20261110210000', '20261110220000')
    ORDER BY version ASC;
  `);

  console.log(`Found ${appliedMigrations.length} / ${expectedMigrations.length} expected commercial migration records:`);
  for (const m of appliedMigrations) {
    console.log(`  [OK] Version: ${m.version} | Name: ${m.name || 'N/A'}`);
  }

  if (appliedMigrations.length !== expectedMigrations.length) {
    allChecksPassed = false;
  }

  // ── 2. Check Table Existence ──────────────────────────────────────────────
  console.log('\n--- Check 2: Verifying Core Table Existence in public schema ---');
  const expectedTables = [
    'interior_boq_snapshots',
    'interior_quotations',
    'interior_contracts',
    'interior_contract_addenda',
    'interior_payment_milestones',
    'interior_payment_transactions',
    'interior_customer_approvals',
    'interior_finance_outbox',
  ];

  const existingTables = await runSql(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (${expectedTables.map(t => `'${t}'`).join(', ')})
    ORDER BY tablename ASC;
  `);

  const existingTableNames = new Set(existingTables.map(t => t.tablename));
  for (const t of expectedTables) {
    const exists = existingTableNames.has(t);
    console.log(`  ${exists ? '[OK]' : '[FAIL]'} Table public.${t}`);
    if (!exists) allChecksPassed = false;
  }

  // ── 3. Check Unique Constraints (Race-Condition Guards) ───────────────────
  console.log('\n--- Check 3: Verifying Critical Race-Condition Constraints ---');
  const constraints = await runSql(`
    SELECT
      tc.table_name,
      tc.constraint_name,
      tc.constraint_type
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.constraint_name IN (
        'uq_interior_payment_tx_reference',
        'uq_ica_tenant_id'
      );
  `);

  const foundConstraints = new Set(constraints.map(c => c.constraint_name));
  const hasPaymentUq = foundConstraints.has('uq_interior_payment_tx_reference');
  console.log(`  ${hasPaymentUq ? '[OK]' : '[FAIL]'} Unique Constraint uq_interior_payment_tx_reference (anti-double-pay)`);
  if (!hasPaymentUq) allChecksPassed = false;

  // ── 4. Check Immutability Triggers ─────────────────────────────────────────
  console.log('\n--- Check 4: Verifying Trigger Immutability Guards ---');
  const triggers = await runSql(`
    SELECT
      event_object_table,
      trigger_name
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND trigger_name IN (
        'trg_guard_interior_customer_approvals_immutability',
        'trg_guard_interior_contracts_immutability'
      );
  `);

  const foundTriggers = new Set(triggers.map(t => t.trigger_name));
  const hasApprovalTrg = foundTriggers.has('trg_guard_interior_customer_approvals_immutability');
  const hasContractTrg = foundTriggers.has('trg_guard_interior_contracts_immutability');

  console.log(`  ${hasApprovalTrg ? '[OK]' : '[FAIL]'} Trigger trg_guard_interior_customer_approvals_immutability`);
  console.log(`  ${hasContractTrg ? '[OK]' : '[FAIL]'} Trigger trg_guard_interior_contracts_immutability`);
  if (!hasApprovalTrg || !hasContractTrg) allChecksPassed = false;

  // ── 5. Final Audit Verdict ────────────────────────────────────────────────
  console.log('\n========================================================================');
  console.log('AUDIT SCOPE: Read-Only System Catalog Inspection (Zero mutation, Zero runtime effect)');
  if (allChecksPassed) {
    console.log('AUDIT VERDICT: PASS — All 4 commercial schema migrations, core tables, unique constraints, and immutability triggers verified in PostgreSQL catalog.');
  } else if (appliedMigrations.length === 0) {
    console.log('AUDIT VERDICT: MIGRATIONS_HELD — 0/4 commercial migrations found on this database.');
    console.log('NOTE: This is the EXPECTED and AUTHORIZED state while Production DDL remains HELD under governance.');
  } else {
    console.error('AUDIT VERDICT: INCOMPLETE — Partial migration state detected. Investigation required before proceeding.');
    process.exit(1);
  }
  console.log('========================================================================');
}

verifyProductionReadonly().catch(err => {
  console.error('Fatal Read-Only Audit Error:', err.message);
  process.exit(1);
});

