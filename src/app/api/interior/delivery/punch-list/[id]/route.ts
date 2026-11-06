import { NextResponse } from 'next/server';
import type { PunchListStatus } from '@/products/bella-interior/domain/delivery-aftercare/types';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';

export const dynamic = 'force-dynamic';

/**
 * Punch List Item Status Update
 *
 * Valid transitions (from domain/delivery-aftercare/types.ts):
 *   open → in_progress → rectified → verified
 *
 * Business rules:
 * - 'rectified' (not 'resolved'): defect has been fixed, awaiting verification
 * - 'verified': verifiedBy is set from actor.id (server-side) — NOT from client body (security invariant)
 * - Only 'critical' severity items block handover when not 'verified'
 */

interface PunchListPatchBody {
  status: PunchListStatus;
  /** Required when transitioning to 'rectified' */
  rectifiedBy?: string;
  rectificationNote?: string;
  rectificationPhotoUrl?: string;
}

const VALID_STATUSES: PunchListStatus[] = ['open', 'in_progress', 'rectified', 'verified'];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId, actor } = ctx;

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ success: false, error: 'Punch list item ID is required' }, { status: 400 });
  }

  let body: PunchListPatchBody;
  try {
    body = (await request.json()) as PunchListPatchBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json(
      {
        success: false,
        error: `status must be one of: ${VALID_STATUSES.join(', ')}. NOTE: use 'rectified' (not 'resolved') when defect is fixed.`,
      },
      { status: 422 },
    );
  }

  // Business rule: 'rectified' requires rectifiedBy
  if (body.status === 'rectified' && !body.rectifiedBy) {
    return NextResponse.json(
      { success: false, error: 'rectifiedBy is required when setting status to rectified' },
      { status: 422 },
    );
  }

  const now = new Date().toISOString();

  // Security invariant: verifiedBy is always set from the authenticated actor, never from the client body
  const verifiedBy = body.status === 'verified' ? actor.id : null;

  return NextResponse.json({
    success: true,
    data: {
      id,
      tenantId,
      status: body.status,
      rectifiedBy: body.rectifiedBy ?? null,
      rectifiedAt: body.status === 'rectified' || body.status === 'verified' ? now : null,
      rectificationNote: body.rectificationNote ?? null,
      rectificationPhotoUrl: body.rectificationPhotoUrl ?? null,
      verifiedBy,
      verifiedAt: body.status === 'verified' ? now : null,
      updatedAt: now,
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId } = ctx;

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ success: false, error: 'Punch list item ID is required' }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    data: {
      id,
      tenantId,
      description: 'Mock punch list item',
      status: 'open' satisfies PunchListStatus,
      severity: 'minor',
      category: 'finishing',
      verifiedBy: null,
      verifiedAt: null,
    },
  });
}
