import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { createClient } from '@/lib/supabase-server';
import type { IEducationCourseContract, CreateCourseInput, EducationCourseDTO } from './course.contract';
import { Course } from '../domain/course.entity';
import { SupabaseEducationRepository } from '../repositories/supabase-education.repository';

function requireTenant(tenantId: string): void {
  if (!tenantId || tenantId.trim() !== tenantId) throw new Error('ACADEMIC_COURSE_TENANT_REQUIRED');
}

function mapCourse(course: Course): EducationCourseDTO {
  if (!['draft', 'active', 'archived'].includes(course.status)
    || !Array.isArray(course.prerequisiteCourseCodes)
    || course.prerequisiteCourseCodes.some(code => typeof code !== 'string')) {
    throw new Error('ACADEMIC_COURSE_INVALID_PERSISTED_STATE');
  }
  return { id: course.id, tenantId: course.tenantId, courseCode: course.courseCode,
    title: course.title, status: course.status, prerequisites: [...course.prerequisiteCourseCodes] };
}

/** Academic catalog only. Legacy offerings/Training persistence retain their own scope. */
export class CourseContractImpl implements IEducationCourseContract {
  constructor(private readonly client?: SupabaseClient<Database>) {}

  private async getClient(): Promise<SupabaseClient<Database>> {
    return this.client ?? await createClient();
  }

  public async createCourse(input: CreateCourseInput): Promise<EducationCourseDTO> {
    requireTenant(input.tenantId);
    if (!input.courseCode?.trim() || !input.title?.trim()) throw new Error('ACADEMIC_COURSE_CODE_AND_TITLE_REQUIRED');
    const client = await this.getClient();
    const repository = new SupabaseEducationRepository(client);
    // Initial active state and prerequisite course codes are the batch2r owner decision.
    const course = Course.create({ tenantId: input.tenantId, courseCode: input.courseCode,
      title: input.title, status: 'active', prerequisiteCourseCodes: input.prerequisites });
    // CREATE means INSERT. Conflict must fail, never update an existing catalog item.
    const { error } = await client.from('edu_courses').insert({
      id: course.id, tenant_id: course.tenantId, course_code: course.courseCode,
      title: course.title, status: course.status, max_students: course.maxStudents,
      current_enrollment: course.currentEnrollment, prerequisite_course_codes: course.prerequisiteCourseCodes,
      created_at: course.createdAt.toISOString(), updated_at: course.updatedAt.toISOString(),
    });
    if (error) throw new Error('ACADEMIC_COURSE_CREATE_FAILED:' + error.code);
    const persisted = await repository.findCourseById(course.id, input.tenantId);
    if (!persisted) throw new Error('ACADEMIC_COURSE_CREATE_READBACK_UNAVAILABLE');
    return mapCourse(persisted);
  }

  public async getCourse(tenantId: string, courseId: string): Promise<EducationCourseDTO | null> {
    requireTenant(tenantId);
    const course = await new SupabaseEducationRepository(await this.getClient()).findCourseById(courseId, tenantId);
    return course ? mapCourse(course) : null;
  }

  public async listCourses(tenantId: string): Promise<readonly EducationCourseDTO[]> {
    requireTenant(tenantId);
    // The existing repository has no listing capability; keep this owning adapter query local.
    const client = await this.getClient();
    const rows: Database['public']['Tables']['edu_courses']['Row'][] = [];
    let total: number | undefined;
    do {
      const result = await client.from('edu_courses').select('*', { count: 'exact' })
        .eq('tenant_id', tenantId).order('id', { ascending: true }).range(rows.length, rows.length + 199);
      if (result.error || !Array.isArray(result.data) || result.count === null
        || (total !== undefined && result.count !== total)
        || (result.data.length === 0 && rows.length < result.count)) {
        throw new Error('ACADEMIC_COURSE_CATALOG_UNAVAILABLE');
      }
      total = result.count;
      rows.push(...result.data);
      if (rows.length > total) throw new Error('ACADEMIC_COURSE_CATALOG_UNAVAILABLE');
    } while (rows.length < total);
    const seen = new Set<string>();
    return rows.map(row => {
      if (!row.id || seen.has(row.id) || row.tenant_id !== tenantId
        || typeof row.course_code !== 'string' || typeof row.title !== 'string'
        || !['draft', 'active', 'archived'].includes(row.status)
        || (row.prerequisite_course_codes !== null && (!Array.isArray(row.prerequisite_course_codes)
          || row.prerequisite_course_codes.some(code => typeof code !== 'string')))) {
        throw new Error('ACADEMIC_COURSE_INVALID_PERSISTED_STATE');
      }
      seen.add(row.id);
      return mapCourse(Course.create({ id: row.id, tenantId, courseCode: row.course_code, title: row.title,
        status: row.status as EducationCourseDTO['status'], prerequisiteCourseCodes: row.prerequisite_course_codes ?? [] }));
    });
  }
}
