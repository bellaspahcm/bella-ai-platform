import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { InteriorQCHandoverAnalyticsService } from '@/products/bella-interior/services/interior-qc-handover-analytics.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const url = new URL(request.url);
  const requestedProjectId = url.searchParams.get('projectId') || undefined;

  try {
    const overview = await InteriorQCHandoverAnalyticsService.getQCHandoverOverview(
      ctx.tenantId,
      requestedProjectId,
      ctx.supabase
    );
    return NextResponse.json(
      {
        success: true,
        data: { overview },
      },
      {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown QC/Handover overview error';
    return NextResponse.json(
      { success: false, error: 'INTERIOR_QC_HANDOVER_READ_FAILED', message: msg },
      { status: 500 }
    );
  }
}
