-- F2 additive compatibility bridge for the frozen F1 v1 outbox events.
-- Local/Test only under ACR-2026-025 and ADR-2026-025.
-- This migration does not replace or alter any F1 object or privilege.

DO $preflight$
DECLARE
    v_payload_type regtype;
BEGIN
    SELECT a.atttypid::regtype INTO v_payload_type
    FROM pg_catalog.pg_attribute AS a
    WHERE a.attrelid = 'public.finance_outbox_events'::regclass
      AND a.attname = 'payload'
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF v_payload_type IS DISTINCT FROM 'jsonb'::regtype
       AND v_payload_type IS DISTINCT FROM 'text'::regtype THEN
        RAISE EXCEPTION 'F2 v1/v2 bridge requires finance_outbox_events.payload to be TEXT or JSONB';
    END IF;

    IF (
        SELECT pg_catalog.count(*)
        FROM pg_catalog.pg_proc AS p
        JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
        JOIN pg_catalog.pg_roles AS r ON r.oid = p.proowner
        WHERE n.nspname = 'public'
          AND p.proname IN ('finance_post_transaction', 'finance_reverse_transaction')
          AND r.rolname = 'postgres'
          AND p.prosecdef
          AND COALESCE(pg_catalog.array_to_string(p.proacl, ','), '') =
              '=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres'
          AND pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
          AND pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
          AND pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
    ) <> 2 THEN
        RAISE EXCEPTION 'F1 owner/security/ACL baseline differs from the approved disposable snapshot';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_index AS idx
        JOIN pg_catalog.pg_class AS index_class ON index_class.oid = idx.indexrelid
        JOIN pg_catalog.pg_namespace AS index_namespace ON index_namespace.oid = index_class.relnamespace
        WHERE index_namespace.nspname = 'public'
          AND index_class.relname = 'uq_finance_outbox_f2_v2_semantic_identity'
          AND idx.indrelid = 'public.finance_outbox_events'::regclass
          AND idx.indisunique
          AND idx.indisvalid
          AND idx.indisready
    ) THEN
        RAISE EXCEPTION 'F2 bridge requires a valid semantic identity index from its online pre-migration'
            USING ERRCODE = 'F2044';
    END IF;
END;
$preflight$;

CREATE FUNCTION public.finance_f2_emit_v2_from_f1_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_v1_payload       jsonb;
    v_v2_payload       jsonb;
    v_v2_event_type    text;
    v_transaction_id   uuid;
    v_original_id      uuid;
    v_v2_event_id      uuid;
    v_existing_id      uuid;
    v_existing_payload jsonb;
    v_f1_owner         text;
    v_owner_count      integer;
    v_name_count       integer;
    v_all_definer      boolean;
    v_payload_type     regtype;
    v_post             public.finance_transactions%ROWTYPE;
    v_original         public.finance_transactions%ROWTYPE;
BEGIN
    -- The bridge is deliberately limited to the two immutable F1 event types.
    IF NEW.event_type NOT IN (
        'finance.transaction.posted.v1',
        'finance.transaction.reversed.v1'
    ) THEN
        RETURN NEW;
    END IF;

    -- F1's RPCs are SECURITY DEFINER. A direct client INSERT into the shared
    -- outbox must not be able to manufacture an authoritative v1 event.
    SELECT
        pg_catalog.count(DISTINCT p.proowner),
        pg_catalog.count(DISTINCT p.proname),
        pg_catalog.bool_and(p.prosecdef),
        pg_catalog.min(r.rolname::text)
    INTO v_owner_count, v_name_count, v_all_definer, v_f1_owner
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
    JOIN pg_catalog.pg_roles AS r ON r.oid = p.proowner
    WHERE n.nspname = 'public'
      AND p.proname IN ('finance_post_transaction', 'finance_reverse_transaction');

    IF v_owner_count <> 1
       OR v_name_count <> 2
       OR v_all_definer IS DISTINCT FROM true
       OR current_user::text IS DISTINCT FROM v_f1_owner THEN
        RAISE EXCEPTION 'F2 v1 bridge rejected an outbox insert outside the frozen F1 definer context'
            USING ERRCODE = 'F2045';
    END IF;

    IF NEW.event_id IS NULL THEN
        RAISE EXCEPTION 'F1 v1 outbox event is missing its event identity'
            USING ERRCODE = 'F2040';
    END IF;

    BEGIN
        v_v1_payload := NEW.payload::jsonb;
        IF NEW.event_type = 'finance.transaction.posted.v1' THEN
            v_transaction_id := (v_v1_payload ->> 'transaction_id')::uuid;
        ELSE
            v_original_id := (v_v1_payload ->> 'transaction_id')::uuid;
            v_transaction_id := (v_v1_payload ->> 'reversal_id')::uuid;
        END IF;
    EXCEPTION
        WHEN invalid_text_representation OR data_exception THEN
            RAISE EXCEPTION 'F1 v1 outbox payload has invalid JSON identity fields'
                USING ERRCODE = 'F2040';
    END;

    IF v_v1_payload ->> 'tenant_id' IS DISTINCT FROM NEW.tenant_id::text
       OR v_transaction_id IS NULL THEN
        RAISE EXCEPTION 'F1 v1 outbox tenant or transaction identity does not match its row'
            USING ERRCODE = 'F2042';
    END IF;

    IF NEW.event_type = 'finance.transaction.posted.v1' THEN
        SELECT * INTO v_post
        FROM public.finance_transactions AS t
        WHERE t.id = v_transaction_id
          AND t.tenant_id = NEW.tenant_id
        FOR KEY SHARE;

        IF NOT FOUND OR v_post.status <> 'POSTED' THEN
            RAISE EXCEPTION 'F1 posted event does not reference a canonical POSTED transaction in its tenant'
                USING ERRCODE = 'F2042';
        END IF;

        v_v2_event_type := 'finance.transaction.posted.v2';
        SELECT pg_catalog.jsonb_build_object(
            'event_id', NULL,
            'event_type', v_v2_event_type,
            'event_version', '2.0',
            'tenant_id', NEW.tenant_id,
            'transaction_id', v_post.id,
            'transaction_type', v_post.transaction_type,
            'posted_at', v_post.posted_at,
            'source_type', v_post.source_type,
            'source_id', v_post.source_id,
            'candidate_cash_legs', COALESCE((
                SELECT pg_catalog.jsonb_agg(
                    pg_catalog.jsonb_build_object(
                        'cash_leg_id', l.id,
                        'account_id', a.id,
                        'account_code', a.code,
                        'direction', CASE WHEN l.debit_amount > 0 THEN 'INFLOW' ELSE 'OUTFLOW' END,
                        'amount_minor', CASE WHEN l.debit_amount > 0 THEN l.debit_amount ELSE l.credit_amount END,
                        'currency', CASE WHEN l.debit_amount > 0 THEN l.debit_currency ELSE l.credit_currency END,
                        'functional_amount_minor', CASE WHEN l.debit_amount > 0 THEN l.debit_functional_amount ELSE l.credit_functional_amount END,
                        'functional_currency', CASE WHEN l.debit_amount > 0 THEN l.debit_functional_currency ELSE l.credit_functional_currency END,
                        'exchange_rate', v_post.exchange_rate_rate
                    )
                    ORDER BY l.id
                )
                FROM public.finance_transaction_lines AS l
                JOIN public.finance_accounts AS a
                  ON a.id = l.account_id
                 AND a.tenant_id = l.tenant_id
                WHERE l.tenant_id = NEW.tenant_id
                  AND l.transaction_id = v_post.id
                  AND a.type = 'ASSET'
                  AND (l.debit_amount > 0 OR l.credit_amount > 0)
            ), '[]'::jsonb)
        ) INTO v_v2_payload;
    ELSE
        SELECT * INTO v_original
        FROM public.finance_transactions AS t
        WHERE t.id = v_original_id
          AND t.tenant_id = NEW.tenant_id
        FOR KEY SHARE;

        SELECT * INTO v_post
        FROM public.finance_transactions AS t
        WHERE t.id = v_transaction_id
          AND t.tenant_id = NEW.tenant_id
        FOR KEY SHARE;

        IF NOT FOUND
           OR v_original.id IS NULL
           OR v_original.status <> 'REVERSED'
           OR v_post.status <> 'POSTED'
           OR v_post.transaction_type <> 'REVERSAL'
           OR v_post.reversal_of IS DISTINCT FROM v_original.id THEN
            RAISE EXCEPTION 'F1 reversed event does not reference its canonical reversal transaction'
                USING ERRCODE = 'F2042';
        END IF;

        v_v2_event_type := 'finance.transaction.reversed.v2';
        SELECT pg_catalog.jsonb_build_object(
            'event_id', NULL,
            'event_type', v_v2_event_type,
            'event_version', '2.0',
            'tenant_id', NEW.tenant_id,
            'transaction_id', v_post.id,
            'transaction_type', 'REVERSAL',
            'posted_at', v_post.posted_at,
            'reversal_of_transaction_id', v_original.id,
            'candidate_cash_legs', COALESCE((
                SELECT pg_catalog.jsonb_agg(
                    pg_catalog.jsonb_build_object(
                        'cash_leg_id', l.id,
                        'account_id', a.id,
                        'account_code', a.code,
                        'direction', CASE WHEN l.debit_amount > 0 THEN 'INFLOW' ELSE 'OUTFLOW' END,
                        'amount_minor', CASE WHEN l.debit_amount > 0 THEN l.debit_amount ELSE l.credit_amount END,
                        'currency', CASE WHEN l.debit_amount > 0 THEN l.debit_currency ELSE l.credit_currency END,
                        'functional_amount_minor', CASE WHEN l.debit_amount > 0 THEN l.debit_functional_amount ELSE l.credit_functional_amount END,
                        'functional_currency', CASE WHEN l.debit_amount > 0 THEN l.debit_functional_currency ELSE l.credit_functional_currency END,
                        'exchange_rate', v_post.exchange_rate_rate
                    )
                    ORDER BY l.id
                )
                FROM public.finance_transaction_lines AS l
                JOIN public.finance_accounts AS a
                  ON a.id = l.account_id
                 AND a.tenant_id = l.tenant_id
                WHERE l.tenant_id = NEW.tenant_id
                  AND l.transaction_id = v_post.id
                  AND a.type = 'ASSET'
                  AND (l.debit_amount > 0 OR l.credit_amount > 0)
            ), '[]'::jsonb)
        ) INTO v_v2_payload;
    END IF;

    -- Serialize semantic identity creation; the unique index remains the final
    -- concurrency guard for any writer that does not use this trigger.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            NEW.tenant_id::text || ':' || v_v2_event_type || ':' || v_transaction_id::text,
            0
        )
    );

    SELECT e.id, e.event_id, e.payload::jsonb
    INTO v_existing_id, v_v2_event_id, v_existing_payload
    FROM public.finance_outbox_events AS e
    WHERE e.tenant_id = NEW.tenant_id
      AND e.event_type = v_v2_event_type
      AND (e.payload::jsonb ->> 'transaction_id') = v_transaction_id::text
    FOR UPDATE;

    IF FOUND THEN
        v_v2_payload := pg_catalog.jsonb_set(v_v2_payload, '{event_id}', pg_catalog.to_jsonb(v_v2_event_id));
        IF v_v2_event_id IS NULL OR v_existing_payload IS DISTINCT FROM v_v2_payload THEN
            RAISE EXCEPTION 'F2 semantic event identity already exists with a different canonical payload'
                USING ERRCODE = 'F2040';
        END IF;
        RETURN NEW;
    END IF;

    v_v2_event_id := pg_catalog.gen_random_uuid();
    v_v2_payload := pg_catalog.jsonb_set(v_v2_payload, '{event_id}', pg_catalog.to_jsonb(v_v2_event_id));

    SELECT a.atttypid::regtype INTO v_payload_type
    FROM pg_catalog.pg_attribute AS a
    WHERE a.attrelid = 'public.finance_outbox_events'::regclass
      AND a.attname = 'payload'
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF v_payload_type = 'jsonb'::regtype THEN
        INSERT INTO public.finance_outbox_events (
            tenant_id, event_id, event_type, payload, status, retry_count, created_at
        ) VALUES (
            NEW.tenant_id, v_v2_event_id, v_v2_event_type, v_v2_payload, 'PENDING', 0, pg_catalog.now()
        );
    ELSE
        INSERT INTO public.finance_outbox_events (
            tenant_id, event_id, event_type, payload, status, retry_count, created_at
        ) VALUES (
            NEW.tenant_id, v_v2_event_id, v_v2_event_type, v_v2_payload::text, 'PENDING', 0, pg_catalog.now()
        );
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.finance_f2_emit_v2_from_f1_v1() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER finance_f2_v1_outbox_bridge_after_insert
AFTER INSERT ON public.finance_outbox_events
FOR EACH ROW
EXECUTE FUNCTION public.finance_f2_emit_v2_from_f1_v1();

CREATE FUNCTION public.finance_f2_project_v2_event(
    p_tenant_id uuid,
    p_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_event_count             integer;
    v_event_type              text;
    v_payload                 jsonb;
    v_expected_payload        jsonb;
    v_transaction_id          uuid;
    v_original_id             uuid;
    v_base_idempotency        text;
    v_post                    public.finance_transactions%ROWTYPE;
    v_original                public.finance_transactions%ROWTYPE;
    v_candidate               jsonb;
    v_candidate_line          public.finance_transaction_lines%ROWTYPE;
    v_original_line_id        uuid;
    v_original_line_ids       uuid[];
    v_expected_original_direction text;
    v_match_count             integer;
    v_leg_index               integer := 0;
    v_existing_count          integer := 0;
    v_key_count               integer;
    v_leg_count               integer;
    v_account_id              uuid;
    v_account_code            text;
    v_cash_leg_id             uuid;
    v_direction               text;
    v_amount_minor            numeric;
    v_currency                text;
    v_functional_amount_minor numeric;
    v_functional_currency     text;
    v_exchange_rate           numeric;
    v_source_type             text;
    v_source_id               text;
    v_description             text;
    v_bank                    public.finance_bank_accounts%ROWTYPE;
    v_mapping_count           integer;
    v_original_movement       public.finance_cash_movements%ROWTYPE;
    v_projection_leg          jsonb;
    v_projection_legs         jsonb := '[]'::jsonb;
    v_existing_movement       public.finance_cash_movements%ROWTYPE;
    v_existing_id             uuid;
    v_existing_leg_id         uuid;
    v_idempotency_key         text;
    v_existing_result         integer := 0;
    v_projection_result       jsonb;
BEGIN
    SELECT pg_catalog.count(*) INTO v_event_count
    FROM public.finance_outbox_events AS e
    WHERE e.tenant_id = p_tenant_id
      AND e.event_id = p_event_id
      AND e.event_type IN ('finance.transaction.posted.v2', 'finance.transaction.reversed.v2');

    IF v_event_count <> 1 THEN
        RAISE EXCEPTION 'F2 v2 event was not found uniquely in the requested tenant'
            USING ERRCODE = 'F2042';
    END IF;

    SELECT e.event_type, e.payload::jsonb
    INTO v_event_type, v_payload
    FROM public.finance_outbox_events AS e
    WHERE e.tenant_id = p_tenant_id
      AND e.event_id = p_event_id
      AND e.event_type IN ('finance.transaction.posted.v2', 'finance.transaction.reversed.v2')
    FOR UPDATE;

    IF v_payload ->> 'event_id' IS DISTINCT FROM p_event_id::text
       OR v_payload ->> 'tenant_id' IS DISTINCT FROM p_tenant_id::text
       OR v_payload ->> 'event_type' IS DISTINCT FROM v_event_type
       OR pg_catalog.jsonb_typeof(v_payload -> 'candidate_cash_legs') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'F2 v2 event envelope is invalid or does not match its persisted identity'
            USING ERRCODE = 'F2042';
    END IF;

    BEGIN
        v_transaction_id := (v_payload ->> 'transaction_id')::uuid;
        IF v_event_type = 'finance.transaction.reversed.v2' THEN
            v_original_id := (v_payload ->> 'reversal_of_transaction_id')::uuid;
        END IF;
    EXCEPTION
        WHEN invalid_text_representation OR data_exception THEN
            RAISE EXCEPTION 'F2 v2 event transaction identity is invalid'
                USING ERRCODE = 'F2042';
    END;

    IF v_transaction_id IS NULL THEN
        RAISE EXCEPTION 'F2 v2 event has no transaction identity'
            USING ERRCODE = 'F2042';
    END IF;

    SELECT * INTO v_post
    FROM public.finance_transactions AS t
    WHERE t.id = v_transaction_id
      AND t.tenant_id = p_tenant_id
    FOR KEY SHARE;

    IF NOT FOUND OR v_post.status <> 'POSTED' THEN
        RAISE EXCEPTION 'F2 event does not reference a canonical POSTED F1 transaction in its tenant'
            USING ERRCODE = 'F2042';
    END IF;

    IF v_event_type = 'finance.transaction.posted.v2' THEN
        v_expected_payload := pg_catalog.jsonb_build_object(
            'event_id', p_event_id,
            'event_type', v_event_type,
            'event_version', '2.0',
            'tenant_id', p_tenant_id,
            'transaction_id', v_post.id,
            'transaction_type', v_post.transaction_type,
            'posted_at', v_post.posted_at,
            'source_type', v_post.source_type,
            'source_id', v_post.source_id,
            'candidate_cash_legs', COALESCE((
                SELECT pg_catalog.jsonb_agg(
                    pg_catalog.jsonb_build_object(
                        'cash_leg_id', l.id,
                        'account_id', a.id,
                        'account_code', a.code,
                        'direction', CASE WHEN l.debit_amount > 0 THEN 'INFLOW' ELSE 'OUTFLOW' END,
                        'amount_minor', CASE WHEN l.debit_amount > 0 THEN l.debit_amount ELSE l.credit_amount END,
                        'currency', CASE WHEN l.debit_amount > 0 THEN l.debit_currency ELSE l.credit_currency END,
                        'functional_amount_minor', CASE WHEN l.debit_amount > 0 THEN l.debit_functional_amount ELSE l.credit_functional_amount END,
                        'functional_currency', CASE WHEN l.debit_amount > 0 THEN l.debit_functional_currency ELSE l.credit_functional_currency END,
                        'exchange_rate', v_post.exchange_rate_rate
                    )
                    ORDER BY l.id
                )
                FROM public.finance_transaction_lines AS l
                JOIN public.finance_accounts AS a
                  ON a.id = l.account_id
                 AND a.tenant_id = l.tenant_id
                WHERE l.tenant_id = p_tenant_id
                  AND l.transaction_id = v_post.id
                  AND a.type = 'ASSET'
                  AND (l.debit_amount > 0 OR l.credit_amount > 0)
            ), '[]'::jsonb)
        );
        v_base_idempotency := p_event_id::text;
    ELSE
        SELECT * INTO v_original
        FROM public.finance_transactions AS t
        WHERE t.id = v_original_id
          AND t.tenant_id = p_tenant_id
        FOR KEY SHARE;

        IF NOT FOUND
           OR v_original.status <> 'REVERSED'
           OR v_post.transaction_type <> 'REVERSAL'
           OR v_post.reversal_of IS DISTINCT FROM v_original.id
           OR v_post.exchange_rate_rate IS DISTINCT FROM v_original.exchange_rate_rate
           OR v_post.transaction_currency IS DISTINCT FROM v_original.transaction_currency
           OR v_post.functional_currency IS DISTINCT FROM v_original.functional_currency THEN
            RAISE EXCEPTION 'F2 reversal event does not match the canonical F1 reversal lineage'
                USING ERRCODE = 'F2043';
        END IF;

        v_expected_payload := pg_catalog.jsonb_build_object(
            'event_id', p_event_id,
            'event_type', v_event_type,
            'event_version', '2.0',
            'tenant_id', p_tenant_id,
            'transaction_id', v_post.id,
            'transaction_type', 'REVERSAL',
            'posted_at', v_post.posted_at,
            'reversal_of_transaction_id', v_original.id,
            'candidate_cash_legs', COALESCE((
                SELECT pg_catalog.jsonb_agg(
                    pg_catalog.jsonb_build_object(
                        'cash_leg_id', l.id,
                        'account_id', a.id,
                        'account_code', a.code,
                        'direction', CASE WHEN l.debit_amount > 0 THEN 'INFLOW' ELSE 'OUTFLOW' END,
                        'amount_minor', CASE WHEN l.debit_amount > 0 THEN l.debit_amount ELSE l.credit_amount END,
                        'currency', CASE WHEN l.debit_amount > 0 THEN l.debit_currency ELSE l.credit_currency END,
                        'functional_amount_minor', CASE WHEN l.debit_amount > 0 THEN l.debit_functional_amount ELSE l.credit_functional_amount END,
                        'functional_currency', CASE WHEN l.debit_amount > 0 THEN l.debit_functional_currency ELSE l.credit_functional_currency END,
                        'exchange_rate', v_post.exchange_rate_rate
                    )
                    ORDER BY l.id
                )
                FROM public.finance_transaction_lines AS l
                JOIN public.finance_accounts AS a
                  ON a.id = l.account_id
                 AND a.tenant_id = l.tenant_id
                WHERE l.tenant_id = p_tenant_id
                  AND l.transaction_id = v_post.id
                  AND a.type = 'ASSET'
                  AND (l.debit_amount > 0 OR l.credit_amount > 0)
            ), '[]'::jsonb)
        );
        v_base_idempotency := 'REV-' || p_event_id::text;
    END IF;

    IF v_payload IS DISTINCT FROM v_expected_payload THEN
        RAISE EXCEPTION 'F2 v2 event payload differs from canonical F1 transaction data'
            USING ERRCODE = 'F2040';
    END IF;

    FOR v_candidate IN
        SELECT e.value
        FROM pg_catalog.jsonb_array_elements(v_expected_payload -> 'candidate_cash_legs') AS e(value)
        WHERE e.value ->> 'account_code' LIKE '11%'
        ORDER BY (e.value ->> 'cash_leg_id')::uuid
    LOOP
        v_account_id := (v_candidate ->> 'account_id')::uuid;
        v_account_code := v_candidate ->> 'account_code';
        v_cash_leg_id := (v_candidate ->> 'cash_leg_id')::uuid;
        v_direction := v_candidate ->> 'direction';
        v_amount_minor := (v_candidate ->> 'amount_minor')::numeric;
        v_currency := v_candidate ->> 'currency';
        v_functional_amount_minor := (v_candidate ->> 'functional_amount_minor')::numeric;
        v_functional_currency := v_candidate ->> 'functional_currency';
        v_exchange_rate := (v_candidate ->> 'exchange_rate')::numeric;

        IF v_amount_minor <= 0 OR v_functional_amount_minor < 0 THEN
            RAISE EXCEPTION 'F2 cash candidate has invalid amount for account %', v_account_code
                USING ERRCODE = 'F2044';
        END IF;

        -- Lock the canonical account row so a concurrent FK-backed mapping
        -- insert cannot make the single-mapping check stale during this call.
        PERFORM 1
        FROM public.finance_accounts AS a
        WHERE a.id = v_account_id
          AND a.tenant_id = p_tenant_id
          AND a.type = 'ASSET'
          AND a.code = v_account_code
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'F2 cash candidate account is not canonical in its tenant'
                USING ERRCODE = 'F2042';
        END IF;

        SELECT pg_catalog.count(*) INTO v_mapping_count
        FROM public.finance_bank_accounts AS b
        WHERE b.tenant_id = p_tenant_id
          AND b.linked_finance_account_id = v_account_id;

        IF v_mapping_count <> 1 THEN
            RAISE EXCEPTION 'F2 cash account % must have exactly one tenant-scoped bank mapping', v_account_code
                USING ERRCODE = 'F2044';
        END IF;

        SELECT * INTO v_bank
        FROM public.finance_bank_accounts AS b
        WHERE b.tenant_id = p_tenant_id
          AND b.linked_finance_account_id = v_account_id
        FOR SHARE;

        IF NOT FOUND OR NOT v_bank.is_active OR v_bank.currency IS DISTINCT FROM v_currency THEN
            RAISE EXCEPTION 'F2 bank mapping is inactive or currency-mismatched for account %', v_account_code
                USING ERRCODE = 'F2044';
        END IF;

        v_source_type := v_post.source_type;
        v_source_id := v_post.source_id;
        v_description := 'Projected cash leg for F1 transaction ' || v_post.id::text;

        IF v_event_type = 'finance.transaction.reversed.v2' THEN
            SELECT * INTO v_candidate_line
            FROM public.finance_transaction_lines AS l
            WHERE l.id = v_cash_leg_id
              AND l.tenant_id = p_tenant_id
              AND l.transaction_id = v_post.id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'F2 reversal candidate line is not in the canonical reversal transaction'
                    USING ERRCODE = 'F2043';
            END IF;

            SELECT pg_catalog.count(*), pg_catalog.array_agg(o.id ORDER BY o.id)
            INTO v_match_count, v_original_line_ids
            FROM public.finance_transaction_lines AS o
            WHERE o.tenant_id = p_tenant_id
              AND o.transaction_id = v_original.id
              AND o.account_id = v_candidate_line.account_id
              AND o.debit_amount = v_candidate_line.credit_amount
              AND o.debit_currency = v_candidate_line.credit_currency
              AND o.credit_amount = v_candidate_line.debit_amount
              AND o.credit_currency = v_candidate_line.debit_currency
              AND o.debit_functional_amount = v_candidate_line.credit_functional_amount
              AND o.debit_functional_currency = v_candidate_line.credit_functional_currency
              AND o.credit_functional_amount = v_candidate_line.debit_functional_amount
              AND o.credit_functional_currency = v_candidate_line.debit_functional_currency
              AND o.cost_center_id IS NOT DISTINCT FROM v_candidate_line.cost_center_id
              AND o.business_unit_id IS NOT DISTINCT FROM v_candidate_line.business_unit_id
              AND o.location_id IS NOT DISTINCT FROM v_candidate_line.location_id
              AND o.project_id IS NOT DISTINCT FROM v_candidate_line.project_id
              AND o.department_id IS NOT DISTINCT FROM v_candidate_line.department_id
              AND o.custom_dimension_type IS NOT DISTINCT FROM v_candidate_line.custom_dimension_type
              AND o.custom_dimension_id IS NOT DISTINCT FROM v_candidate_line.custom_dimension_id;

            IF v_match_count <> 1 THEN
                RAISE EXCEPTION 'F2 reversal candidate has missing or ambiguous original F1 line lineage'
                    USING ERRCODE = 'F2043';
            END IF;
            v_original_line_id := v_original_line_ids[1];

            SELECT pg_catalog.count(*) INTO v_match_count
            FROM public.finance_cash_movements AS m
            WHERE m.tenant_id = p_tenant_id
              AND m.f1_transaction_id = v_original.id
              AND m.cash_leg_reference = v_original_line_id::text;

            IF v_match_count <> 1 THEN
                RAISE EXCEPTION 'F2 reversal requires exactly one original movement for its original F1 line'
                    USING ERRCODE = 'F2043';
            END IF;

            SELECT * INTO v_original_movement
            FROM public.finance_cash_movements AS m
            WHERE m.tenant_id = p_tenant_id
              AND m.f1_transaction_id = v_original.id
              AND m.cash_leg_reference = v_original_line_id::text
            FOR UPDATE;

            v_expected_original_direction := CASE
                WHEN v_direction = 'INFLOW' THEN 'OUTFLOW'
                ELSE 'INFLOW'
            END;

            IF v_original_movement.bank_account_id IS DISTINCT FROM v_bank.id
               OR v_original_movement.direction IS DISTINCT FROM v_expected_original_direction
               OR v_original_movement.amount_minor IS DISTINCT FROM v_amount_minor
               OR v_original_movement.currency IS DISTINCT FROM v_currency
               OR v_original_movement.functional_amount_minor IS DISTINCT FROM v_functional_amount_minor
               OR v_original_movement.functional_currency IS DISTINCT FROM v_functional_currency
               OR v_original_movement.valuation_rate IS DISTINCT FROM v_exchange_rate
               OR v_original_movement.source_type IS DISTINCT FROM v_original.source_type
               OR v_original_movement.source_id IS DISTINCT FROM v_original.source_id THEN
                RAISE EXCEPTION 'F2 original cash movement does not match its canonical F1 line or bank mapping'
                    USING ERRCODE = 'F2043';
            END IF;

            v_source_type := 'REVERSAL';
            v_source_id := v_original_movement.id::text;
            v_description := 'Reversal of F1 Transaction ' || v_original.id::text;
        END IF;

        v_projection_leg := pg_catalog.jsonb_build_object(
            'bank_account_id', v_bank.id,
            'cash_leg_reference', v_cash_leg_id::text,
            'direction', v_direction,
            'amount_minor', v_amount_minor,
            'currency', v_currency,
            'functional_amount_minor', v_functional_amount_minor,
            'functional_currency', v_functional_currency,
            'valuation_rate', v_exchange_rate,
            'source_type', v_source_type,
            'source_id', v_source_id,
            'description', v_description
        );

        v_idempotency_key := v_base_idempotency || ':' || v_leg_index::text || ':' || v_direction;

        SELECT pg_catalog.count(*) INTO v_key_count
        FROM public.finance_cash_movements AS m
        WHERE m.tenant_id = p_tenant_id
          AND m.idempotency_key = v_idempotency_key;

        IF v_key_count > 1 THEN
            RAISE EXCEPTION 'F2 idempotency key resolves to multiple cash movements'
                USING ERRCODE = 'F2041';
        ELSIF v_key_count = 1 THEN
            SELECT * INTO v_existing_movement
            FROM public.finance_cash_movements AS m
            WHERE m.tenant_id = p_tenant_id
              AND m.idempotency_key = v_idempotency_key
            FOR UPDATE;

            IF v_existing_movement.f1_transaction_id IS DISTINCT FROM v_post.id
               OR v_existing_movement.bank_account_id IS DISTINCT FROM v_bank.id
               OR v_existing_movement.cash_leg_reference IS DISTINCT FROM v_cash_leg_id::text
               OR v_existing_movement.direction IS DISTINCT FROM v_direction
               OR v_existing_movement.amount_minor IS DISTINCT FROM v_amount_minor
               OR v_existing_movement.currency IS DISTINCT FROM v_currency
               OR v_existing_movement.functional_amount_minor IS DISTINCT FROM v_functional_amount_minor
               OR v_existing_movement.functional_currency IS DISTINCT FROM v_functional_currency
               OR v_existing_movement.valuation_rate IS DISTINCT FROM v_exchange_rate
               OR v_existing_movement.source_type IS DISTINCT FROM v_source_type
               OR v_existing_movement.source_id IS DISTINCT FROM v_source_id
               OR v_existing_movement.description IS DISTINCT FROM v_description THEN
                RAISE EXCEPTION 'F2 idempotency key replay has a different movement payload'
                    USING ERRCODE = 'F2041';
            END IF;
            v_existing_id := v_existing_movement.id;
            v_existing_result := v_existing_result + 1;
        ELSE
            v_existing_id := NULL;
        END IF;

        SELECT pg_catalog.count(*)
        INTO v_leg_count
        FROM public.finance_cash_movements AS m
        WHERE m.tenant_id = p_tenant_id
          AND m.f1_transaction_id = v_post.id
          AND m.cash_leg_reference = v_cash_leg_id::text;

        IF v_leg_count = 1 THEN
            SELECT m.id INTO v_existing_leg_id
            FROM public.finance_cash_movements AS m
            WHERE m.tenant_id = p_tenant_id
              AND m.f1_transaction_id = v_post.id
              AND m.cash_leg_reference = v_cash_leg_id::text;
        ELSE
            v_existing_leg_id := NULL;
        END IF;

        IF v_leg_count > 1
           OR (v_leg_count = 1 AND v_existing_leg_id IS DISTINCT FROM v_existing_id) THEN
            RAISE EXCEPTION 'F2 F1 cash leg already exists under a different or conflicting idempotency identity'
                USING ERRCODE = 'F2041';
        END IF;

        v_projection_legs := v_projection_legs || pg_catalog.jsonb_build_array(v_projection_leg);
        v_leg_index := v_leg_index + 1;
    END LOOP;

    IF v_leg_index = 0 THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', true,
            'event_id', p_event_id,
            'event_type', v_event_type,
            'transaction_id', v_post.id,
            'legs_total', 0,
            'legs_projected', 0,
            'legs_duplicate', 0,
            'replayed', true
        );
    END IF;

    IF v_existing_result = v_leg_index THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', true,
            'event_id', p_event_id,
            'event_type', v_event_type,
            'transaction_id', v_post.id,
            'legs_total', v_leg_index,
            'legs_projected', 0,
            'legs_duplicate', v_existing_result,
            'replayed', true
        );
    END IF;

    v_projection_result := public.finance_internal_project_cash_transaction(
        p_tenant_id,
        v_post.id,
        v_base_idempotency,
        v_projection_legs
    );

    IF COALESCE((v_projection_result ->> 'success')::boolean, false) IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'F2 shared projection command returned an unsuccessful result'
            USING ERRCODE = 'F2041';
    END IF;

    RETURN v_projection_result || pg_catalog.jsonb_build_object(
        'event_id', p_event_id,
        'event_type', v_event_type,
        'transaction_id', v_post.id,
        'replayed', false
    );
END;
$function$;

ALTER FUNCTION public.finance_f2_project_v2_event(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.finance_f2_project_v2_event(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_f2_project_v2_event(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.finance_f2_project_v2_event(uuid, uuid) IS
'F2 additive shared projector for a persisted canonical v2 outbox event. Internal; callable only by service_role and postgres-owned outer transactions. Revalidates F1 source, tenant mapping, idempotency payload and reversal lineage before delegating to the frozen multi-leg projector.';
