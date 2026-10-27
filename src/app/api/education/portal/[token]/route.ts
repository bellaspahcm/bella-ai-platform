import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';
import { ParentPortalAccessError, PreschoolParentPortalService } from '@/products/bella-education/parent-portal/services/preschool-parent-portal.service';
import { isParentPortalAnnouncementFeed, isParentPortalDailyRead, type ParentPortalDailyRead } from '@/products/bella-education/parent-portal/domain/parent-portal.types';

export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

type EducationSupabaseClient = SupabaseClient<Database>;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

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
    const claims = PreschoolParentPortalService.verifyPortalToken(token);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') ?? undefined;

    if (claims.scope === 'daily_read_v1') {
      if (searchParams.size > 0) throw new ParentPortalAccessError(403, 'PORTAL_SELECTOR_FORBIDDEN');
      if (!getSupabaseAdminUrl() || !getSupabaseAdminKey()) throw new ParentPortalAccessError(503, 'PORTAL_ACCESS_UNAVAILABLE');
      const client = await getOperationClient();
      const { data, error } = await client.rpc('preschool_portal_daily_read', {
        p_tenant_id: claims.tenantId, p_course_id: claims.courseId!,
        p_student_party_id: claims.studentPartyId, p_guardian_party_id: claims.guardianPartyId,
      });
      if (error) throw new ParentPortalAccessError(error.code === '42501' ? 401 : 503, error.code === '42501' ? 'GUARDIAN_NOT_AUTHORIZED' : 'PORTAL_ACCESS_UNAVAILABLE');
      const { data: feed, error: feedError } = await client.rpc('preschool_portal_school_announcements_read', {
        p_tenant_id: claims.tenantId,
      });
      if (feedError || !isParentPortalAnnouncementFeed(feed) || feed.tenantId !== claims.tenantId) {
        throw new ParentPortalAccessError(503, 'PORTAL_ACCESS_UNAVAILABLE');
      }
      const dailyRecord = asRecord(data);
      const dailyData = dailyRecord ? { ...dailyRecord, announcements: feed.announcements } : null;
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      if (!isParentPortalDailyRead(dailyData) || dailyData.tenantId !== claims.tenantId || dailyData.courseId !== claims.courseId
        || dailyData.studentPartyId !== claims.studentPartyId || dailyData.guardianPartyId !== claims.guardianPartyId || dailyData.schoolDay !== day) {
        throw new ParentPortalAccessError(503, 'PORTAL_ACCESS_UNAVAILABLE');
      }
      const payload: ParentPortalDailyRead = {
        scope: 'daily_read_v1', tenantId: dailyData.tenantId, courseId: dailyData.courseId, studentPartyId: dailyData.studentPartyId,
        guardianPartyId: dailyData.guardianPartyId, schoolName: dailyData.schoolName, guardianName: dailyData.guardianName,
        childName: dailyData.childName, courseTitle: dailyData.courseTitle, courseCode: dailyData.courseCode, schoolDay: dailyData.schoolDay,
        attendanceStatus: dailyData.attendanceStatus, attendanceUpdatedAt: dailyData.attendanceUpdatedAt,
        totalClassSize: dailyData.totalClassSize, presentTodayCount: dailyData.presentTodayCount,
        announcements: dailyData.announcements, serverTime: dailyData.serverTime,
      };
      return NextResponse.json({ success: true, data: payload }, { headers: PRIVATE_HEADERS });
    }

    if (!getSupabaseAdminUrl() || !getSupabaseAdminKey()) throw new ParentPortalAccessError(503, 'PORTAL_ACCESS_UNAVAILABLE');
    const supabase = await getOperationClient();
    const service = new PreschoolParentPortalService(supabase);
    const payload = await service.getParentPortalPayload(token, date);
    const { data: feed, error: feedError } = await supabase.rpc('preschool_portal_school_announcements_read', {
      p_tenant_id: payload.tenantId,
    });
    if (feedError || !isParentPortalAnnouncementFeed(feed) || feed.tenantId !== payload.tenantId) {
      throw new ParentPortalAccessError(503, 'PORTAL_ACCESS_UNAVAILABLE');
    }

    return NextResponse.json({
      success: true,
      data: { ...payload, announcements: feed.announcements },
    }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof ParentPortalAccessError ? error.code : 'PORTAL_ACCESS_UNAVAILABLE' },
      { status: error instanceof ParentPortalAccessError ? error.status : 503, headers: PRIVATE_HEADERS }
    );
  }
}
