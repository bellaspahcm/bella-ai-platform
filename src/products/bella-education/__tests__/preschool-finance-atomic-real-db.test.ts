/** Approved Product transaction proof against the retained isolated Non-Production DB. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import type { Database } from '@/types/database.types';
import { PreschoolFinanceRepository } from '../finance/repositories/preschool-finance.repository';
import { PaymentReconciliationService } from '../finance/services/payment-reconciliation.service';
import { canonicalJsonString } from '../finance/services/invoice-issuance.service';

const realDb = process.env.PRESCHOOL_FINANCE_ATOMIC_REAL_DB === '1' ? describe : describe.skip;
const packet = 'implementation-artifacts/preschool-finance-atomic-20261019/FINANCE_ATOMIC_REAL_DB.json';
const phase = process.env.PRESCHOOL_FINANCE_ATOMIC_PHASE ?? 'commit';
type Command = Parameters<PaymentReconciliationService['recordAndReconcilePayment']>[0];
type Result = Awaited<ReturnType<PaymentReconciliationService['recordAndReconcilePayment']>>;
type Evidence = { tenantId: string; actorId: string; accountantId: string; studentPartyId: string;
  payerPartyId: string; billingPeriodId: string; observations: Record<string, unknown>[];
  restart?: { input: Command; ids: string[]; processId: number }; [key: string]: unknown };

realDb('Preschool Finance atomic command — actual isolated PostgreSQL/Auth', () => {
  let pg: Client;
  let db: SupabaseClient<Database>;
  let limited: SupabaseClient<Database>;
  let service: PaymentReconciliationService;
  let tenantId: string;
  let actorId: string;
  let accountantId: string;
  let studentPartyId: string;
  let payerPartyId: string;
  let billingPeriodId: string;
  let evidence: Evidence;
  let nonFinancialBefore: unknown;

  const ids = (result: Result) => [result.payment.id, result.reconciliationEntry.id, result.receipt.id];
  const rpcClient = () => db as unknown as SupabaseClient;
  const request = (input: Command) => ({ kind: 'new-payment', invoiceId: input.invoiceId,
    paymentAmount: input.paymentAmount, paymentMethod: input.paymentMethod });
  async function financial() {
    return (await pg.query(`SELECT jsonb_build_object(
      'invoices',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.edu_fin_invoices t WHERE tenant_id=$1),
      'payments',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.edu_fin_payments t WHERE tenant_id=$1),
      'allocations',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.edu_fin_reconciliation_ledger t WHERE tenant_id=$1),
      'receipts',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.edu_fin_receipts t WHERE tenant_id=$1),
      'operations',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY operation_key),'[]') FROM public.edu_fin_reconciliation_operations t WHERE tenant_id=$1)) AS state`, [tenantId])).rows[0].state as unknown;
  }
  async function nonFinancial() {
    return (await pg.query(`SELECT jsonb_build_object(
      'parties',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.party_parties t),
      'students',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY student_id),'[]') FROM public.students t),
      'enrollments',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.edu_enrollments t)) AS state`)).rows[0].state as unknown;
  }
  async function invoice(amount = 100): Promise<string> {
    const id = randomUUID();
    await pg.query(`INSERT INTO public.edu_fin_invoices
      (id,tenant_id,student_party_id,billing_period_id,invoice_number,invoice_status,settlement_status,gross_amount,net_amount,paid_amount,outstanding_amount,due_date,created_by)
      VALUES($1,$2,$3,$4,$5,'ISSUED','UNPAID',$6,$6,0,$6,'2026-10-31',$7)`,
    [id, tenantId, studentPartyId, billingPeriodId, 'ATOMIC-'+id, amount, actorId]);
    return id;
  }
  async function command(amount = 40): Promise<Command> {
    return { tenantId, actorId, operationKey: randomUUID(), invoiceId: await invoice(),
      paymentAmount: amount, paymentMethod: 'BANK_TRANSFER' };
  }
  async function account(role: 'admin' | 'accountant', accountTenant = tenantId) {
    const password = randomBytes(24).toString('base64url')+'aA1!';
    const email = 'controlled-finance-'+randomUUID()+'@example.invalid';
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error('LOCAL_AUTH_FIXTURE_FAILED');
    await pg.query(`INSERT INTO public.users(id,tenant_id,email,full_name,role,status)
      VALUES($1,$2,$3,'Controlled Finance atomic proof',$4,'active')`, [data.user.id,accountTenant,email,role]);
    return { id: data.user.id, email, password };
  }

  beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const dbUrl = process.env.PRESCHOOL_FINANCE_ATOMIC_DB_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url !== 'http://127.0.0.1:55421' || !dbUrl || !key || !anonKey) throw new Error('LOCAL_FINANCE_ATOMIC_ENV_REQUIRED');
    const target = new URL(dbUrl);
    if (target.hostname !== '127.0.0.1' || target.port !== '55422') throw new Error('REFUSE_NONLOCAL_FINANCE_DB');
    pg = new Client({ connectionString: dbUrl });
    await pg.connect();
    db = createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    service = new PaymentReconciliationService(new PreschoolFinanceRepository(db));
    if (phase === 'restart') {
      evidence = JSON.parse(readFileSync(packet,'utf8')) as Evidence;
      ({ tenantId,actorId,accountantId,studentPartyId,payerPartyId,billingPeriodId } = evidence);
    } else {
      const original = JSON.parse(readFileSync('implementation-artifacts/preschool-full-chain/ADMISSION_REAL_DB.json','utf8')) as {tenantId:string;restartChildId:string};
      tenantId = original.tenantId;
      studentPartyId = original.restartChildId;
      const guardian = await pg.query(`SELECT source_party_id FROM public.party_relationships
        WHERE tenant_id=$1 AND target_party_id=$2 AND relationship_type='guardian_of' ORDER BY id LIMIT 1`, [tenantId,studentPartyId]);
      payerPartyId = guardian.rows[0]?.source_party_id as string;
      if (!payerPartyId) throw new Error('RETAINED_CANONICAL_GUARDIAN_REQUIRED');
      const actor = await account('admin'); actorId=actor.id;
      accountantId = (await account('accountant')).id;
      limited = createClient<Database>(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
      const session = await limited.auth.signInWithPassword({email:actor.email,password:actor.password});
      if (session.error || !session.data.session) throw new Error('REAL_SIGNED_IN_CLIENT_REQUIRED');
      billingPeriodId=randomUUID();
      await pg.query(`INSERT INTO public.edu_fin_billing_periods(id,tenant_id,period_name,start_date,end_date,due_date,created_by)
        VALUES($1,$2,'Controlled atomic Finance verification','2026-10-01','2026-10-31','2026-10-31',$3)`,[billingPeriodId,tenantId,actorId]);
      evidence={tenantId,actorId,accountantId,studentPartyId,payerPartyId,billingPeriodId,observations:[],target:'isolated API55421/DB55422',commitPid:process.pid};
    }
    nonFinancialBefore=await nonFinancial();
  },30000);

  afterAll(async()=>{
    if(!pg)return;
    try {
      const after=await nonFinancial();
      const historical=JSON.parse(readFileSync('implementation-artifacts/preschool-full-chain/FINANCE_FAILURE_REAL_DB.json','utf8')) as {tenantId:string;observations:{point:string;input:{invoiceId:string;paymentId:string};after:unknown}[]};
      const preserved=[];
      for(const row of historical.observations){
        const actual=(await pg.query(`SELECT jsonb_build_object(
          'invoice',(SELECT to_jsonb(t) FROM public.edu_fin_invoices t WHERE id=$1 AND tenant_id=$3),
          'payment',(SELECT to_jsonb(t) FROM public.edu_fin_payments t WHERE id=$2 AND tenant_id=$3),
          'ledger',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.edu_fin_reconciliation_ledger t WHERE invoice_id=$1 AND tenant_id=$3),
          'receipts',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.edu_fin_receipts t WHERE invoice_id=$1 AND tenant_id=$3)) AS state`,[row.input.invoiceId,row.input.paymentId,historical.tenantId])).rows[0].state as unknown;
        expect(actual).toEqual(row.after);
        preserved.push({point:row.point,unchanged:true});
      }
      evidence.nonFinancialUnchanged=canonicalJsonString(after)===canonicalJsonString(nonFinancialBefore);
      expect(after).toEqual(nonFinancialBefore);
      evidence.historicalCasesPreserved=preserved;
      evidence.lastPhase=phase;
      evidence.updatedAt=new Date().toISOString();
      evidence.runtimeSourceSha256=createHash('sha256').update(readFileSync('src/products/bella-education/finance/services/payment-reconciliation.service.ts')).digest('hex');
      writeFileSync(packet,JSON.stringify(evidence,null,2));
    } finally {await pg.end();}
  });

  (phase==='commit'?it:it.skip)('success and same-key recovery return canonical result and canonical receipt SHA',async()=>{
    const input=await command(40.01);
    const result=await service.recordAndReconcilePayment(input);
    expect(result.payment.studentPartyId).toBe(studentPartyId);
    expect(result.payment.payerPartyId).toBe(payerPartyId);
    expect(result.updatedSettlementStatus).toBe('PARTIALLY_PAID');
    expect(result.receipt.sha256Fingerprint).toBe(createHash('sha256').update(canonicalJsonString(result.receipt.settlementSnapshot)).digest('hex'));
    const before=await financial();
    const replay=await service.recordAndReconcilePayment(input);
    expect(ids(replay)).toEqual(ids(result));
    expect(await financial()).toEqual(before);
    evidence.observations.push({point:'success_and_exact_replay',input,ids:ids(result),snapshot:result.receipt.settlementSnapshot,fingerprint:result.receipt.sha256Fingerprint});
  });

  (phase==='commit'?it:it.skip).each([
    ['payment-insert','edu_fin_payments','INSERT'],
    ['allocation-insert','edu_fin_reconciliation_ledger','INSERT'],
    ['payment-update','edu_fin_payments','UPDATE'],
    ['invoice-update','edu_fin_invoices','UPDATE'],
    ['receipt-insert','edu_fin_receipts','INSERT'],
    ['operation-insert','edu_fin_reconciliation_operations','INSERT'],
  ])('%s failure rolls back actual DB writes including newly created payment',async(point,table,event)=>{
    const input=await command();
    const before=await financial();
    await pg.query(`CREATE OR REPLACE FUNCTION public.proof_finance_atomic_fault() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.tenant_id='${tenantId}'::uuid THEN RAISE EXCEPTION 'CONTROLLED_FINANCE_ATOMIC_FAILURE'; END IF; RETURN NEW; END $$`);
    await pg.query(`CREATE TRIGGER proof_finance_atomic_fault AFTER ${event} ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.proof_finance_atomic_fault()`);
    try {await expect(service.recordAndReconcilePayment(input)).rejects.toThrow('CONTROLLED_FINANCE_ATOMIC_FAILURE');}
    finally {await pg.query(`DROP TRIGGER proof_finance_atomic_fault ON public.${table}`);await pg.query('DROP FUNCTION public.proof_finance_atomic_fault()');}
    const after=await financial();
    expect(after).toEqual(before);
    evidence.observations.push({point,input,before,after,atomic:true});
  },30000);

  (phase==='commit'?it:it.skip)('same-key concurrency is one canonical unit; changed payload conflicts',async()=>{
    const input=await command();
    const results=await Promise.all(Array.from({length:6},()=>service.recordAndReconcilePayment(input)));
    expect(new Set(results.map(x=>ids(x).join(':'))).size).toBe(1);
    const before=await financial();
    await expect(service.recordAndReconcilePayment({...input,paymentAmount:41})).rejects.toThrow(/CONFLICT/);
    expect(await financial()).toEqual(before);
    evidence.observations.push({point:'concurrent_same_key_payload_conflict',canonicalIds:ids(results[0]),callers:6});
  });

  (phase==='commit'?it:it.skip)('UUID spelling variants resolve one canonical operation and IDs',async()=>{
    const input=await command();
    const first=await service.recordAndReconcilePayment({...input,tenantId:tenantId.toUpperCase(),actorId:actorId.toUpperCase(),invoiceId:input.invoiceId.toUpperCase()});
    const before=await financial();
    const replay=await service.recordAndReconcilePayment({...input,invoiceId:input.invoiceId.replaceAll('-','')});
    expect(ids(replay)).toEqual(ids(first));expect(await financial()).toEqual(before);
    evidence.observations.push({point:'uuid_spelling_canonical_recovery',ids:ids(first)});
  });

  (phase==='commit'?it:it.skip).each([0.1,40.01,9999999999999.99])('receipt canonical SHA agrees at monetary boundary %s',async(paymentAmount)=>{
    const input:Command={tenantId,actorId,operationKey:randomUUID(),invoiceId:await invoice(paymentAmount),paymentAmount,paymentMethod:'BANK_TRANSFER'};
    const result=await service.recordAndReconcilePayment(input);
    expect(result.updatedSettlementStatus).toBe('PAID');
    expect(result.receipt.sha256Fingerprint).toBe(createHash('sha256').update(canonicalJsonString(result.receipt.settlementSnapshot)).digest('hex'));
    evidence.observations.push({point:'canonical_decimal_boundary',paymentAmount,receiptId:result.receipt.id,fingerprint:result.receipt.sha256Fingerprint});
  });

  (phase==='commit'?it:it.skip)('NaN persisted invoice and orphan receipt fail closed without changing diagnostic fixtures',async()=>{
    const malformed=await invoice(Number.NaN);
    const invalid:Command={tenantId,actorId,operationKey:randomUUID(),invoiceId:malformed,paymentAmount:1,paymentMethod:'BANK_TRANSFER'};
    const beforeNaN=await financial();
    await expect(service.recordAndReconcilePayment(invalid)).rejects.toThrow('FINANCE_CANONICAL_CONFLICT');
    expect(await financial()).toEqual(beforeNaN);
    const orphanInvoice=await invoice();const orphanPayment=randomUUID();
    await pg.query(`INSERT INTO public.edu_fin_payments(id,tenant_id,payer_party_id,student_party_id,payment_number,amount,allocated_amount,unallocated_amount,created_by)
      VALUES($1,$2,$3,$4,$5,100,0,100,$6)`,[orphanPayment,tenantId,payerPartyId,studentPartyId,'CONTROLLED-ORPHAN-'+orphanPayment,actorId]);
    await pg.query(`INSERT INTO public.edu_fin_receipts(tenant_id,payment_id,invoice_id,receipt_number,settlement_snapshot,sha256_fingerprint)
      VALUES($1,$2,$3,$4,'{}',$5)`,[tenantId,orphanPayment,orphanInvoice,'CONTROLLED-ORPHAN-'+randomUUID(),'0'.repeat(64)]);
    const beforeOrphan=await financial();
    await expect(service.recordAndReconcilePayment({...invalid,operationKey:randomUUID(),invoiceId:orphanInvoice})).rejects.toThrow('FINANCE_CANONICAL_CONFLICT');
    expect(await financial()).toEqual(beforeOrphan);
    evidence.observations.push({point:'persisted_nan_and_orphan_receipt_denied',malformedInvoice:malformed,orphanInvoice,noRepairOrMutation:true});
  });

  (phase==='commit'?it:it.skip).each([
    {newInvoicePaidAmount:140,newInvoiceOutstandingAmount:0,settlementStatus:'OVERPAID'},
    {newInvoicePaidAmount:null,newInvoiceOutstandingAmount:0,settlementStatus:'UNPAID'},
  ])('transaction-local damaged receipt totals %j cannot masquerade as canonical recovery',async(damage)=>{
    const input=await command();const result=await service.recordAndReconcilePayment(input);const before=await financial();
    const damaged={...result.receipt.settlementSnapshot,...damage};
    const fingerprint=createHash('sha256').update(canonicalJsonString(damaged)).digest('hex');
    await pg.query('BEGIN');
    try {
      await pg.query('UPDATE public.edu_fin_receipts SET settlement_snapshot=$1,sha256_fingerprint=$2 WHERE id=$3',[damaged,fingerprint,result.receipt.id]);
      await expect(pg.query('SELECT public.preschool_recover_finance_reconciliation($1,$2,$3,$4::jsonb)',[tenantId,actorId,input.operationKey,JSON.stringify(request(input))])).rejects.toThrow('FINANCE_CANONICAL_CONFLICT');
    } finally {await pg.query('ROLLBACK');}
    expect(await financial()).toEqual(before);
    evidence.observations.push({point:'transaction_local_damaged_receipt_recovery_denied',damage,receiptId:result.receipt.id,committedHistoryUnchanged:true,damageTransactionRolledBack:true});
  });

  (phase==='commit'?it:it.skip)('distinct-key contention cannot over-allocate one invoice',async()=>{
    const invoiceId=await invoice();
    const a:Command={tenantId,actorId,operationKey:randomUUID(),invoiceId,paymentAmount:70,paymentMethod:'BANK_TRANSFER'};
    const result=await Promise.allSettled([service.recordAndReconcilePayment(a),service.recordAndReconcilePayment({...a,operationKey:randomUUID()})]);
    expect(result.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    const readBack=await pg.query('SELECT paid_amount,outstanding_amount FROM public.edu_fin_invoices WHERE id=$1',[invoiceId]);
    expect(Number(readBack.rows[0].paid_amount)).toBe(70);expect(Number(readBack.rows[0].outstanding_amount)).toBe(30);
    const facts=await pg.query('SELECT count(*)::int AS count FROM public.edu_fin_reconciliation_ledger WHERE invoice_id=$1',[invoiceId]);
    expect(facts.rows[0].count).toBe(1);
    evidence.observations.push({point:'distinct_key_balance_race',invoiceId,results:result.map(x=>x.status),readBack:readBack.rows});
  });

  (phase==='commit'?it:it.skip)('existing-payment command is atomic and preserves duplicate-pair contract',async()=>{
    const invoiceId=await invoice();const paymentId=randomUUID();
    await pg.query(`INSERT INTO public.edu_fin_payments(id,tenant_id,payer_party_id,student_party_id,payment_number,amount,allocated_amount,unallocated_amount,created_by)
      VALUES($1,$2,$3,$4,$5,100,0,100,$6)`,[paymentId,tenantId,payerPartyId,studentPartyId,'ATOMIC-EXISTING-'+paymentId,actorId]);
    const input={tenantId,paymentId,invoiceId,allocationAmount:40,reconciledByPartyId:actorId};
    const result=await service.reconcilePaymentToInvoice(input);
    const before=await financial();
    await expect(service.reconcilePaymentToInvoice({...input,allocationAmount:20})).rejects.toThrow('DUPLICATE_RECONCILIATION_ERROR');
    expect(await financial()).toEqual(before);
    evidence.observations.push({point:'legacy_existing_payment_duplicate_contract',invoiceId,paymentId,receiptId:result.receipt.id});
  });

  (phase==='commit'?it:it.skip)('canonical student mismatch is rejected by actual DB with no financial mutation',async()=>{
    const invoiceId=await invoice();const paymentId=randomUUID();
    await pg.query(`INSERT INTO public.edu_fin_payments(id,tenant_id,payer_party_id,student_party_id,payment_number,amount,allocated_amount,unallocated_amount,created_by)
      VALUES($1,$2,$3,$3,$4,100,0,100,$5)`,[paymentId,tenantId,payerPartyId,'ATOMIC-WRONG-CHILD-'+paymentId,actorId]);
    const before=await financial();
    await expect(service.reconcilePaymentToInvoice({tenantId,paymentId,invoiceId,allocationAmount:40,reconciledByPartyId:actorId})).rejects.toThrow('PAYMENT_INVOICE_STUDENT_MISMATCH_ERROR');
    expect(await financial()).toEqual(before);
    evidence.observations.push({point:'actual_db_canonical_student_mismatch_denied',paymentId,invoiceId,noFinancialMutation:true});
  });

  (phase==='commit'?it:it.skip).each([
    ['existing-allocation','edu_fin_reconciliation_ledger','INSERT'],
    ['existing-payment-balance','edu_fin_payments','UPDATE'],
    ['existing-invoice-balance','edu_fin_invoices','UPDATE'],
    ['existing-receipt','edu_fin_receipts','INSERT'],
    ['existing-operation-receipt','edu_fin_reconciliation_operations','INSERT'],
  ])('%s failure keeps preexisting payment and all balances unchanged',async(point,table,event)=>{
    const invoiceId=await invoice();const paymentId=randomUUID();
    await pg.query(`INSERT INTO public.edu_fin_payments(id,tenant_id,payer_party_id,student_party_id,payment_number,amount,allocated_amount,unallocated_amount,created_by)
      VALUES($1,$2,$3,$4,$5,100,0,100,$6)`,[paymentId,tenantId,payerPartyId,studentPartyId,'ATOMIC-EXISTING-'+paymentId,actorId]);
    const input={tenantId,paymentId,invoiceId,allocationAmount:40,reconciledByPartyId:actorId};
    const before=await financial();
    await pg.query(`CREATE OR REPLACE FUNCTION public.proof_finance_atomic_fault() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.tenant_id='${tenantId}'::uuid THEN RAISE EXCEPTION 'CONTROLLED_FINANCE_ATOMIC_FAILURE'; END IF; RETURN NEW; END $$`);
    await pg.query(`CREATE TRIGGER proof_finance_atomic_fault AFTER ${event} ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.proof_finance_atomic_fault()`);
    try {await expect(service.reconcilePaymentToInvoice(input)).rejects.toThrow('CONTROLLED_FINANCE_ATOMIC_FAILURE');}
    finally {await pg.query(`DROP TRIGGER proof_finance_atomic_fault ON public.${table}`);await pg.query('DROP FUNCTION public.proof_finance_atomic_fault()');}
    const after=await financial();expect(after).toEqual(before);
    evidence.observations.push({point,input,before,after,atomic:true});
  },30000);

  (phase==='commit'?it:it.skip)('current accountant succeeds; foreign tenant and inactive actor fail closed',async()=>{
    const input=await command();
    const result=await service.recordAndReconcilePayment({...input,actorId:accountantId});
    const before=await financial();
    await expect(service.recordAndReconcilePayment({...input,tenantId:randomUUID()})).rejects.toThrow();
    await expect(service.recordAndReconcilePayment(input)).rejects.toThrow(/AUTH_ROLE_PERMISSION_ERROR/);
    await pg.query("UPDATE public.users SET status='inactive' WHERE id=$1",[accountantId]);
    try {await expect(service.recordAndReconcilePayment({...input,actorId:accountantId})).rejects.toThrow();}
    finally {await pg.query("UPDATE public.users SET status='active' WHERE id=$1",[accountantId]);}
    expect(await financial()).toEqual(before);
    evidence.observations.push({point:'accountant_current_authority_foreign_tenant_revoked_recovery',ids:ids(result)});
  });

  (phase==='commit'?it:it.skip)('actual signed-in limited client cannot execute internal RPC or read operation receipt',async()=>{
    const input=await command();
    const client=limited as unknown as SupabaseClient;
    const args={p_tenant_id:tenantId,p_actor_id:actorId,p_operation_key:input.operationKey,p_request:request(input)};
    const before=await financial();
    const committed=await client.rpc('preschool_reconcile_finance_atomic',args);
    const recovered=await client.rpc('preschool_recover_finance_reconciliation',args);
    const operations=await client.from('edu_fin_reconciliation_operations').select('*');
    expect(committed.error?.code).toBe('42501');expect(recovered.error?.code).toBe('42501');expect(operations.error?.code).toBe('42501');
    expect(await financial()).toEqual(before);
    evidence.observations.push({point:'signed_in_internal_rpc_and_receipt_denied',commit:committed.error?.code,recovery:recovered.error?.code,read:operations.error?.code});
  });

  (phase==='commit'?it:it.skip)('queued command revalidates actor after actual operation-key lock is released',async()=>{
    const input=await command();
    const before=await financial();
    const observer=new Client({connectionString:process.env.PRESCHOOL_FINANCE_ATOMIC_DB_URL});
    await observer.connect();
    let observedLock=false;
    try {
      await pg.query('BEGIN');
      await pg.query("SELECT pg_advisory_xact_lock(hashtextextended('preschool-finance:' || $1::text || ':' || $2,0))",[tenantId,input.operationKey]);
      const pending=service.recordAndReconcilePayment(input).then(value=>({value,error:undefined}),error=>({value:undefined,error:String(error)}));
      for(let attempt=0;attempt<50;attempt++){
        const waiting=await observer.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%preschool_recover_finance_reconciliation%'");
        if(waiting.rows[0].count>0){observedLock=true;break;}
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      await pg.query("UPDATE public.users SET status='inactive' WHERE id=$1",[actorId]);
      await pg.query('COMMIT');
      const result=await pending;
      expect(observedLock).toBe(true);expect(result.value).toBeUndefined();expect(result.error).toMatch(/AUTH_ROLE_PERMISSION_ERROR/);
      expect(await financial()).toEqual(before);
      evidence.observations.push({point:'queued_actor_revocation_actual_db_lock',observedLock,error:result.error,zeroFinancialMutation:true});
    } finally {
      await pg.query('ROLLBACK');
      await pg.query("UPDATE public.users SET status='active' WHERE id=$1",[actorId]);
      await observer.end();
    }
  },30000);

  (phase==='commit'?it:it.skip)('invalid precision, non-finite amounts, empty key and non-action role leave zero financial writes',async()=>{
    const input=await command();const before=await financial();
    for(const paymentAmount of [0,-1,Number.NaN,Number.POSITIVE_INFINITY,0.001,10000000000000]){
      await expect(service.recordAndReconcilePayment({...input,paymentAmount})).rejects.toThrow();
    }
    await expect(service.recordAndReconcilePayment({...input,operationKey:''})).rejects.toThrow();
    await pg.query("UPDATE public.users SET role='admin_staff' WHERE id=$1",[actorId]);
    try {await expect(service.recordAndReconcilePayment(input)).rejects.toThrow(/AUTH_ROLE_PERMISSION_ERROR/);}
    finally {await pg.query("UPDATE public.users SET role='admin' WHERE id=$1",[actorId]);}
    expect(await financial()).toEqual(before);
    evidence.observations.push({point:'invalid_inputs_and_non_action_role_denied',financialUnchanged:true});
  });

  (phase==='commit'?it:it.skip)('invoice-row wait does not retain stale actor authority or deadlock revocation',async()=>{
    const input=await command();const before=await financial();
    const observer=new Client({connectionString:process.env.PRESCHOOL_FINANCE_ATOMIC_DB_URL});await observer.connect();
    let observedLock=false;
    try {
      await pg.query('BEGIN');await pg.query('SELECT id FROM public.edu_fin_invoices WHERE id=$1 FOR UPDATE',[input.invoiceId]);
      const pending=service.recordAndReconcilePayment(input).then(value=>({value,error:undefined}),error=>({value:undefined,error:String(error)}));
      for(let attempt=0;attempt<60;attempt++){
        const waiting=await observer.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%preschool_reconcile_finance_atomic%'");
        if(waiting.rows[0].count>0){observedLock=true;break;}
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      await pg.query("UPDATE public.users SET status='inactive' WHERE id=$1",[actorId]);await pg.query('COMMIT');
      const result=await pending;expect(observedLock).toBe(true);expect(result.value).toBeUndefined();expect(result.error).toMatch(/AUTH_ROLE_PERMISSION_ERROR/);
      expect(await financial()).toEqual(before);
      evidence.observations.push({point:'invoice_row_lock_actor_revocation',observedLock,error:result.error,zeroFinancialMutation:true});
    } finally {await pg.query('ROLLBACK');await pg.query("UPDATE public.users SET status='active' WHERE id=$1",[actorId]);await observer.end();}
  },30000);

  (phase==='commit'?it:it.skip)('all three retained historical partial financial cases fail closed without repair',async()=>{
    const old=JSON.parse(readFileSync('implementation-artifacts/preschool-full-chain/FINANCE_FAILURE_REAL_DB.json','utf8')) as {
      tenantId:string; observations:{point:string;input:{invoiceId:string};atomicOnFailure?:boolean}[];
    };
    const actor=await account('admin',old.tenantId);
    for(const row of old.observations.filter(x=>x.atomicOnFailure===false)){
      await expect(service.recordAndReconcilePayment({tenantId:old.tenantId,actorId:actor.id,operationKey:randomUUID(),
        invoiceId:row.input.invoiceId,paymentAmount:1,paymentMethod:'BANK_TRANSFER'})).rejects.toThrow('FINANCE_CANONICAL_CONFLICT');
    }
    evidence.observations.push({point:'three_historical_partial_cases_fail_closed_no_history_repair',cases:old.observations.filter(x=>x.atomicOnFailure===false).map(x=>x.point)});
  });

  (phase==='commit'?it:it.skip)('full commit with lost acknowledgement is retained for fresh-process recovery',async()=>{
    const input=await command();
    let result:Result|undefined;
    await expect((async()=>{result=await service.recordAndReconcilePayment(input);throw new Error('CONTROLLED_FULL_COMMIT_LOST_ACK');})()).rejects.toThrow('CONTROLLED_FULL_COMMIT_LOST_ACK');
    if(!result)throw new Error('ACTUAL_FINANCIAL_COMMIT_REQUIRED');
    evidence.restart={input,ids:ids(result),processId:process.pid};
    evidence.observations.push({point:'lost_ack_after_full_commit',input,ids:ids(result),after:await financial()});
  });

  (phase==='restart'?it:it.skip)('fresh process recovers original canonical IDs despite changed invoice eligibility',async()=>{
    if(!evidence.restart)throw new Error('COMMIT_PHASE_REQUIRED');
    expect(process.pid).not.toBe(evidence.restart.processId);
    const input=evidence.restart.input;
    // Post-commit archiving must not make an existing operation disappear or create a new payment.
    await pg.query('UPDATE public.edu_fin_invoices SET is_archived=true WHERE id=$1',[input.invoiceId]);
    const before=await financial();
    const result=await service.recordAndReconcilePayment(input);
    expect(ids(result)).toEqual(evidence.restart.ids);expect(await financial()).toEqual(before);
    evidence.restartPid=process.pid;
    evidence.observations.push({point:'fresh_process_archived_invoice_recovery',ids:ids(result),processId:process.pid});
  });
});
