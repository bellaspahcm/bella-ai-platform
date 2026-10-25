ALTER POLICY "e2e_care_record_insert" ON public.edu_daily_care_records TO authenticated WITH CHECK (CASE WHEN tenant_id = (SELECT public.get_auth_tenant_id()) AND student_party_id IS NOT NULL
 AND tenant_id = ANY(ARRAY(SELECT u.tenant_id FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
 WHERE u.id=(SELECT auth.uid()) AND u.status='active' AND lower(btrim(u.role))='admin' AND t.status='active' AND t.product_key='bella_preschool'))
 THEN EXISTS(SELECT 1 FROM public.edu_daily_care_sessions s WHERE s.id=edu_daily_care_records.session_id
 AND s.tenant_id=edu_daily_care_records.tenant_id AND s.date=(statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
 AND (public.edu_preschool_roster_identity(s.class_id,s.date)->'roster') @> jsonb_build_array(jsonb_build_object('studentPartyId',edu_daily_care_records.student_party_id)))
 ELSE false END);
ALTER POLICY "e2e_care_record_select" ON public.edu_daily_care_records TO authenticated USING (CASE WHEN tenant_id = (SELECT public.get_auth_tenant_id()) AND student_party_id IS NOT NULL
 AND tenant_id = ANY(ARRAY(SELECT u.tenant_id FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
 WHERE u.id=(SELECT auth.uid()) AND u.status='active' AND lower(btrim(u.role))='admin' AND t.status='active' AND t.product_key='bella_preschool'))
 THEN EXISTS(SELECT 1 FROM public.edu_daily_care_sessions s WHERE s.id=edu_daily_care_records.session_id
 AND s.tenant_id=edu_daily_care_records.tenant_id AND s.date=(statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
 AND (public.edu_preschool_roster_identity(s.class_id,s.date)->'roster') @> jsonb_build_array(jsonb_build_object('studentPartyId',edu_daily_care_records.student_party_id)))
 ELSE false END);
ALTER POLICY "e2e_care_record_update" ON public.edu_daily_care_records TO authenticated USING (CASE WHEN tenant_id = (SELECT public.get_auth_tenant_id()) AND student_party_id IS NOT NULL
 AND tenant_id = ANY(ARRAY(SELECT u.tenant_id FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
 WHERE u.id=(SELECT auth.uid()) AND u.status='active' AND lower(btrim(u.role))='admin' AND t.status='active' AND t.product_key='bella_preschool'))
 THEN EXISTS(SELECT 1 FROM public.edu_daily_care_sessions s WHERE s.id=edu_daily_care_records.session_id
 AND s.tenant_id=edu_daily_care_records.tenant_id AND s.date=(statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
 AND (public.edu_preschool_roster_identity(s.class_id,s.date)->'roster') @> jsonb_build_array(jsonb_build_object('studentPartyId',edu_daily_care_records.student_party_id)))
 ELSE false END) WITH CHECK (CASE WHEN tenant_id = (SELECT public.get_auth_tenant_id()) AND student_party_id IS NOT NULL
 AND tenant_id = ANY(ARRAY(SELECT u.tenant_id FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
 WHERE u.id=(SELECT auth.uid()) AND u.status='active' AND lower(btrim(u.role))='admin' AND t.status='active' AND t.product_key='bella_preschool'))
 THEN EXISTS(SELECT 1 FROM public.edu_daily_care_sessions s WHERE s.id=edu_daily_care_records.session_id
 AND s.tenant_id=edu_daily_care_records.tenant_id AND s.date=(statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
 AND (public.edu_preschool_roster_identity(s.class_id,s.date)->'roster') @> jsonb_build_array(jsonb_build_object('studentPartyId',edu_daily_care_records.student_party_id)))
 ELSE false END);
