import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { resolveTenantProject } from '@/products/bella-interior/lib/project-resolver';
import { validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import { ManufacturingInstallationService } from '@/products/bella-interior/services/manufacturing-installation.service';
import {
  ApprovedDesignLockViolationError,
  TenantIsolationViolationError,
} from '@/products/bella-interior/domain/errors';
import type { WorkshopMode } from '@/products/bella-interior/domain/manufacturing-install/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const projectIdParam = request.nextUrl.searchParams.get('projectId');
  const projectResult = await resolveTenantProject(ctx.supabase, ctx.tenantId, projectIdParam);

  if (!projectResult.ok && projectResult.error === 'AMBIGUOUS_PROJECT_SELECTION') {
    return NextResponse.json({
      success: false,
      error: projectResult.error,
      message: projectResult.message,
      availableProjects: projectResult.availableProjects,
    }, { status: 400 });
  }

  const effectiveProjectId = projectResult.ok ? projectResult.projectId : undefined;

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    const orders = await repo.listProductionOrders(ctx.tenantId, effectiveProjectId);

    return NextResponse.json(
      {
        success: true,
        data: {
          orders,
          total: orders.length,
        },
      },
      {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to retrieve production orders';
    return NextResponse.json(
      { success: false, error: 'INTERIOR_PRODUCTION_ORDERS_LOOKUP_FAILED', message: msg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const designRevisionId = typeof body.designRevisionId === 'string' ? body.designRevisionId.trim() : '';
  const boqId = typeof body.boqId === 'string' ? body.boqId.trim() : '';
  const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim() : '';
  const rawMode = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : 'in_house';
  const workshopManagerName = typeof body.workshopManagerName === 'string' ? body.workshopManagerName.trim() : '';
  const scheduledStartDate = typeof body.scheduledStartDate === 'string' ? body.scheduledStartDate.trim() : '';
  const scheduledCompletionDate = typeof body.scheduledCompletionDate === 'string' ? body.scheduledCompletionDate.trim() : '';
  const subcontractorName = typeof body.subcontractorName === 'string' ? body.subcontractorName.trim() : undefined;

  if (!validInteriorUuid(projectId)) {
    return NextResponse.json({ success: false, error: 'projectId must be a valid UUID' }, { status: 400 });
  }
  if (!validInteriorUuid(designRevisionId)) {
    return NextResponse.json({ success: false, error: 'designRevisionId must be a valid UUID' }, { status: 400 });
  }
  if (!validInteriorUuid(boqId)) {
    return NextResponse.json({ success: false, error: 'boqId must be a valid UUID' }, { status: 400 });
  }
  if (!orderNumber) {
    return NextResponse.json({ success: false, error: 'orderNumber is required' }, { status: 400 });
  }
  if (!workshopManagerName) {
    return NextResponse.json({ success: false, error: 'workshopManagerName is required' }, { status: 400 });
  }
  if (!scheduledStartDate || !scheduledCompletionDate) {
    return NextResponse.json({ success: false, error: 'scheduledStartDate and scheduledCompletionDate are required' }, { status: 400 });
  }

  let mode: WorkshopMode = 'in_house';
  if (rawMode === 'outsourced' || rawMode === 'subcontractor') {
    mode = 'outsourced';
  } else if (rawMode === 'in_house') {
    mode = 'in_house';
  } else {
    return NextResponse.json({ success: false, error: 'mode must be either "in_house" or "outsourced"' }, { status: 400 });
  }

  try {
    const repo = new SupabaseInteriorRepository(ctx.supabase as unknown as SupabaseClient);
    const service = new ManufacturingInstallationService(repo);

    const order = await service.issueProductionOrder({
      tenantId: ctx.tenantId,
      projectId,
      designRevisionId,
      boqId,
      orderNumber,
      mode,
      workshopManagerName,
      scheduledStartDate,
      scheduledCompletionDate,
      subcontractorName,
    });

    return NextResponse.json(
      {
        success: true,
        data: { order },
      },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (error) {
    if (error instanceof ApprovedDesignLockViolationError) {
      return NextResponse.json(
        {
          success: false,
          error: 'INTERIOR_PRODUCTION_APPROVED_DESIGN_LOCK_VIOLATION',
          message: error.message,
        },
        { status: 422 }
      );
    }
    if (error instanceof TenantIsolationViolationError) {
      return NextResponse.json(
        {
          success: false,
          error: 'INTERIOR_TENANT_ISOLATION_VIOLATION',
          message: error.message,
        },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        {
          success: false,
          error: 'INTERIOR_RESOURCE_NOT_FOUND',
          message: error.message,
        },
        { status: 404 }
      );
    }

    const msg = error instanceof Error ? error.message : 'Failed to issue production order';
    return NextResponse.json(
      {
        success: false,
        error: 'INTERIOR_PRODUCTION_ORDER_CREATION_FAILED',
        message: msg,
      },
      { status: 500 }
    );
  }
}
