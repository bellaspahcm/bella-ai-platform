import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HandoverDossier as DomainHandoverDossier } from '@/products/bella-interior/domain/delivery-aftercare/types';

export const dynamic = 'force-dynamic';

interface HandoverCreateBody {
  projectId: string;
  clientRepresentative: string;
  notes?: string;
}

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId') || undefined;
  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);

  try {
    const handovers = await repo.listHandoverDossiers(ctx.tenantId, projectId);
    const [financeDecision, contractDecision, customerDecision] = await Promise.all([
      ctx.authorization.authorize({ permissionId: 'interior:finance:read', tenantId: ctx.tenantId }),
      ctx.authorization.authorize({ permissionId: 'interior:contract:read', tenantId: ctx.tenantId }),
      ctx.authorization.authorize({ permissionId: 'interior:customer:read', tenantId: ctx.tenantId }),
    ]);
    const canReadSettlement = financeDecision.status === 'ALLOW' || contractDecision.status === 'ALLOW';
    const canReadCustomer = customerDecision.status === 'ALLOW';
    const visibleHandovers = handovers.map((handover) => {
      const { finalSettlementValue, clientSignoffName, ...visibleHandover } = handover;
      void finalSettlementValue;
      void clientSignoffName;
      return {
        ...visibleHandover,
        ...(canReadSettlement ? { finalSettlementValue: handover.finalSettlementValue } : {}),
        ...(canReadCustomer ? { clientSignoffName: handover.clientSignoffName } : {}),
      };
    });
    return NextResponse.json({ success: true, data: { handovers: visibleHandovers, total: handovers.length } }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_HANDOVER_LOOKUP_FAILED' }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
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
  const payload = body as Partial<HandoverCreateBody>;
  if (typeof payload.projectId !== 'string' || !payload.projectId || typeof payload.clientRepresentative !== 'string' || !payload.clientRepresentative.trim()) {
    return NextResponse.json({ success: false, error: 'projectId and clientRepresentative are required' }, { status: 400 });
  }

  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
  let project;
  let contract;
  let punchItems;
  try {
    project = await repo.getProject(ctx.tenantId, payload.projectId);
    if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    contract = await repo.getContractByProject(ctx.tenantId, payload.projectId);
    punchItems = await repo.listPunchListItems(ctx.tenantId, payload.projectId);
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_HANDOVER_PRECONDITION_LOOKUP_FAILED' }, { status: 503 });
  }
  if (!contract) {
    return NextResponse.json({ success: false, error: 'A signed project contract is required before handover' }, { status: 422 });
  }

  const openCriticalCount = punchItems.filter((item) => item.severity === 'critical' && item.status !== 'verified').length;
  if (openCriticalCount > 0) {
    return NextResponse.json({
      success: false,
      error: `Handover blocked: ${openCriticalCount} open critical punch list items must be verified first`,
    }, { status: 422 });
  }

  const handoverDate = new Date().toISOString();
  const dossier: DomainHandoverDossier = {
    id: randomUUID(),
    tenantId: ctx.tenantId,
    projectId: payload.projectId,
    contractId: contract.id,
    status: 'completed',
    handoverDate,
    totalPunchListItems: punchItems.length,
    openPunchListItems: punchItems.filter((item) => item.status !== 'verified').length,
    clientAccepted: true,
    clientSignoffName: payload.clientRepresentative.trim(),
    finalSettlementValue: contract.currentContractValue,
  };

  try {
    await repo.saveHandoverDossier(ctx.tenantId, dossier);
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_HANDOVER_PERSISTENCE_FAILED' }, { status: 503 });
  }

  const [financeDecision, contractDecision] = await Promise.all([
    ctx.authorization.authorize({ permissionId: 'interior:finance:read', tenantId: ctx.tenantId }),
    ctx.authorization.authorize({ permissionId: 'interior:contract:read', tenantId: ctx.tenantId }),
  ]);
  const canReadSettlement = financeDecision.status === 'ALLOW' || contractDecision.status === 'ALLOW';
  let responseDossier: typeof dossier | Omit<typeof dossier, 'finalSettlementValue'> = dossier;
  if (!canReadSettlement) {
    const { finalSettlementValue, ...visibleDossier } = dossier;
    void finalSettlementValue;
    responseDossier = visibleDossier;
  }

  return NextResponse.json({ success: true, data: { dossier: responseDossier } }, { status: 201 });
}
