-- LOCAL HEALTHCARE REGRESSION ONLY. Exact canonical statements ordered by FK prerequisites.

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:1; SHA256 e5bf9b3c410bc45e65ac45949f391d55c899bf04981430b0c199711d22c1797b
-- ============================================================================
-- Bella Healthcare Platform — Phase B1 Perioperative Care Platform Schema
-- Migration: 20260808000004_create_perioperative_platform.sql
-- Governance: Clinical Safety Profile Tier 3
-- ============================================================================

-- Enable the btree_gist extension for tenant-aware exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:1; SHA256 297af75e952330dddfa6017e2f77d4939f683d8f5eb875be62d4f69c62aac01d
-- ============================================================================
-- Bella Healthcare Platform — Phase B2, B3, B4 Critical Care & Diagnostics Schema
-- Migration: 20260808000005_create_icu_ed_bloodbank_tables.sql
-- Governance: Clinical Safety Profile Tier 3
-- ============================================================================

-- Enable the btree_gist extension (should already exist, but kept for idempotency)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- SOURCE supabase/migrations/20260511000000_initial_schema.sql:32; SHA256 8d27ed4ee87013f9f9accfc662c77fae324b98229e91443fbbb46166ab6c2a5f


-- 2. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT UNIQUE NOT NULL,
    name_mother TEXT NOT NULL,
    name_baby TEXT,
    dob_baby DATE,
    dob_expected DATE,
    address TEXT,
    referrer_id UUID REFERENCES users(id),
    zalo_oa_id TEXT,
    status TEXT DEFAULT 'active',
    notes TEXT,
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SOURCE supabase/migrations/20260511500000_create_inventory_items.sql:1; SHA256 25a7f22754dbad5ccf7c71c2eea3139559647a5b9eccfb53dc3d67ba476cdaa7
-- Migration: Create inventory_items table (MISSING SCHEMA HISTORY RECOVERY)
-- Date: 2026-09-16
-- Source: Reverse-engineered from E2E database (bmnbqbcdbuklhopfbopv)
-- Purpose: Repair migration chain reproducibility (P0)
--
-- Context:
-- The inventory_items table has been actively used in production since early development
-- but its CREATE TABLE migration was never committed to version control. This migration
-- restores the missing schema history to enable clean-build reproducibility.
--
-- Evidence:
-- - 76+ code references in src/__tests__/ and production code
-- - Referenced by migrations #2 (RLS), #12 (audit), #23 (policies)
-- - FK dependencies: inventory_logs, package_materials, drug_profiles, anesthesia_drugs
-- - Git history: No CREATE TABLE inventory_items found in any commit
--
-- Classification: MISSING_SCHEMA_HISTORY (lost migration)
--
-- Timestamp: 20260511500000 (between initial_schema and fix_permissions)

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    unit TEXT NOT NULL DEFAULT 'cái',
    stock_level NUMERIC NOT NULL DEFAULT 0,
    min_stock_level NUMERIC NOT NULL DEFAULT 10,
    price_per_unit NUMERIC NOT NULL DEFAULT 0,
    category TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SOURCE supabase/migrations/20260806030000_healthcare_kernel_schema.sql:1; SHA256 cc2ae2df9fcf2a6c33aff0504ff6cc17782b73b7d1ef6f8394c8421e56088119
-- ============================================================================
-- Bella Healthcare Platform — Healthcare Kernel Schema (Vertical Specific)
-- Migration: 20260806030000_healthcare_kernel_schema.sql
-- ============================================================================

-- 1. HEALTHCARE ENCOUNTERS (Clinical visits/interactions)
CREATE TABLE IF NOT EXISTS public.hc_encounters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    care_journey_id UUID NOT NULL REFERENCES public.journey_journeys(id) ON DELETE CASCADE,
    patient_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    doctor_party_id UUID REFERENCES public.party_parties(id) ON DELETE SET NULL,
    encounter_class TEXT NOT NULL CHECK (encounter_class IN ('walk_in', 'scheduled', 'emergency', 'telemedicine', 'follow_up', 'homecare')),
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'arrived', 'triaged', 'in_progress', 'finished', 'cancelled')),
    scheduled_at TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    queue_number INTEGER,
    chief_complaint TEXT,
    notes TEXT,
    
    -- Auditing & Versioning
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- SOURCE supabase/migrations/20260812030000_extend_clinical_orders_table.sql:167; SHA256 6c141e3fd90169aa01eb3b06946c267118a89c8dc0569e0e24037fe6a12d5662


-- 4.1 Ensure hc_encounters has UNIQUE constraint (required for composite FK)
--     Note: (id, patient_party_id) is naturally unique since id is already PK
--     This just makes it explicit for the FK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_hc_encounters_id_patient'
  ) THEN
    ALTER TABLE public.hc_encounters
      ADD CONSTRAINT uq_hc_encounters_id_patient 
      UNIQUE (id, patient_party_id);
    
    RAISE NOTICE '[Phase 4] UNIQUE constraint on hc_encounters(id, patient_party_id): ADDED';
  ELSE
    RAISE NOTICE '[Phase 4] UNIQUE constraint on hc_encounters(id, patient_party_id): EXISTS';
  END IF;
END $$;

-- SOURCE supabase/migrations/20260806030000_healthcare_kernel_schema.sql:36; SHA256 985ceb8e111234cd997666f5125235c15c182b428d1cce7191305841ccc9be9b


-- 2. CLINICAL PRESCRIPTIONS (Linked to Encounters)
CREATE TABLE IF NOT EXISTS public.hc_prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    patient_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    doctor_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    drugs JSONB NOT NULL DEFAULT '[]', -- List of prescribed drugs: [{code, label, dose, frequency, duration_days}]
    diagnosis TEXT, -- Summary of diagnoses (ICD-10 codes)
    notes TEXT,
    
    -- Auditing & Versioning
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:1; SHA256 c42ba507751d3319db7ffe3c2cc2feccdffc086b3d8fc56b6e50c93f1bf6c2aa
-- ============================================================================
-- Bella Healthcare Platform — Extended Canonical Domain Schema
-- Migration: 20260806050000_healthcare_platform_extended_schema.sql
-- Governance: Bella Healthcare Constitution v1.0 & Product Manifests
-- ============================================================================

-- 1. PATIENT PROFILES (1-1 Extension of Core `customers` Table)
CREATE TABLE IF NOT EXISTS public.patient_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE UNIQUE,
    blood_type TEXT DEFAULT 'UNKNOWN' CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN')),
    rh_factor TEXT,
    known_allergies JSONB DEFAULT '[]'::jsonb,
    medical_history JSONB DEFAULT '[]'::jsonb,
    family_medical_history JSONB DEFAULT '[]'::jsonb,
    bhyt_code TEXT,
    bhyt_benefit_rate INTEGER DEFAULT 80,
    bhyt_initial_facility TEXT,
    bhyt_valid_from DATE,
    bhyt_valid_to DATE,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relationship TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:93; SHA256 6e0e7cbf5a90918069cfb80e66476d9f80c9e9006595f45ad168692339738c0b


-- 5. DRUG PROFILES (Healthcare Extension for `inventory_items`)
CREATE TABLE IF NOT EXISTS public.hc_drug_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE UNIQUE,
    drug_code TEXT NOT NULL,
    active_ingredient TEXT NOT NULL,
    atc_code TEXT,
    dosage_form TEXT, -- e.g., Viên nén, Dung dịch
    strength TEXT, -- e.g., 500mg, 10mg/ml
    route_of_administration TEXT,
    is_controlled_drug BOOLEAN DEFAULT false,
    is_cold_storage BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:112; SHA256 281b6fa433c860f02e50054875d8857ce15d3fecf30ebcddab873fc1799edf69


-- 6. PATIENT JOURNEY WORKFLOW QUEUE
CREATE TABLE IF NOT EXISTS public.hc_patient_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    ticket_number TEXT NOT NULL,
    queue_type TEXT DEFAULT 'service' CHECK (queue_type IN ('bhyt', 'service', 'followup', 'priority')),
    current_station TEXT DEFAULT 'registration' CHECK (current_station IN ('registration', 'vitals', 'consultation', 'lab', 'imaging', 'review', 'billing', 'pharmacy')),
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'in_service', 'completed', 'skipped')),
    called_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:1; SHA256 4dbb4dc7e9936d78115e54b25bfb1f463d6607c79a9d38f22e8ae5e858a64092
-- ============================================================================
-- BELLA HOSPITAL INPATIENT HIS BASELINE MIGRATION (Phase A.2 Additive Migration)
-- Target: Enterprise Healthcare Platform Baseline
-- Rules: Additive Tables Only (Zero alteration of frozen legacy tables)
-- ============================================================================

-- 1. Master Patient Index (MPI Identity Resolution)
CREATE TABLE IF NOT EXISTS public.hc_master_patient_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    national_id VARCHAR(50),
    insurance_number VARCHAR(50),
    mrn_code VARCHAR(50) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    gender VARCHAR(20) NOT NULL DEFAULT 'other',
    dob DATE,
    phone VARCHAR(30),
    address TEXT,
    emergency_contact JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:22; SHA256 039efb34c7429f1b2c60133f5a54361cd4108a1f37ddc90519a53799f0828321


-- 2. Infrastructure Hierarchy: Buildings, Wards, Rooms, Beds
CREATE TABLE IF NOT EXISTS public.hc_buildings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:32; SHA256 a2f75d67b4a49b5eee38699117fe44b61ebad90b75820b96de076b2064a5d1f8


CREATE TABLE IF NOT EXISTS public.hc_wards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    building_id UUID REFERENCES public.hc_buildings(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    department_head_practitioner_id UUID,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:42; SHA256 a832fb7914feb699577c914e44a277130e4886803da9bd1d110f514d5bf2f8be


CREATE TABLE IF NOT EXISTS public.hc_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    ward_id UUID NOT NULL REFERENCES public.hc_wards(id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL,
    floor_number INT DEFAULT 1,
    gender_restriction VARCHAR(20) DEFAULT 'unrestricted',
    is_isolation BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:53; SHA256 c678dfad8f94920c5179977d157dfd2600ec3d177048add79eaf1af4e3136c7c


CREATE TABLE IF NOT EXISTS public.hc_beds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.hc_rooms(id) ON DELETE CASCADE,
    ward_id UUID NOT NULL REFERENCES public.hc_wards(id) ON DELETE CASCADE,
    bed_code VARCHAR(50) NOT NULL,
    bed_type VARCHAR(50) DEFAULT 'standard',
    status VARCHAR(50) DEFAULT 'available',
    daily_rate NUMERIC(15, 2) DEFAULT 0.00,
    current_admission_id UUID,
    current_patient_id UUID,
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:67; SHA256 76793a9c1d3bad4e5f3ffe3490df47639613f8f7b12376026aaa44f76ffeea4c


-- 3. Inpatient Admissions & Clinical Records
CREATE TABLE IF NOT EXISTS public.hc_inpatient_admissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.hc_master_patient_index(id),
    bed_id UUID NOT NULL REFERENCES public.hc_beds(id),
    ward_id UUID NOT NULL REFERENCES public.hc_wards(id),
    admitting_doctor_id UUID NOT NULL,
    attending_doctor_id UUID NOT NULL,
    admission_diagnosis JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'admitted',
    admitted_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    discharged_at TIMESTAMPTZ,
    discharge_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:86; SHA256 7734f1ace7ed560d69fcf78b5a7e751df3d30e907e131479bb596493e5c8873e


CREATE TABLE IF NOT EXISTS public.hc_nursing_vital_signs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    inpatient_admission_id UUID NOT NULL REFERENCES public.hc_inpatient_admissions(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL,
    nurse_practitioner_id UUID NOT NULL,
    temperature NUMERIC(4, 1) NOT NULL,
    heart_rate INT NOT NULL,
    systolic_bp INT NOT NULL,
    diastolic_bp INT NOT NULL,
    spo2 INT NOT NULL,
    respiratory_rate INT,
    notes TEXT,
    recorded_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:103; SHA256 b0f962689aeccee4142f20fe12ae40d279a01efa6870e726d9b86ab135055eee


CREATE TABLE IF NOT EXISTS public.hc_medication_administration_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    inpatient_admission_id UUID NOT NULL REFERENCES public.hc_inpatient_admissions(id) ON DELETE CASCADE,
    prescription_item_id UUID NOT NULL,
    drug_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    route VARCHAR(100) NOT NULL,
    scheduled_time TIMESTAMPTZ NOT NULL,
    administered_time TIMESTAMPTZ,
    administered_by_nurse_id UUID,
    status VARCHAR(50) DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:119; SHA256 6b2756a65ae2b8a98fce06e65d34ec71c4b0ec28fb0c6493c0c653dab0877c6f


-- 4. Break-Glass Security Audit Log Table
CREATE TABLE IF NOT EXISTS public.hc_security_break_glass_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id),
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    patient_id UUID NOT NULL,
    encounter_id UUID,
    reason VARCHAR(500) NOT NULL,
    ip_address VARCHAR(50),
    activated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:133; SHA256 55f162cab7e2b4b5efe7e02b4919d54ece36d9e0c0e6564ad7d4037efb3e5b98


-- 5. Enterprise Registries Repository Table
CREATE TABLE IF NOT EXISTS public.hc_enterprise_registries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registry_type VARCHAR(50) NOT NULL,
    code VARCHAR(100) NOT NULL,
    version VARCHAR(20) DEFAULT '1.0.0',
    definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    UNIQUE(registry_type, code, version)
);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:8; SHA256 27a4312db62387868f643976ac3329a5c78b8ea35906258abdcbe1f425c75422


-- 1. CLINICAL SAFETY PROFILES (Immutable Governance Evidence)
CREATE TABLE IF NOT EXISTS public.hc_clinical_safety_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    profile_version TEXT NOT NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_scope TEXT NOT NULL,
    document_sha256 CHAR(64) NOT NULL,
    architecture_version TEXT NOT NULL,
    deployment_status TEXT NOT NULL DEFAULT 'draft' CHECK (deployment_status IN ('draft', 'active', 'deprecated')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:34; SHA256 5b1bd9143b8ef35a3ca7cbe012bf03e34dfe6fecb4bd0a24f4f8067f5d17d691



-- 2. PERSISTENT IDEMPOTENCY KEYS
CREATE TABLE IF NOT EXISTS public.hc_idempotency_keys (
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (tenant_id, request_id, operation)
);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:46; SHA256 04a0f545b617a1033b20841844f3f6ee74421fa4666169ba611c7022265337a7


-- 3. OPERATING ROOMS
CREATE TABLE IF NOT EXISTS public.hc_operating_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    room_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_room_number_tenant UNIQUE (tenant_id, room_number)
);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:60; SHA256 a0a5208176ed3f18cfbac7c759aef4d8e8af626a067823bf5857eb67a1b1fe70


-- 4. OPERATING ROOM SCHEDULES (with EXCLUDE overlap protection)
CREATE TABLE IF NOT EXISTS public.hc_or_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    operating_room_id UUID NOT NULL REFERENCES public.hc_operating_rooms(id) ON DELETE CASCADE,
    scheduled_time_range TSTZRANGE NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT exclude_or_schedule_overlap EXCLUDE USING gist (
        tenant_id WITH =,
        operating_room_id WITH =,
        scheduled_time_range WITH &&
    ) WHERE (status IN ('scheduled', 'confirmed', 'in_progress'))
);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:81; SHA256 de730b7c49eab462192ebe8a15589e58ca8ac823da3592eb196b7a2e1d1dc0d8


-- 5. SURGICAL CASES
CREATE TABLE IF NOT EXISTS public.hc_surgical_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    case_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'scheduled', 'ready', 'in_progress', 'completed', 'cancelled', 'aborted')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_case_number_tenant UNIQUE (tenant_id, case_number)
);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:96; SHA256 a8980cf68460f763df7d5c6bcf606e0b4d091b05dfe74c56536f1b02451752de


-- 6. SURGICAL TEAMS (Normalized Participants)
CREATE TABLE IF NOT EXISTS public.hc_surgical_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    surgical_case_id UUID NOT NULL REFERENCES public.hc_surgical_cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('surgeon', 'assistant_surgeon', 'anesthesiologist', 'circulating_nurse', 'scrub_nurse')),
    assigned_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    left_at TIMESTAMPTZ,
    CONSTRAINT unique_team_member UNIQUE (surgical_case_id, user_id, role)
);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:111; SHA256 0e1e7b7b241c31288b591e46b1297a410a98a20fbd20de86fa3a6dff067298fc


-- 7. SURGICAL SAFETY CHECKLISTS (WHO Sign-In, Time-Out, Sign-Out)
CREATE TABLE IF NOT EXISTS public.hc_surgical_safety_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    surgical_case_id UUID NOT NULL REFERENCES public.hc_surgical_cases(id) ON DELETE CASCADE UNIQUE,
    signin_completed BOOLEAN NOT NULL DEFAULT false,
    signin_completed_at TIMESTAMPTZ,
    signin_completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    timeout_completed BOOLEAN NOT NULL DEFAULT false,
    timeout_completed_at TIMESTAMPTZ,
    timeout_completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    signout_completed BOOLEAN NOT NULL DEFAULT false,
    signout_completed_at TIMESTAMPTZ,
    signout_completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:132; SHA256 e27a4e2e35a81160554f34240c3954b99657d8b326812cc1ac9ded2510bf1217


-- 8. ANESTHESIA RECORDS
CREATE TABLE IF NOT EXISTS public.hc_anesthesia_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    surgical_case_id UUID NOT NULL REFERENCES public.hc_surgical_cases(id) ON DELETE CASCADE UNIQUE,
    asa_classification INTEGER CHECK (asa_classification BETWEEN 1 AND 6),
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'pre_op_complete', 'intra_op', 'post_op', 'completed')),
    pre_op_assessment TEXT,
    post_op_assessment TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:148; SHA256 1e72d2014431b9ebfee20ab5a5324126775aac00f12656afafa04ce61d8fc589


-- 9. ANESTHESIA OBSERVATIONS (Time-series vital signs)
CREATE TABLE IF NOT EXISTS public.hc_anesthesia_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    anesthesia_record_id UUID NOT NULL REFERENCES public.hc_anesthesia_records(id) ON DELETE CASCADE,
    observation_time TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL,
    value NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:163; SHA256 97f5ebf0529f2bae744ef290fddad3fe51a2df6df7aba27851b242816003df21


-- 10. ANESTHESIA MEDICATIONS
CREATE TABLE IF NOT EXISTS public.hc_anesthesia_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    anesthesia_record_id UUID NOT NULL REFERENCES public.hc_anesthesia_records(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    administered_at TIMESTAMPTZ NOT NULL,
    dose NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    waste NUMERIC NOT NULL DEFAULT 0,
    verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:180; SHA256 8d7da5a230c4f794e0be116bf9e3214abf702ef0aadc51217b06e28463fe9a1c


-- 11. PACU ADMISSIONS (with Discharge Policy Snapshotting)
CREATE TABLE IF NOT EXISTS public.hc_pacu_admissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    surgical_case_id UUID NOT NULL REFERENCES public.hc_surgical_cases(id) ON DELETE CASCADE UNIQUE,
    admitted_at TIMESTAMPTZ NOT NULL,
    discharged_at TIMESTAMPTZ,
    discharge_policy_version TEXT NOT NULL,
    aldrete_score INTEGER CHECK (aldrete_score BETWEEN 0 AND 10),
    pain_score INTEGER CHECK (pain_score BETWEEN 0 AND 10),
    status TEXT NOT NULL DEFAULT 'admitted' CHECK (status IN ('admitted', 'ready_for_discharge', 'discharged')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:198; SHA256 4631383c7b689f4eb4d40647c1c050de11a6f4916682ebadaeb4860e2ddbdccb


-- 12. SPECIMENS
CREATE TABLE IF NOT EXISTS public.hc_specimens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    surgical_case_id UUID NOT NULL REFERENCES public.hc_surgical_cases(id) ON DELETE CASCADE,
    specimen_code TEXT NOT NULL,
    tissue_source TEXT NOT NULL,
    collection_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'collected' CHECK (status IN ('collected', 'sent_to_lab', 'received_lab', 'processed')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_specimen_code_tenant UNIQUE (tenant_id, specimen_code)
);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:215; SHA256 ce096f44a09121dd6596ac6166e013a64cf6f0851c31ac0d065b666bc57ddb9b


-- 13. IMPLANTS (Traceable)
CREATE TABLE IF NOT EXISTS public.hc_implants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    surgical_case_id UUID NOT NULL REFERENCES public.hc_surgical_cases(id) ON DELETE CASCADE,
    implant_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    serial_number TEXT NOT NULL,
    implanted_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:229; SHA256 e88f404dc1b87ca393dc06f471c6588283dc047115171a437fdb880073439c8b


-- 14. EQUIPMENT
CREATE TABLE IF NOT EXISTS public.hc_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'sterile_hold', 'maintenance')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_equip_serial_tenant UNIQUE (tenant_id, serial_number)
);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:243; SHA256 24498f5965c69d908b138e4c4ca284442f89de2d29722b4b8b70a0874424f553


-- 15. CSSD CYCLES
CREATE TABLE IF NOT EXISTS public.hc_cssd_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cycle_number TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    indicator_result TEXT CHECK (indicator_result IN ('pass', 'fail', 'pending')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_cycle_number_tenant UNIQUE (tenant_id, cycle_number)
);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:258; SHA256 b178e8c25f9bd3d6d8220898037dc0682f7af3a5053132a1385729e280fc4bae


-- 16. CSSD CYCLE ITEMS
CREATE TABLE IF NOT EXISTS public.hc_cssd_cycle_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cssd_cycle_id UUID NOT NULL REFERENCES public.hc_cssd_cycles(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.hc_equipment(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('processing', 'sterilized', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:271; SHA256 d1fdff12d30c543cc8ef0f246cef21b372e4e59e39292862555a57103e381ea5


-- 17. OR EQUIPMENT USAGE
CREATE TABLE IF NOT EXISTS public.hc_or_equipment_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    surgical_case_id UUID NOT NULL REFERENCES public.hc_surgical_cases(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.hc_equipment(id) ON DELETE CASCADE,
    cssd_cycle_id UUID NOT NULL REFERENCES public.hc_cssd_cycles(id) ON DELETE CASCADE,
    used_at TIMESTAMPTZ NOT NULL,
    returned_at TIMESTAMPTZ,
    CONSTRAINT unique_case_equipment_cycle UNIQUE (surgical_case_id, equipment_id, cssd_cycle_id)
);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:8; SHA256 fb7681ab840b52141d9a6bc73f789e3f595038e4742bf3a72bfd6b12dd1f476c


-- 1. ICU Beds
CREATE TABLE IF NOT EXISTS public.hc_icu_beds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bed_id UUID NOT NULL REFERENCES public.hc_beds(id) ON DELETE CASCADE,
    monitoring_level TEXT NOT NULL CHECK (monitoring_level IN ('standard', 'advanced', 'critical')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_icu_bed UNIQUE (tenant_id, bed_id)
);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:21; SHA256 d2027814ba36af0d6d018960e38b6fcb3273ec405925084d58d9f0ff715557f6


-- 2. ICU Observations (Raw vital/lab telemetry)
CREATE TABLE IF NOT EXISTS public.hc_icu_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    observed_at TIMESTAMPTZ NOT NULL,
    vitals JSONB NOT NULL, -- MAP of heart_rate, mean_arterial_pressure, temperature, respiratory_rate, spo2
    labs JSONB NOT NULL,   -- MAP of pao2, platelet_count, bilirubin, creatinine
    clinical JSONB NOT NULL, -- MAP of glasgow_coma_scale, urine_output, vasopressor_doses
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:37; SHA256 5ce71a0ac62fe7c34f7ab3d35459036e886f5c49b35e67e0b8c08292ad4a9e9d


-- 3. Clinical Calculations (Unified score provenance ledger)
CREATE TABLE IF NOT EXISTS public.hc_clinical_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    algorithm_id TEXT NOT NULL CHECK (algorithm_id IN ('SOFA', 'APACHE_II', 'NEDOCS', 'ESI')),
    algorithm_version TEXT NOT NULL,
    calculation_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    calculation_status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (calculation_status IN ('PENDING', 'COMPLETED', 'FAILED', 'SUPERSEDED')),
    input_snapshot JSONB NOT NULL,
    source_observation_references JSONB NOT NULL, -- polymorphic references array: [{"entity_type": "...", "entity_id": "..."}]
    output JSONB NOT NULL, -- computed scores/outputs
    engine_version TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:57; SHA256 c95659603297d6d11999c617341cb9cda9142b27b6f7135aab91f29bffe5a107


-- 4. Ventilator Safety Policies
CREATE TABLE IF NOT EXISTS public.hc_ventilator_safety_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    settings_rules JSONB NOT NULL, -- policy configurations
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:70; SHA256 67d4c1d0c9dd25f34613d96eec6e4a1deface4d5376a619a1a4de3a8a3f1b111


-- 5. Ventilator Records
CREATE TABLE IF NOT EXISTS public.hc_ventilator_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES public.hc_ventilator_safety_policies(id) ON DELETE RESTRICT,
    mode TEXT NOT NULL CHECK (mode IN ('AC', 'SIMV', 'CPAP', 'PSV', 'PRVC')),
    settings JSONB NOT NULL, -- fio2, peep, tidal_volume, respiratory_rate, pressure_support, ie_ratio, inspiratory_pressure
    monitored_params JSONB NOT NULL, -- pip, plat_pressure, minute_volume
    started_at TIMESTAMPTZ NOT NULL,
    stopped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:88; SHA256 d1a548a57c597c070d394b92d2bafe752d97daee2e70de81d4aaeffa3db0dfd9


-- 6. Emergency Visits
CREATE TABLE IF NOT EXISTS public.hc_emergency_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE UNIQUE,
    chief_complaint TEXT NOT NULL,
    assigned_bed_id UUID REFERENCES public.hc_beds(id) ON DELETE SET NULL,
    nedocs_score INTEGER,
    nedocs_calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:104; SHA256 cf1673c5dd7935e77174738180c86c9e92ffda800e2507196715338b1ba3d397


-- 7. Triage Assessments (Audit logs of emergency triage)
CREATE TABLE IF NOT EXISTS public.hc_triage_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    emergency_visit_id UUID NOT NULL REFERENCES public.hc_emergency_visits(id) ON DELETE CASCADE,
    acuity_level INTEGER NOT NULL CHECK (acuity_level BETWEEN 1 AND 5), -- ESI Triage Level
    assessment_type TEXT NOT NULL CHECK (assessment_type IN ('initial', 'reassessment', 'retriage')),
    acuity_criteria JSONB NOT NULL, -- Details of triage decisions
    assessed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    assessed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:120; SHA256 6b97732135fda7df7ddff99ce15fd1a101763613cca6bfac76fd3b2523dcb242


-- 8. Blood Units (Inventory & Lifecycle state machine)
CREATE TABLE IF NOT EXISTS public.hc_blood_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_number TEXT NOT NULL,
    blood_type TEXT NOT NULL CHECK (blood_type IN ('A', 'B', 'AB', 'O')),
    rh_factor TEXT NOT NULL CHECK (rh_factor IN ('POSITIVE', 'NEGATIVE')),
    component_type TEXT NOT NULL CHECK (component_type IN ('RBC')), -- RBC only for B4
    status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'QUARANTINED', 'AVAILABLE', 'RESERVED', 'ISSUED', 'TRANSFUSING', 'TRANSFUSED', 'EXPIRED', 'DISCARDED', 'RETURNED', 'REJECTED')),
    expiry_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_blood_unit_number_tenant UNIQUE (tenant_id, unit_number)
);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:137; SHA256 5919e3812b2c1804c1d28bbe2633449e450f479af3aa160e3029ef98e190e4a7


-- 9. Blood Crossmatch Records (Crossmatch lifecycle)
CREATE TABLE IF NOT EXISTS public.hc_blood_crossmatch_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    blood_unit_id UUID NOT NULL REFERENCES public.hc_blood_units(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'SAMPLE_VERIFIED', 'TESTED', 'COMPATIBLE', 'INCOMPATIBLE', 'APPROVED', 'EXPIRED', 'CANCELLED')),
    crossmatched_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    crossmatched_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:156; SHA256 618af3460c4dfc747af70ebdd783ee8b8cd7896786aa7a788916a37d518f2732


-- 10. Transfusion Verifications (Immutable double-verification sign-off)
CREATE TABLE IF NOT EXISTS public.hc_transfusion_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    blood_unit_id UUID NOT NULL REFERENCES public.hc_blood_units(id) ON DELETE CASCADE,
    crossmatch_id UUID NOT NULL REFERENCES public.hc_blood_crossmatch_records(id) ON DELETE CASCADE,
    verification_data JSONB NOT NULL, -- patient_id, unit_number, blood_type, rh_factor, component, crossmatch_result
    verified_by_clinician_a UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    verified_by_clinician_b UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    verified_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:185; SHA256 cb7fa0cd43253d9e277cc537dd0558268b0c67424a054e802a6b02e61c6930e6


-- 11. Transfusion Records (Active Transfusion state tracking)
CREATE TABLE IF NOT EXISTS public.hc_transfusion_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    blood_unit_id UUID NOT NULL REFERENCES public.hc_blood_units(id) ON DELETE CASCADE,
    verification_id UUID NOT NULL REFERENCES public.hc_transfusion_verifications(id) ON DELETE RESTRICT UNIQUE,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'aborted')),
    reaction_occurred BOOLEAN DEFAULT false NOT NULL,
    reaction_details TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260812040000_recreate_clinical_orders_table.sql:44; SHA256 fea64cbfc4e2b1d0dd080b571905b3cd89428bcb009b4a5e30270e02c20a7911


-- ============================================================================
-- Create hc_clinical_orders with CORRECT schema
-- Combines base (20260808000006) + extensions (20260812030000)
-- ============================================================================

CREATE TABLE public.hc_clinical_orders (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
  
  -- Order classification
  order_type TEXT NOT NULL CHECK (
    order_type IN ('MEDICATION', 'LAB', 'IMAGING', 'PROCEDURE', 'DIET', 'NURSING')
  ),
  order_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    order_status IN ('PENDING', 'VALIDATED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'DISCONTINUED', 'REJECTED')
  ),
  priority TEXT NOT NULL DEFAULT 'ROUTINE' CHECK (priority IN ('STAT', 'URGENT', 'ROUTINE')),
  
  -- Ordering workflow
  ordered_by TEXT NOT NULL,
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  discontinued_by TEXT,
  discontinued_at TIMESTAMPTZ,
  discontinue_reason TEXT,
  
  -- CDS integration
  cds_check_id UUID REFERENCES public.hc_clinical_calculations(id) ON DELETE SET NULL,
  cds_check_status TEXT CHECK (cds_check_status IN ('PASSED', 'WARNED', 'BLOCKED')),
  
  -- Order payload
  order_details JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  
  -- Phase 0 extensions (from 20260812030000)
  patient_party_id UUID NOT NULL,
  request_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Composite FK constraint (encounter_id + patient_party_id)
  CONSTRAINT fk_hc_clinical_orders_encounter_patient
    FOREIGN KEY (encounter_id, patient_party_id)
    REFERENCES public.hc_encounters(id, patient_party_id)
    ON DELETE CASCADE
);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:50; SHA256 e280050d8508e5a4fa6f365eb2ec403379bcd5489de9c5388d797f388a9e5184


-- 3. LABORATORY ORDERS & ITEMS (LIS Foundation)
CREATE TABLE IF NOT EXISTS public.hc_lab_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    clinical_order_id UUID NOT NULL REFERENCES public.hc_clinical_orders(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    test_code TEXT NOT NULL,
    test_name TEXT NOT NULL,
    sample_type TEXT,
    tube_color TEXT,
    result_value TEXT,
    result_unit TEXT,
    reference_range TEXT,
    is_abnormal BOOLEAN DEFAULT false,
    is_panic_value BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:74; SHA256 51d165177b634bb3ba3593df2402b076a0a3f416fa98f041e537f1e8a271d61e


-- 4. IMAGING ORDERS & DICOM LINKS (RIS Foundation)
CREATE TABLE IF NOT EXISTS public.hc_imaging_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    clinical_order_id UUID NOT NULL REFERENCES public.hc_clinical_orders(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    modality TEXT NOT NULL CHECK (modality IN ('XRAY', 'CT', 'MRI', 'ULTRASOUND', 'ENDOSCOPY')),
    body_site TEXT NOT NULL,
    dcm_study_uid TEXT,
    viewer_link TEXT,
    radiologist_report TEXT,
    radiologist_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:52; SHA256 9c6b83dcdda882043d6f5254b5f0165c19e2b013f0120ca2e506f074b91fd4f6


-- ============================================================================
-- PART 2: GLOBAL CLINICAL KNOWLEDGE TABLES
-- No tenant_id — governed centrally, append-only
-- ============================================================================

-- 1. Global Drug Catalog (ATC/WHO)
CREATE TABLE IF NOT EXISTS public.hc_drugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_code TEXT NOT NULL UNIQUE,           -- ATC code: e.g. B01AC06 (Aspirin)
  drug_name TEXT NOT NULL,
  generic_name TEXT,
  drug_class TEXT NOT NULL,                 -- 'ANTICOAGULANT', 'NSAID', 'ANTIBIOTIC', etc.
  atc_code TEXT,
  max_daily_dose_mg NUMERIC,
  weight_based_dosing BOOLEAN NOT NULL DEFAULT false,
  pediatric_contraindicated BOOLEAN NOT NULL DEFAULT false,
  pregnancy_category TEXT CHECK (pregnancy_category IN ('A', 'B', 'C', 'D', 'X')),
  kb_version TEXT NOT NULL DEFAULT '2026-08-01',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:90; SHA256 343da7c1c206343d5f43b4110804d01feafc08b2bb6c22a810037c99941de593


-- 2. Global Drug-Drug Interaction Knowledge Base
CREATE TABLE IF NOT EXISTS public.hc_drug_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Bidirectional: drug_a_code < drug_b_code (alphabetic) to prevent duplicates
  drug_a_code TEXT NOT NULL REFERENCES public.hc_drugs(drug_code) ON DELETE RESTRICT,
  drug_b_code TEXT NOT NULL REFERENCES public.hc_drugs(drug_code) ON DELETE RESTRICT,
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO')),
  enforcement TEXT NOT NULL CHECK (enforcement IN ('ABSOLUTE_BLOCK', 'BLOCK', 'ACKNOWLEDGE', 'INFORMATIONAL')),
  mechanism TEXT,                           -- 'CYP3A4 inhibition', 'QT prolongation', 'Additive bleeding risk'
  clinical_effect TEXT NOT NULL,
  management_guidance TEXT,
  evidence_level TEXT NOT NULL DEFAULT 'B' CHECK (evidence_level IN ('A', 'B', 'C')),
  source TEXT,                              -- 'Micromedex', 'Clinical Pharmacology', 'AHRQ'
  kb_version TEXT NOT NULL DEFAULT '2026-08-01',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Enforce canonical ordering (A ≤ B alphabetically) for bidirectional dedup
  CONSTRAINT unique_drug_interaction UNIQUE (drug_a_code, drug_b_code),
  CONSTRAINT drug_interaction_canonical_order CHECK (drug_a_code <= drug_b_code)
);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:121; SHA256 a7216e86df56d9219882d0f002f1606e7daadda500fb796a1034dbdfff1edef0


-- 3. Global Clinical Protocols (Contraindications by patient context)
CREATE TABLE IF NOT EXISTS public.hc_clinical_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_code TEXT NOT NULL UNIQUE,
  drug_code TEXT REFERENCES public.hc_drugs(drug_code) ON DELETE RESTRICT,
  drug_class TEXT,                          -- applies to entire drug class if drug_code is NULL
  contraindication_type TEXT NOT NULL CHECK (
    contraindication_type IN ('AGE', 'WEIGHT', 'RENAL', 'HEPATIC', 'PREGNANCY', 'PEDIATRIC', 'DOSE_LIMIT')
  ),
  condition_spec JSONB NOT NULL,            -- e.g. {"max_age_years": 65} or {"min_weight_kg": 40}
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO')),
  enforcement TEXT NOT NULL CHECK (enforcement IN ('ABSOLUTE_BLOCK', 'BLOCK', 'ACKNOWLEDGE', 'INFORMATIONAL')),
  guideline_source TEXT,
  kb_version TEXT NOT NULL DEFAULT '2026-08-01',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:148; SHA256 a0e70ca3436faf244e906c25b7fe1442fc1b06b24395e8810c8b6628ed7147dd


-- ============================================================================
-- PART 3: TENANT POLICY TABLES (RLS — customizable per tenant)
-- ============================================================================

-- 4. Tenant CDS Policy Overrides
-- Tenants may adjust global enforcement (e.g. BLOCK → ACKNOWLEDGE) for specific interactions
-- Constraint: Cannot downgrade ABSOLUTE_BLOCK to anything weaker
CREATE TABLE IF NOT EXISTS public.hc_tenant_cds_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  interaction_id UUID REFERENCES public.hc_drug_interactions(id) ON DELETE CASCADE,
  protocol_id UUID REFERENCES public.hc_clinical_protocols(id) ON DELETE CASCADE,
  override_enforcement TEXT NOT NULL
    CHECK (override_enforcement IN ('BLOCK', 'ACKNOWLEDGE', 'INFORMATIONAL')),
  -- ABSOLUTE_BLOCK cannot appear here — it cannot be overridden by any tenant
  override_reason TEXT NOT NULL,
  policy_version TEXT NOT NULL DEFAULT 'v1.0',
  approved_by TEXT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Only one active override per tenant per interaction/protocol
  CONSTRAINT unique_tenant_cds_policy UNIQUE (tenant_id, interaction_id, protocol_id),
  -- Must reference either an interaction or a protocol, not both and not neither
  CONSTRAINT cds_policy_target_check CHECK (
    (interaction_id IS NOT NULL AND protocol_id IS NULL) OR
    (interaction_id IS NULL AND protocol_id IS NOT NULL)
  )
);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:182; SHA256 a647c91387a4147bd70ef1a390029255c7e6347e6bd892b5c2fa2dcfb2cd867c


-- 5. Patient Allergies (Tenant-owned, encounter-referenced)
CREATE TABLE IF NOT EXISTS public.hc_patient_allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL,
  allergen_type TEXT NOT NULL CHECK (allergen_type IN ('DRUG', 'DRUG_CLASS', 'FOOD', 'ENVIRONMENT', 'CONTRAST')),
  allergen_code TEXT NOT NULL,             -- Drug ATC code, allergen identifier
  allergen_name TEXT NOT NULL,
  reaction_type TEXT NOT NULL CHECK (
    reaction_type IN ('ANAPHYLAXIS', 'ANGIOEDEMA', 'RASH', 'URTICARIA', 'GI', 'RESPIRATORY', 'OTHER')
  ),
  severity TEXT NOT NULL CHECK (severity IN ('LIFE_THREATENING', 'SEVERE', 'MODERATE', 'MILD')),
  onset_date DATE,
  recorded_by TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:240; SHA256 6500ee942dbe361fe7702e9653fb66ae59390425bca816cc5a008c2c9fad0621


-- 7. CDS Override Audit (Immutable — physicians justifying overrides)
CREATE TABLE IF NOT EXISTS public.hc_order_cds_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.hc_clinical_orders(id) ON DELETE CASCADE,
  cds_alert_id TEXT NOT NULL,              -- UUID from CdsAlert.alertId
  alert_type TEXT NOT NULL CHECK (alert_type IN ('DRUG_INTERACTION', 'ALLERGY', 'PROTOCOL')),
  alert_severity TEXT NOT NULL CHECK (alert_severity IN ('CRITICAL', 'WARNING', 'INFO')),
  alert_enforcement TEXT NOT NULL CHECK (alert_enforcement IN ('BLOCK', 'ACKNOWLEDGE', 'INFORMATIONAL')),
  -- ABSOLUTE_BLOCK cannot appear in overrides — it is physically impossible to override
  override_reason TEXT NOT NULL,
  overriding_clinician TEXT NOT NULL,
  overridden_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:1; SHA256 cb5d50bc64e82a0cdc6b8db4cc8a4e246d1e3790f0687a3720b7b27b85f2baf7
-- ============================================================================
-- Bella Healthcare Platform — Phase H8: Clinical Decision Support (CDS) Schema
-- Migration: 20260813000000_create_h8_cds_schema.sql
-- Governance: H8-01 through H8-10 Architecture Laws
-- ============================================================================

-- 1. CLINICAL CONTEXT SNAPSHOTS (Read Model)
CREATE TABLE IF NOT EXISTS public.hc_clinical_context_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL,
    allergies JSONB DEFAULT '[]'::jsonb NOT NULL,
    active_medications JSONB DEFAULT '[]'::jsonb NOT NULL,
    lab_results JSONB DEFAULT '[]'::jsonb NOT NULL,
    vital_signs JSONB DEFAULT '[]'::jsonb NOT NULL,
    diagnoses JSONB DEFAULT '[]'::jsonb NOT NULL,
    active_orders JSONB DEFAULT '[]'::jsonb NOT NULL,
    last_processed_event_at TIMESTAMPTZ,
    last_event_id UUID,
    last_event_sequence BIGINT,
    projection_version INT DEFAULT 1 NOT NULL,
    projection_status TEXT DEFAULT 'UNAVAILABLE' CHECK (projection_status IN ('FRESH', 'STALE', 'UNAVAILABLE', 'ERROR')) NOT NULL,
    projection_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_tenant_encounter UNIQUE (tenant_id, encounter_id)
);

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:34; SHA256 d0a4c97dddc5f09fe776d2fb6364546c8640c75779cc9a8bbef775caf5e4e907


-- 2. DEDUPLICATION LOG (Processed Events)
CREATE TABLE IF NOT EXISTS public.hc_cds_processed_events (
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT DEFAULT 'processed' CHECK (status IN ('processed', 'skipped_out_of_order')) NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    projection_version INT NOT NULL,
    CONSTRAINT pk_hc_cds_processed_events PRIMARY KEY (tenant_id, event_id)
);

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:48; SHA256 fd8867d3798059f3057c0a26ac34207f972016a7efdd3388ba6e54218b2d8568


-- 3. VERSIONED CLINICAL RULES
CREATE TABLE IF NOT EXISTS public.hc_cds_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    rule_code TEXT NOT NULL,
    rule_version TEXT NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('ALLOW', 'WARNING', 'BLOCK')),
    enforcement TEXT NOT NULL CHECK (enforcement IN ('OVERRIDABLE', 'ABSOLUTE_BLOCK')),
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    rule_checksum TEXT NOT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_tenant_rule_code_version UNIQUE (tenant_id, rule_code, rule_version)
);

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:68; SHA256 4bfbf3b47836c6805ab267b8d3ee8ff61116c9a94f09986e5a4269e28e6156c2


-- 4. IMMUTABLE CLINICAL DECISIONS LOG
CREATE TABLE IF NOT EXISTS public.hc_clinical_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL,
    rule_id UUID NOT NULL REFERENCES public.hc_cds_rules(id) ON DELETE CASCADE,
    rule_version TEXT NOT NULL,
    rule_checksum TEXT NOT NULL,
    context_snapshot_version INT NOT NULL,
    input_snapshot JSONB NOT NULL,
    action_context JSONB NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('ALLOW', 'WARNING', 'BLOCK')),
    enforcement TEXT NOT NULL CHECK (enforcement IN ('OVERRIDABLE', 'ABSOLUTE_BLOCK')),
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    reasoning TEXT,
    evaluator_version TEXT NOT NULL,
    evaluation_fingerprint TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_tenant_evaluation_fingerprint UNIQUE (tenant_id, evaluation_fingerprint)
);

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:93; SHA256 5c40e6575c7add3e88d4baa13c7c221c1ee5439a432362b2879fc27e4bfaa61b


-- 5. IMMUTABLE DECISION OVERRIDES
CREATE TABLE IF NOT EXISTS public.hc_decision_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    original_decision_id UUID NOT NULL REFERENCES public.hc_clinical_decisions(id) ON DELETE CASCADE UNIQUE,
    clinician_id TEXT NOT NULL,
    clinician_role TEXT NOT NULL,
    reason TEXT NOT NULL,
    rule_version TEXT NOT NULL,
    decision_result TEXT NOT NULL,
    authorization_context JSONB,
    policy_version TEXT NOT NULL,
    override_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SOURCE supabase/migrations/20260813000009_temporal_engine_tables.sql:4; SHA256 66ee76ad37993f3714c464b58527821f6105e717b0a3398c74d84263997f5f61


-- 1. Create hc_temporal_events table (Append-only bitemporal log)
CREATE TABLE IF NOT EXISTS public.hc_temporal_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    encounter_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    valid_time TIMESTAMPTZ NOT NULL,
    transaction_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence_number BIGINT NOT NULL,
    delta_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SOURCE supabase/migrations/20260813000009_temporal_engine_tables.sql:31; SHA256 947ce5930062c92d78657c2fdb5237d9eb35a79188e3057129ded5fcbf3e08b1



-- 2. Create hc_temporal_snapshots table (Checkpoint read models)
CREATE TABLE IF NOT EXISTS public.hc_temporal_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    encounter_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    snapshot_version BIGINT NOT NULL,
    as_of_valid_time TIMESTAMPTZ NOT NULL,
    as_of_transaction_time TIMESTAMPTZ NOT NULL,
    reconstructed_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SOURCE supabase/migrations/20260813000010_rule_governance_tables.sql:4; SHA256 aa298adc9e95227cd0d83921cece4da8f5c5cff38e8e5652e26fb52247723ad6


-- 1. Create hc_governed_clinical_rules table
CREATE TABLE IF NOT EXISTS public.hc_governed_clinical_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    rule_code TEXT NOT NULL,
    rule_version TEXT NOT NULL,
    jurisdiction_code TEXT NOT NULL DEFAULT 'LOCAL',
    status TEXT NOT NULL CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'ACTIVE', 'SUPERSEDED', 'RETIRED')),
    severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO', 'LOW')),
    enforcement TEXT NOT NULL CHECK (enforcement IN ('ABSOLUTE_BLOCK', 'BLOCK', 'ACKNOWLEDGE', 'INFORMATIONAL')),
    conditions_dsl JSONB NOT NULL DEFAULT '{}'::jsonb,
    rule_checksum TEXT NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ,
    author_id TEXT NOT NULL,
    reviewer_id TEXT,
    approver_id TEXT,
    approver_role TEXT,
    approval_evidence JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SOURCE supabase/migrations/20260813000010_rule_governance_tables.sql:33; SHA256 91e76d0b8e492826f35a5add0097a2c1c254b77c3a5eed857245261b1d07f9e8



-- 2. Create hc_rule_governance_audit table (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS public.hc_rule_governance_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    rule_id UUID NOT NULL,
    action TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    role TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    change_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SOURCE supabase/migrations/20260813000011_clinical_audit_tables.sql:4; SHA256 0a82e91c4e0d9d0f5305d8570492524fd91e45fdba7778308e7ccdcec315ce42


-- 1. Create hc_clinical_audit_ledger table (Immutable Audit Ledger)
CREATE TABLE IF NOT EXISTS public.hc_clinical_audit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    encounter_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    performer_id TEXT NOT NULL,
    performer_role TEXT NOT NULL,
    h8_decision_id UUID,
    h9_snapshot_id UUID,
    h10_rule_code TEXT,
    h10_rule_version TEXT,
    h10_rule_checksum TEXT,
    compliance_status TEXT NOT NULL CHECK (compliance_status IN ('COMPLIANT', 'NON_COMPLIANT', 'EXCEPTION', 'REQUIRES_REVIEW')),
    evidence_integrity TEXT NOT NULL CHECK (evidence_integrity IN ('COMPLETE', 'PARTIAL', 'BROKEN', 'UNVERIFIABLE')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SOURCE supabase/migrations/20260813000011_clinical_audit_tables.sql:30; SHA256 2ee334a3521736188346ea6e54d739ab63aff651cc915a4c69b048bceaab6b2d



-- 2. Create hc_clinical_evidence_packages table (Immutable Evidence Packages)
CREATE TABLE IF NOT EXISTS public.hc_clinical_evidence_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    audit_id UUID NOT NULL UNIQUE REFERENCES public.hc_clinical_audit_ledger(id) ON DELETE CASCADE,
    schema_version TEXT NOT NULL DEFAULT '1.0.0',
    source_references JSONB NOT NULL DEFAULT '{}'::jsonb,
    canonical_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    fingerprint TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SOURCE supabase/migrations/20260813000011_clinical_audit_tables.sql:46; SHA256 16ff2c866f24405edada1d86797df4674fb6bb58b7ec7ae43930b4e0a71cbe73



-- 3. Create hc_compliance_exceptions table (Immutable Exceptions & Overrides Ledger)
CREATE TABLE IF NOT EXISTS public.hc_compliance_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    audit_id UUID NOT NULL UNIQUE REFERENCES public.hc_clinical_audit_ledger(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL,
    enforcement_level TEXT NOT NULL,
    override_reason TEXT NOT NULL,
    overridden_by TEXT NOT NULL,
    overrider_role TEXT NOT NULL,
    authorized BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SOURCE supabase/migrations/20260806030000_healthcare_kernel_schema.sql:30; SHA256 1b1bce9f70249184b73b936150ff8e5c1d520c4c2a4ec85bbceff8785a34b024


CREATE INDEX IF NOT EXISTS idx_hc_encounters_tenant ON public.hc_encounters(tenant_id);

-- SOURCE supabase/migrations/20260806030000_healthcare_kernel_schema.sql:32; SHA256 224a97acdf0a8cc665f806b92c36add79c0ab77ef3fadc9242c34863ae6ff0a9

CREATE INDEX IF NOT EXISTS idx_hc_encounters_journey ON public.hc_encounters(care_journey_id);

-- SOURCE supabase/migrations/20260806030000_healthcare_kernel_schema.sql:33; SHA256 c88997db6368d5dc74b5c12fa6f0303e5047c49958476ffd1a5c433bcfe9ed16

CREATE INDEX IF NOT EXISTS idx_hc_encounters_patient ON public.hc_encounters(patient_party_id);

-- SOURCE supabase/migrations/20260806030000_healthcare_kernel_schema.sql:34; SHA256 7b30698ccf7297a34f1207bc1e25428887d77d24fb676f244f3c67a71c24644d

CREATE INDEX IF NOT EXISTS idx_hc_encounters_doctor ON public.hc_encounters(doctor_party_id);

-- SOURCE supabase/migrations/20260806030000_healthcare_kernel_schema.sql:35; SHA256 86977cbbd4c0483c33d7c915825d5334eb387eaff844b57ba8e2a69ccca0a186

CREATE INDEX IF NOT EXISTS idx_hc_encounters_deleted ON public.hc_encounters(deleted_at) WHERE deleted_at IS NULL;

-- SOURCE supabase/migrations/20260806030000_healthcare_kernel_schema.sql:56; SHA256 c50e97b31e1d061b01510bfbb9a3e892f6b2afbc99ae59d1e0fdb768bad77ace


CREATE INDEX IF NOT EXISTS idx_hc_prescriptions_tenant ON public.hc_prescriptions(tenant_id);

-- SOURCE supabase/migrations/20260806030000_healthcare_kernel_schema.sql:58; SHA256 1af62403695786a6de14a3c4adc9c2549011601c9ce524de710bdc2c71eacb74

CREATE INDEX IF NOT EXISTS idx_hc_prescriptions_encounter ON public.hc_prescriptions(encounter_id);

-- SOURCE supabase/migrations/20260806030000_healthcare_kernel_schema.sql:59; SHA256 e0119eee38e337274e033dd103a847383e4b0fbfccc698256e128c7690ff8d27

CREATE INDEX IF NOT EXISTS idx_hc_prescriptions_patient ON public.hc_prescriptions(patient_party_id);

-- SOURCE supabase/migrations/20260806030000_healthcare_kernel_schema.sql:77; SHA256 09f06aaae5c41ad5dec4b04d0713a8c8884b23f64e25c8492105a0aa4da1f1b0


-- 4. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.hc_encounters ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260806030000_healthcare_kernel_schema.sql:80; SHA256 ff98e61cca49cb2dba55241f3e82b40c3b74b027a46fb26d76b5783dc213e782

ALTER TABLE public.hc_prescriptions ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260806030000_healthcare_kernel_schema.sql:82; SHA256 6112b6d27c9fd471999860829c1ea23c39ad6a4dd7d4c7ec946b8d259ae51ce5


-- 5. CREATE RLS TENANT ISOLATION POLICIES
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_encounters' AND policyname = 'tenant_isolation_hc_encounters') THEN
    CREATE POLICY tenant_isolation_hc_encounters ON public.hc_encounters FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- SOURCE supabase/migrations/20260806030000_healthcare_kernel_schema.sql:90; SHA256 433f0034645ee3ad50c63f0a17578991cfecfef9a6966ada03ca38dfff167df6


DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_prescriptions' AND policyname = 'tenant_isolation_hc_prescriptions') THEN
    CREATE POLICY tenant_isolation_hc_prescriptions ON public.hc_prescriptions FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:27; SHA256 824640436628c4363f71c5d6e2d22f2900d410990e2fb5fac37fa2af781bc046


CREATE INDEX IF NOT EXISTS idx_patient_profiles_tenant ON public.patient_profiles(tenant_id);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:29; SHA256 6e1ad11f544c4686e064af7605dcb20aba4401dc51f040b133b89b95aaa63dbb

CREATE INDEX IF NOT EXISTS idx_patient_profiles_customer ON public.patient_profiles(customer_id);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:30; SHA256 59d2e9c31c0ac20b1303e1285988de81adf3fe0e8c28dbfd73f3c81e981462ef

CREATE INDEX IF NOT EXISTS idx_patient_profiles_bhyt ON public.patient_profiles(bhyt_code);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:70; SHA256 651be240ecdec378162b272ee65af5790fc49bee8074501e8e16dbb5c9879b3f


CREATE INDEX IF NOT EXISTS idx_hc_lab_orders_tenant ON public.hc_lab_orders(tenant_id);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:72; SHA256 024e57fc5bcc557b39ff1741c9c1d3230a11fc18b345937a98c0e27ca62bca10

CREATE INDEX IF NOT EXISTS idx_hc_lab_orders_clinical ON public.hc_lab_orders(clinical_order_id);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:73; SHA256 f3848eeb12a2472c0f072edf96e917c795c157b45d3b26e9efd2c173ac3728cc

CREATE INDEX IF NOT EXISTS idx_hc_lab_orders_encounter ON public.hc_lab_orders(encounter_id);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:90; SHA256 a569be69bab7e424ebd23dbe3145c1ea653a6281d3a07e6a6f346d46cb22a6e1


CREATE INDEX IF NOT EXISTS idx_hc_imaging_orders_tenant ON public.hc_imaging_orders(tenant_id);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:92; SHA256 9b32452fdedffb6fbb7455c1cdd8e6ced68760ffb407720e7ddf171d76855886

CREATE INDEX IF NOT EXISTS idx_hc_imaging_orders_clinical ON public.hc_imaging_orders(clinical_order_id);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:109; SHA256 a97d302d72d2b8f09555ea6dd49de479a0200b4dfb2e3016eab9830eb072f609


CREATE INDEX IF NOT EXISTS idx_hc_drug_profiles_tenant ON public.hc_drug_profiles(tenant_id);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:111; SHA256 f0d11ef8a103920c3faad547da1db60c0ed8a6f69557d62793a2babaca12bbb4

CREATE INDEX IF NOT EXISTS idx_hc_drug_profiles_item ON public.hc_drug_profiles(inventory_item_id);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:126; SHA256 bd7da70ef59307f7b0b1fd3074bbb81ceea5c6a17d790ef3578c0fb687c29461


CREATE INDEX IF NOT EXISTS idx_hc_patient_queues_tenant ON public.hc_patient_queues(tenant_id);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:128; SHA256 0e782b94fce750062e924dc507277c5e2e88fb829d5ab20f6304a068b0dc59ca

CREATE INDEX IF NOT EXISTS idx_hc_patient_queues_encounter ON public.hc_patient_queues(encounter_id);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:129; SHA256 69de793bf5c03459665ec19c2a31af8af4092eba24c00a73a23ee54d130f1d85

CREATE INDEX IF NOT EXISTS idx_hc_patient_queues_station ON public.hc_patient_queues(tenant_id, current_station, status);

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:130; SHA256 51a8c0936e3f72090ab2a4bc11a46c4f89cc83ecf4d34bd2edd23f8eec87ccac


-- 7. ENABLE RLS
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:134; SHA256 d6b609ec4b41cc4b3e82e1dc19205dcb812f1caed9b0202b2b0ba81fd99a1be6

ALTER TABLE public.hc_lab_orders ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:135; SHA256 92370b790b93d49f67c23f639e37a98dd4090c871ef443b0caf38fe962259d35

ALTER TABLE public.hc_imaging_orders ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:136; SHA256 9e3638ac045a246586fcd4791c00f8503e9014393e715a9cc6c5581cbe7aef4f

ALTER TABLE public.hc_drug_profiles ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:137; SHA256 bfab593631e0c9e2a3c485cd32f03981c5d4c71668d0fb68267a154dd070ed3f

ALTER TABLE public.hc_patient_queues ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:138; SHA256 4709eb450d6b3c59128eb743a326bb7be618f09f23815cbafc276931faf67167


-- 8. CREATE RLS POLICIES (Tenant Isolation)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'patient_profiles' AND policyname = 'tenant_isolation_patient_profiles') THEN
    CREATE POLICY tenant_isolation_patient_profiles ON public.patient_profiles
        FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:155; SHA256 5175182f03cc76f9fddc3a2dcdc7a472a1afceaabb252125da36fa5e69ec99b7


DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_lab_orders' AND policyname = 'tenant_isolation_hc_lab_orders') THEN
    CREATE POLICY tenant_isolation_hc_lab_orders ON public.hc_lab_orders
        FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:163; SHA256 d6fd72deaf84fd3cb7de3b5583b68e54bac6948928748de75c154542fb685a4a


DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_imaging_orders' AND policyname = 'tenant_isolation_hc_imaging_orders') THEN
    CREATE POLICY tenant_isolation_hc_imaging_orders ON public.hc_imaging_orders
        FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:171; SHA256 ac18ebd2d34b612ece1af4114d28a18f0c152f50da427177ef411fc8615efb2e


DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_drug_profiles' AND policyname = 'tenant_isolation_hc_drug_profiles') THEN
    CREATE POLICY tenant_isolation_hc_drug_profiles ON public.hc_drug_profiles
        FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- SOURCE supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql:179; SHA256 7351aaafb7ac73d5bbd343b5b46b51523fd438b8029ffeebe7fa148367cfea39


DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_patient_queues' AND policyname = 'tenant_isolation_hc_patient_queues') THEN
    CREATE POLICY tenant_isolation_hc_patient_queues ON public.hc_patient_queues
        FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- SOURCE supabase/migrations/20260807010000_add_doctor_notification_to_lab.sql:1; SHA256 67b86dd2b2a1f4f3dba45255cccdb5f00c5c4d884b83cae5703951bebb5059d8
-- Add doctor notification columns to hc_lab_orders for LIS CAP/JCI Audit Log persistence
ALTER TABLE public.hc_lab_orders 
ADD COLUMN IF NOT EXISTS doctor_notified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS doctor_notified_time TEXT;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:145; SHA256 2a4a32d6ae0e9532615ee34360f609740d7db7c60a4a63a55b23c937a2e5d68b


-- Indexing for High Performance Querying
CREATE INDEX IF NOT EXISTS idx_hc_mpi_tenant_mrn ON public.hc_master_patient_index(tenant_id, mrn_code);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:148; SHA256 4b798697d225305efe9ca90ce679a645f2c7a0c43503a20772d46127c32750cb

CREATE INDEX IF NOT EXISTS idx_hc_beds_ward_status ON public.hc_beds(ward_id, status);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:149; SHA256 03bdd275296ca59485bfefe3e9c6a0e9c08ba24d9e7ffdfc0ca6898f8cb13f74

CREATE INDEX IF NOT EXISTS idx_hc_admissions_patient_status ON public.hc_inpatient_admissions(patient_id, status);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:150; SHA256 42609da4741e4645026ac904e5fa812c18a5f661009068cdbdb7919205f11c86

CREATE INDEX IF NOT EXISTS idx_hc_vitals_admission ON public.hc_nursing_vital_signs(inpatient_admission_id);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:151; SHA256 40f3168cac1e74c90fc706083e9de2971443ae1b5b6ecf13c9c4c31f6dad312f

CREATE INDEX IF NOT EXISTS idx_hc_mar_admission_scheduled ON public.hc_medication_administration_records(inpatient_admission_id, scheduled_time);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:152; SHA256 d7183233d7c0bcf621f31fbab8a506138b921cb012add0712af543925f75c620

CREATE INDEX IF NOT EXISTS idx_hc_break_glass_tenant ON public.hc_security_break_glass_logs(tenant_id, activated_at);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:153; SHA256 bf34da174ac4a04c02763da35f96b4ced452ed06d781ecc4950b3b0fc99be3aa


-- RLS Policies Enabling
ALTER TABLE public.hc_master_patient_index ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:156; SHA256 3c9c4542d3f65c82521dc46c2869b38f97a2e483d19719f1723cbfc056912dad

ALTER TABLE public.hc_buildings ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:157; SHA256 c71fa0dc10631f4eb31d30d7a267462a21763c1ca2f54de6a9d91cf24eb3054d

ALTER TABLE public.hc_wards ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:158; SHA256 986603c75b5494ec1455e96ec6747c37fc5c9a96930f00a5573d222f881dead5

ALTER TABLE public.hc_rooms ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:159; SHA256 7bdcc10daee65682dcab79d28d9cd143e5b37eb3ce8a037e6f4d89d16d91d1eb

ALTER TABLE public.hc_beds ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:160; SHA256 f3d041ad6fa6ef3f533f52366a27e9517fc4857b8ece27941110a57cea883c6f

ALTER TABLE public.hc_inpatient_admissions ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:161; SHA256 9c7a3a095fde6b7b7c86982bb8de1a00ed421e276e35ecb6452db65d211d7c31

ALTER TABLE public.hc_nursing_vital_signs ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:162; SHA256 c72025fac97629514b77927d15fc6cc015009b909c0bb4b2587e38db484149d5

ALTER TABLE public.hc_medication_administration_records ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:163; SHA256 edf087b2ef57fa28ff0967df65e75e6c7feff550f4731f5623fa4a853a69e6d7

ALTER TABLE public.hc_security_break_glass_logs ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:164; SHA256 ffa1ceacfc751e0342fcfc11f6daa1e02c276ef451c66b29a1971ce55984b714

ALTER TABLE public.hc_enterprise_registries ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:165; SHA256 e1380809fac799668b7e636717e5e17aac690e07303328e2156cbe2b0f56abe1


-- Permissive Tenant-Aware RLS Policies
DROP POLICY IF EXISTS "hc_mpi_tenant_policy" ON public.hc_master_patient_index;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:168; SHA256 c72c28b8904189c6fe26435b5f41c3a3ad57c1c163cce41fd06d3fe80b813803

CREATE POLICY "hc_mpi_tenant_policy" ON public.hc_master_patient_index FOR ALL USING (true);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:169; SHA256 3fe1d39031de5f1cca9a531f92f19bad4ad6f3d867cd2e446df20e1b787d6378


DROP POLICY IF EXISTS "hc_buildings_tenant_policy" ON public.hc_buildings;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:171; SHA256 129ee338b2f4ca675b63a3e7d0fadb175582b0b16fdd11fbc7782a97d89c81a3

CREATE POLICY "hc_buildings_tenant_policy" ON public.hc_buildings FOR ALL USING (true);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:172; SHA256 6b488780cf97949ed8f93c92eeb97dd60fed1f578456df735a1a3ff8e6c6fceb


DROP POLICY IF EXISTS "hc_wards_tenant_policy" ON public.hc_wards;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:174; SHA256 3dd80bf15c1d308a966e30789034c2bdded0cfadb530738ec2c9f9b72b251f1d

CREATE POLICY "hc_wards_tenant_policy" ON public.hc_wards FOR ALL USING (true);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:175; SHA256 2b438f8b320b282a013d5e6ed74ab629343af3e85d6263e424bdbd0381f97866


DROP POLICY IF EXISTS "hc_rooms_tenant_policy" ON public.hc_rooms;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:177; SHA256 8c2bd736260742c84dcfed5301014fb7a5c5f5e628bc7ea5c48ee69e06024afb

CREATE POLICY "hc_rooms_tenant_policy" ON public.hc_rooms FOR ALL USING (true);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:178; SHA256 54a2ce880a899cd639a2c3db2d35c5bdaa8a4024bb0e5a8dbcdebc30672ea459


DROP POLICY IF EXISTS "hc_beds_tenant_policy" ON public.hc_beds;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:180; SHA256 42f8615f8c543df294ee35e5acff3c9a6a6f973dcd19faeff12bb59617f08205

CREATE POLICY "hc_beds_tenant_policy" ON public.hc_beds FOR ALL USING (true);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:181; SHA256 50f395667880416e0da1afc2317aab3fe92a28cce7fdf7efb2f1a34786d86d3a


DROP POLICY IF EXISTS "hc_admissions_tenant_policy" ON public.hc_inpatient_admissions;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:183; SHA256 98b13fc068cc13fc1142b054824bd4f7f28ad0699adf4e0255b832f90be6fa5a

CREATE POLICY "hc_admissions_tenant_policy" ON public.hc_inpatient_admissions FOR ALL USING (true);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:184; SHA256 e798cd9b9a1a89555de225ae65bc59413551f37c7f84b993c2d54a1bf0c432a6


DROP POLICY IF EXISTS "hc_vitals_tenant_policy" ON public.hc_nursing_vital_signs;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:186; SHA256 eae3fa26be87d526fbfe22879429354fc0348be02b330e18424a46af59554c28

CREATE POLICY "hc_vitals_tenant_policy" ON public.hc_nursing_vital_signs FOR ALL USING (true);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:187; SHA256 55d77aee93b7366cce143fd14dba2e09e130bd5b10b3487e1eb1fba5fbc1456a


DROP POLICY IF EXISTS "hc_mar_tenant_policy" ON public.hc_medication_administration_records;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:189; SHA256 d875732c37a13fe533ac70f8a28ed97dda4f0253b1dd6824e380460fb129f02c

CREATE POLICY "hc_mar_tenant_policy" ON public.hc_medication_administration_records FOR ALL USING (true);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:190; SHA256 004520f9e04ea46bfe1303471a3972145e1f9af317c8d4aad3fd7ea8e03130fd


DROP POLICY IF EXISTS "hc_break_glass_tenant_policy" ON public.hc_security_break_glass_logs;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:192; SHA256 0b009c5aa3a70f01b48a71dd2169dbd0ddb72bcef23371f7d533792e4a03a48b

CREATE POLICY "hc_break_glass_tenant_policy" ON public.hc_security_break_glass_logs FOR ALL USING (true);

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:193; SHA256 d7e2e29854b2d1d5641f9e21e101a3b304c358a6504d33e5ce80c3d33f93692c


DROP POLICY IF EXISTS "hc_registries_tenant_policy" ON public.hc_enterprise_registries;

-- SOURCE supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:195; SHA256 265f5478601cb33f6e89cf953a7f4ecfac23239a8fdb261f0173f4a4cc4b0cf8

CREATE POLICY "hc_registries_tenant_policy" ON public.hc_enterprise_registries FOR ALL USING (true);

-- SOURCE supabase/migrations/20260807040000_add_completed_at_to_hc_encounters.sql:1; SHA256 05cce5b73bd62cc8c72b93a00de06688d5e0ce79d2360ccdb07efc288beae45c
-- Add completed_at column to hc_encounters table
ALTER TABLE public.hc_encounters 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- SOURCE supabase/migrations/20260807040000_add_completed_at_to_hc_encounters.sql:3; SHA256 1993aa8d29eca45781f7b2b7d92c028b8e9af4b76ca52a285379b7cee3602eb1


-- Update status check constraint to include 'completed'
ALTER TABLE public.hc_encounters DROP CONSTRAINT IF EXISTS hc_encounters_status_check;

-- SOURCE supabase/migrations/20260807040000_add_completed_at_to_hc_encounters.sql:6; SHA256 8c552185adf1a1fd180f38dc0465a04acaee06f7c0c7d5ddafe93021113b28ec

ALTER TABLE public.hc_encounters ADD CONSTRAINT hc_encounters_status_check 
CHECK (status IN ('planned', 'arrived', 'triaged', 'in_progress', 'finished', 'completed', 'cancelled'));

-- SOURCE supabase/migrations/20260807050000_add_status_to_hc_prescriptions.sql:1; SHA256 7f5785bfded2d18f603e4299db6830ad1be17ef6446543b8f1eae1f492828cd9
-- ============================================================================
-- Bella Healthcare Platform — Add Status Column to public.hc_prescriptions
-- Migration: 20260807050000_add_status_to_hc_prescriptions.sql
-- ============================================================================

ALTER TABLE public.hc_prescriptions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_review';

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:37; SHA256 f3e8c9412e6f2ffd29936aca26b0d9f2467341c152dbea95a753a6381618b322


-- Encounter type (derived from encounter_class)
ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS encounter_type TEXT;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:41; SHA256 e6907dc487776bec8ac88c812af8e473f01d19eb2377a78179b7dce191a658a2


-- Period boundaries (canonical temporal model)
ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:45; SHA256 9afe269ca4db6d301516962b23031835ef60fa00264dfc0a8f2aa31b5c9fd07a


ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:48; SHA256 1ba7f55518983a6512658d9131585bba5cb56a682ed235997d99eb89db2ade3a


-- Hierarchy
ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS parent_encounter_id UUID
  REFERENCES public.hc_encounters(id) ON DELETE SET NULL;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:53; SHA256 35f43076de924334306b7f2bff5edcedbd61b60eddd38343e76e04be3ba3b28f


-- Location/Department
ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS department_id UUID;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:57; SHA256 008968a64f45a3c6b83b55478ab395f1c6922ae808397dbb9b4728d2f03e090d


ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS location_id UUID;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:60; SHA256 1f7a4e0017b764549e995f1256caf940bd24159cfa510d9a17763141dfb5452e


-- Clinical data (structured)
ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS reason_code JSONB DEFAULT '[]'::jsonb;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:64; SHA256 31b5110d4b7cb609021b7b6241b4a7105e9ca52851126b40e71af70b58c767f3


ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS diagnosis JSONB DEFAULT '[]'::jsonb;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:67; SHA256 3bf4e9653b2c00407c0d886d4bda60dcf37d32ff4283ac194899b0bd9fc7fd4b


-- Metadata (preserve legacy fields)
ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:145; SHA256 6668ab0a596227cb82e2e3edfa9224de36de93570a99f124c05db2ef8a508be2


-- Temporarily allow BOTH old and new status values during migration
ALTER TABLE public.hc_encounters 
  DROP CONSTRAINT IF EXISTS hc_encounters_status_check;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:149; SHA256 b50522f755f848caeece55c42fc1bbac1d19f2b14d4da2ddef847223ec990d4a


ALTER TABLE public.hc_encounters 
  ADD CONSTRAINT hc_encounters_status_check
  CHECK (status IN ('planned', 'arrived', 'triaged', 'in_progress', 'in-progress', 'on-hold', 'finished', 'completed', 'cancelled'));

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:190; SHA256 e4eeed629ee083c57764d4fbfa7289d467a793a41f1dcef1a72c3aed0dfbd1df


-- Temporarily allow BOTH old and new encounter_class values during migration
ALTER TABLE public.hc_encounters 
  DROP CONSTRAINT IF EXISTS hc_encounters_encounter_class_check;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:194; SHA256 01a5a184c8d3902ce6c0ae5960847f7a368bb1462ebcd0dc1773ac311ff41cbc


ALTER TABLE public.hc_encounters 
  ADD CONSTRAINT hc_encounters_encounter_class_check
  CHECK (encounter_class IN ('walk_in', 'scheduled', 'emergency', 'telemedicine', 'follow_up', 'homecare', 'inpatient', 'AMB', 'EMER', 'IMP', 'HH', 'VR'));

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:240; SHA256 cfc20e1c365283f5bc82249cbe1a5044418e56e25317edee375f3df3b6e96869


COMMENT ON COLUMN public.hc_encounters.patient_party_id IS 
  'DEPRECATED: Use Encounter aggregate patientId property. Will be removed after Platform migration complete.';

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:243; SHA256 8fa9632655afe0f0aa0d22cc94be00a80c79771da0adfe14ff05d67a29abe9fc


COMMENT ON COLUMN public.hc_encounters.doctor_party_id IS 
  'DEPRECATED: Use serviceProviderId property. Will be removed after Platform migration complete.';

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:246; SHA256 69dbea8ffad2547edba36b417dd4089a89351d60936fad9ff83d132a6e36d4f6


COMMENT ON COLUMN public.hc_encounters.care_journey_id IS 
  'DEPRECATED: Preserved in metadata.legacyCareJourneyId. Medical Clinic concept, not Platform-wide.';

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:249; SHA256 83a6b6e9c9ac0bdbcb1363942c1d75e900151e5a3507e046d7f3be2a9b4ed8b4


COMMENT ON COLUMN public.hc_encounters.queue_number IS 
  'DEPRECATED: Preserved in metadata.queueNumber. Will use Smart Queue Engine in future.';

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:252; SHA256 4c8772776e77e748e3f4e13f6883c959eb36b06d4cd7dafb84a8ce9755fb5cb7


COMMENT ON COLUMN public.hc_encounters.chief_complaint IS 
  'DEPRECATED: Preserved in metadata.chiefComplaint. Use structured diagnosis field.';

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:255; SHA256 a1b8e9efb92e180f17d22da4ba679388a36edd06bc879de3758879025ad07862


COMMENT ON COLUMN public.hc_encounters.notes IS 
  'DEPRECATED: Preserved in metadata.clinicalNotes. Use structured diagnosis field.';

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:258; SHA256 5a2233ba78c43dea6c12a02e5a5fe0f6e9dc3d7e86dcdeff732b47d46f364697


COMMENT ON COLUMN public.hc_encounters.scheduled_at IS 
  'DEPRECATED: Preserved in metadata.legacyTemporal. Use period_start.';

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:261; SHA256 838992fec8b8fc13dabdc8bf75da5584818509d1b5914f6d81ac72986ce80f1e


COMMENT ON COLUMN public.hc_encounters.arrived_at IS 
  'DEPRECATED: Preserved in metadata.legacyTemporal.';

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:264; SHA256 e3ffb8f45af7a46380d9c1213c59827c608a467b8d682e84c018240b86f83940


COMMENT ON COLUMN public.hc_encounters.started_at IS 
  'DEPRECATED: Preserved in metadata.legacyTemporal.';

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:267; SHA256 89735e132b4b5dc0ddc9d2679b4b16dbc520cae355cdc11507e8e637ef3de9b8


COMMENT ON COLUMN public.hc_encounters.finished_at IS 
  'DEPRECATED: Preserved in metadata.legacyTemporal. Use period_end.';

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:270; SHA256 f398ecb638e93225d7b03c940ffcd29a876f2a9a34a910ef61c78f5aeca62e4e


COMMENT ON COLUMN public.hc_encounters.completed_at IS 
  'DEPRECATED: Preserved in metadata.legacyTemporal. Use period_end.';

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:287; SHA256 319f21e44a3bfbe3b5c4f1a1eb1aad816b5529b66464505c9bb9b12261619210


-- encounter_type NOT NULL
ALTER TABLE public.hc_encounters
  ALTER COLUMN encounter_type SET NOT NULL;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:291; SHA256 869d07dfe2775fa6d73422cb3e932ba047a3206221171aac21ea40e61fc71e55


-- period_start NOT NULL
ALTER TABLE public.hc_encounters
  ALTER COLUMN period_start SET NOT NULL;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:295; SHA256 6e023282305f85b8b6e06b6516b1144eb919ca98a582822cfe19e3bb1a79180c


-- Finalize status CHECK constraint (remove transition values)
ALTER TABLE public.hc_encounters 
  DROP CONSTRAINT IF EXISTS hc_encounters_status_check;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:299; SHA256 2446b597558a5ead152b0726fbb18234cc1b06653d833abcffcd54becec139ff


ALTER TABLE public.hc_encounters 
  ADD CONSTRAINT hc_encounters_status_check
  CHECK (status IN ('planned', 'arrived', 'triaged', 'in-progress', 'on-hold', 'finished', 'cancelled'));

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:303; SHA256 89e04ec1d1207c9e50ff2ba7e92055f7947f7f84b53c5619ec4e89629a5fc1c4


-- Finalize encounter_class CHECK constraint (remove transition values)
ALTER TABLE public.hc_encounters 
  DROP CONSTRAINT IF EXISTS hc_encounters_encounter_class_check;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:307; SHA256 dc3d3a9012a41e67561180d2c502b7b467906e2abb2eefbcc490b966a150a8ff


ALTER TABLE public.hc_encounters 
  ADD CONSTRAINT hc_encounters_encounter_class_check
  CHECK (encounter_class IN ('AMB', 'EMER', 'IMP', 'HH', 'VR'));

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:311; SHA256 9517bb856d569782bf0953dbce5f512f125670f3fbc27ae7d6853842934c02c8


-- Add CHECK constraint for encounter_type
ALTER TABLE public.hc_encounters 
  ADD CONSTRAINT hc_encounters_encounter_type_check
  CHECK (encounter_type IN ('outpatient', 'inpatient', 'emergency', 'home-health', 'virtual'));

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:316; SHA256 6d6454a058d3bc20ac7e54aa5aa99f82f0662f31fbd16f4b0756642d14d6c0b7


-- Add period validation (end >= start if end exists)
ALTER TABLE public.hc_encounters
  ADD CONSTRAINT hc_encounters_period_valid
  CHECK (period_end IS NULL OR period_end >= period_start);

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:335; SHA256 2e52e635436b45e71d79402c222be6d917e682005259efe5d1c2ea46bfe1c3ee


-- RLS already enabled from original migration (20260806030000)
-- Verify it's enabled
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'hc_encounters') THEN
    ALTER TABLE public.hc_encounters ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on hc_encounters';
  ELSE
    RAISE NOTICE 'RLS already enabled on hc_encounters';
  END IF;
END $$;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:347; SHA256 b75be98d59f9f84c3792e4864e784743ae0b80c486a0a09c075a76b059ec7ff4


-- Drop existing policies if any (clean slate)
DROP POLICY IF EXISTS tenant_isolation_select ON public.hc_encounters;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:350; SHA256 43c9f0e8b03102562bc7dc58db4dea717d1bae4679ec7cada7c87148497918f6

DROP POLICY IF EXISTS tenant_isolation_write ON public.hc_encounters;

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:351; SHA256 182cbf388bf614f4a85eee03c40b60b465adc224be4a945fc26db49bed34987e


-- Policy 1: Tenant isolation for SELECT
CREATE POLICY tenant_isolation_select ON public.hc_encounters
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- SOURCE supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql:356; SHA256 6b5090ac86a91a4c57fca6902e99f9e29617f6d6d97ba7bff6aeb49f44641ec0


-- Policy 2: Tenant isolation for INSERT/UPDATE/DELETE
CREATE POLICY tenant_isolation_write ON public.hc_encounters
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- SOURCE supabase/migrations/20260812010000_make_care_journey_id_nullable.sql:27; SHA256 a79f90d428c12b96d9fc12f2ff47496193e80665a6bcbce7a06efdbe25a4e8aa


-- Allow NULL values
ALTER TABLE public.hc_encounters
  ALTER COLUMN care_journey_id DROP NOT NULL;

-- SOURCE supabase/migrations/20260812010000_make_care_journey_id_nullable.sql:48; SHA256 667f8589d6ba8af30d04bd06569736398b34b0e1ed2900ab85b51587edda12f1


-- Update comment to reflect nullable status
COMMENT ON COLUMN public.hc_encounters.care_journey_id IS 
  'DEPRECATED: Preserved in metadata.legacyCareJourneyId. Medical Clinic concept, not Platform-wide. NULLABLE since 2026-08-12.';

-- SOURCE supabase/migrations/20260812020000_drop_care_journey_fk.sql:28; SHA256 f6bee278c3f322f97564339ab4013bac9e4d4619862343d41a8b949085e46300


-- Drop FK constraint
ALTER TABLE public.hc_encounters
  DROP CONSTRAINT IF EXISTS hc_encounters_care_journey_id_fkey;

-- SOURCE supabase/migrations/20260812020000_drop_care_journey_fk.sql:50; SHA256 e4932fa682ab73218430938a2610acd36e2cc33110b35a4b39d95d0c320846a7


-- Update comment to reflect FK removal
COMMENT ON COLUMN public.hc_encounters.care_journey_id IS 
  'DEPRECATED: Preserved in metadata.legacyCareJourneyId. Medical Clinic concept, not Platform-wide. NULLABLE since 2026-08-12. FK removed 2026-08-12.';

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:21; SHA256 db1d67a479a2a2d5a4c1b48f785a271b3d977b4ff483c61951ea03b294973c5c


CREATE INDEX IF NOT EXISTS idx_hc_clinical_safety_profiles_tenant ON public.hc_clinical_safety_profiles(tenant_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:23; SHA256 04e9f20f68c289af07fca51bd59d5262ed1372f7b149abe26eaa2410546e9052


CREATE OR REPLACE FUNCTION public.block_clinical_safety_profile_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'hc_clinical_safety_profiles table is read-only. Mutation is blocked.';
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:30; SHA256 18a905faa0a05e6af3def32d1c6df08f8a3a3dac3e389f47f4cea59d524a6d83


CREATE TRIGGER trigger_block_safety_profile_mutation
BEFORE UPDATE OR DELETE ON public.hc_clinical_safety_profiles
FOR EACH ROW EXECUTE FUNCTION public.block_clinical_safety_profile_mutation();

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:44; SHA256 63a6db8a085e46f3437b515275ea0c0b5f29ad00ba28677168c88dff77f8be4a


CREATE INDEX IF NOT EXISTS idx_hc_idempotency_keys_lookup ON public.hc_idempotency_keys(tenant_id, request_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:58; SHA256 d8d8b728d7980d7540cce3fb9d0e22102bce6b9bae2d5a9b0c90d3b26147466c


CREATE INDEX IF NOT EXISTS idx_hc_operating_rooms_tenant ON public.hc_operating_rooms(tenant_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:77; SHA256 57542b225fd04721239cf76005248ec01c80319d8d7d8765bfa9562f66d3f87a


CREATE INDEX IF NOT EXISTS idx_hc_or_schedules_tenant ON public.hc_or_schedules(tenant_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:79; SHA256 08a23ddb8b33f9a417b34ccefcedeb62c35c35baf86d5dd1d237301cf601b597

CREATE INDEX IF NOT EXISTS idx_hc_or_schedules_room ON public.hc_or_schedules(operating_room_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:80; SHA256 c008bcbe9ea4009f073ea0c691f33cd7d3ba2846bbf7e032499eb9d0bdff0732

CREATE INDEX IF NOT EXISTS idx_hc_or_schedules_time ON public.hc_or_schedules USING gist (scheduled_time_range);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:93; SHA256 78c31b6afe1c6898bcd4c391bd6091f04c698bb9295ce1cb27833b878c4fbe0e


CREATE INDEX IF NOT EXISTS idx_hc_surgical_cases_tenant ON public.hc_surgical_cases(tenant_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:95; SHA256 968573a6b7d958d62ce81d55d5e759585c0e7a06426f2b875f576f8c02bc7bc9

CREATE INDEX IF NOT EXISTS idx_hc_surgical_cases_encounter ON public.hc_surgical_cases(encounter_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:108; SHA256 153112561c842427a635c9a0b50c7a7c1c4bd0a37688df78059d9942fe2cc4a8


CREATE INDEX IF NOT EXISTS idx_hc_surgical_teams_tenant ON public.hc_surgical_teams(tenant_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:110; SHA256 16b23371f3d995059d0c8f33c20f44c790f87c132040cf09d3ed80e992c93590

CREATE INDEX IF NOT EXISTS idx_hc_surgical_teams_case ON public.hc_surgical_teams(surgical_case_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:129; SHA256 94e436fd569362da7bda9c3d9da98b602311bd1567045e69bc7fac6b9ff81612


CREATE INDEX IF NOT EXISTS idx_hc_surgical_safety_checklists_tenant ON public.hc_surgical_safety_checklists(tenant_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:131; SHA256 2deb062069c663afec8fb0b2c92c8faf85a5481774c3c873517448d2fbc74b01

CREATE INDEX IF NOT EXISTS idx_hc_surgical_safety_checklists_case ON public.hc_surgical_safety_checklists(surgical_case_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:145; SHA256 16e8cc6e05352307bb91d4601c9450ce24cb0f1e2f124d6db794e397dc1cf125


CREATE INDEX IF NOT EXISTS idx_hc_anesthesia_records_tenant ON public.hc_anesthesia_records(tenant_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:147; SHA256 105a1782f492aeaf68a7791d18d5813c12da81caaeb008a4fa19dbdafc9980f5

CREATE INDEX IF NOT EXISTS idx_hc_anesthesia_records_case ON public.hc_anesthesia_records(surgical_case_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:159; SHA256 61828fb346248f08b543258651f5f51e5fd610c665f18ea4372286721828abb4


CREATE INDEX IF NOT EXISTS idx_hc_anesthesia_obs_tenant ON public.hc_anesthesia_observations(tenant_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:161; SHA256 1422dc1dc913de775a7c3207f45c80f5249dde3a712bb20ba9f64e597913243e

CREATE INDEX IF NOT EXISTS idx_hc_anesthesia_obs_record ON public.hc_anesthesia_observations(anesthesia_record_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:162; SHA256 f7fcc55a2fd2fac62a2e4f166113e65e8345049b87b5581181512a8f4a2dd590

CREATE INDEX IF NOT EXISTS idx_hc_anesthesia_obs_time ON public.hc_anesthesia_observations(observation_time DESC);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:177; SHA256 7f0cd6173e9d3fca8eb58eb9bd9ce3480076a02c60ef217837db5df1b88c6abb


CREATE INDEX IF NOT EXISTS idx_hc_anesthesia_meds_tenant ON public.hc_anesthesia_medications(tenant_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:179; SHA256 a5ba293fdc25f52c8bc20858266f1d429596ba31283d34eb9db5dc6166c1f663

CREATE INDEX IF NOT EXISTS idx_hc_anesthesia_meds_record ON public.hc_anesthesia_medications(anesthesia_record_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:195; SHA256 7df4ea24e98712eaa7941a4cdecbb42d4ee849b788d2585cda43443221627be6


CREATE INDEX IF NOT EXISTS idx_hc_pacu_admissions_tenant ON public.hc_pacu_admissions(tenant_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:197; SHA256 fecbb47edcb2051d6178805286d4602d94012a936ec3e97412f73c727e21afa3

CREATE INDEX IF NOT EXISTS idx_hc_pacu_admissions_case ON public.hc_pacu_admissions(surgical_case_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:212; SHA256 b27c06a3fa7b27f7d92a771d740730a19c5361047ac8c434d45fa4d488738ea0


CREATE INDEX IF NOT EXISTS idx_hc_specimens_tenant ON public.hc_specimens(tenant_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:214; SHA256 2f8e7375999bc966ed8ec2e0107b7b935dc0ac557b695e465a1f814321c9533c

CREATE INDEX IF NOT EXISTS idx_hc_specimens_case ON public.hc_specimens(surgical_case_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:226; SHA256 d86b2886d29ff1fb3b88d2828ca21caa342887bdb90533d3bf74f9a9cfb9b4c7


CREATE INDEX IF NOT EXISTS idx_hc_implants_tenant ON public.hc_implants(tenant_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:228; SHA256 886225160e9f1b27c42163d5ac5f486ab7df85175640eb870e8117fa11823df3

CREATE INDEX IF NOT EXISTS idx_hc_implants_case ON public.hc_implants(surgical_case_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:241; SHA256 ca9b5f919ecabaef787d812f2bd38318c0cce5482a48e21f6842545d309d2e7c


CREATE INDEX IF NOT EXISTS idx_hc_equipment_tenant ON public.hc_equipment(tenant_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:256; SHA256 8ca3a35fb12c832d3cdd281b414186b653f99ec3f87d6ddef1798a651cc7df2f


CREATE INDEX IF NOT EXISTS idx_hc_cssd_cycles_tenant ON public.hc_cssd_cycles(tenant_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:268; SHA256 1509ed896047b7473be009746e7868cedd96ff7330da609f5e44ab5dac04a9e5


CREATE INDEX IF NOT EXISTS idx_hc_cssd_cycle_items_tenant ON public.hc_cssd_cycle_items(tenant_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:270; SHA256 b34e5d2aeb749ea7a9d2fbc4e438558b33cb50f0a7bc5172205d7d8293152c72

CREATE INDEX IF NOT EXISTS idx_hc_cssd_cycle_items_cycle ON public.hc_cssd_cycle_items(cssd_cycle_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:283; SHA256 9adc871fcc3ba3b9cfc22e2c2a47f6d5af24d10752f21e508b1084e484051bea


CREATE INDEX IF NOT EXISTS idx_hc_or_equip_usage_tenant ON public.hc_or_equipment_usage(tenant_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:285; SHA256 598d1eb5eef31388847387ca5f1e305e11378f010dc8b54202c7176da37f2d6e

CREATE INDEX IF NOT EXISTS idx_hc_or_equip_usage_case ON public.hc_or_equipment_usage(surgical_case_id);

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:286; SHA256 9a3e4a12d608fb292cdf627aafaff6a6ff68e69615a5d327a1933acf7f8aeba9


-- ============================================================================
-- Row-Level Security (RLS) Configuration
-- ============================================================================

ALTER TABLE public.hc_clinical_safety_profiles ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:292; SHA256 8c245d232b49fdb499f8454ef0e5bb0156487c758f214e315a0ef52b208d521f

ALTER TABLE public.hc_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:293; SHA256 3fb1440ea33125998594c002c75bd26aab058027cb0c7251928666262e7de270

ALTER TABLE public.hc_operating_rooms ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:294; SHA256 95b1749658e8b19e504c3afaa5d92c0cc903ad65c5546a2a5d2c75f958fb714d

ALTER TABLE public.hc_or_schedules ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:295; SHA256 8a63171ac8d5b1ee732ad8b4760262f06a5b6e8479551a88d6b715243dcb6618

ALTER TABLE public.hc_surgical_cases ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:296; SHA256 dfe265ee922c16b2835b83a6491de18329dffc327c7dcb849ee04ca762f5b2fa

ALTER TABLE public.hc_surgical_teams ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:297; SHA256 d3e1d74118772a79592e389902202008843dcffe5e2e64c50bc6cd11ffa1acec

ALTER TABLE public.hc_surgical_safety_checklists ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:298; SHA256 75ea33bc4781302ebd17a1f7eceab8549dd995c3ef06a0c6928ac927fe45daba

ALTER TABLE public.hc_anesthesia_records ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:299; SHA256 097ba975bffb81279b56fb404b5a585ba29c027d5389cfe1085533c99e643987

ALTER TABLE public.hc_anesthesia_observations ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:300; SHA256 2ff9e351c0bf7e41d8536d05e621eda338e4640b67a1acf5080a4988ac9e0c12

ALTER TABLE public.hc_anesthesia_medications ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:301; SHA256 bcbcfdd2933a7fed63fa4e3809a073aa79701bbd7fe3b408c8ab2e8546475ff0

ALTER TABLE public.hc_pacu_admissions ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:302; SHA256 ba95473c60c1d9493c5e58f1892fb8fb4174a68a24ca58fb11a36076d2d29086

ALTER TABLE public.hc_specimens ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:303; SHA256 1c467eb3dcce9c606f3789ca4a9400c60d628b2c8a10ed159c3bd0d3c0293677

ALTER TABLE public.hc_implants ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:304; SHA256 3e1aec674104443f082540bd949006d765fb48b0a20a890ca5550f1cdf43a5f6

ALTER TABLE public.hc_equipment ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:305; SHA256 ecea0af1040721bb84e3b5184356f365ec4004d8976aa2fdceda65ec31bdab21

ALTER TABLE public.hc_cssd_cycles ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:306; SHA256 c63d3a6b3ac58f3437d818d46d0d850f0417a33c165a985139f3326680371c9f

ALTER TABLE public.hc_cssd_cycle_items ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:307; SHA256 475d427d59c151692c346c98052a50e845179948d32f1fc8646764c3fa1d57b2

ALTER TABLE public.hc_or_equipment_usage ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:308; SHA256 1badb0976ab0e36e80955e524b3de14801c2ebfe112e2118c939a6c54d08b3f1


-- Deny all SELECT, INSERT, UPDATE, DELETE permissions for public/anon roles
-- Exclude from policies (since policies apply to authenticated context by default)
-- Policies below are TO authenticated roles only.

-- 1. Safety Profiles
CREATE POLICY tenant_isolation_profiles ON public.hc_clinical_safety_profiles
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:316; SHA256 bdc2f95753a1775f9bd8a3aee5ad44ff5b58268aa1b84315f57e390ff3f39f4d


-- 2. Idempotency Keys
CREATE POLICY tenant_isolation_idempotency ON public.hc_idempotency_keys
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:320; SHA256 145bf9f6ae9a2b2d9b7a1d315a04965068d58088d79ad1f35e36e4902fc522ca


-- 3. Operating Rooms
CREATE POLICY tenant_isolation_rooms ON public.hc_operating_rooms
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:324; SHA256 ff408f9c649685c66d8d7d6d0a951516579a87c26c91adf790fabc4d72ff1d1d


-- 4. OR Schedules
CREATE POLICY tenant_isolation_schedules ON public.hc_or_schedules
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:328; SHA256 01d3811be519cf58bb347aeefecd5153ef1af81074fc67dd25bda5e97b715583


-- 5. Surgical Cases
CREATE POLICY tenant_isolation_cases ON public.hc_surgical_cases
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:332; SHA256 6362eaa2d0e2c05208ce24e413aa9cb6d51d30e7e061bc68745f9a63d804cb55


-- 6. Surgical Teams
CREATE POLICY tenant_isolation_teams ON public.hc_surgical_teams
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:336; SHA256 add6073a9f0522eb754a9063c4149ff1e69e87550cbed5e9f3bfabd9342a9667


-- 7. Safety Checklists
CREATE POLICY tenant_isolation_checklists ON public.hc_surgical_safety_checklists
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:340; SHA256 5cbd576e400ed149d95a5bce1baa393e0125e4409a64c728bb8abbfdb3f6e3e2


-- 8. Anesthesia Records
CREATE POLICY tenant_isolation_anesthesia ON public.hc_anesthesia_records
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:344; SHA256 81384d6e013795bba6b26cfcd7bb2a8bcc60e9e505d564578a1360bc2c8efc4f


-- 9. Anesthesia Observations
CREATE POLICY tenant_isolation_observations ON public.hc_anesthesia_observations
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:348; SHA256 616bb4f99c882a4dd14e233dcc6d609c107d15acd72c24d779300a87e02ba235


-- 10. Anesthesia Medications
CREATE POLICY tenant_isolation_medications ON public.hc_anesthesia_medications
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:352; SHA256 e8c8519b31d40f943b111552dde6f791990e31b54681a1725e9bf18dc914088b


-- 11. PACU Admissions
CREATE POLICY tenant_isolation_pacu ON public.hc_pacu_admissions
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:356; SHA256 76b6ce6de15a7574639dbc08648a6cb0138b0bad17c9be8757626290cae9628b


-- 12. Specimens
CREATE POLICY tenant_isolation_specimens ON public.hc_specimens
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:360; SHA256 1aa9362cc2bb86a907db20ccec591d2ed8babeadbfabd0f469f530f692ce38c6


-- 13. Implants
CREATE POLICY tenant_isolation_implants ON public.hc_implants
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:364; SHA256 97cec98aa1a2987062047af9a3c919223509dff73040b0c6007e66e6ed79f574


-- 14. Equipment
CREATE POLICY tenant_isolation_equipment ON public.hc_equipment
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:368; SHA256 e3830228aa225f3d03a5d8d04b837e59048c5ea4b4be09617a570221e60aa44b


-- 15. CSSD Cycles
CREATE POLICY tenant_isolation_cssd ON public.hc_cssd_cycles
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:372; SHA256 dd193d3ef366cbe98b0617b2e6bcb93f8295ed6f64c587a76496da54c471a4de


-- 16. CSSD Cycle Items
CREATE POLICY tenant_isolation_cssd_items ON public.hc_cssd_cycle_items
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000004_create_perioperative_platform.sql:376; SHA256 f9f8c4f80e69afe48b44dfc91a14027aefe80c3621d3363263029a9203c2e7be


-- 17. OR Equipment Usage
CREATE POLICY tenant_isolation_or_equip ON public.hc_or_equipment_usage
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:19; SHA256 2ccc36a822f220e7a49cbecb536e8595a28ec56823e6f3d14eeea31a0590893c


CREATE INDEX IF NOT EXISTS idx_hc_icu_beds_tenant ON public.hc_icu_beds(tenant_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:33; SHA256 f68a0743f3a6f2c968413fcf23311cd330e92e8e5bd2df44ed069ec5012feb66


CREATE INDEX IF NOT EXISTS idx_hc_icu_obs_tenant ON public.hc_icu_observations(tenant_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:35; SHA256 26830786e9cdffe64f6675c692fb8ff8d7fbc38770fe60dc42f772dceaf992cd

CREATE INDEX IF NOT EXISTS idx_hc_icu_obs_encounter ON public.hc_icu_observations(encounter_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:36; SHA256 becf99d6527d01181f1b6eeb7944eb014eac473768e5f8ad0c5add2c48c68ab7

CREATE INDEX IF NOT EXISTS idx_hc_icu_obs_time ON public.hc_icu_observations(observed_at DESC);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:53; SHA256 4d35a72b3160b9eec7ed471cafe5ed91a926fa491ddbfd53ea85663031d68a63


CREATE INDEX IF NOT EXISTS idx_hc_clinical_calc_tenant ON public.hc_clinical_calculations(tenant_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:55; SHA256 22bea66a81847cf0d8e7938371bcda6d3604fa0fbae62a97d59c62adaf2e05b2

CREATE INDEX IF NOT EXISTS idx_hc_clinical_calc_encounter ON public.hc_clinical_calculations(encounter_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:56; SHA256 55cbd879a4eb518ed6fcc3d6135c778a0444579554122f00903e4931fe88b516

CREATE INDEX IF NOT EXISTS idx_hc_clinical_calc_lookup ON public.hc_clinical_calculations(tenant_id, encounter_id, algorithm_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:68; SHA256 8f56adff9b8003144b1c88584b4f40d9cf169840a0754b359495c50a6c00e2c6


CREATE INDEX IF NOT EXISTS idx_hc_vent_policies_tenant ON public.hc_ventilator_safety_policies(tenant_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:85; SHA256 7f08067fe49547e8ab7246bd51cf19082d4a620e1648b6e363d2d5c30cdd8350


CREATE INDEX IF NOT EXISTS idx_hc_vent_records_tenant ON public.hc_ventilator_records(tenant_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:87; SHA256 a9134d65671b5290ab633a70e0faf9b93edee92b3ba5f75b6e2662fe06d3648c

CREATE INDEX IF NOT EXISTS idx_hc_vent_records_encounter ON public.hc_ventilator_records(encounter_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:101; SHA256 d150ebc7a2686cafbf5a3faa165a0b330b730d33ad9098b938aed60d24350606


CREATE INDEX IF NOT EXISTS idx_hc_em_visits_tenant ON public.hc_emergency_visits(tenant_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:103; SHA256 69dfa226d2e14c3a06fb84bf3434e5fcc80decf7e299af43aeb2999e4b1f5481

CREATE INDEX IF NOT EXISTS idx_hc_em_visits_encounter ON public.hc_emergency_visits(encounter_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:117; SHA256 8facc982e7fe84633340f7f8af2cbc4063a59ae4d5051e056d7d5964a2998fbf


CREATE INDEX IF NOT EXISTS idx_hc_triage_ass_tenant ON public.hc_triage_assessments(tenant_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:119; SHA256 90995d9c0381c3f2e39546f6899e52258400500aaf0d76c66274de8b6de8b2d2

CREATE INDEX IF NOT EXISTS idx_hc_triage_ass_visit ON public.hc_triage_assessments(emergency_visit_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:135; SHA256 01288d1d151e3678ff49ea730c1a4a4e5415aee9d03355728c6a9cc03c137252


CREATE INDEX IF NOT EXISTS idx_hc_blood_units_tenant ON public.hc_blood_units(tenant_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:152; SHA256 7d55c7ef7ae241b28f0dd885e2e7ada317df16f952e5683fbe840456e8eaf9d7


CREATE INDEX IF NOT EXISTS idx_hc_crossmatch_tenant ON public.hc_blood_crossmatch_records(tenant_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:154; SHA256 bc807301f1e543cc1f95f58f17b3731fea913d8257727f8f308eeffe8d30c7c9

CREATE INDEX IF NOT EXISTS idx_hc_crossmatch_encounter ON public.hc_blood_crossmatch_records(encounter_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:155; SHA256 c57bec88a8cdcf700d1806db1b593e1d0d9f6af193f19d7ae1cd78ef2375d96e

CREATE INDEX IF NOT EXISTS idx_hc_crossmatch_unit ON public.hc_blood_crossmatch_records(blood_unit_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:170; SHA256 8cde5030af2334eea01a800fefff6d2938dcdadee2638ba9536a703bdae49d05


CREATE INDEX IF NOT EXISTS idx_hc_trans_ver_tenant ON public.hc_transfusion_verifications(tenant_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:172; SHA256 e48bf7d15c0296aa4b975d333941335def46933852aafa73cfb38fd43f553505

CREATE INDEX IF NOT EXISTS idx_hc_trans_ver_encounter ON public.hc_transfusion_verifications(encounter_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:173; SHA256 ca90b05a7020c8afa93729db091d6ab410699768e51fb12ce4f75917b3c1d91c


-- Trigger to make transfusion verifications immutable
CREATE OR REPLACE FUNCTION public.block_transfusion_verification_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'hc_transfusion_verifications is write-once, read-only. Mutation is blocked.';
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:181; SHA256 558f82cd5d44edc4096d1e5fc111d1be3b08427ef0cce92d98b06a2705d1ae3a


CREATE TRIGGER trigger_block_transfusion_verification_mutation
BEFORE UPDATE OR DELETE ON public.hc_transfusion_verifications
FOR EACH ROW EXECUTE FUNCTION public.block_transfusion_verification_mutation();

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:201; SHA256 da58c4c4e93ef4f2e3bea939263eb5b7c4e338790b6d33a4b7f44aca678fddc9


CREATE INDEX IF NOT EXISTS idx_hc_trans_rec_tenant ON public.hc_transfusion_records(tenant_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:203; SHA256 b85168da3f7b6e2038b4d17e7c59f74d8304b255dffb913fb9a3301f0d934a06

CREATE INDEX IF NOT EXISTS idx_hc_trans_rec_encounter ON public.hc_transfusion_records(encounter_id);

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:204; SHA256 02086554b349f1f7e713d7e5cef408f664015dd8b3a968262d9391438dc9ce83


-- ============================================================================
-- Row-Level Security (RLS) Configuration
-- ============================================================================
ALTER TABLE public.hc_icu_beds ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:209; SHA256 40196086459640fa7b9775aa64ccfaf7ad428ed7a1b5bff9b8723395ccf81050

ALTER TABLE public.hc_icu_observations ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:210; SHA256 ac8edc08cd960b2f71c91ba156748dcfe8c1ccfe7f0b6e883c9fd98d5b757bc9

ALTER TABLE public.hc_clinical_calculations ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:211; SHA256 e45923a6f9b9db80cb7d041aa97247ab8d888d1a83b36bd77b30d1ec599db2b3

ALTER TABLE public.hc_ventilator_safety_policies ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:212; SHA256 2e6f550686d9023e02e23fc17d0d8f0c50f5d2d8546ef2e1d49ed11a3979bc09

ALTER TABLE public.hc_ventilator_records ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:213; SHA256 11d834690e02fe2b32237781d5b73d171ff71bb8c8b9a0a16209172261844991

ALTER TABLE public.hc_emergency_visits ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:214; SHA256 202e6e9026f8e9a22b0b3b2e6bd3505b45ebb800ce85bb2e23f82226fa31a630

ALTER TABLE public.hc_triage_assessments ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:215; SHA256 d17fef092d966de2e5f71910cfb5941a3d40dc5bb81debbbf7437a575e5bfd71

ALTER TABLE public.hc_blood_units ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:216; SHA256 de93d1992f50ba57d4a4b0f7a6a3b7c6c683804dd5d200a510ec0bf46ea67afd

ALTER TABLE public.hc_blood_crossmatch_records ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:217; SHA256 a37564406567fe658d3a1f97eefe5d37a3c6df3f39b273bb014468ea47841136

ALTER TABLE public.hc_transfusion_verifications ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:218; SHA256 f7fe79ea781ff515a872be1b707febcbe60fffbead85a162dfbb77e80d2d56a1

ALTER TABLE public.hc_transfusion_records ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:219; SHA256 43d7583c32c4357f80ab0146c0219eb5e1ad91e3f59cf3f6ec8260cbd36d6b53


-- 1. ICU Beds Policy
CREATE POLICY tenant_isolation_icu_beds ON public.hc_icu_beds
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:223; SHA256 3c89ee8639aa23dab1664e04bc3f6b4ab19a38b5561b7432db539244b9d4b237


-- 2. ICU Observations Policy
CREATE POLICY tenant_isolation_icu_obs ON public.hc_icu_observations
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:227; SHA256 c551f73d55efa638693c599871e7efd95bf36dae3f9f6ad62300be4142d8a172


-- 3. Clinical Calculations Policy
CREATE POLICY tenant_isolation_calculations ON public.hc_clinical_calculations
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:231; SHA256 f714eb41d6da0f50fd37620e02e1eff445261fa5b7bcf2d50ac2a372c99087fe


-- 4. Ventilator Safety Policies Policy
CREATE POLICY tenant_isolation_vent_policies ON public.hc_ventilator_safety_policies
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:235; SHA256 3110e1ff2ab5f73238c1e03828e9660554abb7d683829e787b7917cfbfc75de7


-- 5. Ventilator Records Policy
CREATE POLICY tenant_isolation_vent_records ON public.hc_ventilator_records
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:239; SHA256 021864eed6bc74da7b4866444d59e09a7aefe23ef7cf734867fbe3f3f643a6d2


-- 6. Emergency Visits Policy
CREATE POLICY tenant_isolation_em_visits ON public.hc_emergency_visits
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:243; SHA256 2b278aea04188bf40262f785c55798798354420e2fc02e9e174cda6bce53944d


-- 7. Triage Assessments Policy
CREATE POLICY tenant_isolation_triage_ass ON public.hc_triage_assessments
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:247; SHA256 3a6e3f6d0f5d9b9c81096a1a698366fbc20f26cc214624a0326ec742392a7a8c


-- 8. Blood Units Policy
CREATE POLICY tenant_isolation_blood_units ON public.hc_blood_units
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:251; SHA256 06f0dd792799b0ca7eb1b9dda4e4f2e56211be2a0cb5af5935bda50f0988263f


-- 9. Blood Crossmatch Records Policy
CREATE POLICY tenant_isolation_crossmatch ON public.hc_blood_crossmatch_records
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:255; SHA256 cc86287bee43673774fcbf84851f6b03ca0b8db0b7b9fd2fa04226375df066bd


-- 10. Transfusion Verifications Policy
CREATE POLICY tenant_isolation_trans_ver ON public.hc_transfusion_verifications
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000005_create_icu_ed_bloodbank_tables.sql:259; SHA256 d51f297a2970160684a6a6a65c99804a8b78fe1f10659e1aa23229175fe9250c


-- 11. Transfusion Records Policy
CREATE POLICY tenant_isolation_trans_rec ON public.hc_transfusion_records
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260812040000_recreate_clinical_orders_table.sql:97; SHA256 665d837afce6dacbcefa0df63bcd0b8908391aead45e149d51282a749cbfb875


-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_hc_clinical_orders_encounter 
  ON public.hc_clinical_orders(tenant_id, encounter_id);

-- SOURCE supabase/migrations/20260812040000_recreate_clinical_orders_table.sql:104; SHA256 469458d239c303e2d5a4e1392a46f792f543ce023640c69e6b76b4c316badce0


CREATE INDEX idx_hc_clinical_orders_patient 
  ON public.hc_clinical_orders(tenant_id, patient_party_id);

-- SOURCE supabase/migrations/20260812040000_recreate_clinical_orders_table.sql:107; SHA256 4978d5fdfdb56b9ac0e48e5b3aebdcb155dfa6dd3e2c2b89931794dc50339e05


CREATE INDEX idx_hc_clinical_orders_status 
  ON public.hc_clinical_orders(tenant_id, order_status);

-- SOURCE supabase/migrations/20260812040000_recreate_clinical_orders_table.sql:110; SHA256 8741fb293c32dac943e4159fb89a94347c7d473b053acef1f1f3bd29ab9cd439


CREATE INDEX idx_hc_clinical_orders_type_status 
  ON public.hc_clinical_orders(tenant_id, order_type, order_status);

-- SOURCE supabase/migrations/20260812040000_recreate_clinical_orders_table.sql:113; SHA256 5b2b4a7e0cf4b9e4c765aaeba227a0238ae4d652e39c0ada9f4a02d6f0f16ee5


CREATE INDEX idx_hc_clinical_orders_ordered_at 
  ON public.hc_clinical_orders(tenant_id, ordered_at DESC);

-- SOURCE supabase/migrations/20260812040000_recreate_clinical_orders_table.sql:116; SHA256 2b696e5e00d2a2ce1326be5c39d1e91abe968f13f1f8de1416f1173e8253f2a9


CREATE INDEX idx_hc_clinical_orders_version 
  ON public.hc_clinical_orders(tenant_id, id, version);

-- SOURCE supabase/migrations/20260812040000_recreate_clinical_orders_table.sql:119; SHA256 ea55bb861b6b03d1635f2b7153c5fd02bab54a7bf6838cac5a9f12a3201de240


CREATE UNIQUE INDEX idx_hc_clinical_orders_request_id
  ON public.hc_clinical_orders(tenant_id, request_id)
  WHERE request_id IS NOT NULL;

-- SOURCE supabase/migrations/20260812040000_recreate_clinical_orders_table.sql:123; SHA256 550cee98344fcccd584e8ae6f2350d2290609a7bb6aa9f9f48b77e04de70dcf9


-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE public.hc_clinical_orders ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260812040000_recreate_clinical_orders_table.sql:129; SHA256 b689a009f04aa36e420641baa47f00f15b8bdd9984071ffd2b5f90b84aff971e


CREATE POLICY tenant_isolation_clinical_orders ON public.hc_clinical_orders
  FOR ALL TO authenticated 
  USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:1; SHA256 daf55854b4e8f0d5c108a47f8160c71c8bbb748cd4bd8ceab6f20ef179ecfc60
-- ============================================================================
-- Bella Healthcare Platform — Phase C: Clinical Decision Support (CDS)
-- Migration: 20260808000006_create_cds_order_tables.sql
-- Governance: Clinical Intelligence Layer — Tier 3 Clinical Safety
-- Architecture: Global Clinical Knowledge + Tenant Policy + CPOE Orders
-- ============================================================================

-- ============================================================================
-- PART 1: UPGRADE hc_clinical_calculations
-- Add Phase C governance columns + immutability RULE
-- ============================================================================

-- Add new provenance columns for Phase C CDS governance
ALTER TABLE public.hc_clinical_calculations
  ADD COLUMN IF NOT EXISTS algorithm_category TEXT DEFAULT 'SCORE'
    CHECK (algorithm_category IN ('SCORE', 'CDS_CHECK', 'PROTOCOL_CHECK')),
  ADD COLUMN IF NOT EXISTS patient_id TEXT,
  ADD COLUMN IF NOT EXISTS knowledge_base_version TEXT,
  ADD COLUMN IF NOT EXISTS policy_version TEXT,
  ADD COLUMN IF NOT EXISTS decision TEXT
    CHECK (decision IN ('PASSED', 'WARNED', 'BLOCKED', 'ABSOLUTE_BLOCKED')),
  ADD COLUMN IF NOT EXISTS enforcement TEXT
    CHECK (enforcement IN ('ABSOLUTE_BLOCK', 'BLOCK', 'ACKNOWLEDGE', 'INFORMATIONAL', 'N_A')),
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS causation_id UUID;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:25; SHA256 64f91a9698f11f1a099371c4a606e4bbc702830ce775382664987e45532c8fcd


-- Extend algorithm_id CHECK to include CDS algorithms
ALTER TABLE public.hc_clinical_calculations
  DROP CONSTRAINT IF EXISTS hc_clinical_calculations_algorithm_id_check;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:29; SHA256 6d78efe8e93f86c8d87ec657d8cb1bd42d3375f68a20a9b9c26bf706a6dbd4df


ALTER TABLE public.hc_clinical_calculations
  ADD CONSTRAINT hc_clinical_calculations_algorithm_id_check
  CHECK (algorithm_id IN (
    -- Phase B scoring algorithms
    'SOFA', 'APACHE_II', 'NEDOCS', 'ESI',
    -- Phase C CDS algorithms
    'DRUG_INTERACTION', 'ALLERGY_CHECK', 'PROTOCOL_ADHERENCE', 'CDS_SUMMARY'
  ));

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:38; SHA256 58b19fd2cbd0f6a0f254be53baf044688dce626b0d49425ca7529b119e852f29


-- Immutability: Block UPDATE and DELETE on hc_clinical_calculations
-- (critical for clinical decision audit trail)
CREATE OR REPLACE FUNCTION public.block_clinical_calculation_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'hc_clinical_calculations is an immutable audit ledger. UPDATE and DELETE are forbidden. (Constitution: Clinical Governance Rule)';
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:47; SHA256 9619932f7bb8d1592f1e563c67a395944eef33b93106b39b8bec9d5b1da7e51a


DROP TRIGGER IF EXISTS trigger_block_clinical_calculation_mutation ON public.hc_clinical_calculations;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:49; SHA256 c982c6b520d44b33e09ae881b0f69953b4e862350aa6da2375c0d626d2b6245f

CREATE TRIGGER trigger_block_clinical_calculation_mutation
  BEFORE UPDATE OR DELETE ON public.hc_clinical_calculations
  FOR EACH ROW EXECUTE FUNCTION public.block_clinical_calculation_mutation();

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:74; SHA256 694e53f4aec1964989e8251fc8fb1af060e2e096b23fac982e54e283b197cadb


CREATE INDEX IF NOT EXISTS idx_hc_drugs_code ON public.hc_drugs(drug_code) WHERE is_active = true;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:76; SHA256 428760a01ba20b846fa4b7e4717bcd662d19fea2937c8c1bd03abc743e5a96d4

CREATE INDEX IF NOT EXISTS idx_hc_drugs_class ON public.hc_drugs(drug_class) WHERE is_active = true;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:77; SHA256 66cce4a4b271d46ad032aa0691bc16e5bd136ba925f471222d17ac81ee9b684e


-- Immutability: Global KB is append-only
CREATE OR REPLACE FUNCTION public.block_global_kb_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Global Clinical Knowledge tables are append-only. Use is_active=false to deprecate records. (Clinical Governance Rule)';
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:85; SHA256 1eca3df0bba4610a0664527d16e8a964ed9bb5138df37f4c53ef9eb24cdbff53


DROP TRIGGER IF EXISTS trigger_block_hc_drugs_mutation ON public.hc_drugs;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:87; SHA256 7b8b0f13220f44cc386018d4ca07de351cbf1744e76f27ed8c4546982eaf32a2

CREATE TRIGGER trigger_block_hc_drugs_mutation
  BEFORE UPDATE OR DELETE ON public.hc_drugs
  FOR EACH ROW EXECUTE FUNCTION public.block_global_kb_mutation();

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:111; SHA256 c35bfe106294da1d1f3b3fbf3d1f1cf9b0a8caa9c90f78ef08205a12ce415529


-- Index both directions for O(1) lookup: given drug X, find all interactions
CREATE INDEX IF NOT EXISTS idx_hc_ddi_drug_a ON public.hc_drug_interactions(drug_a_code) WHERE is_active = true;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:114; SHA256 c2478cf4140de1fe978c38bc28fbf482058c0a06f63e4ae4d18579b3fe33fc1c

CREATE INDEX IF NOT EXISTS idx_hc_ddi_drug_b ON public.hc_drug_interactions(drug_b_code) WHERE is_active = true;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:115; SHA256 975b7c19e1f005fcb3e8d88553c3b87a51377da265c787b3770773567cd8cadf

CREATE INDEX IF NOT EXISTS idx_hc_ddi_severity ON public.hc_drug_interactions(severity, enforcement) WHERE is_active = true;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:116; SHA256 2acdbb4091a66b85e8a25a0ac3043dfd33c39fd8446770c156c4d4d04006afa9


DROP TRIGGER IF EXISTS trigger_block_hc_drug_interactions_mutation ON public.hc_drug_interactions;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:118; SHA256 d880f4b5ab952d7e1acc0919fd73d8321d6e7ba3338c9d06244fa5ac9c8f05cf

CREATE TRIGGER trigger_block_hc_drug_interactions_mutation
  BEFORE UPDATE OR DELETE ON public.hc_drug_interactions
  FOR EACH ROW EXECUTE FUNCTION public.block_global_kb_mutation();

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:139; SHA256 2bcdc315aba2f107dd3e294abed2bcef8876d52db643b2c06444e27b42173d49


CREATE INDEX IF NOT EXISTS idx_hc_protocols_drug ON public.hc_clinical_protocols(drug_code) WHERE is_active = true;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:141; SHA256 4e4f3474a96508d9a82a125649c8a9bd98e97d0d185b53a1a910cbd419e1a5fb

CREATE INDEX IF NOT EXISTS idx_hc_protocols_class ON public.hc_clinical_protocols(drug_class) WHERE is_active = true;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:142; SHA256 e6eb2a04273a23dda2e3755b3a4073aed609351d6ad331a762f0649c84056c7a

CREATE INDEX IF NOT EXISTS idx_hc_protocols_type ON public.hc_clinical_protocols(contraindication_type) WHERE is_active = true;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:143; SHA256 5f0a39db534f457932ad0d8382626b91c9055c6786e64fbab402a10fea2ebf51


DROP TRIGGER IF EXISTS trigger_block_hc_clinical_protocols_mutation ON public.hc_clinical_protocols;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:145; SHA256 e0cd38d6c0224086fe59f177a26e68f07017efb7fa2623bf6fb71e96e826cdc6

CREATE TRIGGER trigger_block_hc_clinical_protocols_mutation
  BEFORE UPDATE OR DELETE ON public.hc_clinical_protocols
  FOR EACH ROW EXECUTE FUNCTION public.block_global_kb_mutation();

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:178; SHA256 adae6a534087604118b7a8a63b35db8bc9a0f1bb32040facb675a8a962c6c099


CREATE INDEX IF NOT EXISTS idx_hc_tenant_cds_policies_tenant ON public.hc_tenant_cds_policies(tenant_id);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:180; SHA256 d1aeb7c821579cf62be91ec403944c50d385851acc93d1b09e9d5703713f83fc

CREATE INDEX IF NOT EXISTS idx_hc_tenant_cds_policies_interaction ON public.hc_tenant_cds_policies(interaction_id);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:181; SHA256 711812546b0c46e45642aba619c78a53bfac39e580b4f7fba6b12fbb7cd3cb68

CREATE INDEX IF NOT EXISTS idx_hc_tenant_cds_policies_protocol ON public.hc_tenant_cds_policies(protocol_id);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:201; SHA256 8616f4fc29da2a093274180cc669ffcece94b3744b56d1be49b1b0042974ed72


CREATE INDEX IF NOT EXISTS idx_hc_patient_allergies_patient ON public.hc_patient_allergies(tenant_id, patient_id) WHERE is_active = true;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:203; SHA256 125297a22383d6978a1b291bcc7f326495f1290af9967b2d26e31fc6c093239f

CREATE INDEX IF NOT EXISTS idx_hc_patient_allergies_encounter ON public.hc_patient_allergies(tenant_id, encounter_id);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:204; SHA256 84ddced77768479c849c356bd87e9cb8d40a01aa94eb571d8bd94fbf55c5b88e

CREATE INDEX IF NOT EXISTS idx_hc_patient_allergies_allergen ON public.hc_patient_allergies(tenant_id, allergen_code) WHERE is_active = true;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:236; SHA256 76c902941643e0c993f539fe98686cdd5dd7b34180e7d50bc26ae745320dca23


CREATE INDEX IF NOT EXISTS idx_hc_clinical_orders_encounter ON public.hc_clinical_orders(tenant_id, encounter_id);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:238; SHA256 ff1a6089f926027723e334209d6bfa61de60bbe62c62a72c64ed86f8bb516d2b

CREATE INDEX IF NOT EXISTS idx_hc_clinical_orders_status ON public.hc_clinical_orders(tenant_id, order_status);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:239; SHA256 5978ef83e972cdfb2999d0f69efcd45522930def358e40c181cc8767c2db409b

CREATE INDEX IF NOT EXISTS idx_hc_clinical_orders_type_status ON public.hc_clinical_orders(tenant_id, order_type, order_status);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:255; SHA256 4267e1d68d42cccc0158542b66371550b126c6a8d576b6c7af5c81c6d815cd44


CREATE INDEX IF NOT EXISTS idx_hc_order_cds_overrides_order ON public.hc_order_cds_overrides(order_id);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:257; SHA256 a2c99356a94b95c227b8d6d8f58887aff1ed4dd879313f156236f7a23759380d

CREATE INDEX IF NOT EXISTS idx_hc_order_cds_overrides_tenant ON public.hc_order_cds_overrides(tenant_id);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:258; SHA256 f1418f77fa4b89c88ce0da297bcddde6e873f7ed8b0419cee2d13775b912cebd


-- Immutability: Override audit is write-once (chain of custody)
CREATE OR REPLACE FUNCTION public.block_cds_override_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'hc_order_cds_overrides is an immutable audit chain. UPDATE and DELETE are forbidden. (Clinical Governance Rule)';
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:266; SHA256 f89c1bc5bb70828a0c61044c4448cc3e4934b0b46812fbb05da9d41a36ae6d87


DROP TRIGGER IF EXISTS trigger_block_cds_override_mutation ON public.hc_order_cds_overrides;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:268; SHA256 d4016f053848bab64ec3ac6d235a438e3d017b19499f91ae6bcea0a1090af87e

CREATE TRIGGER trigger_block_cds_override_mutation
  BEFORE UPDATE OR DELETE ON public.hc_order_cds_overrides
  FOR EACH ROW EXECUTE FUNCTION public.block_cds_override_mutation();

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:271; SHA256 c9e6185d062b4c1b6f005916ae5ebf9ab9e443c43fdecc5411b65794cab82899


-- ============================================================================
-- PART 5: ROW-LEVEL SECURITY (RLS)
-- ============================================================================

-- Global KB tables: No RLS (no tenant_id) — read by all authenticated
-- These are governed globally, writes are controlled at application layer
ALTER TABLE public.hc_drugs ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:279; SHA256 5d560273762768c80e99b40f274a6f3151eedf2a319740afd8b0d4fe17831f0d

ALTER TABLE public.hc_drug_interactions ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:280; SHA256 13cb7c390c6cccc9a6b428e656ec8a57767772531b1c7e32523efa2b96e3f874

ALTER TABLE public.hc_clinical_protocols ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:281; SHA256 aa7c120d0eeaf2d48b5d364975535844c45d726b28d8a525e536700d8cfc69c4


-- Global KB read policy: all authenticated users can read
CREATE POLICY global_kb_read_all ON public.hc_drugs
  FOR SELECT TO authenticated USING (true);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:285; SHA256 265004b1510af228e712809fb933027c16a20ca3276ef1828a78e564194e89d1

CREATE POLICY global_kb_read_all_ddi ON public.hc_drug_interactions
  FOR SELECT TO authenticated USING (true);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:287; SHA256 327c7901db181a7940cb56b9bca08a71b195b8f669f29d8924eb60183bb57c54

CREATE POLICY global_kb_read_all_protocols ON public.hc_clinical_protocols
  FOR SELECT TO authenticated USING (true);

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:289; SHA256 6140c752ec45bc47d0a3a799eedfa06b42bceb4b8d8151da6c9759e2cf9db0aa


-- Tenant tables: standard tenant isolation
ALTER TABLE public.hc_tenant_cds_policies ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:292; SHA256 a04f849e89e9c0f939a43b70ad46de1161fe6399804775039dddd40fee748aec

ALTER TABLE public.hc_patient_allergies ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:293; SHA256 e4997fe4af01b37f211e6b074d56cba669b8c77dfc8ee2043794803e494bc8df

ALTER TABLE public.hc_clinical_orders ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:294; SHA256 0de66b7dd437bcbedfc70a2a6959b46e953c50153bc86eb7deb93d391bf100a6

ALTER TABLE public.hc_order_cds_overrides ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:295; SHA256 d9ca7a7c085e1d19ae920354ad20dd5134c89a0501ba26139968840997ca982e


CREATE POLICY tenant_isolation_cds_policies ON public.hc_tenant_cds_policies
  FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:299; SHA256 85200582825ae5b612b9f5a869d2b42697e2ba7baca1c17105cb62c6b0b586cb


CREATE POLICY tenant_isolation_patient_allergies ON public.hc_patient_allergies
  FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260808000006_create_cds_order_tables.sql:307; SHA256 827663e4ae689634526d4802a2fe8ac7d77d1926ceb056051d5d34f4f4d9cfed


CREATE POLICY tenant_isolation_cds_overrides ON public.hc_order_cds_overrides
  FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- SOURCE supabase/migrations/20260812050000_extend_pharmacy_schema.sql:1; SHA256 92c3fd561cc9582c6a096eeb6ad53e1fc505cae6e32cf30b3d69f347762d92cf
-- ============================================================================
-- Bella Healthcare Platform — Extend Pharmacy Schema
-- Migration: 20260812050000_extend_pharmacy_schema.sql
-- ============================================================================

-- 1. Alter public.hc_prescriptions to link to public.hc_clinical_orders
ALTER TABLE public.hc_prescriptions 
    ADD COLUMN IF NOT EXISTS clinical_order_id UUID UNIQUE REFERENCES public.hc_clinical_orders(id) ON DELETE RESTRICT;

-- SOURCE supabase/migrations/20260812050000_extend_pharmacy_schema.sql:8; SHA256 794306159b47e5f93907c60f601bd1539e9dbbe30c0cc533ccc63161eec40b3e


-- For existing systems, this column would need to be backfilled. Since it is empty in this environment:
ALTER TABLE public.hc_prescriptions 
    ALTER COLUMN clinical_order_id SET NOT NULL;

-- SOURCE supabase/migrations/20260812050000_extend_pharmacy_schema.sql:12; SHA256 25fd4d8a379d6b4c40e89e9b72dec13c418902c1b95028e0fbf02d8ae7cb48f6


-- Create performance index for prescription -> order joins
CREATE INDEX IF NOT EXISTS idx_hc_prescriptions_clinical_order 
    ON public.hc_prescriptions(clinical_order_id);

-- SOURCE supabase/migrations/20260812050000_extend_pharmacy_schema.sql:16; SHA256 d9a0cbd58761451284d1b93117262ce2e1116da9242af8f1dd1f4e11a736ecd1


-- 2. Alter public.hc_medication_administration_records to support outpatient and check constraints
ALTER TABLE public.hc_medication_administration_records 
    ALTER COLUMN inpatient_admission_id DROP NOT NULL;

-- SOURCE supabase/migrations/20260812050000_extend_pharmacy_schema.sql:20; SHA256 adfdab7bf28eee181c56aa5b521c16cf7654ee928a322d6d73b65fe9c613a5ec


ALTER TABLE public.hc_medication_administration_records 
    ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES public.hc_encounters(id) ON DELETE RESTRICT;

-- SOURCE supabase/migrations/20260812050000_extend_pharmacy_schema.sql:23; SHA256 2940c76b5b37482b814d1c26fe341800618ea59dd491b57ea921d9f75c596eb4


-- Enforce that at least one treatment context is provided
ALTER TABLE public.hc_medication_administration_records 
    ADD CONSTRAINT chk_mar_admission_or_encounter 
    CHECK (inpatient_admission_id IS NOT NULL OR encounter_id IS NOT NULL);

-- SOURCE supabase/migrations/20260812050000_extend_pharmacy_schema.sql:28; SHA256 9d229f90532a3d3dc1eeb01b258b9351d2e3e02a7f9e986efa9916b78548e761


-- Create performance index for MAR -> encounter queries
CREATE INDEX IF NOT EXISTS idx_hc_mar_encounter 
    ON public.hc_medication_administration_records(encounter_id);

-- SOURCE supabase/migrations/20260812050000_extend_pharmacy_schema.sql:32; SHA256 28060364c383c57ab845efd42b638e7797d1cd392e4b994ccee328f712fb91fe


-- 3. Trigger for cross-table encounter consistency (Admission Encounter == MAR Encounter)
CREATE OR REPLACE FUNCTION public.verify_mar_encounter_consistency()
RETURNS TRIGGER AS $$
DECLARE
    admission_encounter_id UUID;
BEGIN
    IF NEW.inpatient_admission_id IS NOT NULL AND NEW.encounter_id IS NOT NULL THEN
        SELECT encounter_id INTO admission_encounter_id
        FROM public.hc_inpatient_admissions
        WHERE id = NEW.inpatient_admission_id;
        
        IF FOUND AND admission_encounter_id <> NEW.encounter_id THEN
            RAISE EXCEPTION 'MAR encounter_id (%) does not match referenced inpatient admission encounter_id (%)',
                NEW.encounter_id, admission_encounter_id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260812050000_extend_pharmacy_schema.sql:53; SHA256 de10d991efd54c6086b7bbbda1adc2f100fd86a3cd732292a1ce193601ead2ea


DROP TRIGGER IF EXISTS trg_verify_mar_encounter_consistency ON public.hc_medication_administration_records;

-- SOURCE supabase/migrations/20260812050000_extend_pharmacy_schema.sql:55; SHA256 a051b2f9607482658a8a35156209c1c5975bbba7135a243e5363c116632335ae

CREATE TRIGGER trg_verify_mar_encounter_consistency
    BEFORE INSERT OR UPDATE ON public.hc_medication_administration_records
    FOR EACH ROW EXECUTE FUNCTION public.verify_mar_encounter_consistency();

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:28; SHA256 a21fe137f1ad15f2862445d0d1537036a5338c1f162905e665180afc17a210f9


CREATE INDEX IF NOT EXISTS idx_hc_cds_snapshots_tenant_encounter 
ON public.hc_clinical_context_snapshots(tenant_id, encounter_id);

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:31; SHA256 f7e40168921d297c86098ff08a8e3e7ae8416b0d7b86cec73468d5a88e36d218


CREATE INDEX IF NOT EXISTS idx_hc_cds_snapshots_patient 
ON public.hc_clinical_context_snapshots(tenant_id, patient_id);

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:45; SHA256 b550bce36809c47f248a3d1097c5b365c858ade76bd1135d41feec7c6ff7e798


CREATE INDEX IF NOT EXISTS idx_hc_cds_processed_events_lookup 
ON public.hc_cds_processed_events(tenant_id, event_id);

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:65; SHA256 255e93d2342cb943d40c2c0e376ba2240dc4e18ff23151b2fa43956b466392aa


CREATE INDEX IF NOT EXISTS idx_hc_cds_rules_lookup 
ON public.hc_cds_rules(tenant_id, rule_code, rule_version);

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:90; SHA256 c7745a62154af026c2ce601b6d85728e50b0ec9895561d0c75294039f896c65f


CREATE INDEX IF NOT EXISTS idx_hc_clinical_decisions_lookup 
ON public.hc_clinical_decisions(tenant_id, evaluation_fingerprint);

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:108; SHA256 642b63dcca1a78fc23cf362b83441e3037b180fdfb2a532f3ac2e15328cbeb33


CREATE INDEX IF NOT EXISTS idx_hc_decision_overrides_lookup 
ON public.hc_decision_overrides(tenant_id, original_decision_id);

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:111; SHA256 efb08d281543b8a7efd7e327fbf88165bd23cc7f2d2e757b6561695415acbb23


-- 6. RLS MANAGEMENT
ALTER TABLE public.hc_clinical_context_snapshots ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:114; SHA256 7f9c96f81a72e7f396c2211f54be03faeccb794dc86bcb944819aba2ed817814

ALTER TABLE public.hc_cds_processed_events ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:115; SHA256 10ac82b23d8c2080f4dbeb144a444b65b393601a08a5e988eccd62b035a9b91d

ALTER TABLE public.hc_cds_rules ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:116; SHA256 cd849c09dfe77583a55e729320818bca11ac87b76a4d99ac3a28f4a720f9ad17

ALTER TABLE public.hc_clinical_decisions ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:117; SHA256 15f7299f661d01f8597730a1c6acce7ebd0c8db13de221c1a2eeaed094f25a89

ALTER TABLE public.hc_decision_overrides ENABLE ROW LEVEL SECURITY;

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:118; SHA256 8fd4997a99bc3b19522df4733e06552e5b807ca9ef5c38ae190b731c019e0b00


DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_clinical_context_snapshots' AND policyname = 'tenant_isolation_hc_clinical_context_snapshots') THEN
    CREATE POLICY tenant_isolation_hc_clinical_context_snapshots ON public.hc_clinical_context_snapshots
        FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_cds_processed_events' AND policyname = 'tenant_isolation_hc_cds_processed_events') THEN
    CREATE POLICY tenant_isolation_hc_cds_processed_events ON public.hc_cds_processed_events
        FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_cds_rules' AND policyname = 'tenant_isolation_hc_cds_rules') THEN
    CREATE POLICY tenant_isolation_hc_cds_rules ON public.hc_cds_rules
        FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_clinical_decisions' AND policyname = 'tenant_isolation_hc_clinical_decisions') THEN
    CREATE POLICY tenant_isolation_hc_clinical_decisions ON public.hc_clinical_decisions
        FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_decision_overrides' AND policyname = 'tenant_isolation_hc_decision_overrides') THEN
    CREATE POLICY tenant_isolation_hc_decision_overrides ON public.hc_decision_overrides
        FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:146; SHA256 61111f658ce902319728012efb715f5beff58a8dc40061d4a268f4e7a77d8ce1


-- 7. MUTATION TRIGGER (IMMUTABILITY)
CREATE OR REPLACE FUNCTION public.block_immutable_table_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Mutation not allowed: this table is immutable.';
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:154; SHA256 8910ba3d62c37835aa9f865ccc0e5569ced99eb95cfc73a568e808425810decf


CREATE TRIGGER tr_block_mutation_decisions
BEFORE UPDATE OR DELETE ON public.hc_clinical_decisions
FOR EACH ROW EXECUTE FUNCTION public.block_immutable_table_mutation();

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:158; SHA256 d81cd856729f52cb8946da2ffa0f9b9c5ba635f67f6c20318102171c126b99f7


CREATE TRIGGER tr_block_mutation_overrides
BEFORE UPDATE OR DELETE ON public.hc_decision_overrides
FOR EACH ROW EXECUTE FUNCTION public.block_immutable_table_mutation();

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:162; SHA256 0a53676198af4d28e22926581961e3147a104843c9f6d3f32cd5932314a377b2


-- 8. OVERRIDE VALIDATION TRIGGER
CREATE OR REPLACE FUNCTION public.validate_decision_override_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_result TEXT;
  v_enforcement TEXT;
  v_severity TEXT;
BEGIN
  SELECT result, enforcement, severity INTO v_result, v_enforcement, v_severity
  FROM public.hc_clinical_decisions
  WHERE id = NEW.original_decision_id AND tenant_id = NEW.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced clinical decision % not found.', NEW.original_decision_id;
  END IF;

  IF v_result != 'BLOCK' THEN
    RAISE EXCEPTION 'Only decisions with result BLOCK can be overridden.';
  END IF;

  IF v_enforcement = 'ABSOLUTE_BLOCK' THEN
    RAISE EXCEPTION 'Overrides are strictly prohibited for ABSOLUTE_BLOCK enforcement.';
  END IF;

  -- Enforce Severity-to-Role Policy
  IF v_severity = 'LOW' THEN
    IF NOT NEW.clinician_role IN ('doctor', 'pharmacist', 'chief_of_department', 'clinical_director', 'medical_director', 'chief_executive') THEN
      RAISE EXCEPTION 'Role % is not authorized to override LOW severity clinical blocks.', NEW.clinician_role;
    END IF;
  ELSIF v_severity = 'HIGH' THEN
    IF NOT NEW.clinician_role IN ('chief_of_department', 'clinical_director', 'medical_director', 'chief_executive') THEN
      RAISE EXCEPTION 'Role % is not authorized to override HIGH severity clinical blocks.', NEW.clinician_role;
    END IF;
  ELSIF v_severity = 'CRITICAL' THEN
    IF NOT NEW.clinician_role IN ('medical_director', 'chief_executive') THEN
      RAISE EXCEPTION 'Role % is not authorized to override CRITICAL severity clinical blocks.', NEW.clinician_role;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:205; SHA256 2658b77cde388821b3bc34235ebb41de5f2b9a2b4f5c272e9567cc744d0ebcf2


CREATE TRIGGER tr_validate_decision_override
BEFORE INSERT ON public.hc_decision_overrides
FOR EACH ROW EXECUTE FUNCTION public.validate_decision_override_insert();

-- SOURCE supabase/migrations/20260813000000_create_h8_cds_schema.sql:209; SHA256 edc80fb309f9cfe0682a4dfac7d7b3f0da619a34554aa0ec7c0724943d08e62e


-- 9. ATOMIC CONTEXT PROJECTION FUNCTION
CREATE OR REPLACE FUNCTION public.project_clinical_context_event(
  p_tenant_id UUID,
  p_event_id UUID,
  p_event_type TEXT,
  p_event_timestamp TIMESTAMPTZ,
  p_event_sequence BIGINT,
  p_encounter_id UUID,
  p_patient_id TEXT,
  p_snapshot_update JSONB
) RETURNS VOID AS $$
DECLARE
  v_claimed_id UUID;
  v_last_sequence BIGINT;
  v_current_version INT;
BEGIN
  -- 1. Atomic Event Claim (deduplication)
  INSERT INTO public.hc_cds_processed_events (tenant_id, event_id, event_type, status, processed_at, projection_version)
  VALUES (p_tenant_id, p_event_id, p_event_type, 'processed', now(), 0)
  ON CONFLICT (tenant_id, event_id) DO NOTHING
  RETURNING event_id INTO v_claimed_id;

  IF v_claimed_id IS NULL THEN
    RETURN; -- Silent NO-OP for duplicate delivery
  END IF;

  -- 2. Concurrency serialization using 2-integer Advisory Lock keyed on (tenant_id, encounter_id)
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text), hashtext(p_encounter_id::text));

  -- 3. Prevent out-of-order events using sequence number
  SELECT last_event_sequence, projection_version INTO v_last_sequence, v_current_version 
  FROM public.hc_clinical_context_snapshots WHERE tenant_id = p_tenant_id AND encounter_id = p_encounter_id;
  
  IF v_last_sequence IS NOT NULL AND p_event_sequence <= v_last_sequence THEN
    -- Record skipped out-of-order event for audit log completeness
    UPDATE public.hc_cds_processed_events 
    SET status = 'skipped_out_of_order', projection_version = v_current_version
    WHERE tenant_id = p_tenant_id AND event_id = p_event_id;
    RETURN;
  END IF;

  -- 4. Update snapshot
  INSERT INTO public.hc_clinical_context_snapshots (
    tenant_id, encounter_id, patient_id, last_processed_event_at, last_event_id, last_event_sequence, projection_version, projection_status,
    allergies, active_medications, lab_results, vital_signs, diagnoses, active_orders
  ) VALUES (
    p_tenant_id, p_encounter_id, p_patient_id, p_event_timestamp, p_event_id, p_event_sequence, 1, 'FRESH',
    COALESCE(p_snapshot_update->'allergies', '[]'::jsonb),
    COALESCE(p_snapshot_update->'active_medications', '[]'::jsonb),
    COALESCE(p_snapshot_update->'lab_results', '[]'::jsonb),
    COALESCE(p_snapshot_update->'vital_signs', '[]'::jsonb),
    COALESCE(p_snapshot_update->'diagnoses', '[]'::jsonb),
    COALESCE(p_snapshot_update->'active_orders', '[]'::jsonb)
  ) ON CONFLICT (tenant_id, encounter_id) DO UPDATE SET
    last_processed_event_at = p_event_timestamp,
    last_event_id = p_event_id,
    last_event_sequence = p_event_sequence,
    projection_version = public.hc_clinical_context_snapshots.projection_version + 1,
    projection_status = 'FRESH',
    allergies = COALESCE(p_snapshot_update->'allergies', public.hc_clinical_context_snapshots.allergies),
    active_medications = COALESCE(p_snapshot_update->'active_medications', public.hc_clinical_context_snapshots.active_medications),
    lab_results = COALESCE(p_snapshot_update->'lab_results', public.hc_clinical_context_snapshots.lab_results),
    vital_signs = COALESCE(p_snapshot_update->'vital_signs', public.hc_clinical_context_snapshots.vital_signs),
    diagnoses = COALESCE(p_snapshot_update->'diagnoses', public.hc_clinical_context_snapshots.diagnoses),
    active_orders = COALESCE(p_snapshot_update->'active_orders', public.hc_clinical_context_snapshots.active_orders)
  RETURNING projection_version INTO v_current_version;

  -- 5. Record successful processed event with the new snapshot version
  UPDATE public.hc_cds_processed_events 
  SET projection_version = v_current_version
  WHERE tenant_id = p_tenant_id AND event_id = p_event_id;
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260813000009_temporal_engine_tables.sql:20; SHA256 96a4f0ea50c09aef12861fdd5b94724a16fb1a5705cb021218357334c0cbd8fb


-- Unique index for sequence ordering per encounter
CREATE UNIQUE INDEX IF NOT EXISTS uq_hc_temporal_event_seq
    ON public.hc_temporal_events (tenant_id, encounter_id, sequence_number);

-- SOURCE supabase/migrations/20260813000009_temporal_engine_tables.sql:24; SHA256 b153563c4c3c94e999d8d2f5068cada793cb6e5350eb4833209201eb4b5e6d68


-- Bitemporal indexes for ultra-fast point-in-time queries
CREATE INDEX IF NOT EXISTS idx_hc_temporal_events_valid_time
    ON public.hc_temporal_events (tenant_id, encounter_id, valid_time);

-- SOURCE supabase/migrations/20260813000009_temporal_engine_tables.sql:28; SHA256 ecad1f470abe85efabefb93d7473f4c02e3b36b9470ec48de0d47d718621ab94


CREATE INDEX IF NOT EXISTS idx_hc_temporal_events_tx_time
    ON public.hc_temporal_events (tenant_id, encounter_id, transaction_time);

-- SOURCE supabase/migrations/20260813000009_temporal_engine_tables.sql:45; SHA256 d9dd59366c9e89e845bd08c95153a2381c7ecf70283395b26bea45cf1e939d35


CREATE UNIQUE INDEX IF NOT EXISTS uq_hc_temporal_snapshot_version
    ON public.hc_temporal_snapshots (tenant_id, encounter_id, snapshot_version);

-- SOURCE supabase/migrations/20260813000009_temporal_engine_tables.sql:48; SHA256 5ce923bb95a2c1a2bfa3c357db1040abe6608100fa1c4d9aa2fb110415dc8953



-- 3. Write-once Immutable DB Triggers
CREATE OR REPLACE FUNCTION public.fn_prevent_hc_temporal_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Temporal History tables are strictly append-only.';
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260813000009_temporal_engine_tables.sql:57; SHA256 382a56b3121a0b30efe5c5291d685181b19a814252330d9bcd52696236dd88ab


DROP TRIGGER IF EXISTS trg_hc_temporal_events_immutable ON public.hc_temporal_events;

-- SOURCE supabase/migrations/20260813000009_temporal_engine_tables.sql:59; SHA256 2debba5c8cce0763c0afd8de1e5a521fb33f09a594d38aab7a1fcb93ff18f64d

CREATE TRIGGER trg_hc_temporal_events_immutable
    BEFORE UPDATE OR DELETE ON public.hc_temporal_events
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_hc_temporal_mutation();

-- SOURCE supabase/migrations/20260813000009_temporal_engine_tables.sql:63; SHA256 c356689b9403b83dc8a2a4b8307ad45ea324db7d379bbe2dec3280d136453847


DROP TRIGGER IF EXISTS trg_hc_temporal_snapshots_immutable ON public.hc_temporal_snapshots;

-- SOURCE supabase/migrations/20260813000009_temporal_engine_tables.sql:65; SHA256 c75217ac300112e63e74e7ccf7a2dfafe83cea815137c57743eb4d3c1e033d28

CREATE TRIGGER trg_hc_temporal_snapshots_immutable
    BEFORE UPDATE OR DELETE ON public.hc_temporal_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_hc_temporal_mutation();

-- SOURCE supabase/migrations/20260813000009_temporal_engine_tables.sql:69; SHA256 f492e09898f5b61a3d898a249499cf65e2f47dbaedfa0b584a58e076886c5992



-- 4. Point-in-Time State Reconstruction PL/pgSQL Function
CREATE OR REPLACE FUNCTION public.reconstruct_temporal_state_at(
    p_tenant_id UUID,
    p_encounter_id UUID,
    p_target_time TIMESTAMPTZ,
    p_dimension TEXT DEFAULT 'VALID_TIME'
)
RETURNS JSONB AS $$
DECLARE
    v_patient_id UUID;
    v_snapshot_state JSONB := '{}'::jsonb;
    v_last_snapshot_ver BIGINT := 0;
    v_rec RECORD;
    v_meds JSONB := '[]'::jsonb;
    v_allergies JSONB := '[]'::jsonb;
    v_labs JSONB := '[]'::jsonb;
    v_vitals JSONB := '[]'::jsonb;
    v_diagnoses JSONB := '[]'::jsonb;
    v_orders JSONB := '[]'::jsonb;
    v_cds_decisions JSONB := '[]'::jsonb;
    v_count INT := 0;
BEGIN
    -- Check if snapshot checkpoint exists prior to target_time
    IF p_dimension = 'TRANSACTION_TIME' THEN
        SELECT reconstructed_state, snapshot_version, patient_id
        INTO v_snapshot_state, v_last_snapshot_ver, v_patient_id
        FROM public.hc_temporal_snapshots
        WHERE tenant_id = p_tenant_id
          AND encounter_id = p_encounter_id
          AND as_of_transaction_time <= p_target_time
        ORDER BY snapshot_version DESC
        LIMIT 1;
    ELSE
        SELECT reconstructed_state, snapshot_version, patient_id
        INTO v_snapshot_state, v_last_snapshot_ver, v_patient_id
        FROM public.hc_temporal_snapshots
        WHERE tenant_id = p_tenant_id
          AND encounter_id = p_encounter_id
          AND as_of_valid_time <= p_target_time
        ORDER BY snapshot_version DESC
        LIMIT 1;
    END IF;

    -- Extract pre-existing arrays from snapshot if found, handle NULL when no snapshot row exists
    v_last_snapshot_ver := COALESCE(v_last_snapshot_ver, 0);
    IF v_snapshot_state IS NOT NULL AND v_snapshot_state != '{}'::jsonb THEN
        v_meds := COALESCE(v_snapshot_state->'activeMedications', '[]'::jsonb);
        v_allergies := COALESCE(v_snapshot_state->'allergies', '[]'::jsonb);
        v_labs := COALESCE(v_snapshot_state->'labResults', '[]'::jsonb);
        v_vitals := COALESCE(v_snapshot_state->'vitalSigns', '[]'::jsonb);
        v_diagnoses := COALESCE(v_snapshot_state->'diagnoses', '[]'::jsonb);
        v_orders := COALESCE(v_snapshot_state->'orders', '[]'::jsonb);
        v_cds_decisions := COALESCE(v_snapshot_state->'cdsDecisions', '[]'::jsonb);
    END IF;

    -- Replay timeline events after checkpoint up to p_target_time
    FOR v_rec IN
        SELECT *
        FROM public.hc_temporal_events
        WHERE tenant_id = p_tenant_id
          AND encounter_id = p_encounter_id
          AND sequence_number > v_last_snapshot_ver
          AND (
              (p_dimension = 'TRANSACTION_TIME' AND transaction_time <= p_target_time) OR
              (p_dimension = 'VALID_TIME' AND valid_time <= p_target_time)
          )
        ORDER BY sequence_number ASC
    LOOP
        v_patient_id := v_rec.patient_id;
        v_count := v_count + 1;

        -- Categorize payload into clinical buckets
        IF v_rec.aggregate_type = 'Pharmacy' OR v_rec.event_type LIKE '%medication%' THEN
            v_meds := v_meds || jsonb_build_array(v_rec.delta_payload);
        ELSIF v_rec.event_type LIKE '%allergy%' THEN
            v_allergies := v_allergies || jsonb_build_array(v_rec.delta_payload);
        ELSIF v_rec.aggregate_type = 'Laboratory' OR v_rec.event_type LIKE '%lab%' THEN
            v_labs := v_labs || jsonb_build_array(v_rec.delta_payload);
        ELSIF v_rec.event_type LIKE '%vital%' THEN
            v_vitals := v_vitals || jsonb_build_array(v_rec.delta_payload);
        ELSIF v_rec.event_type LIKE '%diagnosis%' THEN
            v_diagnoses := v_diagnoses || jsonb_build_array(v_rec.delta_payload);
        ELSIF v_rec.aggregate_type = 'Order' OR v_rec.event_type LIKE '%order%' THEN
            v_orders := v_orders || jsonb_build_array(v_rec.delta_payload);
        ELSIF v_rec.aggregate_type = 'ClinicalDecision' OR v_rec.event_type LIKE '%cds%' THEN
            v_cds_decisions := v_cds_decisions || jsonb_build_array(v_rec.delta_payload);
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'tenantId', p_tenant_id,
        'encounterId', p_encounter_id,
        'patientId', v_patient_id,
        'asOfValidTime', p_target_time,
        'asOfTransactionTime', NOW(),
        'timeDimension', p_dimension,
        'activeMedications', v_meds,
        'allergies', v_allergies,
        'labResults', v_labs,
        'vitalSigns', v_vitals,
        'diagnoses', v_diagnoses,
        'orders', v_orders,
        'cdsDecisions', v_cds_decisions,
        'eventCountReconstructed', v_count
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- SOURCE supabase/migrations/20260813000010_rule_governance_tables.sql:26; SHA256 77e4636cfc1ab9b2e65a87ae3fb7b59a0cbd1229519487de25572a50cdba257d


-- Unique index per tenant, rule_code, and rule_version
CREATE UNIQUE INDEX IF NOT EXISTS uq_hc_governed_rule_ver
    ON public.hc_governed_clinical_rules (tenant_id, rule_code, rule_version);

-- SOURCE supabase/migrations/20260813000010_rule_governance_tables.sql:30; SHA256 29730abf4857f5cc146ddd1e29d0eac424dc3201e5fd85d6d50279ad3dfa8a1c


CREATE INDEX IF NOT EXISTS idx_hc_governed_rules_active_time
    ON public.hc_governed_clinical_rules (tenant_id, status, jurisdiction_code, effective_from, effective_to);

-- SOURCE supabase/migrations/20260813000010_rule_governance_tables.sql:48; SHA256 3a69b9105a17cc7bd3ded294d585ec1fdbd264f5bcd19b5f12139c6cad9f41ee


CREATE INDEX IF NOT EXISTS idx_hc_rule_audit_rule_id
    ON public.hc_rule_governance_audit (tenant_id, rule_id);

-- SOURCE supabase/migrations/20260813000010_rule_governance_tables.sql:51; SHA256 cef58ef0824f21593a8f33649236284bd18677ff9c15b2e0e4662bd5d7a17daa



-- 3. Non-Overlap Trigger (H10-04 / H10-07 Invariant)
CREATE OR REPLACE FUNCTION public.fn_prevent_active_rule_overlap()
RETURNS TRIGGER AS $$
DECLARE
    v_overlap_count INT;
BEGIN
    IF NEW.status = 'ACTIVE' THEN
        SELECT COUNT(*)
        INTO v_overlap_count
        FROM public.hc_governed_clinical_rules
        WHERE tenant_id = NEW.tenant_id
          AND rule_code = NEW.rule_code
          AND jurisdiction_code = NEW.jurisdiction_code
          AND status = 'ACTIVE'
          AND id != NEW.id
          AND (
              NEW.effective_from <= COALESCE(effective_to, '9999-12-31'::timestamptz) AND
              COALESCE(NEW.effective_to, '9999-12-31'::timestamptz) >= effective_from
          );

        IF v_overlap_count > 0 THEN
            RAISE EXCEPTION 'Active rule time window overlap detected for rule_code % and jurisdiction %.', NEW.rule_code, NEW.jurisdiction_code;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260813000010_rule_governance_tables.sql:80; SHA256 ef349cc41b886a84f26ded117a01e1a264266bb0056e11c161b8b0f566b83d88


DROP TRIGGER IF EXISTS trg_hc_rule_non_overlap ON public.hc_governed_clinical_rules;

-- SOURCE supabase/migrations/20260813000010_rule_governance_tables.sql:82; SHA256 06c61f89fc420a0d1d7f1bb7175b6c51ecd64d06eb89cdd80c804e4f3349c9b9

CREATE TRIGGER trg_hc_rule_non_overlap
    BEFORE INSERT OR UPDATE ON public.hc_governed_clinical_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_active_rule_overlap();

-- SOURCE supabase/migrations/20260813000010_rule_governance_tables.sql:86; SHA256 fe1c35917ddcb025c7c62968a43af458609dfba71f2269b414b0ed1eb845752f



-- 4. Governance Role Authorization Trigger (H10-03 Invariant)
CREATE OR REPLACE FUNCTION public.fn_validate_governance_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('APPROVED', 'ACTIVE') AND OLD.status NOT IN ('APPROVED', 'ACTIVE') THEN
        IF NEW.enforcement IN ('BLOCK', 'ABSOLUTE_BLOCK') OR NEW.severity = 'CRITICAL' THEN
            IF NEW.approver_role IS NULL OR NEW.approver_role NOT IN ('chief_of_department', 'medical_director') THEN
                RAISE EXCEPTION 'Approval of BLOCK/ABSOLUTE_BLOCK rules requires chief_of_department or medical_director role.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260813000010_rule_governance_tables.sql:102; SHA256 fce9113258002cbf8e0df693a06c5d4cf908776ed13276c4e3229a1e2aac6ffa


DROP TRIGGER IF EXISTS trg_hc_rule_governance_approval ON public.hc_governed_clinical_rules;

-- SOURCE supabase/migrations/20260813000010_rule_governance_tables.sql:104; SHA256 9324a8fe1f6dd028076f5da3af41f37087c3ca594a8b66523602299f79856596

CREATE TRIGGER trg_hc_rule_governance_approval
    BEFORE UPDATE ON public.hc_governed_clinical_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_validate_governance_approval();

-- SOURCE supabase/migrations/20260813000010_rule_governance_tables.sql:108; SHA256 50378db26b7af94cdd6345152ee3381786b3e3a4c5e7dcc8e8d29248af25fe61



-- 5. Immutability Trigger for Approved/Active/Superseded Rules (H10-02 Invariant)
CREATE OR REPLACE FUNCTION public.fn_prevent_governed_rule_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status != 'DRAFT' THEN
            RAISE EXCEPTION 'Non-DRAFT governed clinical rules cannot be deleted.';
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IN ('APPROVED', 'ACTIVE', 'SUPERSEDED', 'RETIRED') THEN
            -- Only status, effective_to, and approval metadata may transition
            IF OLD.rule_checksum != NEW.rule_checksum OR
               OLD.conditions_dsl::text != NEW.conditions_dsl::text OR
               OLD.severity != NEW.severity OR
               OLD.enforcement != NEW.enforcement OR
               OLD.rule_code != NEW.rule_code OR
               OLD.rule_version != NEW.rule_version THEN
                RAISE EXCEPTION 'Approved or Active clinical rule artifacts are write-once immutable. Create a new rule version instead.';
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260813000010_rule_governance_tables.sql:136; SHA256 e8b2e5bc91c99745eeff8252fa330cc654fc432edbf904ce2fb426d717711dc3


DROP TRIGGER IF EXISTS trg_hc_governed_rules_immutable ON public.hc_governed_clinical_rules;

-- SOURCE supabase/migrations/20260813000010_rule_governance_tables.sql:138; SHA256 55a2cbd31a21bc7cb912497603741fa853d7d9063825388cfe42a658658561bc

CREATE TRIGGER trg_hc_governed_rules_immutable
    BEFORE UPDATE OR DELETE ON public.hc_governed_clinical_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_governed_rule_mutation();

-- SOURCE supabase/migrations/20260813000010_rule_governance_tables.sql:142; SHA256 daa006d0e6105e9c36f12442088ed0c94093e4576bacd1f4cc57e1528611ffd2



-- 6. Resolve Active Rules PL/pgSQL Function
CREATE OR REPLACE FUNCTION public.resolve_active_rules_at(
    p_tenant_id UUID,
    p_target_time TIMESTAMPTZ,
    p_jurisdiction TEXT DEFAULT 'LOCAL'
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    rule_code TEXT,
    rule_version TEXT,
    jurisdiction_code TEXT,
    status TEXT,
    severity TEXT,
    enforcement TEXT,
    conditions_dsl JSONB,
    rule_checksum TEXT,
    effective_from TIMESTAMPTZ,
    effective_to TIMESTAMPTZ,
    author_id TEXT,
    approver_id TEXT,
    approver_role TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.tenant_id,
        r.rule_code,
        r.rule_version,
        r.jurisdiction_code,
        r.status,
        r.severity,
        r.enforcement,
        r.conditions_dsl,
        r.rule_checksum,
        r.effective_from,
        r.effective_to,
        r.author_id,
        r.approver_id,
        r.approver_role
    FROM public.hc_governed_clinical_rules r
    WHERE r.tenant_id = p_tenant_id
      AND (r.jurisdiction_code = p_jurisdiction OR r.jurisdiction_code = 'GLOBAL')
      AND r.status = 'ACTIVE'
      AND r.effective_from <= p_target_time
      AND (r.effective_to IS NULL OR r.effective_to >= p_target_time)
    ORDER BY r.effective_from DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- SOURCE supabase/migrations/20260813000011_clinical_audit_tables.sql:24; SHA256 ef848724d2afff6d1da6c81b2a98eebce2231a7ad5eeaa7748442f3131eebbe7


CREATE INDEX IF NOT EXISTS idx_hc_audit_tenant_enc
    ON public.hc_clinical_audit_ledger (tenant_id, encounter_id);

-- SOURCE supabase/migrations/20260813000011_clinical_audit_tables.sql:27; SHA256 5e0d4a3ee7284579f71e7ab0b0710a7f36efe26acb45ea73917062f66dce8ec8


CREATE INDEX IF NOT EXISTS idx_hc_audit_tenant_status
    ON public.hc_clinical_audit_ledger (tenant_id, compliance_status, evidence_integrity);

-- SOURCE supabase/migrations/20260813000011_clinical_audit_tables.sql:43; SHA256 9fafd1937062dc3eb9e0f1abe29bd027ac78dd1613decd1deb56212e83487ff9


CREATE INDEX IF NOT EXISTS idx_hc_evidence_packages_tenant
    ON public.hc_clinical_evidence_packages (tenant_id, audit_id);

-- SOURCE supabase/migrations/20260813000011_clinical_audit_tables.sql:61; SHA256 3fe7acccfdf25c6a97ea83ba7d636fa6a6c011bf7a815059b21f015eca247a92


CREATE INDEX IF NOT EXISTS idx_hc_exceptions_tenant_enc
    ON public.hc_compliance_exceptions (tenant_id, encounter_id);

-- SOURCE supabase/migrations/20260813000011_clinical_audit_tables.sql:64; SHA256 cf1b2e98b1062dc0564bd18e1e92f914826096fab4feb5f50a2a5742a9185989



-- 4. Append-Only Immutability Triggers (H11-01 Invariant)
CREATE OR REPLACE FUNCTION public.fn_prevent_clinical_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Clinical audit, evidence, and compliance exception ledgers are strictly write-once append-only. Mutation (UPDATE/DELETE) is prohibited.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- SOURCE supabase/migrations/20260813000011_clinical_audit_tables.sql:74; SHA256 6a954b775208d2358cc15a36c1cac6703c575235ce3911710c609f9623f543b0


DROP TRIGGER IF EXISTS trg_hc_audit_ledger_immutable ON public.hc_clinical_audit_ledger;

-- SOURCE supabase/migrations/20260813000011_clinical_audit_tables.sql:76; SHA256 8453cf40a1c334870a36e966ee5adcae74895e9dad0250a281be7bfe369dd023

CREATE TRIGGER trg_hc_audit_ledger_immutable
    BEFORE UPDATE OR DELETE ON public.hc_clinical_audit_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_clinical_audit_mutation();

-- SOURCE supabase/migrations/20260813000011_clinical_audit_tables.sql:80; SHA256 b684dcfa9aae546aec29fc80613c3389d9348d2c381c32eba3d356e653ca81fb


DROP TRIGGER IF EXISTS trg_hc_evidence_packages_immutable ON public.hc_clinical_evidence_packages;

-- SOURCE supabase/migrations/20260813000011_clinical_audit_tables.sql:82; SHA256 654f8a6dd1b10170c2692b524752c8d9ae615ff4d6ae982ae8462d317f686d4b

CREATE TRIGGER trg_hc_evidence_packages_immutable
    BEFORE UPDATE OR DELETE ON public.hc_clinical_evidence_packages
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_clinical_audit_mutation();

-- SOURCE supabase/migrations/20260813000011_clinical_audit_tables.sql:86; SHA256 ff248478d9e0f428752623f35b884e091db04ebe4e68a01d65aa8dcc004cd6df


DROP TRIGGER IF EXISTS trg_hc_exceptions_immutable ON public.hc_compliance_exceptions;

-- SOURCE supabase/migrations/20260813000011_clinical_audit_tables.sql:88; SHA256 84dacaebc97580971716927578cffc24dbee0df39a927ebfa23aa5e2be975828

CREATE TRIGGER trg_hc_exceptions_immutable
    BEFORE UPDATE OR DELETE ON public.hc_compliance_exceptions
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_clinical_audit_mutation();

-- SOURCE supabase/migrations/20260813000011_clinical_audit_tables.sql:92; SHA256 982c1ad93d9e75d8b6de0a841d53090220a280e05164aa678a98351235008bc6



-- 5. PL/pgSQL Function: get_compliance_summary
CREATE OR REPLACE FUNCTION public.get_compliance_summary(
    p_tenant_id UUID,
    p_from TIMESTAMPTZ DEFAULT NULL,
    p_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    tenant_id UUID,
    total_actions BIGINT,
    compliant_count BIGINT,
    non_compliant_count BIGINT,
    exception_count BIGINT,
    requires_review_count BIGINT,
    complete_integrity_count BIGINT,
    broken_integrity_count BIGINT,
    override_rate_percent NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH filtered AS (
        SELECT *
        FROM public.hc_clinical_audit_ledger a
        WHERE a.tenant_id = p_tenant_id
          AND (p_from IS NULL OR a.created_at >= p_from)
          AND (p_to IS NULL OR a.created_at <= p_to)
    )
    SELECT
        p_tenant_id AS tenant_id,
        COUNT(*)::BIGINT AS total_actions,
        COUNT(*) FILTER (WHERE compliance_status = 'COMPLIANT')::BIGINT AS compliant_count,
        COUNT(*) FILTER (WHERE compliance_status = 'NON_COMPLIANT')::BIGINT AS non_compliant_count,
        COUNT(*) FILTER (WHERE compliance_status = 'EXCEPTION')::BIGINT AS exception_count,
        COUNT(*) FILTER (WHERE compliance_status = 'REQUIRES_REVIEW')::BIGINT AS requires_review_count,
        COUNT(*) FILTER (WHERE evidence_integrity = 'COMPLETE')::BIGINT AS complete_integrity_count,
        COUNT(*) FILTER (WHERE evidence_integrity IN ('BROKEN', 'UNVERIFIABLE'))::BIGINT AS broken_integrity_count,
        CASE 
            WHEN COUNT(*) = 0 THEN 0.0
            ELSE ROUND((COUNT(*) FILTER (WHERE compliance_status = 'EXCEPTION')::NUMERIC / COUNT(*)::NUMERIC) * 100.0, 2)
        END AS override_rate_percent
    FROM filtered;
END;
$$ LANGUAGE plpgsql STABLE;
