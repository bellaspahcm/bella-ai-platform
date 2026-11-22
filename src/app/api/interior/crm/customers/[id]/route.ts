/**
 * Bella Interior OS — Customer 360 Detail API Route
 *
 * GET /api/interior/crm/customers/[id]
 *
 * Retrieves the comprehensive 360-degree customer profile across:
 * - Profile identity, contacts, addresses, and merged aliases
 * - Multi-project portfolio lineage
 * - Commercial lifecycle (quotations, contracts, payments)
 * - Execution progress (site diaries, QC punch lists, production orders)
 * - Handover dossiers and warranty tickets
 * - Read-only financial projections
 * - Chronologically sorted interaction timeline
 *
 * @module src/app/api/interior/crm/customers/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseCustomerRepository } from '@/products/bella-interior/repositories/crm/supabase-customer.repository';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import { Customer360AggregatorService } from '@/products/bella-interior/services/crm/customer-360-aggregator.service';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  segmentData: RouteParams
): Promise<NextResponse> {
  try {
    const ctx = await resolveInteriorContext(request);
    if (!ctx.ok) return ctx.response;

    const params = await segmentData.params;
    const customerId = params?.id;
    if (!customerId || !customerId.trim()) {
      return NextResponse.json({ success: false, error: 'CUSTOMER_ID_REQUIRED' }, { status: 400 });
    }

    const customerRepo = new SupabaseCustomerRepository(ctx.supabase);
    const interiorRepo = new SupabaseInteriorRepository(ctx.supabase);
    const aggregator = new Customer360AggregatorService(customerRepo, interiorRepo);

    const c360 = await aggregator.getCustomer360(ctx.tenantId, customerId.trim());
    if (!c360) {
      return NextResponse.json({ success: false, error: 'CUSTOMER_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, data: c360 },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'INTERIOR_CUSTOMER_360_LOOKUP_FAILED';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  segmentData: RouteParams
): Promise<NextResponse> {
  try {
    const ctx = await resolveInteriorContext(request);
    if (!ctx.ok) return ctx.response;

    const params = await segmentData.params;
    const customerId = params?.id;
    if (!customerId || !customerId.trim()) {
      return NextResponse.json({ success: false, error: 'CUSTOMER_ID_REQUIRED' }, { status: 400 });
    }

    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'INVALID_REQUEST_BODY' }, { status: 400 });
    }

    // Protect Financial Aggregate Fields from direct mutation
    const forbiddenFinancialFields = ['totalContractValue', 'totalPaidAmount', 'receivableDebt', 'debt'];
    for (const field of forbiddenFinancialFields) {
      if (field in body) {
        return NextResponse.json(
          {
            success: false,
            error: `DIRECT_FINANCIAL_MUTATION_PROHIBITED: Cannot mutate financial field '${field}' via CRM profile API.`,
          },
          { status: 400 }
        );
      }
    }

    const customerRepo = new SupabaseCustomerRepository(ctx.supabase);
    const updated = await customerRepo.update(ctx.tenantId, customerId.trim(), {
      name: body.name,
      legalName: body.legalName,
      taxCode: body.taxCode,
      type: body.type,
      tier: body.tier,
      profileStatus: body.profileStatus,
      primaryPhone: body.primaryPhone,
      primaryEmail: body.primaryEmail,
      notes: body.notes,
      assignedStaffId: body.assignedStaffId,
    });

    return NextResponse.json(
      { success: true, data: updated },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'INTERIOR_CUSTOMER_UPDATE_FAILED';
    const status = message.includes('Customer not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  segmentData: RouteParams
): Promise<NextResponse> {
  try {
    const ctx = await resolveInteriorContext(request);
    if (!ctx.ok) return ctx.response;

    const params = await segmentData.params;
    const customerId = params?.id;
    if (!customerId || !customerId.trim()) {
      return NextResponse.json({ success: false, error: 'CUSTOMER_ID_REQUIRED' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';

    // Hard delete is strictly prohibited to preserve historical contracts, projects, and warranties
    if (hardDelete) {
      return NextResponse.json(
        {
          success: false,
          error: 'CUSTOMER_HARD_DELETE_PROHIBITED: Bella Interior preserves all customer historical data. Use archive instead.',
        },
        { status: 400 }
      );
    }

    const customerRepo = new SupabaseCustomerRepository(ctx.supabase);
    const archived = await customerRepo.archive(ctx.tenantId, customerId.trim());
    return NextResponse.json(
      {
        success: true,
        data: {
          archived: true,
          id: customerId.trim(),
          customer: archived,
          profileStatus: 'inactive',
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'INTERIOR_CUSTOMER_DELETE_FAILED';
    const status = message.includes('Customer not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
