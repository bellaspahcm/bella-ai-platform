import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HandoverDossier as DomainHandoverDossier } from '@/products/bella-interior/domain/delivery-aftercare/types';

export const dynamic = 'force-dynamic';

interface HandoverCreateBody {
  projectId: string;
  handedOverByUserId: string;
  clientRepresentative: string;
  notes?: string;
}

interface StoredHandover {
  id: string;
  tenantId: string;
  projectId: string;
  handedOverByUserId: string;
  clientRepresentative: string;
  notes: string;
  handoverDate: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  status: 'completed';
}

// Mock punch list to check for critical open items
// DOMAIN CONTRACT: status 'rectified' and 'verified' (not 'resolved')
// Handover is blocked only when severity === 'critical' AND status !== 'verified'
const MOCK_PUNCH_LIST: Array<{ projectId: string; severity: string; status: string }> = [
  { projectId: 'PRJ-DEMO-001', severity: 'major',    status: 'rectified' },
  { projectId: 'PRJ-DEMO-001', severity: 'minor',    status: 'verified'  },
  { projectId: 'PRJ-DEMO-002', severity: 'critical',  status: 'open'      },
];

const handoverStore: StoredHandover[] = [];

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId } = ctx;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  const results = handoverStore.filter((h) => {
    const tenantMatch = h.tenantId === tenantId || h.tenantId === '00000000-0000-0000-0000-000000000001';
    const projectMatch = projectId ? h.projectId === projectId : true;
    return tenantMatch && projectMatch;
  });

  return NextResponse.json({ success: true, data: { handovers: results, total: results.length } });
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const { tenantId, actor } = ctx;

  let body: HandoverCreateBody;
  try {
    body = (await request.json()) as HandoverCreateBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.projectId || !body.handedOverByUserId || !body.clientRepresentative) {
    return NextResponse.json(
      { success: false, error: 'projectId, handedOverByUserId and clientRepresentative are required' },
      { status: 400 },
    );
  }

  // Gate: block handover only when critical items are not 'verified'
  // Business rule: 'rectified' alone is not sufficient — must be 'verified' by a second person
  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
  let dbPunchItems: any[] = [];
  try {
    dbPunchItems = await repo.listPunchListItems(tenantId, body.projectId);
  } catch {
    // DB query failed; fall back to mock
  }

  const criticalDb = dbPunchItems.filter((p) => p.severity === 'critical' && p.status !== 'verified');
  const criticalMock = MOCK_PUNCH_LIST.filter(
    (p) => p.projectId === body.projectId && p.severity === 'critical' && p.status !== 'verified',
  );

  const openCriticalCount = criticalDb.length > 0 ? criticalDb.length : criticalMock.length;

  if (openCriticalCount > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Handover blocked: ${openCriticalCount} open critical punch list items must be resolved first`,
      },
      { status: 422 },
    );
  }

  const handoverDate = new Date().toISOString();
  const warrantyStartDate = handoverDate;
  const warrantyEnd = new Date();
  warrantyEnd.setFullYear(warrantyEnd.getFullYear() + 1);
  const handoverId = `HDO-${randomUUID().slice(0, 8).toUpperCase()}`;

  const domainDossier: DomainHandoverDossier = {
    id: handoverId,
    tenantId,
    projectId: body.projectId,
    contractId: randomUUID(),
    status: 'completed',
    handoverDate,
    totalPunchListItems: 0,
    openPunchListItems: 0,
    clientAccepted: true,
    clientSignoffName: body.clientRepresentative,
    finalSettlementValue: 0,
  };

  try {
    await repo.saveHandoverDossier(tenantId, domainDossier);
  } catch {
    // DB save failed; proceed with mock store
  }

  const handover: StoredHandover = {
    id: handoverId,
    tenantId,
    projectId: body.projectId,
    handedOverByUserId: body.handedOverByUserId,
    clientRepresentative: body.clientRepresentative,
    notes: body.notes ?? '',
    handoverDate,
    warrantyStartDate,
    warrantyEndDate: warrantyEnd.toISOString(),
    status: 'completed',
  };

  handoverStore.push(handover);

  return NextResponse.json(
    { success: true, data: { dossierId: handover.id, handoverDate: handover.handoverDate, warrantyStartDate: handover.warrantyStartDate } },
    { status: 201 },
  );
}
