import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SiteDiaryEntry as DomainSiteDiaryEntry } from '@/products/bella-interior/domain/delivery-aftercare/types';

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

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    const dbDiaries = await repo.listSiteDiaries(tenantId, projectId);
    const mapped: SiteDiaryEntry[] = dbDiaries.map((d) => ({
      id: d.id,
      tenantId: d.tenantId,
      projectId: d.projectId,
      date: d.date,
      supervisorUserId: d.supervisorName,
      workersPresent: d.laborHeadcount,
      weatherCondition: (d.weather === 'cloudy' ? 'cloudy' : d.weather === 'rainy' ? 'rainy' : d.weather === 'stormy' ? 'stormy' : 'sunny') as WeatherCondition,
      activitiesCompleted: d.activitiesCompleted,
      issuesEncountered: d.issuesNoted ? [d.issuesNoted] : [],
      notes: d.issuesNoted || '',
      createdAt: d.date,
    }));
    return NextResponse.json({ success: true, data: mapped });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_SITE_DIARY_READ_FAILED' }, { status: 503 });
  }
}

// ─── POST /api/interior/delivery/site-diary ───────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId, actor } = ctx;

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
  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });
  }
  if (!date || typeof date !== 'string' || !isValidIsoDate(date)) {
    return NextResponse.json(
      { success: false, error: 'date is required and must be a valid ISO date string (YYYY-MM-DD)' },
      { status: 400 },
    );
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

  const entryId = randomUUID();
  const now = new Date().toISOString();

  const domainEntry: DomainSiteDiaryEntry = {
    id: entryId,
    tenantId,
    projectId,
    date,
    weather: raw.weatherCondition as string,
    laborHeadcount: workersPresent,
    activitiesCompleted,
    materialDelivered: [],
    issuesNoted: Array.isArray(issuesEncountered) && issuesEncountered.length > 0 ? issuesEncountered.join('; ') : typeof notes === 'string' ? notes : undefined,
    supervisorName: actor.full_name || actor.email,
    photoUrls: [],
  };

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    const project = await repo.getProject(tenantId, projectId);
    if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    await repo.saveSiteDiary(tenantId, domainEntry);
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_SITE_DIARY_PERSISTENCE_FAILED' }, { status: 503 });
  }

  const newEntry: SiteDiaryEntry = {
    id: entryId,
    tenantId,
    projectId,
    date,
    supervisorUserId: actor.id,
    workersPresent,
    weatherCondition: raw.weatherCondition as WeatherCondition,
    activitiesCompleted,
    issuesEncountered: isStringArray(issuesEncountered) ? issuesEncountered : [],
    notes: typeof notes === 'string' ? notes : '',
    createdAt: now,
  };

  return NextResponse.json({ success: true, data: newEntry }, { status: 201 });
}
