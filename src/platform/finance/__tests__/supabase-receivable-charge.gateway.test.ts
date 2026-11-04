import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { SupabaseReceivableChargeGateway } from '../gateways/supabase-receivable-charge.gateway';

describe('SupabaseReceivableChargeGateway F3 execution boundary', () => {
  const input = {
    tenantId: '11111111-1111-4111-8111-111111111111',
    customerId: '22222222-2222-4222-8222-222222222222',
    invoiceNumber: 'F3-GATEWAY-TEST',
    currency: 'VND',
    issueDate: '2026-11-03',
    dueDate: '2026-11-30',
  };

  it('routes authenticated writes through the actor and tenant checked wrapper', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: 'invoice-id', error: null });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    const gateway = new SupabaseReceivableChargeGateway(client, 'authenticated');

    await expect(gateway.createDraftInvoice(input)).resolves.toBe('invoice-id');

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('finance_authenticated_create_draft_invoice', {
      p_tenant_id: input.tenantId,
      p_customer_id: input.customerId,
      p_invoice_number: input.invoiceNumber,
      p_currency: input.currency,
      p_issue_date: input.issueDate,
      p_due_date: input.dueDate,
    });
  });

  it('keeps trusted server execution on the internal F3 command', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: 'invoice-id', error: null });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    const gateway = new SupabaseReceivableChargeGateway(client, 'service_role');

    await expect(gateway.createDraftInvoice(input)).resolves.toBe('invoice-id');

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('finance_create_draft_invoice', {
      p_tenant_id: input.tenantId,
      p_customer_id: input.customerId,
      p_invoice_number: input.invoiceNumber,
      p_currency: input.currency,
      p_issue_date: input.issueDate,
      p_due_date: input.dueDate,
    });
  });
});
