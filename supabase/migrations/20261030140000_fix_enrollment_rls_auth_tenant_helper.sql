-- Fix enrollment visibility RLS for authenticated browser sessions.
-- Canonical tenant source: public.get_auth_tenant_id().
-- Aligns edu_enrollments with edu_courses (see 20260927020000_fix_course_rls_auth_tenant_helper.sql).

DROP POLICY IF EXISTS edu_enrollments_tenant_isolation ON public.edu_enrollments;
CREATE POLICY edu_enrollments_tenant_isolation ON public.edu_enrollments
  FOR ALL
  USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());
