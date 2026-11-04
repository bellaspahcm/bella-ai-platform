import { createClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import { SemanticReceivableChargeService } from '@/platform/finance/services/semantic-receivable-charge.service';
import { SupabaseReceivableChargeGateway } from '@/platform/finance/gateways/supabase-receivable-charge.gateway';
import type { Database } from '@/types/database.types';

export interface ConfirmedBookingPaymentFinanceAllocationInput {
  readonly tenantId: string;
  readonly bookingId: string;
  readonly revenueId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly paymentMethod: string;
  readonly receivedAt: string;
  readonly idempotencyKey: string;
  readonly description: string;
}

export async function allocateConfirmedBookingPaymentToFinanceAr(
  input: ConfirmedBookingPaymentFinanceAllocationInput,
) {
  const { url, adminKey } = requireSupabaseAdminEnv();
  const supabase = createClient<Database>(url, adminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const service = new SemanticReceivableChargeService(
    new SupabaseReceivableChargeGateway(supabase, 'service_role'),
  );

  return service.allocateConfirmedPaymentToReceivables({
    tenantId: input.tenantId,
    paymentSourceType: 'REVENUE',
    paymentSourceId: input.revenueId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    paymentMethod: input.paymentMethod,
    receivedAt: input.receivedAt,
    idempotencyKey: input.idempotencyKey,
    description: input.description,
    receivableMatch: {
      bookingId: input.bookingId,
    },
  });
}
