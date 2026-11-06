-- =============================================================================
-- Migration: Interior Finance Outbox & Approved Design Idempotency Constraint
-- Ngày: 2026-11-06
-- Mục đích:
--   1. Tạo bảng public.interior_finance_outbox cho Transactional Outbox Pattern
--      giữa Bella Interior OS và Finance OS (Event-After-Persistence).
--   2. Tạo RPC enqueue_interior_finance_event với tính năng Idempotent (ON CONFLICT DO NOTHING).
--   3. Thêm Unique Constraint uq_interior_prod_orders_design trên interior_production_orders
--      để bảo đảm Approved Design Lock ở tầng Database (không thể tạo 2 PO cho cùng 1 design revision).
-- =============================================================================

-- =============================================================================
-- 1. Table: interior_finance_outbox
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.interior_finance_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Event & reference metadata
    event_type TEXT NOT NULL,          -- e.g. 'INTERIOR_CONTRACT_MILESTONE_INVOICED', 'WARRANTY_PROVISION_POSTED'
    reference_type TEXT NOT NULL,      -- e.g. 'INTERIOR_CONTRACT', 'PAYMENT_MILESTONE', 'WARRANTY_CERTIFICATE'
    reference_id TEXT NOT NULL,        -- ID của bản ghi nghiệp vụ gốc (String/UUID)

    -- Payload JSONB
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Processing status
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD')),

    -- Retry tracking
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,
    last_error TEXT,
    next_retry_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),

    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    processed_at TIMESTAMPTZ,

    -- Idempotency constraint: Cùng tenant + event_type + reference_type + reference_id chỉ được ghi nhận 1 lần
    CONSTRAINT uq_interior_finance_outbox_event UNIQUE (tenant_id, event_type, reference_type, reference_id)
);

-- Indexes for worker / dashboard
-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_outbox_worker_pending
    ON public.interior_finance_outbox (next_retry_at, created_at)
    WHERE status IN ('PENDING', 'FAILED');

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_outbox_tenant_status
    ON public.interior_finance_outbox (tenant_id, status, created_at DESC);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_outbox_reference
    ON public.interior_finance_outbox (tenant_id, reference_type, reference_id);

-- RLS
ALTER TABLE public.interior_finance_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON public.interior_finance_outbox;
CREATE POLICY tenant_isolation_policy ON public.interior_finance_outbox
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- =============================================================================
-- 2. Helper RPC: enqueue_interior_finance_event
-- =============================================================================
CREATE OR REPLACE FUNCTION public.enqueue_interior_finance_event(
    p_tenant_id UUID,
    p_event_type TEXT,
    p_reference_type TEXT,
    p_reference_id TEXT,
    p_payload JSONB
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.interior_finance_outbox (
        tenant_id, event_type, reference_type, reference_id, payload
    ) VALUES (
        p_tenant_id, p_event_type, p_reference_type, p_reference_id, p_payload
    )
    ON CONFLICT (tenant_id, event_type, reference_type, reference_id) DO NOTHING
    RETURNING id INTO v_id;

    RETURN v_id;  -- NULL nếu đã tồn tại bản ghi trùng lặp (idempotent duplicate)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. Invariant: Database-level Approved Design Lock on Production Orders
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_interior_prod_orders_design'
    ) THEN
        ALTER TABLE public.interior_production_orders
            ADD CONSTRAINT uq_interior_prod_orders_design
            UNIQUE (tenant_id, design_revision_id, project_id);
    END IF;
END $$;

