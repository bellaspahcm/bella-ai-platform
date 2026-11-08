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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'INVALID_JSON', message: 'Body must be valid JSON' },
        { status: 400 },
      );
    }

    const payload = body as Record<string, unknown>;
    const tenantId =
      (typeof payload.tenantId === 'string' && payload.tenantId.trim()) ||
      request.headers.get('x-tenant-id') ||
      'tenant-bella-interior-default';

    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (!title) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_FAILED', message: 'Field "title" is required' },
        { status: 422 },
      );
    }

    const projectName =
      typeof payload.projectName === 'string' ? payload.projectName.trim() : 'Dự án nội thất';
    const assignee =
      typeof payload.assignee === 'string' ? payload.assignee.trim() : 'KTS. Phụ trách';
    const category = (
      ['design', 'workshop', 'site', 'handover'].includes(payload.category as string)
        ? payload.category
        : 'design'
    ) as 'design' | 'workshop' | 'site' | 'handover';

    const dayIndex = typeof payload.dayIndex === 'number' ? payload.dayIndex : 0;
    const timeSlotId =
      typeof payload.timeSlotId === 'string' ? payload.timeSlotId : 'slot-1';
    const priority = payload.priority === 'urgent' ? 'urgent' : 'normal';
    const notes = typeof payload.notes === 'string' ? payload.notes : undefined;

    // Intermediate domain service call (Canonical Source of Truth)
    const task = InteriorScheduleAnalyticsService.createScheduledTask(tenantId, {
      title,
      projectName,
      assignee,
      category,
      dayIndex,
      timeSlotId,
      priority,
      notes,
    });

    const updatedOverview = InteriorScheduleAnalyticsService.getScheduleOverview(tenantId);

    return NextResponse.json(
      {
        success: true,
        data: {
          task,
          overview: updatedOverview,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof TenantIsolationViolationError) {
      return NextResponse.json(
        { success: false, error: 'TENANT_ISOLATION_VIOLATION', message: error.message },
        { status: 403 },
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown internal server error';
    return NextResponse.json(
      { success: false, error: 'INTERNAL_SERVER_ERROR', message },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const tenantId =
      (typeof body.tenantId === 'string' && body.tenantId.trim()) ||
      request.headers.get('x-tenant-id') ||
      'tenant-bella-interior-default';
    const taskId = typeof body.taskId === 'string' ? body.taskId : '';

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_FAILED', message: 'taskId is required' },
        { status: 422 },
      );
    }

    InteriorScheduleAnalyticsService.completeScheduledTask(tenantId, taskId);
    const updatedOverview = InteriorScheduleAnalyticsService.getScheduleOverview(tenantId);

    return NextResponse.json({
      success: true,
      data: {
        overview: updatedOverview,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'INTERNAL_SERVER_ERROR', message },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId =
      searchParams.get('tenantId') ||
      request.headers.get('x-tenant-id') ||
      'tenant-bella-interior-default';
    const taskId = searchParams.get('taskId') || '';

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_FAILED', message: 'taskId query parameter is required' },
        { status: 422 },
      );
    }

    InteriorScheduleAnalyticsService.deleteScheduledTask(tenantId, taskId);
    const updatedOverview = InteriorScheduleAnalyticsService.getScheduleOverview(tenantId);

    return NextResponse.json({
      success: true,
      data: {
        overview: updatedOverview,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'INTERNAL_SERVER_ERROR', message },
      { status: 500 },
    );
  }
}
