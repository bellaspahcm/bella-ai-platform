import { NextRequest, NextResponse } from 'next/server';
import { InteriorReportsAnalyticsService } from '@/products/bella-interior/services/interior-reports-analytics.service';

/**
 * GET /api/interior/reports/analytics
 * 
 * Canonical API endpoint for Bella Interior Project Reports & Executive Analytics.
 * Strict Zero UI Calculation: Returns pre-computed KPIs, multi-month trends,
 * dual-bar chart heights, cost structure donut arcs, project performance rows,
 * and management alerts.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'tenant-bella-interior-001';
    const projectId = searchParams.get('projectId') || undefined;
    const period = searchParams.get('period') || undefined;

    const overview = await InteriorReportsAnalyticsService.getReportsOverview(
      tenantId,
      projectId,
      period
    );

    return NextResponse.json({
      success: true,
      data: {
        tenantId,
        overview,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] /api/interior/reports/analytics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve project reports & business analytics dossier',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

