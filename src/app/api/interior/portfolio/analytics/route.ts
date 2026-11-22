/**
 * Bella Interior OS — Portfolio & Executive Analytics API Route
 *
 * GET /api/interior/portfolio/analytics
 *
 * Provides real-time portfolio analytics across:
 * 1. Executive Overview: Real project counts, total contract values, cash collected, and receivable debts.
 * 2. Project Portfolio: Active projects, schedules, budgets, completion rates, and delay risks.
 * 3. Commercial Analytics: Quotation conversions and contract collection rates.
 * 4. Delivery & Quality Analytics: Punch list items, defect severities, and handover dossiers.
 * 5. Warranty Analytics: Certificates, service tickets, and resolution rates.
 *
 * @module src/app/api/interior/portfolio/analytics/route
 */

import { NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import { InteriorPortfolioAnalyticsService } from '@/products/bella-interior/services/interior-portfolio-analytics.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase);
    const service = new InteriorPortfolioAnalyticsService(repo);
    const overview = await service.computePortfolioOverview(ctx.tenantId);

    return NextResponse.json(
      {
        success: true,
        data: overview,
      },
      {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown portfolio overview error';
    return NextResponse.json(
      { success: false, error: 'INTERIOR_PORTFOLIO_READ_FAILED', message: msg },
      { status: 500 }
    );
  }
}
