import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────

type ProjectStatus =
  | 'inquiry'
  | 'design'
  | 'approved'
  | 'production'
  | 'installation'
  | 'handover'
  | 'completed'
  | 'cancelled';

interface InteriorProjectDetail {
  id: string;
  name: string;
  code: string;
  status: ProjectStatus;
  clientName: string;
  clientPartyId: string;
  description: string;
  contractValue: number;
  estimatedBudget: number;
  roomZonesCount: number;
  designRevisionsCount: number;
  productionOrdersCount: number;
  createdAt: string;
  updatedAt: string;
}

interface PatchProjectBody {
  status?: string;
  name?: string;
}

// ─── Mock In-Memory Store (shared ref across module) ─────────────────────────

const mockProjectDetails: Record<string, InteriorProjectDetail> = {
  'proj-001': {
    id: 'proj-001',
    name: 'Villa Sunrise Renovation',
    code: 'INT-2024-001',
    status: 'design',
    clientName: 'Ahmad Santoso',
    clientPartyId: 'party-ahmad-001',
    description: 'Full interior renovation of 2-storey villa in Bali.',
    contractValue: 450_000_000,
    estimatedBudget: 420_000_000,
    roomZonesCount: 8,
    designRevisionsCount: 3,
    productionOrdersCount: 1,
    createdAt: '2024-01-15T08:00:00.000Z',
    updatedAt: '2024-03-10T14:22:00.000Z',
  },
  'proj-002': {
    id: 'proj-002',
    name: 'Office Tower Lobby',
    code: 'INT-2024-002',
    status: 'production',
    clientName: 'PT Maju Bersama',
    clientPartyId: 'party-maju-001',
    description: 'Modern minimalist lobby design for a 20-storey office tower.',
    contractValue: 1_200_000_000,
    estimatedBudget: 1_100_000_000,
    roomZonesCount: 4,
    designRevisionsCount: 5,
    productionOrdersCount: 7,
    createdAt: '2024-02-20T10:30:00.000Z',
    updatedAt: '2024-04-01T09:00:00.000Z',
  },
};

const VALID_STATUSES: ProjectStatus[] = [
  'inquiry',
  'design',
  'approved',
  'production',
  'installation',
  'handover',
  'completed',
  'cancelled',
];

function isValidStatus(value: string): value is ProjectStatus {
  return (VALID_STATUSES as string[]).includes(value);
}

// ─── GET /api/interior/projects/[id] ─────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId } = ctx;

  void tenantId; // tenantId used for scope; mock store is global for now

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Project ID is required' },
      { status: 400 }
    );
  }

  const project = mockProjectDetails[id];

  if (!project) {
    return NextResponse.json(
      { success: false, error: `Project not found: ${id}` },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: { project } });
}

// ─── PATCH /api/interior/projects/[id] ───────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId } = ctx;

  void tenantId; // tenantId used for scope; mock store is global for now

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Project ID is required' },
      { status: 400 }
    );
  }

  const project = mockProjectDetails[id];

  if (!project) {
    return NextResponse.json(
      { success: false, error: `Project not found: ${id}` },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const patch = body as Partial<PatchProjectBody>;

  if (patch.status !== undefined) {
    if (typeof patch.status !== 'string' || !isValidStatus(patch.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status value. Must be one of: ${VALID_STATUSES.join(', ')}`,
        },
        { status: 422 }
      );
    }
    project.status = patch.status;
  }

  if (patch.name !== undefined) {
    if (typeof patch.name !== 'string' || patch.name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Field "name" must be a non-empty string' },
        { status: 422 }
      );
    }
    project.name = patch.name.trim();
  }

  project.updatedAt = new Date().toISOString();

  return NextResponse.json({ success: true, data: { project } });
}
