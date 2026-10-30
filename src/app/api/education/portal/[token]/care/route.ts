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
  PortalCareDayRecord,
  PortalCareHealthDetails,
  PortalCareHygieneItem,
  PortalCareMealItem,
  PortalCareNapDetails,
  PortalCareSummary,
} from '@/products/bella-education/parent-portal/domain/parent-portal.types';

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

function getTodayString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatDayLabel(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const dayOfWeek = date.getUTCDay();
    const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const prefix = dayNames[dayOfWeek] ?? 'Ngày';
    const dayFormatted = String(d).padStart(2, '0');
    const monthFormatted = String(m).padStart(2, '0');
    return `${prefix} (${dayFormatted}/${monthFormatted})`;
  } catch {
    return dateStr;
  }
}

function parseMeals(raw: unknown): PortalCareMealItem[] {
  if (!Array.isArray(raw)) return [];
  const meals: PortalCareMealItem[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;

    let mealName = 'Bữa ăn';
    if (typeof r.meal === 'string' && r.meal.trim()) {
      mealName = r.meal.trim();
    } else if (typeof r.mealType === 'string') {
      if (r.mealType === 'BREAKFAST') mealName = 'Bữa sáng';
      else if (r.mealType === 'LUNCH') mealName = 'Bữa trưa';
      else if (r.mealType === 'AFTERNOON_SNACK') mealName = 'Bữa xế';
      else mealName = r.mealType;
    } else if (typeof r.mealName === 'string' && r.mealName.trim()) {
      mealName = r.mealName.trim();
    }

    let foodName: string | null = null;
    if (typeof r.food === 'string' && r.food.trim()) foodName = r.food.trim();
    else if (typeof r.dishName === 'string' && r.dishName.trim()) foodName = r.dishName.trim();

    let portion = 'Hết phần';
    if (typeof r.amount === 'string' && r.amount.trim()) {
      portion = r.amount.trim();
    } else if (typeof r.portion === 'string') {
      if (r.portion === 'ALL') portion = 'Hết 100%';
      else if (r.portion === 'HALF') portion = 'Ăn một nửa (50%)';
      else if (r.portion === 'FEW') portion = 'Ăn ít';
      else if (r.portion === 'NONE') portion = 'Không ăn';
      else portion = r.portion;
    } else if (typeof r.consumedStatus === 'string') {
      portion = r.consumedStatus;
    }

    const note = typeof r.notes === 'string' && r.notes.trim()
      ? r.notes.trim()
      : typeof r.note === 'string' && r.note.trim()
        ? r.note.trim()
        : null;

    meals.push({
      mealName,
      foodName,
      portion,
      note,
      time: typeof r.time === 'string' ? r.time : undefined,
    });
  }

  return meals;
}

function parseNap(raw: unknown): PortalCareNapDetails | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;

  const startTime = typeof r.start_time === 'string' ? r.start_time.trim() : null;
  const endTime = typeof r.end_time === 'string' ? r.end_time.trim() : null;

  let timeRange: string | null = null;
  if (startTime && endTime) {
    timeRange = `${startTime} - ${endTime}`;
  }

  let durationText: string | null = null;
  if (startTime && endTime && startTime.includes(':') && endTime.includes(':')) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const totalMinutes = (eh * 60 + em) - (sh * 60 + sm);
    if (totalMinutes > 0) {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      durationText = mins > 0 ? `${hours} tiếng ${mins} phút` : `${hours} tiếng`;
    }
  }

  let quality = 'Ngủ sâu, không giật mình';
  if (typeof r.quality === 'string' && r.quality.trim()) {
    const q = r.quality.trim();
    if (q === 'DEEP') quality = 'Ngủ sâu, tròn giấc';
    else if (q === 'RESTLESS') quality = 'Chập chờn, khó ngủ';
    else if (q === 'REFUSED') quality = 'Không chịu ngủ';
    else quality = q;
  }

  const note = typeof r.notes === 'string' && r.notes.trim()
    ? r.notes.trim()
    : typeof r.note === 'string' && r.note.trim()
      ? r.note.trim()
      : null;

  return {
    timeRange,
    durationText,
    quality,
    note,
  };
}

function parseHealth(raw: unknown, morningCondition: string | null): PortalCareHealthDetails | null {
  let temperature: number | string | null = null;
  let condition = morningCondition;
  let note: string | null = null;
  let checkedAt: string | null = null;

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    if (typeof r.temperature === 'number' || typeof r.temperature === 'string') {
      temperature = r.temperature;
    }
    if (typeof r.mood === 'string' && r.mood.trim()) {
      condition = condition ? `${condition} · Tâm trạng: ${r.mood.trim()}` : r.mood.trim();
    }
    if (typeof r.notes === 'string' && r.notes.trim()) {
      note = r.notes.trim();
    }
    if (typeof r.checkedAt === 'string') {
      checkedAt = r.checkedAt;
    }
  }

  if (temperature === null && morningCondition) {
    const match = morningCondition.match(/(\d{2}(?:\.\d)?)\s*°?C/i);
    if (match?.[1]) {
      temperature = Number(match[1]);
    }
  }

  if (!temperature && !condition && !note) return null;

  return {
    temperature: temperature ?? 36.6,
    condition: condition ?? 'Bình thường',
    checkedAt,
    note,
  };
}

function parseHygiene(raw: unknown): PortalCareHygieneItem[] {
  if (!Array.isArray(raw)) return [];
  const items: PortalCareHygieneItem[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;

    let type = 'Vệ sinh';
    if (typeof r.type === 'string' && r.type.trim()) {
      if (r.type === 'TOILET') type = 'Đi vệ sinh';
      else if (r.type === 'DIAPER') type = 'Thay tã';
      else if (r.type === 'BOWEL_MOVEMENT') type = 'Tiêu hóa';
      else type = r.type.trim();
    }

    let detail = '';
    if (typeof r.amount === 'string' && r.amount.trim()) {
      detail = r.amount.trim();
    } else if (typeof r.count === 'number') {
      detail = `${r.count} lần`;
    }

    const note = typeof r.notes === 'string' && r.notes.trim() ? r.notes.trim() : null;

    items.push({
      type,
      detail,
      note,
    });
  }

  return items;
}

interface RawCareRecordRow {
  id: string;
  session_id: string;
  student_party_id: string | null;
  student_id: string | null;
  morning_condition: string | null;
  meal_records: unknown;
  nap_records: unknown;
  health_checks: unknown;
  hygiene_records: unknown;
}

interface RawCareSessionRow {
  id: string;
  date: string;
  class_id: string;
}

function buildCareDayRecord(record: RawCareRecordRow, sessionDate: string): PortalCareDayRecord {
  const morningCondition = typeof record.morning_condition === 'string' ? record.morning_condition : null;
  return {
    id: record.id,
    date: sessionDate,
    dayLabel: formatDayLabel(sessionDate),
    morningCondition,
    meals: parseMeals(record.meal_records),
    nap: parseNap(record.nap_records),
    health: parseHealth(record.health_checks, morningCondition),
    hygiene: parseHygiene(record.hygiene_records),
  };
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

    const claims = PreschoolParentPortalService.verifyPortalToken(token);
    const { searchParams } = new URL(request.url);
    const requestedDate = searchParams.get('date');

    const today = getTodayString();
    const selectedDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? requestedDate
      : today;

    const client = await getOperationClient();

    // 1. Fetch active enrollment to get course_id
    const { data: enrollment } = await client
      .from('edu_enrollments')
      .select('id, course_id')
      .eq('tenant_id', claims.tenantId)
      .eq('student_party_id', claims.studentPartyId)
      .eq('status', 'active')
      .maybeSingle();

    // 2. Fetch care records for this student
    const { data: recordRows, error: recordError } = await client
      .from('edu_daily_care_records')
      .select('id, session_id, student_party_id, student_id, morning_condition, meal_records, nap_records, health_checks, hygiene_records')
      .eq('tenant_id', claims.tenantId)
      .or(`student_party_id.eq.${claims.studentPartyId},student_id.eq.${claims.studentPartyId}`);

    if (recordError) {
      return NextResponse.json(
        { success: false, error: 'CARE_DATA_UNAVAILABLE', message: 'Không thể tải nhật ký chăm sóc' },
        { status: 503, headers: PRIVATE_HEADERS }
      );
    }

    const records = (recordRows ?? []) as unknown as RawCareRecordRow[];

    if (records.length === 0) {
      const emptySummary: PortalCareSummary = {
        today,
        selectedDate,
        hasTodayRecord: false,
        currentRecord: null,
        latestRecord: null,
        availableDates: [],
        overviewMealText: 'Chờ cập nhật',
        overviewNapText: 'Chờ cập nhật',
        overviewHealthText: 'Chờ cập nhật',
      };
      return NextResponse.json({ success: true, data: emptySummary }, { headers: PRIVATE_HEADERS });
    }

    // 3. Fetch corresponding sessions to know the exact date for each record
    const sessionIds = [...new Set(records.map((r) => r.session_id))];
    const { data: sessionRows } = await client
      .from('edu_daily_care_sessions')
      .select('id, date, class_id')
      .eq('tenant_id', claims.tenantId)
      .in('id', sessionIds);

    const sessions = (sessionRows ?? []) as RawCareSessionRow[];
    const sessionMap = new Map<string, string>();
    for (const s of sessions) {
      sessionMap.set(s.id, s.date);
    }

    // 4. Pair records with dates
    const dateRecordMap = new Map<string, PortalCareDayRecord>();
    for (const r of records) {
      const sDate = sessionMap.get(r.session_id);
      if (sDate) {
        dateRecordMap.set(sDate, buildCareDayRecord(r, sDate));
      }
    }

    const availableDates = Array.from(dateRecordMap.keys()).sort((a, b) => b.localeCompare(a));
    const latestDate = availableDates[0] ?? null;
    const latestRecord = latestDate ? dateRecordMap.get(latestDate) ?? null : null;

    const hasTodayRecord = dateRecordMap.has(today);
    const currentRecord = dateRecordMap.get(selectedDate) ?? null;

    // Build overview text based on today's record (or latest record if available)
    const activeRef = currentRecord ?? (selectedDate === today ? null : latestRecord);

    let overviewMealText = 'Chờ cập nhật';
    let overviewNapText = 'Chờ cập nhật';
    let overviewHealthText = 'Chờ cập nhật';

    if (activeRef) {
      if (activeRef.meals.length > 0) {
        const lunch = activeRef.meals.find((m) => m.mealName.includes('trưa')) ?? activeRef.meals[0];
        overviewMealText = lunch.portion || 'Ăn hết suất';
      }
      if (activeRef.nap) {
        if (activeRef.nap.durationText) {
          overviewNapText = `${activeRef.nap.durationText} (Ngủ ngon)`;
        } else {
          overviewNapText = activeRef.nap.quality || 'Ngủ ngoan';
        }
      }
      if (activeRef.health?.temperature) {
        overviewHealthText = `${activeRef.health.temperature}°C (Khỏe)`;
      }
    }

    const summary: PortalCareSummary = {
      today,
      selectedDate,
      hasTodayRecord,
      currentRecord,
      latestRecord,
      availableDates,
      overviewMealText,
      overviewNapText,
      overviewHealthText,
    };

    return NextResponse.json({ success: true, data: summary }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof ParentPortalAccessError ? error.code : 'PORTAL_ACCESS_UNAVAILABLE' },
      { status: error instanceof ParentPortalAccessError ? error.status : 503, headers: PRIVATE_HEADERS }
    );
  }
}

