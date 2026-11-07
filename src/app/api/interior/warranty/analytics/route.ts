import { NextRequest, NextResponse } from 'next/server';
import { InteriorWarrantyAnalyticsService } from '@/products/bella-interior/services/interior-warranty-analytics.service';

/**
 * GET /api/interior/warranty/analytics
 * 
 * Canonical API endpoint for Bella Interior Warranty & Aftercare Dashboard.
 * Returns pre-computed KPIs, certificate rows, expiration alerts, calendar items,
 * and aftercare roadmap.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'tenant-bella-interior-001';
    const projectId = searchParams.get('projectId') || undefined;

    const overview = await InteriorWarrantyAnalyticsService.getWarrantyOverview(tenantId, projectId);

    return NextResponse.json({
      success: true,
      data: {
        tenantId,
        overview,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] /api/interior/warranty/analytics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve warranty & aftercare analytics data',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

