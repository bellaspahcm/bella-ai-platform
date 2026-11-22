-- ============================================================
-- Bella Interior OS — Scheduled Events Table
-- Migration: 20261123000001_interior_scheduled_events
--
-- Purpose: Persistent storage for Lịch công việc & Điều phối
--   calendar events (weekly schedule tasks).
-- Change Authority: PRODUCT layer only — no Kernel tables touched.
-- ============================================================

-- ── Table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interior_scheduled_events (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL,
  project_id    uuid        REFERENCES public.interior_projects(id) ON DELETE SET NULL,
  project_name  text        NOT NULL DEFAULT '',
  title         text        NOT NULL,
  category      text        NOT NULL DEFAULT 'design'
                  CHECK (category IN ('design', 'workshop', 'site', 'handover')),
  status        text        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'cancelled')),
  assignee_name text        NOT NULL DEFAULT '',
  day_index     integer     NOT NULL DEFAULT 0
                  CHECK (day_index >= 0 AND day_index <= 6),
  time_slot_id  text        NOT NULL DEFAULT 'slot-1'
                  CHECK (time_slot_id IN ('slot-1', 'slot-2', 'slot-3', 'slot-4')),
  priority      text        NOT NULL DEFAULT 'normal'
                  CHECK (priority IN ('normal', 'urgent')),
  scheduled_week_start date NOT NULL DEFAULT CURRENT_DATE,
  notes         text,
  created_by_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT interior_scheduled_events_pkey PRIMARY KEY (id)
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_interior_scheduled_events_tenant
  ON public.interior_scheduled_events (tenant_id);

CREATE INDEX IF NOT EXISTS idx_interior_scheduled_events_week
  ON public.interior_scheduled_events (tenant_id, scheduled_week_start);

CREATE INDEX IF NOT EXISTS idx_interior_scheduled_events_status
  ON public.interior_scheduled_events (tenant_id, status);

-- ── Updated-at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.interior_scheduled_events_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_interior_scheduled_events_updated_at
  ON public.interior_scheduled_events;

CREATE TRIGGER trg_interior_scheduled_events_updated_at
  BEFORE UPDATE ON public.interior_scheduled_events
  FOR EACH ROW EXECUTE FUNCTION public.interior_scheduled_events_set_updated_at();

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE public.interior_scheduled_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read events for their own tenant
CREATE POLICY "interior_scheduled_events_tenant_read"
  ON public.interior_scheduled_events
  FOR SELECT
  TO authenticated
  USING (tenant_id = (
    SELECT tenant_id FROM public.interior_project_members
    WHERE user_id = auth.uid()
    LIMIT 1
  ));

-- Allow authenticated users to insert events for their own tenant
CREATE POLICY "interior_scheduled_events_tenant_insert"
  ON public.interior_scheduled_events
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (
    SELECT tenant_id FROM public.interior_project_members
    WHERE user_id = auth.uid()
    LIMIT 1
  ));

-- Allow authenticated users to update events for their own tenant
CREATE POLICY "interior_scheduled_events_tenant_update"
  ON public.interior_scheduled_events
  FOR UPDATE
  TO authenticated
  USING (tenant_id = (
    SELECT tenant_id FROM public.interior_project_members
    WHERE user_id = auth.uid()
    LIMIT 1
  ))
  WITH CHECK (tenant_id = (
    SELECT tenant_id FROM public.interior_project_members
    WHERE user_id = auth.uid()
    LIMIT 1
  ));

-- Allow authenticated users to delete events for their own tenant
CREATE POLICY "interior_scheduled_events_tenant_delete"
  ON public.interior_scheduled_events
  FOR DELETE
  TO authenticated
  USING (tenant_id = (
    SELECT tenant_id FROM public.interior_project_members
    WHERE user_id = auth.uid()
    LIMIT 1
  ));

-- ── Grants ───────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.interior_scheduled_events
  TO authenticated;

-- ── Seed demo data for tenant 686884d2-6a4a-4581-ac8f-6ae69666b31d ──
-- Week starting 2026-11-03 (Mon = Thứ 2 offset, but UI shows Thứ 3 as day 0)
INSERT INTO public.interior_scheduled_events
  (tenant_id, project_name, title, category, status, assignee_name, day_index, time_slot_id, priority, scheduled_week_start, notes)
VALUES
  ('686884d2-6a4a-4581-ac8f-6ae69666b31d', 'Villa Sunrise',       'Khảo sát công trình',   'design',   'pending',   'KTS. Hoàng Long',  0, 'slot-1', 'normal', '2026-11-03', NULL),
  ('686884d2-6a4a-4581-ac8f-6ae69666b31d', 'Office Tower',        'Duyệt bản vẽ',          'design',   'pending',   'KTS. Lê Hoàng',    1, 'slot-2', 'normal', '2026-11-03', NULL),
  ('686884d2-6a4a-4581-ac8f-6ae69666b31d', 'Skyline Residence',   'Họp khách hàng',        'design',   'pending',   'PM. Mai',          2, 'slot-1', 'urgent', '2026-11-03', NULL),
  ('686884d2-6a4a-4581-ac8f-6ae69666b31d', 'Tủ bếp',              'Kiểm tra sản xuất',     'workshop', 'in_progress','QĐ. Tuấn',        3, 'slot-3', 'normal', '2026-11-03', NULL),
  ('686884d2-6a4a-4581-ac8f-6ae69666b31d', 'Duplex Aqua Bay',     'Nghiệm thu',            'handover', 'overdue',   'PM. Hùng',         4, 'slot-3', 'urgent', '2026-11-03', 'Cần xử lý ngay'),
  ('686884d2-6a4a-4581-ac8f-6ae69666b31d', 'The Garden Villa',    'Lắp đặt nội thất',      'site',     'pending',   'Đội 1',            6, 'slot-4', 'normal', '2026-11-03', NULL)
ON CONFLICT DO NOTHING;
