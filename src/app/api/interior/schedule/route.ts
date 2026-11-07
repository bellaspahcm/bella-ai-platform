/**
 * Bella Interior OS — Schedule & Dispatch Portfolio API Route
 *
 * GET /api/interior/schedule
 *
 * Canonical endpoint for retrieving full Schedule & Task Dispatching analytics:
 * - 4 KPIs (Total, Completed, In Progress, Overdue)
 * - 4 Time slots x 7 Days weekly schedule grid
 * - 6 Canonical scheduled tasks mapped to day and slot
 * - Attention alerts panel (overdue tasks, conflict risks, unassigned staff)
 * - Resource capacity readiness breakdown (78% readiness, status counts)
 * - Upcoming tasks list
 * - Project schedule progress bars (Villa Sunrise, Office Tower, Skyline, The Garden Villa)
 * - Action suggestions
 *
 * Strict Server-Side Calculation: All business rules, formulas, and percentages
 * are resolved by InteriorScheduleAnalyticsService. UI only renders the payload.
 *
 * @module src/app/api/interior/schedule/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  InteriorScheduleAnalyticsService,
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

    const overview = InteriorScheduleAnalyticsService.getScheduleOverview(tenantId);

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
