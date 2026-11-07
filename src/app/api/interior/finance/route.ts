import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { InteriorFinanceAnalyticsService } from '@/products/bella-interior/services/interior-finance-analytics.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  let tenantId = '00000000-0000-0000-0000-000000000001';
  try {
    const ctx = await resolveInteriorContext(request);
    if (ctx.ok) {
      tenantId = ctx.tenantId;
    }
  } catch {
    // Default tenant fallback for executive dashboard
  }

  const { searchParams } = new URL(request.url);
  const quarter = searchParams.get('quarter') || 'Quý 4/2026';
  const periodParam = searchParams.get('period');
  const period =
    periodParam === '6_months' || periodParam === '1_year' ? periodParam : '3_months';

  const overview = InteriorFinanceAnalyticsService.getFinanceOverview(quarter, period);

  return NextResponse.json({
    success: true,
    data: {
      tenantId,
      overview,
    },
  });
}

