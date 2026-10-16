-- Necessary in-transaction checks, not a claim of runtime/Go-Live proof.
DO $adoption_after$
DECLARE
  target_name text;
  contract record;
  privilege_name text;
  column_name text;
  expected boolean;
BEGIN
  FOR contract IN SELECT * FROM (VALUES
    ('auto_brands','SELECT'),('auto_models','SELECT'),('auto_variants','SELECT'),
    ('auto_leads','SELECT,INSERT,UPDATE'),('auto_bookings','SELECT,INSERT,UPDATE'),
    ('auto_deposits','SELECT,INSERT,UPDATE'),('auto_vehicles','SELECT,INSERT,UPDATE'),
    ('auto_vehicle_status_logs','SELECT,INSERT'),('auto_vehicle_owners','SELECT,INSERT,UPDATE'),
    ('auto_service_history','SELECT'),('auto_customer_profiles','SELECT'),('policy_registry','SELECT'),
    ('mobility_domain_events','SELECT,INSERT'),('mobility_command_idempotency','SELECT,INSERT'),
    ('auto_vehicle_sale_recognitions','SELECT'),('auto_vehicle_sale_recognition_adjustments','SELECT'),
    ('auto_vehicle_sale_financial_snapshots','SELECT,INSERT'),('auto_vehicle_sale_payments','SELECT,INSERT'),
    ('auto_vehicle_sale_settlement_actions','SELECT')
  ) AS contracts(table_name,privileges) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=contract.table_name AND c.relkind='r'
        AND c.relrowsecurity AND pg_get_userbyid(c.relowner)='postgres') THEN
      RAISE EXCEPTION 'Final table/RLS/ownership mismatch: %',contract.table_name;
    END IF;
    IF has_table_privilege('anon','public.'||contract.table_name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege('anon','public.'||contract.table_name,'SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'Anonymous/inherited privileges remain: %',contract.table_name;
    END IF;
    FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      expected:=privilege_name=ANY(string_to_array(contract.privileges,','));
      IF has_table_privilege('authenticated','public.'||contract.table_name,privilege_name) IS DISTINCT FROM expected THEN
        RAISE EXCEPTION 'Effective authenticated % mismatch: %',privilege_name,contract.table_name;
      END IF;
    END LOOP;
    FOR column_name IN SELECT attname FROM pg_attribute
      WHERE attrelid=to_regclass('public.'||contract.table_name) AND attnum>0 AND NOT attisdropped
    LOOP
      FOREACH privilege_name IN ARRAY ARRAY['INSERT','UPDATE','REFERENCES'] LOOP
        expected:=privilege_name=ANY(string_to_array(contract.privileges,',')) OR
          (contract.table_name='auto_customer_profiles' AND privilege_name IN ('INSERT','UPDATE') AND
          column_name=ANY(ARRAY['tenant_id','customer_id','preferred_brands','preferred_segments','budget_range','purchasing_purpose','updated_at']));
        IF has_column_privilege('authenticated','public.'||contract.table_name,column_name,privilege_name) IS DISTINCT FROM expected THEN
          RAISE EXCEPTION 'Effective column % mismatch: %.%',privilege_name,contract.table_name,column_name;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  FOREACH target_name IN ARRAY ARRAY['auto_brands','auto_models','auto_variants'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=target_name
      AND policyname=target_name||'_tenant_read_access' AND permissive='PERMISSIVE' AND cmd='SELECT') OR
      NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=target_name
      AND policyname=target_name||'_tenant_read_guard' AND permissive='RESTRICTIVE' AND cmd='SELECT') THEN
      RAISE EXCEPTION 'Catalog policy pair missing: %',target_name;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='automove-sale-documents' AND name=id
      AND public=false AND file_size_limit=20971520
      AND allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png']) THEN
    RAISE EXCEPTION 'Private document bucket contract mismatch';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname IN ('automove_sale_document_read','automove_sale_document_upload')
    AND roles=ARRAY['authenticated']::name[] AND qual IS DISTINCT FROM 'true'
    AND coalesce(qual,with_check) LIKE '%accountant%' AND coalesce(qual,with_check) NOT LIKE '%finance_manager%')<>2 THEN
    RAISE EXCEPTION 'Accountant-only document policy mismatch';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='storage' AND c.relname IN ('objects','buckets') AND c.relrowsecurity
      AND pg_get_userbyid(c.relowner)='supabase_storage_admin')<>2 THEN
    RAISE EXCEPTION 'Storage ownership/RLS must remain unchanged';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.policy_registry
      WHERE policy_id='AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY' AND version='1.0.0'
      AND status='active' AND is_active AND tenant_id IS NULL AND deleted_at IS NULL
      AND effective_date=DATE '2026-01-01'
      AND config->>'ledger_posting_authorized'='false') THEN
    RAISE EXCEPTION 'Approved global policy seed mismatch';
  END IF;
  FOR contract IN SELECT * FROM (VALUES
    ('auto_vehicle_sale_recognitions','trg_auto_vehicle_sale_recognitions_append_only'),
    ('auto_vehicle_sale_recognitions','trg_auto_vehicle_sale_recognitions_validate_tenant'),
    ('auto_vehicle_sale_recognition_adjustments','trg_auto_vehicle_sale_adjustments_append_only'),
    ('auto_vehicle_sale_recognition_adjustments','trg_auto_vehicle_sale_adjustments_validate_tenant'),
    ('auto_vehicle_sale_financial_snapshots','guard_automove_financial_snapshot'),
    ('auto_vehicle_sale_payments','guard_automove_post_sale_receipt'),
    ('auto_deposits','guard_automove_deposit_collection_cap'),
    ('auto_vehicle_sale_settlement_actions','guard_automove_settlement_action')
  ) AS triggers(table_name,trigger_name) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.'||contract.table_name)
      AND tgname=contract.trigger_name AND tgenabled='O' AND NOT tgisinternal) THEN
      RAISE EXCEPTION 'Required enabled trigger missing: %.%',contract.table_name,contract.trigger_name;
    END IF;
  END LOOP;
END $adoption_after$;

DO $adoption_function_readback$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.get_auth_tenant_id()')
    AND prosrc='
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT u.tenant_id INTO v_tenant_id
  FROM public.users AS u
  JOIN public.tenants AS t ON t.id = u.tenant_id
  WHERE u.id = auth.uid() AND u.status = ''active'' AND t.status = ''active'';

  -- NULL would enable legacy policies using NULL as an unrestricted HQ sentinel.
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION ''Active canonical identity and tenant required'' USING ERRCODE = ''42501'';
  END IF;
  RETURN v_tenant_id;
END;
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=pg_catalog, public']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.get_auth_tenant_id()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.is_admin()')
    AND prosrc='
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u JOIN public.tenants AS t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.status = ''active'' AND t.status = ''active'' AND u.role = ''admin''
  );
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=pg_catalog, public']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.is_admin()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.is_hr()')
    AND prosrc='
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u JOIN public.tenants AS t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.status = ''active'' AND t.status = ''active'' AND u.role = ''hr''
  );
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=pg_catalog, public']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.is_hr()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.is_accountant()')
    AND prosrc='
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u JOIN public.tenants AS t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.status = ''active'' AND t.status = ''active'' AND u.role = ''accountant''
  );
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=pg_catalog, public']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.is_accountant()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.is_hq_super_admin()')
    AND prosrc='
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u JOIN public.tenants AS t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.status = ''active'' AND t.status = ''active''
      AND u.role = ''admin'' AND t.product_key = ''bella_hq''
  );
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=pg_catalog, public']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.is_hq_super_admin()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.is_hq_admin()')
    AND prosrc='
  SELECT public.is_hq_super_admin();
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=pg_catalog, public']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.is_hq_admin()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.mobility_tenant_access_allowed(uuid,uuid)')
    AND prosrc='
  SELECT
    p_tenant_id = public.get_auth_tenant_id()
    AND (
      (
        p_org_unit_id IS NULL
        AND auth.uid() IS NOT NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_org_unit_access access
        WHERE access.tenant_id = p_tenant_id
          AND access.org_unit_id = p_org_unit_id
          AND access.user_id = auth.uid()
      )
    );
' AND prosecdef=false
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=public']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.mobility_tenant_access_allowed(uuid,uuid)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.prevent_auto_vehicle_sale_ledger_mutation()')
    AND prosrc='
BEGIN
  RAISE EXCEPTION ''AutoMove vehicle sale recognition ledgers are append-only.'';
END;
' AND prosecdef=false
    AND pg_get_userbyid(proowner)='postgres' AND proconfig IS NULL)
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.prevent_auto_vehicle_sale_ledger_mutation()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.validate_auto_vehicle_sale_recognition_tenant()')
    AND prosrc='
DECLARE
  vehicle_tenant_id UUID;
  customer_tenant_id UUID;
  actor_tenant_id UUID;
  policy_exists BOOLEAN;
  booking_row RECORD;
BEGIN
  IF to_regclass(''public.policy_registry'') IS NULL THEN
    RAISE EXCEPTION ''Vehicle sale recognition requires policy_registry before inserts are allowed.'';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.policy_registry
     WHERE policy_id = NEW.accounting_policy_id
       AND version = NEW.accounting_policy_version
  )
    INTO policy_exists;

  IF NOT policy_exists THEN
    RAISE EXCEPTION ''Vehicle sale recognition references an unregistered accounting policy version.'';
  END IF;

  SELECT tenant_id
    INTO vehicle_tenant_id
    FROM public.auto_vehicles
   WHERE id = NEW.vehicle_id;

  IF vehicle_tenant_id IS NULL OR vehicle_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION ''Vehicle sale recognition references a vehicle outside the recognition tenant.'';
  END IF;

  SELECT tenant_id
    INTO customer_tenant_id
    FROM public.customers
   WHERE id = NEW.customer_id;

  IF customer_tenant_id IS NULL OR customer_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION ''Vehicle sale recognition references a customer outside the recognition tenant.'';
  END IF;

  IF NEW.booking_id IS NOT NULL THEN
    IF to_regclass(''public.auto_bookings'') IS NULL THEN
      RAISE EXCEPTION ''Vehicle sale recognition booking evidence cannot be validated because auto_bookings is unavailable.'';
    END IF;

    SELECT tenant_id, customer_id, vehicle_id
      INTO booking_row
      FROM public.auto_bookings
     WHERE id = NEW.booking_id;

    IF booking_row.tenant_id IS NULL OR booking_row.tenant_id <> NEW.tenant_id THEN
      RAISE EXCEPTION ''Vehicle sale recognition references a booking outside the recognition tenant.'';
    END IF;

    IF booking_row.customer_id <> NEW.customer_id THEN
      RAISE EXCEPTION ''Vehicle sale recognition customer does not match the booking customer.'';
    END IF;

    IF booking_row.vehicle_id IS NOT NULL AND booking_row.vehicle_id <> NEW.vehicle_id THEN
      RAISE EXCEPTION ''Vehicle sale recognition vehicle does not match the booking vehicle.'';
    END IF;
  END IF;

  IF NEW.recognized_by_user_id IS NOT NULL THEN
    SELECT tenant_id
      INTO actor_tenant_id
      FROM public.users
     WHERE id = NEW.recognized_by_user_id;

    IF actor_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION ''Vehicle sale recognition actor is outside the recognition tenant.'';
    END IF;
  END IF;

  RETURN NEW;
END;
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=public, pg_temp']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.validate_auto_vehicle_sale_recognition_tenant()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.validate_auto_vehicle_sale_adjustment_tenant()')
    AND prosrc='
DECLARE
  recognition_tenant_id UUID;
  actor_tenant_id UUID;
  policy_exists BOOLEAN;
BEGIN
  IF to_regclass(''public.policy_registry'') IS NULL THEN
    RAISE EXCEPTION ''Vehicle sale recognition adjustment requires policy_registry before inserts are allowed.'';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.policy_registry
     WHERE policy_id = NEW.accounting_policy_id
       AND version = NEW.accounting_policy_version
  )
    INTO policy_exists;

  IF NOT policy_exists THEN
    RAISE EXCEPTION ''Vehicle sale recognition adjustment references an unregistered accounting policy version.'';
  END IF;

  SELECT tenant_id
    INTO recognition_tenant_id
    FROM public.auto_vehicle_sale_recognitions
   WHERE id = NEW.recognition_id;

  IF recognition_tenant_id IS NULL OR recognition_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION ''Vehicle sale recognition adjustment references a recognition outside the adjustment tenant.'';
  END IF;

  IF NEW.created_by_user_id IS NOT NULL THEN
    SELECT tenant_id
      INTO actor_tenant_id
      FROM public.users
     WHERE id = NEW.created_by_user_id;

    IF actor_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION ''Vehicle sale recognition adjustment actor is outside the adjustment tenant.'';
    END IF;
  END IF;

  RETURN NEW;
END;
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=public, pg_temp']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.validate_auto_vehicle_sale_adjustment_tenant()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.guard_automove_financial_snapshot()')
    AND prosrc='
DECLARE
  actor_row RECORD;
  booking_row RECORD;
BEGIN
  IF TG_OP = ''DELETE'' THEN
    RAISE EXCEPTION ''Financial source snapshots cannot be deleted.'';
  END IF;
  IF TG_OP = ''UPDATE'' THEN
    IF OLD.status <> ''draft'' THEN
      RAISE EXCEPTION ''Approved financial snapshots are immutable.'';
    END IF;
    IF current_setting(''role'', true) <> ''service_role'' THEN
      RAISE EXCEPTION ''Snapshot changes require the server action.'';
    END IF;
    IF NEW.status = ''draft'' THEN
      IF (to_jsonb(NEW) - ARRAY[''sale_price'',''discount_amount'',''cost_basis'',''sale_document'',''cost_document'']) IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY[''sale_price'',''discount_amount'',''cost_basis'',''sale_document'',''cost_document'']) THEN
        RAISE EXCEPTION ''Draft correction can change only financial values and source documents.'';
      END IF;
    ELSIF NEW.status = ''approved'' THEN
      IF (to_jsonb(NEW) - ARRAY[''status'',''approved_by'',''approved_at'']) IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY[''status'',''approved_by'',''approved_at'']) THEN
        RAISE EXCEPTION ''Approval cannot change financial values or source documents.'';
      END IF;
      IF NEW.approved_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION ''Approval actor must match authenticated identity.'';
      END IF;
    ELSE
      RAISE EXCEPTION ''Invalid financial snapshot state transition.'';
    END IF;
    SELECT tenant_id, role, status INTO actor_row FROM public.users WHERE id = auth.uid();
  ELSE
    IF NEW.status <> ''draft'' OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN
      RAISE EXCEPTION ''New snapshots must be unapproved drafts.'';
    END IF;
    IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION ''Snapshot creator must match authenticated identity.'';
    END IF;
    SELECT tenant_id, role, status INTO actor_row FROM public.users WHERE id = NEW.created_by;
  END IF;
  IF actor_row.tenant_id IS DISTINCT FROM NEW.tenant_id OR
     actor_row.status IS DISTINCT FROM ''active'' OR actor_row.role IS DISTINCT FROM ''accountant'' THEN
    RAISE EXCEPTION ''An active tenant accountant is required.'';
  END IF;
  SELECT tenant_id, customer_id, vehicle_id, status, payment_status INTO booking_row
    FROM public.auto_bookings WHERE id = NEW.booking_id;
  IF booking_row.tenant_id IS DISTINCT FROM NEW.tenant_id OR
     booking_row.customer_id IS DISTINCT FROM NEW.customer_id OR
     booking_row.vehicle_id IS DISTINCT FROM NEW.vehicle_id OR
     booking_row.status = ''cancelled'' OR booking_row.payment_status = ''refunded'' OR
     NOT EXISTS (SELECT 1 FROM public.auto_vehicles WHERE id = NEW.vehicle_id AND tenant_id = NEW.tenant_id) OR
     NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION ''Snapshot business references are invalid.'';
  END IF;
  RETURN NEW;
END;
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=public, pg_temp']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.guard_automove_financial_snapshot()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.guard_automove_post_sale_receipt()')
    AND prosrc='
DECLARE
  booking_row RECORD;
  recognition_row RECORD;
  deposit_total NUMERIC;
  payment_total NUMERIC;
  refund_total NUMERIC;
  price_delta NUMERIC;
BEGIN
  IF TG_OP <> ''INSERT'' THEN RAISE EXCEPTION ''AutoMove sale receipts are append-only.''; END IF;
  IF NEW.received_by IS DISTINCT FROM auth.uid() OR NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=auth.uid() AND u.status=''active'' AND u.role=''accountant''
      AND u.tenant_id=NEW.tenant_id AND t.status=''active''
  ) THEN RAISE EXCEPTION ''An active tenant accountant must record the receipt.''; END IF;
  SELECT * INTO booking_row FROM public.auto_bookings WHERE id=NEW.booking_id AND tenant_id=NEW.tenant_id FOR UPDATE;
  IF booking_row.id IS NULL OR booking_row.status=''cancelled'' OR booking_row.payment_status=''refunded'' THEN
    RAISE EXCEPTION ''Booking is unavailable for collection.'';
  END IF;
  SELECT * INTO recognition_row FROM public.auto_vehicle_sale_recognitions
    WHERE id=NEW.recognition_id AND tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id;
  IF recognition_row.id IS NULL OR recognition_row.customer_id IS DISTINCT FROM booking_row.customer_id OR
     recognition_row.vehicle_id IS DISTINCT FROM booking_row.vehicle_id OR
     (SELECT count(*) FROM public.auto_vehicle_sale_recognitions WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id) <> 1 THEN
    RAISE EXCEPTION ''Receipt must reference the canonical sale for this booking.'';
  END IF;
  IF EXISTS (SELECT 1 FROM public.auto_vehicle_sale_recognition_adjustments
    WHERE tenant_id=NEW.tenant_id AND recognition_id=NEW.recognition_id AND
      (refund_amount<>0 OR receivable_delta<>sale_price_delta OR adjustment_type IN (''refund_recorded'',''sale_revenue_reversed''))) THEN
    RAISE EXCEPTION ''Settlement requires resolution of refund/reversal adjustments.'';
  END IF;
  SELECT coalesce(sum(amount),0) INTO deposit_total FROM public.auto_deposits
    WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id AND status=''confirmed'';
  IF deposit_total IS DISTINCT FROM booking_row.deposit_paid OR
     recognition_row.payment_received_total <> recognition_row.deposit_received_total OR
     recognition_row.receivable_amount_at_recognition <> recognition_row.sale_price_recognized-recognition_row.payment_received_total OR
     deposit_total < recognition_row.deposit_received_total THEN
    RAISE EXCEPTION ''Receipt/deposit reconciliation mismatch.'';
  END IF;
  SELECT coalesce(sum(sale_price_delta),0) INTO price_delta FROM public.auto_vehicle_sale_recognition_adjustments
    WHERE tenant_id=NEW.tenant_id AND recognition_id=NEW.recognition_id;
  SELECT coalesce(sum(amount),0) INTO payment_total FROM public.auto_vehicle_sale_payments
    WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id;
  SELECT coalesce(sum(amount),0) INTO refund_total FROM public.auto_vehicle_sale_settlement_actions
    WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id AND action_type=''refund'';
  IF deposit_total+payment_total-refund_total+NEW.amount > recognition_row.sale_price_recognized+price_delta THEN
    RAISE EXCEPTION ''Receipt exceeds the remaining recognized sale amount.'';
  END IF;
  NEW.received_at := statement_timestamp();
  RETURN NEW;
END;
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=public, pg_temp']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.guard_automove_post_sale_receipt()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.guard_automove_deposit_collection_cap()')
    AND prosrc='
DECLARE
  recognized_total NUMERIC;
  post_sale_total NUMERIC;
  confirmed_total NUMERIC;
  recognized_count INTEGER;
  previous_id UUID;
BEGIN
  IF NEW.status <> ''confirmed'' THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.auto_bookings
    WHERE id=NEW.booking_id AND tenant_id=NEW.tenant_id FOR UPDATE;
  SELECT coalesce(sum(amount),0) INTO post_sale_total
    FROM public.auto_vehicle_sale_payments
    WHERE booking_id=NEW.booking_id AND tenant_id=NEW.tenant_id;
  -- Before the first post-sale receipt, retain the established deposit contract.
  IF post_sale_total = 0 THEN RETURN NEW; END IF;
  SELECT count(*),sum(r.sale_price_recognized + coalesce((
    SELECT sum(a.sale_price_delta) FROM public.auto_vehicle_sale_recognition_adjustments a
      WHERE a.recognition_id=r.id AND a.tenant_id=r.tenant_id
  ),0)) INTO recognized_count,recognized_total
    FROM public.auto_vehicle_sale_recognitions r
    WHERE r.booking_id=NEW.booking_id AND r.tenant_id=NEW.tenant_id;
  IF TG_OP = ''UPDATE'' THEN previous_id := OLD.id; END IF;
  SELECT coalesce(sum(amount),0) INTO confirmed_total FROM public.auto_deposits
    WHERE booking_id=NEW.booking_id AND tenant_id=NEW.tenant_id AND status=''confirmed''
      AND id IS DISTINCT FROM previous_id;
  IF recognized_count <> 1 OR recognized_total IS NULL OR
     confirmed_total + post_sale_total + NEW.amount > recognized_total THEN
    RAISE EXCEPTION ''Combined collections exceed the canonical recognized sale balance.''
      USING ERRCODE=''23514'', CONSTRAINT=''automove_combined_collection_cap'';
  END IF;
  RETURN NEW;
END;
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=public, pg_temp']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.guard_automove_deposit_collection_cap()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.guard_automove_settlement_action()')
    AND prosrc='
DECLARE
  original_amount NUMERIC;
  returned_amount NUMERIC;
BEGIN
  IF TG_OP <> ''INSERT'' THEN RAISE EXCEPTION ''Settlement actions are append-only.''; END IF;
  IF NEW.created_by IS DISTINCT FROM auth.uid() OR NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=auth.uid() AND u.role=''accountant'' AND u.status=''active''
      AND u.tenant_id=NEW.tenant_id AND t.status=''active''
  ) THEN RAISE EXCEPTION ''An active tenant accountant is required.''; END IF;
  PERFORM id FROM public.auto_bookings WHERE id=NEW.booking_id AND tenant_id=NEW.tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION ''Settlement booking is outside the actor tenant.''; END IF;
  IF NEW.source_document->>''bucket'' IS DISTINCT FROM ''automove-sale-documents'' OR
    split_part(NEW.source_document->>''path'',''/'',1) IS DISTINCT FROM NEW.tenant_id::text OR
    coalesce(NEW.source_document->>''sha256'','''') !~ ''^[a-f0-9]{64}$'' THEN
    RAISE EXCEPTION ''Tenant source document and checksum are required.'';
  END IF;
  IF NEW.action_type=''refund'' THEN
    IF NEW.source_deposit_id IS NOT NULL THEN
      SELECT amount INTO original_amount FROM public.auto_deposits
        WHERE id=NEW.source_deposit_id AND booking_id=NEW.booking_id AND tenant_id=NEW.tenant_id AND status=''confirmed'';
    ELSE
      SELECT amount INTO original_amount FROM public.auto_vehicle_sale_payments
        WHERE id=NEW.source_payment_id AND booking_id=NEW.booking_id AND tenant_id=NEW.tenant_id;
    END IF;
    IF original_amount IS NULL THEN RAISE EXCEPTION ''Confirmed original receipt is required.''; END IF;
    SELECT coalesce(sum(amount),0) INTO returned_amount FROM public.auto_vehicle_sale_settlement_actions
      WHERE tenant_id=NEW.tenant_id AND action_type=''refund'' AND
        (source_deposit_id=NEW.source_deposit_id OR source_payment_id=NEW.source_payment_id);
    IF returned_amount+NEW.amount > original_amount THEN RAISE EXCEPTION ''Refund exceeds the unrefunded original receipt.''; END IF;
  END IF;
  NEW.created_at := statement_timestamp();
  RETURN NEW;
END;
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=public, pg_temp']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.guard_automove_settlement_action()'; END IF;
END $adoption_function_readback$;
