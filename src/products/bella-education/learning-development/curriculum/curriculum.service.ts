/**
 * BELLA PRESCHOOL OS — CURRICULUM & LESSON PLAN SERVICE
 *
 * Implements core transactional operations for institutional curriculum frameworks,
 * subjects, and granular lesson plan specifications with strict Gate 0 Tenant Isolation.
 *
 * Canonical Source of Truth: `edu_curriculums` & `edu_lesson_plans`.
 *
 * @module src/products/bella-education/learning-development/curriculum/curriculum.service
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CurriculumDTO,
  CurriculumAgeGroup,
  CurriculumStatus,
  LessonPlanDTO,
  LessonPlanStatus,
  SaveLessonPlanInput,
  SaveCurriculumInput,
  SaveResult,
  SubjectItemDTO,
  LessonPlanObjectiveDTO,
  ActivityStepDTO,
} from './curriculum.contract';

interface DbCurriculumRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly age_group: string;
  readonly academic_year: string;
  readonly total_weeks: number;
  readonly status: string;
  readonly subjects_payload: unknown;
  readonly created_at: string;
  readonly updated_at: string;
}

interface DbLessonPlanRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly curriculum_id: string | null;
  readonly course_id: string | null;
  readonly academic_year: string;
  readonly week_number: number;
  readonly year: number;
  readonly age_group: string;
  readonly theme: string;
  readonly subject_domain: string;
  readonly title: string;
  readonly planned_date: string;
  readonly status: string;
  readonly objectives_payload: unknown;
  readonly materials: string | null;
  readonly activity_steps_payload: unknown;
  readonly teacher_notes: string | null;
  readonly created_by: string | null;
  readonly approved_by: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly edu_courses?: { readonly title: string } | null;
}

function parseObjectives(raw: unknown): LessonPlanObjectiveDTO {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    return {
      knowledge: typeof obj.knowledge === 'string' ? obj.knowledge : '',
      skills: typeof obj.skills === 'string' ? obj.skills : '',
      attitude: typeof obj.attitude === 'string' ? obj.attitude : '',
    };
  }
  return { knowledge: '', skills: '', attitude: '' };
}

function parseActivitySteps(raw: unknown): readonly ActivityStepDTO[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, idx) => ({
      stepNumber: typeof item.stepNumber === 'number' ? item.stepNumber : idx + 1,
      stepName: typeof item.stepName === 'string' ? item.stepName : `Bước ${idx + 1}`,
      durationMinutes: typeof item.durationMinutes === 'number' ? item.durationMinutes : 10,
      teacherAction: typeof item.teacherAction === 'string' ? item.teacherAction : '',
      childrenAction: typeof item.childrenAction === 'string' ? item.childrenAction : '',
    }));
}

function parseSubjects(raw: unknown): readonly SubjectItemDTO[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      code: typeof item.code === 'string' ? item.code : 'SUB',
      name: typeof item.name === 'string' ? item.name : 'Môn học',
      domain: typeof item.domain === 'string' ? item.domain : 'Lĩnh vực phát triển',
      weeklyPeriods: typeof item.weeklyPeriods === 'number' ? item.weeklyPeriods : 2,
      description: typeof item.description === 'string' ? item.description : undefined,
      color: typeof item.color === 'string' ? item.color : 'bg-emerald-50 text-emerald-700',
    }));
}

export class CurriculumService {
  constructor(private readonly supabase: SupabaseClient) {}

  // ── Curriculum Operations ───────────────────────────────────────────────────

  async listCurriculums(
    tenantId: string,
    options?: {
      status?: CurriculumStatus;
      ageGroup?: CurriculumAgeGroup;
      academicYear?: string;
    }
  ): Promise<CurriculumDTO[]> {
    try {
      let query = this.supabase
        .from('edu_curriculums')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (options?.status) query = query.eq('status', options.status);
      if (options?.ageGroup && options.ageGroup !== 'ALL') query = query.eq('age_group', options.ageGroup);
      if (options?.academicYear) query = query.eq('academic_year', options.academicYear);

      const { data, error } = await query;
      if (error || !data) return [];

      return (data as readonly DbCurriculumRow[]).map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description ?? undefined,
        ageGroup: (row.age_group || 'ALL') as CurriculumAgeGroup,
        academicYear: row.academic_year,
        totalWeeks: row.total_weeks,
        status: (row.status || 'ACTIVE') as CurriculumStatus,
        subjects: parseSubjects(row.subjects_payload),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (err) {
      console.warn('[CurriculumService] Failed to list curriculums:', err);
      return [];
    }
  }

  async saveCurriculum(tenantId: string, input: SaveCurriculumInput): Promise<SaveResult> {
    if (!tenantId) return { success: false, id: '', error: 'TENANT_REQUIRED' };
    if (!input.name || input.name.trim().length === 0) return { success: false, id: '', error: 'NAME_REQUIRED' };
    if (!input.code || input.code.trim().length === 0) return { success: false, id: '', error: 'CODE_REQUIRED' };

    try {
      const now = new Date().toISOString();
      const payload = {
        tenant_id: tenantId,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        description: input.description?.trim() ?? null,
        age_group: input.ageGroup || 'ALL',
        academic_year: input.academicYear || '2026-2027',
        total_weeks: input.totalWeeks || 35,
        status: input.status,
        subjects_payload: input.subjects,
        updated_at: now,
      };

      if (input.id) {
        const { error } = await this.supabase
          .from('edu_curriculums')
          .update(payload)
          .eq('id', input.id)
          .eq('tenant_id', tenantId);

        if (error) return { success: false, id: '', error: error.message };
        return { success: true, id: input.id, message: 'Cập nhật khung giáo trình thành công.' };
      } else {
        const { data, error } = await this.supabase
          .from('edu_curriculums')
          .insert({ ...payload, created_at: now })
          .select('id')
          .single();

        if (error || !data) return { success: false, id: '', error: error?.message || 'INSERT_FAILED' };
        return { success: true, id: (data as { id: string }).id, message: 'Tạo mới khung giáo trình thành công.' };
      }
    } catch (err) {
      return { success: false, id: '', error: err instanceof Error ? err.message : 'UNEXPECTED_ERROR' };
    }
  }

  // ── Lesson Plan Operations ──────────────────────────────────────────────────

  async listLessonPlans(
    tenantId: string,
    options?: {
      weekNumber?: number;
      year?: number;
      courseId?: string;
      subjectDomain?: string;
      ageGroup?: CurriculumAgeGroup;
      status?: LessonPlanStatus;
      limit?: number;
    }
  ): Promise<LessonPlanDTO[]> {
    try {
      let query = this.supabase
        .from('edu_lesson_plans')
        .select('*, edu_courses(title)')
        .eq('tenant_id', tenantId)
        .order('planned_date', { ascending: true })
        .order('created_at', { ascending: false });

      if (options?.weekNumber) query = query.eq('week_number', options.weekNumber);
      if (options?.year) query = query.eq('year', options.year);
      if (options?.courseId) query = query.eq('course_id', options.courseId);
      if (options?.subjectDomain && options.subjectDomain !== 'ALL') query = query.eq('subject_domain', options.subjectDomain);
      if (options?.ageGroup && options.ageGroup !== 'ALL') query = query.eq('age_group', options.ageGroup);
      if (options?.status) query = query.eq('status', options.status);
      if (options?.limit) query = query.limit(options.limit);

      const { data, error } = await query;
      if (error || !data) return [];

      return (data as readonly DbLessonPlanRow[]).map((row) => ({
        id: row.id,
        curriculumId: row.curriculum_id ?? undefined,
        courseId: row.course_id ?? undefined,
        courseName: row.edu_courses?.title ?? undefined,
        academicYear: row.academic_year,
        weekNumber: row.week_number,
        year: row.year,
        ageGroup: (row.age_group || 'ALL') as CurriculumAgeGroup,
        theme: row.theme,
        subjectDomain: row.subject_domain,
        title: row.title,
        plannedDate: row.planned_date,
        status: (row.status || 'APPROVED') as LessonPlanStatus,
        objectives: parseObjectives(row.objectives_payload),
        materials: row.materials ?? undefined,
        activitySteps: parseActivitySteps(row.activity_steps_payload),
        teacherNotes: row.teacher_notes ?? undefined,
        createdBy: row.created_by ?? undefined,
        approvedBy: row.approved_by ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (err) {
      console.warn('[CurriculumService] Failed to list lesson plans:', err);
      return [];
    }
  }

  async saveLessonPlan(
    tenantId: string,
    actorId: string,
    input: SaveLessonPlanInput
  ): Promise<SaveResult> {
    if (!tenantId) return { success: false, id: '', error: 'TENANT_REQUIRED' };
    if (!input.title || input.title.trim().length === 0) return { success: false, id: '', error: 'TITLE_REQUIRED' };
    if (!input.theme || input.theme.trim().length === 0) return { success: false, id: '', error: 'THEME_REQUIRED' };
    if (!input.subjectDomain || input.subjectDomain.trim().length === 0) return { success: false, id: '', error: 'DOMAIN_REQUIRED' };
    if (!input.plannedDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.plannedDate)) return { success: false, id: '', error: 'INVALID_DATE' };

    try {
      const now = new Date().toISOString();
      const payload = {
        tenant_id: tenantId,
        curriculum_id: input.curriculumId || null,
        course_id: input.courseId || null,
        academic_year: input.academicYear || '2026-2027',
        week_number: input.weekNumber,
        year: input.year || 2026,
        age_group: input.ageGroup || 'ALL',
        theme: input.theme.trim(),
        subject_domain: input.subjectDomain.trim(),
        title: input.title.trim(),
        planned_date: input.plannedDate,
        status: input.status,
        objectives_payload: input.objectives,
        materials: input.materials?.trim() ?? null,
        activity_steps_payload: input.activitySteps,
        teacher_notes: input.teacherNotes?.trim() ?? null,
        approved_by: input.status === 'APPROVED' ? actorId : null,
        updated_at: now,
      };

      if (input.id) {
        const { error } = await this.supabase
          .from('edu_lesson_plans')
          .update(payload)
          .eq('id', input.id)
          .eq('tenant_id', tenantId);

        if (error) return { success: false, id: '', error: error.message };
        return { success: true, id: input.id, message: 'Cập nhật giáo án thành công.' };
      } else {
        const { data, error } = await this.supabase
          .from('edu_lesson_plans')
          .insert({
            ...payload,
            created_by: actorId,
            created_at: now,
          })
          .select('id')
          .single();

        if (error || !data) return { success: false, id: '', error: error?.message || 'INSERT_FAILED' };
        return { success: true, id: (data as { id: string }).id, message: 'Soạn giáo án bài học thành công.' };
      }
    } catch (err) {
      return { success: false, id: '', error: err instanceof Error ? err.message : 'UNEXPECTED_ERROR' };
    }
  }

  async deleteLessonPlan(tenantId: string, id: string): Promise<SaveResult> {
    try {
      const { error } = await this.supabase
        .from('edu_lesson_plans')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) return { success: false, id, error: error.message };
      return { success: true, id, message: 'Đã xóa giáo án thành công.' };
    } catch (err) {
      return { success: false, id, error: err instanceof Error ? err.message : 'DELETE_FAILED' };
    }
  }
}

