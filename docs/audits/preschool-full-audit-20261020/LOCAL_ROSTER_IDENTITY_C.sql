-- Owner-approved local amendment 2026-10-23. Not a remote migration.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF current_user<>'postgres' OR current_setting('bella.roster_identity_scope',true) IS DISTINCT FROM 'OWNER_APPROVED_ROSTER_IDENTITY_C_20261023'
 OR to_regprocedure('public.edu_preschool_roster_identity(uuid,date)') IS NOT NULL
 THEN RAISE EXCEPTION 'ROSTER_IDENTITY_TARGET_OR_BASELINE_DRIFT'; END IF;
END $$;
CREATE FUNCTION public.edu_preschool_roster_identity(p_course_id uuid,p_school_day date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog SET statement_timeout='10s' SET lock_timeout='5s'
AS $roster$
DECLARE v_actor uuid:=auth.uid(); v_tenant uuid; v_branch uuid; v_roster jsonb;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'authenticated' OR v_actor IS NULL
 OR p_course_id IS NULL OR p_school_day IS DISTINCT FROM (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
 THEN RAISE EXCEPTION 'ROSTER_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 SELECT u.tenant_id INTO v_tenant FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
 WHERE u.id=v_actor AND u.status='active' AND u.role='admin' AND t.status='active' AND t.product_key='bella_preschool';
 IF v_tenant IS NULL OR NOT EXISTS(SELECT 1 FROM public.edu_courses c WHERE c.id=p_course_id AND c.tenant_id=v_tenant AND c.status='active')
 THEN RAISE EXCEPTION 'ROSTER_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.preschool_chain_course_branch_assignments a WHERE a.tenant_id=v_tenant AND a.course_id=p_course_id)<>1
 THEN RAISE EXCEPTION 'ROSTER_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 SELECT a.branch_id INTO v_branch FROM public.preschool_chain_course_branch_assignments a
 JOIN public.org_units b ON b.id=a.branch_id AND b.tenant_id=a.tenant_id AND b.unit_type='branch' AND b.is_active
 WHERE a.tenant_id=v_tenant AND a.course_id=p_course_id;
 IF v_branch IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_org_unit_access a WHERE a.tenant_id=v_tenant AND a.user_id=v_actor
 AND a.org_unit_id=v_branch AND a.relationship_id IS NOT NULL)
 THEN RAISE EXCEPTION 'ROSTER_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.edu_enrollments e WHERE e.tenant_id=v_tenant AND e.course_id=p_course_id AND e.status='active'
 AND e.enrolled_at<((p_school_day+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
 AND ((SELECT count(*) FROM public.students s WHERE s.tenant_id=v_tenant AND s.party_id=e.student_party_id)<>1
 OR NOT EXISTS(SELECT 1 FROM public.students s JOIN public.party_parties p ON p.id=s.party_id AND p.tenant_id=s.tenant_id
 WHERE s.tenant_id=v_tenant AND s.party_id=e.student_party_id AND s.academic_status='enrolled'
 AND p.party_type='person' AND p.deleted_at IS NULL AND btrim(p.display_name)<>'')))
 OR EXISTS(SELECT 1 FROM public.edu_enrollments e WHERE e.tenant_id=v_tenant AND e.course_id=p_course_id AND e.status='active'
 AND e.enrolled_at<((p_school_day+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') GROUP BY e.student_party_id HAVING count(*)<>1)
 THEN RAISE EXCEPTION 'ROSTER_IDENTITY_UNAVAILABLE' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('enrollmentId',e.id,'studentId',s.student_id,'studentPartyId',p.id,
 'studentCode',s.student_code,'name',p.display_name,'gender',p.gender,'dob',p.dob,'enrollmentStatus',e.status) ORDER BY e.id),'[]'::jsonb)
 INTO v_roster FROM public.edu_enrollments e
 JOIN public.students s ON s.tenant_id=e.tenant_id AND s.party_id=e.student_party_id
 JOIN public.party_parties p ON p.tenant_id=e.tenant_id AND p.id=e.student_party_id
 WHERE e.tenant_id=v_tenant AND e.course_id=p_course_id AND e.status='active'
 AND e.enrolled_at<((p_school_day+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh');
 RETURN jsonb_build_object('tenantId',v_tenant,'courseId',p_course_id,'schoolDay',p_school_day,'roster',v_roster);
END;
$roster$;
REVOKE ALL ON FUNCTION public.edu_preschool_roster_identity(uuid,date) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.edu_preschool_roster_identity(uuid,date) TO authenticated;
COMMIT;
