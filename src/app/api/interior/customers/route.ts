/**
 * Bella Interior OS — Customers & CRM Portfolio API Route
 *
 * GET /api/interior/customers
 *
 * Canonical endpoint for retrieving full Customer & Investor Portfolio analytics:
 * - 4 KPIs (Total, Leads, Transacting, VIP)
 * - 5-stage Sales Funnel with conversion metrics
 * - 12-month Customer & Revenue growth chart data
 * - Enriched customer list with badges, debt status, and last activity
 * - Operational CRM alerts and action items
 * - Customer financial summary (contracts, collected, debt, collection rate)
 * - Source distribution (Referral, Marketing, Website)
 * - Recommended action suggestions
 *
 * Strict Server-Side Calculation: All business rules, formulas, and percentages
 * are resolved by InteriorCustomerAnalyticsService. UI only renders the payload.
 *
 * @module src/app/api/interior/customers/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  InteriorCustomerAnalyticsService,
  TenantIsolationViolationError,
} from '@/products/bella-interior';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId =
      searchParams.get('tenantId') ||
      request.headers.get('x-tenant-id') ||
      'tenant-bella-interior-default';

    const overview = InteriorCustomerAnalyticsService.getCustomerOverview(tenantId);

    return NextResponse.json(overview, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: unknown) {
    if (error instanceof TenantIsolationViolationError) {
      return NextResponse.json(
        {
          success: false,
          error: 'TENANT_ISOLATION_VIOLATION',
          message: error.message,
        },
        { status: 403 },
      );
    }

    const message = error instanceof Error ? error.message : 'Unknown internal server error';
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message,
      },
      { status: 500 },
    );
  }
}
