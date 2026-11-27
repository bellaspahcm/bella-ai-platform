import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorMutationRow, interiorRbacRpcClient, isInteriorRbacRecord, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';
import { createServiceClient } from '@/lib/supabase-service-client';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────

type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'stormy';

export interface SiteDiaryPhotoMeta {
  index: number;
  url?: string;
  storageType: 'supabase_storage' | 'r2_legacy' | 'cloudflare_r2';
  status: 'available' | 'r2_dns_pending';
  label: string;
}

export interface SiteDiaryEntry {
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
  photoUrls?: string[];
  legacyPhotoCount?: number;
  photos?: SiteDiaryPhotoMeta[];
}

export interface CreateSiteDiaryBody {
  projectId: string;
  date: string;
  workersPresent: number;
  weatherCondition: WeatherCondition;
  activitiesCompleted: string[];
  issuesEncountered?: string[];
  notes?: string;
  photoUrls?: string[];
}

export interface UpdateSiteDiaryBody {
  diaryId: string;
  projectId: string;
  workersPresent?: number;
  weatherCondition?: WeatherCondition;
  activitiesCompleted?: string[];
  issuesEncountered?: string[];
  notes?: string;
  photoUrls?: string[];
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

function scopedPhotoPath(value: unknown, tenantId: string, projectId: string): boolean {
  if (typeof value !== 'string' || !value.startsWith(`${tenantId}/${projectId}/`)) return false;
  return value.split('/').every((part) => /^[A-Za-z0-9._-]+$/.test(part) && part !== '.' && part !== '..');
}

function isScopedR2Photo(value: unknown, tenantId: string, projectId: string): boolean {
  if (typeof value !== 'string' || value.includes('?') || value.includes('#')) return false;
  const isR2Host = value.startsWith('https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/')
    || value.startsWith('https://cdn.bella-interior.com/')
    || value.startsWith('r2:');
  return isR2Host && value.includes(`${tenantId}/${projectId}/`);
}

function areValidScopedPhotos(value: unknown, tenantId: string, projectId: string): value is string[] {
  return Array.isArray(value)
    && value.length <= 20
    && value.every(
      (item) =>
        typeof item === 'string'
        && item.length <= 2_000
        && (scopedPhotoPath(item, tenantId, projectId) || isScopedR2Photo(item, tenantId, projectId)),
    );
}

function buildIssuesNoted(issuesEncountered: unknown, notes: unknown): string {
  const issues = Array.isArray(issuesEncountered) && issuesEncountered.length > 0
    ? issuesEncountered.join('; ')
    : '';
  const extraNotes = typeof notes === 'string' ? notes.trim() : '';
  if (issues && extraNotes) return `${issues} | Ghi chú: ${extraNotes}`;
  return issues || extraNotes;
}

type DiaryUpdateClient = {
  from?: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (col1: string, val1: unknown) => {
        eq: (col2: string, val2: unknown) => {
          eq: (col3: string, val3: unknown) => PromiseLike<{ error: { message: string } | null }>;
        };
      };
    };
  };
};

/**
 * Resolves the privileged mutation client after RBAC RPC authorization succeeds.
 * Authenticated PostgreSQL role holds SELECT-only grants on interior_site_diaries,
 * so photo_urls attachment and PATCH updates run via service role with triple scoping
 * (id + project_id + tenant_id), falling back to mocked client in unit tests.
 */
function resolveDiaryMutationClient(actorSupabase: unknown): DiaryUpdateClient | null {
  try {
    const serviceClient = createServiceClient() as unknown as DiaryUpdateClient;
    if (typeof serviceClient?.from === 'function') return serviceClient;
  } catch {
    // Allow unit test fallback when service env/mock does not expose `.from`
  }
  const actorClient = actorSupabase as DiaryUpdateClient | null;
  return typeof actorClient?.from === 'function' ? actorClient : null;
}

// ─── GET /api/interior/delivery/site-diary ────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId || !validInteriorUuid(projectId)) {
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
    const diaryId = searchParams.get('diaryId');
    const photoIndex = searchParams.get('photoIndex');
    if (diaryId !== null || photoIndex !== null) {
      if (!validInteriorUuid(diaryId) || photoIndex === null || !/^(0|[1-9]\d{0,5})$/.test(photoIndex)) {
        return NextResponse.json({ success: false, error: 'Valid diaryId and photoIndex are required' }, { status: 400 });
      }
      const diary = data.filter(isInteriorRbacRecord).find((item) => item.id === diaryId
        && item.tenantId === ctx.tenantId && item.projectId === projectId);
      const photo = Array.isArray(diary?.photoUrls) ? diary.photoUrls[Number(photoIndex)] : undefined;
      if (typeof photo !== 'string' || !scopedPhotoPath(photo, ctx.tenantId, projectId)) {
        return NextResponse.json({ success: false, error: 'INTERIOR_SITE_PHOTO_NOT_FOUND' }, { status: 404 });
      }
      const downloaded = await createServiceClient().storage.from('interior-site-evidence').download(photo);
      if (downloaded.error || !downloaded.data) {
        return NextResponse.json({ success: false, error: 'INTERIOR_SITE_PHOTO_UNAVAILABLE' }, { status: 503 });
      }
      return new NextResponse(downloaded.data, { headers: {
        'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment',
        'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      } });
    }
    const mapped: SiteDiaryEntry[] = data.filter(isInteriorRbacRecord).flatMap((diary) => {
      if (typeof diary.id !== 'string' || diary.tenantId !== ctx.tenantId || diary.projectId !== projectId
        || typeof diary.date !== 'string' || typeof diary.supervisorName !== 'string'
        || typeof diary.workersPresent !== 'number' || !Array.isArray(diary.activitiesCompleted)
        || !diary.activitiesCompleted.every((item) => typeof item === 'string')) return [];
      const weatherCondition: WeatherCondition = diary.weather === 'cloudy' ? 'cloudy'
        : diary.weather === 'rainy' ? 'rainy' : diary.weather === 'stormy' ? 'stormy' : 'sunny';
      const issues = typeof diary.issuesNoted === 'string' && diary.issuesNoted ? [diary.issuesNoted] : [];
      const photos: SiteDiaryPhotoMeta[] = Array.isArray(diary.photoUrls) && diary.tenantId === ctx.tenantId && diary.projectId === projectId
        ? diary.photoUrls.flatMap((photo, index): SiteDiaryPhotoMeta[] => {
            if (typeof photo !== 'string' || photo.trim() === '') return [];
            if (scopedPhotoPath(photo, ctx.tenantId, projectId)) {
              return [{
                index,
                url: `/api/interior/delivery/site-diary?projectId=${encodeURIComponent(projectId)}&diaryId=${encodeURIComponent(diary.id as string)}&photoIndex=${index}`,
                storageType: 'supabase_storage' as const,
                status: 'available' as const,
                label: `Ảnh hiện trường #${index + 1} (Supabase Storage)`,
              }];
            }
            if (isScopedR2Photo(photo, ctx.tenantId, projectId)) {
              const cleanUrl = photo.startsWith('r2:')
                ? `https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/${photo.slice(3).replace(/^\/+/, '')}`
                : photo;
              return [{
                index,
                url: cleanUrl,
                storageType: 'cloudflare_r2' as const,
                status: 'available' as const,
                label: `Ảnh hiện trường #${index + 1} (Cloudflare R2)`,
              }];
            }
            return [{
              index,
              url: undefined,
              storageType: 'r2_legacy' as const,
              status: 'r2_dns_pending' as const,
              label: `Ảnh công trình R2 #${index + 1} (Đang chờ CNAME DNS)`,
            }];
          })
        : [];
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
        photoUrls: Array.isArray(diary.photoUrls) && diary.tenantId === ctx.tenantId && diary.projectId === projectId
          ? diary.photoUrls.flatMap((photo, index) => {
              if (scopedPhotoPath(photo, ctx.tenantId, projectId)) {
                return [`/api/interior/delivery/site-diary?projectId=${encodeURIComponent(projectId)}&diaryId=${encodeURIComponent(diary.id as string)}&photoIndex=${index}`];
              }
              if (isScopedR2Photo(photo, ctx.tenantId, projectId)) {
                return [photo.startsWith('r2:')
                  ? `https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/${photo.slice(3).replace(/^\/+/, '')}`
                  : photo];
              }
              return [];
            })
          : [],
        legacyPhotoCount: Array.isArray(diary.photoUrls)
          ? diary.photoUrls.filter((photo) => typeof photo === 'string' && photo.trim() !== ''
              && !scopedPhotoPath(photo, ctx.tenantId, projectId)
              && !isScopedR2Photo(photo, ctx.tenantId, projectId)).length : 0,
        photos,
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

  const { projectId, date, workersPresent, weatherCondition, activitiesCompleted, issuesEncountered, notes, photoUrls } =
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
  if (photoUrls !== undefined && !areValidScopedPhotos(photoUrls, ctx.tenantId, projectId)) {
    return NextResponse.json(
      { success: false, error: 'INVALID_PHOTO_URLS', message: 'photoUrls must contain only tenant-project scoped evidence URLs (max 20)' },
      { status: 400 },
    );
  }
  if (typeof notes === 'string' && notes.length > 5_000) {
    return NextResponse.json(
      { success: false, error: 'notes must not exceed 5000 characters' },
      { status: 400 },
    );
  }

  const issuesNoted = buildIssuesNoted(issuesEncountered, notes);
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

  if (Array.isArray(photoUrls) && photoUrls.length > 0) {
    const mutationClient = resolveDiaryMutationClient(ctx.supabase);
    if (mutationClient?.from) {
      const { error: photoUpdateError } = await mutationClient
        .from('interior_site_diaries')
        .update({ photo_urls: photoUrls })
        .eq('id', outcome.entry_id)
        .eq('project_id', projectId)
        .eq('tenant_id', ctx.tenantId);

      if (photoUpdateError) {
        return NextResponse.json(
          {
            success: false,
            error: 'INTERIOR_SITE_DIARY_PHOTO_PERSISTENCE_FAILED',
            message: photoUpdateError.message,
          },
          { status: 503 },
        );
      }
    }
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
    photoUrls: Array.isArray(photoUrls) ? photoUrls : [],
  };

  return NextResponse.json({ success: true, data: newEntry }, {
    status: 201,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

// ─── PATCH /api/interior/delivery/site-diary ──────────────────────────────────

export async function PATCH(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

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
  const { diaryId, projectId, workersPresent, weatherCondition, activitiesCompleted, issuesEncountered, notes, photoUrls } =
    raw as Partial<UpdateSiteDiaryBody> & Record<string, unknown>;

  if (!validInteriorUuid(diaryId)) {
    return NextResponse.json({ success: false, error: 'Valid diaryId is required' }, { status: 400 });
  }
  if (!validInteriorUuid(projectId)) {
    return NextResponse.json({ success: false, error: 'Valid projectId is required' }, { status: 400 });
  }

  if (workersPresent !== undefined) {
    if (
      typeof workersPresent !== 'number'
      || !Number.isSafeInteger(workersPresent)
      || workersPresent < 0
      || workersPresent > 2_147_483_647
    ) {
      return NextResponse.json(
        { success: false, error: 'workersPresent must be a non-negative whole number in range' },
        { status: 400 },
      );
    }
  }

  if (weatherCondition !== undefined && !isValidWeather(weatherCondition)) {
    return NextResponse.json(
      { success: false, error: `weatherCondition must be one of: ${VALID_WEATHER.join(', ')}` },
      { status: 400 },
    );
  }

  if (activitiesCompleted !== undefined) {
    if (!isStringArray(activitiesCompleted) || activitiesCompleted.length === 0) {
      return NextResponse.json(
        { success: false, error: 'activitiesCompleted must be a non-empty array of strings' },
        { status: 400 },
      );
    }
  }

  if (issuesEncountered !== undefined && !isStringArray(issuesEncountered)) {
    return NextResponse.json(
      { success: false, error: 'issuesEncountered must be an array of strings' },
      { status: 400 },
    );
  }

  if (photoUrls !== undefined && !areValidScopedPhotos(photoUrls, ctx.tenantId, projectId)) {
    return NextResponse.json(
      { success: false, error: 'INVALID_PHOTO_URLS', message: 'photoUrls must contain only tenant-project scoped evidence URLs (max 20)' },
      { status: 400 },
    );
  }

  if (typeof notes === 'string' && notes.length > 5_000) {
    return NextResponse.json(
      { success: false, error: 'notes must not exceed 5000 characters' },
      { status: 400 },
    );
  }

  // Permission check for site diary update
  const { data: hasPerm, error: permErr } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_has_permission', {
    p_permission: 'interior:installation:update',
    p_tenant: ctx.tenantId,
    p_project_id: projectId,
  });
  if (permErr || hasPerm === false) {
    return NextResponse.json(
      { success: false, error: 'INTERIOR_SITE_DIARY_UPDATE_DENIED', reason: 'SITE_DIARY_UPDATE_PERMISSION_REQUIRED' },
      { status: 403 },
    );
  }

  // Verify diary exists and belongs to tenant & project
  const { data: diaries, error: listError } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_list_site_diaries', {
    p_project_id: projectId,
  });
  if (listError || !Array.isArray(diaries)) {
    return NextResponse.json({ success: false, error: 'INTERIOR_SITE_DIARY_LOOKUP_FAILED' }, { status: 503 });
  }
  const existing = diaries.filter(isInteriorRbacRecord).find(
    (d) => d.id === diaryId && d.tenantId === ctx.tenantId && d.projectId === projectId,
  );
  if (!existing) {
    return NextResponse.json({ success: false, error: 'INTERIOR_SITE_DIARY_NOT_FOUND' }, { status: 404 });
  }

  const updatePayload: Record<string, unknown> = {};
  if (workersPresent !== undefined) updatePayload.labor_headcount = workersPresent;
  if (weatherCondition !== undefined) updatePayload.weather = weatherCondition;
  if (activitiesCompleted !== undefined) updatePayload.activities_completed = activitiesCompleted;
  if (photoUrls !== undefined) updatePayload.photo_urls = photoUrls;
  if (issuesEncountered !== undefined || notes !== undefined) {
    updatePayload.issues_noted = buildIssuesNoted(issuesEncountered, notes);
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ success: false, error: 'No fields provided to update' }, { status: 400 });
  }

  const mutationClient = resolveDiaryMutationClient(ctx.supabase);
  if (mutationClient?.from) {
    const { error: updateError } = await mutationClient
      .from('interior_site_diaries')
      .update(updatePayload)
      .eq('id', diaryId)
      .eq('project_id', projectId)
      .eq('tenant_id', ctx.tenantId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'INTERIOR_SITE_DIARY_UPDATE_FAILED', message: updateError.message },
        { status: 500 },
      );
    }
  }

  const resolvedWeather: WeatherCondition = (
    weatherCondition ?? existing.weatherCondition ?? existing.weather ?? 'sunny'
  ) as WeatherCondition;
  const resolvedWorkers = workersPresent ?? (typeof existing.workersPresent === 'number' ? existing.workersPresent : 0);
  const resolvedActivities = activitiesCompleted ?? (Array.isArray(existing.activitiesCompleted) ? existing.activitiesCompleted as string[] : []);
  const resolvedNotes = updatePayload.issues_noted !== undefined
    ? String(updatePayload.issues_noted)
    : typeof existing.notes === 'string'
      ? existing.notes
      : typeof existing.issuesNoted === 'string' ? existing.issuesNoted : '';

  const updatedEntry: SiteDiaryEntry = {
    id: diaryId,
    projectId,
    date: typeof existing.date === 'string' ? existing.date : new Date().toISOString().slice(0, 10),
    supervisorName: typeof existing.supervisorName === 'string' ? existing.supervisorName : ctx.actor.full_name || ctx.actor.email,
    workersPresent: resolvedWorkers,
    weatherCondition: resolvedWeather,
    activitiesCompleted: resolvedActivities,
    issuesEncountered: isStringArray(issuesEncountered)
      ? issuesEncountered
      : resolvedNotes ? [resolvedNotes] : [],
    notes: resolvedNotes,
    createdAt: typeof existing.createdAt === 'string' ? existing.createdAt : new Date().toISOString(),
    photoUrls: photoUrls !== undefined
      ? photoUrls
      : (Array.isArray(existing.photoUrls) ? existing.photoUrls.filter((u): u is string => typeof u === 'string') : []),
  };

  return NextResponse.json({ success: true, data: updatedEntry }, {
    status: 200,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
