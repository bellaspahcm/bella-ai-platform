import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';
import { ParentPortalAccessError, PreschoolParentPortalService } from '@/products/bella-education/parent-portal/services/preschool-parent-portal.service';

export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

type EducationSupabaseClient = SupabaseClient<Database>;

async function getOperationClient(): Promise<EducationSupabaseClient> {
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  if (adminUrl && adminKey) {
    return createSupabaseClient<Database>(adminUrl, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return (await createClient()) as unknown as EducationSupabaseClient;
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

    const claims = PreschoolParentPortalService.verifyPortalToken(token);
    if (claims.scope === 'daily_read_v1') throw new ParentPortalAccessError(403, 'PORTAL_READ_ONLY');
    const supabase = await getOperationClient();
    const service = new PreschoolParentPortalService(supabase);
    await service.authorizePortalToken(token);

    const body = (await request.json()) as { message?: string };
    const message = body?.message;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'MESSAGE_EMPTY', message: 'Nội dung tin nhắn không được để trống' },
        { status: 400, headers: PRIVATE_HEADERS }
      );
    }

    const result = await service.sendChatMessage(token, message);

    return NextResponse.json({
      success: true,
      message: result,
    }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof ParentPortalAccessError ? error.code : 'PORTAL_ACCESS_UNAVAILABLE' },
      { status: error instanceof ParentPortalAccessError ? error.status : 503, headers: PRIVATE_HEADERS }
    );
  }
}
