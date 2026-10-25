-- Exact synthetic fixture cleanup is one atomic statement; no partial autocommit.
DO $fixture_cleanup$
DECLARE v_tenant uuid;v_target record;v_fk record;v_external boolean;v_owned text;v_deleted integer;
BEGIN
 SELECT tenant_id INTO STRICT v_tenant FROM public.students
 WHERE id='f1c10004-2026-4000-8000-000000000001'
  AND student_id='f1c10005-2026-4000-8000-000000000001'
  AND party_id='f1c10003-2026-4000-8000-000000000001'
  AND student_code='G1-DENIAL-20261025' AND academic_status='enrolled'
  AND metadata->>'g1Fixture'='20261025' FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.org_units WHERE id='f1c10001-2026-4000-8000-000000000001'
  AND tenant_id=v_tenant AND unit_type='branch' AND is_active AND code='G1-DENIAL-20261025'
  AND metadata->>'g1Fixture'='20261025')
 OR NOT EXISTS(SELECT 1 FROM public.edu_courses WHERE id='f1c10002-2026-4000-8000-000000000001'
  AND tenant_id=v_tenant AND course_code='G1-DENIAL-20261025' AND title='G1 Synthetic Denial Class'
  AND status='active' AND max_students=1 AND current_enrollment=1)
 OR NOT EXISTS(SELECT 1 FROM public.party_parties WHERE id='f1c10003-2026-4000-8000-000000000001'
  AND tenant_id=v_tenant AND party_type='person' AND display_name='G1 Synthetic Denial Student'
  AND dob='2022-01-01' AND gender='female' AND deleted_at IS NULL)
 OR NOT EXISTS(SELECT 1 FROM public.preschool_chain_course_branch_assignments WHERE id='f1c10007-2026-4000-8000-000000000001'
  AND tenant_id=v_tenant AND course_id='f1c10002-2026-4000-8000-000000000001'
  AND branch_id='f1c10001-2026-4000-8000-000000000001')
 OR NOT EXISTS(SELECT 1 FROM public.edu_enrollments WHERE id='f1c10006-2026-4000-8000-000000000001'
  AND tenant_id=v_tenant AND student_party_id='f1c10003-2026-4000-8000-000000000001'
  AND course_id='f1c10002-2026-4000-8000-000000000001' AND status='active'
  AND request_id='g1-branch-denial-20261025')
 THEN RAISE EXCEPTION 'G1_FIXTURE_IDENTITY_DRIFT'; END IF;
 IF EXISTS(SELECT 1 FROM public.edu_enrollment_event_records WHERE enrollment_id='f1c10006-2026-4000-8000-000000000001'
  AND (tenant_id<>v_tenant OR request_id<>'g1-branch-denial-20261025' OR replay_state<>'pending'
    OR replay_attempts<>0 OR lease_token IS NOT NULL))
 OR EXISTS(SELECT 1 FROM public.edu_enrollment_event_replays r JOIN public.edu_enrollment_event_records e
  ON e.event_id=r.event_id WHERE e.enrollment_id='f1c10006-2026-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'G1_FIXTURE_EVENT_DRIFT_OR_REPLAY'; END IF;
 -- Refuse every unowned FK reference before any delete; do not let CASCADE remove unrelated rows.
 FOR v_target IN SELECT * FROM (VALUES
  ('public.org_units'::regclass,'id','f1c10001-2026-4000-8000-000000000001'::uuid),
  ('public.edu_courses'::regclass,'id','f1c10002-2026-4000-8000-000000000001'::uuid),
  ('public.party_parties'::regclass,'id','f1c10003-2026-4000-8000-000000000001'::uuid),
  ('public.students'::regclass,'id','f1c10004-2026-4000-8000-000000000001'::uuid),
  ('public.students'::regclass,'student_id','f1c10005-2026-4000-8000-000000000001'::uuid),
  ('public.edu_enrollments'::regclass,'id','f1c10006-2026-4000-8000-000000000001'::uuid)
 ) target(relation,key_column,row_id)
 LOOP
  FOR v_fk IN SELECT c.conrelid AS relation,c.conkey,src.attname AS key_column
   FROM pg_constraint c
   JOIN pg_attribute ref ON ref.attrelid=c.confrelid AND ref.attnum=c.confkey[1]
   JOIN pg_attribute src ON src.attrelid=c.conrelid AND src.attnum=c.conkey[1]
   WHERE c.contype='f' AND c.confrelid=v_target.relation AND ref.attname=v_target.key_column
  LOOP
   IF cardinality(v_fk.conkey)<>1 THEN RAISE EXCEPTION 'G1_FIXTURE_COMPOSITE_REFERENCE_REVIEW_REQUIRED';END IF;
   v_owned:=CASE v_fk.relation
    WHEN 'public.students'::regclass THEN 'x.id=''f1c10004-2026-4000-8000-000000000001''::uuid'
    WHEN 'public.edu_enrollments'::regclass THEN 'x.id=''f1c10006-2026-4000-8000-000000000001''::uuid'
    WHEN 'public.preschool_chain_course_branch_assignments'::regclass THEN 'x.id=''f1c10007-2026-4000-8000-000000000001''::uuid'
    WHEN 'public.edu_enrollment_event_records'::regclass THEN 'x.enrollment_id=''f1c10006-2026-4000-8000-000000000001''::uuid AND x.request_id=''g1-branch-denial-20261025'''
    ELSE 'false' END;
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s x WHERE x.%I=$1 AND NOT (%s))',
    v_fk.relation::regclass,v_fk.key_column,v_owned) INTO v_external USING v_target.row_id;
   IF v_external THEN RAISE EXCEPTION 'G1_FIXTURE_EXTERNAL_REFERENCE';END IF;
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.org_relationships WHERE from_id IN(
   'f1c10001-2026-4000-8000-000000000001','f1c10003-2026-4000-8000-000000000001')
   OR to_id IN('f1c10001-2026-4000-8000-000000000001','f1c10003-2026-4000-8000-000000000001'))
 THEN RAISE EXCEPTION 'G1_FIXTURE_EXTERNAL_ORG_RELATION';END IF;
 DELETE FROM public.edu_enrollment_event_records WHERE enrollment_id='f1c10006-2026-4000-8000-000000000001'
  AND request_id='g1-branch-denial-20261025';
 DELETE FROM public.edu_enrollments WHERE id='f1c10006-2026-4000-8000-000000000001';
 GET DIAGNOSTICS v_deleted=ROW_COUNT;IF v_deleted<>1 THEN RAISE EXCEPTION 'G1_FIXTURE_ENROLLMENT_CLEANUP';END IF;
 DELETE FROM public.preschool_chain_course_branch_assignments WHERE id='f1c10007-2026-4000-8000-000000000001';
 DELETE FROM public.students WHERE id='f1c10004-2026-4000-8000-000000000001';
 DELETE FROM public.party_parties WHERE id='f1c10003-2026-4000-8000-000000000001';
 DELETE FROM public.edu_courses WHERE id='f1c10002-2026-4000-8000-000000000001';
 DELETE FROM public.org_units WHERE id='f1c10001-2026-4000-8000-000000000001';
END $fixture_cleanup$;
