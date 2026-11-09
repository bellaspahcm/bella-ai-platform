import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DesignRevision as DomainDesignRevision } from '@/products/bella-interior/domain/design-specification/types';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApproveRevisionBody {
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

// ─── POST /api/interior/design/revisions/[id]/approve ────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId, actor } = ctx;

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Revision ID is required' },
      { status: 400 }
    );
  }

  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
  let dbRevision: DomainDesignRevision | null;
  try {
    dbRevision = await repo.getDesignRevision(tenantId, id);
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_REVISION_LOOKUP_FAILED' }, { status: 503 });
  }

  if (!dbRevision) {
    return NextResponse.json(
      { success: false, error: `Design revision not found: ${id}` },
      { status: 404 }
    );
  }

  // ── Approved Design Lock invariant ────────────────────────────────────────
  if (dbRevision.status === 'approved') {
    const err = new ApprovedDesignLockViolationError(id);
    return NextResponse.json({ success: false, error: err.message }, { status: 409 });
  }

  let body: unknown = {};
  const bodyText = await request.text();
  if (bodyText.trim()) {
    try {
      body = JSON.parse(bodyText) as unknown;
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ success: false, error: 'Request body must be an object' }, { status: 400 });
  }

  const parsed = body as Partial<ApproveRevisionBody>;

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

  const updatedRevision: DomainDesignRevision = {
    ...dbRevision,
    status: 'approved',
    approvedBy: actor.id,
    approvedAt,
    changeSummary: parsed.approvalNotes || dbRevision.changeSummary || 'Approved for production',
    clientSignoffDate: approvedAt,
  };
  try {
    await repo.saveDesignRevision(tenantId, updatedRevision);
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_REVISION_PERSISTENCE_FAILED' }, { status: 503 });
  }

  return NextResponse.json({
    success: true,
    data: {
      revisionId: id,
      approvedAt,
      lockedForProduction: true as const,
    },
  });
}
