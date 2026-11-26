-- Migration: 20261126000002_operational_entities_unified_audit_trail.sql
-- Description: Unified Lifecycle Timestamps, Actors, and Status History Audit Trail for All Interior Operational Entities

-- 1. Master Projects
ALTER TABLE public.interior_projects
  ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_by_id uuid,
  ADD COLUMN IF NOT EXISTS started_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by_id uuid,
  ADD COLUMN IF NOT EXISTS completed_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Workshop Production Orders
ALTER TABLE public.interior_production_orders
  ADD COLUMN IF NOT EXISTS created_by_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_by_id uuid,
  ADD COLUMN IF NOT EXISTS started_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by_id uuid,
  ADD COLUMN IF NOT EXISTS completed_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Site Room Installations
ALTER TABLE public.interior_site_room_installations
  ADD COLUMN IF NOT EXISTS created_by_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_by_id uuid,
  ADD COLUMN IF NOT EXISTS started_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by_id uuid,
  ADD COLUMN IF NOT EXISTS completed_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 4. QC Punch List Items
ALTER TABLE public.interior_qc_punch_list_items
  ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_by_id uuid,
  ADD COLUMN IF NOT EXISTS started_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by_id uuid,
  ADD COLUMN IF NOT EXISTS completed_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 5. Warranty & Maintenance Service Tickets
ALTER TABLE public.interior_warranty_service_tickets
  ADD COLUMN IF NOT EXISTS created_by_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_by_id uuid,
  ADD COLUMN IF NOT EXISTS started_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by_id uuid,
  ADD COLUMN IF NOT EXISTS completed_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 6. Bill of Quantities (BOQ)
ALTER TABLE public.interior_boqs
  ADD COLUMN IF NOT EXISTS created_by_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_by_id uuid,
  ADD COLUMN IF NOT EXISTS started_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by_id uuid,
  ADD COLUMN IF NOT EXISTS completed_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 7. Commercial Contracts
ALTER TABLE public.interior_contracts
  ADD COLUMN IF NOT EXISTS created_by_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_by_id uuid,
  ADD COLUMN IF NOT EXISTS started_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by_id uuid,
  ADD COLUMN IF NOT EXISTS completed_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 8. Payment Milestones
ALTER TABLE public.interior_payment_milestones
  ADD COLUMN IF NOT EXISTS created_by_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_by_id uuid,
  ADD COLUMN IF NOT EXISTS started_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by_id uuid,
  ADD COLUMN IF NOT EXISTS completed_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb;
