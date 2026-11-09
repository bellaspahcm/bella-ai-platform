import { NextResponse } from 'next/server';
import type { PunchListStatus } from '@/products/bella-interior/domain/delivery-aftercare/types';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorMutationRow, interiorRbacRpcClient, isInteriorRbacRecord, validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

interface PunchListPatchBody {
  status: PunchListStatus;
  rectificationNote?: string;
}

const VALID_STATUSES: PunchListStatus[] = ['open', 'in_progress', 'rectified', 'verified'];

function mutationStatus(reason: unknown): number {
  return reason === 'QC_ITEM_NOT_FOUND' ? 404
    : reason === 'INVALID_QC_ITEM_INPUT' || reason === 'QC_ITEM_MUST_BE_RECTIFIED_BEFORE_VERIFICATION' ? 422
      : reason === 'INVALID_QC_STATE_TRANSITION' ? 409 : 403;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!validInteriorUuid(id)) return NextResponse.json({ success: false, error: 'Punch list item ID is invalid' }, { status: 400 });
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ success: false, error: 'Request body must be an object' }, { status: 400 });
  }
  const payload = body as Partial<PunchListPatchBody>;
  if (!payload.status || !VALID_STATUSES.includes(payload.status)) {
    return NextResponse.json({ success: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 422 });
  }
  if (payload.rectificationNote !== undefined && typeof payload.rectificationNote !== 'string') {
    return NextResponse.json({ success: false, error: 'rectificationNote must be a string' }, { status: 422 });
  }

  const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_update_qc_item', {
    p_item_id: id,
    p_status: payload.status,
    p_rectification_note: payload.rectificationNote ?? null,
  });
  if (error) {
    return NextResponse.json({ success: false, error: 'INTERIOR_QC_PERSISTENCE_FAILED' }, { status: 503 });
  }
  const outcome = interiorMutationRow(data);
  if (!outcome || outcome.status !== 'COMMITTED' || !isInteriorRbacRecord(outcome.item)) {
    const reason = outcome?.reason;
    return NextResponse.json({ success: false, error: 'INTERIOR_QC_ITEM_UPDATE_DENIED', reason }, { status: mutationStatus(reason) });
  }
  return NextResponse.json({ success: true, data: outcome.item });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!validInteriorUuid(id)) return NextResponse.json({ success: false, error: 'Punch list item ID is invalid' }, { status: 400 });
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_read_qc_item', { p_item_id: id });
  if (error) return NextResponse.json({ success: false, error: 'INTERIOR_QC_LOOKUP_FAILED' }, { status: 503 });
  if (data === null) return NextResponse.json({ success: false, error: 'Punch list item not found' }, { status: 404 });
  if (!isInteriorRbacRecord(data)) return NextResponse.json({ success: false, error: 'INTERIOR_QC_LOOKUP_FAILED' }, { status: 503 });
  return NextResponse.json({ success: true, data });
}
