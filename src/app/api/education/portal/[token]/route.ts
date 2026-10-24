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

export async function GET(
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

    // Reject invalid bearer capabilities before constructing the existing server adapter.
    PreschoolParentPortalService.verifyPortalToken(token);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') ?? undefined;

    const supabase = await getOperationClient();
    const service = new PreschoolParentPortalService(supabase);
    const payload = await service.getParentPortalPayload(token, date);

    return NextResponse.json({
      success: true,
      data: payload,
    }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof ParentPortalAccessError ? error.code : 'PORTAL_ACCESS_UNAVAILABLE' },
      { status: error instanceof ParentPortalAccessError ? error.status : 503, headers: PRIVATE_HEADERS }
    );
  }
}
