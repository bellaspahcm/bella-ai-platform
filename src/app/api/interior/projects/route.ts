import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

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

interface InteriorProjectSummary {
  id: string;
  name: string;
  code: string;
  status: ProjectStatus;
  clientName: string;
  contractValue: number;
  createdAt: string;
}

interface CreateProjectBody {
  name: string;
  code: string;
  clientPartyId: string;
  description?: string;
  estimatedBudget: number;
}

// ─── Mock In-Memory Store ─────────────────────────────────────────────────────

const mockProjects: InteriorProjectSummary[] = [
  {
    id: 'proj-001',
    name: 'Villa Sunrise Renovation',
    code: 'INT-2024-001',
    status: 'design',
    clientName: 'Ahmad Santoso',
    contractValue: 450_000_000,
    createdAt: '2024-01-15T08:00:00.000Z',
  },
  {
    id: 'proj-002',
    name: 'Office Tower Lobby',
    code: 'INT-2024-002',
    status: 'production',
    clientName: 'PT Maju Bersama',
    contractValue: 1_200_000_000,
    createdAt: '2024-02-20T10:30:00.000Z',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTenantContext(request: NextRequest): { tenantId: string; userId: string } {
  const tenantId = request.headers.get('x-tenant-id') ?? 'demo-tenant';
  const userId = request.headers.get('x-user-id') ?? 'demo-user';
  return { tenantId, userId };
}

function validateProjectStatus(status: string): status is ProjectStatus {
  return [
    'inquiry',
    'design',
    'approved',
    'production',
    'installation',
    'handover',
    'completed',
    'cancelled',
  ].includes(status);
}

// ─── GET /api/interior/projects ───────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { tenantId } = getTenantContext(request);

  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: 'Missing tenant context' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      projects: mockProjects,
      total: mockProjects.length,
    },
  });
}

// ─── POST /api/interior/projects ─────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { tenantId } = getTenantContext(request);

  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: 'Missing tenant context' },
      { status: 401 }
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

  const parsed = body as Partial<CreateProjectBody>;

  if (!parsed.name || typeof parsed.name !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Field "name" is required and must be a string' },
      { status: 422 }
    );
  }
  if (!parsed.code || typeof parsed.code !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Field "code" is required and must be a string' },
      { status: 422 }
    );
  }
  if (!parsed.clientPartyId || typeof parsed.clientPartyId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Field "clientPartyId" is required and must be a string' },
      { status: 422 }
    );
  }
  if (typeof parsed.estimatedBudget !== 'number' || parsed.estimatedBudget < 0) {
    return NextResponse.json(
      { success: false, error: 'Field "estimatedBudget" is required and must be a non-negative number' },
      { status: 422 }
    );
  }

  const newProject: InteriorProjectSummary = {
    id: randomUUID(),
    name: parsed.name,
    code: parsed.code,
    status: 'inquiry',
    clientName: parsed.clientPartyId, // resolved from party in real impl
    contractValue: parsed.estimatedBudget,
    createdAt: new Date().toISOString(),
  };

  mockProjects.push(newProject);

  return NextResponse.json(
    { success: true, data: { project: newProject } },
    { status: 201 }
  );
}
