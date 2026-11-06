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
    name: 'Villa Ciputra Giai Đoạn 2',
    code: 'INT-CIPUTRA-01',
    status: 'production',
    clientName: 'Nguyễn Văn A',
    clientPartyId: 'party-nguyen-vana-001',
    description: 'Thi công hoàn thiện nội thất biệt thự song lập Ciputra phân khu Q.',
    contractValue: 2_450_000_000,
    estimatedBudget: 2_300_000_000,
    roomZonesCount: 6,
    designRevisionsCount: 2,
    productionOrdersCount: 4,
    createdAt: '2026-03-15T08:00:00.000Z',
    updatedAt: '2026-04-10T14:22:00.000Z',
  },
  'proj-002': {
    id: 'proj-002',
    name: 'Dubai Luxury Villa Fitout',
    code: 'INT-DUBAI-001',
    status: 'installation',
    clientName: 'Sheikh Mansoor',
    clientPartyId: 'party-mansoor-001',
    description: 'Thi công lắp đặt nội thất gỗ óc chó cao cấp cho dinh thự Palm Jumeirah.',
    contractValue: 3_780_000_000,
    estimatedBudget: 3_500_000_000,
    roomZonesCount: 8,
    designRevisionsCount: 3,
    productionOrdersCount: 6,
    createdAt: '2026-04-20T10:30:00.000Z',
    updatedAt: '2026-05-01T09:00:00.000Z',
  },
  'proj-003': {
    id: 'proj-003',
    name: 'Penthouse Metropolis Liễu Giai',
    code: 'INT-METROPOLIS-02',
    status: 'handover',
    clientName: 'Trịnh Thăng Bình',
    clientPartyId: 'party-trinh-binh-001',
    description: 'Nội thất phong cách Modern Luxury cho căn hộ thông tầng Penthouse.',
    contractValue: 2_200_000_000,
    estimatedBudget: 2_050_000_000,
    roomZonesCount: 5,
    designRevisionsCount: 1,
    productionOrdersCount: 3,
    createdAt: '2026-05-05T14:15:00.000Z',
    updatedAt: '2026-06-01T11:00:00.000Z',
  },
  'proj-004': {
    id: 'proj-004',
    name: 'Duplex Aqua Bay Ecopark',
    code: 'INT-ECOPARK-03',
    status: 'design',
    clientName: 'Phạm Hồng Nhung',
    clientPartyId: 'party-pham-nhung-001',
    description: 'Thiết kế concept và phối cảnh 3D căn hộ Duplex view hồ Aqua Bay.',
    contractValue: 850_000_000,
    estimatedBudget: 800_000_000,
    roomZonesCount: 3,
    designRevisionsCount: 1,
    productionOrdersCount: 0,
    createdAt: '2026-06-10T09:00:00.000Z',
    updatedAt: '2026-06-15T16:45:00.000Z',
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
