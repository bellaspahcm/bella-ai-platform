BEGIN READ ONLY;
SET LOCAL statement_timeout='20s';
SET LOCAL ROLE anon;
DO $client_denied$ BEGIN
  BEGIN EXECUTE 'EXPLAIN UPDATE public.users SET role=''admin'' WHERE false';
    RAISE EXCEPTION 'Unexpected anon users UPDATE access';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN EXECUTE 'EXPLAIN INSERT INTO public.users(id,email,full_name,role) VALUES(NULL,NULL,NULL,NULL)';
    RAISE EXCEPTION 'Unexpected anon users INSERT access';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN EXECUTE 'EXPLAIN DELETE FROM public.users WHERE false';
    RAISE EXCEPTION 'Unexpected anon users DELETE access';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.create_onboarding_user(NULL,NULL,NULL);
    RAISE EXCEPTION 'Unexpected anon account writer access';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.onboard_tenant(NULL,NULL,NULL,NULL,NULL,NULL,NULL);
    RAISE EXCEPTION 'Unexpected anon tenant writer access';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $client_denied$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $client_denied$ BEGIN
  BEGIN EXECUTE 'EXPLAIN UPDATE public.users SET tenant_id=NULL WHERE false';
    RAISE EXCEPTION 'Unexpected authenticated users UPDATE access';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN EXECUTE 'EXPLAIN INSERT INTO public.users(id,email,full_name,role) VALUES(NULL,NULL,NULL,NULL)';
    RAISE EXCEPTION 'Unexpected authenticated users INSERT access';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN EXECUTE 'EXPLAIN DELETE FROM public.users WHERE false';
    RAISE EXCEPTION 'Unexpected authenticated users DELETE access';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.create_onboarding_user(NULL,NULL,NULL);
    RAISE EXCEPTION 'Unexpected authenticated account writer access';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.onboard_tenant(NULL,NULL,NULL,NULL,NULL,NULL,NULL);
    RAISE EXCEPTION 'Unexpected authenticated tenant writer access';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $client_denied$;
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT id FROM public.users LIMIT 0;
RESET ROLE;
SELECT jsonb_build_object(
 'result','ACTUAL_READ_ONLY_ROLE_DENIALS_PASS',
 'anon_users_dml_plans','42501','authenticated_users_dml_plans','42501',
 'anon_both_writer_calls','42501','authenticated_both_writer_calls','42501',
 'denied_dml_plan_checks',6,'denied_actual_rpc_calls',4,'service_users_select','ALLOWED_LIMIT0',
 'business_writes',0,'writer_bodies_executed',0,'real_user_jwt',false
) AS evidence;
ROLLBACK;
