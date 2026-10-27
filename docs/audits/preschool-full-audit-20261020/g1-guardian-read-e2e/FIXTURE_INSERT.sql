-- Include only within the reviewed E2E transaction.

DO $fixture_absence$
BEGIN
 IF EXISTS(SELECT 1 FROM public.org_units WHERE id='f1c10001-2026-4000-8000-000000000001')
 OR EXISTS(SELECT 1 FROM public.edu_courses WHERE id='f1c10002-2026-4000-8000-000000000001')
 OR EXISTS(SELECT 1 FROM public.party_parties WHERE id='f1c10003-2026-4000-8000-000000000001')
 OR EXISTS(SELECT 1 FROM public.students WHERE id='f1c10004-2026-4000-8000-000000000001'
   OR student_id='f1c10005-2026-4000-8000-000000000001')
 OR EXISTS(SELECT 1 FROM public.edu_enrollments WHERE id='f1c10006-2026-4000-8000-000000000001'
   OR request_id='g1-branch-denial-20261025')
 OR EXISTS(SELECT 1 FROM public.preschool_chain_course_branch_assignments WHERE id='f1c10007-2026-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'G1_FIXTURE_COLLISION';END IF;
END $fixture_absence$;
DO $fixture_insert$
DECLARE actor record; v_student uuid; v_actor uuid; v_tenant uuid;
BEGIN
 FOR actor IN SELECT u.id,u.tenant_id FROM public.users u
  JOIN public.tenants t ON t.id=u.tenant_id JOIN auth.users a ON a.id=u.id
  WHERE u.status='active' AND lower(u.role)='admin' AND t.status='active' AND t.product_key='bella_preschool'
    AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=statement_timestamp())
  ORDER BY u.id
 LOOP
  PERFORM set_config('request.jwt.claim.sub',actor.id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor.id::text,'role','authenticated')::text,true);
  SELECT s.student_id INTO v_student FROM public.students s
   JOIN public.edu_enrollments e ON e.tenant_id=s.tenant_id AND e.student_party_id=s.party_id AND e.status IN('active','pending')
   JOIN public.edu_courses c ON c.id=e.course_id AND c.tenant_id=e.tenant_id AND c.status='active'
   JOIN public.preschool_chain_course_branch_assignments m ON m.tenant_id=c.tenant_id AND m.course_id=c.id
   JOIN public.org_units b ON b.id=m.branch_id AND b.tenant_id=m.tenant_id AND b.unit_type='branch' AND b.is_active
   JOIN public.user_org_unit_access x ON x.user_id=actor.id AND x.tenant_id=b.tenant_id AND x.org_unit_id=b.id AND x.relationship_id IS NOT NULL
   WHERE s.tenant_id=actor.tenant_id AND s.academic_status='enrolled'
   AND EXISTS(SELECT 1 FROM public.party_relationships r WHERE r.tenant_id=s.tenant_id AND r.target_party_id=s.party_id
     AND r.relationship_type IN('guardian_of','parent_of')
     AND (r.active_from IS NULL OR r.active_from<=(statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
     AND (r.active_to IS NULL OR r.active_to>=(statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date))
   ORDER BY s.student_id LIMIT 1;
  IF v_student IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.users u JOIN auth.users a ON a.id=u.id
  WHERE u.tenant_id=actor.tenant_id AND u.status='active' AND lower(u.role)<>'admin'
    AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=statement_timestamp()))
  AND EXISTS(SELECT 1 FROM public.students fs JOIN public.party_parties fp ON fp.id=fs.party_id
  AND fp.tenant_id=fs.tenant_id AND fp.party_type='person' AND fp.deleted_at IS NULL
  WHERE fs.tenant_id<>actor.tenant_id AND fs.academic_status='enrolled'
    AND (SELECT count(*) FROM public.students ds WHERE ds.tenant_id=fs.tenant_id AND ds.party_id=fs.party_id)=1
    AND EXISTS(SELECT 1 FROM public.edu_enrollments fe JOIN public.edu_courses fc
      ON fc.id=fe.course_id AND fc.tenant_id=fe.tenant_id AND fc.status='active'
      WHERE fe.tenant_id=fs.tenant_id AND fe.student_party_id=fs.party_id AND fe.status IN('active','pending')))
 THEN v_actor:=actor.id;v_tenant:=actor.tenant_id;EXIT;END IF;
 END LOOP;
 PERFORM set_config('g1.fixture_actor',v_actor::text,true);
 PERFORM set_config('g1.fixture_tenant',v_tenant::text,true);
 PERFORM set_config('g1.fixture_positive_student',v_student::text,true);
 PERFORM set_config('g1.fixture_positive_code',
  (SELECT student_code FROM public.students WHERE student_id=v_student),true);
 IF v_actor IS NULL THEN RAISE EXCEPTION 'G1_FIXTURE_AUTHORIZED_CONTEXT_MISSING';END IF;
 INSERT INTO public.org_units(id,tenant_id,unit_type,name,code,is_active,metadata)
 VALUES('f1c10001-2026-4000-8000-000000000001',v_tenant,'branch','G1 Synthetic Denial Branch','G1-DENIAL-20261025',true,'{"g1Fixture":"20261025"}');
 IF EXISTS(SELECT 1 FROM public.user_org_unit_access x WHERE x.user_id=v_actor AND x.tenant_id=v_tenant
  AND x.org_unit_id='f1c10001-2026-4000-8000-000000000001' AND x.relationship_id IS NOT NULL)
 THEN RAISE EXCEPTION 'G1_FIXTURE_BRANCH_IS_ACCESSIBLE';END IF;
 INSERT INTO public.edu_courses(id,tenant_id,course_code,title,status,max_students,current_enrollment)
 VALUES('f1c10002-2026-4000-8000-000000000001',v_tenant,'G1-DENIAL-20261025','G1 Synthetic Denial Class','active',1,1);
 INSERT INTO public.party_parties(id,tenant_id,party_type,display_name,dob,gender)
 VALUES('f1c10003-2026-4000-8000-000000000001',v_tenant,'person','G1 Synthetic Denial Student','2022-01-01','female');
 INSERT INTO public.students(id,student_id,tenant_id,party_id,student_code,academic_status,metadata)
 VALUES('f1c10004-2026-4000-8000-000000000001','f1c10005-2026-4000-8000-000000000001',v_tenant,
 'f1c10003-2026-4000-8000-000000000001','G1-DENIAL-20261025','enrolled','{"g1Fixture":"20261025"}');
 INSERT INTO public.preschool_chain_course_branch_assignments(id,tenant_id,course_id,branch_id,assigned_by)
 VALUES('f1c10007-2026-4000-8000-000000000001',v_tenant,'f1c10002-2026-4000-8000-000000000001',
 'f1c10001-2026-4000-8000-000000000001',v_actor);
 INSERT INTO public.edu_enrollments(id,tenant_id,student_party_id,course_id,status,request_id)
 VALUES('f1c10006-2026-4000-8000-000000000001',v_tenant,'f1c10003-2026-4000-8000-000000000001',
 'f1c10002-2026-4000-8000-000000000001','active','g1-branch-denial-20261025');
END $fixture_insert$;
