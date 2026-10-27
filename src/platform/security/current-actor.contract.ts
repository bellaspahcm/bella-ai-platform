import type { CurrentUser } from '@bella/shared';
import type { Database } from '@/types/database.types';
import type { PlatformCurrentActorReadDatabase } from '@/types/platform-current-actor.database.types';
import type { TrustedActorOrgUnitAccessRow } from '@/platform/org-unit/trusted-actor-access.contract';

export const CURRENT_ACTOR_PROFILE_RPC = 'platform_current_actor_profile';
export const CURRENT_ACTOR_TENANT_PRESENTATION_RPC = 'platform_current_actor_tenant_presentation';
export const CURRENT_ACTOR_ORG_UNIT_ACCESS_RPC = 'platform_current_actor_org_unit_access';

// Compose actual-DB-generated RPCs with the existing application schema.
// Existing tables and functions are preserved; no schema type is hand-repaired.
export type PlatformActorDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: Database['public']['Functions'] & PlatformCurrentActorReadDatabase['public']['Functions'];
  };
};

type GeneratedProfile = PlatformCurrentActorReadDatabase['public']['Functions']['platform_current_actor_profile']['Returns'][number];
type GeneratedTenantPresentation = PlatformCurrentActorReadDatabase['public']['Functions']['platform_current_actor_tenant_presentation']['Returns'][number];
// PostgreSQL function generation does not encode nullable text return columns.
export type CurrentActorProfileRow = Omit<GeneratedProfile, 'avatar_url' | 'full_name'> & {
  avatar_url: string | null;
  full_name: string | null;
};
export type CurrentActorTenantPresentationRow = Omit<GeneratedTenantPresentation,
  'brand_theme' | 'enabled_modules' | 'logo_url' | 'product_key'> & {
  brand_theme: Database['public']['Tables']['tenants']['Row']['brand_theme'] | null;
  enabled_modules: Database['public']['Tables']['tenants']['Row']['enabled_modules'] | null;
  logo_url: Database['public']['Tables']['tenants']['Row']['logo_url'];
  product_key: Database['public']['Tables']['tenants']['Row']['product_key'];
};
export type CurrentActorOrgUnitAccessRow = TrustedActorOrgUnitAccessRow;
export type ActiveCurrentActor = CurrentUser & { readonly status: 'active' };

export type ActiveCurrentActorTenantPresentation = {
  readonly id: string;
  readonly status: 'active';
  readonly name: string;
  readonly product_key: string | null;
  readonly enabled_modules: Database['public']['Tables']['tenants']['Row']['enabled_modules'];
  readonly brand_theme: Database['public']['Tables']['tenants']['Row']['brand_theme'];
  readonly logo_url: string | null;
};

/** Reconcile the self-scoped result with the independently validated Auth ID. */
export function reconcileCurrentActorProfile(
  authId: string,
  rows: readonly CurrentActorProfileRow[] | null,
): ActiveCurrentActor | null {
  if (!authId || !rows || rows.length !== 1) return null;
  const profile = rows[0];
  if (profile.id !== authId || profile.status !== 'active' || profile.tenant_status !== 'active'
      || typeof profile.tenant_id !== 'string' || !profile.tenant_id
      || typeof profile.email !== 'string' || !profile.email
      || typeof profile.role !== 'string' || !profile.role
      || (profile.full_name !== null && typeof profile.full_name !== 'string')
      || (profile.avatar_url !== null && typeof profile.avatar_url !== 'string')) return null;

  // Explicit public fields: never spread a DB object containing unknown columns.
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role.toLowerCase(),
    avatar_url: profile.avatar_url,
    tenant_id: profile.tenant_id,
    status: 'active',
  };
}

/** Reconcile the zero-argument tenant projection against the actor already validated by Auth. */
export function reconcileCurrentActorTenantPresentation(
  expectedTenantId: string,
  rows: readonly CurrentActorTenantPresentationRow[] | null,
): ActiveCurrentActorTenantPresentation | null {
  if (!expectedTenantId || !rows || rows.length !== 1) return null;
  const presentation = rows[0];
  if (presentation.tenant_id !== expectedTenantId || presentation.tenant_status !== 'active'
      || typeof presentation.name !== 'string' || !presentation.name.trim()
      || (presentation.product_key !== null && typeof presentation.product_key !== 'string')
      || (presentation.logo_url !== null && typeof presentation.logo_url !== 'string')
      || presentation.enabled_modules === null || presentation.brand_theme === null) return null;

  return {
    id: presentation.tenant_id,
    status: 'active',
    name: presentation.name,
    product_key: presentation.product_key,
    enabled_modules: presentation.enabled_modules,
    brand_theme: presentation.brand_theme,
    logo_url: presentation.logo_url,
  };
}

// Both zero-argument RPCs require a real authenticated subject, never service
// credentials or an actor/tenant supplied by the caller. Organization provenance
// does not grant Product actions; tenant_admin is not a Finance branch grant.
