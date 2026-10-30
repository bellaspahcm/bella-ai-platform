import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';
import {
  ParentPortalAccessError,
  PreschoolParentPortalService,
} from '@/products/bella-education/parent-portal/services/preschool-parent-portal.service';
import type {
  PortalAttendanceHistoryItem,
  PortalAttendanceSummary,
} from '@/products/bella-education/parent-portal/domain/parent-portal.types';

export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

type EducationSupabaseClient = SupabaseClient<Database>;

interface RawEnrollmentRow {
  readonly id: string;
}

interface RawAttendanceDailyRow {
  readonly id: string;
  readonly school_day: string;
  readonly status: string;
  readonly updated_at: string | null;
}

interface RawRollCallRow {
  readonly status: string;
  readonly roll_call_time: string;
}

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

function formatDayLabel(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const dayOfWeek = date.getUTCDay();
    const daysVi = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const prefix = daysVi[dayOfWeek] || 'Ngày';
    const dayPadded = String(d).padStart(2, '0');
    const monthPadded = String(m).padStart(2, '0');
    return `${prefix} (${dayPadded}/${monthPadded})`;
  } catch {
    return dateStr;
  }
}

function mapStatus(status: string): { key: 'present' | 'absent' | 'excused' | 'late'; label: string } {
  const s = status.toLowerCase();
  if (s === 'present') return { key: 'present', label: 'Có mặt' };
  if (s === 'absent') return { key: 'absent', label: 'Vắng' };
  if (s === 'excused') return { key: 'excused', label: 'Có phép' };
  if (s === 'late') return { key: 'late', label: 'Đi muộn' };
  return { key: 'present', label: 'Có mặt' };
}

export async function GET(
  _request: Request,
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
    const supabase = await getOperationClient();

    // 1. Get active enrollment for the student
    const { data: enrollmentData, error: enrError } = await supabase
      .from('edu_enrollments')
      .select('id')
      .eq('tenant_id', claims.tenantId)
      .eq('student_party_id', claims.studentPartyId)
      .eq('status', 'active')
      .maybeSingle();

    if (enrError || !enrollmentData) {
      const emptySummary: PortalAttendanceSummary = {
        history: [],
        totalMarked: 0,
        presentCount: 0,
        attendanceRatePercent: null,
      };
      return NextResponse.json({ success: true, data: emptySummary }, { headers: PRIVATE_HEADERS });
    }

    const enrollment = enrollmentData as unknown as RawEnrollmentRow;

    // 2. Query attendance daily state and roll call logs
    const [dailyResult, rollCallResult] = await Promise.all([
      supabase
        .from('edu_attendance_daily_state')
        .select('id, school_day, status, updated_at')
        .eq('tenant_id', claims.tenantId)
        .eq('enrollment_id', enrollment.id)
        .order('school_day', { ascending: false })
        .limit(30),
      supabase
        .from('edu_attendance')
        .select('status, roll_call_time')
        .eq('tenant_id', claims.tenantId)
        .eq('enrollment_id', enrollment.id)
        .order('roll_call_time', { ascending: false })
        .limit(30),
    ]);

    const dailyRows = (dailyResult.data ?? []) as unknown as readonly RawAttendanceDailyRow[];
    const rollCallRows = (rollCallResult.data ?? []) as unknown as readonly RawRollCallRow[];

    // Map time to date
    const timeByDate = new Map<string, string>();
    for (const r of rollCallRows) {
      if (r.roll_call_time) {
        const d = r.roll_call_time.slice(0, 10);
        if (!timeByDate.has(d)) {
          try {
            const timePart = new Date(r.roll_call_time).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Asia/Ho_Chi_Minh',
            });
            timeByDate.set(d, timePart);
          } catch {
            timeByDate.set(d, '07:45');
          }
        }
      }
    }

    const history: PortalAttendanceHistoryItem[] = dailyRows.map((row) => {
      const { key, label } = mapStatus(row.status);
      const time = timeByDate.get(row.school_day) || null;
      return {
        id: row.id,
        schoolDay: row.school_day,
        dayLabel: formatDayLabel(row.school_day),
        status: key,
        statusLabel: label,
        rollCallTime: time,
      };
    });

    const totalMarked = history.length;
    const presentCount = history.filter((h) => h.status === 'present' || h.status === 'late').length;
    const attendanceRatePercent = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : null;

    const summary: PortalAttendanceSummary = {
      history,
      totalMarked,
      presentCount,
      attendanceRatePercent,
    };

    return NextResponse.json({ success: true, data: summary }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof ParentPortalAccessError ? error.code : 'PORTAL_ATTENDANCE_UNAVAILABLE',
      },
      { status: error instanceof ParentPortalAccessError ? error.status : 500, headers: PRIVATE_HEADERS }
    );
  }
}
