-- Bella Preschool Fee Program Publish-only production migration.
-- Publish-only: no resolver, Enrollment binding, snapshot, Finance, or Education Kernel objects.
BEGIN;

CREATE TABLE public.preschool_fee_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 160),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE public.preschool_fee_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 160),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE public.preschool_billing_period_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  policy_definition jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(policy_definition) = 'object'),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_by uuid REFERENCES auth.users(id),
  published_at timestamptz,
  CHECK ((status = 'DRAFT' AND published_by IS NULL AND published_at IS NULL)
      OR (status = 'PUBLISHED' AND published_by IS NOT NULL AND published_at IS NOT NULL)),
  UNIQUE (tenant_id, id)
);

CREATE TABLE public.preschool_fee_item_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  fee_item_id uuid NOT NULL,
  fee_type_code text NOT NULL CHECK (char_length(trim(fee_type_code)) BETWEEN 1 AND 80),
  amount numeric(14, 2) CHECK (amount IS NULL OR amount >= 0),
  currency text CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  unit_basis jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(unit_basis) = 'object'),
  billing_basis jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(billing_basis) = 'object'),
  effective_applicability jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(effective_applicability) = 'object'),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_by uuid REFERENCES auth.users(id),
  published_at timestamptz,
  CHECK ((status = 'DRAFT' AND published_by IS NULL AND published_at IS NULL)
      OR (status = 'PUBLISHED' AND published_by IS NOT NULL AND published_at IS NOT NULL)),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, fee_item_id)
    REFERENCES public.preschool_fee_items(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.preschool_fee_program_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  fee_program_id uuid NOT NULL,
  billing_period_policy_version_id uuid,
  applicability jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(applicability) = 'object'),
  effective_applicability jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(effective_applicability) = 'object'),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_by uuid REFERENCES auth.users(id),
  published_at timestamptz,
  CHECK ((status = 'DRAFT' AND published_by IS NULL AND published_at IS NULL)
      OR (status = 'PUBLISHED' AND published_by IS NOT NULL AND published_at IS NOT NULL)),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, fee_program_id)
    REFERENCES public.preschool_fee_programs(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, billing_period_policy_version_id)
    REFERENCES public.preschool_billing_period_policy_versions(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.preschool_fee_program_version_items (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  program_version_id uuid NOT NULL,
  fee_item_version_id uuid NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, program_version_id, fee_item_version_id),
  FOREIGN KEY (tenant_id, program_version_id)
    REFERENCES public.preschool_fee_program_versions(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, fee_item_version_id)
    REFERENCES public.preschool_fee_item_versions(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX preschool_fee_programs_tenant_status_idx
  ON public.preschool_fee_programs(tenant_id, status);
CREATE INDEX preschool_fee_program_versions_tenant_program_idx
  ON public.preschool_fee_program_versions(tenant_id, fee_program_id, status);
CREATE INDEX preschool_fee_item_versions_tenant_item_idx
  ON public.preschool_fee_item_versions(tenant_id, fee_item_id, status);

ALTER TABLE public.preschool_fee_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preschool_fee_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preschool_billing_period_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preschool_fee_item_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preschool_fee_program_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preschool_fee_program_version_items ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.preschool_fee_program_actor_tenant()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.tenant_id
  FROM public.users u
  JOIN public.tenants t ON t.id = u.tenant_id
  JOIN auth.users a ON a.id = u.id
  WHERE auth.role() = 'authenticated'
    AND u.id = auth.uid()
    AND u.status = 'active'
    AND lower(u.role) IN ('admin', 'super_admin')
    AND t.status = 'active'
    AND t.product_key = 'bella_preschool'
    AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until <= pg_catalog.now())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.preschool_fee_program_actor_tenant() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.preschool_fee_program_actor_tenant() TO authenticated;

CREATE POLICY preschool_fee_programs_admin_select ON public.preschool_fee_programs
  FOR SELECT TO authenticated
  USING (tenant_id = public.preschool_fee_program_actor_tenant());
CREATE POLICY preschool_fee_programs_admin_insert ON public.preschool_fee_programs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.preschool_fee_program_actor_tenant() AND created_by = auth.uid() AND status = 'ACTIVE');
CREATE POLICY preschool_fee_programs_admin_update ON public.preschool_fee_programs
  FOR UPDATE TO authenticated
  USING (tenant_id = public.preschool_fee_program_actor_tenant())
  WITH CHECK (tenant_id = public.preschool_fee_program_actor_tenant());

CREATE POLICY preschool_fee_items_admin_select ON public.preschool_fee_items
  FOR SELECT TO authenticated
  USING (tenant_id = public.preschool_fee_program_actor_tenant());
CREATE POLICY preschool_fee_items_admin_insert ON public.preschool_fee_items
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.preschool_fee_program_actor_tenant() AND created_by = auth.uid());
CREATE POLICY preschool_fee_items_admin_update ON public.preschool_fee_items
  FOR UPDATE TO authenticated
  USING (tenant_id = public.preschool_fee_program_actor_tenant())
  WITH CHECK (tenant_id = public.preschool_fee_program_actor_tenant());

CREATE POLICY preschool_fee_policy_versions_admin_select ON public.preschool_billing_period_policy_versions
  FOR SELECT TO authenticated
  USING (tenant_id = public.preschool_fee_program_actor_tenant());
CREATE POLICY preschool_fee_policy_versions_admin_insert ON public.preschool_billing_period_policy_versions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.preschool_fee_program_actor_tenant() AND created_by = auth.uid()
    AND status = 'DRAFT' AND published_by IS NULL AND published_at IS NULL);
CREATE POLICY preschool_fee_policy_versions_admin_update ON public.preschool_billing_period_policy_versions
  FOR UPDATE TO authenticated
  USING (tenant_id = public.preschool_fee_program_actor_tenant() AND status = 'DRAFT')
  WITH CHECK (tenant_id = public.preschool_fee_program_actor_tenant() AND created_by = auth.uid()
    AND status = 'DRAFT' AND published_by IS NULL AND published_at IS NULL);

CREATE POLICY preschool_fee_item_versions_admin_select ON public.preschool_fee_item_versions
  FOR SELECT TO authenticated
  USING (tenant_id = public.preschool_fee_program_actor_tenant());
CREATE POLICY preschool_fee_item_versions_admin_insert ON public.preschool_fee_item_versions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.preschool_fee_program_actor_tenant() AND created_by = auth.uid()
    AND status = 'DRAFT' AND published_by IS NULL AND published_at IS NULL);
CREATE POLICY preschool_fee_item_versions_admin_update ON public.preschool_fee_item_versions
  FOR UPDATE TO authenticated
  USING (tenant_id = public.preschool_fee_program_actor_tenant() AND status = 'DRAFT')
  WITH CHECK (tenant_id = public.preschool_fee_program_actor_tenant() AND created_by = auth.uid()
    AND status = 'DRAFT' AND published_by IS NULL AND published_at IS NULL);

CREATE POLICY preschool_fee_program_versions_admin_select ON public.preschool_fee_program_versions
  FOR SELECT TO authenticated
  USING (tenant_id = public.preschool_fee_program_actor_tenant());
CREATE POLICY preschool_fee_program_versions_admin_insert ON public.preschool_fee_program_versions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.preschool_fee_program_actor_tenant() AND created_by = auth.uid()
    AND status = 'DRAFT' AND published_by IS NULL AND published_at IS NULL);
CREATE POLICY preschool_fee_program_versions_admin_update ON public.preschool_fee_program_versions
  FOR UPDATE TO authenticated
  USING (tenant_id = public.preschool_fee_program_actor_tenant() AND status = 'DRAFT')
  WITH CHECK (tenant_id = public.preschool_fee_program_actor_tenant() AND created_by = auth.uid()
    AND status = 'DRAFT' AND published_by IS NULL AND published_at IS NULL);

CREATE POLICY preschool_fee_program_version_items_admin_select ON public.preschool_fee_program_version_items
  FOR SELECT TO authenticated
  USING (tenant_id = public.preschool_fee_program_actor_tenant());
CREATE POLICY preschool_fee_program_version_items_admin_insert ON public.preschool_fee_program_version_items
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.preschool_fee_program_actor_tenant()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.preschool_fee_program_versions pv
      WHERE pv.id = public.preschool_fee_program_version_items.program_version_id
        AND pv.tenant_id = public.preschool_fee_program_version_items.tenant_id AND pv.status = 'DRAFT'
    )
    AND EXISTS (
      SELECT 1 FROM public.preschool_fee_item_versions iv
      WHERE iv.id = public.preschool_fee_program_version_items.fee_item_version_id
        AND iv.tenant_id = public.preschool_fee_program_version_items.tenant_id
    ));
CREATE POLICY preschool_fee_program_version_items_admin_delete ON public.preschool_fee_program_version_items
  FOR DELETE TO authenticated
  USING (public.preschool_fee_program_version_items.tenant_id = public.preschool_fee_program_actor_tenant()
    AND EXISTS (
      SELECT 1 FROM public.preschool_fee_program_versions pv
      WHERE pv.id = public.preschool_fee_program_version_items.program_version_id
        AND pv.tenant_id = public.preschool_fee_program_version_items.tenant_id AND pv.status = 'DRAFT'
    ));

REVOKE ALL ON TABLE public.preschool_fee_programs, public.preschool_fee_items,
  public.preschool_billing_period_policy_versions, public.preschool_fee_item_versions,
  public.preschool_fee_program_versions, public.preschool_fee_program_version_items
  FROM PUBLIC, anon, service_role;
GRANT SELECT, INSERT, UPDATE ON public.preschool_fee_programs, public.preschool_fee_items,
  public.preschool_billing_period_policy_versions, public.preschool_fee_item_versions,
  public.preschool_fee_program_versions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.preschool_fee_program_version_items TO authenticated;

CREATE FUNCTION public.preschool_fee_program_stamp_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL THEN
      RAISE EXCEPTION 'FEE_PROGRAM_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
    NEW.created_by := auth.uid();
    NEW.created_at := pg_catalog.clock_timestamp();
    IF TG_TABLE_NAME = 'preschool_fee_programs' THEN
      NEW.status := 'ACTIVE';
    ELSIF TG_TABLE_NAME IN (
      'preschool_billing_period_policy_versions',
      'preschool_fee_item_versions',
      'preschool_fee_program_versions'
    ) THEN
      NEW.status := 'DRAFT';
      NEW.published_by := NULL;
      NEW.published_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'FEE_PROGRAM_CREATION_METADATA_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER preschool_fee_program_stamp
  BEFORE INSERT OR UPDATE ON public.preschool_fee_programs
  FOR EACH ROW EXECUTE FUNCTION public.preschool_fee_program_stamp_metadata();
CREATE TRIGGER preschool_fee_item_stamp
  BEFORE INSERT OR UPDATE ON public.preschool_fee_items
  FOR EACH ROW EXECUTE FUNCTION public.preschool_fee_program_stamp_metadata();
CREATE TRIGGER preschool_fee_policy_version_stamp
  BEFORE INSERT OR UPDATE ON public.preschool_billing_period_policy_versions
  FOR EACH ROW EXECUTE FUNCTION public.preschool_fee_program_stamp_metadata();
CREATE TRIGGER preschool_fee_item_version_stamp
  BEFORE INSERT OR UPDATE ON public.preschool_fee_item_versions
  FOR EACH ROW EXECUTE FUNCTION public.preschool_fee_program_stamp_metadata();
CREATE TRIGGER preschool_fee_program_version_stamp
  BEFORE INSERT OR UPDATE ON public.preschool_fee_program_versions
  FOR EACH ROW EXECUTE FUNCTION public.preschool_fee_program_stamp_metadata();
CREATE TRIGGER preschool_fee_program_version_item_stamp
  BEFORE INSERT OR UPDATE ON public.preschool_fee_program_version_items
  FOR EACH ROW EXECUTE FUNCTION public.preschool_fee_program_stamp_metadata();

CREATE FUNCTION public.preschool_fee_program_guard_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'FEE_PROGRAM_PUBLISHED_VERSION_IMMUTABLE' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'FEE_PROGRAM_PUBLISHED_VERSION_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'FEE_PROGRAM_VERSION_IDENTITY_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'FEE_PROGRAM_PUBLISH_COMMAND_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER preschool_fee_policy_version_immutable
  BEFORE UPDATE OR DELETE ON public.preschool_billing_period_policy_versions
  FOR EACH ROW EXECUTE FUNCTION public.preschool_fee_program_guard_version_mutation();
CREATE TRIGGER preschool_fee_item_version_immutable
  BEFORE UPDATE OR DELETE ON public.preschool_fee_item_versions
  FOR EACH ROW EXECUTE FUNCTION public.preschool_fee_program_guard_version_mutation();
CREATE TRIGGER preschool_fee_program_version_immutable
  BEFORE UPDATE OR DELETE ON public.preschool_fee_program_versions
  FOR EACH ROW EXECUTE FUNCTION public.preschool_fee_program_guard_version_mutation();

CREATE FUNCTION public.preschool_fee_program_guard_archive_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'FEE_PROGRAM_IDENTITY_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  IF OLD.status = 'ARCHIVED' AND NEW.status <> 'ARCHIVED' THEN
    RAISE EXCEPTION 'FEE_PROGRAM_REACTIVATION_NOT_SUPPORTED' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER preschool_fee_program_archive_transition
  BEFORE UPDATE ON public.preschool_fee_programs
  FOR EACH ROW EXECUTE FUNCTION public.preschool_fee_program_guard_archive_transition();

CREATE FUNCTION public.preschool_fee_program_guard_membership_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid;
  v_program_version_id uuid;
  v_status text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'FEE_PROGRAM_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_tenant_id := OLD.tenant_id;
    v_program_version_id := OLD.program_version_id;
  ELSE
    v_tenant_id := NEW.tenant_id;
    v_program_version_id := NEW.program_version_id;
  END IF;

  SELECT version.status INTO v_status
  FROM public.preschool_fee_program_versions version
  WHERE version.tenant_id = v_tenant_id AND version.id = v_program_version_id
  FOR UPDATE;

  IF NOT FOUND OR v_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'FEE_PROGRAM_MEMBERSHIP_FROZEN' USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.preschool_fee_program_guard_membership_mutation() FROM PUBLIC, anon, service_role;

CREATE TRIGGER preschool_fee_program_membership_lock
  BEFORE INSERT OR DELETE ON public.preschool_fee_program_version_items
  FOR EACH ROW EXECUTE FUNCTION public.preschool_fee_program_guard_membership_mutation();

COMMENT ON FUNCTION public.preschool_fee_program_guard_membership_mutation() IS
  'Locks the owning draft version so membership writes serialize with publication; published membership is immutable.';

CREATE TABLE public.preschool_fixed_fee_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[A-Z][A-Z0-9_]{0,79}$'),
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 160),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, code)
);
ALTER TABLE public.preschool_fixed_fee_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY preschool_fixed_fee_types_admin_select ON public.preschool_fixed_fee_types
  FOR SELECT TO authenticated USING (tenant_id = public.preschool_fee_program_actor_tenant());
CREATE POLICY preschool_fixed_fee_types_admin_insert ON public.preschool_fixed_fee_types
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.preschool_fee_program_actor_tenant() AND created_by = auth.uid());
CREATE POLICY preschool_fixed_fee_types_admin_update ON public.preschool_fixed_fee_types
  FOR UPDATE TO authenticated USING (tenant_id = public.preschool_fee_program_actor_tenant())
  WITH CHECK (tenant_id = public.preschool_fee_program_actor_tenant());
REVOKE ALL ON public.preschool_fixed_fee_types FROM PUBLIC, anon, service_role;
GRANT SELECT, INSERT, UPDATE ON public.preschool_fixed_fee_types TO authenticated;
CREATE TRIGGER preschool_fixed_fee_types_stamp BEFORE INSERT OR UPDATE ON public.preschool_fixed_fee_types
  FOR EACH ROW EXECUTE FUNCTION public.preschool_fee_program_stamp_metadata();

CREATE FUNCTION public.preschool_fixed_fee_type_guard_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'FEE_TYPE_CODE_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.preschool_fixed_fee_type_guard_code() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER preschool_fixed_fee_type_code_immutable BEFORE UPDATE ON public.preschool_fixed_fee_types
  FOR EACH ROW EXECUTE FUNCTION public.preschool_fixed_fee_type_guard_code();

ALTER TABLE public.preschool_fee_item_versions ADD COLUMN fee_item_name_snapshot text;
ALTER TABLE public.preschool_fee_item_versions ADD COLUMN fee_type_name_snapshot text;

CREATE FUNCTION public.preschool_fee_currency_is_current(p_code text)
RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT p_code = ANY (ARRAY['AED', 'AFN', 'ALL', 'AMD', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BOV', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHE', 'CHF', 'CHW', 'CLF', 'CLP', 'CNY', 'COP', 'COU', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MXV', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'USN', 'UYI', 'UYU', 'UYW', 'UZS', 'VED', 'VES', 'VND', 'VUV', 'WST', 'XAD', 'XAF', 'XCD', 'XCG', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWG']::text[]);
$$;
REVOKE ALL ON FUNCTION public.preschool_fee_currency_is_current(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.preschool_validate_fixed_fee_program(p_tenant_id uuid, p_program_version_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.preschool_fee_program_version_items l
      WHERE l.tenant_id = p_tenant_id AND l.program_version_id = p_program_version_id) THEN
    RAISE EXCEPTION 'FEE_PROGRAM_ITEMS_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- Serialize classification/name changes with the publication transaction.
  PERFORM 1 FROM public.preschool_fee_program_version_items l
    JOIN public.preschool_fee_item_versions i ON i.tenant_id = l.tenant_id AND i.id = l.fee_item_version_id
    JOIN public.preschool_fixed_fee_types t ON t.tenant_id = i.tenant_id AND t.code = i.fee_type_code
    JOIN public.preschool_fee_items f ON f.tenant_id = i.tenant_id AND f.id = i.fee_item_id
    WHERE l.tenant_id = p_tenant_id AND l.program_version_id = p_program_version_id
    ORDER BY t.id, f.id FOR SHARE OF t, f;

  IF EXISTS (SELECT 1 FROM public.preschool_fee_program_version_items l
    JOIN public.preschool_fee_item_versions i ON i.tenant_id = l.tenant_id AND i.id = l.fee_item_version_id
    LEFT JOIN public.preschool_fixed_fee_types t ON t.tenant_id = i.tenant_id AND t.code = i.fee_type_code
    WHERE l.tenant_id = p_tenant_id AND l.program_version_id = p_program_version_id
      AND (t.id IS NULL OR t.status <> 'ACTIVE')) THEN
    RAISE EXCEPTION 'FEE_PROGRAM_FEE_TYPE_NOT_DEFINED' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.preschool_fee_program_version_items l
    JOIN public.preschool_fee_item_versions i ON i.tenant_id = l.tenant_id AND i.id = l.fee_item_version_id
    JOIN public.preschool_fee_items f ON f.tenant_id = i.tenant_id AND f.id = i.fee_item_id
    WHERE l.tenant_id = p_tenant_id AND l.program_version_id = p_program_version_id
      AND (trim(f.display_name) = '' OR i.amount IS NULL OR i.amount::text IN ('NaN', 'Infinity', '-Infinity')
        OR i.amount < 0 OR i.currency IS NULL OR NOT public.preschool_fee_currency_is_current(i.currency)
        OR (i.status = 'PUBLISHED' AND (i.fee_item_name_snapshot IS NULL OR i.fee_type_name_snapshot IS NULL)))) THEN
    RAISE EXCEPTION 'FEE_PROGRAM_FIXED_FEE_INVALID' USING ERRCODE = '22023';
  END IF;

  UPDATE public.preschool_fee_item_versions i
  SET fee_item_name_snapshot = f.display_name, fee_type_name_snapshot = t.display_name
  FROM public.preschool_fee_program_version_items l, public.preschool_fee_items f, public.preschool_fixed_fee_types t
  WHERE l.tenant_id = p_tenant_id AND l.program_version_id = p_program_version_id
    AND i.tenant_id = l.tenant_id AND i.id = l.fee_item_version_id AND i.status = 'DRAFT'
    AND f.tenant_id = i.tenant_id AND f.id = i.fee_item_id
    AND t.tenant_id = i.tenant_id AND t.code = i.fee_type_code;
END;
$$;
REVOKE ALL ON FUNCTION public.preschool_validate_fixed_fee_program(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.preschool_publish_fee_program_version(p_program_version_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_tenant_id uuid;
  v_program_version public.preschool_fee_program_versions%ROWTYPE;
  v_program_status text;
  v_policy_status text;
  v_result jsonb;
BEGIN
  IF v_actor_id IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'FEE_PROGRAM_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT u.tenant_id INTO v_tenant_id
  FROM public.users u
  JOIN public.tenants t ON t.id = u.tenant_id
  JOIN auth.users a ON a.id = u.id
  WHERE u.id = v_actor_id
    AND u.status = 'active'
    AND lower(u.role) IN ('admin', 'super_admin')
    AND t.status = 'active'
    AND t.product_key = 'bella_preschool'
    AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until <= pg_catalog.clock_timestamp())
  FOR SHARE OF u, t, a;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FEE_PROGRAM_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_program_version
  FROM public.preschool_fee_program_versions
  WHERE id = p_program_version_id AND tenant_id = v_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FEE_PROGRAM_VERSION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_program_version.status = 'PUBLISHED' THEN
    RETURN jsonb_build_object('programVersionId', v_program_version.id, 'status', 'PUBLISHED', 'duplicate', true);
  END IF;

  SELECT p.status INTO v_program_status
  FROM public.preschool_fee_programs p
  WHERE p.id = v_program_version.fee_program_id AND p.tenant_id = v_tenant_id
  FOR SHARE;
  IF NOT FOUND OR v_program_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'FEE_PROGRAM_NOT_ACTIVE' USING ERRCODE = '55000';
  END IF;

  IF v_program_version.billing_period_policy_version_id IS NOT NULL THEN
    SELECT policy.status INTO v_policy_status
    FROM public.preschool_billing_period_policy_versions policy
    WHERE policy.id = v_program_version.billing_period_policy_version_id
      AND policy.tenant_id = v_tenant_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'FEE_PROGRAM_PINNED_POLICY_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  PERFORM 1
  FROM public.preschool_fee_program_version_items link
  JOIN public.preschool_fee_item_versions item
    ON item.tenant_id = link.tenant_id AND item.id = link.fee_item_version_id
  WHERE link.tenant_id = v_tenant_id AND link.program_version_id = v_program_version.id
  ORDER BY item.id
  FOR UPDATE OF item;

  IF EXISTS (
    SELECT 1 FROM public.preschool_fee_program_version_items link
    LEFT JOIN public.preschool_fee_item_versions item
      ON item.tenant_id = link.tenant_id AND item.id = link.fee_item_version_id
    WHERE link.tenant_id = v_tenant_id AND link.program_version_id = v_program_version.id
      AND item.id IS NULL
  ) THEN
    RAISE EXCEPTION 'FEE_PROGRAM_ITEM_VERSION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.preschool_validate_fixed_fee_program(v_tenant_id, v_program_version.id);

  IF v_policy_status = 'DRAFT' THEN
    UPDATE public.preschool_billing_period_policy_versions
    SET status = 'PUBLISHED', published_by = v_actor_id, published_at = pg_catalog.clock_timestamp()
    WHERE id = v_program_version.billing_period_policy_version_id AND tenant_id = v_tenant_id;
  END IF;

  UPDATE public.preschool_fee_item_versions item
  SET status = 'PUBLISHED', published_by = v_actor_id, published_at = pg_catalog.clock_timestamp()
  FROM public.preschool_fee_program_version_items link
  WHERE link.tenant_id = v_tenant_id
    AND link.program_version_id = v_program_version.id
    AND item.tenant_id = link.tenant_id
    AND item.id = link.fee_item_version_id
    AND item.status = 'DRAFT';

  UPDATE public.preschool_fee_program_versions
  SET status = 'PUBLISHED', published_by = v_actor_id, published_at = pg_catalog.clock_timestamp()
  WHERE id = v_program_version.id AND tenant_id = v_tenant_id;

  v_result := jsonb_build_object(
    'programVersionId', v_program_version.id,
    'billingPeriodPolicyVersionId', v_program_version.billing_period_policy_version_id,
    'status', 'PUBLISHED',
    'duplicate', false
  );
  RETURN v_result;
END;
$$;

ALTER FUNCTION public.preschool_publish_fee_program_version(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.preschool_publish_fee_program_version(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.preschool_publish_fee_program_version(uuid) TO authenticated;

REVOKE ALL ON TABLE public.preschool_fee_programs, public.preschool_fee_items,
  public.preschool_billing_period_policy_versions, public.preschool_fee_item_versions,
  public.preschool_fee_program_versions, public.preschool_fee_program_version_items,
  public.preschool_fixed_fee_types FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.preschool_fee_programs, public.preschool_fee_items,
  public.preschool_billing_period_policy_versions, public.preschool_fee_item_versions,
  public.preschool_fee_program_versions, public.preschool_fixed_fee_types TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.preschool_fee_program_version_items TO authenticated;

COMMIT;
