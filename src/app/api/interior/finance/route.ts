import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { InteriorFinanceAnalyticsService } from '@/products/bella-interior/services/interior-finance-analytics.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const quarter = request.nextUrl.searchParams.get('quarter') || 'Quý 4/2026';
  const periodParam = request.nextUrl.searchParams.get('period');
  const period: '3_months' | '6_months' | '1_year' =
    periodParam === '6_months' || periodParam === '1_year' ? periodParam : '3_months';

  try {
    const overview = await InteriorFinanceAnalyticsService.getFinanceOverview(quarter, period, ctx.tenantId, ctx.supabase);
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
    const msg = error instanceof Error ? error.message : 'Unknown finance overview error';
    return NextResponse.json(
      { success: false, error: 'INTERIOR_FINANCE_READ_FAILED', message: msg },
      { status: 500 }
    );
  }
}
