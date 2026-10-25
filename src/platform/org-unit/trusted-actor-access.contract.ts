/**
 * Platform public SQL contract for trusted server transactions.
 * Call only after authenticating the API caller and resolving its canonical IDs.
 * The service-only function validates live Auth/profile/tenant and returns the
 * current relationship projection. It never grants a Product action.
 */
export const TRUSTED_ACTOR_ORG_UNIT_ACCESS_RPC = 'platform_org_unit_access_for_actor';

export interface TrustedActorOrgUnitAccessInput {
  readonly p_tenant_id: string;
  readonly p_actor_id: string;
}

export interface TrustedActorOrgUnitAccessRow {
  readonly user_id: string;
  readonly tenant_id: string;
  readonly org_unit_id: string;
  readonly root_org_unit_id: string;
  readonly relationship_id: string | null;
  readonly access_source: 'belongs_to' | 'manages' | 'participates_in' | 'tenant_admin';
}

export interface ITrustedActorOrgUnitAccessContract {
  listForActor(input: TrustedActorOrgUnitAccessInput): Promise<readonly TrustedActorOrgUnitAccessRow[]>;
}

// Invalid identity/tenant and untrusted callers raise SQL42501, not empty access.
// A valid actor with no matching current relationship may return no explicit rows.
// Products must separately apply action policy and the required provenance filter.

/** Server transaction assertion: locks the current active branch row FOR SHARE,
 * checks tenant/type and explicit relationship access via the existing producer.
 * SQL42501 denies invalid or stale context. It grants no Product action. The
 * caller must acquire its remaining write/FK locks before final authorization. */
export const ASSERT_ACTIVE_BRANCH_FOR_ACTOR_RPC = 'platform_assert_active_branch_for_actor';
export interface AssertActiveBranchForActorInput extends TrustedActorOrgUnitAccessInput {
  readonly p_branch_id: string;
}
