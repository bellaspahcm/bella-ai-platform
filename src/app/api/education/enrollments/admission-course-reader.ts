import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { AdmissionCourseReader } from '@/products/bella-education/services/preschool-admission.service';

/** Existing API canonical-course adapter debt; public Course reads a different model. */
export function admissionCourseReader(client: SupabaseClient<Database>): AdmissionCourseReader {
  return { async readCourse(tenantId,courseId) {
    const { data,error } = await client.from('edu_courses').select('id,title,status')
      .eq('tenant_id',tenantId).eq('id',courseId).maybeSingle();
    if (error) throw new Error(`Admission course read failed: ${error.message}`);
    return data;
  } };
}
