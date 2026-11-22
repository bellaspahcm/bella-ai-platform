/**
 * Bella Interior OS — CRM Customer Contact Item API Route
 *
 * PATCH  /api/interior/crm/customers/[id]/contacts/[contactId] — Update contact details
 * DELETE /api/interior/crm/customers/[id]/contacts/[contactId] — Remove contact
 *
 * @module src/app/api/interior/crm/customers/[id]/contacts/[contactId]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseCustomerRepository } from '@/products/bella-interior/repositories/crm/supabase-customer.repository';
import type { ContactRole } from '@/products/bella-interior/domain/crm/customer.types';
import { CustomerPrimaryContactConflictError } from '@/products/bella-interior/domain/crm/customer-errors';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string; contactId: string }>;
}

export async function PATCH(
  request: NextRequest,
  segmentData: RouteParams
): Promise<NextResponse> {
  try {
    const ctx = await resolveInteriorContext(request);
    if (!ctx.ok) return ctx.response;

    const params = await segmentData.params;
    const contactId = params?.contactId?.trim();
    if (!contactId) {
      return NextResponse.json({ success: false, error: 'CONTACT_ID_REQUIRED' }, { status: 400 });
    }

    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'INVALID_REQUEST_BODY' }, { status: 400 });
    }

    const customerRepo = new SupabaseCustomerRepository(ctx.supabase);
    const updated = await customerRepo.updateContact(ctx.tenantId, contactId, {
      name: body.name ? body.name.trim() : undefined,
      role: body.role as ContactRole | undefined,
      phone: body.phone ? body.phone.trim() : undefined,
      email: body.email !== undefined ? body.email?.trim() : undefined,
      position: body.position !== undefined ? body.position?.trim() : undefined,
      isPrimary: body.isPrimary !== undefined ? Boolean(body.isPrimary) : undefined,
    });

    return NextResponse.json(
      { success: true, data: updated },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'INTERIOR_CUSTOMER_CONTACT_UPDATE_FAILED';
    const status = err instanceof CustomerPrimaryContactConflictError ? 409 : message.includes('not found') ? 404 : 500;
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
    const contactId = params?.contactId?.trim();
    if (!contactId) {
      return NextResponse.json({ success: false, error: 'CONTACT_ID_REQUIRED' }, { status: 400 });
    }

    const customerRepo = new SupabaseCustomerRepository(ctx.supabase);
    const removed = await customerRepo.removeContact(ctx.tenantId, contactId);

    return NextResponse.json(
      { success: true, data: { deleted: removed, id: contactId } },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'INTERIOR_CUSTOMER_CONTACT_DELETE_FAILED';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
