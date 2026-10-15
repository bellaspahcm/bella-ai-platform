import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve('supabase/migrations/20261015020000_create_automove_post_sale_receipts.sql'), 'utf8');
it('adds only the approved operational receipt relation with immutable, tenant-bound authority', () => {
  expect([...sql.matchAll(/CREATE TABLE public\.(\w+)/g)].map(match => match[1])).toEqual(['auto_vehicle_sale_payments']);
  for (const fragment of ['UNIQUE (tenant_id,idempotency_key)', 'BEFORE INSERT OR UPDATE OR DELETE',
    "u.role='accountant'", "u.status='active'", "t.status='active'", 'received_by=auth.uid()',
    'ENABLE ROW LEVEL SECURITY', 'FOR SELECT TO authenticated', 'FOR INSERT TO authenticated',
    'recognition_row.receivable_amount_at_recognition', 'FOR UPDATE', 'deposit_total+payment_total+NEW.amount',
    'RAISE EXCEPTION', "TG_OP <> 'INSERT'"]) expect(sql).toContain(fragment);
  expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE)\s|ALTER TABLE public\.(?!auto_vehicle_sale_payments)/i);
  expect(sql).not.toMatch(/INSERT INTO (?:public\.)?(?:auto_deposits|auto_vehicle_sale_recognitions|finance_\w+|accounting_outbox)/i);
  expect(sql).not.toMatch(/GRANT[^;]+(?:UPDATE|DELETE|TRUNCATE)[^;]+TO\s+authenticated/i);
});
