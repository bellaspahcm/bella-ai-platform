import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { IPreschoolAdminBranchCatalogContract, PreschoolAdminBranchCatalogItem } from './preschool-admin-branch-catalog.contract';

interface PreschoolAdminBranchCatalogRpcClient {
  rpc(name: 'edu_preschool_admin_branch_catalog'): PromiseLike<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseBranches(data: unknown): PreschoolAdminBranchCatalogItem[] {
  if (!Array.isArray(data)) throw new Error('PRESCHOOL_ADMIN_BRANCH_CATALOG_UNAVAILABLE');
  const seen = new Set<string>();
  return data.map((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('PRESCHOOL_ADMIN_BRANCH_CATALOG_UNAVAILABLE');
    }
    const row = value as Record<string, unknown>;
    if (Object.keys(row).sort().join(',') !== 'id,name' || typeof row.id !== 'string'
      || !uuidPattern.test(row.id) || seen.has(row.id) || typeof row.name !== 'string'
      || row.name.trim().length === 0) {
      throw new Error('PRESCHOOL_ADMIN_BRANCH_CATALOG_UNAVAILABLE');
    }
    seen.add(row.id);
    return { id: row.id, name: row.name };
  });
}

/** The RPC derives identity, tenant, product and branch scope from the caller JWT. */
export class PreschoolAdminBranchCatalogContractImpl implements IPreschoolAdminBranchCatalogContract {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listCurrentPreschoolAdminBranches(): Promise<readonly PreschoolAdminBranchCatalogItem[]> {
    let result: Awaited<ReturnType<PreschoolAdminBranchCatalogRpcClient['rpc']>>;
    try {
      result = await (this.client as unknown as PreschoolAdminBranchCatalogRpcClient)
        .rpc('edu_preschool_admin_branch_catalog');
    } catch {
      throw new Error('PRESCHOOL_ADMIN_BRANCH_CATALOG_UNAVAILABLE');
    }
    if (result.error) throw new Error('PRESCHOOL_ADMIN_BRANCH_CATALOG_UNAVAILABLE');
    return parseBranches(result.data);
  }
}
