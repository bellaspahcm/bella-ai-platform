/**
 * Bella Interior OS — Design Studio Canonical API Route
 *
 * GET /api/interior/design
 * POST /api/interior/design/toggle-lock
 *
 * Canonical endpoint for retrieving full Design Studio data:
 * - Project Header & Sub-navigation tabs (Villa Sunrise Renovation INT-2024-001)
 * - Approved Design Lock strip (R1.0, Approval metadata, lock status)
 * - 3D Perspectives Visual Gallery with primary view and thumbnail angles
 * - 2D Technical CAD Drawings (DWG / PDF)
 * - Material & Specification Cards (Veneer Óc Chó, Đá Thạch Anh, Bản Lề, Khung Nhôm Slim)
 * - Material Compliance Audit summary
 *
 * Strict Server-Side Calculation: All business rules, formulas, and percentages
 * are resolved by InteriorDesignAnalyticsService. UI only renders the payload.
 *
 * @module src/app/api/interior/design/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  InteriorDesignAnalyticsService,
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
    const projectId = searchParams.get('projectId') || undefined;

    const overview = await InteriorDesignAnalyticsService.getDesignStudioOverview(
      tenantId,
      projectId,
    );

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
    const body = await request.json().catch(() => ({}));
    const tenantId =
      body.tenantId ||
      request.headers.get('x-tenant-id') ||
      'tenant-bella-interior-default';
    const versionId = body.versionId || 'rev-r1-0';
    const targetState = body.targetState !== undefined ? Boolean(body.targetState) : undefined;

    const updatedLock = await InteriorDesignAnalyticsService.toggleDesignLock(
      tenantId,
      versionId,
      targetState,
    );

    return NextResponse.json(
      {
        success: true,
        data: updatedLock,
      },
      { status: 200 },
    );
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
