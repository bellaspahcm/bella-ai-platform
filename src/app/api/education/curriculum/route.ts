import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getCurrentUser } from '@/services/user-actions';
import type { Database } from '@/types/database.types';
import { CurriculumService } from '@/products/bella-education/learning-development/curriculum/curriculum.service';
import type {
  SaveLessonPlanInput,
  SaveCurriculumInput,
  CurriculumAgeGroup,
  CurriculumStatus,
  LessonPlanStatus,
} from '@/products/bella-education/learning-development/curriculum/curriculum.contract';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

function failure(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status, headers: PRIVATE_HEADERS });
}

function createOperationClient(): SupabaseClient<Database> | null {
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;
  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isLessonPlanInput(val: unknown): val is SaveLessonPlanInput {
  if (!val || typeof val !== 'object') return false;
  const p = val as Record<string, unknown>;
  return (
    typeof p.title === 'string' &&
    p.title.trim().length > 0 &&
    typeof p.theme === 'string' &&
    typeof p.subjectDomain === 'string' &&
    typeof p.plannedDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(p.plannedDate)
  );
}

function isCurriculumInput(val: unknown): val is SaveCurriculumInput {
  if (!val || typeof val !== 'object') return false;
  const c = val as Record<string, unknown>;
  return (
    typeof c.code === 'string' &&
    c.code.trim().length > 0 &&
    typeof c.name === 'string' &&
    c.name.trim().length > 0 &&
    Array.isArray(c.subjects)
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return failure('CURRICULUM_UNAUTHENTICATED', 401);

    const profile = await getCurrentUser();
    const tenantId = profile?.tenant_id?.trim();
    if (!profile || profile.id !== user.id || !tenantId) {
      return failure('CURRICULUM_ACCESS_DENIED', 403);
    }

    const opClient = createOperationClient() ?? client;
    const service = new CurriculumService(opClient);

    const { searchParams } = new URL(request.url);
    const queryType = searchParams.get('type') || 'all';
    const weekParam = searchParams.get('weekNumber') || searchParams.get('week');
    const yearParam = searchParams.get('year');
    const courseId = searchParams.get('courseId') || undefined;
    const subjectDomain = searchParams.get('subjectDomain') || undefined;
    const ageGroup = (searchParams.get('ageGroup') as CurriculumAgeGroup) || undefined;
    const status = (searchParams.get('status') as LessonPlanStatus) || undefined;

    const weekNumber = weekParam ? parseInt(weekParam, 10) : undefined;
    const year = yearParam ? parseInt(yearParam, 10) : undefined;

    if (queryType === 'curriculums') {
      const curriculums = await service.listCurriculums(tenantId, {
        ageGroup,
        status: (searchParams.get('curriculumStatus') as CurriculumStatus) || undefined,
      });
      return NextResponse.json({ success: true, curriculums }, { headers: PRIVATE_HEADERS });
    }

    if (queryType === 'lessons') {
      const lessonPlans = await service.listLessonPlans(tenantId, {
        weekNumber,
        year,
        courseId,
        subjectDomain,
        ageGroup,
        status,
      });
      return NextResponse.json({ success: true, lessonPlans }, { headers: PRIVATE_HEADERS });
    }

    // Default: Return both curriculums and lesson plans
    const [curriculums, lessonPlans] = await Promise.all([
      service.listCurriculums(tenantId, { ageGroup }),
      service.listLessonPlans(tenantId, { weekNumber, year, courseId, subjectDomain, ageGroup, status }),
    ]);

    return NextResponse.json({ success: true, curriculums, lessonPlans }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    console.error('[API Curriculum GET Error]:', err);
    return failure('CURRICULUM_FETCH_FAILED', 500);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return failure('CURRICULUM_UNAUTHENTICATED', 401);

    const profile = await getCurrentUser();
    const tenantId = profile?.tenant_id?.trim();
    if (!profile || profile.id !== user.id || !tenantId) {
      return failure('CURRICULUM_ACCESS_DENIED', 403);
    }

    const role = profile.role?.trim().toLowerCase();
    if (role !== 'admin' && role !== 'admin_staff' && role !== 'teacher') {
      return failure('CURRICULUM_ROLE_DENIED', 403);
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') {
      return failure('INVALID_PAYLOAD', 400);
    }

    const payloadObj = body as Record<string, unknown>;
    const opClient = createOperationClient() ?? client;
    const service = new CurriculumService(opClient);

    if (payloadObj.type === 'curriculum') {
      if (!isCurriculumInput(payloadObj.data || payloadObj)) {
        return failure('INVALID_CURRICULUM_PAYLOAD', 400);
      }
      const result = await service.saveCurriculum(tenantId, (payloadObj.data || payloadObj) as SaveCurriculumInput);
      if (!result.success) return failure(result.error || 'SAVE_CURRICULUM_FAILED', 400);
      return NextResponse.json(result, { headers: PRIVATE_HEADERS });
    } else {
      const lessonData = payloadObj.data || payloadObj;
      if (!isLessonPlanInput(lessonData)) {
        return failure('INVALID_LESSON_PLAN_PAYLOAD', 400);
      }
      const result = await service.saveLessonPlan(tenantId, user.id, lessonData);
      if (!result.success) return failure(result.error || 'SAVE_LESSON_PLAN_FAILED', 400);
      return NextResponse.json(result, { headers: PRIVATE_HEADERS });
    }
  } catch (err) {
    console.error('[API Curriculum POST Error]:', err);
    return failure('CURRICULUM_SAVE_FAILED', 500);
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  return POST(request);
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return failure('CURRICULUM_UNAUTHENTICATED', 401);

    const profile = await getCurrentUser();
    const tenantId = profile?.tenant_id?.trim();
    if (!profile || profile.id !== user.id || !tenantId) {
      return failure('CURRICULUM_ACCESS_DENIED', 403);
    }

    const role = profile.role?.trim().toLowerCase();
    if (role !== 'admin' && role !== 'admin_staff' && role !== 'teacher') {
      return failure('CURRICULUM_ROLE_DENIED', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    if (!id) return failure('ID_REQUIRED', 400);

    const opClient = createOperationClient() ?? client;
    const service = new CurriculumService(opClient);

    const result = await service.deleteLessonPlan(tenantId, id);
    if (!result.success) return failure(result.error || 'DELETE_FAILED', 400);

    return NextResponse.json(result, { headers: PRIVATE_HEADERS });
  } catch (err) {
    console.error('[API Curriculum DELETE Error]:', err);
    return failure('CURRICULUM_DELETE_FAILED', 500);
  }
}

