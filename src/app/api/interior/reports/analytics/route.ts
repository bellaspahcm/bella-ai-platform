import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { resolveTenantProject } from '@/products/bella-interior/lib/project-resolver';
import { InteriorReportsAnalyticsService } from '@/products/bella-interior/services/interior-reports-analytics.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const projectIdParam = request.nextUrl.searchParams.get('projectId');
  const period = request.nextUrl.searchParams.get('period') || undefined;

  // Reports is an aggregate dashboard — projectId is optional.
  // Only resolve project if explicitly requested; never block on AMBIGUOUS_PROJECT_SELECTION.
  let effectiveProjectId: string | undefined;
  if (projectIdParam) {
    const projectResult = await resolveTenantProject(ctx.supabase, ctx.tenantId, projectIdParam);
    effectiveProjectId = projectResult.ok ? projectResult.projectId : undefined;
  }
  try {
    const overview = await InteriorReportsAnalyticsService.getReportsOverview(
      ctx.tenantId,
      effectiveProjectId,
      period,
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
    const msg = error instanceof Error ? error.message : 'Unknown reports overview error';
    return NextResponse.json(
      { success: false, error: 'INTERIOR_REPORTS_READ_FAILED', message: msg },
      { status: 500 }
    );
  }
}
