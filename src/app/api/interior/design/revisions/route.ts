import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────

type RevisionStatus = 'draft' | 'review' | 'approved' | 'rejected';

export interface DesignRevision {
  id: string;
  projectId: string;
  revisionName: string;
  revisionNumber: string;
  status: RevisionStatus;
  designedByUserId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateRevisionBody {
  projectId: string;
  revisionName: string;
  revisionNumber: string;
  designedByUserId: string;
}

// ─── Mock In-Memory Store ─────────────────────────────────────────────────────

export const mockRevisions: DesignRevision[] = [
  {
    id: 'rev-001',
    projectId: 'proj-001',
    revisionName: 'Initial Concept',
    revisionNumber: 'R1.0',
    status: 'approved',
    designedByUserId: 'user-designer-01',
    approvedByUserId: 'user-pm-01',
    approvedAt: '2024-02-01T10:00:00.000Z',
    createdAt: '2024-01-20T08:00:00.000Z',
    updatedAt: '2024-02-01T10:00:00.000Z',
  },
  {
    id: 'rev-002',
    projectId: 'proj-001',
    revisionName: 'Client Feedback Round 1',
    revisionNumber: 'R1.1',
    status: 'draft',
    designedByUserId: 'user-designer-01',
    approvedByUserId: null,
    approvedAt: null,
    createdAt: '2024-02-10T09:00:00.000Z',
    updatedAt: '2024-02-10T09:00:00.000Z',
  },
];

// ─── GET /api/interior/design/revisions ──────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId } = ctx;

  void tenantId; // tenantId used for scope; mock store is global for now

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  const filtered = projectId
    ? mockRevisions.filter((r) => r.projectId === projectId)
    : mockRevisions;

  return NextResponse.json({
    success: true,
    data: { revisions: filtered, total: filtered.length },
  });
}

// ─── POST /api/interior/design/revisions ─────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId } = ctx;

  void tenantId; // tenantId used for scope; mock store is global for now

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const parsed = body as Partial<CreateRevisionBody>;

  if (!parsed.projectId || typeof parsed.projectId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Field "projectId" is required and must be a string' },
      { status: 422 }
    );
  }
  if (!parsed.revisionName || typeof parsed.revisionName !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Field "revisionName" is required and must be a string' },
      { status: 422 }
    );
  }
  if (!parsed.revisionNumber || typeof parsed.revisionNumber !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Field "revisionNumber" is required and must be a string' },
      { status: 422 }
    );
  }
  if (!parsed.designedByUserId || typeof parsed.designedByUserId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Field "designedByUserId" is required and must be a string' },
      { status: 422 }
    );
  }

  const now = new Date().toISOString();
  const newRevision: DesignRevision = {
    id: randomUUID(),
    projectId: parsed.projectId,
    revisionName: parsed.revisionName,
    revisionNumber: parsed.revisionNumber,
    status: 'draft',
    designedByUserId: parsed.designedByUserId,
    approvedByUserId: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  mockRevisions.push(newRevision);

  return NextResponse.json(
    { success: true, data: { revision: newRevision } },
    { status: 201 }
  );
}
