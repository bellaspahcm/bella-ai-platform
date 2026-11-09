import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorMutationRow, interiorRbacRpcClient, isInteriorRbacRecord, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────

type PunchListCategory =
  | 'finishing'
  | 'structural'
  | 'furniture_fit'
  | 'electrical_coordination'
  | 'painting';

type PunchListSeverity = 'critical' | 'major' | 'minor';

export type PunchListStatus = 'open' | 'in_progress' | 'rectified' | 'verified';

export interface PunchListItem {
  id: string;
  tenantId: string;
  projectId: string;
  roomZoneId: string | null;
  description: string;
  category: PunchListCategory;
  severity: PunchListSeverity;
  status: PunchListStatus;
  reportedByUserId: string;
  assignedToUserId: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreatePunchListBody {
  projectId: string;
  roomZoneId?: string;
  description: string;
  category: PunchListCategory;
  severity: PunchListSeverity;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_CATEGORIES: PunchListCategory[] = [
  'finishing',
  'structural',
  'furniture_fit',
  'electrical_coordination',
  'painting',
];
const VALID_SEVERITIES: PunchListSeverity[] = ['critical', 'major', 'minor'];

function isValidCategory(v: unknown): v is PunchListCategory {
  return typeof v === 'string' && VALID_CATEGORIES.includes(v as PunchListCategory);
}

function isValidSeverity(v: unknown): v is PunchListSeverity {
  return typeof v === 'string' && VALID_SEVERITIES.includes(v as PunchListSeverity);
}

// ─── GET /api/interior/delivery/punch-list ────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const status = searchParams.get('status') as PunchListStatus | null;

  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'projectId query parameter is required' },
      { status: 400 },
    );
  }

  const validStatuses: PunchListStatus[] = ['open', 'in_progress', 'rectified', 'verified'];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json(
      { success: false, error: `Invalid status. Valid values: ${validStatuses.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_list_qc_items', {
      p_project_id: projectId,
    });
    if (error || !Array.isArray(data)) {
      return NextResponse.json({ success: false, error: 'INTERIOR_QC_READ_FAILED' }, { status: 503 });
    }
    let filtered = data.filter(isInteriorRbacRecord).flatMap((item) => {
      if (typeof item.id !== 'string' || typeof item.tenantId !== 'string' || typeof item.projectId !== 'string'
        || typeof item.description !== 'string' || typeof item.assignedFixer !== 'string'
        || typeof item.createdAt !== 'string') return [];
      const category: PunchListCategory = VALID_CATEGORIES.includes(item.category as PunchListCategory)
        ? item.category as PunchListCategory : 'furniture_fit';
      const severity: PunchListSeverity = VALID_SEVERITIES.includes(item.severity as PunchListSeverity)
        ? item.severity as PunchListSeverity : 'minor';
      const statusValue: PunchListStatus = ['open','in_progress','rectified','verified'].includes(String(item.status))
        ? item.status as PunchListStatus : 'open';
      return [{
        id: item.id,
        tenantId: item.tenantId,
        projectId: item.projectId,
        roomZoneId: typeof item.roomZoneId === 'string' ? item.roomZoneId : null,
        description: item.description,
        category,
        severity,
        status: statusValue,
        reportedByUserId: typeof item.reportedByUserId === 'string' ? item.reportedByUserId : '',
        assignedToUserId: null,
        photoUrl: typeof item.photoUrl === 'string' ? item.photoUrl : null,
        createdAt: item.createdAt,
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : item.createdAt,
      }];
    });
    if (status) {
      filtered = filtered.filter((i) => i.status === status);
    }
    return NextResponse.json({ success: true, data: filtered });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_QC_READ_FAILED' }, { status: 503 });
  }
}

// ─── POST /api/interior/delivery/punch-list ───────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
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
  const { projectId, description } = raw as Partial<CreatePunchListBody>;

  if (!validInteriorUuid(projectId)) {
    return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });
  }
  if (!description || typeof description !== 'string' || !description.trim() || description.trim().length > 4000) {
    return NextResponse.json({ success: false, error: 'description is required' }, { status: 400 });
  }
  if (!isValidCategory(raw.category)) {
    return NextResponse.json(
      { success: false, error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
      { status: 400 },
    );
  }
  if (!isValidSeverity(raw.severity)) {
    return NextResponse.json(
      { success: false, error: `severity must be one of: ${VALID_SEVERITIES.join(', ')}` },
      { status: 400 },
    );
  }
  if (raw.roomZoneId !== undefined && !validInteriorUuid(raw.roomZoneId)) {
    return NextResponse.json({ success: false, error: 'roomZoneId must be a valid UUID' }, { status: 400 });
  }
  const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_create_qc_item', {
    p_project_id: projectId,
    p_room_zone_id: typeof raw.roomZoneId === 'string' ? raw.roomZoneId : null,
    p_description: description.trim(),
    p_category: raw.category,
    p_severity: raw.severity,
  });
  if (error) {
    return NextResponse.json({ success: false, error: 'INTERIOR_QC_PERSISTENCE_FAILED' }, { status: 503 });
  }
  const outcome = interiorMutationRow(data);
  if (!outcome || outcome.status !== 'COMMITTED' || !isInteriorRbacRecord(outcome.item)) {
    const reason = typeof outcome?.reason === 'string' ? outcome.reason : 'QC_ITEM_CREATE_DENIED';
    const status = reason === 'PROJECT_NOT_FOUND' || reason === 'ROOM_ZONE_NOT_FOUND' ? 404
      : reason === 'INVALID_QC_ITEM_INPUT' ? 422 : 403;
    return NextResponse.json({ success: false, error: 'INTERIOR_QC_ITEM_CREATE_DENIED', reason }, { status });
  }
  const item = outcome.item;
  if (typeof item.id !== 'string' || typeof item.tenantId !== 'string' || typeof item.projectId !== 'string'
    || typeof item.createdAt !== 'string') {
    return NextResponse.json({ success: false, error: 'INTERIOR_QC_ITEM_CREATE_FAILED' }, { status: 503 });
  }
  const newItem: PunchListItem = {
    id: item.id,
    tenantId: item.tenantId,
    projectId: item.projectId,
    roomZoneId: typeof item.roomZoneId === 'string' ? item.roomZoneId : null,
    description: typeof item.description === 'string' ? item.description : description.trim(),
    category: raw.category as PunchListCategory,
    severity: raw.severity as PunchListSeverity,
    status: 'open',
    reportedByUserId: typeof item.reportedByUserId === 'string' ? item.reportedByUserId : '',
    assignedToUserId: null,
    photoUrl: null,
    createdAt: item.createdAt,
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : item.createdAt,
  };
  return NextResponse.json({ success: true, data: newItem }, { status: 201 });
}
