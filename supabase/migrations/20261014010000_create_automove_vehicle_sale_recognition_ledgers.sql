-- ============================================================================
-- AutoMove vehicle sale recognition ledgers
-- Scope: additive schema only; no service implementation, no ledger posting.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_auto_vehicle_sale_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AutoMove vehicle sale recognition ledgers are append-only.';
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_auto_vehicle_sale_recognition_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  vehicle_tenant_id UUID;
  customer_tenant_id UUID;
  actor_tenant_id UUID;
  booking_row RECORD;
BEGIN
  SELECT tenant_id
    INTO vehicle_tenant_id
    FROM public.auto_vehicles
   WHERE id = NEW.vehicle_id;

  IF vehicle_tenant_id IS NULL OR vehicle_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Vehicle sale recognition references a vehicle outside the recognition tenant.';
  END IF;

  SELECT tenant_id
    INTO customer_tenant_id
    FROM public.customers
   WHERE id = NEW.customer_id;

  IF customer_tenant_id IS NULL OR customer_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Vehicle sale recognition references a customer outside the recognition tenant.';
  END IF;

  IF NEW.booking_id IS NOT NULL THEN
    SELECT tenant_id, customer_id, vehicle_id
      INTO booking_row
      FROM public.auto_bookings
     WHERE id = NEW.booking_id;

    IF booking_row.tenant_id IS NULL OR booking_row.tenant_id <> NEW.tenant_id THEN
      RAISE EXCEPTION 'Vehicle sale recognition references a booking outside the recognition tenant.';
    END IF;

    IF booking_row.customer_id <> NEW.customer_id THEN
      RAISE EXCEPTION 'Vehicle sale recognition customer does not match the booking customer.';
    END IF;

    IF booking_row.vehicle_id IS NOT NULL AND booking_row.vehicle_id <> NEW.vehicle_id THEN
      RAISE EXCEPTION 'Vehicle sale recognition vehicle does not match the booking vehicle.';
    END IF;
  END IF;

  IF NEW.recognized_by_user_id IS NOT NULL THEN
    SELECT tenant_id
      INTO actor_tenant_id
      FROM public.users
     WHERE id = NEW.recognized_by_user_id;

    IF actor_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Vehicle sale recognition actor is outside the recognition tenant.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_auto_vehicle_sale_adjustment_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  recognition_tenant_id UUID;
  actor_tenant_id UUID;
BEGIN
  SELECT tenant_id
    INTO recognition_tenant_id
    FROM public.auto_vehicle_sale_recognitions
   WHERE id = NEW.recognition_id;

  IF recognition_tenant_id IS NULL OR recognition_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Vehicle sale recognition adjustment references a recognition outside the adjustment tenant.';
  END IF;

  IF NEW.created_by_user_id IS NOT NULL THEN
    SELECT tenant_id
      INTO actor_tenant_id
      FROM public.users
     WHERE id = NEW.created_by_user_id;

    IF actor_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Vehicle sale recognition adjustment actor is outside the adjustment tenant.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.auto_vehicle_sale_recognitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_transaction_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  booking_id UUID REFERENCES public.auto_bookings(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES public.auto_vehicles(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  recognized_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  recognized_by_user_id UUID REFERENCES public.users(id),
  recognition_basis TEXT NOT NULL,
  source_document_type TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  handover_evidence_ref TEXT,
  accounting_policy_id TEXT NOT NULL,
  accounting_policy_version TEXT NOT NULL,
  sale_price_recognized NUMERIC(18,0) NOT NULL CHECK (sale_price_recognized >= 0),
  discount_amount NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  price_adjustment_amount NUMERIC(18,0) NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL DEFAULT 'VND',
  deposit_received_total NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (deposit_received_total >= 0),
  payment_received_total NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (payment_received_total >= 0),
  receivable_amount_at_recognition NUMERIC(18,0) NOT NULL DEFAULT 0,
  cost_basis_at_sale NUMERIC(18,0) NOT NULL CHECK (cost_basis_at_sale >= 0),
  cost_basis_source_type TEXT NOT NULL,
  cost_basis_source_ref TEXT NOT NULL,
  cost_basis_components JSONB NOT NULL DEFAULT '{}'::jsonb,
  warranty_entitlement_ref TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT uq_auto_vehicle_sale_recognitions_transaction UNIQUE (tenant_id, sale_transaction_id),
  CONSTRAINT uq_auto_vehicle_sale_recognitions_idempotency UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT fk_auto_vehicle_sale_recognitions_policy
    FOREIGN KEY (accounting_policy_id, accounting_policy_version)
    REFERENCES public.policy_registry(policy_id, version)
    ON DELETE RESTRICT,
  CONSTRAINT chk_auto_vehicle_sale_recognitions_idempotency_key CHECK (btrim(idempotency_key) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_basis CHECK (btrim(recognition_basis) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_source_type CHECK (btrim(source_document_type) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_source_id CHECK (btrim(source_document_id) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_policy_id CHECK (btrim(accounting_policy_id) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_policy_version CHECK (accounting_policy_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_currency CHECK (currency_code = 'VND'),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_cost_source_type CHECK (btrim(cost_basis_source_type) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_cost_source_ref CHECK (btrim(cost_basis_source_ref) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_cost_components CHECK (jsonb_typeof(cost_basis_components) = 'object'),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_metadata CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.auto_vehicle_sale_recognition_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recognition_id UUID NOT NULL REFERENCES public.auto_vehicle_sale_recognitions(id) ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence_ref TEXT NOT NULL,
  affected_period_ref TEXT,
  created_by_user_id UUID REFERENCES public.users(id),
  accounting_policy_id TEXT NOT NULL,
  accounting_policy_version TEXT NOT NULL,
  sale_price_delta NUMERIC(18,0) NOT NULL DEFAULT 0,
  cost_basis_delta NUMERIC(18,0) NOT NULL DEFAULT 0,
  receivable_delta NUMERIC(18,0) NOT NULL DEFAULT 0,
  refund_amount NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  currency_code TEXT NOT NULL DEFAULT 'VND',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT uq_auto_vehicle_sale_adjustments_idempotency UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT fk_auto_vehicle_sale_adjustments_policy
    FOREIGN KEY (accounting_policy_id, accounting_policy_version)
    REFERENCES public.policy_registry(policy_id, version)
    ON DELETE RESTRICT,
  CONSTRAINT chk_auto_vehicle_sale_adjustments_type
    CHECK (adjustment_type IN (
      'sale_revenue_adjusted',
      'sale_revenue_reversed',
      'cost_basis_adjusted',
      'refund_recorded',
      'warranty_entitlement_adjusted'
    )),
  CONSTRAINT chk_auto_vehicle_sale_adjustments_idempotency_key CHECK (btrim(idempotency_key) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_adjustments_reason CHECK (btrim(reason) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_adjustments_evidence_ref CHECK (btrim(evidence_ref) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_adjustments_policy_id CHECK (btrim(accounting_policy_id) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_adjustments_policy_version CHECK (accounting_policy_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'),
  CONSTRAINT chk_auto_vehicle_sale_adjustments_currency CHECK (currency_code = 'VND'),
  CONSTRAINT chk_auto_vehicle_sale_adjustments_metadata CHECK (jsonb_typeof(metadata) = 'object')
);

ALTER TABLE public.auto_vehicle_sale_recognitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_vehicle_sale_recognition_adjustments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'trg_auto_vehicle_sale_recognitions_validate_tenant'
       AND tgrelid = 'public.auto_vehicle_sale_recognitions'::regclass
  ) THEN
    CREATE TRIGGER trg_auto_vehicle_sale_recognitions_validate_tenant
      BEFORE INSERT ON public.auto_vehicle_sale_recognitions
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_auto_vehicle_sale_recognition_tenant();
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'trg_auto_vehicle_sale_recognitions_append_only'
       AND tgrelid = 'public.auto_vehicle_sale_recognitions'::regclass
  ) THEN
    CREATE TRIGGER trg_auto_vehicle_sale_recognitions_append_only
      BEFORE UPDATE OR DELETE ON public.auto_vehicle_sale_recognitions
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_auto_vehicle_sale_ledger_mutation();
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'trg_auto_vehicle_sale_adjustments_validate_tenant'
       AND tgrelid = 'public.auto_vehicle_sale_recognition_adjustments'::regclass
  ) THEN
    CREATE TRIGGER trg_auto_vehicle_sale_adjustments_validate_tenant
      BEFORE INSERT ON public.auto_vehicle_sale_recognition_adjustments
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_auto_vehicle_sale_adjustment_tenant();
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'trg_auto_vehicle_sale_adjustments_append_only'
       AND tgrelid = 'public.auto_vehicle_sale_recognition_adjustments'::regclass
  ) THEN
    CREATE TRIGGER trg_auto_vehicle_sale_adjustments_append_only
      BEFORE UPDATE OR DELETE ON public.auto_vehicle_sale_recognition_adjustments
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_auto_vehicle_sale_ledger_mutation();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'auto_vehicle_sale_recognitions'
       AND policyname = 'Tenant select auto vehicle sale recognitions'
  ) THEN
    CREATE POLICY "Tenant select auto vehicle sale recognitions"
      ON public.auto_vehicle_sale_recognitions
      FOR SELECT TO authenticated
      USING (tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'auto_vehicle_sale_recognition_adjustments'
       AND policyname = 'Tenant select auto vehicle sale adjustments'
  ) THEN
    CREATE POLICY "Tenant select auto vehicle sale adjustments"
      ON public.auto_vehicle_sale_recognition_adjustments
      FOR SELECT TO authenticated
      USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

REVOKE ALL ON TABLE public.auto_vehicle_sale_recognitions FROM PUBLIC;
REVOKE ALL ON TABLE public.auto_vehicle_sale_recognitions FROM anon;
REVOKE ALL ON TABLE public.auto_vehicle_sale_recognitions FROM authenticated;
GRANT SELECT ON TABLE public.auto_vehicle_sale_recognitions TO authenticated;
GRANT SELECT, INSERT ON TABLE public.auto_vehicle_sale_recognitions TO service_role;

REVOKE ALL ON TABLE public.auto_vehicle_sale_recognition_adjustments FROM PUBLIC;
REVOKE ALL ON TABLE public.auto_vehicle_sale_recognition_adjustments FROM anon;
REVOKE ALL ON TABLE public.auto_vehicle_sale_recognition_adjustments FROM authenticated;
GRANT SELECT ON TABLE public.auto_vehicle_sale_recognition_adjustments TO authenticated;
GRANT SELECT, INSERT ON TABLE public.auto_vehicle_sale_recognition_adjustments TO service_role;

COMMENT ON TABLE public.auto_vehicle_sale_recognitions IS
  'AutoMove append-only recognized vehicle sale revenue snapshots. Schema only; ledger posting is not authorized by this migration.';

COMMENT ON TABLE public.auto_vehicle_sale_recognition_adjustments IS
  'AutoMove append-only adjustments and reversals linked to vehicle sale recognition snapshots.';
