import { NextResponse } from 'next/server';
import { resolveInteriorContext, INTERIOR_PERMISSIONS } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import { InteriorAcceptanceService } from '@/products/bella-interior/services/interior-acceptance.service';
import { validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId || !validInteriorUuid(projectId)) {
    return NextResponse.json(
      { success: false, error: 'Valid projectId query parameter is required' },
      { status: 400 }
    );
  }

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase);
    const service = new InteriorAcceptanceService(repo);
    const campaigns = await service.listCampaigns(ctx.tenantId, projectId);

    return NextResponse.json({ success: true, data: campaigns });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ACCEPTANCE_CAMPAIGN_LIST_FAILED';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  try {
    const body = await request.json();
    const { projectId, campaignCode, campaignName, description } = body;

    if (!projectId || !validInteriorUuid(projectId)) {
      return NextResponse.json({ success: false, error: 'Valid projectId is required' }, { status: 400 });
    }
    if (!campaignCode || typeof campaignCode !== 'string' || !campaignCode.trim()) {
      return NextResponse.json({ success: false, error: 'campaignCode is required' }, { status: 400 });
    }
    if (!campaignName || typeof campaignName !== 'string' || !campaignName.trim()) {
      return NextResponse.json({ success: false, error: 'campaignName is required' }, { status: 400 });
    }

    const repo = new SupabaseInteriorRepository(ctx.supabase);
    const service = new InteriorAcceptanceService(repo);

    const campaign = await service.createCampaign({
      tenantId: ctx.tenantId,
      projectId,
      campaignCode: campaignCode.trim(),
      campaignName: campaignName.trim(),
      description: typeof description === 'string' ? description.trim() : null,
      createdByUserId: ctx.actor?.id ?? null,
    });

    return NextResponse.json({ success: true, data: campaign }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ACCEPTANCE_CAMPAIGN_CREATE_FAILED';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
