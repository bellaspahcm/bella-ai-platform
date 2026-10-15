-- Current authorization comes from canonical live data, not cached JWT metadata.
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT u.tenant_id INTO v_tenant_id
  FROM public.users AS u
  JOIN public.tenants AS t ON t.id = u.tenant_id
  WHERE u.id = auth.uid() AND u.status = 'active' AND t.status = 'active';

  -- NULL would enable legacy policies using NULL as an unrestricted HQ sentinel.
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Active canonical identity and tenant required' USING ERRCODE = '42501';
  END IF;
  RETURN v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u JOIN public.tenants AS t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.status = 'active' AND t.status = 'active' AND u.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_hr()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u JOIN public.tenants AS t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.status = 'active' AND t.status = 'active' AND u.role = 'hr'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_accountant()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u JOIN public.tenants AS t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.status = 'active' AND t.status = 'active' AND u.role = 'accountant'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_hq_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u JOIN public.tenants AS t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.status = 'active' AND t.status = 'active'
      AND u.role = 'admin' AND t.product_key = 'bella_hq'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_hq_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_hq_super_admin();
$$;
