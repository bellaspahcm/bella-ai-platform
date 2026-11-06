-- Create a Manufacturing tenant through the trusted HQ service path without
-- invoking the legacy BabyCare onboarding routine or its demo records.
CREATE OR REPLACE FUNCTION public.onboard_manufacturing_tenant(
  p_tenant_name TEXT,
  p_contact_phone TEXT,
  p_address TEXT,
  p_email TEXT,
  p_admin_id UUID,
  p_admin_email TEXT,
  p_admin_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF NULLIF(BTRIM(p_tenant_name), '') IS NULL
     OR NULLIF(BTRIM(p_admin_email), '') IS NULL
     OR NULLIF(BTRIM(p_admin_name), '') IS NULL
     OR p_admin_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Manufacturing tenant and admin identity are required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.users AS app_user
    WHERE LOWER(app_user.email) = LOWER(BTRIM(p_admin_email))
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Admin email already belongs to an application user';
  END IF;

  INSERT INTO public.tenants (
    name,
    contact_phone,
    address,
    email,
    status,
    product_key,
    enabled_modules
  )
  VALUES (
    BTRIM(p_tenant_name),
    COALESCE(BTRIM(p_contact_phone), ''),
    COALESCE(BTRIM(p_address), ''),
    COALESCE(BTRIM(p_email), ''),
    'active',
    'bella_manufacturing',
    jsonb_build_object(
      'babycare', FALSE,
      'beauty_spa', FALSE,
      'manufacturing', TRUE,
      'student_training', FALSE,
      'industrial_cleaning', FALSE,
      'real_estate', FALSE,
      'bella_auto', FALSE,
      'bella_healthcare', FALSE,
      'bella_education', FALSE
    )
  )
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.users (id, email, full_name, role, status, tenant_id)
  VALUES (p_admin_id, BTRIM(p_admin_email), BTRIM(p_admin_name), 'admin', 'active', v_tenant_id);

  INSERT INTO public.org_units (
    tenant_id,
    unit_type,
    name,
    code,
    is_active,
    metadata
  )
  VALUES (
    v_tenant_id,
    'branch',
    BTRIM(p_tenant_name),
    'MAIN',
    TRUE,
    jsonb_build_object(
      'source', 'hq_onboarding',
      'productKey', 'bella_manufacturing',
      'address', NULLIF(BTRIM(p_address), ''),
      'phone', NULLIF(BTRIM(p_contact_phone), ''),
      'email', NULLIF(BTRIM(p_email), '')
    )
  );

  RETURN v_tenant_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.onboard_manufacturing_tenant(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.onboard_manufacturing_tenant(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT)
  TO service_role;
