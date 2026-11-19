/**
 * Bella Interior OS — CRM Customers API Route
 *
 * GET  /api/interior/crm/customers — Paginated Customer Overview with KPIs & Filters
 * POST /api/interior/crm/customers — Create new Customer Profile
 *
 * @module src/app/api/interior/crm/customers/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseCustomerRepository } from '@/products/bella-interior/repositories/crm/supabase-customer.repository';
import { SupabaseInteriorRepository } from '@/products/bella-interior/repositories/supabase.repository';
import { Customer360AggregatorService } from '@/products/bella-interior/services/crm/customer-360-aggregator.service';
import type { CustomerType, CustomerTier, CustomerProfileStatus } from '@/products/bella-interior/domain/crm/customer.types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await resolveInteriorContext(request);
    if (!ctx.ok) return ctx.response;

    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20;
    const search = searchParams.get('search') || undefined;
    const type = (searchParams.get('type') as CustomerType) || undefined;
    const tier = (searchParams.get('tier') as CustomerTier) || undefined;
    const profileStatus = (searchParams.get('profileStatus') as CustomerProfileStatus) || undefined;
    const hasDebt = searchParams.has('hasDebt') ? searchParams.get('hasDebt') === 'true' : undefined;

    const customerRepo = new SupabaseCustomerRepository(ctx.supabase);
    const interiorRepo = new SupabaseInteriorRepository(ctx.supabase);
    const aggregator = new Customer360AggregatorService(customerRepo, interiorRepo);

    const result = await aggregator.listCustomersOverview(ctx.tenantId, {
      page,
      limit,
      search,
      type,
      tier,
      profileStatus,
      hasDebt,
    });

    return NextResponse.json(
      { success: true, data: result },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'INTERIOR_CRM_CUSTOMER_LIST_FAILED';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await resolveInteriorContext(request);
    if (!ctx.ok) return ctx.response;

    const body = await request.json();
    if (!body || typeof body !== 'object' || !body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: 'INVALID_CUSTOMER_INPUT: name is required and non-empty' },
        { status: 400 }
      );
    }

    const customerRepo = new SupabaseCustomerRepository(ctx.supabase);
    const customer = await customerRepo.create(ctx.tenantId, {
      code: body.code,
      name: body.name.trim(),
      legalName: body.legalName,
      taxCode: body.taxCode,
      type: body.type,
      tier: body.tier,
      primaryPhone: body.primaryPhone,
      primaryEmail: body.primaryEmail,
      notes: body.notes,
      assignedStaffId: body.assignedStaffId,
    });

    return NextResponse.json(
      { success: true, data: customer },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'INTERIOR_CRM_CUSTOMER_CREATE_FAILED';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
