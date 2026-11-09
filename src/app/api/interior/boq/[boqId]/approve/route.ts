import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorMutationRow, interiorRbacRpcClient, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ boqId: string }> },
): Promise<NextResponse> {
  const resolved = await resolveInteriorContext(request);
  if (!resolved.ok) return resolved.response;
  const { boqId } = await context.params;
  if (!validInteriorUuid(boqId)) {
    return NextResponse.json({ success: false, error: 'INTERIOR_BOQ_NOT_FOUND' }, { status: 404 });
  }

  const { data, error } = await interiorRbacRpcClient(resolved.supabase).rpc('interior_approve_boq', {
    p_boq_id: boqId,
  });
  if (error) {
    const denied = error.message?.includes('AuthorizationViolation') === true;
    return NextResponse.json({ success: false, error: denied ? 'INTERIOR_PERMISSION_DENIED' : 'INTERIOR_BOQ_APPROVAL_FAILED' }, {
      status: denied ? 403 : 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const outcome = interiorMutationRow(data);
  if (!outcome || outcome.status !== 'COMMITTED') {
    const reason = typeof outcome?.reason === 'string' ? outcome.reason : 'BOQ_APPROVAL_DENIED';
    const status = reason === 'BOQ_NOT_FOUND' ? 404
      : reason === 'APPROVED_DESIGN_REVISION_REQUIRED' ? 422
        : reason === 'BOQ_CREATOR_CANNOT_APPROVE_OR_STATE_NOT_APPROVABLE' ? 409 : 403;
    return NextResponse.json({ success: false, error: 'INTERIOR_BOQ_APPROVAL_DENIED', reason }, { status });
  }

  return NextResponse.json({ success: true, boqId, status: 'approved' }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
