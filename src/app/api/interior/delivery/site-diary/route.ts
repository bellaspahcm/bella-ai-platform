import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorMutationRow, interiorRbacRpcClient, isInteriorRbacRecord, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────

type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'stormy';

interface SiteDiaryEntry {
  id: string;
  projectId: string;
  date: string;
  supervisorName: string;
  workersPresent: number;
  weatherCondition: WeatherCondition;
  activitiesCompleted: string[];
  issuesEncountered: string[];
  notes: string;
  createdAt: string;
}

interface CreateSiteDiaryBody {
  projectId: string;
  date: string;
  workersPresent: number;
  weatherCondition: WeatherCondition;
  activitiesCompleted: string[];
  issuesEncountered?: string[];
  notes?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_WEATHER: WeatherCondition[] = ['sunny', 'cloudy', 'rainy', 'stormy'];

function isValidWeather(value: unknown): value is WeatherCondition {
  return typeof value === 'string' && VALID_WEATHER.includes(value as WeatherCondition);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length <= 50
    && value.every((v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 2_000);
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (Number(value.slice(0, 4)) < 1) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// ─── GET /api/interior/delivery/site-diary ────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'projectId query parameter is required' },
      { status: 400 },
    );
  }

  try {
    const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_list_site_diaries', {
      p_project_id: projectId,
    });
    if (error || !Array.isArray(data)) {
      return NextResponse.json({ success: false, error: 'INTERIOR_SITE_DIARY_READ_FAILED' }, { status: 503 });
    }
    const mapped: SiteDiaryEntry[] = data.filter(isInteriorRbacRecord).flatMap((diary) => {
      if (typeof diary.id !== 'string' || typeof diary.projectId !== 'string'
        || typeof diary.date !== 'string' || typeof diary.supervisorName !== 'string'
        || typeof diary.workersPresent !== 'number' || !Array.isArray(diary.activitiesCompleted)
        || !diary.activitiesCompleted.every((item) => typeof item === 'string')) return [];
      const weatherCondition: WeatherCondition = diary.weather === 'cloudy' ? 'cloudy'
        : diary.weather === 'rainy' ? 'rainy' : diary.weather === 'stormy' ? 'stormy' : 'sunny';
      const issues = typeof diary.issuesNoted === 'string' && diary.issuesNoted ? [diary.issuesNoted] : [];
      return [{
        id: diary.id,
        projectId: diary.projectId,
        date: diary.date,
        supervisorName: diary.supervisorName,
        workersPresent: diary.workersPresent,
        weatherCondition,
        activitiesCompleted: diary.activitiesCompleted,
        issuesEncountered: issues,
        notes: typeof diary.issuesNoted === 'string' ? diary.issuesNoted : '',
        createdAt: typeof diary.createdAt === 'string' ? diary.createdAt : diary.date,
      }];
    });
    return NextResponse.json({ success: true, data: mapped }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_SITE_DIARY_READ_FAILED' }, { status: 503 });
  }
}

// ─── POST /api/interior/delivery/site-diary ───────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { actor } = ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ success: false, error: 'Request body must be an object' }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  const { projectId, date, workersPresent, weatherCondition, activitiesCompleted, issuesEncountered, notes } =
    raw as Partial<CreateSiteDiaryBody> & Record<string, unknown>;

  // Required fields
  if (!validInteriorUuid(projectId)) {
    return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });
  }
  if (!date || typeof date !== 'string' || !isValidIsoDate(date)) {
    return NextResponse.json(
      { success: false, error: 'date is required and must be a valid ISO date string (YYYY-MM-DD)' },
      { status: 400 },
    );
  }
  if (
    workersPresent === undefined
    || typeof workersPresent !== 'number'
    || !Number.isSafeInteger(workersPresent)
    || workersPresent < 0
    || workersPresent > 2_147_483_647
  ) {
    return NextResponse.json(
      { success: false, error: 'workersPresent is required and must be a non-negative whole number in range' },
      { status: 400 },
    );
  }
  if (!isValidWeather(raw.weatherCondition)) {
    return NextResponse.json(
      { success: false, error: `weatherCondition must be one of: ${VALID_WEATHER.join(', ')}` },
      { status: 400 },
    );
  }
  if (!isStringArray(activitiesCompleted) || activitiesCompleted.length === 0) {
    return NextResponse.json(
      { success: false, error: 'activitiesCompleted must be a non-empty array of strings' },
      { status: 400 },
    );
  }

  if (issuesEncountered !== undefined && !isStringArray(issuesEncountered)) {
    return NextResponse.json(
      { success: false, error: 'issuesEncountered must be an array of strings' },
      { status: 400 },
    );
  }
  if (typeof notes === 'string' && notes.length > 5_000) {
    return NextResponse.json(
      { success: false, error: 'notes must not exceed 5000 characters' },
      { status: 400 },
    );
  }

  const issuesNoted = Array.isArray(issuesEncountered) && issuesEncountered.length > 0
    ? issuesEncountered.join('; ')
    : typeof notes === 'string' ? notes : '';
  const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_create_site_diary', {
    p_project_id: projectId,
    p_entry_date: date,
    p_labor_headcount: workersPresent,
    p_weather: raw.weatherCondition,
    p_activities_completed: activitiesCompleted,
    p_issues_noted: issuesNoted,
  });
  if (error) {
    return NextResponse.json({ success: false, error: 'INTERIOR_SITE_DIARY_PERSISTENCE_FAILED' }, { status: 503 });
  }
  const outcome = interiorMutationRow(data);
  if (!outcome || outcome.status !== 'COMMITTED' || typeof outcome.entry_id !== 'string') {
    const reason = typeof outcome?.reason === 'string' ? outcome.reason : 'SITE_DIARY_CREATE_DENIED';
    const status = reason === 'PROJECT_NOT_FOUND' ? 404 : reason === 'INVALID_SITE_DIARY_INPUT' ? 422 : 403;
    return NextResponse.json({ success: false, error: 'INTERIOR_SITE_DIARY_CREATE_DENIED', reason }, { status });
  }

  const now = new Date().toISOString();
  const newEntry: SiteDiaryEntry = {
    id: outcome.entry_id,
    projectId,
    date,
    supervisorName: actor.full_name || actor.email,
    workersPresent,
    weatherCondition: raw.weatherCondition as WeatherCondition,
    activitiesCompleted,
    issuesEncountered: isStringArray(issuesEncountered) ? issuesEncountered : [],
    notes: issuesNoted,
    createdAt: now,
  };

  return NextResponse.json({ success: true, data: newEntry }, {
    status: 201,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
