import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261015060000_record_automove_refunds_and_cancellations.sql'), 'utf8');
it('creates only operational append-only facts with stable tenant keys and receipt references', () => {
  expect(sql.match(/CREATE TABLE /g)).toHaveLength(1);
  expect(sql).toContain('UNIQUE(tenant_id,idempotency_key)');
  expect(sql).toContain('source_deposit_id UUID REFERENCES public.auto_deposits(id)');
  expect(sql).toContain('source_payment_id UUID REFERENCES public.auto_vehicle_sale_payments(id)');
  expect(sql).toContain('FOR UPDATE'); expect(sql).toContain('returned_amount+NEW.amount > original_amount');
  expect(sql).toContain("TG_OP <> 'INSERT'");
  expect(sql).not.toMatch(/UPDATE\s+public\.(auto_deposits|auto_vehicle_sale_recognitions)|INSERT INTO\s+public\.(finance_|accounting_outbox)/i);
});
it('limits authenticated access to current accountant SELECT and keeps writes server-owned', () => {
  expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
  expect(sql).toContain('GRANT SELECT ON public.auto_vehicle_sale_settlement_actions TO authenticated');
  expect(sql).toContain('GRANT SELECT,INSERT ON public.auto_vehicle_sale_settlement_actions TO service_role');
  expect(sql).not.toMatch(/GRANT\s+(?:ALL|[^;]*\b(?:INSERT|UPDATE|DELETE)\b)[^;]*\bTO authenticated/);
  expect(sql).toContain("NEW.created_by IS DISTINCT FROM auth.uid()");
  expect(sql).toContain("u.role='accountant'"); expect(sql).toContain("t.status='active'");
});
