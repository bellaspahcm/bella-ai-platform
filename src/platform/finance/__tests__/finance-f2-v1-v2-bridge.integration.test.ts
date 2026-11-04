import { createHash, randomUUID } from 'crypto';
import { Client } from 'pg';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { CashProjectionWorker } from '@/platform/finance/engines/cash-engine/cash-projection-worker';
import { eventBus, MemoryEventBusAdapter } from '@/platform/host/event-bus';
import type {
  FinanceTransactionPostedV2Payload,
  FinanceTransactionReversedV2Payload
} from '@/platform/host/event-bus/types';

jest.setTimeout(60000);

const DISPOSABLE_DB_URL = process.env.BELLA_F2_DISPOSABLE_DB_URL;
const describeDisposable = DISPOSABLE_DB_URL ? describe : describe.skip;

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function transactionLines(amount1: number, amount2: number): Array<Record<string, string | number>> {
  const total = amount1 + amount2;
  return [
    {
      account_code: '1111', debit_amount_minor: amount1, debit_currency: 'VND', credit_amount_minor: 0,
      credit_currency: 'VND', debit_functional_amount: amount1, debit_functional_currency: 'VND',
      credit_functional_amount: 0, credit_functional_currency: 'VND', memo: 'synthetic cash leg one'
    },
    {
      account_code: '1122', debit_amount_minor: amount2, debit_currency: 'VND', credit_amount_minor: 0,
      credit_currency: 'VND', debit_functional_amount: amount2, debit_functional_currency: 'VND',
      credit_functional_amount: 0, credit_functional_currency: 'VND', memo: 'synthetic cash leg two'
    },
    {
      account_code: '5111', debit_amount_minor: 0, debit_currency: 'VND', credit_amount_minor: total,
      credit_currency: 'VND', debit_functional_amount: 0, debit_functional_currency: 'VND',
      credit_functional_amount: total, credit_functional_currency: 'VND', memo: 'synthetic balancing revenue'
    }
  ];
}

describe('F2 v1/v2 bridge worker route', () => {
  it('routes posted and reversed replay through the shared persisted-event command only', async () => {
    const priorAdapter = eventBus.getAdapter();
    const adapter = new MemoryEventBusAdapter();
    eventBus.setAdapter(adapter);

    const postedId = randomUUID();
    const reversedId = randomUUID();
    const postedTenant = randomUUID();
    const postedTransaction = randomUUID();
    const reversedTransaction = randomUUID();
    const originalTransaction = randomUUID();
    const rpc = jest.fn(async (_fn: string, args: Record<string, unknown>) => ({
      data: {
        success: true,
        event_id: args.p_event_id,
        event_type: args.p_event_id === postedId
          ? 'finance.transaction.posted.v2'
          : 'finance.transaction.reversed.v2',
        transaction_id: args.p_event_id === postedId ? postedTransaction : reversedTransaction,
        replayed: true
      },
      error: null
    }));
    const client = { rpc } as unknown as SupabaseClient<Database>;
    const worker = new CashProjectionWorker(client);
    const stop = worker.start();

    try {
      const postedPayload: FinanceTransactionPostedV2Payload = {
        event_id: postedId,
        event_type: 'finance.transaction.posted.v2',
        event_version: '2.0',
        tenant_id: postedTenant,
        transaction_id: postedTransaction,
        transaction_type: 'CASH',
        posted_at: new Date().toISOString(),
        source_type: 'TEST',
        source_id: randomUUID(),
        candidate_cash_legs: []
      };
      const reversedPayload: FinanceTransactionReversedV2Payload = {
        event_id: reversedId,
        event_type: 'finance.transaction.reversed.v2',
        event_version: '2.0',
        tenant_id: postedTenant,
        transaction_id: reversedTransaction,
        transaction_type: 'REVERSAL',
        posted_at: new Date().toISOString(),
        reversal_of_transaction_id: originalTransaction,
        candidate_cash_legs: []
      };

      await eventBus.publish({
        eventType: 'finance.transaction.posted.v2',
        eventVersion: '2.0',
        tenantId: postedTenant,
        aggregateId: postedTransaction,
        aggregateType: 'finance_transactions',
        payload: postedPayload
      });
      await eventBus.publish({
        eventType: 'finance.transaction.reversed.v2',
        eventVersion: '2.0',
        tenantId: postedTenant,
        aggregateId: reversedTransaction,
        aggregateType: 'finance_transactions',
        payload: reversedPayload
      });

      expect(rpc).toHaveBeenCalledTimes(2);
      expect(rpc).toHaveBeenNthCalledWith(1, 'finance_f2_project_v2_event', {
        p_tenant_id: postedTenant,
        p_event_id: postedId
      });
      expect(rpc).toHaveBeenNthCalledWith(2, 'finance_f2_project_v2_event', {
        p_tenant_id: postedTenant,
        p_event_id: reversedId
      });
    } finally {
      stop();
      eventBus.setAdapter(priorAdapter);
    }
  });
});

describeDisposable('F2 v1/v2 bridge Local/Test integration', () => {
  let client: Client;
  let concurrentClient: Client;
  let tenantA: string;
  let tenantB: string;
  let originalTransactionId: string;
  let originalEventId: string;
  let originalMovementIds: string[] = [];
  let outboxPayloadType: 'text' | 'jsonb';
  const runId = randomUUID();

  async function postTransaction(
    tenantId: string,
    idempotencyKey: string,
    amount1 = 1000,
    amount2 = 2000,
    overrideLines?: Array<Record<string, string | number>>
  ): Promise<string> {
    const postedAt = new Date();
    const lines = overrideLines ?? transactionLines(amount1, amount2);
    const requestHash = createHash('sha256').update(JSON.stringify(lines)).digest('hex');
    const result = await client.query<{ result: { success: boolean; transaction_id: string } }>(
      `SELECT public.finance_post_transaction(
        $1::uuid, $2::varchar, $3::varchar, $4::varchar, $5::varchar, $6::varchar,
        $7::timestamptz, $8::varchar, $9::varchar, $10::numeric, $11::varchar,
        $12::varchar, $13::timestamptz, $14::text, $15::varchar, $16::varchar, $17::jsonb
      ) AS result`,
      [
        tenantId,
        idempotencyKey,
        requestHash,
        'F2_BRIDGE_TEST',
        idempotencyKey,
        'CASH',
        postedAt,
        'VND',
        'VND',
        1,
        'SYSTEM',
        'SYSTEM',
        postedAt,
        'Synthetic F2 bridge integration transaction',
        'TEST',
        idempotencyKey,
        JSON.stringify(lines)
      ]
    );
    const value = result.rows[0]?.result;
    if (!value?.success || !value.transaction_id) throw new Error('Synthetic F1 post failed');
    return value.transaction_id;
  }

  async function findV2Event(tenantId: string, transactionId: string, eventType = 'finance.transaction.posted.v2') {
    const result = await client.query<{ event_id: string }>(
      `SELECT event_id
         FROM public.finance_outbox_events
        WHERE tenant_id = $1::uuid
          AND event_type = $2
          AND payload::jsonb ->> 'transaction_id' = $3
        ORDER BY created_at DESC`,
      [tenantId, eventType, transactionId]
    );
    if (result.rowCount !== 1 || !result.rows[0]?.event_id) {
      throw new Error(`Expected exactly one persisted ${eventType} event`);
    }
    return result.rows[0].event_id;
  }

  async function projectOnAsServiceRole(connection: Client, tenantId: string, eventId: string) {
    await connection.query('BEGIN');
    try {
      await connection.query('SET LOCAL ROLE service_role');
      const result = await connection.query<{ result: Record<string, unknown> }>(
        'SELECT public.finance_f2_project_v2_event($1::uuid, $2::uuid) AS result',
        [tenantId, eventId]
      );
      await connection.query('COMMIT');
      return result.rows[0]?.result;
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }
  }

  async function projectAsServiceRole(tenantId: string, eventId: string) {
    return projectOnAsServiceRole(client, tenantId, eventId);
  }

  beforeAll(async () => {
    if (!DISPOSABLE_DB_URL) return;
    const parsed = new URL(DISPOSABLE_DB_URL);
    if (
      !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) ||
      parsed.port !== '32522' ||
      parsed.pathname !== '/postgres'
    ) {
      throw new Error('Refusing F2 DB integration: BELLA_F2_DISPOSABLE_DB_URL must target 127.0.0.1:32522/postgres');
    }

    client = new Client({ connectionString: DISPOSABLE_DB_URL, ssl: false });
    concurrentClient = new Client({ connectionString: DISPOSABLE_DB_URL, ssl: false });
    await client.connect();
    await concurrentClient.connect();

    const identity = await client.query<{
      database_name: string;
      finance_transactions: string | null;
      projection_rpc: string | null;
      bridge_rpc: string | null;
      payload_type: string | null;
    }>(`
      SELECT current_database() AS database_name,
             pg_catalog.to_regclass('public.finance_transactions')::text AS finance_transactions,
             pg_catalog.to_regprocedure('public.finance_internal_project_cash_transaction(uuid,uuid,character varying,jsonb)')::text AS projection_rpc,
             pg_catalog.to_regprocedure('public.finance_f2_project_v2_event(uuid,uuid)')::text AS bridge_rpc,
             (SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
                FROM pg_catalog.pg_attribute AS a
               WHERE a.attrelid = 'public.finance_outbox_events'::regclass
                 AND a.attname = 'payload' AND a.attnum > 0 AND NOT a.attisdropped) AS payload_type
    `);
    const db = identity.rows[0];
    if (
      db?.database_name !== 'postgres' ||
      !db.finance_transactions ||
      !db.projection_rpc ||
      !db.bridge_rpc ||
      !['text', 'jsonb'].includes(db.payload_type ?? '')
    ) {
      throw new Error('Refusing F2 DB integration: disposable stack identity or migration dependency is not proven');
    }
    outboxPayloadType = db.payload_type as 'text' | 'jsonb';

    const f1 = await client.query<{
      proname: string;
      prosrc: string;
      definition_fingerprint: string;
      owner_name: string;
      prosecdef: boolean;
      proconfig: string;
      acl: string;
      anon_exec: boolean;
      authenticated_exec: boolean;
      service_role_exec: boolean;
    }>(`
      SELECT p.proname,
             p.prosrc,
             md5(pg_catalog.pg_get_functiondef(p.oid)) AS definition_fingerprint,
             r.rolname AS owner_name,
             p.prosecdef,
             COALESCE(pg_catalog.array_to_string(p.proconfig, ','), '') AS proconfig,
             COALESCE(pg_catalog.array_to_string(p.proacl, ','), '') AS acl,
             pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
             pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_exec,
             pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_exec
      FROM pg_catalog.pg_proc AS p
      JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
      JOIN pg_catalog.pg_roles AS r ON r.oid = p.proowner
      WHERE n.nspname = 'public'
        AND p.proname IN ('finance_post_transaction', 'finance_reverse_transaction')
      ORDER BY p.proname
    `);
    expect(f1.rows).toHaveLength(2);
    const expectedBodyHashes: Record<string, string> = {
      finance_post_transaction: '32D79CFEE7A21C86F62CA21A0985D7D2B479AF01B28362215659FB28975AB6CD',
      finance_reverse_transaction: '230B34FEC37BC45EFE2327710B5013F750FA6964C3EAB2D564716F23D16278BE'
    };
    const expectedDefinitionFingerprints: Record<string, string> = {
      finance_post_transaction: 'a7f25cfe9ab83f1069bd40041271e7e5',
      finance_reverse_transaction: 'e88991dd642c2a7abf49d1019675990e'
    };
    for (const row of f1.rows) {
      expect(createHash('sha256').update(row.prosrc.trim()).digest('hex').toUpperCase()).toBe(expectedBodyHashes[row.proname]);
      expect(row.definition_fingerprint).toBe(expectedDefinitionFingerprints[row.proname]);
      expect(row.owner_name).toBe('postgres');
      expect(row.prosecdef).toBe(true);
      expect(row.proconfig).toBe('');
      expect(row.acl).toBe('=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres');
      expect(row.anon_exec).toBe(true);
      expect(row.authenticated_exec).toBe(true);
      expect(row.service_role_exec).toBe(true);
    }

    tenantA = randomUUID();
    tenantB = randomUUID();
    const tenantInsert = await client.query(
      `INSERT INTO public.tenants (id, name, status)
       VALUES ($1::uuid, $3, 'active'), ($2::uuid, $4, 'active')`,
      [tenantA, tenantB, `F2-BRIDGE-A-${runId}`, `F2-BRIDGE-B-${runId}`]
    );
    expect(tenantInsert.rowCount).toBe(2);

    const periodResult = await client.query<{ id: string }>(
      `INSERT INTO public.finance_accounting_periods (tenant_id, name, period_start, period_end, status)
       VALUES ($1::uuid, $2, date_trunc('month', NOW()), date_trunc('month', NOW()) + interval '1 month - 1 microsecond', 'OPEN')
       RETURNING id`,
      [tenantA, `F2-${runId}`]
    );
    expect(periodResult.rows[0]?.id).toBeTruthy();

    await client.query(
      `INSERT INTO public.finance_accounts (tenant_id, code, name, type, normal_balance, currency, is_active)
       VALUES
         ($1::uuid, '1111', 'Synthetic Cash One', 'ASSET', 'DEBIT', 'VND', true),
         ($1::uuid, '1122', 'Synthetic Cash Two', 'ASSET', 'DEBIT', 'VND', true),
         ($1::uuid, '5111', 'Synthetic Revenue', 'REVENUE', 'CREDIT', 'VND', true)`,
      [tenantA]
    );

    const accounts = await client.query<{ id: string; code: string }>(
      `SELECT id, code FROM public.finance_accounts WHERE tenant_id = $1::uuid AND code IN ('1111', '1122') ORDER BY code`,
      [tenantA]
    );
    expect(accounts.rows).toHaveLength(2);
    for (const [index, account] of accounts.rows.entries()) {
      const bank = await client.query<{ id: string }>(
        `INSERT INTO public.finance_bank_accounts
           (tenant_id, bank_name, account_number, account_name, currency, linked_finance_account_id, is_active)
         VALUES ($1::uuid, 'Synthetic Local Bank', $2, $3, 'VND', $4::uuid, true)
         RETURNING id`,
        [tenantA, `F2-${runId}-${index}`, `Synthetic ${account.code}`, account.id]
      );
      expect(bank.rows[0]?.id).toBeTruthy();
    }
  });

  afterAll(async () => {
    if (tenantA || tenantB) {
      console.info(
        '[F2 bridge integration] Synthetic tenant fixtures retained in the disposable DB because posted F1 history is immutable.',
        { tenantA, tenantB }
      );
    }

    const closeOperations = [client?.end(), concurrentClient?.end()].filter(
      (value): value is Promise<void> => value !== undefined
    );
    await Promise.allSettled(closeOperations);
  });

  it('projects one canonical posted event once, rejects cross-tenant use, and preserves reversal lineage', async () => {
    originalTransactionId = await postTransaction(tenantA, `posted-${runId}`);
    originalEventId = await findV2Event(tenantA, originalTransactionId);

    const v1Event = await client.query<{
      event_type: string;
      event_id: string;
      payload: Record<string, unknown>;
      transaction_type: string;
      posted_at: string;
    }>(
      `SELECT e.event_type, e.event_id, e.payload::jsonb AS payload,
              t.transaction_type, t.posted_at::text AS posted_at
         FROM public.finance_outbox_events AS e
         JOIN public.finance_transactions AS t
           ON t.id = (e.payload::jsonb ->> 'transaction_id')::uuid
          AND t.tenant_id = e.tenant_id
        WHERE e.tenant_id = $1::uuid
          AND e.event_type = 'finance.transaction.posted.v1'
          AND t.id = $2::uuid`,
      [tenantA, originalTransactionId]
    );
    expect(v1Event.rows).toHaveLength(1);
    expect(v1Event.rows[0].event_type).toBe('finance.transaction.posted.v1');
    expect(Object.keys(v1Event.rows[0].payload).sort()).toEqual(['posted_at', 'tenant_id', 'transaction_id', 'transaction_type']);
    expect(v1Event.rows[0].payload).toMatchObject({
      tenant_id: tenantA,
      transaction_id: originalTransactionId,
      transaction_type: 'CASH'
    });
    expect(new Date(String(v1Event.rows[0].payload.posted_at)).toISOString()).toBe(
      new Date(v1Event.rows[0].posted_at).toISOString()
    );
    expect(v1Event.rows[0].payload).not.toHaveProperty('event_id');

    const result = await projectAsServiceRole(tenantA, originalEventId);
    expect(result).toMatchObject({ success: true, event_id: originalEventId, transaction_id: originalTransactionId });
    const movementRows = await client.query<{ id: string }>(
      `SELECT id FROM public.finance_cash_movements WHERE tenant_id = $1::uuid AND f1_transaction_id = $2::uuid ORDER BY cash_leg_reference`,
      [tenantA, originalTransactionId]
    );
    expect(movementRows.rows).toHaveLength(2);
    originalMovementIds = movementRows.rows.map((row) => row.id);

    const replay = await projectAsServiceRole(tenantA, originalEventId);
    expect(replay).toMatchObject({ success: true, replayed: true, legs_total: 2, legs_projected: 0, legs_duplicate: 2 });
    const replayCount = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.finance_cash_movements WHERE tenant_id = $1::uuid AND f1_transaction_id = $2::uuid`,
      [tenantA, originalTransactionId]
    );
    expect(replayCount.rows[0].count).toBe('2');

    await expect(projectAsServiceRole(tenantB, originalEventId)).rejects.toMatchObject({ code: 'F2042' });

    await client.query('BEGIN');
    let mismatch: unknown;
    try {
      const payloadExpression = outboxPayloadType === 'jsonb'
        ? `pg_catalog.jsonb_set(payload::jsonb, '{source_type}', '"tampered"')`
        : `pg_catalog.jsonb_set(payload::jsonb, '{source_type}', '"tampered"')::text`;
      await client.query(
        `UPDATE public.finance_outbox_events
            SET payload = ${payloadExpression}
          WHERE tenant_id = $1::uuid AND event_id = $2::uuid`,
        [tenantA, originalEventId]
      );
      await client.query('SELECT public.finance_f2_project_v2_event($1::uuid, $2::uuid)', [tenantA, originalEventId]);
    } catch (error) {
      mismatch = error;
    } finally {
      await client.query('ROLLBACK');
    }
    expect(errorCode(mismatch)).toBe('F2040');

    const reversalResult = await client.query<{ result: { success: boolean; transaction_id: string } }>(
      `SELECT public.finance_reverse_transaction($1::uuid, $2::uuid, $3::varchar, $4::text) AS result`,
      [tenantA, originalTransactionId, `reverse-${runId}`, 'Synthetic F2 bridge reversal test']
    );
    const reversalId = reversalResult.rows[0]?.result.transaction_id;
    expect(reversalResult.rows[0]?.result.success).toBe(true);
    const reversalEventId = await findV2Event(tenantA, reversalId, 'finance.transaction.reversed.v2');
    const reversalProjection = await projectAsServiceRole(tenantA, reversalEventId);
    expect(reversalProjection).toMatchObject({ success: true, event_id: reversalEventId, transaction_id: reversalId });

    const lineage = await client.query<{ source_id: string; direction: string; original_id: string }>(
      `SELECT reversal.source_id, reversal.direction, original.id AS original_id
         FROM public.finance_cash_movements AS reversal
         JOIN public.finance_cash_movements AS original
           ON original.id::text = reversal.source_id
          AND original.tenant_id = reversal.tenant_id
        WHERE reversal.tenant_id = $1::uuid
          AND reversal.f1_transaction_id = $2::uuid
          AND original.f1_transaction_id = $3::uuid`,
      [tenantA, reversalId, originalTransactionId]
    );
    expect(lineage.rows).toHaveLength(2);
    expect(new Set(lineage.rows.map((row) => row.original_id)).size).toBe(2);
    expect(new Set(lineage.rows.map((row) => row.source_id))).toEqual(new Set(originalMovementIds));
    expect(lineage.rows.map((row) => row.direction).sort()).toEqual(['OUTFLOW', 'OUTFLOW']);
  });

  it('rolls back F1, bridge event, projection, and position when the outer transaction fails', async () => {
    const idempotencyKey = `rollback-${runId}`;
    const before = await client.query<{ bank_account_id: string; balance_minor: string }>(
      `SELECT bank_account_id, balance_minor::text FROM public.finance_cash_positions WHERE tenant_id = $1::uuid ORDER BY bank_account_id`,
      [tenantA]
    );
    await client.query('BEGIN');
    const transactionId = await postTransaction(tenantA, idempotencyKey, 400, 600);
    const eventId = await findV2Event(tenantA, transactionId);
    await client.query('SELECT public.finance_f2_project_v2_event($1::uuid, $2::uuid)', [tenantA, eventId]);
    await expect(client.query('SELECT 1 / 0')).rejects.toMatchObject({ code: '22012' });
    await client.query('ROLLBACK');

    const durable = await client.query<{ transactions: string; outbox: string; movements: string }>(
      `SELECT
         (SELECT count(*)::text FROM public.finance_transactions WHERE tenant_id = $1::uuid AND idempotency_key = $2) AS transactions,
         (SELECT count(*)::text FROM public.finance_outbox_events WHERE tenant_id = $1::uuid AND payload::jsonb ->> 'transaction_id' = $3) AS outbox,
         (SELECT count(*)::text FROM public.finance_cash_movements WHERE tenant_id = $1::uuid AND f1_transaction_id = $3::uuid) AS movements`,
      [tenantA, idempotencyKey, transactionId]
    );
    expect(durable.rows[0]).toEqual({ transactions: '0', outbox: '0', movements: '0' });

    const after = await client.query<{ bank_account_id: string; balance_minor: string }>(
      `SELECT bank_account_id, balance_minor::text FROM public.finance_cash_positions WHERE tenant_id = $1::uuid ORDER BY bank_account_id`,
      [tenantA]
    );
    expect(after.rows).toEqual(before.rows);
  });

  it('fails closed when reversal movement lineage is missing or ambiguous', async () => {
    const missingOriginalTx = await postTransaction(tenantA, `missing-original-${runId}`);
    const missingReversal = await client.query<{ result: { transaction_id: string } }>(
      `SELECT public.finance_reverse_transaction($1::uuid, $2::uuid, $3::varchar, $4::text) AS result`,
      [tenantA, missingOriginalTx, `missing-reversal-${runId}`, 'Missing movement lineage test']
    );
    const missingReversalId = missingReversal.rows[0].result.transaction_id;
    const missingEventId = await findV2Event(tenantA, missingReversalId, 'finance.transaction.reversed.v2');
    await expect(projectAsServiceRole(tenantA, missingEventId)).rejects.toMatchObject({ code: 'F2043' });

    const duplicateAssetLines = [
      {
        account_code: '1111', debit_amount_minor: 500, debit_currency: 'VND', credit_amount_minor: 0,
        credit_currency: 'VND', debit_functional_amount: 500, debit_functional_currency: 'VND',
        credit_functional_amount: 0, credit_functional_currency: 'VND', memo: 'synthetic duplicate cash leg one'
      },
      {
        account_code: '1111', debit_amount_minor: 500, debit_currency: 'VND', credit_amount_minor: 0,
        credit_currency: 'VND', debit_functional_amount: 500, debit_functional_currency: 'VND',
        credit_functional_amount: 0, credit_functional_currency: 'VND', memo: 'synthetic duplicate cash leg two'
      },
      {
        account_code: '5111', debit_amount_minor: 0, debit_currency: 'VND', credit_amount_minor: 1000,
        credit_currency: 'VND', debit_functional_amount: 0, debit_functional_currency: 'VND',
        credit_functional_amount: 1000, credit_functional_currency: 'VND', memo: 'synthetic duplicate-line balancing revenue'
      }
    ];
    const ambiguousOriginalTx = await postTransaction(
      tenantA,
      `ambiguous-original-${runId}`,
      500,
      500,
      duplicateAssetLines
    );
    const ambiguousOriginalEventId = await findV2Event(tenantA, ambiguousOriginalTx);
    await projectAsServiceRole(tenantA, ambiguousOriginalEventId);

    const ambiguousReversal = await client.query<{ result: { transaction_id: string } }>(
      `SELECT public.finance_reverse_transaction($1::uuid, $2::uuid, $3::varchar, $4::text) AS result`,
      [tenantA, ambiguousOriginalTx, `ambiguous-reversal-${runId}`, 'Ambiguous line lineage test']
    );
    const ambiguousReversalId = ambiguousReversal.rows[0].result.transaction_id;
    const ambiguousEventId = await findV2Event(tenantA, ambiguousReversalId, 'finance.transaction.reversed.v2');
    await expect(projectAsServiceRole(tenantA, ambiguousEventId)).rejects.toMatchObject({ code: 'F2043' });

    const reversalMovementCounts = await client.query<{ missing: string; ambiguous: string }>(
      `SELECT
         (SELECT count(*)::text FROM public.finance_cash_movements WHERE tenant_id = $1::uuid AND f1_transaction_id = $2::uuid) AS missing,
         (SELECT count(*)::text FROM public.finance_cash_movements WHERE tenant_id = $1::uuid AND f1_transaction_id = $3::uuid) AS ambiguous`,
      [tenantA, missingReversalId, ambiguousReversalId]
    );
    expect(reversalMovementCounts.rows[0]).toEqual({ missing: '0', ambiguous: '0' });
  });

  it('serializes concurrent worker replay and denies client-role command execution and forged v1 outbox inserts', async () => {
    const transactionId = await postTransaction(tenantA, `concurrent-${runId}`, 700, 900);
    const eventId = await findV2Event(tenantA, transactionId);

    const concurrentCalls = await Promise.all([
      projectOnAsServiceRole(client, tenantA, eventId),
      projectOnAsServiceRole(concurrentClient, tenantA, eventId)
    ]);
    expect(concurrentCalls.every((result) => result?.success === true)).toBe(true);

    const concurrentMovements = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.finance_cash_movements WHERE tenant_id = $1::uuid AND f1_transaction_id = $2::uuid`,
      [tenantA, transactionId]
    );
    expect(concurrentMovements.rows[0].count).toBe('2');

    for (const role of ['anon', 'authenticated']) {
      await client.query('BEGIN');
      try {
        await client.query(`SET LOCAL ROLE ${role}`);
        await client.query('SELECT public.finance_f2_project_v2_event($1::uuid, $2::uuid)', [tenantA, eventId]);
        await client.query('ROLLBACK');
        throw new Error(`${role} unexpectedly executed the internal F2 projection command`);
      } catch (error) {
        await client.query('ROLLBACK');
        expect(errorCode(error)).toBe('42501');
      }
    }

    await client.query('BEGIN');
    try {
      await client.query('SET LOCAL ROLE authenticated');
      const payloadExpression = outboxPayloadType === 'jsonb' ? '$3::jsonb' : '$3::text';
      await client.query(
        `INSERT INTO public.finance_outbox_events (tenant_id, event_id, event_type, payload)
         VALUES ($1::uuid, $2::uuid, 'finance.transaction.posted.v1', ${payloadExpression})`,
        [tenantA, randomUUID(), JSON.stringify({ tenant_id: tenantA, transaction_id: transactionId })]
      );
      await client.query('ROLLBACK');
      throw new Error('authenticated unexpectedly forged an F1 v1 outbox event');
    } catch (error) {
      await client.query('ROLLBACK');
      expect(['42501', 'F2045']).toContain(errorCode(error));
    }
  });
});
