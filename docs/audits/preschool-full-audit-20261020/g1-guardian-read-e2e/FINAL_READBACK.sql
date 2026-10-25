BEGIN;
SET LOCAL statement_timeout='15s';
DO $g1_readback$
DECLARE f record;v_oid oid;v_count integer;
BEGIN
 IF (SELECT md5(system_identifier::text) FROM pg_control_system())<>'58bbaa6e976181ecccc95a8084ac436a' THEN
  RAISE EXCEPTION 'G1_READBACK_WRONG_TARGET';END IF;
 FOR f IN SELECT * FROM (VALUES
  ('preschool_g1_guardians_read','public.preschool_g1_guardians_read(uuid)','1b531ba582bd0f6f49867c66f1b7e088'),
  ('edu_preschool_student_registry','public.edu_preschool_student_registry(text,text,uuid,uuid,integer,integer)','8dd5106a6d5ee18e857ffddfefdcd706')
 ) expected(name,signature,hash)
 LOOP
  v_oid:=to_regprocedure(f.signature);
  SELECT count(*) INTO v_count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname=f.name;
  IF v_count<>1 OR v_oid IS NULL OR md5(pg_get_functiondef(v_oid))<>f.hash
  OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=v_oid AND prosecdef AND provolatile='s' AND pg_get_userbyid(proowner)='postgres')
  OR NOT has_function_privilege('authenticated',v_oid,'EXECUTE')
  OR has_function_privilege('anon',v_oid,'EXECUTE') OR has_function_privilege('service_role',v_oid,'EXECUTE')
  OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
   WHERE p.oid=v_oid AND x.privilege_type='EXECUTE' AND x.grantee NOT IN(p.proowner,(SELECT oid FROM pg_roles WHERE rolname='authenticated')))
  THEN RAISE EXCEPTION 'G1_READBACK_CAPABILITY_DRIFT';END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.students WHERE id='f1c10004-2026-4000-8000-000000000001' OR student_id='f1c10005-2026-4000-8000-000000000001')
 OR EXISTS(SELECT 1 FROM public.org_units WHERE id='f1c10001-2026-4000-8000-000000000001')
 OR EXISTS(SELECT 1 FROM public.edu_courses WHERE id='f1c10002-2026-4000-8000-000000000001')
 OR EXISTS(SELECT 1 FROM public.party_parties WHERE id='f1c10003-2026-4000-8000-000000000001')
 OR EXISTS(SELECT 1 FROM public.edu_enrollments WHERE id='f1c10006-2026-4000-8000-000000000001' OR request_id='g1-branch-denial-20261025')
 OR EXISTS(SELECT 1 FROM public.preschool_chain_course_branch_assignments WHERE id='f1c10007-2026-4000-8000-000000000001')
 OR EXISTS(SELECT 1 FROM public.edu_enrollment_event_records WHERE enrollment_id='f1c10006-2026-4000-8000-000000000001' OR request_id='g1-branch-denial-20261025')
 THEN RAISE EXCEPTION 'G1_READBACK_FIXTURE_RESIDUE';END IF;
END $g1_readback$;
SELECT true AS exact_capabilities_readback_pass,true AS no_fixture_residue;
ROLLBACK;