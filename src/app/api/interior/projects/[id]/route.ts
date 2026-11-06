import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

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

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Project ID is required' },
      { status: 400 }
    );
  }

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    const dbProject = await repo.getProject(tenantId, id);
    if (dbProject) {
      const roomZones = await repo.listRoomZones(tenantId, id);
      const revisions = await repo.listDesignRevisions(tenantId, id);
      const detail: InteriorProjectDetail = {
        id: dbProject.id,
        name: dbProject.name,
        code: dbProject.code,
        status: dbProject.status === 'contracted' ? 'approved' : dbProject.status === 'in_production' ? 'production' : dbProject.status === 'installing' ? 'installation' : dbProject.status === 'handover' ? 'handover' : dbProject.status === 'completed' ? 'completed' : 'design',
        clientName: dbProject.customerName || dbProject.customerId,
        clientPartyId: dbProject.customerId,
        description: dbProject.siteAddress || 'Interior Fitout Project',
        contractValue: dbProject.estimatedBudget,
        estimatedBudget: dbProject.estimatedBudget,
        roomZonesCount: roomZones.length,
        designRevisionsCount: revisions.length,
        productionOrdersCount: 0,
        createdAt: dbProject.createdAt,
        updatedAt: dbProject.updatedAt,
      };
      return NextResponse.json({ success: true, data: { project: detail } });
    }
  } catch {
    // Database query failed; fall back to mock store
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

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Project ID is required' },
      { status: 400 }
    );
  }

  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
  let dbProject: Awaited<ReturnType<typeof repo.getProject>> = null;
  try {
    dbProject = await repo.getProject(tenantId, id);
  } catch {
    // Database query failed; fall back to mock store
  }

  const project = mockProjectDetails[id];

  if (!dbProject && !project) {
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
    if (project) project.status = patch.status;
  }

  if (patch.name !== undefined) {
    if (typeof patch.name !== 'string' || patch.name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Field "name" must be a non-empty string' },
        { status: 422 }
      );
    }
    if (project) project.name = patch.name.trim();
  }

  const now = new Date().toISOString();
  if (project) {
    project.updatedAt = now;
  }

  if (dbProject) {
    const updatedDbProject = {
      ...dbProject,
      name: patch.name?.trim() || dbProject.name,
      updatedAt: now,
    };
    try {
      await repo.saveProject(tenantId, updatedDbProject);
    } catch {
      // Ignore if DB update fails
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      project: project || {
        id: dbProject!.id,
        name: patch.name?.trim() || dbProject!.name,
        code: dbProject!.code,
        status: dbProject!.status,
        clientName: dbProject!.customerName || dbProject!.customerId,
        clientPartyId: dbProject!.customerId,
        description: dbProject!.siteAddress || '',
        contractValue: dbProject!.estimatedBudget,
        estimatedBudget: dbProject!.estimatedBudget,
        roomZonesCount: 0,
        designRevisionsCount: 0,
        productionOrdersCount: 0,
        createdAt: dbProject!.createdAt,
        updatedAt: now,
      },
    },
  });
}
