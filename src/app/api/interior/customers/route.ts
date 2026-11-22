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
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorRbacRpcClient, isInteriorRbacRecord } from '@/products/bella-interior/lib/rbac-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await resolveInteriorContext(request);
    if (!ctx.ok) return ctx.response;

    const { searchParams } = new URL(request.url);
    const isOverviewRequested = searchParams.get('overview') === 'true' || searchParams.get('mode') === 'crm';

    if (isOverviewRequested) {
      try {
        const { SupabaseCustomerRepository } = await import('@/products/bella-interior/repositories/crm/supabase-customer.repository');
        const { SupabaseInteriorRepository } = await import('@/products/bella-interior/repositories/supabase.repository');
        const { Customer360AggregatorService } = await import('@/products/bella-interior/services/crm/customer-360-aggregator.service');

        const customerRepo = new SupabaseCustomerRepository(ctx.supabase);
        const interiorRepo = new SupabaseInteriorRepository(ctx.supabase);
        const aggregator = new Customer360AggregatorService(customerRepo, interiorRepo);

        const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20;
        const search = searchParams.get('search') || undefined;

        const overview = await aggregator.listCustomersOverview(ctx.tenantId, { page, limit, search });
        return NextResponse.json({ success: true, data: overview }, {
          status: 200,
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        });
      } catch {
        // Fall back to RPC aggregation if repository tables are not yet migrated
      }
    }

    const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_list_projects');
    if (error || !Array.isArray(data)) {
      return NextResponse.json({ success: false, error: 'INTERIOR_CUSTOMER_LOOKUP_FAILED' }, { status: 503 });
    }
    const customerMap = new Map<string, { id: string; name: string; projectCount: number }>();
    for (const value of data) {
      if (!isInteriorRbacRecord(value)) continue;
      const customerId = value.customerId;
      if (typeof customerId !== 'string' || !customerId.trim()) continue;
      const name = typeof value.customerName === 'string' ? value.customerName : '';
      const current = customerMap.get(customerId);
      if (current) current.projectCount += 1;
      else customerMap.set(customerId, {
        id: customerId,
        name,
        projectCount: 1,
      });
    }
    const customers = [...customerMap.values()];
    return NextResponse.json({ success: true, data: { customers, total: customers.length } }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'INTERIOR_CUSTOMER_LOOKUP_FAILED' }, { status: 503 });
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

    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const rawStaff = typeof body.assignedStaffId === 'string' ? body.assignedStaffId.trim() : undefined;
    const assignedStaffId = rawStaff && UUID_PATTERN.test(rawStaff) ? rawStaff : undefined;
    let notes = body.notes?.trim() || undefined;
    if (rawStaff && !assignedStaffId) {
      notes = notes ? `${notes} | KTS phụ trách: ${rawStaff}` : `KTS phụ trách: ${rawStaff}`;
    }

    const { SupabaseCustomerRepository } = await import('@/products/bella-interior/repositories/crm/supabase-customer.repository');
    const customerRepo = new SupabaseCustomerRepository(ctx.supabase);

    const customer = await customerRepo.create(ctx.tenantId, {
      code: body.code,
      name: body.name.trim(),
      legalName: body.legalName?.trim() || undefined,
      taxCode: body.taxCode?.trim() || undefined,
      type: body.type || 'individual',
      tier: body.tier || 'standard',
      primaryPhone: (body.primaryPhone || body.phone)?.trim() || undefined,
      primaryEmail: (body.primaryEmail || body.email)?.trim() || undefined,
      notes,
      assignedStaffId,
    });

    // Persist default site address if provided
    const rawAddress = body.address || body.fullAddress;
    const fullAddr = typeof rawAddress === 'string' ? rawAddress.trim() : rawAddress?.fullAddress?.trim();
    if (fullAddr) {
      try {
        await customerRepo.addAddress(ctx.tenantId, customer.id, {
          addressType: 'site_location',
          fullAddress: fullAddr,
          ward: (typeof rawAddress === 'object' ? rawAddress.ward : body.ward)?.trim() || undefined,
          district: (typeof rawAddress === 'object' ? rawAddress.district : body.district)?.trim() || undefined,
          city: (typeof rawAddress === 'object' ? rawAddress.city : body.city)?.trim() || 'TP. Hồ Chí Minh',
          isDefault: true,
        });
      } catch (addrErr) {
        console.warn('[CRM] Failed to add address during customer creation:', addrErr);
      }
    }

    // Persist primary contact entry
    const contactPhone = (body.primaryPhone || body.phone)?.trim();
    if (contactPhone || body.contactName) {
      try {
        await customerRepo.addContact(ctx.tenantId, customer.id, {
          name: body.contactName?.trim() || body.name.trim(),
          role: 'primary_contact',
          phone: contactPhone || '',
          email: (body.primaryEmail || body.email)?.trim() || undefined,
          position: body.contactPosition?.trim() || (body.type === 'enterprise' ? 'Đại diện dự án' : 'Chủ nhà'),
          isPrimary: true,
        });
      } catch (contactErr) {
        console.warn('[CRM] Failed to add contact during customer creation:', contactErr);
      }
    }

    return NextResponse.json(
      { success: true, data: customer },
      { status: 201, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'INTERIOR_CUSTOMER_CREATE_FAILED';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
