/**
 * Bella Interior OS — Design Studio Canonical API Route
 *
 * GET /api/interior/design
 * POST /api/interior/design
 * DELETE /api/interior/design
 *
 * Canonical endpoint for retrieving and mutating Design Studio data:
 * - Project Header & Sub-navigation tabs (Villa Sunrise Renovation INT-2024-001)
 * - Approved Design Lock strip (R1.0, Approval metadata, lock status)
 * - 3D Perspectives Visual Gallery with primary view and thumbnail angles
 * - 2D Technical CAD Drawings (DWG / PDF / DXF)
 * - Material & Specification Cards (Veneer Óc Chó, Đá Thạch Anh, Bản Lề, Khung Nhôm Slim)
 * - Ingestion of new 2D technical drawings and 3D perspectives to intermediate store
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
  type CreateVisualPerspectiveInput,
  type CreateTechnicalDrawingInput,
  type CreateDesignDocumentInput,
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

    const action = body.action || 'toggle_lock';

    // ─── Action: Add 3D Visual Perspective ───
    if (action === 'add_visual') {
      const input: CreateVisualPerspectiveInput = {
        title: body.title,
        roomZone: body.roomZone,
        imageUrl: body.imageUrl,
        thumbnailUrl: body.thumbnailUrl || body.imageUrl,
        isPrimary: Boolean(body.isPrimary),
        viewAngleName: body.viewAngleName,
        resolution: body.resolution,
        fileFormat: body.fileFormat,
        authorName: body.authorName,
      };

      const newVisual = InteriorDesignAnalyticsService.addVisualPerspective(tenantId, input);
      return NextResponse.json(
        {
          success: true,
          action: 'add_visual',
          data: newVisual,
        },
        { status: 201 },
      );
    }

    // ─── Action: Add 2D Technical Drawing ───
    if (action === 'add_drawing') {
      const input: CreateTechnicalDrawingInput = {
        title: body.title,
        drawingCode: body.drawingCode,
        fileType: body.fileType,
        author: body.author,
        fileUrl: body.fileUrl,
        fileSize: body.fileSize,
        statusLabel: body.statusLabel,
      };

      const newDrawing = InteriorDesignAnalyticsService.addTechnicalDrawing(tenantId, input);
      return NextResponse.json(
        {
          success: true,
          action: 'add_drawing',
          data: newDrawing,
        },
        { status: 201 },
      );
    }

    // ─── Action: Add Technical Document ───
    if (action === 'add_document') {
      const input: CreateDesignDocumentInput = {
        title: body.title,
        documentCategory: body.documentCategory,
        fileType: body.fileType,
        author: body.author,
        fileSize: body.fileSize,
        fileUrl: body.fileUrl,
      };

      const newDoc = InteriorDesignAnalyticsService.addDesignDocument(tenantId, input);
      return NextResponse.json(
        {
          success: true,
          action: 'add_document',
          data: newDoc,
        },
        { status: 201 },
      );
    }

    // ─── Action: Toggle Design Lock (Default) ───
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
        action: 'toggle_lock',
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

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const body = await request.json().catch(() => ({}));

    const tenantId =
      searchParams.get('tenantId') ||
      body.tenantId ||
      request.headers.get('x-tenant-id') ||
      'tenant-bella-interior-default';

    const type = searchParams.get('type') || body.type;
    const id = searchParams.get('id') || body.id;

    if (!id || !type) {
      return NextResponse.json(
        { success: false, error: 'MISSING_PARAMS', message: 'Cần id và type (visual | drawing)' },
        { status: 400 },
      );
    }

    let deleted = false;
    if (type === 'visual') {
      deleted = InteriorDesignAnalyticsService.deleteVisualPerspective(tenantId, id);
    } else if (type === 'drawing') {
      deleted = InteriorDesignAnalyticsService.deleteTechnicalDrawing(tenantId, id);
    }

    return NextResponse.json(
      {
        success: true,
        type,
        id,
        deleted,
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
