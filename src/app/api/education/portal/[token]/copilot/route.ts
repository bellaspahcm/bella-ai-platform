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
import { PreschoolParentPortalService } from '@/products/bella-education/parent-portal/services/preschool-parent-portal.service';
import { executePreschoolCopilot } from '@/products/bella-education/services/preschool-ai.service';
import type { PreschoolCopilotRequest } from '@/products/bella-education/services/preschool-ai.service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'TOKEN_REQUIRED', message: 'Token phụ huynh là bắt buộc' },
        { status: 400 }
      );
    }

    // 1. Verify token — HMAC-SHA256 signature + expiry check
    try {
      PreschoolParentPortalService.verifyPortalToken(token);
    } catch (verifyErr) {
      const msg = verifyErr instanceof Error ? verifyErr.message : 'Token không hợp lệ';
      return NextResponse.json(
        { success: false, error: 'TOKEN_INVALID', message: msg },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body = (await request.json()) as Partial<PreschoolCopilotRequest> & {
      studentName?: string;
    };

    const action = body.action ?? 'ask_copilot';
    const studentName = typeof body.studentName === 'string' ? body.studentName : undefined;

    const copilotRequest: PreschoolCopilotRequest = {
      action: action as PreschoolCopilotRequest['action'],
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xử lý yêu cầu';
    return NextResponse.json(
      { success: false, error: 'COPILOT_ERROR', message },
      { status: 500 }
    );
  }
}
