import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { isPreschoolRegistryPage, isRegistryUuid, normalizeRegistryQuery, PreschoolRegistryError,
  type IPreschoolRegistryContract, type PreschoolRegistryPage, type PreschoolRegistryQuery } from './preschool-registry.contract';

type RegistryRpc = { rpc(name: 'edu_preschool_student_registry', args: {
  p_query: string; p_status: string; p_course_id: string | null; p_branch_id: string | null; p_offset: number; p_limit: number;
}): PromiseLike<{ data: unknown; error: { code?: string } | null }> };

export class PreschoolRegistryContractImpl implements IPreschoolRegistryContract {
  constructor(private readonly client: SupabaseClient<Database>) {}
  async read(tenantId: string, input: PreschoolRegistryQuery = {}): Promise<PreschoolRegistryPage> {
    if (!isRegistryUuid(tenantId)) throw new PreschoolRegistryError('REGISTRY_INVALID_REQUEST', 400);
    const q = normalizeRegistryQuery(input);
    const result = await (this.client as unknown as RegistryRpc).rpc('edu_preschool_student_registry', {
      p_query: q.query, p_status: q.status, p_course_id: q.courseId, p_branch_id: q.branchId, p_offset: q.offset, p_limit: q.limit,
    });
    if (result.error) {
      const status = result.error.code === '42501' ? 403 : result.error.code === '22023' ? 400 : 503;
      throw new PreschoolRegistryError(status === 403 ? 'REGISTRY_ACCESS_DENIED' : status === 400 ? 'REGISTRY_INVALID_REQUEST' : 'REGISTRY_UNAVAILABLE', status);
    }
    if (!isPreschoolRegistryPage(result.data, q, tenantId)) throw new PreschoolRegistryError('REGISTRY_UNAVAILABLE', 503);
    return result.data;
  }
}
