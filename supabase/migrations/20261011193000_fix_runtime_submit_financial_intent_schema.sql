-- Runtime submit_financial_intent compatibility repair.
--
-- Scope:
-- - Replace the public RPC body so it writes the current runtime_* schemas.
-- - Preserve server-derived tenant and actor validation.
-- - Preserve statement-level atomicity: any failed INSERT rolls back the call.
-- - Do not add tables, rewrite historical migrations, or write Finance ledger internals.

CREATE OR REPLACE FUNCTION public.submit_financial_intent(
    p_idempotency_key TEXT,
    p_intent_type TEXT,
    p_intent_payload JSONB
) RETURNS UUID AS $$
DECLARE
    v_outbox_id UUID := gen_random_uuid();
    v_tenant_id TEXT;
    v_actor_id UUID;
    v_correlation_id TEXT;
    v_entity_id TEXT;
    v_entity_type TEXT;
    v_amount NUMERIC(15, 2);
    v_currency TEXT;
    v_source TEXT;
BEGIN
    v_tenant_id := COALESCE(
        NULLIF(auth.jwt() ->> 'tenant_id', ''),
        public.get_auth_tenant_id()::TEXT
    );
    v_actor_id := auth.uid();

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated tenant context';
    END IF;

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user context';
    END IF;

    IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    IF p_intent_type IS NULL OR length(trim(p_intent_type)) = 0 THEN
        RAISE EXCEPTION 'intent_type is required';
    END IF;

    IF p_intent_payload IS NULL THEN
        RAISE EXCEPTION 'intent_payload is required';
    END IF;

    v_correlation_id := COALESCE(
        NULLIF(p_intent_payload ->> 'correlationId', ''),
        NULLIF(p_intent_payload ->> 'correlation_id', ''),
        p_idempotency_key
    );
    v_entity_id := COALESCE(
        NULLIF(p_intent_payload ->> 'entityId', ''),
        NULLIF(p_intent_payload ->> 'entity_id', ''),
        v_outbox_id::TEXT
    );
    v_entity_type := COALESCE(
        NULLIF(p_intent_payload ->> 'entityType', ''),
        NULLIF(p_intent_payload ->> 'entity_type', ''),
        'financial_intent'
    );
    v_amount := CASE
        WHEN (p_intent_payload ->> 'amount') ~ '^-?[0-9]+(\.[0-9]+)?$'
            THEN GREATEST((p_intent_payload ->> 'amount')::NUMERIC, 0)
        ELSE 0
    END;
    v_currency := UPPER(COALESCE(NULLIF(p_intent_payload ->> 'currency', ''), 'VND'));
    IF length(v_currency) <> 3 THEN
        v_currency := 'VND';
    END IF;
    v_source := COALESCE(NULLIF(p_intent_payload ->> 'source', ''), 'submit_financial_intent');

    INSERT INTO public.runtime_outbox (
        id,
        tenant_id,
        intent_type,
        intent_payload,
        correlation_id,
        status,
        created_at
    ) VALUES (
        v_outbox_id,
        v_tenant_id,
        p_intent_type,
        p_intent_payload,
        v_correlation_id,
        'PENDING',
        now()
    );

    INSERT INTO public.runtime_idempotency_registry (
        tenant_id,
        idempotency_key,
        correlation_id,
        intent_type,
        outbox_id,
        expires_at
    ) VALUES (
        v_tenant_id,
        p_idempotency_key,
        v_correlation_id,
        p_intent_type,
        v_outbox_id,
        now() + interval '24 hours'
    );

    INSERT INTO public.runtime_audit_log (
        tenant_id,
        intent_type,
        entity_id,
        entity_type,
        amount,
        currency,
        correlation_id,
        source,
        status,
        timestamp
    ) VALUES (
        v_tenant_id,
        p_intent_type,
        v_entity_id,
        v_entity_type,
        v_amount,
        v_currency,
        v_correlation_id,
        v_source,
        'SUCCESS',
        now()
    );

    RETURN v_outbox_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.submit_financial_intent(TEXT, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_financial_intent(TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_financial_intent(TEXT, TEXT, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
