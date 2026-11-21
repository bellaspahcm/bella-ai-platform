-- REVIEW ROLLBACK ONLY. Run only after an explicitly authorized P2 rollback decision.
-- Reopens the Production tenant-only CRM policy baseline. Roll back the matching app release too.
BEGIN;
DO $preflight$
BEGIN
  IF current_user<>'postgres' AND NOT pg_has_role(current_user,'postgres','MEMBER') THEN
    RAISE EXCEPTION 'P2 rollback requires a role able to restore postgres-owned functions and catalog objects';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
      AND tablename IN ('interior_customers','interior_customer_contacts','interior_customer_addresses'))<>14
     OR EXISTS (WITH expected(tablename,policyname,cmd) AS (VALUES
       ('interior_customers','interior_customers_select','SELECT'),
       ('interior_customers','interior_customers_insert','INSERT'),
       ('interior_customers','interior_customers_update','UPDATE'),
       ('interior_customer_contacts','interior_customer_contacts_select','SELECT'),
       ('interior_customer_contacts','interior_customer_contacts_insert','INSERT'),
       ('interior_customer_contacts','interior_customer_contacts_update','UPDATE'),
       ('interior_customer_contacts','interior_customer_contacts_delete','DELETE'),
       ('interior_customer_addresses','interior_customer_addresses_select','SELECT'),
       ('interior_customer_addresses','interior_customer_addresses_insert','INSERT'),
       ('interior_customer_addresses','interior_customer_addresses_update','UPDATE'),
       ('interior_customer_addresses','interior_customer_addresses_delete','DELETE'))
       SELECT 1 FROM expected e LEFT JOIN pg_policies p
         ON p.schemaname='public' AND p.tablename=e.tablename AND p.policyname=e.policyname
       WHERE p.policyname IS NULL OR p.permissive<>'PERMISSIVE'
         OR p.roles::text<>'{authenticated}' OR p.cmd<>e.cmd)
     OR EXISTS (WITH expected(tablename,policyname) AS (VALUES
       ('interior_customers','tenant_isolation_policy'),
       ('interior_customer_contacts','tenant_isolation_policy'),
       ('interior_customer_addresses','tenant_isolation_policy'))
       SELECT 1 FROM expected e LEFT JOIN pg_policies p
         ON p.schemaname='public' AND p.tablename=e.tablename AND p.policyname=e.policyname
       WHERE p.policyname IS NULL OR p.permissive<>'RESTRICTIVE' OR p.cmd<>'ALL')
     OR has_table_privilege('authenticated','public.interior_customers','DELETE')
     OR has_table_privilege('authenticated','public.interior_customer_contacts','UPDATE')
     OR has_table_privilege('authenticated','public.interior_customer_addresses','UPDATE')
     OR NOT has_column_privilege('authenticated','public.interior_customer_contacts','is_primary','UPDATE')
     OR NOT has_column_privilege('authenticated','public.interior_customer_addresses','is_default','UPDATE')
     OR to_regprocedure('public.interior_guard_customer_actor_fields()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname='trg_interior_guard_customer_actor_fields') THEN
    RAISE EXCEPTION 'P2 rollback preconditions do not match the reviewed P2 state';
  END IF;
END
$preflight$;

DROP POLICY IF EXISTS interior_customers_select ON public.interior_customers;
DROP POLICY IF EXISTS interior_customers_insert ON public.interior_customers;
DROP POLICY IF EXISTS interior_customers_update ON public.interior_customers;
DROP POLICY IF EXISTS interior_customers_delete ON public.interior_customers;
CREATE POLICY interior_customers_select ON public.interior_customers AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY interior_customers_insert ON public.interior_customers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY interior_customers_update ON public.interior_customers AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY interior_customers_delete ON public.interior_customers AS PERMISSIVE FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS interior_customer_contacts_select ON public.interior_customer_contacts;
DROP POLICY IF EXISTS interior_customer_contacts_insert ON public.interior_customer_contacts;
DROP POLICY IF EXISTS interior_customer_contacts_update ON public.interior_customer_contacts;
DROP POLICY IF EXISTS interior_customer_contacts_delete ON public.interior_customer_contacts;
CREATE POLICY interior_customer_contacts_select ON public.interior_customer_contacts AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY interior_customer_contacts_insert ON public.interior_customer_contacts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY interior_customer_contacts_update ON public.interior_customer_contacts AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY interior_customer_contacts_delete ON public.interior_customer_contacts AS PERMISSIVE FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS interior_customer_addresses_select ON public.interior_customer_addresses;
DROP POLICY IF EXISTS interior_customer_addresses_insert ON public.interior_customer_addresses;
DROP POLICY IF EXISTS interior_customer_addresses_update ON public.interior_customer_addresses;
DROP POLICY IF EXISTS interior_customer_addresses_delete ON public.interior_customer_addresses;
CREATE POLICY interior_customer_addresses_select ON public.interior_customer_addresses AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY interior_customer_addresses_insert ON public.interior_customer_addresses AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY interior_customer_addresses_update ON public.interior_customer_addresses AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY interior_customer_addresses_delete ON public.interior_customer_addresses AS PERMISSIVE FOR DELETE TO authenticated USING (true);

GRANT SELECT,INSERT,UPDATE ON TABLE public.interior_customers TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.interior_customer_contacts TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.interior_customer_addresses TO authenticated;
REVOKE INSERT(id,tenant_id,code,name,legal_name,tax_code,type,tier,primary_phone,primary_email,notes,assigned_staff_id),
  UPDATE(name,legal_name,tax_code,type,tier,profile_status,primary_phone,primary_email,notes,assigned_staff_id)
  ON TABLE public.interior_customers FROM authenticated;
REVOKE INSERT(tenant_id,customer_id,name,role,phone,email,position,is_primary),
  UPDATE(name,role,phone,email,position,is_primary)
  ON TABLE public.interior_customer_contacts FROM authenticated;
REVOKE INSERT(tenant_id,customer_id,address_type,full_address,ward,district,city,is_default),
  UPDATE(address_type,full_address,ward,district,city,is_default)
  ON TABLE public.interior_customer_addresses FROM authenticated;
DROP TRIGGER IF EXISTS trg_interior_guard_customer_actor_fields ON public.interior_customers;
DROP FUNCTION IF EXISTS public.interior_guard_customer_actor_fields();

-- Captured directly from Production before P2.
CREATE OR REPLACE FUNCTION public.interior_execute_customer_merge(p_tenant_id uuid, p_source_customer_id uuid, p_target_customer_id uuid, p_reason text, p_actor_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_auth_tenant UUID;
  v_effective_tenant UUID;
  v_effective_actor UUID;
  v_source public.interior_customers%ROWTYPE;
  v_target public.interior_customers%ROWTYPE;
  v_contacts_transferred INTEGER := 0;
  v_addresses_transferred INTEGER := 0;
BEGIN
  -- 1. Security & Identity Reconciliation
  v_auth_tenant := public.interior_actor_tenant();

  IF auth.role() = 'authenticated' THEN
    IF v_auth_tenant IS NULL THEN
      RAISE EXCEPTION 'AUTHENTICATED_INTERIOR_TENANT_REQUIRED';
    END IF;
    IF p_tenant_id IS NOT NULL AND p_tenant_id IS DISTINCT FROM v_auth_tenant THEN
      RAISE EXCEPTION 'TENANT_FORBIDDEN: Cannot merge customers of foreign tenant';
    END IF;
    v_effective_tenant := v_auth_tenant;
    -- Strictly override actor_id with verified auth.uid()
    v_effective_actor := auth.uid();
  ELSIF auth.role() = 'service_role' THEN
    IF p_tenant_id IS NULL THEN
      RAISE EXCEPTION 'TENANT_ID_REQUIRED_FOR_SERVICE_ROLE';
    END IF;
    v_effective_tenant := p_tenant_id;
    v_effective_actor := p_actor_id;
  ELSE
    RAISE EXCEPTION 'UNAUTHORIZED_CALLER_ROLE';
  END IF;

  IF p_source_customer_id = p_target_customer_id THEN
    RAISE EXCEPTION 'CUSTOMER_MERGE_SELF_NOT_ALLOWED';
  END IF;

  -- 2. Concurrency-Safe Ordered Locking (Deadlock Prevention)
  IF p_source_customer_id < p_target_customer_id THEN
    SELECT * INTO v_source FROM public.interior_customers
      WHERE id = p_source_customer_id AND tenant_id = v_effective_tenant FOR UPDATE;
    SELECT * INTO v_target FROM public.interior_customers
      WHERE id = p_target_customer_id AND tenant_id = v_effective_tenant FOR UPDATE;
  ELSE
    SELECT * INTO v_target FROM public.interior_customers
      WHERE id = p_target_customer_id AND tenant_id = v_effective_tenant FOR UPDATE;
    SELECT * INTO v_source FROM public.interior_customers
      WHERE id = p_source_customer_id AND tenant_id = v_effective_tenant FOR UPDATE;
  END IF;

  -- 3. Existence & State Validation
  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'SOURCE_CUSTOMER_NOT_FOUND';
  END IF;

  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'TARGET_CUSTOMER_NOT_FOUND';
  END IF;

  IF v_source.profile_status = 'merged' THEN
    RAISE EXCEPTION 'CUSTOMER_ALREADY_MERGED';
  END IF;

  IF v_target.profile_status = 'merged' THEN
    RAISE EXCEPTION 'TARGET_CUSTOMER_CANNOT_BE_MERGED_STATE';
  END IF;

  -- 4. Cycle Detection in Existing Aliases
  IF EXISTS (
    SELECT 1 FROM public.interior_customer_aliases
    WHERE tenant_id = v_effective_tenant
      AND source_customer_id = p_target_customer_id
      AND target_customer_id = p_source_customer_id
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_MERGE_CYCLE_DETECTED';
  END IF;

  -- 5. Reassign Contacts
  WITH moved_contacts AS (
    UPDATE public.interior_customer_contacts
    SET customer_id = p_target_customer_id,
        updated_at = statement_timestamp()
    WHERE customer_id = p_source_customer_id
      AND tenant_id = v_effective_tenant
    RETURNING id
  )
  SELECT count(*) INTO v_contacts_transferred FROM moved_contacts;

  -- 6. Reassign Addresses
  WITH moved_addresses AS (
    UPDATE public.interior_customer_addresses
    SET customer_id = p_target_customer_id,
        updated_at = statement_timestamp()
    WHERE customer_id = p_source_customer_id
      AND tenant_id = v_effective_tenant
    RETURNING id
  )
  SELECT count(*) INTO v_addresses_transferred FROM moved_addresses;

  -- 7. Register Source -> Target Alias
  INSERT INTO public.interior_customer_aliases (
    tenant_id,
    source_customer_id,
    target_customer_id,
    created_at
  )
  VALUES (
    v_effective_tenant,
    p_source_customer_id,
    p_target_customer_id,
    statement_timestamp()
  );

  -- 8. Flatten Existing Transitive Aliases Pointing to Source -> Update to Target
  UPDATE public.interior_customer_aliases
  SET target_customer_id = p_target_customer_id
  WHERE target_customer_id = p_source_customer_id
    AND tenant_id = v_effective_tenant;

  -- 9. Mark Source Customer as Merged
  UPDATE public.interior_customers
  SET profile_status = 'merged',
      merged_into_id = p_target_customer_id,
      updated_at = statement_timestamp()
  WHERE id = p_source_customer_id
    AND tenant_id = v_effective_tenant;

  -- 10. Record Audit Merge Log
  INSERT INTO public.interior_customer_merge_logs (
    tenant_id,
    source_customer_id,
    target_customer_id,
    actor_id,
    reason,
    contacts_transferred_count,
    addresses_transferred_count,
    merged_at
  )
  VALUES (
    v_effective_tenant,
    p_source_customer_id,
    p_target_customer_id,
    v_effective_actor,
    p_reason,
    v_contacts_transferred,
    v_addresses_transferred,
    statement_timestamp()
  );

  RETURN jsonb_build_object(
    'success', true,
    'sourceCustomerId', p_source_customer_id,
    'targetCustomerId', p_target_customer_id,
    'contactsTransferred', v_contacts_transferred,
    'addressesTransferred', v_addresses_transferred,
    'canonicalId', p_target_customer_id
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.interior_generate_customer_code(p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_auth_tenant UUID;
  v_effective_tenant UUID;
  v_val BIGINT;
BEGIN
  v_auth_tenant := public.interior_actor_tenant();

  IF auth.role() = 'authenticated' THEN
    IF v_auth_tenant IS NULL THEN
      RAISE EXCEPTION 'AUTHENTICATED_INTERIOR_TENANT_REQUIRED';
    END IF;
    IF p_tenant_id IS NOT NULL AND p_tenant_id IS DISTINCT FROM v_auth_tenant THEN
      RAISE EXCEPTION 'TENANT_FORBIDDEN: Cannot generate customer code for foreign tenant';
    END IF;
    v_effective_tenant := v_auth_tenant;
  ELSIF auth.role() = 'service_role' THEN
    IF p_tenant_id IS NULL THEN
      RAISE EXCEPTION 'TENANT_ID_REQUIRED_FOR_SERVICE_ROLE';
    END IF;
    v_effective_tenant := p_tenant_id;
  ELSE
    RAISE EXCEPTION 'UNAUTHORIZED_CALLER_ROLE';
  END IF;

  INSERT INTO public.interior_customer_sequences(tenant_id, last_val, updated_at)
  VALUES (v_effective_tenant, 1, statement_timestamp())
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    last_val = public.interior_customer_sequences.last_val + 1,
    updated_at = statement_timestamp()
  RETURNING last_val INTO v_val;

  RETURN 'KH-' || lpad(v_val::text, 6, '0');
END;
$function$;
REVOKE ALL ON FUNCTION public.interior_execute_customer_merge(uuid,uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_execute_customer_merge(uuid,uuid,uuid,text,uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_generate_customer_code(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_generate_customer_code(uuid) TO authenticated,service_role;

DELETE FROM public.interior_role_permissions WHERE permission_id IN (
  'interior:customer:create','interior:customer:update','interior:customer:merge',
  'interior:customer_contact:read','interior:customer_contact:create','interior:customer_contact:update',
  'interior:customer_contact:delete','interior:customer_address:read','interior:customer_address:create',
  'interior:customer_address:update','interior:customer_address:delete');
DELETE FROM public.interior_permissions WHERE permission_id IN (
  'interior:customer:create','interior:customer:update','interior:customer:merge',
  'interior:customer_contact:read','interior:customer_contact:create','interior:customer_contact:update',
  'interior:customer_contact:delete','interior:customer_address:read','interior:customer_address:create',
  'interior:customer_address:update','interior:customer_address:delete');
COMMIT;
