-- Tourism OS Foundation MVP
-- Scope: OS-level tour catalog, itinerary, departures, capacity, booking, participants,
-- tenant isolation, idempotency, and local audit evidence.
-- Product identity and product routes are intentionally not included in this OS migration.

CREATE OR REPLACE FUNCTION public.tourism_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.tourism_tours (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  tour_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, tour_code)
);

CREATE TABLE IF NOT EXISTS public.tourism_tour_packages (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  tour_id UUID NOT NULL,
  package_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, tour_id, package_code),
  CONSTRAINT tourism_tour_packages_tour_fk
    FOREIGN KEY (tenant_id, tour_id) REFERENCES public.tourism_tours(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.tourism_itinerary_days (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  tour_id UUID NOT NULL,
  package_id UUID NOT NULL,
  day_number INTEGER NOT NULL CHECK (day_number > 0),
  title TEXT NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, package_id, day_number),
  CONSTRAINT tourism_itinerary_days_tour_fk
    FOREIGN KEY (tenant_id, tour_id) REFERENCES public.tourism_tours(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT tourism_itinerary_days_package_fk
    FOREIGN KEY (tenant_id, package_id) REFERENCES public.tourism_tour_packages(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.tourism_itinerary_segments (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  itinerary_day_id UUID NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  title TEXT NOT NULL,
  start_location TEXT,
  end_location TEXT,
  starts_at TIME,
  ends_at TIME,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, itinerary_day_id, sequence),
  CONSTRAINT tourism_itinerary_segments_day_fk
    FOREIGN KEY (tenant_id, itinerary_day_id) REFERENCES public.tourism_itinerary_days(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.tourism_departures (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  tour_id UUID NOT NULL,
  package_id UUID NOT NULL,
  departure_code TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  capacity_total INTEGER NOT NULL CHECK (capacity_total > 0),
  capacity_reserved INTEGER NOT NULL DEFAULT 0 CHECK (capacity_reserved >= 0),
  capacity_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (capacity_confirmed >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled', 'completed')),
  opened_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, departure_code),
  CHECK (ends_on >= starts_on),
  CHECK (capacity_reserved + capacity_confirmed <= capacity_total),
  CONSTRAINT tourism_departures_tour_fk
    FOREIGN KEY (tenant_id, tour_id) REFERENCES public.tourism_tours(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT tourism_departures_package_fk
    FOREIGN KEY (tenant_id, package_id) REFERENCES public.tourism_tour_packages(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.tourism_bookings (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  departure_id UUID NOT NULL,
  booking_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  booker_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE RESTRICT,
  seat_count INTEGER NOT NULL CHECK (seat_count > 0),
  idempotency_key TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  confirmed_by UUID REFERENCES public.users(id) ON DELETE RESTRICT,
  cancelled_by UUID REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, departure_id, booking_code),
  UNIQUE (tenant_id, departure_id, idempotency_key),
  CONSTRAINT tourism_bookings_departure_fk
    FOREIGN KEY (tenant_id, departure_id) REFERENCES public.tourism_departures(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.tourism_participants (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  booking_id UUID NOT NULL,
  party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE RESTRICT,
  display_name TEXT NOT NULL,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('adult', 'child', 'infant')),
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, booking_id, party_id),
  CONSTRAINT tourism_participants_booking_fk
    FOREIGN KEY (tenant_id, booking_id) REFERENCES public.tourism_bookings(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.tourism_command_idempotency (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  operation TEXT NOT NULL,
  business_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, operation, business_key)
);

CREATE TABLE IF NOT EXISTS public.tourism_audit_events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.tourism_assert_booking_party_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  party_tenant UUID;
BEGIN
  SELECT tenant_id INTO party_tenant
  FROM public.party_parties
  WHERE id = NEW.booker_party_id;

  IF party_tenant IS NULL OR party_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Tourism booking Party tenant mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tourism_assert_participant_party_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  party_tenant UUID;
BEGIN
  SELECT tenant_id INTO party_tenant
  FROM public.party_parties
  WHERE id = NEW.party_id;

  IF party_tenant IS NULL OR party_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Tourism participant Party tenant mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tourism_assert_booking_departure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  departure_record public.tourism_departures%ROWTYPE;
BEGIN
  SELECT * INTO departure_record
  FROM public.tourism_departures
  WHERE tenant_id = NEW.tenant_id
    AND id = NEW.departure_id;

  IF departure_record.id IS NULL THEN
    RAISE EXCEPTION 'Tourism departure was not found for booking';
  END IF;

  IF NEW.status <> 'cancelled' AND departure_record.status <> 'open' THEN
    RAISE EXCEPTION 'Tourism departure must be open for active booking';
  END IF;

  IF NEW.seat_count > departure_record.capacity_total THEN
    RAISE EXCEPTION 'Tourism booking exceeds departure capacity';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tourism_assert_booking_party_tenant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tourism_assert_participant_party_tenant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tourism_assert_booking_departure() FROM PUBLIC;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'tourism_tours',
    'tourism_tour_packages',
    'tourism_itinerary_days',
    'tourism_itinerary_segments',
    'tourism_departures',
    'tourism_bookings',
    'tourism_participants'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tourism_set_updated_at()',
      table_name,
      table_name
    );
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS tourism_bookings_assert_party_tenant ON public.tourism_bookings;
CREATE TRIGGER tourism_bookings_assert_party_tenant
  BEFORE INSERT OR UPDATE OF booker_party_id, tenant_id
  ON public.tourism_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.tourism_assert_booking_party_tenant();

DROP TRIGGER IF EXISTS tourism_participants_assert_party_tenant ON public.tourism_participants;
CREATE TRIGGER tourism_participants_assert_party_tenant
  BEFORE INSERT OR UPDATE OF party_id, tenant_id
  ON public.tourism_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.tourism_assert_participant_party_tenant();

DROP TRIGGER IF EXISTS tourism_bookings_assert_departure ON public.tourism_bookings;
CREATE TRIGGER tourism_bookings_assert_departure
  BEFORE INSERT OR UPDATE OF tenant_id, departure_id, seat_count, status
  ON public.tourism_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.tourism_assert_booking_departure();

-- zero-downtime: allow blocking-index - new Tourism OS foundation tables have no existing production rows.
CREATE INDEX IF NOT EXISTS tourism_tours_tenant_status_idx ON public.tourism_tours(tenant_id, status);
-- zero-downtime: allow blocking-index - new Tourism OS foundation tables have no existing production rows.
CREATE INDEX IF NOT EXISTS tourism_packages_tenant_tour_idx ON public.tourism_tour_packages(tenant_id, tour_id);
-- zero-downtime: allow blocking-index - new Tourism OS foundation tables have no existing production rows.
CREATE INDEX IF NOT EXISTS tourism_itinerary_days_tenant_package_idx ON public.tourism_itinerary_days(tenant_id, package_id, day_number);
-- zero-downtime: allow blocking-index - new Tourism OS foundation tables have no existing production rows.
CREATE INDEX IF NOT EXISTS tourism_itinerary_segments_tenant_day_idx ON public.tourism_itinerary_segments(tenant_id, itinerary_day_id, sequence);
-- zero-downtime: allow blocking-index - new Tourism OS foundation tables have no existing production rows.
CREATE INDEX IF NOT EXISTS tourism_departures_tenant_status_idx ON public.tourism_departures(tenant_id, status, starts_on);
-- zero-downtime: allow blocking-index - new Tourism OS foundation tables have no existing production rows.
CREATE INDEX IF NOT EXISTS tourism_bookings_tenant_departure_idx ON public.tourism_bookings(tenant_id, departure_id, status);
-- zero-downtime: allow blocking-index - new Tourism OS foundation tables have no existing production rows.
CREATE INDEX IF NOT EXISTS tourism_participants_tenant_booking_idx ON public.tourism_participants(tenant_id, booking_id);
-- zero-downtime: allow blocking-index - new Tourism OS foundation tables have no existing production rows.
CREATE INDEX IF NOT EXISTS tourism_audit_events_tenant_entity_idx ON public.tourism_audit_events(tenant_id, entity_type, entity_id);

ALTER TABLE public.tourism_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tourism_tour_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tourism_itinerary_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tourism_itinerary_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tourism_departures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tourism_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tourism_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tourism_command_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tourism_audit_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'tourism_tours',
    'tourism_tour_packages',
    'tourism_itinerary_days',
    'tourism_itinerary_segments',
    'tourism_departures',
    'tourism_bookings',
    'tourism_participants',
    'tourism_command_idempotency',
    'tourism_audit_events'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_isolation ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_tenant_isolation ON public.%I FOR ALL TO authenticated USING (tenant_id = (current_setting(''app.current_tenant_id'', true))::uuid) WITH CHECK (tenant_id = (current_setting(''app.current_tenant_id'', true))::uuid)',
      table_name,
      table_name
    );
  END LOOP;
END $$;

REVOKE ALL ON public.tourism_tours FROM anon;
REVOKE ALL ON public.tourism_tour_packages FROM anon;
REVOKE ALL ON public.tourism_itinerary_days FROM anon;
REVOKE ALL ON public.tourism_itinerary_segments FROM anon;
REVOKE ALL ON public.tourism_departures FROM anon;
REVOKE ALL ON public.tourism_bookings FROM anon;
REVOKE ALL ON public.tourism_participants FROM anon;
REVOKE ALL ON public.tourism_command_idempotency FROM anon;
REVOKE ALL ON public.tourism_audit_events FROM anon;

GRANT SELECT, INSERT, UPDATE ON public.tourism_tours TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tourism_tour_packages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tourism_itinerary_days TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tourism_itinerary_segments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tourism_departures TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tourism_bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tourism_participants TO authenticated;
GRANT SELECT, INSERT ON public.tourism_command_idempotency TO authenticated;
GRANT SELECT, INSERT ON public.tourism_audit_events TO authenticated;
