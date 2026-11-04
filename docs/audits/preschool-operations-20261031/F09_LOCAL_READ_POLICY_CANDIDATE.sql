-- LOCAL TEST CANDIDATE ONLY. Not a Production migration.
BEGIN;
GRANT SELECT ON public.edu_weekly_menus, public.edu_weekly_menu_days TO authenticated;
CREATE POLICY preschool_weekly_menu_actor_read ON public.edu_weekly_menus
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.platform_current_actor_profile() a
    WHERE a.id=auth.uid() AND a.tenant_id=edu_weekly_menus.tenant_id
      AND lower(a.role) IN ('admin', 'admin_staff')
  ));
CREATE POLICY preschool_weekly_menu_days_actor_read ON public.edu_weekly_menu_days
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.platform_current_actor_profile() a
    WHERE a.id=auth.uid() AND a.tenant_id=edu_weekly_menu_days.tenant_id
      AND lower(a.role) IN ('admin', 'admin_staff')
  ));
COMMIT;
