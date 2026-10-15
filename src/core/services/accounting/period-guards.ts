import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export class AccountingPeriodGuardError extends Error {
  constructor(public readonly code: string) { super(code); }
}

interface AccountingPeriodSqlClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

/** Caller must retain this same SQL transaction through its financial write. */
export async function lockOpenAccountingPeriods(
  db: AccountingPeriodSqlClient,
  input: { actorId: string; tenantId: string; sourceDate: string }
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sourceDate) ||
      !Number.isFinite(Date.parse(`${input.sourceDate}T00:00:00Z`)) ||
      new Date(`${input.sourceDate}T00:00:00Z`).toISOString().slice(0, 10) !== input.sourceDate) {
    throw new AccountingPeriodGuardError('ACCOUNTING_PERIOD_INVALID_DATE');
  }
  const actor = (await db.query(`select timezone('UTC',transaction_timestamp())::date::text as effective_date
    from public.users u join public.tenants t on t.id=u.tenant_id
    where u.id=auth.uid() and u.id=$1 and u.tenant_id=$2 and u.role='accountant'
      and u.status='active' and t.status='active'`, [input.actorId, input.tenantId])).rows[0];
  if (!actor || typeof actor.effective_date !== 'string') throw new AccountingPeriodGuardError('ACCOUNTING_PERIOD_FORBIDDEN');
  const dates = [...new Set([input.sourceDate, actor.effective_date])];
  // SHARE conflicts with status UPDATE, unlike KEY SHARE. Lock in a stable order.
  const periods = (await db.query(`select id,start_date::text,end_date::text,status
    from public.accounting_periods p where tenant_id=$1
      and exists(select 1 from unnest($2::date[]) d where d between p.start_date and p.end_date)
    order by id for share`, [input.tenantId, dates])).rows;
  const ids = dates.map(date => {
    const matching = periods.filter(row => typeof row.start_date === 'string' && typeof row.end_date === 'string' &&
      row.start_date <= date && row.end_date >= date);
    if (matching.length !== 1) throw new AccountingPeriodGuardError('ACCOUNTING_PERIOD_MISSING_OR_AMBIGUOUS');
    if (matching[0].status !== 'OPEN' || typeof matching[0].id !== 'string') throw new AccountingPeriodGuardError('ACCOUNTING_PERIOD_NOT_OPEN');
    return matching[0].id;
  });
  return { sourcePeriodId: ids[0], effectivePeriodId: ids[dates.indexOf(actor.effective_date)], effectiveDate: actor.effective_date };
}

/**
 * Assert that an accounting period is open before allowing write operations.
 * 
 * @param supabase - Supabase client for database operations
 * @param input - Guard parameters including tenant ID, date, and context description
 * @throws Error if tenant is missing, period is closed, or RPC call fails
 * 
 * @remarks
 * This guard function prevents modifications to journal entries, revenue, expenses,
 * and salary records when the accounting period is closed (after month-end close).
 * 
 * The RPC `ensure_open_period` checks:
 * - Period exists for the given date
 * - Period status is 'OPEN' (not 'CLOSED' or 'LOCKED')
 * - No retroactive changes to closed months
 * 
 * **Critical**: Always call this guard before:
 * - Posting journal entries
 * - Recording revenue/expenses
 * - Updating salary records
 * - Running accounting backfills
 * 
 * @example
 * ```typescript
 * // Before posting a journal entry
 * await assertOpenAccountingPeriod(supabase, {
 *   tenantId: user.tenant_id,
 *   date: '2025-06-15',
 *   context: 'Post journal entry',
 * });
 * 
 * // Will throw if June 2025 period is closed:
 * // Error: "Post journal entry: accounting period is closed or unavailable"
 * ```
 */
export async function assertOpenAccountingPeriod(
  supabase: SupabaseClient<Database>,
  input: {
    tenantId: string | null | undefined;
    date: string;
    context: string;
  }
) {
  if (!input.tenantId) {
    throw new Error(`${input.context}: missing tenant for accounting period guard.`);
  }

  const periodDate = input.date.slice(0, 10);
  const { error } = await supabase.rpc('ensure_open_period', {
    p_tenant_id: input.tenantId,
    p_date: periodDate,
  });

  if (error) {
    throw new Error(`${input.context}: accounting period is closed or unavailable: ${error.message}`);
  }
}
