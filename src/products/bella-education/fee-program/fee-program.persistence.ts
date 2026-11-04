import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export interface FeeProgramPublication {
  readonly programVersionId: string;
  readonly status: 'PUBLISHED';
  readonly duplicate: boolean;
}

/** Uses the authenticated caller; the database derives actor, tenant and authorization. */
export async function publishFeeProgramVersion(
  client: SupabaseClient<Database>,
  programVersionId: string,
): Promise<FeeProgramPublication> {
  const { data, error } = await client.rpc('preschool_publish_fee_program_version', {
    p_program_version_id: programVersionId,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || data.status !== 'PUBLISHED' || typeof data.programVersionId !== 'string'
    || data.programVersionId !== programVersionId || typeof data.duplicate !== 'boolean') {
    throw new Error('FEE_PROGRAM_PUBLICATION_INVALID_RESPONSE');
  }
  return { programVersionId: data.programVersionId, status: 'PUBLISHED', duplicate: data.duplicate };
}
