BEGIN READ ONLY;
SELECT jsonb_build_object('candidates',coalesce(jsonb_agg(jsonb_build_object(
 'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
 'owner',pg_get_userbyid(p.proowner),'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
 'definition',pg_get_functiondef(p.oid))),'[]'::jsonb)) AS evidence
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f' AND p.prosecdef
 AND has_function_privilege('anon',p.oid,'EXECUTE')
 AND (p.prosrc ~* '\mEXECUTE\M' OR p.proname ~* '(exec.*sql|query.*sql|run.*sql|sql.*exec)');
ROLLBACK;
