/** Opt-in diagnostic of existing Finance behavior. No runtime/schema repair or cleanup. */
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import type { Database } from '@/types/database.types';
import { PartyRegistrationContractImpl } from '@/platform/party/registration.contract.impl';
import { PaymentReconciliationService } from '../finance/services/payment-reconciliation.service';
import { PreschoolFinanceRepository } from '../finance/repositories/preschool-finance.repository';

jest.mock('@/lib/supabase-server', () => ({ createClient: () => { throw new Error('Explicit local client required'); } }));

const realDb = process.env.PRESCHOOL_FINANCE_FAILURE_REAL_DB === '1' ? describe : describe.skip;
type FailurePoint = 'before-ledger' | 'after-ledger' | 'after-payment' | 'after-invoice';
const fault = 'CONTROLLED_FINANCE_FAILURE';

realDb('Preschool existing Finance failure contract — actual isolated DB', () => {
  let pg: Client;
  let repo: PreschoolFinanceRepository;
  let tenantId: string;
  let actorId: string;
  let studentPartyId: string;
  let payerPartyId: string;
  let billingPeriodId: string;
  let nonFinancialBefore: unknown;
  const observations: Record<string, unknown>[] = [];

  async function nonFinancial() {
    return (await pg.query(`SELECT jsonb_build_object(
      'parties',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') FROM public.party_parties p WHERE tenant_id=$1),
      'students',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.student_id),'[]') FROM public.students s WHERE tenant_id=$1),
      'enrollments',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]') FROM public.edu_enrollments e WHERE tenant_id=$1)
    ) AS state`, [tenantId])).rows[0].state as unknown;
  }

  async function financial(invoiceId: string, paymentId: string) {
    return (await pg.query(`SELECT jsonb_build_object(
      'invoice',(SELECT to_jsonb(i) FROM public.edu_fin_invoices i WHERE id=$1 AND tenant_id=$3),
      'payment',(SELECT to_jsonb(p) FROM public.edu_fin_payments p WHERE id=$2 AND tenant_id=$3),
      'ledger',(SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.id),'[]') FROM public.edu_fin_reconciliation_ledger l WHERE invoice_id=$1 AND tenant_id=$3),
      'receipts',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]') FROM public.edu_fin_receipts r WHERE invoice_id=$1 AND tenant_id=$3)
    ) AS state`, [invoiceId, paymentId, tenantId])).rows[0].state as unknown;
  }

  async function createCase() {
    const invoiceId = randomUUID();
    const paymentId = randomUUID();
    await pg.query(`INSERT INTO public.edu_fin_invoices
      (id,tenant_id,student_party_id,billing_period_id,invoice_number,invoice_status,settlement_status,gross_amount,net_amount,paid_amount,outstanding_amount,due_date,created_by)
      VALUES($1,$2,$3,$4,$5,'ISSUED','UNPAID',100,100,0,100,'2026-10-31',$6)`,
    [invoiceId, tenantId, studentPartyId, billingPeriodId, 'CONTROLLED-'+invoiceId, actorId]);
    await pg.query(`INSERT INTO public.edu_fin_payments
      (id,tenant_id,payer_party_id,student_party_id,payment_number,amount,allocated_amount,unallocated_amount,created_by)
      VALUES($1,$2,$3,$4,$5,100,0,100,$6)`, [paymentId, tenantId, payerPartyId, studentPartyId, 'CONTROLLED-'+paymentId, actorId]);
    return { tenantId, invoiceId, paymentId, allocationAmount: 40, reconciledByPartyId: payerPartyId };
  }

  beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const dbUrl = process.env.PRESCHOOL_FINANCE_FAILURE_DB_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url !== 'http://127.0.0.1:55421' || !dbUrl || !key) throw new Error('Explicit isolated Finance environment required');
    const target = new URL(dbUrl);
    if (target.hostname !== '127.0.0.1' || target.port !== '55422') throw new Error('REFUSE_NONLOCAL_FINANCE_DB');
    const fixture = JSON.parse(readFileSync('implementation-artifacts/preschool-full-chain/ENROLLMENT_RECOVERY_REAL_DB.json', 'utf8')) as {
      tenantId: string; actorId: string; capacity: { studentPartyId: string };
    };
    ({ tenantId, actorId } = fixture);
    studentPartyId = fixture.capacity.studentPartyId;
    pg = new Client({ connectionString: dbUrl });
    await pg.connect();
    const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    repo = new PreschoolFinanceRepository(db);
    payerPartyId = (await new PartyRegistrationContractImpl(db).registerOrRecoverPerson({
      tenantId, actorId, registrationKey: 'finance-proof-'+randomUUID(), person: { displayName: 'Controlled Non-Production Finance payer' },
    })).partyId;
    billingPeriodId = randomUUID();
    await pg.query(`INSERT INTO public.edu_fin_billing_periods(id,tenant_id,period_name,start_date,end_date,due_date,created_by)
      VALUES($1,$2,'Controlled failure verification','2026-10-01','2026-10-31','2026-10-31',$3)`, [billingPeriodId, tenantId, actorId]);
    nonFinancialBefore = await nonFinancial();
  }, 30000);

  afterAll(async () => {
    if (!pg) return;
    try {
      const after = await nonFinancial();
      const evidence = { capturedAt: new Date().toISOString(), target: 'isolated local API55421 / DB55422',
        baseline: 'Existing Finance runtime unchanged; canonical schema provisioned for verification only',
        sourceSha256: createHash('sha256').update(readFileSync('src/products/bella-education/finance/services/payment-reconciliation.service.ts')).digest('hex'),
        tenantId, actorId, studentPartyId, payerPartyId, billingPeriodId, observations,
        nonFinancialUnchanged: JSON.stringify(after) === JSON.stringify(nonFinancialBefore), nonFinancialBefore, nonFinancialAfter: after,
        financialRollbackGate: observations.every(row => row.atomicOnFailure !== false) ? 'PASS_FOR_EXECUTED_CASES' : 'FAIL',
        retention: 'All canonical identities, admissions and Finance history retained; no deletion, compensation invention or runtime repair',
      };
      writeFileSync('implementation-artifacts/preschool-full-chain/FINANCE_FAILURE_REAL_DB.json', JSON.stringify(evidence, null, 2));
    } finally { await pg.end(); }
  });

  it('success reconciles actual payment/invoice and creates one ledger/receipt with canonical identity', async () => {
    const input = await createCase();
    const result = await new PaymentReconciliationService(repo).reconcilePaymentToInvoice(input);
    const after = await financial(input.invoiceId, input.paymentId);
    observations.push({ point: 'success', input, after, receiptId: result.receipt.id });
    expect(result.updatedSettlementStatus).toBe('PARTIALLY_PAID');
    expect((after as { ledger: unknown[]; receipts: unknown[] }).ledger).toHaveLength(1);
    expect((after as { receipts: unknown[] }).receipts).toHaveLength(1);
    expect(await nonFinancial()).toEqual(nonFinancialBefore);
  });

  it.each<FailurePoint>(['before-ledger', 'after-ledger', 'after-payment', 'after-invoice'])(
    '%s must leave no partial financial recording and preserve non-financial data', async (point) => {
      const input = await createCase();
      const before = await financial(input.invoiceId, input.paymentId);
      const method = point === 'before-ledger' || point === 'after-ledger' ? 'addReconciliationEntry'
        : point === 'after-payment' ? 'updatePaymentAllocation' : 'updateInvoiceStatus';
      const original = repo[method].bind(repo);
      // Typed individual spies invoke the actual repository write, then lose acknowledgement.
      const spy = point === 'before-ledger' ? jest.spyOn(repo, 'addReconciliationEntry').mockRejectedValueOnce(new Error(fault))
        : method === 'addReconciliationEntry' ? jest.spyOn(repo, 'addReconciliationEntry').mockImplementationOnce(async (data) => {
          await (original as PreschoolFinanceRepository['addReconciliationEntry'])(data); throw new Error(fault);
        })
        : method === 'updatePaymentAllocation' ? jest.spyOn(repo, 'updatePaymentAllocation').mockImplementationOnce(async (...args) => {
          await (original as PreschoolFinanceRepository['updatePaymentAllocation'])(...args); throw new Error(fault);
        })
        : jest.spyOn(repo, 'updateInvoiceStatus').mockImplementationOnce(async (...args) => {
          await (original as PreschoolFinanceRepository['updateInvoiceStatus'])(...args); throw new Error(fault);
        });
      try {
        await expect(new PaymentReconciliationService(repo).reconcilePaymentToInvoice(input)).rejects.toThrow(fault);
      } finally { spy.mockRestore(); }
      const after = await financial(input.invoiceId, input.paymentId);
      observations.push({ point, input, before, after, atomicOnFailure: JSON.stringify(before) === JSON.stringify(after) });
      expect(await nonFinancial()).toEqual(nonFinancialBefore);
      expect(after).toEqual(before);
    }, 30000,
  );
});
