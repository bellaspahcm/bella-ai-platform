import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type {
  CanonicalCourseCatalogItem,
  ICanonicalCourseCatalogContract,
  ICanonicalPreschoolAdminCourseReadContract,
} from './canonical-course-catalog.contract';
import {
  CanonicalCourseCommandError,
  type CanonicalPreschoolAdminCourse,
  type CreatedCanonicalCourse,
  type CreateCanonicalCourseInput,
  type ICanonicalCourseCommandContract,
} from './canonical-course-catalog.contract';
import { Course } from '../domain/course.entity';
import { SupabaseEducationRepository } from '../repositories/supabase-education.repository';

interface PreschoolAdminCourseCatalogRpc {
  rpc(name: 'edu_preschool_admin_course_catalog', args: { p_course_id: string | null }): PromiseLike<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parsePreschoolAdminCatalogRows(
  data: unknown,
  tenantId: string,
): CanonicalPreschoolAdminCourse[] {
  if (!Array.isArray(data)) throw new Error('CANONICAL_COURSE_CATALOG_UNAVAILABLE');
  const seen = new Set<string>();
  return data.map((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('CANONICAL_COURSE_CATALOG_UNAVAILABLE');
    }
    const row = value as Record<string, unknown>;
    if (typeof row.id !== 'string' || !uuidPattern.test(row.id) || seen.has(row.id)
      || row.tenant_id !== tenantId || typeof row.course_code !== 'string'
      || typeof row.title !== 'string' || !['draft', 'active', 'archived'].includes(String(row.status))
      || !Array.isArray(row.prerequisite_course_codes)
      || row.prerequisite_course_codes.some((code: unknown) => typeof code !== 'string')) {
      throw new Error('CANONICAL_COURSE_CATALOG_UNAVAILABLE');
    }
    seen.add(row.id);
    return {
      id: row.id,
      tenantId,
      courseCode: row.course_code,
      title: row.title,
      status: row.status as CanonicalCourseCatalogItem['status'],
      prerequisites: [...row.prerequisite_course_codes] as string[],
    };
  });
}

/** Caller-scoped read only. RLS remains authoritative; failures never become empty data. */
export class CanonicalCourseCatalogContractImpl implements ICanonicalCourseCatalogContract, ICanonicalPreschoolAdminCourseReadContract {
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

  /** Admin-only Preschool catalog. The RPC derives actor and tenant from the current JWT. */
  async listPreschoolAdminCourses(tenantId: string): Promise<readonly CanonicalCourseCatalogItem[]> {
    if (!uuidPattern.test(tenantId)) throw new Error('CANONICAL_COURSE_TENANT_REQUIRED');
    let result: Awaited<ReturnType<PreschoolAdminCourseCatalogRpc['rpc']>>;
    try {
      result = await (this.client as unknown as PreschoolAdminCourseCatalogRpc)
        .rpc('edu_preschool_admin_course_catalog', { p_course_id: null });
    } catch {
      throw new Error('CANONICAL_COURSE_CATALOG_UNAVAILABLE');
    }
    if (result.error) throw new Error('CANONICAL_COURSE_CATALOG_UNAVAILABLE');
    return parsePreschoolAdminCatalogRows(result.data, tenantId)
      .map(({ id, tenantId: rowTenantId, courseCode, title, status }) => ({
        id, tenantId: rowTenantId, courseCode, title, status,
      }));
  }

  /** Reads one class through the same admin-only Preschool contract; foreign IDs return no row. */
  async getPreschoolAdminCourse(tenantId: string, courseId: string): Promise<CanonicalPreschoolAdminCourse | null> {
    if (!uuidPattern.test(tenantId) || !uuidPattern.test(courseId)) {
      throw new Error('CANONICAL_COURSE_INVALID_REQUEST');
    }
    let result: Awaited<ReturnType<PreschoolAdminCourseCatalogRpc['rpc']>>;
    try {
      result = await (this.client as unknown as PreschoolAdminCourseCatalogRpc)
        .rpc('edu_preschool_admin_course_catalog', { p_course_id: courseId });
    } catch {
      throw new Error('CANONICAL_COURSE_CATALOG_UNAVAILABLE');
    }
    if (result.error) throw new Error('CANONICAL_COURSE_CATALOG_UNAVAILABLE');
    const rows = parsePreschoolAdminCatalogRows(result.data, tenantId);
    if (rows.length > 1) throw new Error('CANONICAL_COURSE_CATALOG_UNAVAILABLE');
    return rows[0] ?? null;
  }
}

/** Atomic canonical writer; persistence and retry identity stay in Education's owning repository. */
export class CanonicalCourseCommandContractImpl implements ICanonicalCourseCommandContract {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async createCourse(input: CreateCanonicalCourseInput): Promise<CreatedCanonicalCourse> {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (![input.tenantId, input.actorId, input.branchId, input.operationKey]
      .every(value => typeof value === 'string' && uuid.test(value))
      || typeof input.courseCode !== 'string' || !input.courseCode.trim() || input.courseCode.length > 80
      || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200) {
      throw new CanonicalCourseCommandError('CANONICAL_COURSE_INVALID_REQUEST', 400);
    }

    const course = Course.create({
      tenantId: input.tenantId.toLowerCase(),
      courseCode: input.courseCode,
      title: input.title,
    });
    return new SupabaseEducationRepository(this.client).executeCreateCourseTransaction({
      course,
      actorId: input.actorId.toLowerCase(),
      operationKey: input.operationKey.toLowerCase(),
      branchId: input.branchId.toLowerCase(),
    });
  }
}
