import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

type ProductionStage =
  | 'design_locked'
  | 'cutting_cnc'
  | 'edge_banding'
  | 'assembly'
  | 'workshop_qc'
  | 'packing'
  | 'dispatched';

interface OrderItem {
  description: string;
  quantity: number;
  unit: string;
  estimatedHours: number;
}

interface ProductionOrder {
  id: string;
  tenantId: string;
  projectId: string;
  designRevisionId: string;
  description: string;
  items: OrderItem[];
  stage: ProductionStage;
  createdAt: string;
  updatedAt: string;
}

interface CreateProductionOrderBody {
  projectId: string;
  designRevisionId: string;
  description: string;
  items: OrderItem[];
}

interface MockDesignRevision {
  id: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_DESIGN_REVISIONS: MockDesignRevision[] = [
  { id: 'rev-approved-001', status: 'approved' },
  { id: 'rev-approved-002', status: 'approved' },
  { id: 'rev-draft-001', status: 'draft' },
  { id: 'rev-pending-001', status: 'pending_review' },
];

const MOCK_PRODUCTION_ORDERS: ProductionOrder[] = [
  {
    id: 'po-001',
    tenantId: 'demo-tenant',
    projectId: 'proj-interior-001',
    designRevisionId: 'rev-approved-001',
    description: 'Master bedroom custom wardrobe production run',
    stage: 'assembly',
    items: [
      { description: 'Wardrobe panel 2400x600', quantity: 8, unit: 'pcs', estimatedHours: 4 },
      { description: 'Sliding door track system', quantity: 2, unit: 'set', estimatedHours: 2 },
    ],
    createdAt: '2026-10-15T09:00:00Z',
    updatedAt: '2026-10-20T14:30:00Z',
  },
  {
    id: 'po-002',
    tenantId: 'demo-tenant',
    projectId: 'proj-interior-001',
    designRevisionId: 'rev-approved-002',
    description: 'Kitchen cabinet set — lower units',
    stage: 'workshop_qc',
    items: [
      { description: 'Base cabinet 600x720', quantity: 6, unit: 'pcs', estimatedHours: 3 },
      { description: 'Drawer runner hardware', quantity: 12, unit: 'pairs', estimatedHours: 1 },
    ],
    createdAt: '2026-10-18T10:00:00Z',
    updatedAt: '2026-10-25T16:00:00Z',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findDesignRevision(revisionId: string): MockDesignRevision | undefined {
  return MOCK_DESIGN_REVISIONS.find((r) => r.id === revisionId);
}

function validateOrderItems(items: unknown): items is OrderItem[] {
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).description === 'string' &&
      typeof (item as Record<string, unknown>).quantity === 'number' &&
      typeof (item as Record<string, unknown>).unit === 'string' &&
      typeof (item as Record<string, unknown>).estimatedHours === 'number',
  );
}

// ─── GET /api/interior/production/orders ─────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const tenantId = request.headers.get('x-tenant-id') ?? 'demo-tenant';
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const stage = searchParams.get('stage') as ProductionStage | null;

  const validStages: ProductionStage[] = [
    'design_locked',
    'cutting_cnc',
    'edge_banding',
    'assembly',
    'workshop_qc',
    'packing',
    'dispatched',
  ];

  if (stage && !validStages.includes(stage)) {
    return NextResponse.json(
      { success: false, error: `Invalid stage. Valid values: ${validStages.join(', ')}` },
      { status: 400 },
    );
  }

  let orders = MOCK_PRODUCTION_ORDERS.filter((o) => o.tenantId === tenantId);

  if (projectId) {
    orders = orders.filter((o) => o.projectId === projectId);
  }

  if (stage) {
    orders = orders.filter((o) => o.stage === stage);
  }

  return NextResponse.json({ success: true, data: orders });
}

// ─── POST /api/interior/production/orders ────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const tenantId = request.headers.get('x-tenant-id') ?? 'demo-tenant';

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ success: false, error: 'Request body must be an object' }, { status: 400 });
  }

  const { projectId, designRevisionId, description, items } = body as Record<string, unknown>;

  // Required field validation
  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });
  }
  if (!designRevisionId || typeof designRevisionId !== 'string') {
    return NextResponse.json({ success: false, error: 'designRevisionId is required' }, { status: 400 });
  }
  if (!description || typeof description !== 'string') {
    return NextResponse.json({ success: false, error: 'description is required' }, { status: 400 });
  }
  if (!validateOrderItems(items)) {
    return NextResponse.json(
      {
        success: false,
        error:
          'items must be a non-empty array of { description: string, quantity: number, unit: string, estimatedHours: number }',
      },
      { status: 400 },
    );
  }

  // Approved Design Lock validation
  const revision = findDesignRevision(designRevisionId);
  if (!revision || revision.status !== 'approved') {
    return NextResponse.json(
      {
        success: false,
        error:
          'Production orders can only be created from approved design revisions (Approved Design Lock)',
      },
      { status: 422 },
    );
  }

  const now = new Date().toISOString();
  const newOrder: ProductionOrder = {
    id: `po-${randomUUID()}`,
    tenantId,
    projectId,
    designRevisionId,
    description,
    items,
    stage: 'design_locked',
    createdAt: now,
    updatedAt: now,
  };

  // In production this would persist to DB
  MOCK_PRODUCTION_ORDERS.push(newOrder);

  return NextResponse.json({ success: true, data: newOrder }, { status: 201 });
}
