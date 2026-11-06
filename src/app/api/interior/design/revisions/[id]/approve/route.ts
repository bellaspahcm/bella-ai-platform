import { NextRequest, NextResponse } from 'next/server';
import { mockRevisions } from '../../route';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApproveRevisionBody {
  approvedByUserId: string;
  approvalNotes?: string;
}

class ApprovedDesignLockViolationError extends Error {
  constructor(revisionId: string) {
    super(
      `Approved Design Lock Violation: Revision "${revisionId}" is already approved and locked for production. Re-approval is not permitted.`
    );
    this.name = 'ApprovedDesignLockViolationError';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTenantContext(request: NextRequest): { tenantId: string; userId: string } {
  const tenantId = request.headers.get('x-tenant-id') ?? 'demo-tenant';
  const userId = request.headers.get('x-user-id') ?? 'demo-user';
  return { tenantId, userId };
}

// ─── POST /api/interior/design/revisions/[id]/approve ────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { tenantId } = getTenantContext(request);

  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: 'Missing tenant context' },
      { status: 401 }
    );
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Revision ID is required' },
      { status: 400 }
    );
  }

  const revision = mockRevisions.find((r) => r.id === id);

  if (!revision) {
    return NextResponse.json(
      { success: false, error: `Design revision not found: ${id}` },
      { status: 404 }
    );
  }

  // ── Approved Design Lock invariant ────────────────────────────────────────
  if (revision.status === 'approved') {
    try {
      throw new ApprovedDesignLockViolationError(id);
    } catch (err) {
      const message = err instanceof ApprovedDesignLockViolationError
        ? err.message
        : 'Revision is already approved.';
      return NextResponse.json(
        { success: false, error: message },
        { status: 409 }
      );
    }
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

  const parsed = body as Partial<ApproveRevisionBody>;

  if (!parsed.approvedByUserId || typeof parsed.approvedByUserId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Field "approvedByUserId" is required and must be a string' },
      { status: 422 }
    );
  }

  if (
    parsed.approvalNotes !== undefined &&
    typeof parsed.approvalNotes !== 'string'
  ) {
    return NextResponse.json(
      { success: false, error: 'Field "approvalNotes" must be a string if provided' },
      { status: 422 }
    );
  }

  const approvedAt = new Date().toISOString();

  // Mutate shared mock store
  revision.status = 'approved';
  revision.approvedByUserId = parsed.approvedByUserId;
  revision.approvedAt = approvedAt;
  revision.updatedAt = approvedAt;

  return NextResponse.json({
    success: true,
    data: {
      revisionId: revision.id,
      approvedAt,
      lockedForProduction: true as const,
    },
  });
}
