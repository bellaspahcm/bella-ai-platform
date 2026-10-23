import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export function assertLocalFinanceFixtureTarget(): void {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid');
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)
      || process.env.PRESCHOOL_FINANCE_TEST_PROJECT !== 'bella-preschool-proof-20261019') {
    throw new Error('FINANCE_FIXTURE_REQUIRES_VERIFIED_LOCAL_PROJECT');
  }
}

// Controlled local fixture setup, never an application authorization helper.
// The approved Finance policy requires an explicit relationship even for admin.
export async function createFinanceBranchFixture(
  client: SupabaseClient<Database>, tenantId: string, actorUserId: string, role: 'admin' | 'accountant',
): Promise<{ branchId: string; assignmentActorUserId: string }> {
  assertLocalFinanceFixtureTarget();
  const branchId = crypto.randomUUID();
  const personId = crypto.randomUUID();
  const branch = await client.from('org_units').insert({
    id: branchId, tenant_id: tenantId, unit_type: 'branch', name: 'Controlled Finance branch', is_active: true,
  });
  if (branch.error) throw new Error(`FINANCE_BRANCH_FIXTURE_FAILED: ${branch.error.message}`);
  const person = await client.from('people_directory').insert({
    id: personId, tenant_id: tenantId, user_id: actorUserId,
    person_type: 'employee', display_name: 'Controlled Finance actor bridge', is_active: true,
  });
  if (person.error) throw new Error(`FINANCE_PERSON_FIXTURE_FAILED: ${person.error.message}`);
  const relationship = await client.from('org_relationships').insert({
    tenant_id: tenantId, from_id: personId, from_type: 'person',
    to_id: branchId, to_type: 'unit', rel_type: 'belongs_to',
  });
  if (relationship.error) throw new Error(`FINANCE_RELATIONSHIP_FIXTURE_FAILED: ${relationship.error.message}`);
  let assignmentActorUserId = actorUserId;
  if (role === 'accountant') {
    // Assignment is an admission action: a Finance accountant must not gain it.
    const email = `controlled-finance-assignment-${crypto.randomUUID()}@example.invalid`;
    const identity = await client.auth.admin.createUser({ email, email_confirm: true });
    if (identity.error || !identity.data.user) throw new Error('FINANCE_ASSIGNMENT_ACTOR_FIXTURE_FAILED');
    assignmentActorUserId = identity.data.user.id;
    const actor = await client.from('users').insert({
      id: assignmentActorUserId, tenant_id: tenantId, email,
      full_name: 'Controlled admission fixture actor', role: 'admin', status: 'active',
    });
    if (actor.error) throw new Error(`FINANCE_ASSIGNMENT_ACTOR_FIXTURE_FAILED: ${actor.error.message}`);
  }
  return { branchId, assignmentActorUserId };
}

export async function assignFinanceStudentFixture(
  client: SupabaseClient<Database>, input: {
    tenantId: string; actorUserId: string; branchId: string; studentPartyId: string;
    enrollmentId: string; courseId: string; requestId: string;
  },
): Promise<void> {
  assertLocalFinanceFixtureTarget();
  const registry = await client.from('students').insert({
    tenant_id: input.tenantId, party_id: input.studentPartyId,
    student_code: `FIN-${crypto.randomUUID()}`, academic_status: 'enrolled',
    enrollment_type: 'full_time', program_id: 'primary',
    enrollment_date: new Date().toISOString().slice(0, 10), created_by: input.actorUserId,
  }).select('student_id, party_id').single();
  if (registry.error || !registry.data || registry.data.party_id !== input.studentPartyId
      || registry.data.student_id === input.studentPartyId) {
    throw new Error(`FINANCE_STUDENT_REGISTRY_FIXTURE_FAILED: ${registry.error?.message ?? 'canonical IDs required'}`);
  }
  // Invoke the public Product writer. Do not insert its private assignment tables.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
    throw new Error('FINANCE_ASSIGNMENT_FIXTURE_REQUIRES_ISOLATED_LOCAL_DB');
  }
  const response = await fetch(`${url}/rest/v1/rpc/preschool_assign_chain`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_tenant_id: input.tenantId, p_actor_id: input.actorUserId,
      p_course_id: input.courseId, p_enrollment_id: input.enrollmentId,
      p_branch_id: input.branchId, p_request_id: input.requestId,
    }),
  });
  if (!response.ok) throw new Error(`FINANCE_ASSIGNMENT_FIXTURE_FAILED: HTTP ${response.status}`);
  const assignment = await client.from('preschool_chain_enrollment_branch_assignments')
    .select('enrollment_id, course_id, branch_id, request_id')
    .eq('tenant_id', input.tenantId).eq('enrollment_id', input.enrollmentId).single();
  if (assignment.error || !assignment.data || assignment.data.course_id !== input.courseId
      || assignment.data.branch_id !== input.branchId || assignment.data.request_id !== input.requestId) {
    throw new Error(`FINANCE_ASSIGNMENT_READBACK_FAILED: ${assignment.error?.message ?? 'canonical mapping mismatch'}`);
  }
}
