/**
 * Bella Interior OS — CRM Customer Contacts API Route
 *
 * GET  /api/interior/crm/customers/[id]/contacts — List all contacts of a customer
 * POST /api/interior/crm/customers/[id]/contacts — Add new contact to customer
 *
 * @module src/app/api/interior/crm/customers/[id]/contacts/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseCustomerRepository } from '@/products/bella-interior/repositories/crm/supabase-customer.repository';
import type { ContactRole } from '@/products/bella-interior/domain/crm/customer.types';
import { CustomerPrimaryContactConflictError } from '@/products/bella-interior/domain/crm/customer-errors';

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
    const contacts = await customerRepo.listContacts(ctx.tenantId, customerId);

    return NextResponse.json(
      { success: true, data: contacts },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'INTERIOR_CUSTOMER_CONTACTS_LIST_FAILED';
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
    if (!body || typeof body !== 'object' || !body.name || !body.phone) {
      return NextResponse.json(
        { success: false, error: 'INVALID_CONTACT_INPUT: name and phone are required' },
        { status: 400 }
      );
    }

    const customerRepo = new SupabaseCustomerRepository(ctx.supabase);
    const contact = await customerRepo.addContact(ctx.tenantId, customerId, {
      name: body.name.trim(),
      role: (body.role as ContactRole) || 'occupant',
      phone: body.phone.trim(),
      email: body.email?.trim(),
      position: body.position?.trim(),
      isPrimary: Boolean(body.isPrimary),
    });

    return NextResponse.json(
      { success: true, data: contact },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'INTERIOR_CUSTOMER_CONTACT_ADD_FAILED';
    const status = err instanceof CustomerPrimaryContactConflictError
      ? 409
      : message.includes('Customer not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
