-- =============================================================================
-- BELLA Interior Commercial — Window C Deployment Wrapper
-- Migrations: M14 (20261115023322) + M15 (20261115025227)
-- Built: 2026-11-15T21:29 +07:00
-- =============================================================================
-- Source checksums (verify before execute):
--   M14: C8AD1C8D28FD57033316391F86F90E9191ED773D7301F5B0792761EECC1EFD78
--        (20261115023322_interior_payment_transaction_scoped_access.sql, 150 lines)
--        Phương án B applied: ALTER FUNCTION line removed
--   M15: 25B41D9100EB99167AF52C32D84D0B264F1E43FED502876ECAB918C3790E4C78
--        (20261115025227_interior_payment_duplicate_reference_precedence.sql, 65 lines)
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- =============================================================================
-- SECTION 0: PRE-FLIGHT CHECKS
-- =============================================================================
DO $$
DECLARE
  v_m14_in_ledger  INT;
  v_m15_in_ledger  INT;
  v_m1_in_ledger   INT;
  v_private_schema INT;
BEGIN
  -- Guard: M1 must be deployed first
  SELECT count(*) INTO v_m1_in_ledger
  FROM supabase_migrations.schema_migrations
  WHERE version = '20261113165251';
  IF v_m1_in_ledger = 0 THEN
    RAISE EXCEPTION 'WRAPPER_ABORT: M1 (20261113165251) not in ledger — Window B must be deployed first';
  END IF;

  -- Guard: double-apply M14
  SELECT count(*) INTO v_m14_in_ledger
  FROM supabase_migrations.schema_migrations
  WHERE version = '20261115023322';
  IF v_m14_in_ledger > 0 THEN
    RAISE EXCEPTION 'WRAPPER_ABORT: M14 (20261115023322) already in ledger — refusing double-apply';
  END IF;

  -- Guard: double-apply M15
  SELECT count(*) INTO v_m15_in_ledger
  FROM supabase_migrations.schema_migrations
  WHERE version = '20261115025227';
  IF v_m15_in_ledger > 0 THEN
    RAISE EXCEPTION 'WRAPPER_ABORT: M15 (20261115025227) already in ledger — refusing double-apply';
  END IF;

  -- Guard: private schema must exist
  SELECT count(*) INTO v_private_schema
  FROM information_schema.schemata
  WHERE schema_name = 'private';
  IF v_private_schema = 0 THEN
    RAISE EXCEPTION 'WRAPPER_ABORT: private schema does not exist — cannot create private functions';
  END IF;

  RAISE NOTICE 'SECTION 0 PASS: pre-flight OK at %', now();
END;
$$;

-- =============================================================================
-- SECTION 1: M14 — interior_payment_transaction_scoped_access
-- Source: 20261115023322_interior_payment_transaction_scoped_access.sql
-- SHA-256: C8AD1C8D28FD57033316391F86F90E9191ED773D7301F5B0792761EECC1EFD78
-- Phương án B: ALTER FUNCTION line removed
-- =============================================================================

-- Keep internal policy lookups outside the exposed Data API schema.
CREATE OR REPLACE FUNCTION private.interior_payment_transaction_finance_read_allowed(
  p_tenant_id UUID,
  p_contract_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
     AND p_tenant_id = public.interior_actor_tenant()
     AND EXISTS (
       SELECT 1
       FROM public.interior_contracts c
       WHERE c.tenant_id = p_tenant_id
         AND c.id = p_contract_id
         AND public.interior_has_permission(
           'interior:finance:read', c.tenant_id, c.project_id, NULL
         )
     );
$$;

CREATE OR REPLACE FUNCTION private.interior_payment_transaction_record_allowed(
  p_tenant_id UUID,
  p_contract_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
     AND p_tenant_id = public.interior_actor_tenant()
     AND EXISTS (
       SELECT 1
       FROM public.interior_contracts c
       WHERE c.tenant_id = p_tenant_id
         AND c.id = p_contract_id
         AND c.status IN ('signed', 'active')
         AND public.interior_has_permission(
           'interior:payment:record', c.tenant_id, c.project_id, NULL
         )
     );
$$;

REVOKE ALL ON FUNCTION private.interior_payment_transaction_finance_read_allowed(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.interior_payment_transaction_finance_read_allowed(UUID, UUID)
  TO authenticated;
REVOKE ALL ON FUNCTION private.interior_payment_transaction_record_allowed(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.interior_payment_transaction_record_allowed(UUID, UUID)
  TO authenticated;

DROP POLICY IF EXISTS interior_payment_transactions_finance_read
  ON public.interior_payment_transactions;
CREATE POLICY interior_payment_transactions_finance_read
  ON public.interior_payment_transactions
  FOR SELECT TO authenticated
  USING (private.interior_payment_transaction_finance_read_allowed(tenant_id, contract_id));

DROP POLICY IF EXISTS interior_payment_transactions_record
  ON public.interior_payment_transactions;
CREATE POLICY interior_payment_transactions_record
  ON public.interior_payment_transactions
  FOR INSERT TO authenticated
  WITH CHECK (private.interior_payment_transaction_record_allowed(tenant_id, contract_id));

-- The API may read only the contract context needed for the requested lifecycle
-- operation. It never needs a direct SELECT grant on interior_contracts.
CREATE OR REPLACE FUNCTION public.interior_read_contract_lifecycle_context(
  p_contract_id UUID,
  p_context TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_contract public.interior_contracts%ROWTYPE;
  v_milestones JSONB;
BEGIN
  IF auth.uid() IS NULL OR v_tenant_id IS NULL OR p_contract_id IS NULL
     OR p_context IS NULL OR p_context NOT IN ('payment', 'amendment') THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_contract
  FROM public.interior_contracts c
  WHERE c.tenant_id = v_tenant_id AND c.id = p_contract_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF p_context = 'payment' THEN
    IF NOT public.interior_has_permission(
      'interior:payment:record', v_tenant_id, v_contract.project_id, NULL
    ) THEN
      RETURN NULL;
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', m.id, 'milestoneOrder', m.milestone_order
    ) ORDER BY m.milestone_order, m.id), '[]'::JSONB)
    INTO v_milestones
    FROM public.interior_payment_milestones m
    WHERE m.tenant_id = v_tenant_id AND m.contract_id = v_contract.id;
    RETURN jsonb_build_object(
      'id', v_contract.id, 'tenantId', v_tenant_id,
      'projectId', v_contract.project_id, 'status', v_contract.status,
      'milestones', v_milestones
    );
  END IF;

  IF NOT public.interior_has_permission(
       'interior:contract:amend', v_tenant_id, v_contract.project_id, NULL
     ) OR NOT public.interior_has_permission(
       'interior:finance:read', v_tenant_id, v_contract.project_id, NULL
     ) THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id, 'tenantId', m.tenant_id, 'contractId', m.contract_id,
    'milestoneOrder', m.milestone_order, 'name', m.name,
    'percentage', m.percentage, 'amount', m.amount,
    'triggerCondition', m.trigger_condition, 'status', m.status,
    'dueDate', m.due_date, 'paidAt', m.paid_at,
    'collectedAmount', m.collected_amount, 'invoiceStatus', m.invoice_status,
    'invoiceNumber', m.invoice_number, 'invoicedAt', m.invoiced_at
  ) ORDER BY m.milestone_order, m.id), '[]'::JSONB)
  INTO v_milestones
  FROM public.interior_payment_milestones m
  WHERE m.tenant_id = v_tenant_id AND m.contract_id = v_contract.id;
  RETURN jsonb_build_object(
    'id', v_contract.id, 'tenantId', v_tenant_id,
    'projectId', v_contract.project_id, 'status', v_contract.status,
    'currentContractValue', v_contract.current_contract_value,
    'milestones', v_milestones
  );
END;
$$;

REVOKE ALL ON FUNCTION public.interior_read_contract_lifecycle_context(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.interior_read_contract_lifecycle_context(UUID, TEXT)
  TO authenticated;

-- =============================================================================
-- SECTION 2: M15 — interior_payment_duplicate_reference_precedence
-- Source: 20261115025227_interior_payment_duplicate_reference_precedence.sql
-- SHA-256: 25B41D9100EB99167AF52C32D84D0B264F1E43FED502876ECAB918C3790E4C78
-- Note: Replaces guard function body; trigger already exists from M1.
--       SECURITY DEFINER declared inline — no ALTER FUNCTION needed.
-- =============================================================================

-- Duplicate receipts must remain idempotently identifiable after the milestone
-- has been fully collected. Keep the unique index as the concurrency guard.
CREATE OR REPLACE FUNCTION public.guard_interior_payment_transaction_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_id UUID;
  v_milestone_amount NUMERIC(15, 2);
  v_collected_amount NUMERIC(15, 2);
BEGIN
  IF auth.uid() IS NULL
     OR NEW.tenant_id IS DISTINCT FROM public.interior_actor_tenant()
     OR NEW.recorded_by IS DISTINCT FROM auth.uid()::TEXT THEN
    RAISE EXCEPTION 'AuthorizationViolation: payment actor and tenant must match the authenticated session';
  END IF;
  IF btrim(NEW.reference_code) = '' THEN
    RAISE EXCEPTION 'PaymentReferenceCodeRequired';
  END IF;

  SELECT c.project_id, m.amount, COALESCE(m.collected_amount, 0)
    INTO v_project_id, v_milestone_amount, v_collected_amount
  FROM public.interior_payment_milestones m
  JOIN public.interior_contracts c
    ON c.tenant_id = m.tenant_id AND c.id = m.contract_id
  WHERE m.tenant_id = NEW.tenant_id
    AND m.id = NEW.milestone_id
    AND m.contract_id = NEW.contract_id
    AND c.status IN ('signed', 'active')
  FOR UPDATE OF m;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTERIOR_PAYMENT_MILESTONE_OR_SIGNED_CONTRACT_REQUIRED';
  END IF;
  IF NOT public.interior_has_permission(
    'interior:payment:record', NEW.tenant_id, v_project_id, NULL
  ) THEN
    RAISE EXCEPTION 'AuthorizationViolation: payment record permission is required';
  END IF;

  -- Check only after row locking and authorization. This keeps concurrent
  -- retries serialized while preserving 23505 when a completed receipt is retried.
  IF EXISTS (
    SELECT 1
    FROM public.interior_payment_transactions existing
    WHERE existing.tenant_id = NEW.tenant_id
      AND existing.contract_id = NEW.contract_id
      AND lower(btrim(existing.reference_code)) = lower(btrim(NEW.reference_code))
  ) THEN
    RAISE EXCEPTION 'duplicate key value violates unique constraint "uq_interior_payment_tx_reference_normalized"'
      USING ERRCODE = '23505', CONSTRAINT = 'uq_interior_payment_tx_reference_normalized';
  END IF;

  IF v_collected_amount + NEW.amount > v_milestone_amount THEN
    RAISE EXCEPTION 'INTERIOR_PAYMENT_EXCEEDS_MILESTONE_BALANCE';
  END IF;

  NEW.reference_code := btrim(NEW.reference_code);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_interior_payment_transaction_insert()
  FROM PUBLIC, anon, authenticated, service_role;

-- =============================================================================
-- SECTION 3: ASSERTIONS
-- =============================================================================
DO $$
DECLARE
  v_count INT;
  v_secdef BOOLEAN;
  v_text   TEXT;
BEGIN
  -- Assert 3.1: private.interior_payment_transaction_finance_read_allowed EXISTS
  SELECT count(*) INTO v_count
  FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'private' AND p.proname = 'interior_payment_transaction_finance_read_allowed';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'ASSERT 3.1 FAIL: private.interior_payment_transaction_finance_read_allowed not found';
  END IF;

  -- Assert 3.2: private.interior_payment_transaction_record_allowed EXISTS
  SELECT count(*) INTO v_count
  FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'private' AND p.proname = 'interior_payment_transaction_record_allowed';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'ASSERT 3.2 FAIL: private.interior_payment_transaction_record_allowed not found';
  END IF;

  -- Assert 3.3: both private functions are SECURITY DEFINER
  SELECT count(*) INTO v_count
  FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'private'
    AND p.proname IN ('interior_payment_transaction_finance_read_allowed',
                      'interior_payment_transaction_record_allowed')
    AND p.prosecdef = true;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'ASSERT 3.3 FAIL: private functions not SECURITY DEFINER (count=%, expected 2)', v_count;
  END IF;

  -- Assert 3.4: exactly 2 RLS policies on interior_payment_transactions
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'interior_payment_transactions';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'ASSERT 3.4 FAIL: expected 2 RLS policies, found %', v_count;
  END IF;

  -- Assert 3.5: SELECT policy uses finance_read_allowed
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'interior_payment_transactions'
    AND policyname = 'interior_payment_transactions_finance_read'
    AND cmd = 'SELECT';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'ASSERT 3.5 FAIL: interior_payment_transactions_finance_read SELECT policy not found';
  END IF;

  -- Assert 3.6: INSERT policy uses record_allowed
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'interior_payment_transactions'
    AND policyname = 'interior_payment_transactions_record'
    AND cmd = 'INSERT';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'ASSERT 3.6 FAIL: interior_payment_transactions_record INSERT policy not found';
  END IF;

  -- Assert 3.7: interior_read_contract_lifecycle_context EXISTS, SECURITY DEFINER
  SELECT p.prosecdef INTO v_secdef
  FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'interior_read_contract_lifecycle_context';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ASSERT 3.7 FAIL: interior_read_contract_lifecycle_context not found';
  END IF;
  IF v_secdef IS NOT TRUE THEN
    RAISE EXCEPTION 'ASSERT 3.7 FAIL: interior_read_contract_lifecycle_context not SECURITY DEFINER';
  END IF;

  -- Assert 3.8: guard_interior_payment_transaction_insert is now SECURITY DEFINER (from M15)
  SELECT p.prosecdef INTO v_secdef
  FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'guard_interior_payment_transaction_insert';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ASSERT 3.8 FAIL: guard_interior_payment_transaction_insert not found';
  END IF;
  IF v_secdef IS NOT TRUE THEN
    RAISE EXCEPTION 'ASSERT 3.8 FAIL: guard_interior_payment_transaction_insert not SECURITY DEFINER after M15';
  END IF;

  -- Assert 3.9: guard function body contains the duplicate-check logic from M15
  SELECT p.prosrc INTO v_text
  FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'guard_interior_payment_transaction_insert';
  IF position('uq_interior_payment_tx_reference_normalized' IN v_text) = 0 THEN
    RAISE EXCEPTION 'ASSERT 3.9 FAIL: guard function missing M15 duplicate-check logic';
  END IF;

  -- Assert 3.10: M14 NOT in ledger yet (ledger insert happens in Section 4)
  SELECT count(*) INTO v_count
  FROM supabase_migrations.schema_migrations WHERE version = '20261115023322';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ASSERT 3.10 FAIL: M14 already in ledger before Section 4 insert';
  END IF;

  -- Assert 3.11: M15 NOT in ledger yet
  SELECT count(*) INTO v_count
  FROM supabase_migrations.schema_migrations WHERE version = '20261115025227';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ASSERT 3.11 FAIL: M15 already in ledger before Section 4 insert';
  END IF;

  RAISE NOTICE 'SECTION 3 PASS: 11/11 assertions OK at %', now();
END;
$$;

-- =============================================================================
-- SECTION 4: LEDGER
-- =============================================================================
INSERT INTO supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
VALUES
  ('20261115023322', NULL,
   'interior_payment_transaction_scoped_access',
   'production-apply-window-c', NULL, NULL),
  ('20261115025227', NULL,
   'interior_payment_duplicate_reference_precedence',
   'production-apply-window-c', NULL, NULL);

DO $$
DECLARE v_count INT;
BEGIN
  SELECT count(*) INTO v_count
  FROM supabase_migrations.schema_migrations
  WHERE version IN ('20261115023322', '20261115025227');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'ASSERT 4.1 FAIL: ledger insert incomplete — expected 2, found %', v_count;
  END IF;
  RAISE NOTICE 'SECTION 4 PASS: ledger entries verified at %', now();
END;
$$;

COMMIT;

-- =============================================================================
-- POST-COMMIT VERIFICATION (run after COMMIT — separate connection)
-- =============================================================================
SELECT
  'POST-COMMIT CHECK' AS phase,
  (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = '20261115023322') AS m14_in_ledger,
  (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = '20261115025227') AS m15_in_ledger,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='private' AND p.proname IN ('interior_payment_transaction_finance_read_allowed','interior_payment_transaction_record_allowed')) AS private_fns,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='interior_payment_transactions') AS rls_policy_count,
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname='guard_interior_payment_transaction_insert') AS guard_secdef,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname='interior_read_contract_lifecycle_context') AS lifecycle_ctx_fn;
-- Expected: m14_in_ledger=1, m15_in_ledger=1, private_fns=2, rls_policy_count=2, guard_secdef=true, lifecycle_ctx_fn=1
