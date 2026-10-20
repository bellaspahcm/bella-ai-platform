/**
 * BELLA EDUCATION — PRESCHOOL AI COPILOT API ROUTE
 *
 * Dedicated endpoint for early childhood teachers and preschool administrators.
 * Handles parent intent classification, health anomaly detection, medicine extraction,
 * allergy checks, daily digests, and pedagogical Q&A.
 *
 * STRICT GOVERNANCE:
 * - ZERO `any` allowed.
 * - Multi-Tenant Isolation (Gate 0 / P0).
 * - Role-Based Access Control via `canUseEducationAiCopilotRole`.
 *
 * @module src/app/api/education/ai/copilot/route
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { canUseEducationAiCopilotRole } from '@/lib/business-rules/permissions';
import {
  executePreschoolCopilot,
  type PreschoolCopilotRequest,
} from '@/products/bella-education/services/preschool-ai.service';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
// Approved Phase4 leadership contract; general Copilot access is broader.
const EXECUTIVE_ROLES = new Set([
  'super_admin', 'campus_admin', 'program_director', 'education_head', 'academic_admin',
]);

interface CopilotRequestBody {
  readonly action?: unknown;
  readonly message?: unknown;
  readonly rawText?: unknown;
  readonly temperatureCelsius?: unknown;
  readonly napMinutes?: unknown;
  readonly mealsFinishedRate?: unknown;
  readonly menuDishes?: unknown;
  readonly childAllergens?: unknown;
  readonly studentName?: unknown;
  readonly attendanceStatus?: unknown;
  readonly mealFeedback?: unknown;
  readonly napFeedback?: unknown;
  readonly activityNotes?: unknown;
  readonly question?: unknown;
  readonly contextData?: unknown;
  readonly geminiApiKey?: unknown;
  // Executive Admin Copilot parameters
  readonly totalStudents?: unknown;
  readonly presentCount?: unknown;
  readonly absentCount?: unknown;
  readonly feverCasesCount?: unknown;
  readonly unpaidTuitionCount?: unknown;
  readonly pendingParentRequests?: unknown;
  readonly classRosterStats?: unknown;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    return typeof msg === 'string' && msg ? msg : 'Internal system error.';
  }
  return 'Internal system error.';
}

export async function POST(request: Request) {
  try {
    // Verify Auth before a profile resolver that also has a development mock path.
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json({ error: 'COPILOT_UNAUTHENTICATED' }, {
        status: 401, headers: PRIVATE_HEADERS,
      });
    }

    const user = await getCurrentUser();
    const tenantId = user?.tenant_id?.trim();
    if (!user || user.id !== authUser.id || !('status' in user) || user.status !== 'active' || !tenantId) {
      return NextResponse.json({ error: 'FORBIDDEN' }, {
        status: 403, headers: PRIVATE_HEADERS,
      });
    }

    const requestedTenants = new URL(request.url).searchParams.getAll('tenantId');
    if (requestedTenants.some(requestedTenant => requestedTenant !== tenantId)) {
      return NextResponse.json({ error: 'TENANT_ISOLATION_VIOLATION' }, {
        status: 403, headers: PRIVATE_HEADERS,
      });
    }

    const effectiveRole = user.role?.trim().toLowerCase() || '';

    // 2. Validate Role Permission
    if (!canUseEducationAiCopilotRole(effectiveRole)) {
      return NextResponse.json(
        {
          error: 'FORBIDDEN',
          message: 'Quyền hạn không hợp lệ. Chỉ có Giáo viên và Ban giám hiệu mới có quyền sử dụng Trợ lý AI Mầm non.',
        },
        { status: 403, headers: PRIVATE_HEADERS }
      );
    }

    // 4. Parse & Validate Payload
    const body = (await request.json().catch(() => ({}))) as CopilotRequestBody;
    const action = typeof body.action === 'string' ? body.action : '';

    const validActions: readonly PreschoolCopilotRequest['action'][] = [
      'classify_intent',
      'extract_care',
      'detect_anomaly',
      'check_allergy',
      'generate_digest',
      'ask_copilot',
      'executive_briefing',
      'executive_safety_audit',
    ];

    if (!validActions.includes(action as PreschoolCopilotRequest['action'])) {
      return NextResponse.json(
        {
          error: 'INVALID_ACTION',
          message: `Hành động AI '${action}' không được hỗ trợ. Các hành động hợp lệ: ${validActions.join(', ')}`,
        },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    if ((action === 'executive_briefing' || action === 'executive_safety_audit') && !EXECUTIVE_ROLES.has(effectiveRole)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, {
        status: 403, headers: PRIVATE_HEADERS,
      });
    }

    const typedRequest: PreschoolCopilotRequest = {
      action: action as PreschoolCopilotRequest['action'],
      message: typeof body.message === 'string' ? body.message : undefined,
      rawText: typeof body.rawText === 'string' ? body.rawText : undefined,
      temperatureCelsius:
        typeof body.temperatureCelsius === 'number' ? body.temperatureCelsius : undefined,
      napMinutes: typeof body.napMinutes === 'number' ? body.napMinutes : undefined,
      mealsFinishedRate:
        typeof body.mealsFinishedRate === 'number' ? body.mealsFinishedRate : undefined,
      menuDishes: Array.isArray(body.menuDishes) ? body.menuDishes.map(String) : undefined,
      childAllergens: Array.isArray(body.childAllergens) ? body.childAllergens.map(String) : undefined,
      studentName: typeof body.studentName === 'string' ? body.studentName : undefined,
      attendanceStatus: typeof body.attendanceStatus === 'string' ? body.attendanceStatus : undefined,
      mealFeedback: typeof body.mealFeedback === 'string' ? body.mealFeedback : undefined,
      napFeedback: typeof body.napFeedback === 'string' ? body.napFeedback : undefined,
      activityNotes: typeof body.activityNotes === 'string' ? body.activityNotes : undefined,
      question: typeof body.question === 'string' ? body.question : undefined,
      contextData:
        typeof body.contextData === 'object' && body.contextData !== null
          ? (body.contextData as Record<string, unknown>)
          : undefined,
      geminiApiKey: typeof body.geminiApiKey === 'string' ? body.geminiApiKey : undefined,
      totalStudents: typeof body.totalStudents === 'number' ? body.totalStudents : undefined,
      presentCount: typeof body.presentCount === 'number' ? body.presentCount : undefined,
      absentCount: typeof body.absentCount === 'number' ? body.absentCount : undefined,
      feverCasesCount: typeof body.feverCasesCount === 'number' ? body.feverCasesCount : undefined,
      unpaidTuitionCount: typeof body.unpaidTuitionCount === 'number' ? body.unpaidTuitionCount : undefined,
      pendingParentRequests: typeof body.pendingParentRequests === 'number' ? body.pendingParentRequests : undefined,
      classRosterStats: Array.isArray(body.classRosterStats)
        ? (body.classRosterStats as readonly import('@/products/bella-education/ai-skills/PreschoolAICapabilityPack').ClassRosterStat[])
        : undefined,
    };

    // 5. Execute Domain AI Logic
    const result = await executePreschoolCopilot(typedRequest);

    return NextResponse.json({
      ...result,
      tenantId,
    }, { headers: PRIVATE_HEADERS });
  } catch (err: unknown) {
    const errorMsg = getErrorMessage(err);
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: errorMsg,
      },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
}
