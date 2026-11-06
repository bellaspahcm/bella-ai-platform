import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────

type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'stormy';

interface SiteDiaryEntry {
  id: string;
  tenantId: string;
  projectId: string;
  date: string;
  supervisorUserId: string;
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
  supervisorUserId: string;
  workersPresent: number;
  weatherCondition: WeatherCondition;
  activitiesCompleted: string[];
  issuesEncountered?: string[];
  notes?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_SITE_DIARY_ENTRIES: SiteDiaryEntry[] = [
  {
    id: 'sde-001',
    tenantId: 'demo-tenant',
    projectId: 'proj-interior-001',
    date: '2026-11-01',
    supervisorUserId: 'user-supervisor-01',
    workersPresent: 6,
    weatherCondition: 'sunny',
    activitiesCompleted: ['Wardrobe frame installation — master bedroom', 'Electrical conduit routing verified'],
    issuesEncountered: ['Minor paint touch-up needed behind wardrobe panel'],
    notes: 'Client visited site at 14:00. Satisfied with progress.',
    createdAt: '2026-11-01T17:30:00Z',
  },
  {
    id: 'sde-002',
    tenantId: 'demo-tenant',
    projectId: 'proj-interior-001',
    date: '2026-11-03',
    supervisorUserId: 'user-supervisor-01',
    workersPresent: 4,
    weatherCondition: 'cloudy',
    activitiesCompleted: ['Kitchen lower cabinet installation', 'Plinth fitting'],
    issuesEncountered: [],
    notes: 'No issues. On track for handover.',
    createdAt: '2026-11-03T17:00:00Z',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_WEATHER: WeatherCondition[] = ['sunny', 'cloudy', 'rainy', 'stormy'];

function isValidWeather(value: unknown): value is WeatherCondition {
  return typeof value === 'string' && VALID_WEATHER.includes(value as WeatherCondition);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

// ─── GET /api/interior/delivery/site-diary ────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId } = ctx;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'projectId query parameter is required' },
      { status: 400 },
    );
  }

  const entries = MOCK_SITE_DIARY_ENTRIES.filter(
    (e) => e.tenantId === tenantId && e.projectId === projectId,
  );

  return NextResponse.json({ success: true, data: entries });
}

// ─── POST /api/interior/delivery/site-diary ───────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId } = ctx;

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

  const { projectId, date, supervisorUserId, workersPresent, weatherCondition, activitiesCompleted, issuesEncountered, notes } =
    raw as Partial<CreateSiteDiaryBody> & Record<string, unknown>;

  // Required fields
  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });
  }
  if (!date || typeof date !== 'string' || !isValidIsoDate(date)) {
    return NextResponse.json(
      { success: false, error: 'date is required and must be a valid ISO date string (YYYY-MM-DD)' },
      { status: 400 },
    );
  }
  if (!supervisorUserId || typeof supervisorUserId !== 'string') {
    return NextResponse.json({ success: false, error: 'supervisorUserId is required' }, { status: 400 });
  }
  if (workersPresent === undefined || typeof workersPresent !== 'number' || workersPresent < 0) {
    return NextResponse.json(
      { success: false, error: 'workersPresent is required and must be a non-negative number' },
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

  const newEntry: SiteDiaryEntry = {
    id: `sde-${randomUUID()}`,
    tenantId,
    projectId,
    date,
    supervisorUserId,
    workersPresent,
    weatherCondition: raw.weatherCondition as WeatherCondition,
    activitiesCompleted,
    issuesEncountered: isStringArray(issuesEncountered) ? issuesEncountered : [],
    notes: typeof notes === 'string' ? notes : '',
    createdAt: new Date().toISOString(),
  };

  MOCK_SITE_DIARY_ENTRIES.push(newEntry);

  return NextResponse.json({ success: true, data: newEntry }, { status: 201 });
}
