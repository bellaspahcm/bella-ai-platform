import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { CanonicalCourseCatalogItem, ICanonicalCourseCatalogContract } from './canonical-course-catalog.contract';

/** Caller-scoped read only. RLS remains authoritative; failures never become empty data. */
export class CanonicalCourseCatalogContractImpl implements ICanonicalCourseCatalogContract {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listCourses(tenantId: string): Promise<readonly CanonicalCourseCatalogItem[]> {
    if (!tenantId || tenantId.trim() !== tenantId) throw new Error('CANONICAL_COURSE_TENANT_REQUIRED');
    const result = await this.client.from('edu_courses')
      .select('id, tenant_id, course_code, title, status', { count: 'exact' })
      .eq('tenant_id', tenantId).order('id', { ascending: true });
    if (result.error || !Array.isArray(result.data) || result.count !== result.data.length) {
      throw new Error('CANONICAL_COURSE_CATALOG_UNAVAILABLE');
    }
    const seen = new Set<string>();
    return result.data.map(row => {
      if (!row.id || seen.has(row.id) || row.tenant_id !== tenantId
        || typeof row.course_code !== 'string' || typeof row.title !== 'string'
        || !['draft', 'active', 'archived'].includes(row.status)) {
        throw new Error('CANONICAL_COURSE_CATALOG_UNAVAILABLE');
      }
      seen.add(row.id);
      return { id: row.id, tenantId, courseCode: row.course_code, title: row.title,
        status: row.status as CanonicalCourseCatalogItem['status'] };
    });
  }
}
