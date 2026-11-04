import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocalDateString } from '@bella/shared';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { CourseContractImpl } from '@/platform/education/contracts/course.contract.impl';
import {
  CanonicalCourseCatalogContractImpl,
  CanonicalCourseCommandContractImpl,
} from '@/platform/education/contracts/canonical-course-catalog.contract.impl';
import { CanonicalCourseCommandError } from '@/platform/education/contracts/canonical-course-catalog.contract';
import { PreschoolTeacherContractError } from '@/platform/education/contracts/teacher-assignment.contract';
import { PreschoolRegistryContractImpl } from '@/platform/education/contracts/preschool-registry.contract.impl';
import { PreschoolRegistryError } from '@/platform/education/contracts/preschool-registry.contract';
import { PreschoolTeacherContractImpl } from '@/platform/education/contracts/preschool-teacher.contract.impl';
import { CourseCatalogProductService, PreschoolClassroomCommandProductService } from '@/products/bella-education/services/course-catalog.service';
import { PreschoolChainService, PreschoolChainError } from '@/products/bella-education/services/preschool-chain.service';
import { PreschoolTeacherProductService } from '@/products/bella-education/services/preschool-teacher.service';
import type {
  PreschoolCanonicalTeacherAssignment,
  PreschoolTeacherContext,
} from '@/platform/education/contracts/teacher-assignment.contract';
import type { Database } from '@/types/database.types';
import {
  COURSE_PRIVATE_HEADERS,
  resolveCourseCatalogReadContext,
  resolveCourseReadContext,
  resolveCourseReadMode,
} from './request-context';
import { CANONICAL_COURSE_HEADERS, canonicalCourseFailure, resolveCanonicalCourseContext } from './canonical-request-context';

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
const PAGE_SIZE = 50;

async function readBranchRoster(
  registry: PreschoolRegistryContractImpl,
  tenantId: string,
  courseId: string,
  branchId: string,
): Promise<{ studentCount: number; attendanceEnrollmentIds: string[] }> {
  const attendanceEnrollmentIds = new Set<string>();
  const studentIds = new Set<string>();
  const seenOffsets = new Set<number>();
  let offset = 0;
  let studentCount: number | null = null;

  while (true) {
    if (seenOffsets.has(offset)) throw new Error('PRESCHOOL_REGISTRY_PAGINATION_DID_NOT_ADVANCE');
    seenOffsets.add(offset);
    const page = await registry.read(tenantId, {
      status: 'all', courseId, branchId, offset, limit: PAGE_SIZE,
    });
    if (studentCount === null) studentCount = page.filteredTotal;
    else if (studentCount !== page.filteredTotal) throw new Error('PRESCHOOL_REGISTRY_SNAPSHOT_CHANGED');

    for (const student of page.students) {
      if (student.tenantId !== tenantId) throw new Error('PRESCHOOL_REGISTRY_TENANT_MISMATCH');
      if (studentIds.has(student.id)) throw new Error('PRESCHOOL_REGISTRY_DUPLICATE_STUDENT');
      studentIds.add(student.id);
      for (const enrollment of student.enrollments) {
        if (enrollment.courseId !== courseId || enrollment.branchId !== branchId
          || !ROSTER_ENROLLMENT_STATUSES.includes(enrollment.status)) {
          throw new Error('PRESCHOOL_REGISTRY_SCOPE_MISMATCH');
        }
        if (enrollment.status === 'active') attendanceEnrollmentIds.add(enrollment.id);
      }
    }

    if (page.nextOffset === null) {
      if (studentIds.size !== studentCount) throw new Error('PRESCHOOL_REGISTRY_SNAPSHOT_CHANGED');
      return { studentCount, attendanceEnrollmentIds: [...attendanceEnrollmentIds] };
    }
    if (page.nextOffset <= offset) throw new Error('PRESCHOOL_REGISTRY_PAGINATION_DID_NOT_ADVANCE');
    offset = page.nextOffset;
  }
}

async function readEffectiveCourseTeachers(
  service: PreschoolTeacherProductService,
  context: PreschoolTeacherContext,
  courseId: string,
  onDate: string,
): Promise<PreschoolCanonicalTeacherAssignment[]> {
  const assignments = new Map<string, PreschoolCanonicalTeacherAssignment>();
  const seenOffsets = new Set<number>();
  let offset = 0;
  let total: number | null = null;

  while (true) {
    if (seenOffsets.has(offset)) throw new Error('PRESCHOOL_TEACHER_PAGINATION_DID_NOT_ADVANCE');
    seenOffsets.add(offset);
    const page = await service.listCourseTeachers(context, courseId, onDate, offset, PAGE_SIZE);
    if (total === null) total = page.total;
    else if (total !== page.total) throw new Error('PRESCHOOL_TEACHER_SNAPSHOT_CHANGED');
    for (const assignment of page.assignments) {
      if (assignment.tenantId !== context.tenantId || assignment.branchId !== context.branchId
        || assignment.courseId !== courseId) throw new Error('PRESCHOOL_TEACHER_SCOPE_MISMATCH');
      if (assignments.has(assignment.assignmentId)) throw new Error('PRESCHOOL_TEACHER_DUPLICATE_ASSIGNMENT');
      assignments.set(assignment.assignmentId, assignment);
    }
    if (page.nextOffset === null) break;
    if (page.nextOffset <= offset) throw new Error('PRESCHOOL_TEACHER_PAGINATION_DID_NOT_ADVANCE');
    offset = page.nextOffset;
  }

  return [...assignments.values()].filter(assignment => assignment.effectiveOnDate
    && assignment.eligibility === 'confirmed' && assignment.teacherName !== null);
}

export interface ClassroomOverviewItem {
  id: string;
  tenantId: string;
  branchId: string;
  code: string;
  name: string;
  grade: string;
  gradeKey: 'mam' | 'choi' | 'la' | 'nursery';
  room: string;
  teacher: string;
  teacherCount: number | null;
  leadTeacher?: string;
  assistantTeacher?: string;
  teacherPartyId?: string;
  students: number;
  maxStudents: number | null;
  academicYear: string;
  focus: string;
  status: 'active' | 'inactive' | 'archived';
  todayStatus: {
    present: number;
    absent: number;
    excused: number;
    unmarked: number;
    healthAlerts: number;
  };
}

function createAdminOperationClient(): EducationCoursesClient | null {
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;

  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function readMetadataString(metadata: CourseProjectionRow['metadata'], key: string): string {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') return '';
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

export async function GET(request: Request) {
  const mode = resolveCourseReadMode(request);
  if (!mode.allowed) return mode.response;
  if (mode.mode === 'catalog') {
    try {
      const context = await resolveCourseCatalogReadContext(request);
      if (!context.allowed) return context.response;
      const catalog = new CourseCatalogProductService(new CourseContractImpl(context.supabase));
      const courses = await catalog.getCourses(context.tenantId);
      return NextResponse.json({ success: true, courses }, { headers: COURSE_PRIVATE_HEADERS });
    } catch {
      return NextResponse.json({ success: false, error: 'COURSE_CATALOG_UNAVAILABLE' }, {
        status: 503,
        headers: COURSE_PRIVATE_HEADERS,
      });
    }
  }
  try {
    const context = await resolveCourseReadContext(request);
    if (!context.allowed) return context.response;
    const { tenantId, actor: currentUser } = context;

    const { searchParams } = new URL(request.url);
    const explicitTenantId = searchParams.get('tenantId');
    if (explicitTenantId !== null && explicitTenantId !== tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant access denied' }, { status: 403, headers: COURSE_PRIVATE_HEADERS });
    }

    const admissionBranchId = searchParams.get('admissionBranchId');
    const role = currentUser.role.toLowerCase();
    // The canonical Preschool Registry/Teacher contracts currently authorize
    // active tenant admins only. A legacy staff label is not teacher proof.
    if (role !== 'admin') {
      return NextResponse.json({success:false,error:'PRESCHOOL_CHAIN_ACTOR_DENIED'},{status:403,headers:COURSE_PRIVATE_HEADERS});
    }
    const supabase = createAdminOperationClient() ?? context.supabase;
    const branchScope = new PreschoolChainService(supabase);
    if (admissionBranchId!==null) await branchScope.assertBranchAccess(tenantId,currentUser.id,admissionBranchId);
    const courseAssignments = admissionBranchId!==null ? [] : await branchScope.listCourseAssignments(tenantId,currentUser.id,searchParams.get('branchId') ?? undefined);
    const enrollmentAssignments = admissionBranchId !== null || role === 'admin'
      ? []
      : await branchScope.listEnrollmentAssignments(tenantId, currentUser.id, searchParams.get('branchId') ?? undefined);
    const targetDate = searchParams.get('date') || getLocalDateString(new Date()) || '2026-10-18';

    // 1. Fetch canonical Education courses used by enrollment runtime.
    const { data: dbCourses, error: courseErr } = await supabase
      .from('edu_courses')
      .select('id, course_code, title, status, max_students, current_enrollment, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (courseErr) {
      return NextResponse.json({ success: false, error: courseErr.message }, { status: 500, headers: COURSE_PRIVATE_HEADERS });
    }

    if (admissionBranchId!==null) {
      const mappings = await supabase.from('preschool_chain_course_branch_assignments').select('course_id,branch_id').eq('tenant_id',tenantId);
      if (mappings.error) throw new Error(mappings.error.message);
      return NextResponse.json({success:true,classrooms:(dbCourses ?? []).filter((course)=>{
        const mapping = mappings.data?.find((row)=>row.course_id===course.id);
        return course.status==='active' && (!mapping || mapping.branch_id===admissionBranchId);
      }).map((course)=>({id:course.id,name:course.title}))},{ headers: COURSE_PRIVATE_HEADERS });
    }

    const canonicalCourses = ((dbCourses || []) as EduCourseRow[]).filter((course)=>courseAssignments.some((row)=>row.course_id===course.id));
    const courseIds = canonicalCourses.map(course => course.id);
    const { data: courseProjections, error: projectionErr } = courseIds.length > 0
      ? await supabase.from('courses')
        .select('course_id, course_code, course_name, description, duration_weeks, metadata, status')
        .eq('tenant_id', tenantId)
        .in('course_id', courseIds)
      : { data: [] as CourseProjectionRow[], error: null };
    // Legacy display metadata is optional; canonical class/roster identities do
    // not depend on an environment having the old Training projection schema.
    if (projectionErr && !['42703', '42P01', 'PGRST204', 'PGRST205'].includes(projectionErr.code)) {
      throw new Error(projectionErr.message);
    }
    const projectionByCourseId = new Map(
      ((projectionErr ? [] : courseProjections || []) as CourseProjectionRow[])
        .map(projection => [projection.course_id, projection]),
    );

    // 2. Map courses to ClassroomOverviewItem
    const classrooms: ClassroomOverviewItem[] = [];
    const registry = role === 'admin' ? new PreschoolRegistryContractImpl(context.supabase) : null;
    const teacherService = role === 'admin'
      ? new PreschoolTeacherProductService(
        new PreschoolTeacherContractImpl(supabase),
        branchScope,
        new CanonicalCourseCatalogContractImpl(context.supabase),
      )
      : null;

    for (const course of canonicalCourses) {
      const projection = projectionByCourseId.get(course.id);
      const courseBranch = courseAssignments.find(row => row.course_id === course.id);
      if (!courseBranch || !courseBranch.branch_id) throw new Error('PRESCHOOL_CHAIN_COURSE_BRANCH_UNAVAILABLE');
      // Reuse only the canonical, branch-confirmed Preschool assignment flow.
      // Other roles have no approved canonical teacher-read contract yet.
      let teacherReadUnavailable = role !== 'admin' || course.status !== 'active';
      let teacherAssignments: PreschoolCanonicalTeacherAssignment[] = [];
      if (role === 'admin' && course.status === 'active' && teacherService) {
        try {
          teacherAssignments = await readEffectiveCourseTeachers(teacherService, {
            tenantId, actorId: currentUser.id, branchId: courseBranch.branch_id,
          }, course.id, targetDate);
        } catch (error) {
          if (!(error instanceof PreschoolTeacherContractError)
            || !['PRESCHOOL_TEACHER_UNAVAILABLE', 'PRESCHOOL_TEACHER_ACCESS_DENIED'].includes(error.code)) throw error;
          // Teacher proof is optional to rendering the independently authorized class roster.
          // Never fall back to legacy, unconfirmed assignments when the canonical read is unavailable.
          teacherReadUnavailable = true;
        }
      }
      
      let teacherNames = teacherReadUnavailable ? 'Chưa xác minh' : 'Chưa phân công GVN';
      let leadTeacherName = '';
      let assistantTeacherName = '';
      let leadTeacherPartyId: string | undefined = undefined;

      if (teacherAssignments.length > 0) {
        const lead = teacherAssignments.find(t => t.role === 'lead_teacher');
        const assistant = teacherAssignments.find(t => t.role !== 'lead_teacher');
        if (lead) {
          leadTeacherPartyId = lead.teacherPartyId;
          leadTeacherName = lead.teacherName || '';
        }
        if (assistant) {
          assistantTeacherName = assistant.teacherName || '';
        }

        const sortedAssignments = [...teacherAssignments].sort((a, b) => {
          if (a.role === 'lead_teacher') return -1;
          if (b.role === 'lead_teacher') return 1;
          return 0;
        });

        teacherNames = sortedAssignments
          .map(t => `${t.teacherName || 'Giáo viên'} (${t.role === 'lead_teacher' ? 'Chủ nhiệm' : 'GV Phụ'})`)
          .join(' • ');
      }

      let currentStudents = 0;
      let attendanceEnrollmentIds: string[] = [];
      if (role === 'admin' && course.status === 'active' && registry) {
        // The registry derives class membership from canonical Enrollment -> Course -> Branch.
        // It intentionally does not depend on the optional enrollment-branch receipt table.
        const roster = await readBranchRoster(registry, tenantId, course.id, courseBranch.branch_id);
        currentStudents = roster.studentCount;
        attendanceEnrollmentIds = roster.attendanceEnrollmentIds;
      } else {
        const scopedEnrollmentIds = enrollmentAssignments
          .filter((row)=>row.courseId===course.id && row.branchId===courseBranch.branch_id)
          .map((row)=>row.enrollmentId);
        const { count, error: countError } = await supabase
          .from('edu_enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('course_id', course.id)
          .eq('tenant_id', tenantId)
          .in('id', scopedEnrollmentIds)
          .in('status', [...ROSTER_ENROLLMENT_STATUSES]);
        if (countError) throw new Error(countError.message);
        currentStudents = count ?? 0;
        const { data: scopedRows, error: enrollmentReadError } = await supabase
          .from('edu_enrollments')
          .select('id,status')
          .eq('course_id', course.id)
          .eq('tenant_id', tenantId)
          .in('id', scopedEnrollmentIds)
          .in('status', [...ROSTER_ENROLLMENT_STATUSES]);
        if (enrollmentReadError) throw new Error(enrollmentReadError.message);
        attendanceEnrollmentIds = (scopedRows || [])
          .filter(row => row.status === 'active')
          .map(row => row.id);
      }
      // Grade key mapping from course_code or course_name
      let gradeKey: 'mam' | 'choi' | 'la' | 'nursery' = 'mam';
      const codeUpper = (course.course_code || '').toUpperCase();
      const title = course.title;
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

      const maxCap = course.max_students;
      const today = targetDate;
      const { data: todayStates, error: attendanceReadError } = attendanceEnrollmentIds.length > 0
        // Attendance must be evaluated by the authenticated user's RLS policies.
        // Keep the privileged client out of this read so role/branch rules remain authoritative.
        ? await context.supabase
          .from('edu_attendance_daily_state')
          .select('enrollment_id, status')
          .eq('tenant_id', tenantId)
          .eq('school_day', today)
          .in('enrollment_id', attendanceEnrollmentIds)
        : { data: [], error: null };
      if (attendanceReadError) throw new Error(attendanceReadError.message);

      // Deduplicate state per enrollment to prevent duplicate row counts
      const stateMap = new Map<string, string>();
      let fallbackIdx = 0;
      for (const state of (todayStates || []) as { enrollment_id?: string; status: string }[]) {
        const key = state.enrollment_id || `idx-${fallbackIdx++}`;
        if (!stateMap.has(key)) {
          stateMap.set(key, state.status);
        }
      }

      let presentCount = 0;
      let absentCount  = 0;
      let excusedCount = 0;
      for (const statusVal of stateMap.values()) {
        if (statusVal === 'present') presentCount++;
        else if (statusVal === 'absent') absentCount++;
        else if (statusVal === 'excused') excusedCount++;
      }
      const markedCount = stateMap.size;
      const unmarkedCount = Math.max(0, attendanceEnrollmentIds.length - markedCount);

      classrooms.push({
        id: course.id,
        tenantId,
        branchId: courseBranch.branch_id,
        code: course.course_code,
        name: title,
        grade: readMetadataString(projection?.metadata ?? null, 'grade') || projection?.description || defaultGradeLabel,
        gradeKey,
        room: readMetadataString(projection?.metadata ?? null, 'room') || 'Chưa ghi nhận phòng',
        teacher: teacherNames,
        teacherCount: teacherReadUnavailable ? null : new Set(teacherAssignments.map(item => item.teacherPartyId)).size,
        leadTeacher: leadTeacherName,
        assistantTeacher: assistantTeacherName,
        teacherPartyId: leadTeacherPartyId,
        students: currentStudents,
        maxStudents: maxCap,
        academicYear: readMetadataString(projection?.metadata ?? null, 'academicYear') || '2026 - 2027',
        focus: readMetadataString(projection?.metadata ?? null, 'focus') || projection?.description || 'Phát triển Kỹ năng & Vận động',
        status: course.status === 'active' ? 'active' : course.status === 'archived' ? 'archived' : 'inactive',
        todayStatus: {
          present: presentCount,
          absent: absentCount,
          excused: excusedCount,
          unmarked: unmarkedCount,
          healthAlerts: 0,
        },
      });
    }

    return NextResponse.json({ success: true, classrooms });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = err instanceof PreschoolChainError || err instanceof PreschoolRegistryError
      || err instanceof PreschoolTeacherContractError ? err.status : 500;
    const error = err instanceof PreschoolRegistryError || err instanceof PreschoolTeacherContractError
      ? err.code : message;
    return NextResponse.json({ success: false, error }, { status, headers: COURSE_PRIVATE_HEADERS });
  }
}

async function readCanonicalCreateBody(request: Request): Promise<unknown> {
  if (!request.body || request.body.locked || request.bodyUsed) throw new SyntaxError('INVALID_BODY');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 8_192) throw new SyntaxError('BODY_TOO_LARGE');
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } catch {
    await reader.cancel().catch(() => undefined);
    throw new SyntaxError('INVALID_BODY');
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const context = await resolveCanonicalCourseContext(request);
  if (!context.allowed) return context.response;

  try {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return canonicalCourseFailure('CANONICAL_COURSE_INVALID_REQUEST', 400);
    }
    const body = await readCanonicalCreateBody(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return canonicalCourseFailure('CANONICAL_COURSE_INVALID_REQUEST', 400);
    }
    const fields = body as Record<string, unknown>;
    const allowed = ['operationKey', 'branchId', 'code', 'title'];
    if (Object.keys(fields).length !== allowed.length || Object.keys(fields).some(key => !allowed.includes(key))
      || allowed.some(key => typeof fields[key] !== 'string')) {
      return canonicalCourseFailure('CANONICAL_COURSE_INVALID_REQUEST', 400);
    }
    const { operationKey, branchId, code, title } = fields as Record<typeof allowed[number], string>;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(operationKey) || !uuid.test(branchId) || !code.trim() || code.length > 80
      || !title.trim() || title.length > 200) {
      return canonicalCourseFailure('CANONICAL_COURSE_INVALID_REQUEST', 400);
    }

    const writer = createAdminOperationClient();
    if (!writer) return canonicalCourseFailure('CANONICAL_COURSE_UNAVAILABLE', 503);
    const service = new PreschoolClassroomCommandProductService(new CanonicalCourseCommandContractImpl(writer));
    const course = await service.createCourse({
      tenantId: context.tenantId,
      actorId: context.actor.id,
      operationKey,
      branchId,
      courseCode: code,
      title,
    });
    return NextResponse.json({ success: true, course }, { status: 201, headers: CANONICAL_COURSE_HEADERS });
  } catch (error) {
    if (error instanceof SyntaxError) return canonicalCourseFailure('CANONICAL_COURSE_INVALID_REQUEST', 400);
    if (error instanceof CanonicalCourseCommandError) {
      return canonicalCourseFailure(error.code, error.status);
    }
    return canonicalCourseFailure('CANONICAL_COURSE_UNAVAILABLE', 503);
  }
}
