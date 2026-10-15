-- Intersect existing policies with live identity/tenant authority; do not replace helpers.
-- SELECT also constrains row selection for writes; valid active access is verified separately.
DO $$
DECLARE
  target_name TEXT;
  target_oid OID;
  command_code "char";
BEGIN
  IF to_regclass('public.users') IS NULL OR to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Active identity guards require canonical public.users and public.tenants.';
  END IF;
  FOREACH target_name IN ARRAY ARRAY['auto_vehicles', 'auto_leads', 'auto_bookings', 'auto_deposits']
  LOOP
    target_oid := to_regclass('public.' || target_name);
    IF target_oid IS NULL THEN
      RAISE EXCEPTION 'Active identity guards require public.%.', target_name;
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = target_oid) THEN
      RAISE EXCEPTION 'Active identity guards require existing RLS on public.%.', target_name;
    END IF;
    FOREACH command_code IN ARRAY ARRAY['r'::"char", 'w'::"char"]
    LOOP
      IF target_name = 'auto_vehicles' AND command_code = 'w' THEN CONTINUE; END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_policy p
        WHERE p.polrelid = target_oid AND p.polpermissive AND p.polcmd IN (command_code, '*')
          AND (0::oid = ANY(p.polroles) OR 'authenticated'::regrole::oid = ANY(p.polroles))
      ) THEN
        RAISE EXCEPTION 'Active identity guards require an existing permissive % policy on public.%.', command_code, target_name;
      END IF;
    END LOOP;
  END LOOP;
END $$;

DROP POLICY IF EXISTS auto_vehicles_active_identity_select_guard ON public.auto_vehicles;
CREATE POLICY auto_vehicles_active_identity_select_guard ON public.auto_vehicles
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_vehicles.tenant_id AND t.status = 'active'
  ));

DROP POLICY IF EXISTS auto_leads_active_identity_select_guard ON public.auto_leads;
CREATE POLICY auto_leads_active_identity_select_guard ON public.auto_leads
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_leads.tenant_id AND t.status = 'active'
  ));

DROP POLICY IF EXISTS auto_bookings_active_identity_select_guard ON public.auto_bookings;
CREATE POLICY auto_bookings_active_identity_select_guard ON public.auto_bookings
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_bookings.tenant_id AND t.status = 'active'
  ));

DROP POLICY IF EXISTS auto_deposits_active_identity_select_guard ON public.auto_deposits;
CREATE POLICY auto_deposits_active_identity_select_guard ON public.auto_deposits
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_deposits.tenant_id AND t.status = 'active'
  ));

DROP POLICY IF EXISTS auto_leads_active_identity_update_guard ON public.auto_leads;
CREATE POLICY auto_leads_active_identity_update_guard ON public.auto_leads
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_leads.tenant_id AND t.status = 'active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_leads.tenant_id AND t.status = 'active'
  ));

DROP POLICY IF EXISTS auto_bookings_active_identity_update_guard ON public.auto_bookings;
CREATE POLICY auto_bookings_active_identity_update_guard ON public.auto_bookings
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_bookings.tenant_id AND t.status = 'active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_bookings.tenant_id AND t.status = 'active'
  ));

DROP POLICY IF EXISTS auto_deposits_active_identity_update_guard ON public.auto_deposits;
CREATE POLICY auto_deposits_active_identity_update_guard ON public.auto_deposits
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_deposits.tenant_id AND t.status = 'active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_deposits.tenant_id AND t.status = 'active'
  ));
