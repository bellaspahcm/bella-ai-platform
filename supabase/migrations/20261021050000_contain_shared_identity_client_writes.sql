-- Owner-approved fail-closed identity containment. Preserve SELECT, policies,
-- function bodies, maintenance ACLs, Auth data and all other relations.
-- Reconcile staff/profile writer permissions through a proven contract before
-- reopening any direct client mutation. Do not replace this with service bypass.
DO $identity_client_boundary$
DECLARE
  client_role text;
  privilege_name text;
  writer_signature text;
  writer_oid regprocedure;
  execution_role record;
  maintenance_roles text[] := ARRAY['postgres','service_role','bella_migration_executor'];
  known_table_grantees text[] := ARRAY[
    'postgres','anon','authenticated','service_role','bella_developer',
    'bella_migration_executor','verification_executor'
  ];
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Shared users prerequisite missing; do not apply partial identity containment';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid='public.users'::regclass AND attnum>0 AND NOT attisdropped
      AND coalesce(cardinality(attacl),0)>0
  ) THEN
    RAISE EXCEPTION 'Unreviewed shared users column ACL; review before changing privileges';
  END IF;

  -- Do not silently absorb a new direct grantee or a column/inherited path.
  IF EXISTS (
    SELECT 1 FROM pg_class c
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    WHERE c.oid='public.users'::regclass
      AND a.privilege_type<>'SELECT'
      AND (a.grantee=0 OR pg_get_userbyid(a.grantee)<>ALL(known_table_grantees))
  ) THEN
    RAISE EXCEPTION 'Unreviewed shared users mutation grantee';
  END IF;

  FOREACH writer_signature IN ARRAY ARRAY[
    'public.create_onboarding_user(text,text,text)',
    'public.onboard_tenant(text,text,text,text,uuid,text,text)'
  ] LOOP
    writer_oid := to_regprocedure(writer_signature);
    IF writer_oid IS NULL THEN
      RAISE EXCEPTION 'Identity writer prerequisite missing: %',writer_signature;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE p.oid=writer_oid AND a.grantee<>0
        AND pg_get_userbyid(a.grantee)<>ALL(maintenance_roles || ARRAY['anon','authenticated'])
    ) THEN
      RAISE EXCEPTION 'Unreviewed identity writer grantee: %',writer_signature;
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC',writer_oid);
    FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=client_role) THEN
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM %I',writer_oid,client_role);
      END IF;
    END LOOP;
  END LOOP;

  FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=client_role) THEN
      EXECUTE format('REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.users FROM %I',client_role);
      FOREACH privilege_name IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
        IF has_table_privilege(client_role,'public.users',privilege_name) THEN
          RAISE EXCEPTION 'Inherited users mutation privilege remains for %',client_role;
        END IF;
      END LOOP;
      IF has_any_column_privilege(client_role,'public.users','INSERT,UPDATE,REFERENCES') THEN
        RAISE EXCEPTION 'Column users mutation privilege remains for %',client_role;
      END IF;
      FOREACH writer_signature IN ARRAY ARRAY[
        'public.create_onboarding_user(text,text,text)',
        'public.onboard_tenant(text,text,text,text,uuid,text,text)'
      ] LOOP
        IF has_function_privilege(client_role,writer_signature,'EXECUTE') THEN
          RAISE EXCEPTION 'Inherited identity writer privilege remains for %',client_role;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  -- Removing PUBLIC intentionally removes inherited access for other client
  -- roles too. Never convert their old PUBLIC access to explicit writer grants.
  FOR execution_role IN SELECT rolname FROM pg_roles
    WHERE NOT rolsuper AND rolname<>ALL(maintenance_roles)
  LOOP
    FOREACH writer_signature IN ARRAY ARRAY[
      'public.create_onboarding_user(text,text,text)',
      'public.onboard_tenant(text,text,text,text,uuid,text,text)'
    ] LOOP
      IF has_function_privilege(execution_role.rolname,writer_signature,'EXECUTE') THEN
        RAISE EXCEPTION 'Unreviewed inherited identity writer privilege for %',execution_role.rolname;
      END IF;
    END LOOP;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.oid IN(
      'public.create_onboarding_user(text,text,text)'::regprocedure,
      'public.onboard_tenant(text,text,text,text,uuid,text,text)'::regprocedure
    ) AND (a.grantee=0 OR pg_get_userbyid(a.grantee)<>ALL(maintenance_roles))
  ) THEN
    RAISE EXCEPTION 'Unexpected identity writer grant remains';
  END IF;
END;
$identity_client_boundary$;
