import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { CanonicalCourseCatalogItem, ICanonicalCourseCatalogContract } from './canonical-course-catalog.contract';
import {
  CanonicalCourseCommandError,
  type CreatedCanonicalCourse,
  type CreateCanonicalCourseInput,
  type ICanonicalCourseCommandContract,
} from './canonical-course-catalog.contract';
import { Course } from '../domain/course.entity';
import { SupabaseEducationRepository } from '../repositories/supabase-education.repository';

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
