import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
import { InteriorContractAnalyticsService } from '@/products/bella-interior/services/interior-contract-analytics.service';

export const dynamic = 'force-dynamic';

interface PaymentMilestoneInput {
  name: string;
  percentageOfTotal: number;
  dueDate: string;
}

interface ContractCreateBody {
  action?: 'create-contract' | 'release-to-workshop' | 'record-payment' | 'create-addendum';
  projectId?: string;
  boqId?: string;
  contractValue?: number;
  clientPartyId?: string;
  milestones?: PaymentMilestoneInput[];
  milestoneId?: string;
  paymentAmount?: number;
  paymentMethod?: string;
  addendumTitle?: string;
  addendumValue?: number;
}

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;
  const tenantId = ctx.tenantId;
  const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);

  const { searchParams } = new URL(request.url);
  const requestedProjectId = searchParams.get('projectId');
  if (!requestedProjectId) {
    return NextResponse.json({ success: false, error: 'projectId query parameter is required' }, { status: 400 });
  }

  let project;
  let contract;
  let overview;
  try {
    project = await repo.getProject(tenantId, requestedProjectId);
    if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    contract = await repo.getContractByProject(tenantId, project.id);
    overview = await InteriorContractAnalyticsService.getContractOverview(tenantId, project.id, repo);
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_CONTRACT_LOOKUP_FAILED' }, { status: 503 });
  }

  return NextResponse.json({
    success: true,
    data: {
      overview,
      hasContract: overview.hasContract,
      contracts: contract ? [contract] : [],
      total: contract ? 1 : 0,
    },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  let body: ContractCreateBody;
  try {
    body = (await request.json()) as ContractCreateBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  // Handle action: release-to-workshop
  if (body.action === 'release-to-workshop') {
    return NextResponse.json(
      { success: false, error: 'INTERIOR_PRODUCTION_RELEASE_PERSISTENCE_UNAVAILABLE' },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { success: false, error: 'INTERIOR_CONTRACT_PERSISTENCE_UNAVAILABLE' },
    { status: 503 },
  );
}
