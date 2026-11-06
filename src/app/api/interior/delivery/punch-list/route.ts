import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────

type PunchListCategory =
  | 'finishing'
  | 'structural'
  | 'furniture_fit'
  | 'electrical_coordination'
  | 'painting';

type PunchListSeverity = 'critical' | 'major' | 'minor';

type PunchListStatus = 'open' | 'in_progress' | 'resolved' | 'verified';

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
  reportedByUserId: string;
  assignedToUserId?: string;
  photoUrl?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

export const MOCK_PUNCH_LIST_ITEMS: PunchListItem[] = [
  {
    id: 'pli-001',
    tenantId: 'demo-tenant',
    projectId: 'proj-interior-001',
    roomZoneId: 'zone-master-bedroom',
    description: 'Wardrobe door alignment off by 3mm — does not close flush',
    category: 'furniture_fit',
    severity: 'major',
    status: 'in_progress',
    reportedByUserId: 'user-supervisor-01',
    assignedToUserId: 'user-carpenter-01',
    photoUrl: null,
    createdAt: '2026-11-02T10:00:00Z',
    updatedAt: '2026-11-03T09:00:00Z',
  },
  {
    id: 'pli-002',
    tenantId: 'demo-tenant',
    projectId: 'proj-interior-001',
    roomZoneId: 'zone-kitchen',
    description: 'Paint bleed on splashback tile grout line',
    category: 'painting',
    severity: 'minor',
    status: 'open',
    reportedByUserId: 'user-supervisor-01',
    assignedToUserId: null,
    photoUrl: null,
    createdAt: '2026-11-03T11:30:00Z',
    updatedAt: '2026-11-03T11:30:00Z',
  },
  {
    id: 'pli-003',
    tenantId: 'demo-tenant',
    projectId: 'proj-interior-001',
    roomZoneId: 'zone-living-room',
    description: 'Feature wall structural crack — requires remediation before cladding',
    category: 'structural',
    severity: 'critical',
    status: 'open',
    reportedByUserId: 'user-supervisor-01',
    assignedToUserId: 'user-structural-01',
    photoUrl: 'https://cdn.example.com/punch/pli-003.jpg',
    createdAt: '2026-11-04T08:00:00Z',
    updatedAt: '2026-11-04T08:00:00Z',
  },
];

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

  const validStatuses: PunchListStatus[] = ['open', 'in_progress', 'resolved', 'verified'];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json(
      { success: false, error: `Invalid status. Valid values: ${validStatuses.join(', ')}` },
      { status: 400 },
    );
  }

  let items = MOCK_PUNCH_LIST_ITEMS.filter(
    (i) => i.tenantId === tenantId && i.projectId === projectId,
  );

  if (status) {
    items = items.filter((i) => i.status === status);
  }

  return NextResponse.json({ success: true, data: items });
}

// ─── POST /api/interior/delivery/punch-list ───────────────────────────────────

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
  const { projectId, description, reportedByUserId } = raw as Partial<CreatePunchListBody>;

  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });
  }
  if (!description || typeof description !== 'string') {
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
  if (!reportedByUserId || typeof reportedByUserId !== 'string') {
    return NextResponse.json({ success: false, error: 'reportedByUserId is required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const newItem: PunchListItem = {
    id: `pli-${randomUUID()}`,
    tenantId,
    projectId,
    roomZoneId: typeof raw.roomZoneId === 'string' ? raw.roomZoneId : null,
    description,
    category: raw.category as PunchListCategory,
    severity: raw.severity as PunchListSeverity,
    status: 'open',
    reportedByUserId,
    assignedToUserId: typeof raw.assignedToUserId === 'string' ? raw.assignedToUserId : null,
    photoUrl: typeof raw.photoUrl === 'string' ? raw.photoUrl : null,
    createdAt: now,
    updatedAt: now,
  };

  MOCK_PUNCH_LIST_ITEMS.push(newItem);

  return NextResponse.json({ success: true, data: newItem }, { status: 201 });
}
