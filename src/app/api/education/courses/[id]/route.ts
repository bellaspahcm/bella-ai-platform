import { NextResponse } from 'next/server';
import { TeacherAssignmentContractImpl } from '@/platform/education/contracts/teacher-assignment.contract.impl';
import { CourseContractImpl } from '@/platform/education/contracts/course.contract.impl';
import { COURSE_PRIVATE_HEADERS, resolveCourseReadContext, resolveCourseCatalogReadContext, resolveCourseReadMode } from '../request-context';

export const dynamic = 'force-dynamic';
const ROSTER_ENROLLMENT_STATUSES = ['active', 'pending'] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const mode = resolveCourseReadMode(request);
  if (!mode.allowed) return mode.response;
  if (mode.mode === 'catalog') {
    try {
      const context = await resolveCourseCatalogReadContext(request);
      if (!context.allowed) return context.response;
      const { id } = await params;
      if (typeof id !== 'string' || !id.trim() || id.trim() !== id) {
        return NextResponse.json({ success: false, error: 'COURSE_NOT_FOUND' }, { status: 404, headers: COURSE_PRIVATE_HEADERS });
      }
      const course = await new CourseContractImpl(context.supabase).getCourse(context.tenantId, id);
      if (!course || course.id !== id || course.tenantId !== context.tenantId) {
        return NextResponse.json({ success: false, error: 'COURSE_NOT_FOUND' }, { status: 404, headers: COURSE_PRIVATE_HEADERS });
      }
      return NextResponse.json({ success: true, course }, { headers: COURSE_PRIVATE_HEADERS });
    } catch {
      return NextResponse.json({ success: false, error: 'COURSE_CATALOG_UNAVAILABLE' }, {
        status: 503, headers: COURSE_PRIVATE_HEADERS,
      });
    }
  }
  try {
    const context = await resolveCourseReadContext(request);
    if (!context.allowed) return context.response;
    const { supabase, tenantId } = context;
    const { id: courseId } = await params;

    // 1. Fetch Course details
    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('*')
      .eq('course_id', courseId)
      .eq('tenant_id', tenantId)
      .single();

    if (courseErr || !course) {
      return NextResponse.json({ success: false, error: 'Lớp học không tồn tại' }, { status: 404, headers: COURSE_PRIVATE_HEADERS });
    }

    // 2. Fetch Assigned Teachers via Public Contract
    const teacherContract = new TeacherAssignmentContractImpl(supabase);
    const teacherAssignments = await teacherContract.getCourseTeachers(tenantId, courseId);

    const teacherList = [];
    if (teacherAssignments.length > 0) {
      const partyIds = teacherAssignments.map(t => t.teacherPartyId);
      const { data: parties } = await supabase
        .from('party_parties')
        .select('id, display_name')
        .eq('tenant_id', tenantId)
        .in('id', partyIds);

      const partyMap = new Map((parties || []).map(p => [p.id, p.display_name]));

      for (const t of teacherAssignments) {
        teacherList.push({
          assignmentId: t.assignmentId,
          teacherPartyId: t.teacherPartyId,
          name: partyMap.get(t.teacherPartyId) || 'Giáo viên',
          role: t.role,
          roleDisplay: t.role === 'lead_teacher' ? 'Chủ nhiệm' : 'GV Phụ / Bảo mẫu',
          academicYear: t.academicYear,
          status: t.status,
        });
      }
    }

    // 3. Fetch enrolled students from canonical Education enrollments.
    const { data: enrollments, error: enrollmentErr } = await supabase
      .from('edu_enrollments')
      .select('id, student_party_id, status, enrolled_at')
      .eq('course_id', courseId)
      .eq('tenant_id', tenantId)
      .in('status', [...ROSTER_ENROLLMENT_STATUSES]);

    if (enrollmentErr) {
      throw new Error(`Failed to load canonical enrollments: ${enrollmentErr.message}`);
    }

    const studentPartyIds = [...new Set((enrollments || []).map(e => e.student_party_id))];

    const [{ data: students, error: studentsErr }, { data: parties, error: partiesErr }] = studentPartyIds.length > 0
      ? await Promise.all([
        supabase
          .from('students')
          .select('student_id, party_id, student_code, academic_status')
          .eq('tenant_id', tenantId)
          .in('party_id', studentPartyIds),
        supabase
          .from('party_parties')
          .select('id, display_name, gender, dob')
          .eq('tenant_id', tenantId)
          .in('id', studentPartyIds),
      ])
      : [
        { data: [], error: null },
        { data: [], error: null },
      ];

    if (studentsErr) {
      throw new Error(`Failed to load canonical students: ${studentsErr.message}`);
    }
    if (partiesErr) {
      throw new Error(`Failed to load canonical student parties: ${partiesErr.message}`);
    }

    const studentByPartyId = new Map((students || []).map(s => [s.party_id, s]));
    const partyById = new Map((parties || []).map(p => [p.id, p]));

    const studentRoster = (enrollments || []).map(e => {
      const s = studentByPartyId.get(e.student_party_id);
      const p = partyById.get(e.student_party_id);
      if (!s || !p?.display_name) {
        throw new Error(`Canonical roster join failed for student party ${e.student_party_id}`);
      }

      return {
        enrollmentId: e.id,
        studentId: s.student_id,
        studentPartyId: e.student_party_id,
        studentCode: s.student_code,
        name: p.display_name,
        gender: p.gender || 'N/A',
        status: e.status === 'active' ? 'Có mặt' : 'Chưa điểm danh',
        temp: '36.5°C',
      };
    });

    const room = (course.metadata as Record<string, string> | null)?.room || 'Phòng 101 • Tầng 1';

    return NextResponse.json({
      success: true,
      classroom: {
        id: course.course_id,
        code: course.course_code,
        name: course.course_name,
        grade: course.description || 'Khối Mầm (3 tuổi)',
        room,
        maxStudents: course.duration_weeks || 25,
        currentStudents: studentRoster.length,
        teachers: teacherList,
        teacherSummary: teacherList.map(t => `${t.name} (${t.roleDisplay})`).join(' & ') || 'Chưa phân công GVN',
        roster: studentRoster,
      },
    }, { headers: COURSE_PRIVATE_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: COURSE_PRIVATE_HEADERS });
  }
}
