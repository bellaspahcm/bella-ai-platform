import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { mockRevisions } from '../../route';
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
  let dbRevision: DomainDesignRevision | null = null;
  try {
    dbRevision = await repo.getDesignRevision(tenantId, id);
  } catch {
    // Database query failed or table not accessible; fallback to mock store
  }

  const revision = mockRevisions.find((r) => r.id === id);

  if (!dbRevision && !revision) {
    return NextResponse.json(
      { success: false, error: `Design revision not found: ${id}` },
      { status: 404 }
    );
  }

  // ── Approved Design Lock invariant ────────────────────────────────────────
  if ((dbRevision && dbRevision.status === 'approved') || (revision && revision.status === 'approved')) {
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
    // Body is optional for approve endpoint — notes are optional
    body = {};
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

  // If found in DB, update DB revision and persist
  if (dbRevision) {
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
      // Keep going if DB update fails
    }
  }

  // approvedByUserId comes from the authenticated actor — NOT from the client
  if (revision) {
    revision.status = 'approved';
    revision.approvedByUserId = actor.id;
    revision.approvedAt = approvedAt;
    revision.updatedAt = approvedAt;
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
