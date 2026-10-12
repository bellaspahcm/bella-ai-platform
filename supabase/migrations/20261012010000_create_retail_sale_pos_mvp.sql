-- Retail Sale POS MVP contract.
-- Scope: Product-owned sale header/items and tenant-scoped idempotency only.
-- Boundaries: no Logistics kernel changes and no Finance ledger/accounting internals.

CREATE TABLE IF NOT EXISTS public.retail_pos_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  branch_id UUID NOT NULL,
  store_id UUID NOT NULL,
  sale_number TEXT NOT NULL,
  business_operation TEXT NOT NULL DEFAULT 'retail_pos.confirm_sale',
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid')),
  payment_method TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
  subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),
  customer_id UUID NULL,
  actor_id UUID NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  stock_out_issue_document_id UUID NULL,
  finance_outbox_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT retail_pos_sales_total_check
    CHECK (ROUND((subtotal - discount_amount + tax_amount)::numeric, 2) = total_amount),
  CONSTRAINT retail_pos_sales_tenant_operation_idempotency_unique
    UNIQUE (tenant_id, business_operation, idempotency_key),
  CONSTRAINT retail_pos_sales_tenant_sale_number_unique
    UNIQUE (tenant_id, sale_number)
);

CREATE TABLE IF NOT EXISTS public.retail_pos_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  sale_id UUID NOT NULL REFERENCES public.retail_pos_sales(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL,
  sku TEXT NOT NULL,
  logistics_item_id UUID NOT NULL,
  logistics_location_id UUID NOT NULL,
  warehouse_sku_id TEXT NOT NULL,
  warehouse_bin_id TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_of_measure TEXT NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  line_total NUMERIC(14,2) NOT NULL CHECK (line_total >= 0),
  lot_number TEXT NULL,
  serial_numbers TEXT[] NULL,
  unit_cost NUMERIC(14,2) NULL CHECK (unit_cost IS NULL OR unit_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT retail_pos_sale_items_line_total_formula_check
    CHECK (ROUND((quantity * unit_price - discount_amount)::numeric, 2) = line_total)
);

-- zero-downtime: allow blocking-index - new Retail Sale POS MVP tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_retail_pos_sales_tenant_branch_created
  ON public.retail_pos_sales (tenant_id, branch_id, created_at DESC);

-- zero-downtime: allow blocking-index - new Retail Sale POS MVP tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_retail_pos_sales_tenant_store_created
  ON public.retail_pos_sales (tenant_id, store_id, created_at DESC);

-- zero-downtime: allow blocking-index - new Retail Sale POS MVP tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_retail_pos_sale_items_sale
  ON public.retail_pos_sale_items (tenant_id, sale_id);

ALTER TABLE public.retail_pos_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_pos_sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS retail_pos_sales_tenant_select ON public.retail_pos_sales;
CREATE POLICY retail_pos_sales_tenant_select
  ON public.retail_pos_sales
  FOR SELECT
  TO authenticated
  USING (tenant_id::text = COALESCE(auth.jwt() ->> 'tenant_id', public.get_auth_tenant_id()::text));

DROP POLICY IF EXISTS retail_pos_sales_tenant_insert ON public.retail_pos_sales;
CREATE POLICY retail_pos_sales_tenant_insert
  ON public.retail_pos_sales
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id::text = COALESCE(auth.jwt() ->> 'tenant_id', public.get_auth_tenant_id()::text));

DROP POLICY IF EXISTS retail_pos_sales_tenant_update ON public.retail_pos_sales;
CREATE POLICY retail_pos_sales_tenant_update
  ON public.retail_pos_sales
  FOR UPDATE
  TO authenticated
  USING (tenant_id::text = COALESCE(auth.jwt() ->> 'tenant_id', public.get_auth_tenant_id()::text))
  WITH CHECK (tenant_id::text = COALESCE(auth.jwt() ->> 'tenant_id', public.get_auth_tenant_id()::text));

DROP POLICY IF EXISTS retail_pos_sale_items_tenant_select ON public.retail_pos_sale_items;
CREATE POLICY retail_pos_sale_items_tenant_select
  ON public.retail_pos_sale_items
  FOR SELECT
  TO authenticated
  USING (tenant_id::text = COALESCE(auth.jwt() ->> 'tenant_id', public.get_auth_tenant_id()::text));

DROP POLICY IF EXISTS retail_pos_sale_items_tenant_insert ON public.retail_pos_sale_items;
CREATE POLICY retail_pos_sale_items_tenant_insert
  ON public.retail_pos_sale_items
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id::text = COALESCE(auth.jwt() ->> 'tenant_id', public.get_auth_tenant_id()::text));

GRANT SELECT, INSERT, UPDATE ON public.retail_pos_sales TO authenticated;
GRANT SELECT, INSERT ON public.retail_pos_sale_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retail_pos_sales TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retail_pos_sale_items TO service_role;

COMMENT ON TABLE public.retail_pos_sales IS
  'Retail Sale POS MVP sale header with tenant-scoped idempotency and downstream stock/Finance evidence.';
COMMENT ON TABLE public.retail_pos_sale_items IS
  'Retail Sale POS MVP sale lines. Product-owned; Logistics receives stock-out through public facade only.';
