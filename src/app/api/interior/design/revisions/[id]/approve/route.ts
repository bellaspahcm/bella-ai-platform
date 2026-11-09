import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorMutationRow, interiorRbacRpcClient, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApproveRevisionBody {
  approvalNotes?: string;
}

// ─── POST /api/interior/design/revisions/[id]/approve ────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  if (!validInteriorUuid(id)) {
    return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_REVISION_NOT_FOUND' }, { status: 404 });
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
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: 'Request body must be an object' }, { status: 400 });
  }
  const parsed = body as Partial<ApproveRevisionBody>;
  if (parsed.approvalNotes !== undefined && typeof parsed.approvalNotes !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Field "approvalNotes" must be a string if provided' },
      { status: 422 }
    );
  }
  const approvalNotes = typeof parsed.approvalNotes === 'string' ? parsed.approvalNotes.trim() : null;
  if (approvalNotes !== null && approvalNotes.length > 2000) {
    return NextResponse.json({ success: false, error: 'APPROVAL_NOTES_TOO_LONG' }, { status: 422 });
  }

  const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_approve_design_revision', {
    p_revision_id: id,
    p_approval_notes: approvalNotes,
  });
  if (error) {
    const denied = error.message?.includes('AuthorizationViolation') === true;
    return NextResponse.json({ success: false, error: denied ? 'INTERIOR_PERMISSION_DENIED' : 'INTERIOR_DESIGN_REVISION_APPROVAL_FAILED' }, {
      status: denied ? 403 : 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  const outcome = interiorMutationRow(data);
  if (!outcome || outcome.status !== 'COMMITTED' || typeof outcome.approved_at !== 'string') {
    const reason = typeof outcome?.reason === 'string' ? outcome.reason : 'DESIGN_APPROVAL_DENIED';
    const status = reason === 'REVISION_NOT_FOUND' ? 404
      : reason === 'REVISION_ALREADY_APPROVED' || reason === 'REVISION_STATE_NOT_APPROVABLE' ? 409
        : reason === 'INVALID_APPROVAL_INPUT' ? 422 : 403;
    return NextResponse.json({ success: false, error: 'INTERIOR_DESIGN_APPROVAL_DENIED', reason }, { status });
  }

  return NextResponse.json({
    success: true,
    data: {
      revisionId: id,
      approvedAt: outcome.approved_at,
      lockedForProduction: true as const,
    },
  });
}
