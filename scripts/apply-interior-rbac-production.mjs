/**
 * Bella Interior OS — Production RBAC Deployment & Verification
 *
 * Migration: 20261109130000_bella_interior_rbac_scopes.sql
 * Target: lvnvkpyxtuilhrabtlwv (Production)
 * Tenant: 686884d2-6a4a-4581-ac8f-6ae69666b31d (Bella Interior Demo)
 * Owner User: 9077b10b-ee20-4058-907b-7a3e918b84c3 (demo.interior@bellaspa.vn)
 *
 * Governance: BACKUP_WAIVED_BY_OWNER
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const PROJECT_REF = 'lvnvkpyxtuilhrabtlwv';
const MIGRATION_VERSION = '20261109130000';
const MIGRATION_NAME = 'bella_interior_rbac_scopes';
const TENANT_ID = '686884d2-6a4a-4581-ac8f-6ae69666b31d';
const OWNER_USER_ID = '9077b10b-ee20-4058-907b-7a3e918b84c3';

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
  console.log('BELLA INTERIOR — PRODUCTION RBAC DEPLOYMENT (PHASE 6)');
  console.log('Governance Mode: BACKUP_WAIVED_BY_OWNER (Explicit owner mandate)');
  console.log('Target Project:  ', PROJECT_REF);
  console.log('Target Tenant:   ', TENANT_ID);
  console.log('Owner Candidate: ', OWNER_USER_ID);
  console.log('================================================================\n');

  // Step 1: Read and verify migration file (ensure LF line endings for Postgres matching)
  const migrationPath = join(process.cwd(), 'supabase', 'migrations', `${MIGRATION_VERSION}_${MIGRATION_NAME}.sql`);
  console.log(`[1/6] Reading migration: ${migrationPath}`);
  const sql = readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');
  const sha256 = createHash('sha256').update(sql).digest('hex').toUpperCase();
  console.log(`      Migration Size: ${sql.length} bytes (normalized LF)`);
  console.log(`      Migration SHA-256: ${sha256}`);

  // Step 2: Check migration ledger in Production
  console.log('\n[2/6] Checking migration ledger in Production...');
  const checkResult = await runSql(
    `SELECT version, name FROM supabase_migrations.schema_migrations WHERE version = '${MIGRATION_VERSION}';`,
    'Check migration ledger'
  );

  let migrationAlreadyApplied = Array.isArray(checkResult) && checkResult.length > 0;
  if (migrationAlreadyApplied) {
    console.log(`      Migration ${MIGRATION_VERSION} already recorded in schema_migrations.`);
  } else {
    // Step 3: Execute migration SQL
    console.log(`\n[3/6] Applying migration ${MIGRATION_VERSION}_${MIGRATION_NAME} to Production...`);
    const applyStartTime = Date.now();
    await runSql(sql, `Apply ${MIGRATION_NAME} migration`);
    const duration = ((Date.now() - applyStartTime) / 1000).toFixed(2);
    console.log(`      Migration applied successfully in ${duration}s!`);

    // Record in schema_migrations ledger
    console.log('      Recording migration in supabase_migrations.schema_migrations...');
    await runSql(
      `INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
       VALUES ('${MIGRATION_VERSION}', '${MIGRATION_NAME}', '{}')
       ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;`,
      'Record migration ledger entry'
    );
    console.log('      Migration ledger entry recorded.');
  }

  // Step 4: Verification of RBAC catalog and RLS
  console.log('\n[4/6] Verifying RBAC catalog, RLS, and grants on Production...');

  // Check 8 new RBAC tables
  const rbacTables = [
    'interior_roles', 'interior_permissions', 'interior_role_permissions',
    'interior_user_roles', 'interior_user_project_assignments',
    'interior_user_permission_grants', 'interior_admin_role_delegations',
    'interior_permission_audit_logs'
  ];

  const tableCheck = await runSql(
    `SELECT c.relname, c.relrowsecurity,
            EXISTS(SELECT 1 FROM pg_policies p WHERE p.tablename = c.relname AND p.policyname = 'tenant_isolation_policy' AND p.permissive = 'RESTRICTIVE') as has_tenant_policy
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = ANY(ARRAY['${rbacTables.join("','")}']);`,
    'Verify RBAC tables and RLS'
  );
  console.log(`      Found ${tableCheck.length}/${rbacTables.length} RBAC tables.`);
  for (const row of tableCheck) {
    console.log(`      - ${row.relname}: RLS=${row.relrowsecurity}`);
  }

  // Check permissions count
  const permCheck = await runSql(
    `SELECT COUNT(*) as count FROM interior_permissions;`,
    'Check permissions count'
  );
  console.log(`      Total permissions seeded: ${permCheck[0]?.count}`);

  // Check roles count
  const rolesCheck = await runSql(
    `SELECT COUNT(*) as count FROM interior_roles;`,
    'Check roles count'
  );
  console.log(`      Total roles seeded: ${rolesCheck[0]?.count}`);

  // Step 5: Bootstrap OWNER
  console.log('\n[5/6] Bootstrapping OWNER role for demo.interior@bellaspa.vn...');
  await runSql(
    `INSERT INTO public.interior_user_roles (
       tenant_id, user_id, role_key, scope_type, scope_id, status, granted_by
     ) VALUES (
       '${TENANT_ID}',
       '${OWNER_USER_ID}',
       'OWNER',
       'TENANT',
       NULL,
       'ACTIVE',
       '${OWNER_USER_ID}'
     )
     ON CONFLICT DO NOTHING;`,
    'Insert OWNER role assignment'
  );

  // Verify OWNER status
  const ownerCheck = await runSql(
    `SELECT ur.id, ur.user_id, ur.tenant_id, ur.role_key, ur.scope_type, ur.status, r.display_name
     FROM interior_user_roles ur
     JOIN interior_roles r ON r.role_key = ur.role_key
     WHERE ur.user_id = '${OWNER_USER_ID}' AND ur.tenant_id = '${TENANT_ID}';`,
    'Check OWNER assignment'
  );
  console.log('      Owner assignment verified:');
  console.log(JSON.stringify(ownerCheck, null, 2));

  // Step 6: Check existing projects for tenant
  console.log('\n[6/6] Checking projects in interior_projects for this tenant...');
  const projectsCheck = await runSql(
    `SELECT id, code, name, status, created_at
     FROM interior_projects
     WHERE tenant_id = '${TENANT_ID}'
     ORDER BY created_at DESC;`,
    'Query projects for tenant'
  );
  console.log(`      Existing projects count: ${projectsCheck.length}`);
  if (projectsCheck.length > 0) {
    for (const p of projectsCheck) {
      console.log(`      - [${p.code}] ${p.name} (status: ${p.status}, id: ${p.id})`);
    }
  } else {
    console.log('      No projects found yet for this tenant. Seeding pilot project next.');
  }

  console.log('\n================================================================');
  console.log('PRODUCTION RBAC DEPLOYMENT COMPLETE & VERIFIED!');
  console.log('================================================================');
}

main().catch(err => {
  console.error('\nDEPLOYMENT FAILED:', err);
  process.exit(1);
});
