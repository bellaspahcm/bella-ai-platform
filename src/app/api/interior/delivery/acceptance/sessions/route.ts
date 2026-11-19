import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import { InteriorAcceptanceService } from '@/products/bella-interior/services/interior-acceptance.service';
import { validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';
import type { AcceptanceSessionType } from '@/products/bella-interior/domain/acceptance-handover.types';

export const dynamic = 'force-dynamic';

const VALID_SESSION_TYPES = new Set<AcceptanceSessionType>([
  'ROOM_BY_ROOM',
  'ITEM_BASED',
  'DELIVERY_BATCH',
  'POST_REMEDIATION',
  'FINAL_HANDOVER',
]);

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('campaignId');
  const projectId = searchParams.get('projectId');

  if (!campaignId && !projectId) {
    return NextResponse.json(
      { success: false, error: 'Either campaignId or projectId query parameter is required' },
      { status: 400 }
    );
  }

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase);
    const service = new InteriorAcceptanceService(repo);

    let sessions;
    if (campaignId) {
      if (!validInteriorUuid(campaignId)) {
        return NextResponse.json({ success: false, error: 'Invalid campaignId' }, { status: 400 });
      }
      sessions = await service.listSessions(ctx.tenantId, campaignId);
    } else {
      if (!projectId || !validInteriorUuid(projectId)) {
        return NextResponse.json({ success: false, error: 'Invalid projectId' }, { status: 400 });
      }
      sessions = await service.listSessionsByProject(ctx.tenantId, projectId);
    }

    return NextResponse.json({ success: true, data: sessions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ACCEPTANCE_SESSIONS_LIST_FAILED';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  try {
    const body = await request.json();
    const {
      campaignId,
      projectId,
      sessionCode,
      sessionType,
      inspectionScope,
      inspectionDate,
      customerRepresentative,
      customerContact,
      relatedBoqItemIds,
      inspectionResult,
    } = body;

    if (!campaignId || !validInteriorUuid(campaignId)) {
      return NextResponse.json({ success: false, error: 'Valid campaignId is required' }, { status: 400 });
    }
    if (!projectId || !validInteriorUuid(projectId)) {
      return NextResponse.json({ success: false, error: 'Valid projectId is required' }, { status: 400 });
    }
    if (!sessionCode || typeof sessionCode !== 'string' || !sessionCode.trim()) {
      return NextResponse.json({ success: false, error: 'sessionCode is required' }, { status: 400 });
    }
    if (!sessionType || !VALID_SESSION_TYPES.has(sessionType as AcceptanceSessionType)) {
      return NextResponse.json(
        { success: false, error: `Invalid sessionType. Allowed: ${Array.from(VALID_SESSION_TYPES).join(', ')}` },
        { status: 400 }
      );
    }
    if (!inspectionScope || typeof inspectionScope !== 'string' || !inspectionScope.trim()) {
      return NextResponse.json({ success: false, error: 'inspectionScope is required' }, { status: 400 });
    }
    if (!inspectionDate || typeof inspectionDate !== 'string') {
      return NextResponse.json({ success: false, error: 'inspectionDate (YYYY-MM-DD) is required' }, { status: 400 });
    }
    if (!customerRepresentative || typeof customerRepresentative !== 'string' || !customerRepresentative.trim()) {
      return NextResponse.json({ success: false, error: 'customerRepresentative is required' }, { status: 400 });
    }

    const repo = new SupabaseInteriorRepository(ctx.supabase);
    const service = new InteriorAcceptanceService(repo);

    const session = await service.createSession({
      tenantId: ctx.tenantId,
      campaignId,
      projectId,
      sessionCode: sessionCode.trim(),
      sessionType,
      inspectionScope: inspectionScope.trim(),
      inspectionDate,
      recorderActorId: ctx.actor?.id || 'unassigned',
      customerRepresentative: customerRepresentative.trim(),
      customerContact: typeof customerContact === 'string' ? customerContact.trim() : null,
      relatedBoqItemIds: Array.isArray(relatedBoqItemIds) ? relatedBoqItemIds : [],
      inspectionResult: inspectionResult ?? 'PENDING_REMEDIATION',
    });

    return NextResponse.json({ success: true, data: session }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ACCEPTANCE_SESSION_CREATE_FAILED';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
