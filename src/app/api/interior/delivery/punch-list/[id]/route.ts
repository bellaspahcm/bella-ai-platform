import { NextResponse } from 'next/server';
import type { PunchListStatus } from '@/products/bella-interior/domain/delivery-aftercare/types';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface PunchListPatchBody {
  status: PunchListStatus;
  rectificationNote?: string;
}

const VALID_STATUSES: PunchListStatus[] = ['open', 'in_progress', 'rectified', 'verified'];

async function loadItem(request: Request, id: string) {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return { ctx, item: null } as const;
  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
  try {
    const item = await repo.getPunchListItem(ctx.tenantId, id);
    return { ctx, item, repo } as const;
  } catch {
    return { ctx, item: undefined, repo } as const;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!id) return NextResponse.json({ success: false, error: 'Punch list item ID is required' }, { status: 400 });

  const loaded = await loadItem(request, id);
  if (!loaded.ctx.ok) return loaded.ctx.response;
  if (loaded.item === undefined) return NextResponse.json({ success: false, error: 'INTERIOR_QC_LOOKUP_FAILED' }, { status: 503 });
  if (!loaded.item || !loaded.repo) return NextResponse.json({ success: false, error: 'Punch list item not found' }, { status: 404 });

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

  const current = loaded.item;
  const allowedNext: Record<PunchListStatus, PunchListStatus | null> = {
    open: 'in_progress',
    in_progress: 'rectified',
    rectified: 'verified',
    verified: null,
  };
  if (payload.status !== current.status && allowedNext[current.status] !== payload.status) {
    return NextResponse.json({ success: false, error: `Invalid punch-list transition: ${current.status} -> ${payload.status}` }, { status: 409 });
  }
  if (payload.status === 'verified' && current.status !== 'rectified') {
    return NextResponse.json({ success: false, error: 'Only a rectified item can be verified' }, { status: 422 });
  }

  const now = new Date().toISOString();
  const updated = {
    ...current,
    status: payload.status,
    rectificationNote: payload.rectificationNote ?? current.rectificationNote,
    verifiedBy: payload.status === 'verified' ? loaded.ctx.actor.id : current.verifiedBy,
    verifiedAt: payload.status === 'verified' ? now : current.verifiedAt,
  };
  try {
    await loaded.repo.savePunchListItem(loaded.ctx.tenantId, updated);
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_QC_PERSISTENCE_FAILED' }, { status: 503 });
  }

  return NextResponse.json({ success: true, data: updated });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!id) return NextResponse.json({ success: false, error: 'Punch list item ID is required' }, { status: 400 });

  const loaded = await loadItem(request, id);
  if (!loaded.ctx.ok) return loaded.ctx.response;
  if (loaded.item === undefined) return NextResponse.json({ success: false, error: 'INTERIOR_QC_LOOKUP_FAILED' }, { status: 503 });
  if (!loaded.item) return NextResponse.json({ success: false, error: 'Punch list item not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: loaded.item });
}
