import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocalDateString } from '@bella/shared';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { TeacherAssignmentContractImpl } from '@/platform/education/contracts/teacher-assignment.contract.impl';
import { getCurrentUser } from '@/services/user-actions';
import type { Database } from '@/types/database.types';

type EducationCoursesClient = SupabaseClient<Database>;
type EduCourseRow = Pick<
  Database['public']['Tables']['edu_courses']['Row'],
  'id' | 'course_code' | 'title' | 'status' | 'max_students' | 'current_enrollment' | 'created_at'
>;
type CourseProjectionRow = Pick<
  Database['public']['Tables']['courses']['Row'],
  'course_id' | 'course_code' | 'course_name' | 'description' | 'duration_weeks' | 'metadata' | 'status'
>;
const ROSTER_ENROLLMENT_STATUSES = ['active', 'pending'] as const;

export interface ClassroomOverviewItem {
  id: string;
  code: string;
  name: string;
  grade: string;
  gradeKey: 'mam' | 'choi' | 'la' | 'nursery';
  room: string;
  teacher: string;
  leadTeacher?: string;
  assistantTeacher?: string;
  teacherPartyId?: string;
  students: number;
  maxStudents: number;
  academicYear: string;
  focus: string;
  status: 'active' | 'inactive' | 'archived';
  todayStatus: {
    present: number;
    excused: number;
    unmarked: number;
    healthAlerts: number;
  };
}

function getDevMockEmail(request: Request): string {
  if (process.env.NODE_ENV !== 'development') return '';
  return request.headers.get('x-mock-user-email')?.trim() ?? '';
}

function createAdminOperationClient(): EducationCoursesClient | null {
  if (process.env.NODE_ENV === 'test') return null;
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;

  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function readMetadataString(metadata: CourseProjectionRow['metadata'], key: string): string {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') {
    return '';
  }

  const record = metadata as Record<string, unknown>;
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

async function getTenantIdForCourses(
  supabase: EducationCoursesClient,
  request: Request,
): Promise<string> {
  const { searchParams } = new URL(request.url);
  const explicitTenantId = searchParams.get('tenantId');
  if (explicitTenantId) return explicitTenantId;

  const mockEmail = getDevMockEmail(request);
  if (mockEmail) {
    const { data: mockUser } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('email', mockEmail)
      .maybeSingle();
    if (mockUser?.tenant_id) return mockUser.tenant_id;
  }

  const currentUser = await getCurrentUser();
  if (currentUser?.tenant_id && currentUser.tenant_id !== '00000000-0000-0000-0000-000000000001') {
    return currentUser.tenant_id;
  }

  if (process.env.NODE_ENV === 'development') {
    return 'ed100000-0000-0000-0000-000000000001';
  }

  return currentUser?.tenant_id || '00000000-0000-0000-0000-000000000001';
}

export async function GET(request: Request) {
  try {
    const supabase = createAdminOperationClient() ?? await createClient();
    const tenantId = await getTenantIdForCourses(supabase, request);

    const { searchParams } = new URL(request.url);
    const targetDate = searchParams.get('date') || getLocalDateString(new Date()) || '2026-10-18';

    // 1. Fetch canonical Education courses used by enrollment runtime.
    const { data: dbCourses, error: courseErr } = await supabase
      .from('edu_courses')
      .select('id, course_code, title, status, max_students, current_enrollment, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (courseErr) {
      return NextResponse.json({ success: false, error: courseErr.message }, { status: 500 });
    }

    const teacherContract = new TeacherAssignmentContractImpl(supabase);
    const canonicalCourses = (dbCourses || []) as EduCourseRow[];
    const courseIds = canonicalCourses.map((course) => course.id);
    const { data: courseProjections, error: projectionErr } = courseIds.length > 0
      ? await supabase
        .from('courses')
        .select('course_id, course_code, course_name, description, duration_weeks, metadata, status')
        .eq('tenant_id', tenantId)
        .in('course_id', courseIds)
      : { data: [] as CourseProjectionRow[], error: null };

    if (projectionErr) {
      return NextResponse.json({ success: false, error: projectionErr.message }, { status: 500 });
    }

    const projectionByCourseId = new Map(
      ((courseProjections || []) as CourseProjectionRow[]).map((projection) => [projection.course_id, projection]),
    );

    // 2. Map courses to ClassroomOverviewItem
    const classrooms: ClassroomOverviewItem[] = [];

    for (const course of canonicalCourses) {
      const projection = projectionByCourseId.get(course.id);
      // Fetch active teacher assignments for course
      const teacherAssignments = await teacherContract.getCourseTeachers(tenantId, course.id);
      
      let teacherNames = 'Chưa phân công GVN';
      let leadTeacherName = '';
      let assistantTeacherName = '';
      let leadTeacherPartyId: string | undefined = undefined;

      if (teacherAssignments.length > 0) {
        // Fetch teacher party display names
        const partyIds = teacherAssignments.map(t => t.teacherPartyId);
        const { data: parties } = await supabase
          .from('party_parties')
          .select('id, display_name')
          .in('id', partyIds);

        const partyMap = new Map((parties || []).map(p => [p.id, p.display_name]));

        const lead = teacherAssignments.find(t => t.role === 'lead_teacher');
        const assistant = teacherAssignments.find(t => t.role !== 'lead_teacher');
        if (lead) {
          leadTeacherPartyId = lead.teacherPartyId;
          leadTeacherName = partyMap.get(lead.teacherPartyId) || '';
        }
        if (assistant) {
          assistantTeacherName = partyMap.get(assistant.teacherPartyId) || '';
        }

        const sortedAssignments = [...teacherAssignments].sort((a, b) => {
          if (a.role === 'lead_teacher') return -1;
          if (b.role === 'lead_teacher') return 1;
          return 0;
        });

        teacherNames = sortedAssignments
          .map(t => `${partyMap.get(t.teacherPartyId) || 'Giáo viên'} (${t.role === 'lead_teacher' ? 'Chủ nhiệm' : 'GV Phụ'})`)
          .join(' • ');
      }

      // Count canonical active enrollments for capacity.
      const { count: studentCount } = await supabase
        .from('edu_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', course.id)
        .eq('tenant_id', tenantId)
        .in('status', [...ROSTER_ENROLLMENT_STATUSES]);

      // Grade key mapping from course_code or course_name
      let gradeKey: 'mam' | 'choi' | 'la' | 'nursery' = 'mam';
      const codeUpper = (course.course_code || '').toUpperCase();
      const title = projection?.course_name || course.title || '';
      const titleLower = title.toLowerCase();

      if (
        codeUpper.includes('NURSERY') ||
        codeUpper.includes('NHA-TRE') ||
        codeUpper.includes('NHA_TRE') ||
        /\b(TRE|NURSERY)\b/i.test(codeUpper) ||
        titleLower.includes('nhà trẻ') ||
        titleLower.includes('nhatre') ||
        titleLower.includes('nursery')
      ) {
        gradeKey = 'nursery';
      } else if (
        codeUpper.includes('CHOI') ||
        titleLower.includes('chồi') ||
        /\bchoi\b/i.test(titleLower)
      ) {
        gradeKey = 'choi';
      } else if (
        /\bLA\b/.test(codeUpper) ||
        codeUpper.startsWith('LA-') ||
        codeUpper.startsWith('LA_') ||
        titleLower.includes('khối lá') ||
        titleLower.includes('lớp lá') ||
        /\blá\b/i.test(titleLower)
      ) {
        gradeKey = 'la';
      } else if (
        codeUpper.includes('MAM') ||
        titleLower.includes('khối mầm') ||
        titleLower.includes('lớp mầm') ||
        titleLower.includes('mầm non') ||
        /\bmầm\b/i.test(titleLower)
      ) {
        gradeKey = 'mam';
      }

      const defaultGradeLabel =
        gradeKey === 'nursery' ? 'Nhà Trẻ (18-36 tháng)'
        : gradeKey === 'choi' ? 'Khối Chồi (4 tuổi)'
        : gradeKey === 'la' ? 'Khối Lá (5 tuổi)'
        : 'Khối Mầm (3 tuổi)';

      const currentStudents = studentCount || course.current_enrollment || 0;
      const maxCap = course.max_students || projection?.duration_weeks || 25;
      const today = targetDate;
      const { data: enrollmentRows } = await supabase
        .from('edu_enrollments')
        .select('id')
        .eq('course_id', course.id)
        .eq('tenant_id', tenantId)
        .in('status', [...ROSTER_ENROLLMENT_STATUSES]);

      const enrollmentIds = (enrollmentRows || []).map((enrollment) => enrollment.id);
      const { data: todayStates } = enrollmentIds.length > 0
        ? await supabase
          .from('edu_attendance_daily_state')
          .select('status')
          .eq('tenant_id', tenantId)
          .eq('school_day', today)
          .in('enrollment_id', enrollmentIds)
        : { data: [] };

      const presentCount = (todayStates || []).filter((state) => state.status === 'present').length;
      const excusedCount = (todayStates || []).filter((state) => state.status === 'excused').length;
      const markedCount = todayStates?.length || 0;

      classrooms.push({
        id: course.id,
        code: course.course_code,
        name: title,
        grade: projection?.description || defaultGradeLabel,
        gradeKey,
        room: readMetadataString(projection?.metadata ?? null, 'room') || 'Phòng 101 • Tầng 1',
        teacher: teacherNames,
        leadTeacher: leadTeacherName,
        assistantTeacher: assistantTeacherName,
        teacherPartyId: leadTeacherPartyId,
        students: currentStudents,
        maxStudents: maxCap,
        academicYear: '2025-2026',
        focus: projection?.description || 'Phát triển Kỹ năng & Vận động',
        status: course.status === 'active' ? 'active' : course.status === 'archived' ? 'archived' : 'inactive',
        todayStatus: {
          present: presentCount,
          excused: excusedCount,
          unmarked: Math.max(0, currentStudents - markedCount),
          healthAlerts: 0,
        },
      });
    }

    return NextResponse.json({ success: true, classrooms });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST() {
  console.warn('[education/courses] COURSE_AUTHORIZATION_NOT_READY');
  // Temporary containment; does not infer permission from a mutable profile.
  return NextResponse.json({
    success: false,
    error: 'COURSE_AUTHORIZATION_NOT_READY',
    message: 'Quyền tạo lớp đang được xác minh. Vui lòng thử lại sau.',
  }, { status: 503 });
}
