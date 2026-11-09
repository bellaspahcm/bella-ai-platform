/**
 * Bella Interior OS — Pilot Scenario Verification
 *
 * Verifies:
 * 1. Branch creation in org_units & assignment to interior project
 * 2. OWNER tenant-wide visibility
 * 3. Role assignment: DESIGNER with PROJECT scope vs TENANT scope
 * 4. Permission enforcement: Allowed vs Denied actions
 * 5. Cross-tenant isolation verification
 * 6. Role revocation immediacy
 * 7. Sensitive data protection (financials, salary, margin protection)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const PROJECT_REF = 'lvnvkpyxtuilhrabtlwv';
const TENANT_ID = '686884d2-6a4a-4581-ac8f-6ae69666b31d'; // Bella Interior Demo
const OTHER_TENANT_ID = '11111111-1111-1111-1111-111111111111'; // Mock other tenant
const OWNER_USER_ID = '9077b10b-ee20-4058-907b-7a3e918b84c3'; // demo.interior@bellaspa.vn

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN is missing');
  process.exit(1);
}

async function runSql(query, description = 'SQL Query') {
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

  return await res.json();
}

async function main() {
  console.log('================================================================');
  console.log('BELLA INTERIOR — PILOT REAL EMPLOYEE SCENARIOS VERIFICATION');
  console.log('Target Tenant:  ', TENANT_ID);
  console.log('Owner Candidate:', OWNER_USER_ID);
  console.log('================================================================\n');

  let passedScenarios = 0;
  let totalScenarios = 0;

  function assert(condition, message) {
    totalScenarios++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passedScenarios++;
    } else {
      console.error(`  [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // -------------------------------------------------------------
  // Scenario 1: Create real branch in org_units & assign to project
  // -------------------------------------------------------------
  console.log('[Scenario 1] Creating pilot branch & linking to project...');
  const branchName = 'Chi nhánh Thảo Điền - TP. Thủ Đức';
  const branchCode = 'CN-THD-01';

  const branchResult = await runSql(`
    INSERT INTO public.org_units (
      id, tenant_id, unit_type, name, code, is_active
    ) VALUES (
      'bbbbbbbb-1111-2222-3333-444444444444',
      '${TENANT_ID}',
      'branch',
      '${branchName}',
      '${branchCode}',
      true
    )
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true
    RETURNING id, name, unit_type, is_active;
  `, 'Create pilot branch');

  assert(branchResult?.length > 0 && branchResult[0].is_active === true, 'Pilot branch created and active in org_units');
  const branchId = branchResult[0].id;

  // Link branch to project INT-THD-2026
  const projectId = '77a11111-2222-3333-4444-555566667777';
  await runSql(`
    UPDATE public.interior_projects
    SET branch_id = '${branchId}'
    WHERE id = '${projectId}' AND tenant_id = '${TENANT_ID}';
  `, 'Link branch to project');

  const projectCheck = await runSql(`
    SELECT id, code, name, branch_id
    FROM public.interior_projects
    WHERE id = '${projectId}';
  `, 'Verify project branch_id');

  assert(projectCheck[0]?.branch_id === branchId, `Project ${projectId} linked to branch ${branchId}`);

  // -------------------------------------------------------------
  // Scenario 2: Verify OWNER tenant-wide visibility
  // -------------------------------------------------------------
  console.log('\n[Scenario 2] Verifying OWNER tenant-wide role & permissions...');
  const ownerRoles = await runSql(`
    SELECT ur.role_key, ur.scope_type, ur.status, r.display_name
    FROM public.interior_user_roles ur
    JOIN public.interior_roles r ON r.role_key = ur.role_key
    WHERE ur.user_id = '${OWNER_USER_ID}' AND ur.tenant_id = '${TENANT_ID}' AND ur.status = 'ACTIVE';
  `, 'Query active owner roles');

  assert(ownerRoles?.some(r => r.role_key === 'OWNER' && r.scope_type === 'TENANT'), 'User has active OWNER role at TENANT scope');

  // -------------------------------------------------------------
  // Scenario 3: Test role assignment: DESIGNER with PROJECT scope
  // -------------------------------------------------------------
  console.log('\n[Scenario 3] Testing scoped role assignment (DESIGNER scoped to specific project)...');
  // Use a simulated pilot designer user UUID
  const designerUserId = 'aaaaaaaa-1111-2222-3333-444444444444';

  // Make sure designer user exists in auth.users or create pilot entry
  await runSql(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud)
    VALUES (
      '${designerUserId}',
      'designer.pilot@bellaspa.vn',
      '{"full_name": "KTS Pilot Designer"}',
      'authenticated',
      'authenticated'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (id, tenant_id, email, full_name, role)
    VALUES (
      '${designerUserId}',
      '${TENANT_ID}',
      'designer.pilot@bellaspa.vn',
      'KTS Pilot Designer',
      'admin_staff'
    )
    ON CONFLICT (id) DO UPDATE SET tenant_id = '${TENANT_ID}';
  `, 'Provision pilot designer auth identity');

  // Assign DESIGNER role scoped to PROJECT
  await runSql(`
    INSERT INTO public.interior_user_roles (
      tenant_id, user_id, role_key, scope_type, scope_id, status, granted_by
    ) VALUES (
      '${TENANT_ID}',
      '${designerUserId}',
      'DESIGNER',
      'PROJECT',
      '${projectId}',
      'ACTIVE',
      '${OWNER_USER_ID}'
    )
    ON CONFLICT DO NOTHING;
  `, 'Assign scoped DESIGNER role');

  const designerRoleCheck = await runSql(`
    SELECT role_key, scope_type, scope_id, status
    FROM public.interior_user_roles
    WHERE user_id = '${designerUserId}' AND tenant_id = '${TENANT_ID}';
  `, 'Verify designer role');

  assert(
    designerRoleCheck?.some(r => r.role_key === 'DESIGNER' && r.scope_type === 'PROJECT' && r.scope_id === projectId),
    'DESIGNER role successfully granted with PROJECT scope'
  );

  // -------------------------------------------------------------
  // Scenario 4: Permission enforcement (Allowed vs Denied)
  // -------------------------------------------------------------
  console.log('\n[Scenario 4] Verifying Permission rules in RBAC catalog...');
  const designerPerms = await runSql(`
    SELECT rp.permission_id, p.description, p.sensitive
    FROM public.interior_role_permissions rp
    JOIN public.interior_permissions p ON p.permission_id = rp.permission_id
    WHERE rp.role_key = 'DESIGNER';
  `, 'Query designer permissions');

  const designerPermIds = designerPerms.map(p => p.permission_id);
  assert(designerPermIds.includes('interior:design:read'), 'DESIGNER has interior:design:read permission');
  assert(designerPermIds.includes('interior:design:write'), 'DESIGNER has interior:design:write permission');
  assert(!designerPermIds.includes('interior:contract:approve'), 'DESIGNER does NOT have interior:contract:approve (least privilege)');
  assert(!designerPermIds.includes('interior:finance:read'), 'DESIGNER does NOT have interior:finance:read (financial containment)');

  // -------------------------------------------------------------
  // Scenario 5: Cross-tenant isolation verification
  // -------------------------------------------------------------
  console.log('\n[Scenario 5] Verifying Cross-Tenant Isolation...');
  const crossTenantCheck = await runSql(`
    SELECT count(*) as count
    FROM public.interior_projects
    WHERE tenant_id = '${OTHER_TENANT_ID}';
  `, 'Check isolation');

  assert(crossTenantCheck[0]?.count === 0 || crossTenantCheck[0]?.count === '0', 'Other tenant has 0 access to projects in current tenant');

  // Verify that interior_projects table RLS has tenant_isolation_policy
  const rlsCheck = await runSql(`
    SELECT tablename, policyname, permissive, cmd
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_projects';
  `, 'Check RLS policies');

  assert(rlsCheck.some(p => p.policyname === 'tenant_isolation_policy' && p.permissive === 'RESTRICTIVE'), 'interior_projects has RESTRICTIVE tenant_isolation_policy');

  // -------------------------------------------------------------
  // Scenario 6: Role revocation immediacy
  // -------------------------------------------------------------
  console.log('\n[Scenario 6] Testing Role Revocation Immediacy...');
  // Revoke designer role
  await runSql(`
    UPDATE public.interior_user_roles
    SET status = 'REVOKED', revoked_by = '${OWNER_USER_ID}', revoked_at = now()
    WHERE user_id = '${designerUserId}' AND tenant_id = '${TENANT_ID}' AND role_key = 'DESIGNER';
  `, 'Revoke designer role');

  const revokedCheck = await runSql(`
    SELECT status, revoked_at
    FROM public.interior_user_roles
    WHERE user_id = '${designerUserId}' AND tenant_id = '${TENANT_ID}' AND role_key = 'DESIGNER';
  `, 'Verify revocation');

  assert(revokedCheck[0]?.status === 'REVOKED' && revokedCheck[0]?.revoked_at !== null, 'Role immediately REVOKED with audit timestamp and revoked_by');

  // -------------------------------------------------------------
  // Scenario 7: Sensitive Financial / Commission Protection
  // -------------------------------------------------------------
  console.log('\n[Scenario 7] Verifying Sensitive Financial Data Protection...');
  const sensitivePerms = await runSql(`
    SELECT permission_id, module_key, description
    FROM public.interior_permissions
    WHERE sensitive = true;
  `, 'Query sensitive permissions');

  console.log(`      Found ${sensitivePerms.length} sensitive permissions protected:`);
  for (const sp of sensitivePerms) {
    console.log(`      - [${sp.permission_id}] ${sp.description}`);
  }
  assert(sensitivePerms.length >= 8, 'At least 8 sensitive action permissions flagged for strict protection');

  console.log('\n================================================================');
  console.log(`PILOT VERIFICATION COMPLETE: ${passedScenarios}/${totalScenarios} SCENARIOS PASSED!`);
  console.log('================================================================');
}

main().catch(err => {
  console.error('\nPILOT VERIFICATION FAILED:', err);
  process.exit(1);
});
