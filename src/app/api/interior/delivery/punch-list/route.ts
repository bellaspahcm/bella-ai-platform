import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { QCPunchListItem as DomainPunchItem, PunchListStatus as DomainPunchStatus, DefectCategory, DefectSeverity } from '@/products/bella-interior/domain/delivery-aftercare/types';

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
  const { tenantId } = ctx;

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
    const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    const dbItems = await repo.listPunchListItems(tenantId, projectId);
    let filtered = dbItems.map((i) => ({
        id: i.id,
        tenantId: i.tenantId,
        projectId: i.projectId,
        roomZoneId: i.roomZoneName,
        description: i.description,
        category: 'furniture_fit' as PunchListCategory,
        severity: i.severity as PunchListSeverity,
        status: i.status as PunchListStatus,
        reportedByUserId: i.assignedFixer,
        assignedToUserId: i.assignedFixer,
        photoUrl: i.photoUrl || null,
        createdAt: i.deadline,
        updatedAt: i.verifiedAt || i.deadline,
      }));
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
  const { projectId, description } = raw as Partial<CreatePunchListBody>;

  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });
  }
  if (!description || typeof description !== 'string' || description.trim().length > 4000) {
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
  const now = new Date().toISOString();
  const pliId = randomUUID();
  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
  let roomZoneName = 'Khu vực chính';
  try {
    const project = await repo.getProject(tenantId, projectId);
    if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    if (typeof raw.roomZoneId === 'string') {
      const roomZones = await repo.listRoomZones(tenantId, project.id);
      const roomZone = roomZones.find((zone) => zone.id === raw.roomZoneId);
      if (!roomZone) return NextResponse.json({ success: false, error: 'Room zone not found in project' }, { status: 404 });
      roomZoneName = roomZone.name;
    }
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_QC_PRECONDITION_LOOKUP_FAILED' }, { status: 503 });
  }

  const domainItem: DomainPunchItem = {
    id: pliId,
    tenantId,
    projectId,
    roomZoneName,
    itemName: description.slice(0, 30),
    defectCategory: 'hardware_defect' as DefectCategory,
    description,
    severity: raw.severity as DefectSeverity,
    assignedFixer: 'Chưa phân công',
    deadline: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    status: 'open',
  };

  try {
    await repo.savePunchListItem(tenantId, domainItem);
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_QC_PERSISTENCE_FAILED' }, { status: 503 });
  }

  const newItem: PunchListItem = {
    id: pliId,
    tenantId,
    projectId,
    roomZoneId: typeof raw.roomZoneId === 'string' ? raw.roomZoneId : null,
    description,
    category: raw.category as PunchListCategory,
    severity: raw.severity as PunchListSeverity,
    status: 'open',
    reportedByUserId: actor.id,
    assignedToUserId: null,
    photoUrl: null,
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json({ success: true, data: newItem }, { status: 201 });
}
