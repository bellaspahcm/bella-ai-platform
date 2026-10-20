import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import type { Database } from '@/types/database.types';

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

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const tenantId = user?.tenant_id || '00000000-0000-0000-0000-000000000001';
    const userId = user?.id || '00000000-0000-0000-0000-000000000003';

    const body = (await request.json()) as {
      title?: string;
      bodyText?: string;
      category?: string;
      priority?: string;
      scope?: string;
    };

    const title = (body?.title || '').trim();
    const bodyText = (body?.bodyText || '').trim();

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'TITLE_REQUIRED', message: 'Tiêu đề thông báo là bắt buộc' },
        { status: 400 }
      );
    }

    if (!bodyText) {
      return NextResponse.json(
        { success: false, error: 'BODY_REQUIRED', message: 'Nội dung thông báo là bắt buộc' },
        { status: 400 }
      );
    }

    const supabase = await getOperationClient();

    // 1. Ensure or create a system broadcast thread for announcements
    const threadId = '00000000-0000-0000-0000-000000000099';
    const { data: existingThread } = await supabase
      .from('edu_comm_threads')
      .select('id')
      .eq('id', threadId)
      .maybeSingle();

    if (!existingThread) {
      await supabase.from('edu_comm_threads').insert({
        id: threadId,
        tenant_id: tenantId,
        student_id: '00000000-0000-0000-0000-000000000000',
        guardian_party_id: '00000000-0000-0000-0000-000000000000',
        created_by: userId,
        title: 'Bảng Thông Báo Toàn Trường',
        thread_type: 'GENERAL',
        status: 'ACTIVE',
      });
    }

    // 2. Insert into `edu_comm_notices`
    const { data: notice, error: insertError } = await supabase
      .from('edu_comm_notices')
      .insert({
        tenant_id: tenantId,
        thread_id: threadId,
        source_domain: 'P6_PARENT_COMMUNICATION',
        source_entity_type: 'BROADCAST_ANNOUNCEMENT',
        source_entity_id: crypto.randomUUID(),
        title,
        body_text: bodyText,
        notice_category: body?.category || 'INFO',
        priority: body?.priority || 'NORMAL',
        requirement_type: 'NOTICE_ONLY',
        created_by: userId,
        is_archived: false,
        metadata: { scope: body?.scope || 'ALL_SCHOOL' },
      })
      .select('id, title, body_text, notice_category, priority, created_at')
      .single();

    if (insertError || !notice) {
      throw new Error(`INSERT_NOTICE_FAILED: ${insertError?.message || 'Không thể tạo thông báo'}`);
    }

    return NextResponse.json({
      success: true,
      data: notice,
      message: 'Đã phát hành thông báo toàn trường thành công',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi phát hành thông báo';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
