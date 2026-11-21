import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { resolveTenantProject } from '@/products/bella-interior/lib/project-resolver';
import { InteriorWarrantyAnalyticsService } from '@/products/bella-interior/services/interior-warranty-analytics.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const projectIdParam = request.nextUrl.searchParams.get('projectId');
  const projectResult = await resolveTenantProject(ctx.supabase, ctx.tenantId, projectIdParam);

  if (!projectResult.ok && projectResult.error === 'AMBIGUOUS_PROJECT_SELECTION') {
    return NextResponse.json({
      success: false,
      error: projectResult.error,
      message: projectResult.message,
      availableProjects: projectResult.availableProjects,
    }, { status: 400 });
  }

  const effectiveProjectId = projectResult.ok ? projectResult.projectId : undefined;

  try {
    const overview = await InteriorWarrantyAnalyticsService.getWarrantyOverview(ctx.tenantId, effectiveProjectId, ctx.supabase);
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
    const msg = error instanceof Error ? error.message : 'Unknown warranty overview error';
    return NextResponse.json(
      { success: false, error: 'INTERIOR_WARRANTY_ANALYTICS_READ_FAILED', message: msg },
      { status: 500 }
    );
  }
}
