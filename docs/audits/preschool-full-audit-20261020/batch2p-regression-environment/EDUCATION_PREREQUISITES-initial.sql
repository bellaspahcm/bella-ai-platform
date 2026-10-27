-- LOCAL REGRESSION ONLY. Exact prerequisite statements from pinned source; no remote target.

-- SOURCE supabase/migrations/20260511000000_initial_schema.sql:1; SHA256 589f94cdc97ea8bd8a6565e8ca2a98f6bc2f5e6d053b935a8437344a1d2fc9bc
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- SOURCE supabase/migrations/20260511000000_initial_schema.sql:2; SHA256 7e3b2d8f4a3f60254d11255ccb21240710cd377e01f0c706f2f7640fd6cab15e


-- 16. TENANTS (Create first because others depend on it)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    parent_tenant_id UUID REFERENCES tenants(id),
    franchise_agreement_date DATE,
    royalty_rate DECIMAL,
    contact_name TEXT,
    contact_phone TEXT,
    address TEXT,
    status TEXT CHECK (status IN ('active', 'suspended', 'terminated')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SOURCE supabase/migrations/20260511000000_initial_schema.sql:17; SHA256 00c1acd75189667fba7ba4d5bda1127181ccf0bbeafb2d27a01ea9e588f7b84d


-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT, 
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT CHECK (role IN ('admin', 'ktv_lead', 'ktv', 'admin_staff', 'accountant')) NOT NULL,
    avatar_url TEXT,
    status TEXT DEFAULT 'active',
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SOURCE supabase/migrations/20260511000000_initial_schema.sql:258; SHA256 433405cb66efabdb4ffe1f6c8d5402c5f7397a02ff91480826ba928bdd11323a


-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- SOURCE supabase/migrations/20260521000004_harden_rls_and_tenant.sql:10; SHA256 d484131d573f23caa750b7703c1e89f4e919eef571ae6050d01e6b2dd1eb40b5


CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$
DECLARE
    t_id UUID;
BEGIN
    SELECT tenant_id INTO t_id FROM public.users WHERE id = auth.uid();
    RETURN t_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:1; SHA256 162d6fbb3ec5e3182b94295ea70e9c7bd3685a3a427c0766f8d2facdd4b9e04c
-- ============================================================================
-- Bella AI Platform — Industry Blueprint Core Schema
-- Migration: 20260806000000_blueprint_core_schema.sql
-- ============================================================================

-- 1. PARTY PARTIES (Identity Aggregate)
CREATE TABLE IF NOT EXISTS public.party_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    party_type TEXT NOT NULL CHECK (party_type IN ('person', 'organization')),
    display_name TEXT NOT NULL,
    legal_name TEXT,
    tax_code TEXT,
    dob DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    blood_type TEXT,
    
    -- Auditing & Optimistic Locking
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:25; SHA256 29d468609f5d40622aaee3ec6207a96606d00135ea5f39bbfc5a9b2f1916bf0e


-- Indexes for Party Parties
CREATE INDEX IF NOT EXISTS idx_party_parties_tenant ON public.party_parties(tenant_id);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:28; SHA256 09437c53458280d13fc1b276eeeab7041ed8194961da7252f6225477a708e6e8

CREATE INDEX IF NOT EXISTS idx_party_parties_type ON public.party_parties(party_type);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:29; SHA256 718be6841ded56cf3735c0d8190dc815fd374f08aa7bcc17cb2a507c94d99ba3

CREATE INDEX IF NOT EXISTS idx_party_parties_deleted ON public.party_parties(deleted_at) WHERE deleted_at IS NULL;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:30; SHA256 5ebc364f6fa370aec23f2acb72abb665496f185710dadd6a95c3bb7347a2638f


-- 2. PARTY DYNAMIC IDENTIFIERS (CCCD, Passport, BHYT, external HIS ID...)
CREATE TABLE IF NOT EXISTS public.party_identifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    identifier_type TEXT NOT NULL, -- 'cccd', 'passport', 'bhyt', 'tax_id', 'external_his_id', 'crm_id', 'license_number'
    identifier_value TEXT NOT NULL,
    issued_at DATE,
    expires_at DATE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, identifier_type, identifier_value)
);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:43; SHA256 5deaa8a9ca476faa396e24869db11369e325486e8847dad7a313764ba606e692


CREATE INDEX IF NOT EXISTS idx_party_identifiers_party ON public.party_identifiers(party_id);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:45; SHA256 bcbb212eba4c52a6383d71565c962b0dd5aed97e0c6cd8c292824dd6656c9d55

CREATE INDEX IF NOT EXISTS idx_party_identifiers_lookup ON public.party_identifiers(tenant_id, identifier_type, identifier_value);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:46; SHA256 e30a7c49ddf0de8f620924d76625758eb484149e759102307818be0f017a9aeb


-- 3. PARTY RELATIONSHIPS (Guardian, structures, memberships...)
CREATE TABLE IF NOT EXISTS public.party_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    source_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    target_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL, -- 'parent_of', 'guardian_of', 'works_for', 'referred_by', 'member_of'
    attributes JSONB NOT NULL DEFAULT '{}',
    active_from DATE DEFAULT CURRENT_DATE,
    active_to DATE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, source_party_id, target_party_id, relationship_type)
);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:61; SHA256 e775ed61ea115516290cc35f492635aabd16fa7dd850c9c6bcf674a6482c2269


CREATE INDEX IF NOT EXISTS idx_party_relationships_source ON public.party_relationships(source_party_id);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:63; SHA256 86b26802a243ed247967acec6c017880daff4653c34a360d929b72489b16fd16

CREATE INDEX IF NOT EXISTS idx_party_relationships_target ON public.party_relationships(target_party_id);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:64; SHA256 f9691b5f1ba3d487802e23826de807b6f17429aedcf6df18ec5d4873b42541f4


-- 4. PARTY ROLES (Context-aware dynamic roles)
CREATE TABLE IF NOT EXISTS public.party_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL, -- 'healthcare', 'auto', 'real_estate'
    role_type TEXT NOT NULL, -- 'patient', 'doctor', 'buyer', 'technician'...
    attributes JSONB NOT NULL DEFAULT '{}',
    active_from DATE DEFAULT CURRENT_DATE,
    active_to DATE,
    UNIQUE (tenant_id, party_id, vertical, role_type)
);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:77; SHA256 b6d16796d9776a5f7325f5143bb34d63ffd188ad99b4c9d0f743eeb80ab663cf


CREATE INDEX IF NOT EXISTS idx_party_roles_lookup ON public.party_roles(tenant_id, vertical, role_type);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:79; SHA256 3884b6f1eaeaa49f18707bad261d59a8a671967af5ddd9ee5a4fbae73867c453


-- 5. JOURNEY JOURNEYS (Business Aggregate Root)
CREATE TABLE IF NOT EXISTS public.journey_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL,
    journey_type TEXT NOT NULL, -- 'implant_care', 'car_repair', 'buying_process'
    primary_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    completed_at TIMESTAMPTZ,
    ai_summary TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:96; SHA256 22f00d945a2336e6fc188e3740739b17f6a436fbb8f09c6ba047769211f7e135


CREATE INDEX IF NOT EXISTS idx_journey_journeys_tenant ON public.journey_journeys(tenant_id);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:98; SHA256 e6c79f8521dad520db86862798edad1bf191097dfcba370c459f2ff2e39f2918

CREATE INDEX IF NOT EXISTS idx_journey_journeys_party ON public.journey_journeys(primary_party_id);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:99; SHA256 bfdfc09f0975b9f96a18573741c16d0cf1132ad0983ee745b0c649ea0c66eba7


-- 6. JOURNEY SUB-JOURNEYS (Distinct phases with their own lifecycle)
CREATE TABLE IF NOT EXISTS public.journey_sub_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    journey_id UUID NOT NULL REFERENCES public.journey_journeys(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- 'implant_surgery_stage', 'prosthetic_stage'
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:112; SHA256 73d4cc310be80e94c8971420cdee9dbe5772ef5185df1f62c2f9a4718ae18a25


CREATE INDEX IF NOT EXISTS idx_journey_sub_journeys_journey ON public.journey_sub_journeys(journey_id);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:114; SHA256 c4aef5b0d8f255b32d2b654c84c30c341eb63bcda4e0cbc5e297a4979ffa964e


-- 7. JOURNEY MILESTONES (Progress markers with AI validation)
CREATE TABLE IF NOT EXISTS public.journey_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    journey_id UUID NOT NULL REFERENCES public.journey_journeys(id) ON DELETE CASCADE,
    sub_journey_id UUID REFERENCES public.journey_sub_journeys(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- 'implant_placement', 'healing_complete', 'crown_fitting'
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
    target_date DATE,
    completed_at TIMESTAMPTZ,
    ai_validation_details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (journey_id, name)
);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:129; SHA256 3723d1713a2c9392fdda3c61c76964691cea3342abab3cf49213fc7ec0d5d56b


CREATE INDEX IF NOT EXISTS idx_journey_milestones_sub ON public.journey_milestones(sub_journey_id);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:131; SHA256 4a904f655ee66f0c70fc9949c5510ada943c3938214229733aed7e609e0d298d


-- 8. TIMELINE EVENTS (Platform Event Store - Append-only)
CREATE TABLE IF NOT EXISTS public.timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL,
    primary_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    journey_id UUID REFERENCES public.journey_journeys(id) ON DELETE SET NULL,
    correlation_id UUID NOT NULL,
    causation_id UUID,
    event_category TEXT NOT NULL CHECK (event_category IN ('business', 'audit', 'ai', 'system')),
    event_type TEXT NOT NULL,
    event_version TEXT NOT NULL DEFAULT 'v1',
    schema_version TEXT NOT NULL DEFAULT '1.0.0',
    aggregate_id UUID NOT NULL,
    aggregate_type TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    event_hash TEXT NOT NULL,
    reference_table TEXT,
    reference_id UUID,
    summary TEXT NOT NULL,
    ai_insight TEXT,
    event_data JSONB NOT NULL DEFAULT '{}',
    recorded_by UUID REFERENCES public.party_parties(id),
    occurred_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, aggregate_type, aggregate_id, sequence_number)
);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:158; SHA256 6015ab32ba92fee1426ea2dc6704d925c85cf91725e087b8efb59080f59ee024


CREATE INDEX IF NOT EXISTS idx_timeline_events_party ON public.timeline_events(primary_party_id, occurred_at DESC);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:160; SHA256 b33655b841333806f3b5b254fba26424b550b7717ccc8ced06eedfed6a1c3072

CREATE INDEX IF NOT EXISTS idx_timeline_events_correlation ON public.timeline_events(correlation_id);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:161; SHA256 80e7c3f42056de19ca4d008c82974322d92c085627b522c30e6c8fbc547dae8c

CREATE INDEX IF NOT EXISTS idx_timeline_events_aggregate ON public.timeline_events(aggregate_type, aggregate_id);

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:162; SHA256 64f434933fc7592d76adc688a19fff7e1feb116d7de57f14edc02b506d05fb56


-- Enforce Timeline Immutability (no UPDATE or DELETE at DB level)
CREATE OR REPLACE RULE timeline_events_no_update AS ON UPDATE TO public.timeline_events DO INSTEAD NOTHING;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:165; SHA256 0fdb8cc0cd6b985bca81261c0d392331506ddcbe3d3e0af5b4279343e8748b3e

CREATE OR REPLACE RULE timeline_events_no_delete AS ON DELETE TO public.timeline_events DO INSTEAD NOTHING;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:166; SHA256 e3d0251713fef490aca3c2891563780ba0bbd620c6433551a50e869b052550a4


-- 9. ENABLE ROW LEVEL SECURITY (RLS) FOR CORE TABLES
ALTER TABLE public.party_parties ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:169; SHA256 600b354a433a127c954de40a4939786e750223020be21ae6ee836028f07d41c4

ALTER TABLE public.party_identifiers ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:170; SHA256 d24a9354eee3044ff0883d4f18fa8978e6a739d596e440ea446053cf917f18ac

ALTER TABLE public.party_relationships ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:171; SHA256 d9ae9d0709b495891b59df1cee2b98b1452f44677b11067df73eccffc5149eba

ALTER TABLE public.party_roles ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:172; SHA256 8374b6e33c2fd74f8e400c55f76d4747743d44abdadb2496f58f0adecf414182

ALTER TABLE public.journey_journeys ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:173; SHA256 daf25a3564156da2e11adc0d671ad2f7a3dc9ff824f529ef2b6f1dc46b0d3e6d

ALTER TABLE public.journey_sub_journeys ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:174; SHA256 598dff2f0eee1065f3dd3a80b05cd17d4114a1f9439dc295384edf3121a603e0

ALTER TABLE public.journey_milestones ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:175; SHA256 78aa0a037306a8809d07f1324e1958dd7c08275a53555e4b1a4d452cb3e4363e

ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:176; SHA256 9982f749a2118691006e462e3fdcb73829cd46aed5250aab9d9bd5bf684d25b1


-- 10. CREATE STANDARD TENANT ISOLATION RLS POLICIES
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'party_parties' 
    AND policyname = 'tenant_isolation_parties'
  ) THEN
    CREATE POLICY tenant_isolation_parties ON public.party_parties
      FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:190; SHA256 b125ba31bc322fc40db3adedfe6915dfdafedcd685a68d72d56f3ed2884a796a


DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'party_identifiers' 
    AND policyname = 'tenant_isolation_party_identifiers'
  ) THEN
    CREATE POLICY tenant_isolation_party_identifiers ON public.party_identifiers
      FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:203; SHA256 aa6de1eb1a045a515c3795b10a77ca3c521a27a705d2987d7463cd95b85c684b


DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'party_relationships' 
    AND policyname = 'tenant_isolation_party_relationships'
  ) THEN
    CREATE POLICY tenant_isolation_party_relationships ON public.party_relationships
      FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:216; SHA256 50b742d16fba232019b04a41d1f588a0e40eeb0c4cefbd76d9b76a5d2c84ebad


DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'party_roles' 
    AND policyname = 'tenant_isolation_party_roles'
  ) THEN
    CREATE POLICY tenant_isolation_party_roles ON public.party_roles
      FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:229; SHA256 85d9823a7df32c2929f7974ed1a22262c9f9f792cf704178dcf34762d40d753e


DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'journey_journeys' 
    AND policyname = 'tenant_isolation_journeys'
  ) THEN
    CREATE POLICY tenant_isolation_journeys ON public.journey_journeys
      FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:242; SHA256 7822e96bc49fc26022609e490201e893c34d653693e5591b0fb96f9f8d7aa340


DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'journey_sub_journeys' 
    AND policyname = 'tenant_isolation_sub_journeys'
  ) THEN
    CREATE POLICY tenant_isolation_sub_journeys ON public.journey_sub_journeys
      FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:255; SHA256 59115c1328e333e85de86f1550edac81f686a41806d8494321221a1f972496c2


DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'journey_milestones' 
    AND policyname = 'tenant_isolation_milestones'
  ) THEN
    CREATE POLICY tenant_isolation_milestones ON public.journey_milestones
      FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- SOURCE supabase/migrations/20260806000000_blueprint_core_schema.sql:268; SHA256 2aa67007d9e283d082369aca4f380b41119bdeb2c82a266418460396d3cafe4b


DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'timeline_events' 
    AND policyname = 'tenant_isolation_timeline'
  ) THEN
    CREATE POLICY tenant_isolation_timeline ON public.timeline_events
      FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:1; SHA256 9ce19b0c26e90560eec4034d2345156e19f369960d21fd8c6b90fe0efabb17ae
-- =============================================================================
-- Migration: 20260808000012_create_rule_engine_tables.sql
-- Phase D3: Governed Business Rule Engine (Platform-Level)
-- Constitution: Law 3 (Platform Host), Law 4 (Additive Only), Law 5 (Events)
--
-- Governance Hierarchy (MUST be respected — D3 CANNOT override above layers):
--   Human Governance (ARB approval)
--     → Frozen Safety Policy (Constitution)
--       → Clinical Safety Engine (CDS/CPOE — Phase C)
--         → Platform Rule Engine (D3)  ← this layer
--           → Business Workflow
--
-- Rule Lifecycle (immutable versioning):
--   DRAFT → REVIEW → APPROVED → ACTIVE → SUSPENDED → RETIRED
--   - ACTIVE rules are immutable: create new version instead of UPDATE
--   - ABSOLUTE severity requires approved_by + approved_at (ARB approval)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. ENUMs
-- ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE platform_rule_status AS ENUM (
    'DRAFT',
    'REVIEW',
    'APPROVED',
    'ACTIVE',
    'SUSPENDED',
    'RETIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:31; SHA256 e5652a1ddc2c45cd9c44c88a2ada7c260d1dad214bc7351dc71f132832b0a737


DO $$ BEGIN
  CREATE TYPE platform_rule_severity AS ENUM (
    'LOW',
    'MODERATE',
    'HIGH',
    'ABSOLUTE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:40; SHA256 13e1f4bb91d0b358f958aa68d304bc9d1fd0d38d023d473e2cd6184b06f389a1


DO $$ BEGIN
  CREATE TYPE platform_rule_action_type AS ENUM (
    'NOTIFY',
    'WARN',
    'ESCALATE',
    'EXECUTE_WORKFLOW',
    'BLOCK'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:50; SHA256 536c46844cf13560f87056346f27e30f94b2b5b39a4cf6aca1de8412d9ee9b10


DO $$ BEGIN
  CREATE TYPE platform_rule_domain AS ENUM (
    'spa.booking',
    'spa.commission',
    'spa.notification',
    'finance.commission',
    'finance.payment',
    'hr.payroll',
    'notification.routing',
    'crm.sla',
    'bella_auto.sales',
    'babycare.booking',
    'platform.system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:66; SHA256 b5d3817a5d209d61a903d4a02061014acb63281dd14b3baf4e866c4456d3ce1c


DO $$ BEGIN
  CREATE TYPE platform_rule_eval_outcome AS ENUM (
    'TRIGGERED',
    'NOT_TRIGGERED',
    'SKIPPED_SUSPENDED',
    'SKIPPED_EXPIRED',
    'ERROR'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:76; SHA256 b9c3ebbfadd7e4ed2309206ff748975acd3c40c38cb2fc07651a0f3c680b8599


-- ─────────────────────────────────────────────────────────────────
-- 2. platform_business_rules — versioned, immutable once ACTIVE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_business_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identity
  rule_key        TEXT NOT NULL,       -- stable identifier across versions, e.g. 'VIP_UPGRADE_BOOKING'
  version         TEXT NOT NULL,       -- semver: '1.0.0', '1.1.0'
  domain          platform_rule_domain NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,

  -- Lifecycle
  status          platform_rule_status NOT NULL DEFAULT 'DRAFT',
  severity        platform_rule_severity NOT NULL DEFAULT 'LOW',

  -- Conditions (JSON DSL)
  conditions      JSONB NOT NULL,      -- { operator: 'AND'|'OR', rules: [{field, op, value}] }

  -- Action
  action_type     platform_rule_action_type NOT NULL DEFAULT 'NOTIFY',
  action_params   JSONB NOT NULL DEFAULT '{}',  -- { message, workflowId, escalation_target, etc. }

  -- Governance
  -- ABSOLUTE severity rules: approved_by + approved_at are REQUIRED (enforced by check constraint)
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  effective_from  DATE,
  effective_to    DATE,               -- NULL = indefinite

  -- Audit
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Temporal linkage (D2): each status transition captures a snapshot
  metadata        JSONB NOT NULL DEFAULT '{}',

  -- Version uniqueness: one (tenant, rule_key, version) per system
  CONSTRAINT uq_rule_version UNIQUE (tenant_id, rule_key, version),

  -- Governance: ABSOLUTE severity requires ARB approval proof
  CONSTRAINT chk_absolute_requires_approval CHECK (
    severity <> 'ABSOLUTE' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:125; SHA256 f5aa7bd6c2bf003eb87e66d5b54abfafcb6b98aa548f88052c3d5efb5fff1266


CREATE INDEX IF NOT EXISTS idx_pbr_tenant_domain  ON platform_business_rules(tenant_id, domain);

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:127; SHA256 390690a910aa9003764847dcd0d26fc5fb28eaf34cac9e8f832c0626fa557b98

CREATE INDEX IF NOT EXISTS idx_pbr_status         ON platform_business_rules(status);

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:128; SHA256 b44d457a9120593db8245f75e3886ba756d3385ac529e97e48286b7f59e7c6d6

CREATE INDEX IF NOT EXISTS idx_pbr_rule_key       ON platform_business_rules(tenant_id, rule_key, version);

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:129; SHA256 b8a66c0fdb56ff43e530e3f9fa237c3b948912cb3f9fba3138350cae2ceb4f75

CREATE INDEX IF NOT EXISTS idx_pbr_active         ON platform_business_rules(tenant_id, domain, status)
  WHERE status = 'ACTIVE';

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:131; SHA256 fcd3d8be4a98e7a40c4836eed557fad13525f261607f981ce17c4c21b9472443

CREATE INDEX IF NOT EXISTS idx_pbr_conditions_gin ON platform_business_rules USING GIN (conditions);

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:132; SHA256 d4a02394f20b9e260b4451e0656069a38f1f192d3769d9f8e4ed2561434f7043


ALTER TABLE platform_business_rules ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:134; SHA256 fb5e79781013f6a2aaef70bbede447be905774bd1cf68baa7e870d0246ff3736

DROP POLICY IF EXISTS pbr_tenant_isolation ON platform_business_rules;

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:135; SHA256 63bbf42eeb5c57cbee3847d7c2a33322900357da79c2e055d73d9ca8315ce270

CREATE POLICY pbr_tenant_isolation ON platform_business_rules
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:137; SHA256 ab9d33455768331c783f435ee61c12e46fa7409a34ab72ca577fd0741ba8fc42


-- updated_at trigger
CREATE OR REPLACE FUNCTION platform_rules_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:142; SHA256 08dd1ff65b60dbfc9dc49c2c8be4a3d9075c0229732020cf39ddaf065c11f230


DROP TRIGGER IF EXISTS trg_pbr_updated_at ON platform_business_rules;

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:144; SHA256 f7bdf295076809976b2f5f5dd77624f3654a21d8a7d63deb160fe80ff7ad5de6

CREATE TRIGGER trg_pbr_updated_at
  BEFORE UPDATE ON platform_business_rules
  FOR EACH ROW EXECUTE FUNCTION platform_rules_set_updated_at();

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:147; SHA256 2ea5f987771813eb52f402d61f3e8845059283ed1d207b0da485c915647c7096


-- ⚠️ IMMUTABILITY: ACTIVE rules cannot be modified — must create new version
CREATE OR REPLACE FUNCTION platform_rules_active_immutability_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Allow status transitions (ACTIVE → SUSPENDED, ACTIVE → RETIRED)
  IF OLD.status = 'ACTIVE' AND
     (NEW.conditions IS DISTINCT FROM OLD.conditions OR
      NEW.action_type IS DISTINCT FROM OLD.action_type OR
      NEW.action_params IS DISTINCT FROM OLD.action_params OR
      NEW.severity IS DISTINCT FROM OLD.severity OR
      NEW.domain IS DISTINCT FROM OLD.domain OR
      NEW.name IS DISTINCT FROM OLD.name) THEN
    RAISE EXCEPTION
      'ACTIVE rule "%" (v%) cannot be modified. Create a new version instead. '
      'Governance Law: immutable rule versioning.',
      OLD.rule_key, OLD.version;
  END IF;
  RETURN NEW;
END; $$;

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:167; SHA256 edc39229b0bd8919778d9f8355e1b5accb1cf1ed414bffaa8d69859e9f927f6d


DROP TRIGGER IF EXISTS trg_pbr_active_immutability ON platform_business_rules;

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:169; SHA256 e64743c83aa2a112f61b45a31f45dc7559f541c2b4dd54698154d1d0b5336546

CREATE TRIGGER trg_pbr_active_immutability
  BEFORE UPDATE ON platform_business_rules
  FOR EACH ROW EXECUTE FUNCTION platform_rules_active_immutability_guard();

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:172; SHA256 23e34926f23cc078db8a1ae7cbc395be35b3eb78d2c661e3af5fa09c519ca779


-- ─────────────────────────────────────────────────────────────────
-- 3. platform_rule_evaluation_log — append-only evaluation audit
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_rule_evaluation_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id         UUID NOT NULL REFERENCES platform_business_rules(id),
  rule_key        TEXT NOT NULL,
  rule_version    TEXT NOT NULL,

  -- Input context
  context_type    TEXT NOT NULL,       -- e.g. 'spa_booking', 'customer_journey'
  context_id      UUID,
  input_data      JSONB NOT NULL DEFAULT '{}',

  -- Result
  outcome         platform_rule_eval_outcome NOT NULL,
  conditions_met  BOOLEAN NOT NULL DEFAULT FALSE,
  action_taken    TEXT,
  action_result   JSONB,
  error_message   TEXT,

  -- Provenance
  evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evaluated_by    UUID,               -- system actor or user
  correlation_id  UUID,
  metadata        JSONB NOT NULL DEFAULT '{}'
);

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:201; SHA256 d9e957f7c4e9e9c4a20c9142f6bb76e6fe072c58994cdbf143dc736887f65aff


CREATE INDEX IF NOT EXISTS idx_prel_tenant_id ON platform_rule_evaluation_log(tenant_id);

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:203; SHA256 eeb1796f3dc24dd060d83ca5a70a340e060e4bde17e38aa6dd723577b27b85cd

CREATE INDEX IF NOT EXISTS idx_prel_rule_id   ON platform_rule_evaluation_log(rule_id);

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:204; SHA256 ed0966540b7a62bbe99a1dad1c822eb728d7fb59997e6e254e72f4ca7d4da67d

CREATE INDEX IF NOT EXISTS idx_prel_context   ON platform_rule_evaluation_log(context_type, context_id);

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:205; SHA256 3623809165676e802268f9c1f85a1297379d373721fa76e539b627d22eed76a7

CREATE INDEX IF NOT EXISTS idx_prel_eval_at   ON platform_rule_evaluation_log(evaluated_at DESC);

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:206; SHA256 be3fa3a10a5eb360512d91044aa2cfafb565a078da4dbeefe79da57beebddb09


ALTER TABLE platform_rule_evaluation_log ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:208; SHA256 4931cc8165276224bd2ae4ba39bbde3f6e2a204ffa6885d3b205220b8aaffa7f

DROP POLICY IF EXISTS prel_tenant_isolation ON platform_rule_evaluation_log;

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:209; SHA256 d5f145654f0ddfbb646739fb08007e34434a62c487726783a9e91156d1a24938

CREATE POLICY prel_tenant_isolation ON platform_rule_evaluation_log
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:211; SHA256 1a150c8be9ebe3edbaa7a01f1a3af0f7bb103a4116b50673419512dfe2a5c182


-- IMMUTABILITY: evaluation log is append-only
CREATE OR REPLACE FUNCTION platform_eval_log_immutability_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'platform_rule_evaluation_log is append-only: % is forbidden', TG_OP;
  RETURN NULL;
END; $$;

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:219; SHA256 219ec00f6614441065a466fb476939c5181fd2bdc4069dedeae6d85a85a62f55


DROP TRIGGER IF EXISTS trg_prel_immutability ON platform_rule_evaluation_log;

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:221; SHA256 8b45d2bd4402571dd83914079b16bb5db78aa4bd2dd1ccb5ce33b726984bb1db

CREATE TRIGGER trg_prel_immutability
  BEFORE UPDATE OR DELETE ON platform_rule_evaluation_log
  FOR EACH ROW EXECUTE FUNCTION platform_eval_log_immutability_guard();

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:237; SHA256 88ed629eed261c820688d299af8633d52893f572604cd55bc5107b8ba86d20fa


-- ─────────────────────────────────────────────────────────────────
-- 5. Comments
-- ─────────────────────────────────────────────────────────────────
COMMENT ON TABLE platform_business_rules IS
  'D3 Rule Engine: Immutable versioned business rules. '
  'Governance hierarchy: D3 CANNOT override Clinical Safety Engine (Phase C) or Safety Policy. '
  'ACTIVE rules are immutable — create new version for changes. '
  'ABSOLUTE severity requires ARB approval (approved_by + approved_at NOT NULL).';

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:246; SHA256 c35a4fe9f03b4ee570d28348f16d09081b7a1bb6bc4246c4cd0027c49e292b4f


COMMENT ON TABLE platform_rule_evaluation_log IS
  'D3 Rule Engine: Append-only evaluation audit. Records every rule evaluation with input context and outcome.';

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:249; SHA256 cfadf263639534f19a530779a8412474d43f15381b3aa6f71006e46b95312437


COMMENT ON COLUMN platform_business_rules.rule_key IS
  'Stable business identifier across versions (e.g. VIP_UPGRADE_BOOKING). Used to find active version.';

-- SOURCE supabase/migrations/20260808000012_create_rule_engine_tables.sql:252; SHA256 8f2cd50ba0b1c0fec4d67685ed3b444fb6026446ab70469c0027c8256a618502


COMMENT ON COLUMN platform_business_rules.conditions IS
  'JSON DSL: { "operator": "AND"|"OR", "rules": [{"field": "string", "op": "EQ"|"GT"|"LT"|"IN", "value": any}] }';

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:1; SHA256 d8465b6d39ed782d23f42d9f0ad9f53e8050a914a4ae00189678d17bcaae7543
-- ============================================================================
-- Person Platform Capability - Database Migration
-- ============================================================================
-- Migration: 20260810000001_create_persons_table
-- Description: Create persons table for Platform identity primitive
-- 
-- Constitution Compliance:
-- - Law 4: Additive only (no ALTER TABLE DROP, no breaking constraints)
-- - Law 11: No `any` types (strict typing via JSONB schemas)
--
-- Architecture:
-- Person = identity primitive (Platform Host)
-- Patient/Student/Customer reference Person (vertical roles)
-- ============================================================================

-- Create persons table
CREATE TABLE IF NOT EXISTS public.persons (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant isolation
  tenant_id UUID NOT NULL,
  
  -- Core identity fields
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other', 'prefer-not-to-say')),
  nationality TEXT, -- ISO 3166-1 alpha-2 country code
  
  -- Identifiers (JSONB array)
  identifiers JSONB DEFAULT '[]'::JSONB,
  
  -- Contacts (JSONB array)
  contacts JSONB DEFAULT '[]'::JSONB,
  
  -- Addresses (JSONB array)
  addresses JSONB DEFAULT '[]'::JSONB,
  
  -- Optional fields
  photo_url TEXT,
  preferred_language TEXT DEFAULT 'vi', -- ISO 639-1 code
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deceased', 'merged')),
  
  -- Metadata (tenant-specific extensions)
  metadata JSONB,
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  
  -- Constraints
  CONSTRAINT persons_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT persons_date_of_birth_check CHECK (date_of_birth <= CURRENT_DATE)
);

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:60; SHA256 26e403df00cae342cb1b555065acc6064cb83a7f4c8c42d82ea95a80dd07ab8e


-- ============================================================================
-- Indexes
-- ============================================================================

-- Tenant isolation index (most queries filter by tenant)
CREATE INDEX idx_persons_tenant_id ON public.persons(tenant_id);

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:67; SHA256 faab4f68ffc94137ac55b09b8c221471039f82ac181742a2136e1428844bc7e8


-- Name search indexes
CREATE INDEX idx_persons_first_name ON public.persons(first_name);

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:70; SHA256 7b1f85c5e2cbf8f41a66a97aee50c707141c53d834dd606bac2521e5a9e7567c

CREATE INDEX idx_persons_last_name ON public.persons(last_name);

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:71; SHA256 0761b4161d1957d65330ff91118d3a0a0a52f908ed1592eddab194ced623dbf8

CREATE INDEX idx_persons_full_name ON public.persons(first_name, last_name);

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:72; SHA256 8c6aba2a08b748478fbb141e21a9e70764b9866173c034f72751337344463a0a


-- Date of birth index (for age-based queries)
CREATE INDEX idx_persons_date_of_birth ON public.persons(date_of_birth);

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:75; SHA256 ee5267d8dfce56b7f8cfac323605ff2b8e0753f40cc645c31e16d802f0756b4a


-- Status index (filter active/inactive persons)
CREATE INDEX idx_persons_status ON public.persons(status);

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:78; SHA256 bd32f10e480fd370ea867c403e8a91930df28d22889261cd8b39fe5504a49776


-- JSONB GIN indexes for array searches
CREATE INDEX idx_persons_identifiers ON public.persons USING GIN (identifiers);

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:81; SHA256 065bc24ad8e81822ffe5282a95306ec34ff4f54fa04690e7c98c34bff12b418c

CREATE INDEX idx_persons_contacts ON public.persons USING GIN (contacts);

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:82; SHA256 21b76fcb501fafb94bc91598030dbbaae3d2ca3fc493643dc62350934e5fb90e

CREATE INDEX idx_persons_addresses ON public.persons USING GIN (addresses);

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:83; SHA256 4e79b92e07802426e4aef7384be10bb98852faeae38ca344fec1b100810cbbc2


-- Composite index for common queries
CREATE INDEX idx_persons_tenant_status ON public.persons(tenant_id, status);

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:86; SHA256 624194ecdd2bbe5bcedec939f7a4af8675c086aaa1ffb09fc6143806979421ec


-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:93; SHA256 1c725ee0c52b36a802e73c388f7799b92d81786129ea728d9162314336566c6d


-- Policy: Users can only access persons in their tenant
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'persons' 
    AND policyname = 'persons_tenant_isolation'
  ) THEN
    CREATE POLICY persons_tenant_isolation ON public.persons
      FOR ALL
      USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);
  END IF;
END $$;

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:108; SHA256 c5af2d1237d2d8c16b2e56b33b128a8b9c7579e60b3a85b86837b0e5dde1ce96


-- Policy: Service role can access all persons (for migrations, admin operations)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'persons' 
    AND policyname = 'persons_service_role'
  ) THEN
    CREATE POLICY persons_service_role ON public.persons
      FOR ALL
      TO service_role
      USING (true);
  END IF;
END $$;

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:124; SHA256 f4236291109343971e99a5b63dd9d425a1bff7e64d7ee5d24796dbc5cf00fd5e


-- ============================================================================
-- Triggers
-- ============================================================================

-- Trigger: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_persons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:137; SHA256 2bcd48522c534093f7aba67ad75f70342b971d1cb0b14d82b756139bdcaa8019


CREATE TRIGGER trigger_persons_updated_at
  BEFORE UPDATE ON public.persons
  FOR EACH ROW
  EXECUTE FUNCTION update_persons_updated_at();

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:142; SHA256 fab18586c8bc38ca99f29924e57b747881cd45a24ce63bb496b9d14d0c3c6785


-- ============================================================================
-- Comments (Documentation)
-- ============================================================================

COMMENT ON TABLE public.persons IS 'Platform identity primitive - represents "who someone is" independent of roles';

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:148; SHA256 c572d335e835b5e9de1f1b7180fce4805bd2fc912df1e95afd0c609c625b9e95

COMMENT ON COLUMN public.persons.id IS 'Unique person identifier (UUID)';

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:149; SHA256 cd795da8cb603e2690f54c9ce654cf96365092c14da0831e2ec83677411c45c2

COMMENT ON COLUMN public.persons.tenant_id IS 'Tenant this person belongs to';

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:150; SHA256 59ba5849a4ef5aeaf2959f165182fd9f85905eaa182e53dafc2bcb98753ce15d

COMMENT ON COLUMN public.persons.first_name IS 'Legal first name';

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:151; SHA256 62dce5c112ca14f4abd0d845adf505b9dc4ef28e7798a17da2bcc965192e0ba4

COMMENT ON COLUMN public.persons.last_name IS 'Legal last name';

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:152; SHA256 b5481a548c3439f59940e3ee234c0e646690f5c18dc1bf58f115489059ec9a12

COMMENT ON COLUMN public.persons.middle_name IS 'Middle name (optional)';

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:153; SHA256 acdad2d874504cb9bcd0c1fc9dfa9f24b5dd8428cb7a8c8c599e25d8985d42ed

COMMENT ON COLUMN public.persons.date_of_birth IS 'Date of birth (ISO 8601 date)';

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:154; SHA256 7288dbfb3134d57dcbe8d197be1df9ce147c97a351eb31eb86a5b667f7ee8463

COMMENT ON COLUMN public.persons.gender IS 'Gender (male, female, other, prefer-not-to-say)';

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:155; SHA256 a37afab66e7708aa269541b269d800205586a631aae70f1de30d8993ba6959a7

COMMENT ON COLUMN public.persons.nationality IS 'Nationality (ISO 3166-1 alpha-2 country code)';

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:156; SHA256 58e347f101fc250c0b671fdaf60a52373e2eaeaea9c4dadeac51013c8842c7fb

COMMENT ON COLUMN public.persons.identifiers IS 'Government/institutional identifiers (JSONB array)';

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:157; SHA256 87198b33931f4847a067139b692ccf36380067aa11dc17fbba0d7a6bac04d022

COMMENT ON COLUMN public.persons.contacts IS 'Contact information (JSONB array: phone, email, mobile)';

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:158; SHA256 19084f54e9845c4e5e51ec28220a5fddca29be76bdf281678eb14e517918081d

COMMENT ON COLUMN public.persons.addresses IS 'Physical addresses (JSONB array)';

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:159; SHA256 86696f9f13208a0cfaa2339f91ff097f6e06f7d910fffdb158434c13fc6d47ea

COMMENT ON COLUMN public.persons.photo_url IS 'Profile photo URL';

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:160; SHA256 4ec36f6c15c160be48369062468136d0615429b079cb2f746401190127a2fbd4

COMMENT ON COLUMN public.persons.preferred_language IS 'Preferred language (ISO 639-1 code)';

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:161; SHA256 1009d1f6c3cb20a593dd780fc96c7281c06d696e3194d346df5cace8ec28c650

COMMENT ON COLUMN public.persons.status IS 'Record status (active, inactive, deceased, merged)';

-- SOURCE supabase/migrations/20260810000001_create_persons_table.sql:162; SHA256 e726f5e5a5d228851ae1405afe2134a87fcf9b4b762ab78ac61462efdbeb73d0

COMMENT ON COLUMN public.persons.metadata IS 'Tenant-specific extension fields (JSONB)';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:18; SHA256 7b95ca3969afb7c285606c6ec73e81fde79a955007b0537ea1ccbe25aa1e5234


-- Create students table
CREATE TABLE IF NOT EXISTS public.students (
  -- Primary key
  student_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant isolation
  tenant_id UUID NOT NULL,
  
  -- Person reference (aggregate root for identity)
  person_id UUID NOT NULL,
  
  -- Student-specific fields
  student_code TEXT NOT NULL,
  academic_status TEXT NOT NULL CHECK (
    academic_status IN ('enrolled', 'on_leave', 'graduated', 'dropped_out', 'expelled')
  ),
  enrollment_type TEXT NOT NULL CHECK (
    enrollment_type IN ('full_time', 'part_time', 'online', 'hybrid')
  ),
  program_id TEXT NOT NULL,
  
  -- Academic dates
  enrollment_date DATE NOT NULL,
  expected_graduation_date DATE,
  actual_graduation_date DATE,
  
  -- Academic info
  current_level TEXT,
  gpa NUMERIC(3,2) CHECK (gpa >= 0 AND gpa <= 4.0),
  total_credits INTEGER CHECK (total_credits >= 0),
  
  -- Emergency contact (student-specific)
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  
  -- Metadata (extensions)
  metadata JSONB,
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  
  -- Constraints
  CONSTRAINT students_tenant_fk FOREIGN KEY (tenant_id) 
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT students_person_fk FOREIGN KEY (person_id) 
    REFERENCES public.persons(id) ON DELETE CASCADE,
  CONSTRAINT students_student_code_unique UNIQUE (tenant_id, student_code),
  CONSTRAINT students_enrollment_date_check CHECK (enrollment_date <= CURRENT_DATE),
  CONSTRAINT students_graduation_dates_check CHECK (
    expected_graduation_date IS NULL OR 
    expected_graduation_date > enrollment_date
  ),
  CONSTRAINT students_actual_graduation_check CHECK (
    actual_graduation_date IS NULL OR 
    actual_graduation_date >= enrollment_date
  )
);

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:80; SHA256 253d23caa57f4ebd3328259d7770e2e7acc2407e96d5b19000f18c119c2a86d3


-- ============================================================================
-- Indexes
-- ============================================================================

-- Tenant isolation index
CREATE INDEX IF NOT EXISTS idx_students_tenant_id ON public.students(tenant_id);

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:87; SHA256 f4ba89dce7a34adfd3049e27e1e8e3801bf370b5c1fab7416fd5eb816a4186db


-- Person reference index (JOIN queries)
CREATE INDEX IF NOT EXISTS idx_students_person_id ON public.students(person_id);

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:90; SHA256 12db85cdc79311a350cb93fc80e132f25f327c554ab1ddc33c365fb64ab16e54


-- Student code index (unique identifier lookup)
CREATE INDEX IF NOT EXISTS idx_students_student_code ON public.students(student_code);

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:93; SHA256 f1020b1d7d030351b5d1b654760d9de209205535aeb30e8be0720bf16de55eb0


-- Academic status index (filter active students)
CREATE INDEX IF NOT EXISTS idx_students_academic_status ON public.students(academic_status);

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:96; SHA256 92165783cdc664b914c88737e03e909851512e13b854c6c3e01f7ee34862a542


-- Program index (students per program)
CREATE INDEX IF NOT EXISTS idx_students_program_id ON public.students(program_id);

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:99; SHA256 ab2fe0043f0fb27de82a1a643576b76d65d0b5bd5faf666e379755c497c4647d


-- Enrollment date index (cohort queries)
CREATE INDEX IF NOT EXISTS idx_students_enrollment_date ON public.students(enrollment_date);

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:102; SHA256 c10b665329e0fe02527070db741a60a301aeb5ba5cabb258a03fa605abb22b43


-- JSONB GIN index for metadata searches
CREATE INDEX IF NOT EXISTS idx_students_metadata ON public.students USING GIN (metadata);

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:105; SHA256 8ad37b5291c0e5a76f66492afa22fa1ee783ed2141653c3dd032c5a1268659a8


-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_students_tenant_status ON public.students(tenant_id, academic_status);

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:108; SHA256 2d76917c0d643fd8de2bfe62758ce87aaac149b662cd0fc45846bf4b9e2df953

CREATE INDEX IF NOT EXISTS idx_students_tenant_program ON public.students(tenant_id, program_id);

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:109; SHA256 215e8296bbdb125357a50adb52f446916a727eaa7b94ec1543f7c7e5ab0299f3


-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:116; SHA256 1214842510f20d60e40cf4f9dc73b8cbe33ea31b3685be1dade76ebcb59ddfcb


-- Policy: Users can only access students in their tenant
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'students' 
    AND policyname = 'students_tenant_isolation'
  ) THEN
    CREATE POLICY students_tenant_isolation ON public.students
      FOR ALL
      USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);
  END IF;
END $$;

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:131; SHA256 0849f81606c4db5c276aa1021973391ca1beb69f777bdd3b3ffba4bb220b60d3


-- Policy: Service role can access all students
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'students' 
    AND policyname = 'students_service_role'
  ) THEN
    CREATE POLICY students_service_role ON public.students
      FOR ALL
      TO service_role
      USING (true);
  END IF;
END $$;

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:147; SHA256 d6911500c91d6b5a8d1a95937426188266635bf4a41023bcd309389a5d896f57


-- ============================================================================
-- Triggers
-- ============================================================================

-- Trigger: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_students_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:160; SHA256 b49143d234fd6f1086c46f7276eb0d1946b02775d8d2c8f8a18c22f74675d51b


DROP TRIGGER IF EXISTS trigger_students_updated_at ON public.students;

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:162; SHA256 cf661eee15c4ef95d9803022e1e32413d86fd2112b6eeec38275e6b912c7fb06


CREATE TRIGGER trigger_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION update_students_updated_at();

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:167; SHA256 b229f0fe343a1510c611691bdb70dae65c4fd81ef8c6a79b6b746255cdfec181


-- ============================================================================
-- Comments (Documentation)
-- ============================================================================

COMMENT ON TABLE public.students IS 'Students - academic role referencing Person for identity';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:173; SHA256 3b7dff75ed11c46efa774cab83168c5fdd144293670bbd75e3a9399f775ace7f

COMMENT ON COLUMN public.students.student_id IS 'Unique student identifier (UUID)';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:174; SHA256 c3d5cd01251df5204281b91210fff44b700d752b2ea362ace1b96efc32b0e055

COMMENT ON COLUMN public.students.tenant_id IS 'Tenant this student belongs to';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:175; SHA256 efa73695ab65a1154afbf4b8ba06d07803e4a11138aba03ecaa99d3bb0afe8ee

COMMENT ON COLUMN public.students.person_id IS 'Reference to Person identity aggregate (foreign key)';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:176; SHA256 c2c899c9cfd51d1b9dbe483108e8fbf59fa11617268fdf0d777d72ca0d285e57

COMMENT ON COLUMN public.students.student_code IS 'Unique student identifier (e.g., EDU-2024-001)';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:177; SHA256 269db2251b28a8ef8a5fe0d8536610e540a613bca795e1fd9d5c354a616c1126

COMMENT ON COLUMN public.students.academic_status IS 'Current academic status (enrolled, on_leave, graduated, dropped_out, expelled)';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:178; SHA256 479ecdf753f651ae4f3c0736e1098bc957a9c64f33054ef90a5663d89dcc0d3e

COMMENT ON COLUMN public.students.enrollment_type IS 'Type of enrollment (full_time, part_time, online, hybrid)';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:179; SHA256 b41003e705d82b2931eea25c22c5d5b0ae7668340994ebfd02354fc6adf08857

COMMENT ON COLUMN public.students.program_id IS 'Program the student is enrolled in';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:180; SHA256 f7b9039c218d353791242d18a02f9900e12139bde5e3a5eef6a2bf30b5c71155

COMMENT ON COLUMN public.students.enrollment_date IS 'Date student enrolled';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:181; SHA256 4ac12105cf5b16d09de96b4d0cad3a6eef82a771daa9da787c4fe29824fa7b9f

COMMENT ON COLUMN public.students.expected_graduation_date IS 'Expected graduation date';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:182; SHA256 f23016a7493cd8295b9bbe47b0b454f8c5770c677d545e1d65b9b9c4cc77476a

COMMENT ON COLUMN public.students.actual_graduation_date IS 'Actual graduation date (when graduated)';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:183; SHA256 51112276f62dc57e88c337df405163f8a32787afb8782967fa771207790631c9

COMMENT ON COLUMN public.students.current_level IS 'Current academic level (Year 1, Semester 2, etc.)';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:184; SHA256 a832158af979ca0e3509061fd906216ceb8cf7fccd3cab10bf9acfcd48776811

COMMENT ON COLUMN public.students.gpa IS 'Grade Point Average (0.0 - 4.0)';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:185; SHA256 5da1729c18abc30a9b05691e67d591fb19cb439cd881ad31bff20e071348bc4f

COMMENT ON COLUMN public.students.total_credits IS 'Total credits earned';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:186; SHA256 98d98a06547af054561d22a919c6e24b2cf67ba988a21fb478341ba689788aac

COMMENT ON COLUMN public.students.emergency_contact_name IS 'Emergency contact name (student-specific)';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:187; SHA256 0b75b07c35e12aaf731d663575aeff8af7762a9dc6697930c5de5f5ebb461ea3

COMMENT ON COLUMN public.students.emergency_contact_phone IS 'Emergency contact phone';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:188; SHA256 315505de7c342830ad2689e6a49931630587869fb94adde7148958ded13161d0

COMMENT ON COLUMN public.students.emergency_contact_relationship IS 'Relationship to student';

-- SOURCE supabase/migrations/20260810224417_create_students_table.sql:189; SHA256 e0708d3c5190e1c57f78f1c2f5ab326c6aa97711e30ebe79dcbfb7c98dca4f4f

COMMENT ON COLUMN public.students.metadata IS 'Tenant-specific extension fields (JSONB)';

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:15; SHA256 58fd567116f42e13195f9911bbb005b6973869a6ef0a657c1a40491275c0a936


-- ============================================================================
-- 1. COURSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.courses (
  course_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  description TEXT,
  credits INTEGER NOT NULL CHECK (credits > 0),
  duration_weeks INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  
  CONSTRAINT courses_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT courses_course_code_unique UNIQUE (tenant_id, course_code)
);

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:38; SHA256 f55722463cd21c998d48984fa675b5817e93b5c3a24f4c5c4811234f9fda6eb2


-- Indexes
CREATE INDEX IF NOT EXISTS idx_courses_tenant_id ON public.courses(tenant_id);

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:41; SHA256 de085d988acb0e8dec06c6fc9aaab50fc610fdd165eda7b2c3f0197a324858a0

CREATE INDEX IF NOT EXISTS idx_courses_course_code ON public.courses(course_code);

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:42; SHA256 b8945115a389048a0b04c944cb0764ced8f0ad1ad195ed4419d73df5782aee46

CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses(status);

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:43; SHA256 9bd8cc34d88d90de05c9a105a53865eea2385181739e83b1bf14ac13b33dc02b


-- RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:46; SHA256 77705beed1b07216e3e020055255ee51e43605adf888e88498b8e7feb4f2daf6


DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'courses' AND policyname = 'courses_tenant_isolation') THEN
    CREATE POLICY courses_tenant_isolation ON public.courses FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);
  END IF;
END $$;

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:53; SHA256 7c7a3b3a33d3a479da1ee41768524965b7ab98168279e91d358959e1324873fd


-- Trigger
CREATE OR REPLACE FUNCTION update_courses_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:61; SHA256 7980a21e8b611a30f5400c1e0128ced39a75ed444f5575aac7e3308ddc6d2407


DROP TRIGGER IF EXISTS trigger_courses_updated_at ON public.courses;

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:63; SHA256 17d43f5a07eab0f8088c63ded95b0158be23e98b9c7e639916827e733075c0a2

CREATE TRIGGER trigger_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION update_courses_updated_at();

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:64; SHA256 4368a6f5b4193737b9ecf5afd9d6e895a066f3ccd80250bf309295868390f4b1


-- ============================================================================
-- 2. ENROLLMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.enrollments (
  enrollment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL,
  course_id UUID NOT NULL,
  enrollment_date DATE NOT NULL,
  completion_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'withdrawn', 'failed', 'suspended')),
  grade TEXT,
  grade_points NUMERIC(5,2) CHECK (grade_points >= 0 AND grade_points <= 100),
  grade_status TEXT NOT NULL DEFAULT 'not_graded' CHECK (grade_status IN ('not_graded', 'in_progress', 'graded', 'pass', 'fail')),
  credits_earned INTEGER CHECK (credits_earned >= 0),
  attendance_percentage NUMERIC(5,2) CHECK (attendance_percentage >= 0 AND attendance_percentage <= 100),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  
  CONSTRAINT enrollments_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT enrollments_student_fk FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE,
  CONSTRAINT enrollments_course_fk FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE,
  CONSTRAINT enrollments_student_course_unique UNIQUE (tenant_id, student_id, course_id),
  CONSTRAINT enrollments_dates_check CHECK (completion_date IS NULL OR completion_date >= enrollment_date)
);

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:94; SHA256 adb9b3e43eda6384f894561bf975bd878a76e1ab6bf814a37e592c82c4134dc5


-- Indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_id ON public.enrollments(tenant_id);

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:97; SHA256 733d414c025c464340b0992c83ed23509514d5074f330137d691b067914f699f

CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON public.enrollments(student_id);

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:98; SHA256 f4800cd5c709f56c3295a30321313d573a3b665d17178179ea62b7a3b09231a5

CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON public.enrollments(course_id);

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:99; SHA256 dca81c7b53f97705df9db8989d7731f2db150efa3f1568ec0d179e31ddf397f7

CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments(status);

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:100; SHA256 a0f7bb52517bd3a89c47771572250aa117c12346138939a7cf8209204c48186f

CREATE INDEX IF NOT EXISTS idx_enrollments_enrollment_date ON public.enrollments(enrollment_date);

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:101; SHA256 1f5fc15f69d293f20917306a22bfc2a026ddd963622b69b6a6ea120a1448f602

CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_status ON public.enrollments(tenant_id, status);

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:102; SHA256 36576714fd50518a977697807e484f2b6a90eb0d58f264a1225fc50c837899b6


-- RLS
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:105; SHA256 fe598dc2503a77eaa28f8fdcea97216c34994d56d279fc98f7a079bf207034db


DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'enrollments' AND policyname = 'enrollments_tenant_isolation') THEN
    CREATE POLICY enrollments_tenant_isolation ON public.enrollments FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);
  END IF;
END $$;

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:112; SHA256 fab5255dfb302de156ff5cae93887d190bdc5bcf39161b5a8f1aa90c9f231997


-- Trigger
CREATE OR REPLACE FUNCTION update_enrollments_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:120; SHA256 460668ae4aceeb65f8d2a6572f3d430a860e99ba930304fdc54c28206130be8d


DROP TRIGGER IF EXISTS trigger_enrollments_updated_at ON public.enrollments;

-- SOURCE supabase/migrations/20260810231500_create_courses_and_enrollments.sql:122; SHA256 7fc2294d808f1a0c7bb433043449179e6ad7c6c68e815ab8018fd74325792f87

CREATE TRIGGER trigger_enrollments_updated_at BEFORE UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION update_enrollments_updated_at();

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:1; SHA256 8cf2001e84719e8f9340e9e2883cd42306fb5eaa7c48891327079d98ffeff5b5
-- ============================================================================
-- Attendance Table Migration
-- 
-- Pattern: Inherited from Student/Enrollment/Course migrations
-- Constitution Compliance: Law 4 (Additive migrations only)
-- ============================================================================

-- Create attendances table
CREATE TABLE IF NOT EXISTS public.attendances (
  -- Primary key
  attendance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant isolation
  tenant_id UUID NOT NULL,
  
  -- Foreign keys
  student_id UUID NOT NULL,
  course_id UUID NOT NULL,
  enrollment_id UUID,
  
  -- Session details
  session_date DATE NOT NULL,
  session_number INTEGER,
  session_type TEXT CHECK (session_type IN ('lecture', 'lab', 'tutorial', 'exam', 'workshop', 'seminar')),
  session_duration INTEGER, -- minutes
  
  -- Attendance tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('present', 'absent', 'late', 'excused', 'pending')),
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  minutes_late INTEGER CHECK (minutes_late >= 0),
  
  -- Notes and excuses
  notes TEXT,
  excuse_reason TEXT,
  excuse_document_url TEXT,
  
  -- Verification
  verified_by UUID, -- User UUID who verified
  verified_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB,
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  updated_by UUID,
  
  -- Constraints
  CONSTRAINT fk_attendances_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendances_student FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_attendances_course FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE,
  CONSTRAINT fk_attendances_enrollment FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(enrollment_id) ON DELETE SET NULL,
  CONSTRAINT check_out_after_check_in CHECK (check_out_time IS NULL OR check_in_time IS NULL OR check_out_time > check_in_time)
);

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:57; SHA256 3e17743ce3908dfbe4bb84d7fed7506aa9d4fb62515aa8db345bd9a60fd74f13


-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendances_tenant ON public.attendances(tenant_id);

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:60; SHA256 bed26bea8be8174b752dde227126198fb6830b2bedc9356d4cee8ac873a9c222

CREATE INDEX IF NOT EXISTS idx_attendances_student ON public.attendances(student_id);

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:61; SHA256 dd8e5e137218a5ca3c539aeecf1c9974fcffbe597ff7dc39ddc74d953b1e2f49

CREATE INDEX IF NOT EXISTS idx_attendances_course ON public.attendances(course_id);

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:62; SHA256 f74d84b451c6eed412f5bf9952a887306f4d412f1e5a1864be5a9b7fb6ebf6b5

CREATE INDEX IF NOT EXISTS idx_attendances_enrollment ON public.attendances(enrollment_id);

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:63; SHA256 4abf7b0dbb3ff5a030f026857b1fef43bae0668c4e56e4f99710466dd842a127

CREATE INDEX IF NOT EXISTS idx_attendances_session_date ON public.attendances(session_date);

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:64; SHA256 beef3385559e66cf965ebebe9a1b2d52208ff17f3b19958d600456b9994f9c9b

CREATE INDEX IF NOT EXISTS idx_attendances_status ON public.attendances(status);

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:65; SHA256 3d1f17e1fc309ff37209e118dace8d6473786f285333cdb81e36aaa6e0e7e184


-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_attendances_student_course ON public.attendances(student_id, course_id);

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:68; SHA256 1e347602eb7f6d649134bc1ab335451ca974639235d65358715e6fad98ae9d94

CREATE INDEX IF NOT EXISTS idx_attendances_course_date ON public.attendances(course_id, session_date);

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:69; SHA256 a8513b7aa42d3f1c02c7225e046fec7529fbfc54e981f9a222a67771b9d96a89


-- Unique constraint: one attendance record per student per course per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendances_unique_session 
  ON public.attendances(tenant_id, student_id, course_id, session_date, COALESCE(session_number, 0));

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:73; SHA256 96a8b361c3418aff89a15db37a806d9b5446c3966233aa575614e85f330fd791


-- Enable Row Level Security
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:76; SHA256 53fc38e56b5b0d6b01ff5e3d97d089d42aeb9d32eaf8e3828fc6cc6fcc39d23b


-- RLS Policy: Users can only access attendances from their tenant
CREATE POLICY tenant_isolation_policy ON public.attendances
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:81; SHA256 f2bf36a12ee55058112c1a32b147289f7c1252659365a8d70ce1ea32b22ec191


-- Updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.attendances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:87; SHA256 e16e9d16abd6d30566d52cb833fc49ae96d44afd7530fc993b6166f67c58730f


-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendances TO authenticated;

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:90; SHA256 935758ea3d0b7d6a523d9e886b42bbf7c9b2d6270cab17c90c58d33b8207997c

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendances TO service_role;

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:91; SHA256 88256060c3fd5fddb0d15f3f804b0d2cc65f8537dea033ea6da860466fd9c4b0


-- Comments
COMMENT ON TABLE public.attendances IS 'Student attendance records for course sessions';

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:94; SHA256 c6d28f80005549d5e7a2637ed2645abaf85d2bd225cce78278453103b047ec51

COMMENT ON COLUMN public.attendances.attendance_id IS 'Primary key';

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:95; SHA256 99ce59e98258170cf1de83fbff47fe68b39b394edd21aca848c25cde3808fac3

COMMENT ON COLUMN public.attendances.tenant_id IS 'Tenant isolation';

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:96; SHA256 0549a33c50acd20464f3d5b208ee9064dcf63e8803340a2b2f41f033639f8162

COMMENT ON COLUMN public.attendances.student_id IS 'Foreign key to students table';

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:97; SHA256 037f31721a302973c554bfe912162a6d303524b626f4e21adfb601084c2cde1b

COMMENT ON COLUMN public.attendances.course_id IS 'Foreign key to courses table';

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:98; SHA256 c5e105f9b89a80aa31c7d81a657e95e5ce5e17d4d0ec4bdfa2e3c50f3fedd89a

COMMENT ON COLUMN public.attendances.enrollment_id IS 'Optional foreign key to enrollments table';

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:99; SHA256 8764f09f4d7c70c0e596505466f2ede2a15686e5c9abcb3766c4d8d5ecb2106a

COMMENT ON COLUMN public.attendances.session_date IS 'Date of the course session';

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:100; SHA256 64e9d4dc27d8b01c275227f81882699241cc770a157a7b6bf8856174763392b9

COMMENT ON COLUMN public.attendances.status IS 'Attendance status: present, absent, late, excused, pending';

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:101; SHA256 dcacb5248787abd1b337754ddf0e52889539e1ba9b93a17230f06360b9d54ea5

COMMENT ON COLUMN public.attendances.minutes_late IS 'Minutes late for late arrivals';

-- SOURCE supabase/migrations/20260810235000_create_attendances.sql:102; SHA256 ec54623a1dad7bc2495ebfa12b3e19abbd613e4c4b2cbdd75ea92558815bbe98

COMMENT ON COLUMN public.attendances.verified_by IS 'User UUID who verified attendance';

-- SOURCE supabase/migrations/20260812060000_create_education_schema.sql:1; SHA256 ab81235e080eced41cde7a496f9c4bf124d20f46afa849af7db7ff323a1cce91
-- Migration: Create Education OS Reuse Proof Schema (CC-3.1)
-- Date: 2026-08-12
-- Target: edu_courses and edu_enrollments tables with ON DELETE RESTRICT conventions

-- 1. Courses Table
CREATE TABLE IF NOT EXISTS public.edu_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  course_code TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_edu_courses_code UNIQUE (tenant_id, course_code)
);

-- SOURCE supabase/migrations/20260812060000_create_education_schema.sql:15; SHA256 79b6e83ca7d831931cf2e712d7cbe34cbaf2523dfb91d89a43895479e7cb9409


-- 2. Enrollments Table
-- Business Assumption (CC-3 POC): UNIQUE (tenant_id, student_party_id, course_id) prevents simultaneous duplicate active enrollments per course per student.
CREATE TABLE IF NOT EXISTS public.edu_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE RESTRICT,
  course_id UUID NOT NULL REFERENCES public.edu_courses(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_edu_enrollments_student_course UNIQUE (tenant_id, student_party_id, course_id)
);

-- SOURCE supabase/migrations/20260812060000_create_education_schema.sql:29; SHA256 c5cbe2bdf2cafde48a3b3f335b636911bdae6d4c264336b6839623cf6f2abc1c


-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_edu_courses_tenant ON public.edu_courses(tenant_id);

-- SOURCE supabase/migrations/20260812060000_create_education_schema.sql:32; SHA256 73bed9fdeb14ca5e393fb057cece81980464595949a8f692d0b6a1c433ca3c02

CREATE INDEX IF NOT EXISTS idx_edu_enrollments_tenant ON public.edu_enrollments(tenant_id);

-- SOURCE supabase/migrations/20260812060000_create_education_schema.sql:33; SHA256 95f8b5339e95a54bfa47a36e68a0a9af2fd7b5e5384b39d30face4a0808fb058

CREATE INDEX IF NOT EXISTS idx_edu_enrollments_student ON public.edu_enrollments(student_party_id);

-- SOURCE supabase/migrations/20260812060000_create_education_schema.sql:34; SHA256 ecf84c7936a1206d8bdb48d2319377f9a457579e4910ad8d2511420847ff993c

CREATE INDEX IF NOT EXISTS idx_edu_enrollments_course ON public.edu_enrollments(course_id);

-- SOURCE supabase/migrations/20260812060000_create_education_schema.sql:35; SHA256 67b51a8dfdec96b6a56fce3fb87e5e08f733f04d628e1864088a74be72d04c80


-- Enable RLS
ALTER TABLE public.edu_courses ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260812060000_create_education_schema.sql:38; SHA256 fec0ad5bfb00c705d7f8c80cb08a318426d68bbe28547d096570395227c1f87a

ALTER TABLE public.edu_enrollments ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260812060000_create_education_schema.sql:39; SHA256 151cbcf4eec4699ee07dc2b5520e78f202cea5e975e86a8b1ed04e16975e8838


-- Tenant Isolation RLS Policies
DROP POLICY IF EXISTS edu_courses_tenant_isolation ON public.edu_courses;

-- SOURCE supabase/migrations/20260812060000_create_education_schema.sql:42; SHA256 4d429769b6de7ce3a0229bb8032d1656b0281ffb9d21894b76040454d02a1eda

CREATE POLICY edu_courses_tenant_isolation ON public.edu_courses
  FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- SOURCE supabase/migrations/20260812060000_create_education_schema.sql:44; SHA256 1822892e4a57cd7b36f13d2c4c3626f1bd06107e8b88f6d6baa0ee55fd26c214


DROP POLICY IF EXISTS edu_enrollments_tenant_isolation ON public.edu_enrollments;

-- SOURCE supabase/migrations/20260812060000_create_education_schema.sql:46; SHA256 6b06dceadf8958447e92220f1be6885698dc33175eb257aa1948c27339045342

CREATE POLICY edu_enrollments_tenant_isolation ON public.edu_enrollments
  FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- SOURCE supabase/migrations/20260813000020_create_edu_attendance_and_assessment.sql:1; SHA256 fd89862a6cf6d338a372b1f8924122efbf6c96a76f6dc0f6dab2a6eefd8336c7
-- Migration: Create edu_attendance and public.edu_assessments tables (CC-3.1)
-- Date: 2026-08-13

-- 1. Attendance Table
CREATE TABLE public.edu_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES public.edu_enrollments(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'excused')),
  roll_call_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SOURCE supabase/migrations/20260813000020_create_edu_attendance_and_assessment.sql:13; SHA256 9c98a76ade46036702965303327b1c6c69347cca3f1f702fb249c3576197df28


-- 2. Assessments Table
CREATE TABLE public.edu_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES public.edu_enrollments(id) ON DELETE RESTRICT,
  score_type TEXT NOT NULL CHECK (score_type IN ('quiz', 'midterm', 'final', 'homework')),
  grade NUMERIC(5, 2) NOT NULL,
  weight NUMERIC(3, 2) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SOURCE supabase/migrations/20260813000020_create_edu_attendance_and_assessment.sql:26; SHA256 9afab484ec8c2646a204bec2d41e90f3fa2e99bb97bf08f64578c5a4f9d262f2


-- Indexes
CREATE INDEX IF NOT EXISTS idx_edu_attendance_tenant ON public.edu_attendance(tenant_id);

-- SOURCE supabase/migrations/20260813000020_create_edu_attendance_and_assessment.sql:29; SHA256 c8c5238119ae9c0f96b6ec76370fad4a1e492fd861c76855f799cae5f39f6f1e

CREATE INDEX IF NOT EXISTS idx_edu_attendance_enrollment ON public.edu_attendance(enrollment_id);

-- SOURCE supabase/migrations/20260813000020_create_edu_attendance_and_assessment.sql:30; SHA256 b18d87ea5fe90bff4744b2b7638a5a0edbe7306ebca451351a8a6a814f7e132d

CREATE INDEX IF NOT EXISTS idx_edu_assessments_tenant ON public.edu_assessments(tenant_id);

-- SOURCE supabase/migrations/20260813000020_create_edu_attendance_and_assessment.sql:31; SHA256 9703b4b6c5819a266157ea7e38733aa8e3a58021f5fe90871aa4df12fce993ca

CREATE INDEX IF NOT EXISTS idx_edu_assessments_enrollment ON public.edu_assessments(enrollment_id);

-- SOURCE supabase/migrations/20260813000020_create_edu_attendance_and_assessment.sql:32; SHA256 f1a4f64c094b022a7db32988f47b63ba802121450791c34459b5bcb2a0f8c225


-- Enable RLS
ALTER TABLE public.edu_attendance ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260813000020_create_edu_attendance_and_assessment.sql:35; SHA256 b1963774565b3c6486f7a11f3bdefd1bfd931e47c5eea565906ebfdb54884897

ALTER TABLE public.edu_assessments ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260813000020_create_edu_attendance_and_assessment.sql:36; SHA256 9396c3e233156e44974b7c444094e9877ca2ea7d11539c9cab5cca797854667f


-- Tenant Isolation Policies
DROP POLICY IF EXISTS edu_attendance_tenant_isolation ON public.edu_attendance;

-- SOURCE supabase/migrations/20260813000020_create_edu_attendance_and_assessment.sql:39; SHA256 162ba790a88229e3c44f2526ed906353eeb38558a36823cb438636c71368f0e2

CREATE POLICY edu_attendance_tenant_isolation ON public.edu_attendance
  FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- SOURCE supabase/migrations/20260813000020_create_edu_attendance_and_assessment.sql:41; SHA256 c6240ae36bcde6188a9acc49af8f5aa8d30f988b29682871453d36889ae5f7b4


DROP POLICY IF EXISTS edu_assessments_tenant_isolation ON public.edu_assessments;

-- SOURCE supabase/migrations/20260813000020_create_edu_attendance_and_assessment.sql:43; SHA256 46970f0cfb24e31aba47fef0d6f5eab1100c5133ae90ab091ae9ba0f350b6d66

CREATE POLICY edu_assessments_tenant_isolation ON public.edu_assessments
  FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- SOURCE supabase/migrations/20260813000030_create_assessments_and_results.sql:1; SHA256 5c799260203168a4a7fcd2e65ffbaf8e1bdd04ad0de1a53e78421b5c445357e3
-- Migration: Create assessments and assessment_results tables (CC-3.1)
-- Date: 2026-08-13

CREATE TABLE IF NOT EXISTS public.assessments (
  assessment_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  course_id UUID NOT NULL REFERENCES public.courses(course_id) ON DELETE RESTRICT,
  assessment_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('exam', 'quiz', 'assignment', 'project', 'presentation')),
  max_score NUMERIC(5, 2) NOT NULL,
  passing_score NUMERIC(5, 2) NOT NULL,
  weight NUMERIC(5, 2) NOT NULL,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'graded', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  CONSTRAINT uq_assessments_code UNIQUE (tenant_id, assessment_code)
);

-- SOURCE supabase/migrations/20260813000030_create_assessments_and_results.sql:21; SHA256 797b28da8df6e587c41475e6a38a2e3fc8b6da9c74408d91cd699df57c88f954


CREATE TABLE IF NOT EXISTS public.assessment_results (
  result_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  assessment_id UUID NOT NULL REFERENCES public.assessments(assessment_id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
  score NUMERIC(5, 2),
  grade TEXT,
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  feedback TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'submitted', 'graded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_assessment_results_student UNIQUE (tenant_id, assessment_id, student_id)
);

-- SOURCE supabase/migrations/20260813000030_create_assessments_and_results.sql:37; SHA256 44e0f4434d8f58cb7d47693fea5ce3474c9e454d2966b39c544f6d2aeee9d545


-- Enable RLS
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260813000030_create_assessments_and_results.sql:40; SHA256 c8526a2118f616539a0417855992c35a3b98cfbc0ad708e8a8116c8d9c778f25

ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260813000030_create_assessments_and_results.sql:41; SHA256 ad1aabeab8d9a9b81152afd4f0c709051ea481c39129f8c5128ab2d46e537cbf


-- Tenant Isolation Policies
DROP POLICY IF EXISTS assessments_tenant_isolation ON public.assessments;

-- SOURCE supabase/migrations/20260813000030_create_assessments_and_results.sql:44; SHA256 3e0c6bf37fc39e09517162291ae844e6b6bbc88ca87fe54b0f5f38fe224d9458

CREATE POLICY assessments_tenant_isolation ON public.assessments
  FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- SOURCE supabase/migrations/20260813000030_create_assessments_and_results.sql:46; SHA256 ba526121588e6d88198acc8b1771b58907caf7646b8b01ab785a79be78cb33fe


DROP POLICY IF EXISTS assessment_results_tenant_isolation ON public.assessment_results;

-- SOURCE supabase/migrations/20260813000030_create_assessments_and_results.sql:48; SHA256 4b8910b0cb4e4af795a0e39fa671fb1c16094faa23800994e64b4c3e7c1d0f4c

CREATE POLICY assessment_results_tenant_isolation ON public.assessment_results
  FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- SOURCE supabase/migrations/20260813000030_create_assessments_and_results.sql:50; SHA256 31855be5e3784ab349d4a215ac78ba9d5a9b9676c606240df915d9c5510f3a07


-- Grant privileges for authenticated and service_role
GRANT ALL ON public.assessments TO authenticated, service_role;

-- SOURCE supabase/migrations/20260813000030_create_assessments_and_results.sql:53; SHA256 f3a3cbad9d4168a24e3eb8c3d5441e79a166b55fc4050bb7d3db0044e6aa08dc

GRANT ALL ON public.assessment_results TO authenticated, service_role;

-- SOURCE supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql:1; SHA256 dcb9a60f51bc94f7d83d2355516da69e3f605aaa11581dd3de825fa672517ccf
-- Migration: Create enrollment transaction RPC with capacity check constraints and idempotency (CC-4.1)
-- Date: 2026-08-13

-- 0. Drop the old UUID-based function signature to prevent overload resolution conflicts
DROP FUNCTION IF EXISTS public.edu_enroll_student_v3(UUID, UUID, UUID, UUID, TIMESTAMPTZ, UUID);

-- SOURCE supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql:5; SHA256 938422b32bae8c3f16a083f52f9c46d29280a4df9c81f817a6160c57ef91035d


-- 0b. Add enum value to platform_rule_domain
ALTER TYPE public.platform_rule_domain ADD VALUE IF NOT EXISTS 'education.enrollment';

-- SOURCE supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql:8; SHA256 34ba0722563236b0dcf1440b2042139375837ba1765a29c37651da29ba82e16a


-- 1. Add capacity and prerequisite columns to edu_courses if not exist
ALTER TABLE public.edu_courses ADD COLUMN IF NOT EXISTS max_students INTEGER;

-- SOURCE supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql:11; SHA256 c0f6144816729e4296ede6acec6b4b2906008519ed37fc0baad3213dc8658175

ALTER TABLE public.edu_courses ADD COLUMN IF NOT EXISTS current_enrollment INTEGER DEFAULT 0;

-- SOURCE supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql:12; SHA256 e32488cecfd6d88cb591c7259d3dfd10d28b7c00fc23e48a4643fc76fbc1ad09

ALTER TABLE public.edu_courses ADD COLUMN IF NOT EXISTS prerequisite_course_codes TEXT[] DEFAULT '{}';

-- SOURCE supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql:13; SHA256 41df34bd464a837e57fafa3364b0c73c730c69bf83e1382797006ba8bd9b6851


-- 2. Drop existing check constraints if they exist (to ensure idempotency in running migrations)
ALTER TABLE public.edu_courses DROP CONSTRAINT IF EXISTS chk_edu_courses_current_enrollment;

-- SOURCE supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql:16; SHA256 dcfaf96d5095d225e5c06a18f00a4a84e05a1041d161c386a8e0bdd92da86c89

ALTER TABLE public.edu_courses DROP CONSTRAINT IF EXISTS chk_edu_courses_max_students;

-- SOURCE supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql:17; SHA256 477308011456348166f65a2fc7fb8fffe5bcbf1b445c8932068167422e668a2c

ALTER TABLE public.edu_courses DROP CONSTRAINT IF EXISTS chk_edu_courses_capacity;

-- SOURCE supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql:18; SHA256 75b2098fae0d5732a117c74d7208f532a682e6edff6dc85ed13740907a71ea90


-- 3. Add explicit check constraints to edu_courses
ALTER TABLE public.edu_courses ADD CONSTRAINT chk_edu_courses_current_enrollment CHECK (current_enrollment >= 0);

-- SOURCE supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql:21; SHA256 ead10f03f5dd07620bfaa4a6784e93d0d7cffa56011526028f1fec90f7a6a575

ALTER TABLE public.edu_courses ADD CONSTRAINT chk_edu_courses_max_students CHECK (max_students IS NULL OR max_students > 0);

-- SOURCE supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql:22; SHA256 40fca7aff08de11b1de965dc3ed9767788535babe690b420e827b22dab0f209b

ALTER TABLE public.edu_courses ADD CONSTRAINT chk_edu_courses_capacity CHECK (max_students IS NULL OR current_enrollment <= max_students);

-- SOURCE supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql:23; SHA256 59492901798397a96311f41b6353d1c3488585c65e14a9daa7fdde12b496fd5f


-- 4. Add request_id to edu_enrollments as TEXT to support existing tests' string IDs
ALTER TABLE public.edu_enrollments ADD COLUMN IF NOT EXISTS request_id TEXT;

-- SOURCE supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql:26; SHA256 f9495a9b91c1bab928a5500af2c769ab14f1ea479a4f4ee79941a062b75d42e4

ALTER TABLE public.edu_enrollments ALTER COLUMN request_id TYPE TEXT;

-- SOURCE supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql:30; SHA256 3d494e0c1cfabf2b8780c49dec5fca4a82c8193057ab4c34b70898eb16d08d21


-- 6. Enforce request_id NOT NULL constraint
ALTER TABLE public.edu_enrollments ALTER COLUMN request_id SET NOT NULL;

-- SOURCE supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql:33; SHA256 d1c9261c6e4a212ed5ea98d7320fb0b548e09b71dd9caa5901d3f0cb3d8e0fa6


-- 7. Add unique constraint to edu_enrollments for request_id
ALTER TABLE public.edu_enrollments DROP CONSTRAINT IF EXISTS uq_edu_enrollments_request_id;

-- SOURCE supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql:36; SHA256 1fa5fd09c5d9e90cda90425c84227910ce970aecaed87ed6209e5c555b3199fe

ALTER TABLE public.edu_enrollments ADD CONSTRAINT uq_edu_enrollments_request_id UNIQUE (tenant_id, request_id);

-- SOURCE supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql:37; SHA256 09f26d5d7cbc583c3ece13efe25911209261564d898cbe731a5cd3a49f1226b7


-- 8. Implement edu_enroll_student_v3 PL/pgSQL function (p_request_id is now TEXT)
CREATE OR REPLACE FUNCTION public.edu_enroll_student_v3(
  p_tenant_id UUID,
  p_student_party_id UUID,
  p_course_id UUID,
  p_enrollment_id UUID,
  p_enrolled_at TIMESTAMPTZ,
  p_request_id TEXT
) RETURNS JSONB AS $$
DECLARE
  v_max_students INTEGER;
  v_current_enrollment INTEGER;
  v_course_status TEXT;
  v_existing_id UUID;
  v_rows_affected INTEGER;
BEGIN
  -- 1. Pre-lock check for duplicate requests
  SELECT id INTO v_existing_id
  FROM public.edu_enrollments
  WHERE tenant_id = p_tenant_id AND request_id = p_request_id;

  IF FOUND THEN
    RETURN json_build_object('success', true, 'enrollment_id', v_existing_id, 'is_duplicate', true);
  END IF;

  -- 2. Lock course row to ensure concurrent transactional safety
  SELECT status, max_students, current_enrollment
  INTO v_course_status, v_max_students, v_current_enrollment
  FROM public.edu_courses
  WHERE id = p_course_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found' USING ERRCODE = 'P0002';
  END IF;

  -- 2.5 Post-lock recheck of request_id (prevents race condition where wait for lock results in capacity error instead of duplicate response)
  SELECT id INTO v_existing_id
  FROM public.edu_enrollments
  WHERE tenant_id = p_tenant_id AND request_id = p_request_id;

  IF FOUND THEN
    RETURN json_build_object('success', true, 'enrollment_id', v_existing_id, 'is_duplicate', true);
  END IF;

  -- 3. Check capacity safely
  IF v_course_status = 'full' OR (v_max_students IS NOT NULL AND v_current_enrollment >= v_max_students) THEN
    RAISE EXCEPTION 'Course capacity exceeded' USING ERRCODE = 'P0003';
  END IF;

  -- 4. Create enrollment record with ON CONFLICT DO NOTHING to handle concurrent race conditions
  INSERT INTO public.edu_enrollments (
    id, tenant_id, student_party_id, course_id, status, enrolled_at, created_at, updated_at, request_id
  ) VALUES (
    p_enrollment_id, p_tenant_id, p_student_party_id, p_course_id, 'active', p_enrolled_at, now(), now(), p_request_id
  ) ON CONFLICT (tenant_id, request_id) DO NOTHING;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  -- 5. If conflict occurred, return the duplicate enrollment details
  IF v_rows_affected = 0 THEN
    SELECT id INTO v_existing_id
    FROM public.edu_enrollments
    WHERE tenant_id = p_tenant_id AND request_id = p_request_id;
    
    RETURN json_build_object('success', true, 'enrollment_id', v_existing_id, 'is_duplicate', true);
  END IF;

  -- 6. Increment course current enrollment count
  v_current_enrollment := v_current_enrollment + 1;
  UPDATE public.edu_courses
  SET current_enrollment = v_current_enrollment,
      updated_at = now()
  WHERE id = p_course_id AND tenant_id = p_tenant_id;

  RETURN json_build_object('success', true, 'enrollment_id', p_enrollment_id, 'is_duplicate', false);
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260813000050_create_teacher_assignments.sql:1; SHA256 ca122dd84ecd0e8c36693cd93dca0ddfe021115849e96c8230bb163a0a25c5d8
-- ============================================================================
-- Education OS — Teacher Classroom Assignments Canonical Table
-- ============================================================================
-- Migration: 20260813000050_create_teacher_assignments
-- Target: Canonical persistence for TeacherClassroomAssignment aggregate.
-- Eliminates courses.metadata shadow model risk.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  course_id UUID NOT NULL,
  teacher_party_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('lead_teacher', 'co_teacher', 'assistant', 'substitute')),
  academic_year TEXT NOT NULL,
  effective_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT teacher_assignments_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT teacher_assignments_course_fk FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE,
  CONSTRAINT teacher_assignments_teacher_fk FOREIGN KEY (teacher_party_id) REFERENCES public.party_parties(id) ON DELETE RESTRICT,
  CONSTRAINT teacher_assignments_dates_check CHECK (effective_end_date IS NULL OR effective_end_date >= effective_start_date)
);

-- SOURCE supabase/migrations/20260813000050_create_teacher_assignments.sql:28; SHA256 09a19efbde682fba03e3e1e731328816130b95efd7361296648d7c29ce5a4bbd


-- Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_tenant ON public.teacher_assignments(tenant_id);

-- SOURCE supabase/migrations/20260813000050_create_teacher_assignments.sql:31; SHA256 789384f24f9a15bc0fd0af47443e77bf9ff470c204651115ac2d919876112115

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_course ON public.teacher_assignments(course_id);

-- SOURCE supabase/migrations/20260813000050_create_teacher_assignments.sql:32; SHA256 b4821769b79cac071a300f0ba37cd3304965dfafd706c100f887009688c7c2ca

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON public.teacher_assignments(teacher_party_id);

-- SOURCE supabase/migrations/20260813000050_create_teacher_assignments.sql:33; SHA256 f17423eb9d1871ebef383811904b535be37be72f318a33212cbf4704590653c5

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_status ON public.teacher_assignments(status);

-- SOURCE supabase/migrations/20260813000050_create_teacher_assignments.sql:34; SHA256 49b12dcece7ce6b5c89cc33aa42e1e0d06374470b1764facb034cbc3e8fe80a7

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_lookup ON public.teacher_assignments(tenant_id, course_id, academic_year, status);

-- SOURCE supabase/migrations/20260813000050_create_teacher_assignments.sql:35; SHA256 66c4bd7e1cc7f6d0c23586c979b91dda42f4146cd2fa6941e0672ca59ed3f516


-- Partial Unique Index: Hard Invariant - Max 1 active lead teacher per classroom/course per academic year
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_lead_teacher_per_course_year
  ON public.teacher_assignments (tenant_id, course_id, academic_year)
  WHERE role = 'lead_teacher' AND status = 'active';

-- SOURCE supabase/migrations/20260813000050_create_teacher_assignments.sql:40; SHA256 c020bd6e0a403818088732ad6cbb6c8bd441bd81a60e3dabbfda7903f46cc7ad


-- Unique Constraint: Prevent identical active teacher assignment (same course, teacher, year, role)
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_teacher_course_role_year
  ON public.teacher_assignments (tenant_id, course_id, teacher_party_id, academic_year, role)
  WHERE status = 'active';

-- SOURCE supabase/migrations/20260813000050_create_teacher_assignments.sql:45; SHA256 570bca1371a35788affa93fc0c2052070c6c76a32aa47c29a81524361f556e6b


-- RLS Enablement & Policies
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260813000050_create_teacher_assignments.sql:48; SHA256 b63d34fb9210412794430e69cfef5072d3d4e9bc3ee691910cd12689f40d3ddf


DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'teacher_assignments' AND policyname = 'teacher_assignments_tenant_isolation') THEN
    CREATE POLICY teacher_assignments_tenant_isolation ON public.teacher_assignments
      FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID OR tenant_id = (current_setting('app.current_tenant_id', true))::UUID);
  END IF;
END $$;

-- SOURCE supabase/migrations/20260813000050_create_teacher_assignments.sql:56; SHA256 d35482c72ee15a74b8b91ccfb7d5f0c9c25d12107d593248abe6f7d43027dd67


-- Updated at Trigger
CREATE OR REPLACE FUNCTION update_teacher_assignments_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260813000050_create_teacher_assignments.sql:64; SHA256 835e2be2eb070b8a82305377a1de52d752acee8425fa9d84a3cd311b91c556ba


DROP TRIGGER IF EXISTS trigger_teacher_assignments_updated_at ON public.teacher_assignments;

-- SOURCE supabase/migrations/20260813000050_create_teacher_assignments.sql:66; SHA256 4d80dc79e0adbd8f30791589939faa2bb4da07bcfce460120cc9e5a8b9d09646

CREATE TRIGGER trigger_teacher_assignments_updated_at
  BEFORE UPDATE ON public.teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION update_teacher_assignments_updated_at();

-- SOURCE supabase/migrations/20260912000000_r3_education_identity_cutover.sql:39; SHA256 61f3e46200cbf5dd6f2258618765061dc3e081b387847a9dbe473f041d367b68


-- ==============================================================================
-- R3.1 — ADD students.party_id COLUMN (NULLABLE)
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'party_id'
  ) THEN
    ALTER TABLE students ADD COLUMN party_id UUID;
    RAISE NOTICE '✅ R3.1: Added students.party_id column';
  ELSE
    RAISE NOTICE '⏭️  R3.1: students.party_id already exists (idempotent)';
  END IF;
END $$;

-- SOURCE supabase/migrations/20260912000000_r3_education_identity_cutover.sql:103; SHA256 bb4f3fb9085e1ae7b0f325037a5215d9ea9a1e4ce3864266335e507d73ca0d57


-- ==============================================================================
-- R3.4 — ADD FK students.party_id → party_parties(id)
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'students'
      AND constraint_name = 'students_party_id_fkey'
  ) THEN
    ALTER TABLE students
    ADD CONSTRAINT students_party_id_fkey
    FOREIGN KEY (party_id)
    REFERENCES party_parties(id)
    ON DELETE RESTRICT;
    
    RAISE NOTICE '✅ R3.4: Added FK students.party_id → party_parties(id)';
  ELSE
    RAISE NOTICE '⏭️  R3.4: FK students_party_id_fkey already exists';
  END IF;
END $$;

-- SOURCE supabase/migrations/20260912000000_r3_education_identity_cutover.sql:190; SHA256 96889664aec9530c7ae5e06f21ecdaf068b5f20b02f3ed3301bc7a2c6b59a1b9


-- ==============================================================================
-- R3.8 — CREATE INDEX FOR PERFORMANCE
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'students'
      AND indexname = 'idx_students_party_id'
  ) THEN
    CREATE INDEX idx_students_party_id ON students(party_id);
    RAISE NOTICE '✅ R3.8: Created index idx_students_party_id';
  ELSE
    RAISE NOTICE '⏭️  R3.8: Index idx_students_party_id already exists';
  END IF;
END $$;

-- SOURCE supabase/migrations/20260926002000_r3_student_create_side_nullable_person_id.sql:1; SHA256 486477365ac921d99ed78841ce7ac3500294529c873afaf66ae6f3a7dc913347
-- ============================================================================
-- R3 Student Identity Create-Side Completion
-- ============================================================================
-- Purpose:
-- Allow brand-new canonical Party-backed students to be created without
-- manufacturing legacy persons / identity_migration_mapping rows.
--
-- Contract:
-- - party_id remains the canonical Student identity for new writes.
-- - person_id remains as nullable transitional compatibility for legacy rows.
-- - Existing FK and indexes are preserved for legacy read paths.
-- ============================================================================

ALTER TABLE public.students
ALTER COLUMN person_id DROP NOT NULL;

-- SOURCE supabase/migrations/20260926003000_education_daily_attendance_state.sql:1; SHA256 caa026441041c79d9ab7f5878c6c8a92220097cd48ca350f69aa5e7e4f134a21
-- Education Attendance daily-state projection.
-- Preserves public.edu_attendance as append-only event history.

CREATE TABLE IF NOT EXISTS public.edu_attendance_daily_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES public.edu_enrollments(id) ON DELETE RESTRICT,
  school_day DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'excused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT edu_attendance_daily_state_unique
    UNIQUE (tenant_id, enrollment_id, school_day)
);

-- SOURCE supabase/migrations/20260926003000_education_daily_attendance_state.sql:14; SHA256 90ee3efcd7ef31fafebf73a2a9c1507d05ecee72c1ce07e8dfd6971018d41e94


-- zero-downtime: allow blocking-index - reviewed owner-deployed product table index for daily attendance state lookup
CREATE INDEX IF NOT EXISTS idx_edu_attendance_daily_state_tenant_day
  ON public.edu_attendance_daily_state(tenant_id, school_day);

-- SOURCE supabase/migrations/20260926003000_education_daily_attendance_state.sql:18; SHA256 9fe920b7bd75a6202a5dc47b7a55000ec0389afa6d78bd2c04abb2bc8e2cf05d


-- zero-downtime: allow blocking-index - reviewed owner-deployed product table index for daily attendance enrollment read-back
CREATE INDEX IF NOT EXISTS idx_edu_attendance_daily_state_enrollment
  ON public.edu_attendance_daily_state(enrollment_id);

-- SOURCE supabase/migrations/20260926003000_education_daily_attendance_state.sql:22; SHA256 d94f576ced262597690329eacc0c6967e23e231cd4cc49cd951a0d17f9966719


ALTER TABLE public.edu_attendance_daily_state ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260926003000_education_daily_attendance_state.sql:24; SHA256 3d64808e7878515c6e9be1f4b35e1cf4e321fea8d8fefd2380fd8b85c5093da2


DROP POLICY IF EXISTS edu_attendance_daily_state_tenant_isolation
  ON public.edu_attendance_daily_state;

-- SOURCE supabase/migrations/20260926003000_education_daily_attendance_state.sql:27; SHA256 ada4f9ed6fe5ed27c258aebb235a033d7e7beba075a59f98fb0c1b8f1f7c9e55


CREATE POLICY edu_attendance_daily_state_tenant_isolation
  ON public.edu_attendance_daily_state
  FOR ALL
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
  WITH CHECK (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- SOURCE supabase/migrations/20260926003000_education_daily_attendance_state.sql:33; SHA256 cca8cb21527d0de0de35a8218c273eeb2149029edde93627bcab454e8350b2bb


CREATE OR REPLACE FUNCTION public.edu_set_daily_attendance(
  p_tenant_id UUID,
  p_enrollment_id UUID,
  p_status TEXT,
  p_roll_call_time TIMESTAMPTZ,
  p_school_day DATE
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  enrollment_id UUID,
  school_day DATE,
  status TEXT,
  event_id UUID,
  roll_call_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id UUID;
  v_event_id UUID;
  v_state public.edu_attendance_daily_state%ROWTYPE;
BEGIN
  IF p_status NOT IN ('present', 'absent', 'excused') THEN
    RAISE EXCEPTION 'INVALID_ATTENDANCE_STATUS: %', p_status USING ERRCODE = '22023';
  END IF;

  IF p_roll_call_time IS NULL THEN
    RAISE EXCEPTION 'ROLL_CALL_TIME_REQUIRED' USING ERRCODE = '22023';
  END IF;

  IF p_school_day IS NULL THEN
    RAISE EXCEPTION 'SCHOOL_DAY_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT e.id
  INTO v_enrollment_id
  FROM public.edu_enrollments e
  WHERE e.id = p_enrollment_id
    AND e.tenant_id = p_tenant_id;

  IF v_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'Enrollment % not found for tenant %', p_enrollment_id, p_tenant_id
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.edu_attendance (
    tenant_id,
    enrollment_id,
    status,
    roll_call_time
  )
  VALUES (
    p_tenant_id,
    p_enrollment_id,
    p_status,
    p_roll_call_time
  )
  RETURNING edu_attendance.id INTO v_event_id;

  INSERT INTO public.edu_attendance_daily_state (
    tenant_id,
    enrollment_id,
    school_day,
    status
  )
  VALUES (
    p_tenant_id,
    p_enrollment_id,
    p_school_day,
    p_status
  )
  ON CONFLICT (tenant_id, enrollment_id, school_day)
  DO UPDATE SET
    status = EXCLUDED.status,
    updated_at = now()
  RETURNING * INTO v_state;

  RETURN QUERY SELECT
    v_state.id,
    v_state.tenant_id,
    v_state.enrollment_id,
    v_state.school_day,
    v_state.status,
    v_event_id,
    p_roll_call_time,
    v_state.created_at,
    v_state.updated_at;
END;
$$;

-- SOURCE supabase/migrations/20260926003000_education_daily_attendance_state.sql:128; SHA256 8bfebad85700dcec6d1a061c76898a32bbe4694595c738ec1d1845e8243b831f


REVOKE ALL ON FUNCTION public.edu_set_daily_attendance(UUID, UUID, TEXT, TIMESTAMPTZ, DATE) FROM PUBLIC;

-- SOURCE supabase/migrations/20260926003000_education_daily_attendance_state.sql:130; SHA256 7cb15a003ebf40536a86deb1f988a8e1f185f1c62b3bea4f001fb7cf0cd74f38

GRANT EXECUTE ON FUNCTION public.edu_set_daily_attendance(UUID, UUID, TEXT, TIMESTAMPTZ, DATE) TO authenticated, service_role;

-- SOURCE supabase/migrations/20260926003000_education_daily_attendance_state.sql:131; SHA256 fdae427680bd3a42d6737c6c4dfe29b7db06a214b196b1f375291ed50cd07e28


COMMENT ON TABLE public.edu_attendance_daily_state IS
  'Education Attendance daily-state projection. edu_attendance remains append-only event history.';
