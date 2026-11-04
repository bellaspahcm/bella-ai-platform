-- F2 online uniqueness guard for the semantic identity of v2 outbox events.
-- The shared F1 outbox is live, so build this partial index without blocking writes.
-- pg-delta: transaction=false
CREATE UNIQUE INDEX CONCURRENTLY uq_finance_outbox_f2_v2_semantic_identity
    ON public.finance_outbox_events (
        tenant_id,
        event_type,
        ((payload::jsonb ->> 'transaction_id'))
    )
    WHERE event_type IN (
        'finance.transaction.posted.v2',
        'finance.transaction.reversed.v2'
    )
      AND event_id IS NOT NULL;
