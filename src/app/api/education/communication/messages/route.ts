import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getCurrentUser } from '@/services/user-actions';
import { ParentCommunicationRepository } from '@/products/bella-education/parent-engagement/repositories/parent-communication.repository';
import type { Database } from '@/types/database.types';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return failure('COMMUNICATION_UNAUTHENTICATED', 401);

    const profile = await getCurrentUser();
    const tenantId = profile?.tenant_id?.trim();
    if (!profile || profile.id !== user.id || !tenantId) {
      return failure('COMMUNICATION_ACCESS_DENIED', 403);
    }

    const role = profile.role?.trim().toLowerCase();
    if (role !== 'admin' && role !== 'admin_staff' && role !== 'teacher') {
      return failure('COMMUNICATION_ROLE_FORBIDDEN', 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure('INVALID_JSON_BODY', 400);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return failure('INVALID_COMMUNICATION_PAYLOAD', 400);
    }

    const payload = body as Record<string, unknown>;
    const threadId = typeof payload.threadId === 'string' ? payload.threadId.trim() : '';
    const messageText = typeof payload.message === 'string' ? payload.message.trim() : '';
    const studentId = typeof payload.studentId === 'string' ? payload.studentId.trim() : '';

    if (!messageText) {
      return failure('MESSAGE_TEXT_REQUIRED', 400);
    }

    const opClient = createOperationClient() ?? client;
    const repo = new ParentCommunicationRepository(opClient as unknown as SupabaseClient);

    // If threadId is provided and valid UUID, use it; otherwise find or create thread
    let effectiveThreadId = threadId;
    if (!effectiveThreadId || !UUID_PATTERN.test(effectiveThreadId)) {
      if (studentId && UUID_PATTERN.test(studentId)) {
        const { data: existingThread } = await opClient
          .from('edu_comm_threads')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('student_id', studentId)
          .maybeSingle();

        if (existingThread?.id) {
          effectiveThreadId = existingThread.id;
        } else {
          const created = await repo.createThread({
            tenant_id: tenantId,
            student_id: studentId,
            guardian_party_id: user.id, // placeholder until guardian relationship resolved
            thread_type: 'GENERAL',
            title: `Trao đổi với phụ huynh`,
            status: 'ACTIVE',
            last_activity_at: new Date().toISOString(),
            created_by: user.id,
          });
          effectiveThreadId = created.id;
        }
      } else {
        return failure('THREAD_OR_STUDENT_REQUIRED', 400);
      }
    }

    const responseRow = await repo.createResponse({
      tenant_id: tenantId,
      thread_id: effectiveThreadId,
      sender_party_id: user.id,
      sender_role: role === 'admin' ? 'SCHOOL_STAFF' : 'TEACHER',
      response_text: messageText,
      attachments: [],
    });

    // Touch thread last activity
    await opClient
      .from('edu_comm_threads')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', effectiveThreadId)
      .eq('tenant_id', tenantId);

    return NextResponse.json({
      success: true,
      data: {
        id: responseRow.id,
        threadId: effectiveThreadId,
        senderRole: responseRow.sender_role,
        text: responseRow.response_text,
        createdAt: responseRow.created_at,
      },
    }, { headers: PRIVATE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'COMMUNICATION_PERSISTENCE_FAILED';
    return failure(message, 503);
  }
}

