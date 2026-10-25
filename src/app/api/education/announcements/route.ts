import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';

export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface AnnouncementRow { readonly id: string; readonly title: string; readonly bodyText: string; readonly publishedAt: string; }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isAnnouncementRow(value: unknown): value is AnnouncementRow {
  return isRecord(value) && typeof value.id === 'string' && UUID_PATTERN.test(value.id)
    && typeof value.title === 'string' && value.title.trim().length > 0 && value.title.length <= 200
    && typeof value.bodyText === 'string' && value.bodyText.trim().length > 0 && value.bodyText.length <= 20000
    && typeof value.publishedAt === 'string' && Number.isFinite(Date.parse(value.publishedAt));
}

function respond(status: number, error: string) {
  return NextResponse.json({ success: false, error }, { status, headers: PRIVATE_HEADERS });
}

async function authorizeAdmin(request: Request) {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return { response: respond(401, 'ANNOUNCEMENT_UNAUTHENTICATED') } as const;

    const profile = await getCurrentUser();
    const tenantId = profile?.tenant_id?.trim();
    if (!profile || profile.id !== user.id || !('status' in profile) || profile.status !== 'active'
      || !tenantId || profile.role?.trim().toLowerCase() !== 'admin') {
      return { response: respond(403, 'ANNOUNCEMENT_ACCESS_DENIED') } as const;
    }
    const query = new URL(request.url).searchParams;
    const hasSelectors = ['tenantId', 'tenant_id', 'actorId', 'actor_id', 'userId', 'user_id']
      .some(key => query.has(key));
    if (hasSelectors || request.headers.has('x-tenant-id') || request.headers.has('x-actor-id')) {
      return { response: respond(403, 'ANNOUNCEMENT_CONTEXT_OVERRIDE_DENIED') } as const;
    }

    return { client, tenantId } as const;
  } catch {
    return { response: respond(503, 'ANNOUNCEMENT_ACCESS_UNAVAILABLE') } as const;
  }
}

export async function GET(request: Request) {
  const access = await authorizeAdmin(request);
  if ('response' in access) return access.response;
  try {
    const { data, error } = await access.client.rpc('preschool_list_school_announcements');
    if (error) return respond(error.code === '42501' ? 403 : 503, error.code === '42501' ? 'ANNOUNCEMENT_ACCESS_DENIED' : 'ANNOUNCEMENT_ACCESS_UNAVAILABLE');
    if (!isRecord(data) || data.tenantId !== access.tenantId || !Array.isArray(data.announcements)
      || data.announcements.length > 100 || !data.announcements.every(isAnnouncementRow)) {
      return respond(503, 'ANNOUNCEMENT_ACCESS_UNAVAILABLE');
    }
    return NextResponse.json({ success: true, data: { tenantId: data.tenantId, announcements: data.announcements } }, { headers: PRIVATE_HEADERS });
  } catch {
    return respond(503, 'ANNOUNCEMENT_ACCESS_UNAVAILABLE');
  }
}

export async function POST(request: Request) {
  const access = await authorizeAdmin(request);
  if ('response' in access) return access.response;
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return respond(400, 'ANNOUNCEMENT_INVALID_REQUEST');
    }
    if (!isRecord(body) || Object.keys(body).sort().join(',') !== 'bodyText,requestId,title'
      || typeof body.requestId !== 'string' || !UUID_PATTERN.test(body.requestId)
      || typeof body.title !== 'string' || body.title.trim().length < 1 || body.title.trim().length > 200
      || typeof body.bodyText !== 'string' || body.bodyText.trim().length < 1 || body.bodyText.trim().length > 20000) {
      return respond(400, 'ANNOUNCEMENT_INVALID_REQUEST');
    }
    const { data, error } = await access.client.rpc('preschool_publish_school_announcement', {
      p_request_id: body.requestId,
      p_title: body.title,
      p_body_text: body.bodyText,
    });
    if (error) {
      const status = error.code === '42501' ? 403 : error.code === '22023' ? 400 : error.code === '23505' ? 409 : 503;
      const code = error.code === '42501' ? 'ANNOUNCEMENT_ACCESS_DENIED'
        : error.code === '22023' ? 'ANNOUNCEMENT_INVALID_REQUEST'
          : error.code === '23505' ? 'ANNOUNCEMENT_REQUEST_CONFLICT' : 'ANNOUNCEMENT_PUBLISH_UNAVAILABLE';
      return respond(status, code);
    }
    if (!isRecord(data) || !isAnnouncementRow(data) || typeof data.duplicate !== 'boolean') {
      return respond(503, 'ANNOUNCEMENT_PUBLISH_UNAVAILABLE');
    }
    return NextResponse.json({ success: true, data }, { headers: PRIVATE_HEADERS });
  } catch {
    return respond(503, 'ANNOUNCEMENT_PUBLISH_UNAVAILABLE');
  }
}
