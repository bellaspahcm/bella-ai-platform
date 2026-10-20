import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';
import { PreschoolParentPortalService } from '@/products/bella-education/parent-portal/services/preschool-parent-portal.service';

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
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') ?? undefined;

    const supabase = await getOperationClient();
    const service = new PreschoolParentPortalService(supabase);
    const payload = await service.getParentPortalPayload(token, date);

    return NextResponse.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi truy cập hồ sơ phụ huynh';
    const isAuthError = message.includes('TOKEN_') || message.includes('GUARDIAN_NOT_AUTHORIZED');

    return NextResponse.json(
      {
        success: false,
        error: message,
        message: isAuthError
          ? 'Liên kết truy cập không hợp lệ hoặc đã hết hạn. Vui lòng liên hệ nhà trường để nhận liên kết mới.'
          : message,
      },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
