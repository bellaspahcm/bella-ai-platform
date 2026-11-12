/**
 * Bella Interior OS — Production Commercial Migrations Verification (Read-Only)
 * Target: Production Supabase Project lvnvkpyxtuilhrabtlwv (or via PRODUCTION_PROJECT_REF)
 *
 * CRITICAL SAFETY ASSURANCES:
 * 1. STRICTLY READ-ONLY: Contains ONLY SELECT queries on system catalogs and
 *    information_schema (pg_constraint, pg_trigger, pg_proc, pg_tables, schema_migrations).
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
const TARGET_LABEL = PROJECT_REF === 'lvnvkpyxtuilhrabtlwv' ? 'Production' : 'Non-Production';
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
  console.log(`Target Project: ${PROJECT_REF} (${TARGET_LABEL})`);
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
    '20261112132839', // Forward-only BOQ RPC authorization hardening
  ];

  const appliedMigrations = await runSql(`
    SELECT version, name
    FROM supabase_migrations.schema_migrations
    WHERE version IN ('20261110190000', '20261110200000', '20261110210000', '20261110220000', '20261112132839')
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
    'interior_boqs',
    'interior_boq_items',
    'interior_quotations',
    'interior_quotation_items',
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

  const expectedBOQColumns = ['forked_from_boq_id', 'snapshot_sealed_at', 'release_notes'];
  const existingBOQColumns = await runSql(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'interior_boqs'
      AND column_name IN (${expectedBOQColumns.map(c => `'${c}'`).join(', ')});
  `);
  const existingBOQColumnNames = new Set(existingBOQColumns.map(c => c.column_name));
  for (const column of expectedBOQColumns) {
    const exists = existingBOQColumnNames.has(column);
    console.log(`  ${exists ? '[OK]' : '[FAIL]'} Column public.interior_boqs.${column}`);
    if (!exists) allChecksPassed = false;
  }

  const expectedViews = [
    'interior_boq_version_history',
    'interior_client_quotations_view',
    'interior_client_quotation_items_view',
  ];
  const existingViews = await runSql(`
    SELECT viewname
    FROM pg_views
    WHERE schemaname = 'public'
      AND viewname IN (${expectedViews.map(v => `'${v}'`).join(', ')})
    ORDER BY viewname ASC;
  `);
  const existingViewNames = new Set(existingViews.map(v => v.viewname));
  for (const view of expectedViews) {
    const exists = existingViewNames.has(view);
    console.log(`  ${exists ? '[OK]' : '[FAIL]'} View public.${view}`);
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
        'uq_ica_tenant_id',
        'uq_ica_approval_token'
      );
  `);

  const foundConstraints = new Set(constraints.map(c => c.constraint_name));
  const expectedConstraints = [
    'uq_interior_payment_tx_reference',
    'uq_ica_tenant_id',
    'uq_ica_approval_token',
  ];
  for (const constraint of expectedConstraints) {
    const exists = foundConstraints.has(constraint);
    console.log(`  ${exists ? '[OK]' : '[FAIL]'} Unique Constraint ${constraint}`);
    if (!exists) allChecksPassed = false;
  }

  // ── 4. Check Immutability Triggers ─────────────────────────────────────────
  console.log('\n--- Check 4: Verifying Trigger Immutability Guards ---');
  const triggers = await runSql(`
    SELECT
      event_object_table,
      trigger_name
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND trigger_name IN (
        'trg_guard_interior_quotation_items_immutability',
        'trg_guard_interior_quotations_immutability',
        'trg_guard_interior_contracts_immutability',
        'trg_guard_interior_payment_milestones_immutability',
        'trg_guard_ica_immutability'
      );
  `);

  const foundTriggers = new Set(triggers.map(t => t.trigger_name));
  const expectedTriggers = [
    'trg_guard_interior_quotation_items_immutability',
    'trg_guard_interior_quotations_immutability',
    'trg_guard_interior_contracts_immutability',
    'trg_guard_interior_payment_milestones_immutability',
    'trg_guard_ica_immutability',
  ];
  for (const trigger of expectedTriggers) {
    const exists = foundTriggers.has(trigger);
    console.log(`  ${exists ? '[OK]' : '[FAIL]'} Trigger ${trigger}`);
    if (!exists) allChecksPassed = false;
  }

  // ── 5. Check BOQ Revision RPC Authorization and ACL ────────────────────────
  console.log('\n--- Check 5: Verifying BOQ Revision RPC Authorization and Least-Privilege ACL ---');
  const boqForkFunctions = await runSql(`
    SELECT
      p.proname,
      p.prosecdef AS security_definer,
      p.prosrc AS function_source,
      has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
      has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
      EXISTS (
        SELECT 1
        FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl_entry
        WHERE acl_entry.grantee = 0
          AND acl_entry.privilege_type = 'EXECUTE'
      ) AS public_execute
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('fork_interior_boq_revision', '_fork_interior_boq_revision_unchecked')
    ORDER BY p.proname;
  `);

  const wrapper = boqForkFunctions.find(f => f.proname === 'fork_interior_boq_revision');
  const internal = boqForkFunctions.find(f => f.proname === '_fork_interior_boq_revision_unchecked');
  const isTrue = value => value === true || value === 't';
  const wrapperSource = wrapper?.function_source || '';
  const wrapperGuarded = wrapperSource.includes('auth.uid()')
    && wrapperSource.includes('public.interior_actor_tenant()')
    && wrapperSource.includes('interior:boq:read')
    && wrapperSource.includes('interior:boq:create')
    && wrapperSource.includes('p_actor_id');
  const wrapperACLPass = Boolean(wrapper)
    && isTrue(wrapper.security_definer)
    && !isTrue(wrapper.public_execute)
    && !isTrue(wrapper.anon_execute)
    && !isTrue(wrapper.service_role_execute)
    && isTrue(wrapper.authenticated_execute)
    && wrapperGuarded;
  console.log(`  ${wrapperACLPass ? '[OK]' : '[FAIL]'} Authenticated RPC is tenant/actor/permission-bound; anon, PUBLIC, and service_role execution are revoked`);
  if (!wrapperACLPass) allChecksPassed = false;

  const internalACLPass = Boolean(internal)
    && !isTrue(internal.public_execute)
    && !isTrue(internal.anon_execute)
    && !isTrue(internal.authenticated_execute)
    && !isTrue(internal.service_role_execute);
  console.log(`  ${internalACLPass ? '[OK]' : '[FAIL]'} Internal atomic fork implementation is not directly executable by API roles`);
  if (!internalACLPass) allChecksPassed = false;

  // ── 6. Final Audit Verdict ────────────────────────────────────────────────
  console.log('\n========================================================================');
  console.log('AUDIT SCOPE: Read-Only System Catalog Inspection (Zero mutation, Zero runtime effect)');
  if (allChecksPassed) {
    console.log('AUDIT VERDICT: PASS — All 5 commercial schema/security migrations, tables, columns, views, constraints, triggers, and BOQ RPC ACLs verified in PostgreSQL catalog.');
  } else if (appliedMigrations.length === 0) {
    console.log('AUDIT VERDICT: MIGRATIONS_HELD — 0/5 commercial schema/security migrations found on this database.');
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

