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

    const body = (await request.json()) as { message?: string };
    const message = body?.message;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'MESSAGE_EMPTY', message: 'Nội dung tin nhắn không được để trống' },
        { status: 400 }
      );
    }

    const supabase = await getOperationClient();
    const service = new PreschoolParentPortalService(supabase);
    const result = await service.sendChatMessage(token, message);

    return NextResponse.json({
      success: true,
      message: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi gửi tin nhắn';
    const isAuthError = message.includes('TOKEN_') || message.includes('GUARDIAN_NOT_AUTHORIZED');

    return NextResponse.json(
      {
        success: false,
        error: message,
        message: isAuthError ? 'Phiên truy cập không hợp lệ. Vui lòng tải lại trang.' : message,
      },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
