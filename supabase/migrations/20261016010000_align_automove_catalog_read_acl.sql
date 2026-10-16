-- Forward-only catalog adoption. Run atomically with its checks; no owner changes.
DO $$
DECLARE
  target_name text;
  target_oid oid;
  column_name text;
  grantee_name text;
BEGIN
  IF to_regclass('public.users') IS NULL OR to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Catalog ACL alignment requires canonical users and tenants.';
  END IF;
  FOREACH target_name IN ARRAY ARRAY['auto_brands', 'auto_models', 'auto_variants'] LOOP
    target_oid := to_regclass('public.' || target_name);
    IF target_oid IS NULL OR NOT EXISTS (
      SELECT 1 FROM pg_class WHERE oid = target_oid AND relkind = 'r' AND relrowsecurity
    ) THEN
      RAISE EXCEPTION 'Catalog ACL alignment requires an existing RLS table: public.%.', target_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_roles r ON r.rolname = current_user
      WHERE c.oid = target_oid AND (r.rolsuper OR pg_has_role(current_user, c.relowner, 'USAGE'))
    ) THEN
      RAISE EXCEPTION 'Catalog ACL alignment requires table-owner DDL authority: public.%.', target_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute WHERE attrelid = target_oid AND attname = 'tenant_id'
        AND atttypid = 'uuid'::regtype AND attnum > 0 AND NOT attisdropped
    ) THEN
      RAISE EXCEPTION 'Catalog ACL alignment requires canonical uuid tenant_id: public.%.', target_name;
    END IF;
  END LOOP;

  FOREACH target_name IN ARRAY ARRAY['auto_brands', 'auto_models', 'auto_variants'] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM PUBLIC, anon, authenticated', target_name);
    EXECUTE format('REVOKE SELECT ON TABLE public.%I FROM PUBLIC, anon', target_name);
    -- Table revocation does not remove column grants or privileges inherited via roles.
    FOR column_name IN
      SELECT attname FROM pg_attribute
      WHERE attrelid = to_regclass('public.' || target_name) AND attnum > 0 AND NOT attisdropped
    LOOP
      EXECUTE format('REVOKE INSERT (%I), UPDATE (%I), REFERENCES (%I) ON TABLE public.%I FROM PUBLIC, anon, authenticated',
        column_name, column_name, column_name, target_name);
      EXECUTE format('REVOKE SELECT (%I) ON TABLE public.%I FROM PUBLIC, anon', column_name, target_name);
    END LOOP;

    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', target_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', target_name || '_tenant_read_access', target_name);
    EXECUTE format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
        WHERE u.id = (SELECT auth.uid()) AND u.status = ''active''
          AND u.tenant_id = %I.tenant_id AND t.status = ''active''))',
      target_name || '_tenant_read_access', target_name, target_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', target_name || '_tenant_read_guard', target_name);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
        WHERE u.id = (SELECT auth.uid()) AND u.status = ''active''
          AND u.tenant_id = %I.tenant_id AND t.status = ''active''))',
      target_name || '_tenant_read_guard', target_name, target_name);

    FOREACH grantee_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_table_privilege(grantee_name, 'public.' || target_name, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
         OR has_any_column_privilege(grantee_name, 'public.' || target_name, 'INSERT,UPDATE,REFERENCES') THEN
        RAISE EXCEPTION 'Catalog inherited write privileges require separate authority: public.%, role %.', target_name, grantee_name;
      END IF;
    END LOOP;
    IF has_any_column_privilege('anon', 'public.' || target_name, 'SELECT')
       OR NOT has_table_privilege('authenticated', 'public.' || target_name, 'SELECT') THEN
      RAISE EXCEPTION 'Catalog effective SELECT contract not satisfied: public.%.', target_name;
    END IF;
  END LOOP;
END $$;
