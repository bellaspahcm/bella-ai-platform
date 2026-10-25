import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CURRENT_ACTOR_PROFILE_RPC,
  CURRENT_ACTOR_ORG_UNIT_ACCESS_RPC,
  reconcileCurrentActorProfile,
  type CurrentActorProfileRow,
} from '../current-actor.contract';

// Independent contract: approved self-only fields and live identity/tenant,
// not Product role permission or a fixture-derived identity assumption.
const profile: CurrentActorProfileRow = {
  id: 'auth-id', email: 'actor@example.invalid', full_name: 'Actor', role: 'ACCOUNTANT',
  avatar_url: null, tenant_id: 'tenant-id', status: 'active', tenant_status: 'active',
};

describe('Platform signed-in actor public contract', () => {
  it('returns exactly the declared CurrentUser fields for the validated Auth ID', () => {
    const unexpectedColumns = { ...profile, password_hash: 'must-not-be-returned', metadata: { role: 'admin' } };
    expect(reconcileCurrentActorProfile('auth-id', [unexpectedColumns])).toEqual({
      id: 'auth-id', email: 'actor@example.invalid', full_name: 'Actor', role: 'accountant',
      avatar_url: null, tenant_id: 'tenant-id', status: 'active',
    });
  });

  it.each(['admin', 'accountant', 'ktv'])('resolves own identity without granting Product action to %s', (role) => {
    const result = reconcileCurrentActorProfile('auth-id', [{ ...profile, role }]);
    expect(result?.role).toBe(role);
    expect(result).not.toHaveProperty('permissions');
    expect(result).not.toHaveProperty('branchId');
  });

  it.each(['', 'other-auth-id'])('denies Auth subject mismatch (%s)', (authId) => {
    expect(reconcileCurrentActorProfile(authId, [profile])).toBeNull();
  });

  it.each([null, [], [profile, profile]])('denies absent or ambiguous results', (rows) => {
    expect(reconcileCurrentActorProfile('auth-id', rows)).toBeNull();
  });

  it.each([
    { status: 'inactive' }, { tenant_status: 'suspended' }, { tenant_id: '' }, { role: '' }, { email: '' },
  ])('denies invalid current authority %j', (overrides) => {
    expect(reconcileCurrentActorProfile('auth-id', [{ ...profile, ...overrides }])).toBeNull();
  });

  it('preserves a nullable display name without fabricating identity', () => {
    expect(reconcileCurrentActorProfile('auth-id', [{ ...profile, full_name: null }])?.full_name).toBeNull();
  });

  it('declares only zero-argument self-read public surfaces with explicit trust grants', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261019060000_platform_current_actor_read_contract.sql'), 'utf8');
    for (const rpc of [CURRENT_ACTOR_PROFILE_RPC, CURRENT_ACTOR_ORG_UNIT_ACCESS_RPC]) {
      expect(sql).toContain(`FUNCTION public.${rpc}()`);
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${rpc}() FROM PUBLIC, anon, authenticated, service_role`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${rpc}() TO authenticated`);
    }
    expect(sql).not.toMatch(/\bGRANT\s+SELECT\b/i);
    expect(sql).not.toMatch(/\b(?:ALTER\s+TABLE|CREATE\s+POLICY|ALTER\s+POLICY|INSERT\s+INTO|UPDATE\s+public\.)/i);
    expect(sql).not.toContain('password_hash');
    expect(sql).toContain('public.platform_org_unit_access_for_actor(v_tenant_id, auth.uid())');
  });
});
