import { NextResponse } from 'next/server';
import {
  CustomerAlreadyMergedError,
  CustomerMergeCrossTenantError,
  CustomerMergeCycleDetectedError,
  CustomerMergeRelationshipConflictError,
  CustomerMergeSelfError,
  CustomerNotFoundError,
} from '@/products/bella-interior/domain/crm/customer-errors';
import { validInteriorUuid, interiorJsonBody } from '@/products/bella-interior/lib/rbac-api';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { SupabaseCustomerRepository } from '@/products/bella-interior/repositories/crm/supabase-customer.repository';
import { CustomerMergeService } from '@/products/bella-interior/services/crm/customer-merge.service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const body = await interiorJsonBody(request);
  if (!body || !validInteriorUuid(body.sourceCustomerId) || !validInteriorUuid(body.targetCustomerId)
      || typeof body.reason !== 'string' || !body.reason.trim()) {
    return NextResponse.json(
      { success: false, error: 'VALID_SOURCE_TARGET_AND_REASON_REQUIRED' },
      { status: 400 },
    );
  }

  try {
    const repository = new SupabaseCustomerRepository(ctx.supabase);
    const service = new CustomerMergeService(repository);
    const result = await service.mergeCustomers({
      tenantId: ctx.tenantId,
      sourceCustomerId: body.sourceCustomerId,
      targetCustomerId: body.targetCustomerId,
      reason: body.reason.trim(),
      actorId: ctx.actor.id,
    });
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof CustomerNotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    if (error instanceof CustomerMergeCrossTenantError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (error instanceof CustomerAlreadyMergedError || error instanceof CustomerMergeCycleDetectedError
        || error instanceof CustomerMergeRelationshipConflictError || error instanceof CustomerMergeSelfError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: 'CUSTOMER_MERGE_FAILED' }, { status: 500 });
  }
}
