/**
 * Bella Interior OS — CRM Customer Addresses API Route
 *
 * GET  /api/interior/crm/customers/[id]/addresses — List all addresses of a customer
 * POST /api/interior/crm/customers/[id]/addresses — Add new address to customer
 *
 * @module src/app/api/interior/crm/customers/[id]/addresses/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseCustomerRepository } from '@/products/bella-interior/repositories/crm/supabase-customer.repository';
import type { AddressType } from '@/products/bella-interior/domain/crm/customer.types';

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
    const customerId = params?.id?.trim();
    if (!customerId) {
      return NextResponse.json({ success: false, error: 'CUSTOMER_ID_REQUIRED' }, { status: 400 });
    }

    const customerRepo = new SupabaseCustomerRepository(ctx.supabase);
    const addresses = await customerRepo.listAddresses(ctx.tenantId, customerId);

    return NextResponse.json(
      { success: true, data: addresses },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'INTERIOR_CUSTOMER_ADDRESSES_LIST_FAILED';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  segmentData: RouteParams
): Promise<NextResponse> {
  try {
    const ctx = await resolveInteriorContext(request);
    if (!ctx.ok) return ctx.response;

    const params = await segmentData.params;
    const customerId = params?.id?.trim();
    if (!customerId) {
      return NextResponse.json({ success: false, error: 'CUSTOMER_ID_REQUIRED' }, { status: 400 });
    }

    const body = await request.json();
    if (!body || typeof body !== 'object' || !body.fullAddress || !body.city) {
      return NextResponse.json(
        { success: false, error: 'INVALID_ADDRESS_INPUT: fullAddress and city are required' },
        { status: 400 }
      );
    }

    const customerRepo = new SupabaseCustomerRepository(ctx.supabase);
    const address = await customerRepo.addAddress(ctx.tenantId, customerId, {
      addressType: (body.addressType as AddressType) || 'site_location',
      fullAddress: body.fullAddress.trim(),
      ward: body.ward?.trim(),
      district: body.district?.trim(),
      city: body.city.trim(),
      isDefault: Boolean(body.isDefault),
    });

    return NextResponse.json(
      { success: true, data: address },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'INTERIOR_CUSTOMER_ADDRESS_ADD_FAILED';
    const status = message.includes('Customer not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
