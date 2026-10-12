import type { QueryResult, QueryResultRow } from 'pg';

import type {
  RetailSaleFinancePort,
} from './retail-sale-pos.service';
import type { FinancialIntent } from '@/platform/integration-runtime/types/financial-intent.types';

export interface RetailSaleFinanceSqlExecutor {
  query<TRow extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<TRow> | { rows: TRow[]; rowCount: number | null }>;
}

interface SubmitIntentRow extends QueryResultRow {
  outbox_id: string;
}

interface OutboxReadBackRow extends QueryResultRow {
  id: string;
  tenant_id: string;
  intent_type: string;
  correlation_id: string;
  status: string;
}

export class PostgresRetailSaleFinancePort implements RetailSaleFinancePort {
  constructor(private readonly db: RetailSaleFinanceSqlExecutor) {}

  async submitIntent(params: {
    tenantId: string;
    idempotencyKey: string;
    intent: FinancialIntent;
  }): Promise<{ outboxId: string }> {
    const result = await this.db.query<SubmitIntentRow>(
      `
        SELECT public.submit_financial_intent($1, $2, $3::jsonb) AS outbox_id
      `,
      [
        params.idempotencyKey,
        params.intent.intentType,
        JSON.stringify({
          ...params.intent,
          effectiveDate: params.intent.effectiveDate.toISOString(),
        }),
      ]
    );
    const row = result.rows[0];
    if (!row) throw new Error('submit_financial_intent returned no outbox id');
    return { outboxId: row.outbox_id };
  }

  async readIntent(params: { tenantId: string; outboxId: string }): Promise<{
    outboxId: string;
    tenantId: string;
    intentType: string;
    correlationId: string;
    status: string;
  }> {
    const result = await this.db.query<OutboxReadBackRow>(
      `
        SELECT id, tenant_id, intent_type, correlation_id, status
        FROM public.runtime_outbox
        WHERE tenant_id = $1
          AND id = $2::uuid
      `,
      [params.tenantId, params.outboxId]
    );
    const row = result.rows[0];
    if (!row) throw new Error('Finance outbox read-back not found');
    return {
      outboxId: row.id,
      tenantId: row.tenant_id,
      intentType: row.intent_type,
      correlationId: row.correlation_id,
      status: row.status,
    };
  }
}
