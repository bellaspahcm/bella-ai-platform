import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { AdmissionCourseReader } from '@/products/bella-education/services/preschool-admission.service';

/** Existing API canonical-course adapter debt; public Course reads a different model. */
export function admissionCourseReader(client: SupabaseClient<Database>): AdmissionCourseReader & {
  readCourse(tenantId: string, courseId: string): Promise<{ id: string; title: string; status: string; course_code?: string | null; max_students?: number | null } | null>;
} {
  return { async readCourse(tenantId, courseId) {
    const { data, error } = await client.from('edu_courses').select('id,title,status,course_code,max_students')
      .eq('tenant_id', tenantId).eq('id', courseId).maybeSingle();
    if (error) throw new Error(`Admission course read failed: ${error.message}`);
    return data;
  } };
}
