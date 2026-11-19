/**
 * Bella Interior OS — CRM Customer Address Item API Route
 *
 * PATCH  /api/interior/crm/customers/[id]/addresses/[addressId] — Update address
 * DELETE /api/interior/crm/customers/[id]/addresses/[addressId] — Remove address
 *
 * @module src/app/api/interior/crm/customers/[id]/addresses/[addressId]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseCustomerRepository } from '@/products/bella-interior/repositories/crm/supabase-customer.repository';
import type { AddressType } from '@/products/bella-interior/domain/crm/customer.types';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string; addressId: string }>;
}

export async function PATCH(
  request: NextRequest,
  segmentData: RouteParams
): Promise<NextResponse> {
  try {
    const ctx = await resolveInteriorContext(request);
    if (!ctx.ok) return ctx.response;

    const params = await segmentData.params;
    const addressId = params?.addressId?.trim();
    if (!addressId) {
      return NextResponse.json({ success: false, error: 'ADDRESS_ID_REQUIRED' }, { status: 400 });
    }

    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'INVALID_REQUEST_BODY' }, { status: 400 });
    }

    const customerRepo = new SupabaseCustomerRepository(ctx.supabase);
    const updated = await customerRepo.updateAddress(ctx.tenantId, addressId, {
      addressType: body.addressType as AddressType | undefined,
      fullAddress: body.fullAddress ? body.fullAddress.trim() : undefined,
      ward: body.ward !== undefined ? body.ward?.trim() : undefined,
      district: body.district !== undefined ? body.district?.trim() : undefined,
      city: body.city ? body.city.trim() : undefined,
      isDefault: body.isDefault !== undefined ? Boolean(body.isDefault) : undefined,
    });

    return NextResponse.json(
      { success: true, data: updated },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'INTERIOR_CUSTOMER_ADDRESS_UPDATE_FAILED';
    const status = message.includes('not found') ? 404 : 500;
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
    const addressId = params?.addressId?.trim();
    if (!addressId) {
      return NextResponse.json({ success: false, error: 'ADDRESS_ID_REQUIRED' }, { status: 400 });
    }

    const customerRepo = new SupabaseCustomerRepository(ctx.supabase);
    const removed = await customerRepo.removeAddress(ctx.tenantId, addressId);

    return NextResponse.json(
      { success: true, data: { deleted: removed, id: addressId } },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'INTERIOR_CUSTOMER_ADDRESS_DELETE_FAILED';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
