import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { InteriorProductionAnalyticsService } from '@/products/bella-interior/services/interior-production-analytics.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  try {
    const overview = InteriorProductionAnalyticsService.getProductionOverview();
    return NextResponse.json({
      success: true,
      data: {
        overview,
      },
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_PRODUCTION_ANALYTICS_FAILED' }, { status: 500 });
  }
}
