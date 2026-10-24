/**
 * Bella Preschool OS — Smart Care Copilot API Route
 * File: src/app/api/education/portal/[token]/copilot/route.ts
 *
 * Accepts guardian questions via POST and routes them through
 * the PII-shielded preschool AI copilot.
 *
 * Security: Token HMAC-SHA256 signature and expiry verified before any AI processing.
 * ZERO `any` types.
 */

import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { ParentPortalAccessError, PreschoolParentPortalService } from '@/products/bella-education/parent-portal/services/preschool-parent-portal.service';
import { executePreschoolCopilot } from '@/products/bella-education/services/preschool-ai.service';
import type { PreschoolCopilotRequest } from '@/products/bella-education/services/preschool-ai.service';

export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

async function getOperationClient(): Promise<SupabaseClient> {
  const url = getSupabaseAdminUrl();
  const key = getSupabaseAdminKey();
  // This is the existing signed-token capability adapter, not a retry after a user-RLS denial.
  return url && key ? createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) : await createClient();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'TOKEN_REQUIRED', message: 'Token phụ huynh là bắt buộc' },
        { status: 401, headers: PRIVATE_HEADERS }
      );
    }

    PreschoolParentPortalService.verifyPortalToken(token);
    const service = new PreschoolParentPortalService(await getOperationClient());
    await service.authorizePortalToken(token);

    // 2. Parse and validate request body
    const body = (await request.json()) as Partial<PreschoolCopilotRequest> & {
      studentName?: string;
    };

    const action = body.action ?? 'ask_copilot';
    if (action !== 'ask_copilot') {
      return NextResponse.json({ success: false, error: 'PORTAL_ACTION_FORBIDDEN' }, {
        status: 403, headers: PRIVATE_HEADERS,
      });
    }
    const studentName = typeof body.studentName === 'string' ? body.studentName : undefined;

    const copilotRequest: PreschoolCopilotRequest = {
      action: 'ask_copilot',
      question: typeof body.question === 'string' ? body.question : undefined,
      message: typeof body.message === 'string' ? body.message : undefined,
      studentName,
      geminiApiKey: process.env.GEMINI_API_KEY,
    };

    // 3. Execute copilot with PII shield
    const result = await executePreschoolCopilot(copilotRequest);

    return NextResponse.json({
      success: result.success,
      action: result.action,
      data: result.data,
      piiMasked: result.piiMasked,
      timestamp: result.timestamp,
    }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof ParentPortalAccessError ? error.code : 'PORTAL_ACCESS_UNAVAILABLE' },
      { status: error instanceof ParentPortalAccessError ? error.status : 503, headers: PRIVATE_HEADERS }
    );
  }
}
