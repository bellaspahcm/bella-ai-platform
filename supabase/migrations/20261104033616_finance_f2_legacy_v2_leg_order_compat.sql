BEGIN;

-- Legacy F1 v2 outbox functions aggregate candidate cash legs without an
-- ORDER BY. Normalize only the fetched payload in the F2 projector's local
-- variable before the canonical comparison; persisted v1/v2 outbox events
-- remain immutable.
DO $migration$
DECLARE
    v_function_oid oid := 'public.finance_f2_project_v2_event(uuid,uuid)'::regprocedure;
    v_function_definition text;
    v_function_source text;
    v_updated_definition text;
    v_function_owner text;
    v_security_definer boolean;
    v_function_config text[];
    v_function_acl text[];
    v_marker constant text := '    IF v_payload IS DISTINCT FROM v_expected_payload THEN';
    v_replacement constant text := $normalization$
    v_payload := pg_catalog.jsonb_set(
        v_payload,
        '{candidate_cash_legs}',
        COALESCE((
            SELECT pg_catalog.jsonb_agg(
                leg.value
                ORDER BY (leg.value ->> 'cash_leg_id')::uuid
            )
            FROM pg_catalog.jsonb_array_elements(v_payload -> 'candidate_cash_legs') AS leg(value)
        ), '[]'::jsonb),
        false
    );

    IF v_payload IS DISTINCT FROM v_expected_payload THEN
$normalization$;
    v_expected_acl constant text[] := ARRAY[
        'postgres=EXECUTE/postgres',
        'service_role=EXECUTE/postgres'
    ];
BEGIN
    SELECT pg_catalog.pg_get_functiondef(p.oid),
           p.prosrc,
           owner_role.rolname,
           p.prosecdef,
           p.proconfig,
           ARRAY(
               SELECT CASE
                          WHEN acl.grantee = 0 THEN 'PUBLIC'
                          ELSE acl.grantee::regrole::text
                      END
                      || '=' || acl.privilege_type
                      || '/' || acl.grantor::regrole::text
                      || CASE WHEN acl.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
               FROM pg_catalog.aclexplode(
                   COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
               ) AS acl
               ORDER BY 1
           )
    INTO v_function_definition,
         v_function_source,
         v_function_owner,
         v_security_definer,
         v_function_config,
         v_function_acl
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_roles AS owner_role
      ON owner_role.oid = p.proowner
    WHERE p.oid = v_function_oid;

    IF v_function_definition IS NULL THEN
        RAISE EXCEPTION 'F2 projector is missing; refusing compatibility replacement'
            USING ERRCODE = 'F2043';
    END IF;

    IF pg_catalog.md5(v_function_source) <> '3e888e0347d395865386338552f5f1f1'
       OR v_function_owner <> 'postgres'
       OR v_security_definer IS DISTINCT FROM true
       OR v_function_config IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
       OR v_function_acl IS DISTINCT FROM v_expected_acl
       OR pg_catalog.has_function_privilege('anon', v_function_oid, 'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticated', v_function_oid, 'EXECUTE')
       OR NOT pg_catalog.has_function_privilege('service_role', v_function_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'F2 projector catalog differs from the reviewed compatibility baseline'
            USING ERRCODE = 'F2044';
    END IF;

    IF pg_catalog.length(v_function_definition)
           - pg_catalog.length(pg_catalog.replace(v_function_definition, v_marker, ''))
       <> pg_catalog.length(v_marker) THEN
        RAISE EXCEPTION 'F2 projector canonical comparison marker is missing or ambiguous'
            USING ERRCODE = 'F2045';
    END IF;

    v_updated_definition := pg_catalog.replace(
        v_function_definition,
        v_marker,
        v_replacement
    );

    EXECUTE v_updated_definition;

    SELECT p.prosrc,
           owner_role.rolname,
           p.prosecdef,
           p.proconfig,
           ARRAY(
               SELECT CASE
                          WHEN acl.grantee = 0 THEN 'PUBLIC'
                          ELSE acl.grantee::regrole::text
                      END
                      || '=' || acl.privilege_type
                      || '/' || acl.grantor::regrole::text
                      || CASE WHEN acl.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
               FROM pg_catalog.aclexplode(
                   COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
               ) AS acl
               ORDER BY 1
           )
    INTO v_function_source,
         v_function_owner,
         v_security_definer,
         v_function_config,
         v_function_acl
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_roles AS owner_role
      ON owner_role.oid = p.proowner
    WHERE p.oid = v_function_oid;

    IF pg_catalog.strpos(v_function_source, 'v_payload := pg_catalog.jsonb_set(') = 0
       OR pg_catalog.strpos(v_function_source, 'ORDER BY (leg.value ->> ''cash_leg_id'')::uuid') = 0
       OR pg_catalog.strpos(v_function_source, 'IF v_payload IS DISTINCT FROM v_expected_payload THEN') = 0
       OR v_function_owner <> 'postgres'
       OR v_security_definer IS DISTINCT FROM true
       OR v_function_config IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
       OR v_function_acl IS DISTINCT FROM v_expected_acl
       OR pg_catalog.has_function_privilege('anon', v_function_oid, 'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticated', v_function_oid, 'EXECUTE')
       OR NOT pg_catalog.has_function_privilege('service_role', v_function_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'F2 projector replacement failed its body or privilege postcondition'
            USING ERRCODE = 'F2046';
    END IF;
END;
$migration$;

COMMIT;
