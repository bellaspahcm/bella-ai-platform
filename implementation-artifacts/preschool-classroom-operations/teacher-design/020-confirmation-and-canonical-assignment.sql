-- REVIEW DRAFT ONLY. Not approved/applied. Run after exactly one reviewed profile 010/011.
-- Scope: admin confirms EXISTING Party; existing Education aggregate gains canonical course identity.
-- No Party/Auth/People writes, legacy FK retargeting, broad table grants, event or engine.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
LOCK TABLE public.teacher_assignments IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid='public.teacher_assignments'::regclass AND attname='canonical_course_id'
      AND atttypid='uuid'::regtype AND NOT attisdropped)
    OR EXISTS (SELECT 1 FROM public.teacher_assignments WHERE canonical_course_id IS NOT NULL)
    OR to_regclass('public.preschool_teacher_branch_confirmations') IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class
      WHERE oid='public.teacher_assignments'::regclass AND relrowsecurity)
    OR to_regprocedure('public.platform_assert_active_branch_for_actor(uuid,uuid,uuid)') IS NULL
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_REVIEWED_FIRST_APPLY_REQUIRED'; END IF;
  -- Preserve the already implemented one-active-lead-class/year rule at DB level.
  -- Never clean historical conflicts automatically to make this index succeed.
  IF EXISTS (SELECT 1 FROM public.teacher_assignments
    WHERE role='lead_teacher' AND status='active'
    GROUP BY tenant_id,teacher_party_id,academic_year HAVING count(*)>1)
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_EXISTING_LEAD_CONFLICT'; END IF;
END $$;

CREATE TABLE public.preschool_teacher_branch_confirmations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL REFERENCES public.org_units(id) ON DELETE RESTRICT,
  teacher_party_id uuid NOT NULL REFERENCES public.party_parties(id) ON DELETE RESTRICT,
  valid_from date NOT NULL CHECK(isfinite(valid_from)),
  valid_to date NULL CHECK(valid_to IS NULL OR (isfinite(valid_to) AND valid_to>=valid_from)),
  attestation text NOT NULL CHECK(length(attestation) BETWEEN 1 AND 500
    AND attestation=btrim(attestation) AND attestation !~ '[[:cntrl:]]'),
  confirmed_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz NULL,
  revoked_by uuid NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  revocation_reason text NULL,
  CHECK ((revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL)
    OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND revocation_reason IS NOT NULL
      AND length(revocation_reason) BETWEEN 1 AND 500
      AND revocation_reason=btrim(revocation_reason) AND revocation_reason !~ '[[:cntrl:]]'))
);
COMMENT ON TABLE public.preschool_teacher_branch_confirmations IS
  'Preschool admin attestation that an existing Party person is a teacher at this branch for explicit dates. Not identity, employment, Auth mapping, Party role, classroom assignment or permission.';
CREATE INDEX preschool_teacher_confirmation_branch ON public.preschool_teacher_branch_confirmations
  (tenant_id,branch_id,teacher_party_id,id);
ALTER TABLE public.preschool_teacher_branch_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.preschool_teacher_branch_confirmations FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.teacher_assignments ADD COLUMN canonical_teacher_confirmation_id uuid NULL
  REFERENCES public.preschool_teacher_branch_confirmations(id) ON DELETE RESTRICT;
ALTER TABLE public.teacher_assignments ADD CONSTRAINT teacher_assignments_canonical_confirmation_required
  CHECK ((canonical_course_id IS NULL AND canonical_teacher_confirmation_id IS NULL)
    OR (canonical_course_id IS NOT NULL AND canonical_teacher_confirmation_id IS NOT NULL));
CREATE UNIQUE INDEX uq_canonical_active_lead_course_year ON public.teacher_assignments
  (tenant_id,canonical_course_id,academic_year)
  WHERE canonical_course_id IS NOT NULL AND role='lead_teacher' AND status='active';
CREATE UNIQUE INDEX uq_canonical_active_teacher_course_role_year ON public.teacher_assignments
  (tenant_id,canonical_course_id,teacher_party_id,academic_year,role)
  WHERE canonical_course_id IS NOT NULL AND status='active';
CREATE UNIQUE INDEX uq_active_lead_teacher_any_course_year ON public.teacher_assignments
  (tenant_id,teacher_party_id,academic_year) WHERE role='lead_teacher' AND status='active';
CREATE INDEX idx_canonical_teacher_course ON public.teacher_assignments
  (tenant_id,canonical_course_id,assignment_id) WHERE canonical_course_id IS NOT NULL;

-- Existing permissive legacy policies cannot expose canonical rows. Legacy rows still pass.
-- BYPASSRLS owners remain privileged. No existing table ACL is changed here.
CREATE POLICY teacher_assignments_canonical_private ON public.teacher_assignments
  AS RESTRICTIVE FOR ALL TO PUBLIC
  USING(canonical_course_id IS NULL) WITH CHECK(canonical_course_id IS NULL);

-- TRUNCATE bypasses row policies and row DELETE triggers. Preserve existing legacy-only
-- TRUNCATE behavior, but never let those existing privileges remove canonical history.
CREATE FUNCTION public.preschool_teacher_history_truncate_guard() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_RELID='public.teacher_assignments'::regclass THEN
    IF EXISTS (SELECT 1 FROM public.teacher_assignments WHERE canonical_course_id IS NOT NULL)
    THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_HISTORY_IMMUTABLE' USING ERRCODE='23514'; END IF;
  ELSIF TG_RELID='public.preschool_teacher_branch_confirmations'::regclass THEN
    IF EXISTS (SELECT 1 FROM public.preschool_teacher_branch_confirmations)
    THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_HISTORY_IMMUTABLE' USING ERRCODE='23514'; END IF;
  ELSE RAISE EXCEPTION 'PRESCHOOL_TEACHER_TRUNCATE_GUARD_SCOPE' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.preschool_teacher_history_truncate_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER preschool_teacher_history_truncate_guard BEFORE TRUNCATE ON public.teacher_assignments
  FOR EACH STATEMENT EXECUTE FUNCTION public.preschool_teacher_history_truncate_guard();
CREATE TRIGGER preschool_teacher_confirmation_truncate_guard BEFORE TRUNCATE ON public.preschool_teacher_branch_confirmations
  FOR EACH STATEMENT EXECUTE FUNCTION public.preschool_teacher_history_truncate_guard();

-- Product-local implementation helper, not a new Platform API. No EXECUTE grant.
CREATE FUNCTION public.preschool_teacher_assert_admin(
  p_tenant_id uuid,p_actor_id uuid,p_branch_id uuid,p_course_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_tenant_id IS NULL OR p_actor_id IS NULL
    OR p_branch_id IS NULL OR (auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_actor_id)
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF current_setting('transaction_isolation')<>'read committed'
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_READ_COMMITTED_REQUIRED' USING ERRCODE='40001'; END IF;
  PERFORM 1 FROM public.users u JOIN auth.users a ON a.id=u.id
    JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id AND u.status='active' AND u.role='admin'
      AND t.status='active' AND t.product_key='bella_preschool' AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp()) FOR SHARE OF u,a,t;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM public.platform_assert_active_branch_for_actor(p_tenant_id,p_actor_id,p_branch_id);
  IF p_course_id IS NOT NULL THEN
    PERFORM 1 FROM public.edu_courses c JOIN public.preschool_chain_course_branch_assignments m
      ON m.course_id=c.id AND m.tenant_id=c.tenant_id
      WHERE c.id=p_course_id AND c.tenant_id=p_tenant_id AND m.branch_id=p_branch_id FOR SHARE OF c,m;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_COURSE_DENIED' USING ERRCODE='42501'; END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.preschool_teacher_assert_admin(uuid,uuid,uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.preschool_teacher_confirmation_integrity() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_HISTORY_IMMUTABLE' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
    PERFORM public.preschool_teacher_assert_admin(NEW.tenant_id,NEW.confirmed_by,NEW.branch_id);
    IF NEW.revoked_at IS NOT NULL OR NEW.revoked_by IS NOT NULL OR NEW.revocation_reason IS NOT NULL
    THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_INVALID_REQUEST' USING ERRCODE='22023'; END IF;
    PERFORM 1 FROM public.party_parties p WHERE p.id=NEW.teacher_party_id AND p.tenant_id=NEW.tenant_id
      AND p.party_type='person' AND p.deleted_at IS NULL AND btrim(p.display_name)<>'' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_PARTY_DENIED' USING ERRCODE='42501'; END IF;
  ELSE
    IF (to_jsonb(NEW)-ARRAY['revoked_at','revoked_by','revocation_reason'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['revoked_at','revoked_by','revocation_reason'])
      OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL
    THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_HISTORY_IMMUTABLE' USING ERRCODE='23514'; END IF;
    PERFORM public.preschool_teacher_assert_admin(NEW.tenant_id,NEW.revoked_by,NEW.branch_id);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.preschool_teacher_confirmation_integrity() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER preschool_teacher_confirmation_integrity BEFORE INSERT OR UPDATE OR DELETE
  ON public.preschool_teacher_branch_confirmations FOR EACH ROW
  EXECUTE FUNCTION public.preschool_teacher_confirmation_integrity();

CREATE FUNCTION public.preschool_canonical_teacher_assignment_integrity() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_confirmation public.preschool_teacher_branch_confirmations%ROWTYPE; v_actor uuid;
BEGIN
  -- Legacy lifecycle/FK remains unchanged. Canonical identity cannot be converted to/from legacy.
  IF TG_OP='DELETE' THEN
    IF OLD.canonical_course_id IS NOT NULL
    THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_HISTORY_IMMUTABLE' USING ERRCODE='23514'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND OLD.canonical_course_id IS DISTINCT FROM NEW.canonical_course_id
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_COURSE_IDENTITY_IMMUTABLE' USING ERRCODE='23514'; END IF;
  IF NEW.canonical_course_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-ARRAY['status','effective_end_date','updated_at','updated_by'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','effective_end_date','updated_at','updated_by'])
      OR OLD.status<>'active' OR NEW.status<>'terminated'
    THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_HISTORY_IMMUTABLE' USING ERRCODE='23514'; END IF;
    v_actor:=NEW.updated_by;
  ELSE
    IF NEW.status<>'active' OR NEW.created_by IS NULL OR NEW.updated_by IS DISTINCT FROM NEW.created_by
    THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_INVALID_REQUEST' USING ERRCODE='22023'; END IF;
    v_actor:=NEW.created_by;
  END IF;
  SELECT * INTO v_confirmation FROM public.preschool_teacher_branch_confirmations
    WHERE id=NEW.canonical_teacher_confirmation_id AND tenant_id=NEW.tenant_id
      AND teacher_party_id=NEW.teacher_party_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_CONFIRMATION_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM public.preschool_teacher_assert_admin(NEW.tenant_id,v_actor,v_confirmation.branch_id,NEW.canonical_course_id);
  IF NEW.academic_year IS NULL OR length(NEW.academic_year) NOT BETWEEN 1 AND 80
    OR NEW.academic_year<>btrim(NEW.academic_year) OR NEW.academic_year ~ '[[:cntrl:]]'
    OR NEW.effective_start_date IS NULL OR NOT isfinite(NEW.effective_start_date)
    OR (NEW.effective_end_date IS NOT NULL AND (NOT isfinite(NEW.effective_end_date)
      OR NEW.effective_end_date<NEW.effective_start_date))
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_INVALID_REQUEST' USING ERRCODE='22023'; END IF;
  IF TG_OP='INSERT' THEN
    IF v_confirmation.revoked_at IS NOT NULL OR NEW.effective_start_date<v_confirmation.valid_from
      OR (v_confirmation.valid_to IS NOT NULL
        AND (NEW.effective_end_date IS NULL OR NEW.effective_end_date>v_confirmation.valid_to))
    THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_CONFIRMATION_DENIED' USING ERRCODE='42501'; END IF;
    PERFORM 1 FROM public.party_parties p WHERE p.id=NEW.teacher_party_id AND p.tenant_id=NEW.tenant_id
      AND p.party_type='person' AND p.deleted_at IS NULL AND btrim(p.display_name)<>'' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_PARTY_DENIED' USING ERRCODE='42501'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.edu_courses c
      WHERE c.id=NEW.canonical_course_id AND c.tenant_id=NEW.tenant_id AND c.status='active')
    THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_COURSE_DENIED' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.preschool_canonical_teacher_assignment_integrity() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER preschool_canonical_teacher_assignment_integrity BEFORE INSERT OR UPDATE OR DELETE
  ON public.teacher_assignments FOR EACH ROW EXECUTE FUNCTION public.preschool_canonical_teacher_assignment_integrity();

CREATE FUNCTION public.preschool_confirm_teacher(
  p_tenant_id uuid,p_actor_id uuid,p_branch_id uuid,p_operation_key uuid,
  p_teacher_party_id uuid,p_valid_from date,p_valid_to date,p_attestation text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
SET statement_timeout='10s' SET lock_timeout='2s' AS $$
DECLARE v_row public.preschool_teacher_branch_confirmations%ROWTYPE;
BEGIN
  PERFORM public.preschool_teacher_assert_admin(p_tenant_id,p_actor_id,p_branch_id);
  IF p_operation_key IS NULL OR p_teacher_party_id IS NULL OR p_valid_from IS NULL OR NOT isfinite(p_valid_from)
    OR (p_valid_to IS NOT NULL AND (NOT isfinite(p_valid_to) OR p_valid_to<p_valid_from))
    OR p_attestation IS NULL OR length(p_attestation) NOT BETWEEN 1 AND 500
    OR p_attestation<>btrim(p_attestation) OR p_attestation ~ '[[:cntrl:]]'
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_INVALID_REQUEST' USING ERRCODE='22023'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('preschool-teacher-confirm:'||p_operation_key::text,0));
  PERFORM public.preschool_teacher_assert_admin(p_tenant_id,p_actor_id,p_branch_id);
  SELECT * INTO v_row FROM public.preschool_teacher_branch_confirmations
    WHERE id=p_operation_key AND tenant_id=p_tenant_id FOR UPDATE;
  IF FOUND THEN
    IF v_row.tenant_id<>p_tenant_id OR v_row.branch_id<>p_branch_id OR v_row.teacher_party_id<>p_teacher_party_id
      OR v_row.confirmed_by<>p_actor_id OR v_row.valid_from<>p_valid_from OR v_row.valid_to IS DISTINCT FROM p_valid_to
      OR v_row.attestation<>p_attestation
    THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_OPERATION_CONFLICT' USING ERRCODE='23505'; END IF;
  ELSE
    INSERT INTO public.preschool_teacher_branch_confirmations
      (id,tenant_id,branch_id,teacher_party_id,valid_from,valid_to,attestation,confirmed_by)
      VALUES(p_operation_key,p_tenant_id,p_branch_id,p_teacher_party_id,p_valid_from,p_valid_to,p_attestation,p_actor_id)
      RETURNING * INTO v_row;
  END IF;
  PERFORM public.preschool_teacher_assert_admin(p_tenant_id,p_actor_id,p_branch_id);
  -- Replay reads current lifecycle: a revoked receipt never restores eligibility.
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.preschool_revoke_teacher_confirmation(
  p_tenant_id uuid,p_actor_id uuid,p_branch_id uuid,p_confirmation_id uuid,p_reason text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
SET statement_timeout='10s' SET lock_timeout='2s' AS $$
DECLARE v_row public.preschool_teacher_branch_confirmations%ROWTYPE;
BEGIN
  PERFORM public.preschool_teacher_assert_admin(p_tenant_id,p_actor_id,p_branch_id);
  IF p_confirmation_id IS NULL OR p_reason IS NULL OR length(p_reason) NOT BETWEEN 1 AND 500
    OR p_reason<>btrim(p_reason) OR p_reason ~ '[[:cntrl:]]'
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_INVALID_REQUEST' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_row FROM public.preschool_teacher_branch_confirmations
    WHERE id=p_confirmation_id AND tenant_id=p_tenant_id AND branch_id=p_branch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_CONFIRMATION_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM public.preschool_teacher_assert_admin(p_tenant_id,p_actor_id,p_branch_id);
  IF v_row.revoked_at IS NOT NULL THEN
    IF v_row.revoked_by<>p_actor_id OR v_row.revocation_reason<>p_reason
    THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_OPERATION_CONFLICT' USING ERRCODE='23505'; END IF;
  ELSE
    UPDATE public.preschool_teacher_branch_confirmations SET revoked_at=clock_timestamp(),revoked_by=p_actor_id,revocation_reason=p_reason
      WHERE id=v_row.id AND tenant_id=p_tenant_id AND branch_id=p_branch_id RETURNING * INTO v_row;
  END IF;
  PERFORM public.preschool_teacher_assert_admin(p_tenant_id,p_actor_id,p_branch_id);
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.edu_assign_preschool_teacher(
  p_tenant_id uuid,p_actor_id uuid,p_branch_id uuid,p_operation_key uuid,p_course_id uuid,
  p_confirmation_id uuid,p_teacher_party_id uuid,p_role text,p_academic_year text,
  p_effective_start_date date,p_effective_end_date date
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
SET statement_timeout='10s' SET lock_timeout='2s' AS $$
DECLARE v_row public.teacher_assignments%ROWTYPE; v_confirmation public.preschool_teacher_branch_confirmations%ROWTYPE;
BEGIN
  PERFORM public.preschool_teacher_assert_admin(p_tenant_id,p_actor_id,p_branch_id,p_course_id);
  IF p_operation_key IS NULL OR p_course_id IS NULL OR p_confirmation_id IS NULL OR p_teacher_party_id IS NULL
    OR p_role IS NULL OR p_role NOT IN('lead_teacher','co_teacher','assistant','substitute')
    OR p_academic_year IS NULL OR length(p_academic_year) NOT BETWEEN 1 AND 80
    OR p_academic_year<>btrim(p_academic_year) OR p_academic_year ~ '[[:cntrl:]]'
    OR p_effective_start_date IS NULL OR NOT isfinite(p_effective_start_date)
    OR (p_effective_end_date IS NOT NULL AND (NOT isfinite(p_effective_end_date) OR p_effective_end_date<p_effective_start_date))
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_INVALID_REQUEST' USING ERRCODE='22023'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('preschool-teacher-assign:'||p_operation_key::text,0));
  PERFORM public.preschool_teacher_assert_admin(p_tenant_id,p_actor_id,p_branch_id,p_course_id);
  -- Recover an exact prior active operation before applying creation-only eligibility.
  -- Revocation, Party soft deletion or course archival cannot erase prior success.
  SELECT * INTO v_row FROM public.teacher_assignments
    WHERE assignment_id=p_operation_key AND tenant_id=p_tenant_id FOR UPDATE;
  IF FOUND THEN
    IF v_row.tenant_id<>p_tenant_id OR v_row.canonical_course_id IS DISTINCT FROM p_course_id OR v_row.course_id IS NOT NULL
      OR v_row.teacher_party_id<>p_teacher_party_id OR v_row.canonical_teacher_confirmation_id IS DISTINCT FROM p_confirmation_id
      OR v_row.role<>p_role OR v_row.academic_year<>p_academic_year OR v_row.created_by IS DISTINCT FROM p_actor_id
      OR v_row.effective_start_date<>p_effective_start_date OR v_row.effective_end_date IS DISTINCT FROM p_effective_end_date
      OR v_row.status<>'active'
    THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_OPERATION_CONFLICT' USING ERRCODE='23505'; END IF;
    -- Retain immutable tenant/Party/branch proof binding without demanding that
    -- the confirmation still grants new-assignment eligibility at replay time.
    PERFORM 1 FROM public.preschool_teacher_branch_confirmations
      WHERE id=p_confirmation_id AND tenant_id=p_tenant_id AND branch_id=p_branch_id
        AND teacher_party_id=p_teacher_party_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_CONFIRMATION_DENIED' USING ERRCODE='42501'; END IF;
    PERFORM public.preschool_teacher_assert_admin(p_tenant_id,p_actor_id,p_branch_id,p_course_id);
    RETURN to_jsonb(v_row);
  END IF;
  SELECT * INTO v_confirmation FROM public.preschool_teacher_branch_confirmations
    WHERE id=p_confirmation_id AND tenant_id=p_tenant_id AND branch_id=p_branch_id AND teacher_party_id=p_teacher_party_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_CONFIRMATION_DENIED' USING ERRCODE='42501'; END IF;
  IF v_confirmation.revoked_at IS NOT NULL OR p_effective_start_date<v_confirmation.valid_from
    OR (v_confirmation.valid_to IS NOT NULL AND (p_effective_end_date IS NULL OR p_effective_end_date>v_confirmation.valid_to))
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_CONFIRMATION_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.party_parties p WHERE p.id=p_teacher_party_id AND p.tenant_id=p_tenant_id
    AND p.party_type='person' AND p.deleted_at IS NULL AND btrim(p.display_name)<>'' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_PARTY_DENIED' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.edu_courses WHERE id=p_course_id AND tenant_id=p_tenant_id AND status='active')
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_COURSE_DENIED' USING ERRCODE='42501'; END IF;
  INSERT INTO public.teacher_assignments(assignment_id,tenant_id,course_id,canonical_course_id,teacher_party_id,
    canonical_teacher_confirmation_id,role,academic_year,effective_start_date,effective_end_date,status,created_by,updated_by)
    VALUES(p_operation_key,p_tenant_id,NULL,p_course_id,p_teacher_party_id,p_confirmation_id,p_role,p_academic_year,
      p_effective_start_date,p_effective_end_date,'active',p_actor_id,p_actor_id) RETURNING * INTO v_row;
  PERFORM public.preschool_teacher_assert_admin(p_tenant_id,p_actor_id,p_branch_id,p_course_id);
  -- Confirmation/Party rows are SHARE-locked through commit, including any unique-index wait.
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.edu_terminate_preschool_teacher(
  p_tenant_id uuid,p_actor_id uuid,p_branch_id uuid,p_course_id uuid,p_assignment_id uuid,p_end_date date
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
SET statement_timeout='10s' SET lock_timeout='2s' AS $$
DECLARE v_row public.teacher_assignments%ROWTYPE;
BEGIN
  PERFORM public.preschool_teacher_assert_admin(p_tenant_id,p_actor_id,p_branch_id,p_course_id);
  IF p_course_id IS NULL OR p_assignment_id IS NULL OR p_end_date IS NULL OR NOT isfinite(p_end_date)
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_INVALID_REQUEST' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_row FROM public.teacher_assignments WHERE assignment_id=p_assignment_id
    AND tenant_id=p_tenant_id AND canonical_course_id=p_course_id AND course_id IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_ASSIGNMENT_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM public.preschool_teacher_assert_admin(p_tenant_id,p_actor_id,p_branch_id,p_course_id);
  IF p_end_date<v_row.effective_start_date
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_INVALID_REQUEST' USING ERRCODE='22023'; END IF;
  IF v_row.status='terminated' THEN
    IF v_row.effective_end_date IS DISTINCT FROM p_end_date OR v_row.updated_by IS DISTINCT FROM p_actor_id
    THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_OPERATION_CONFLICT' USING ERRCODE='23505'; END IF;
  ELSIF v_row.status='active' THEN
    UPDATE public.teacher_assignments SET status='terminated',effective_end_date=p_end_date,
      updated_at=clock_timestamp(),updated_by=p_actor_id WHERE assignment_id=v_row.assignment_id
        AND tenant_id=p_tenant_id AND canonical_course_id=p_course_id RETURNING * INTO v_row;
  ELSE RAISE EXCEPTION 'PRESCHOOL_TEACHER_OPERATION_CONFLICT' USING ERRCODE='23505'; END IF;
  PERFORM public.preschool_teacher_assert_admin(p_tenant_id,p_actor_id,p_branch_id,p_course_id);
  RETURN to_jsonb(v_row);
END $$;

CREATE FUNCTION public.preschool_teacher_candidates(
  p_tenant_id uuid,p_actor_id uuid,p_branch_id uuid,p_query text,p_confirmed_only boolean,
  p_on_date date,p_offset integer DEFAULT 0,p_limit integer DEFAULT 20
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
SET statement_timeout='10s' SET lock_timeout='2s' AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM public.preschool_teacher_assert_admin(p_tenant_id,p_actor_id,p_branch_id);
  IF p_query IS NULL OR length(p_query)>80 OR p_query ~ '[[:cntrl:]]' OR p_confirmed_only IS NULL
    OR p_on_date IS NULL OR NOT isfinite(p_on_date) OR p_offset IS NULL OR p_offset<0 OR p_offset>100000
    OR p_limit IS NULL OR p_limit<1 OR p_limit>50
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_INVALID_REQUEST' USING ERRCODE='22023'; END IF;
  WITH matches AS (
    SELECT p.id,p.display_name,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('confirmationId',c.id,'validFrom',c.valid_from,'validTo',c.valid_to,
        'confirmedBy',c.confirmed_by,'confirmedAt',c.confirmed_at) ORDER BY c.valid_from,c.id),'[]'::jsonb)
        FROM public.preschool_teacher_branch_confirmations c
        WHERE c.tenant_id=p_tenant_id AND c.branch_id=p_branch_id AND c.teacher_party_id=p.id
          AND c.revoked_at IS NULL AND c.valid_from<=p_on_date AND (c.valid_to IS NULL OR c.valid_to>=p_on_date)) confirmations
    FROM public.party_parties p WHERE p.tenant_id=p_tenant_id AND p.party_type='person' AND p.deleted_at IS NULL
      AND btrim(p.display_name)<>'' AND (btrim(p_query)='' OR strpos(lower(p.display_name),lower(btrim(p_query)))>0)
  ), filtered AS (SELECT * FROM matches WHERE NOT p_confirmed_only OR jsonb_array_length(confirmations)>0),
  page AS (SELECT * FROM filtered ORDER BY display_name,id OFFSET p_offset LIMIT p_limit)
  SELECT jsonb_build_object('tenantId',p_tenant_id,'branchId',p_branch_id,'onDate',p_on_date,
    'confirmedOnly',p_confirmed_only,'offset',p_offset,'limit',p_limit,'filteredTotal',(SELECT count(*) FROM filtered),
    'nextOffset',CASE WHEN p_offset::bigint+p_limit<(SELECT count(*) FROM filtered) AND p_offset+p_limit<=100000
      THEN p_offset+p_limit ELSE NULL END,
    'parties',(SELECT coalesce(jsonb_agg(jsonb_build_object('partyId',id,'displayName',display_name,
      'confirmations',confirmations) ORDER BY display_name,id),'[]'::jsonb) FROM page)) INTO v_result;
  PERFORM public.preschool_teacher_assert_admin(p_tenant_id,p_actor_id,p_branch_id);
  RETURN v_result;
END $$;

CREATE FUNCTION public.edu_get_preschool_course_teachers(
  p_tenant_id uuid,p_actor_id uuid,p_branch_id uuid,p_course_id uuid,p_on_date date,
  p_offset integer DEFAULT 0,p_limit integer DEFAULT 20
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
SET statement_timeout='10s' SET lock_timeout='2s' AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM public.preschool_teacher_assert_admin(p_tenant_id,p_actor_id,p_branch_id,p_course_id);
  IF p_course_id IS NULL OR p_on_date IS NULL OR NOT isfinite(p_on_date)
    OR p_offset IS NULL OR p_offset<0 OR p_offset>100000 OR p_limit IS NULL OR p_limit<1 OR p_limit>50
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_INVALID_REQUEST' USING ERRCODE='22023'; END IF;
  -- A remap/mismatched proof must not masquerade as an empty valid roster.
  IF EXISTS (SELECT 1 FROM public.teacher_assignments a
    LEFT JOIN public.preschool_teacher_branch_confirmations c ON c.id=a.canonical_teacher_confirmation_id
    WHERE a.tenant_id=p_tenant_id AND a.canonical_course_id=p_course_id
      AND (c.id IS NULL OR c.tenant_id<>a.tenant_id OR c.branch_id<>p_branch_id OR c.teacher_party_id<>a.teacher_party_id))
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_CONFIGURATION_UNAVAILABLE' USING ERRCODE='55000'; END IF;
  WITH assignments AS (
    SELECT a.assignment_id,to_jsonb(a)||jsonb_build_object('branchId',p_branch_id,
      'teacherName',CASE WHEN p.party_type='person' AND p.deleted_at IS NULL
        AND coalesce(btrim(p.display_name),'')<>'' THEN p.display_name ELSE NULL END,
      'effectiveOnDate',a.status='active' AND a.effective_start_date<=p_on_date
        AND (a.effective_end_date IS NULL OR a.effective_end_date>=p_on_date),
      'eligibility',CASE WHEN p.id IS NULL OR p.party_type<>'person' OR p.deleted_at IS NOT NULL
        OR coalesce(btrim(p.display_name),'')='' THEN 'identity_unavailable'
        WHEN c.revoked_at IS NOT NULL THEN 'confirmation_revoked'
        WHEN c.valid_from>p_on_date OR (c.valid_to IS NOT NULL AND c.valid_to<p_on_date) THEN 'outside_confirmation_dates'
        ELSE 'confirmed' END) data
    FROM public.teacher_assignments a JOIN public.preschool_teacher_branch_confirmations c ON c.id=a.canonical_teacher_confirmation_id
    LEFT JOIN public.party_parties p ON p.id=a.teacher_party_id AND p.tenant_id=a.tenant_id
    WHERE a.tenant_id=p_tenant_id AND a.canonical_course_id=p_course_id AND a.course_id IS NULL
  ), page AS (SELECT * FROM assignments ORDER BY assignment_id OFFSET p_offset LIMIT p_limit)
  SELECT jsonb_build_object('tenantId',p_tenant_id,'branchId',p_branch_id,'courseId',p_course_id,'onDate',p_on_date,
    'offset',p_offset,'limit',p_limit,'total',(SELECT count(*) FROM assignments),
    'nextOffset',CASE WHEN p_offset::bigint+p_limit<(SELECT count(*) FROM assignments) AND p_offset+p_limit<=100000
      THEN p_offset+p_limit ELSE NULL END,
    'assignments',(SELECT coalesce(jsonb_agg(data ORDER BY assignment_id),'[]'::jsonb) FROM page)) INTO v_result;
  PERFORM public.preschool_teacher_assert_admin(p_tenant_id,p_actor_id,p_branch_id,p_course_id);
  RETURN v_result;
END $$;

-- Only the six named, bounded capabilities become callable by the trusted server.
REVOKE ALL ON FUNCTION public.preschool_confirm_teacher(uuid,uuid,uuid,uuid,uuid,date,date,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.preschool_revoke_teacher_confirmation(uuid,uuid,uuid,uuid,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.edu_assign_preschool_teacher(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.edu_terminate_preschool_teacher(uuid,uuid,uuid,uuid,uuid,date)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.preschool_teacher_candidates(uuid,uuid,uuid,text,boolean,date,integer,integer)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.edu_get_preschool_course_teachers(uuid,uuid,uuid,uuid,date,integer,integer)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preschool_confirm_teacher(uuid,uuid,uuid,uuid,uuid,date,date,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.preschool_revoke_teacher_confirmation(uuid,uuid,uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.edu_assign_preschool_teacher(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.edu_terminate_preschool_teacher(uuid,uuid,uuid,uuid,uuid,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.preschool_teacher_candidates(uuid,uuid,uuid,text,boolean,date,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.edu_get_preschool_course_teachers(uuid,uuid,uuid,uuid,date,integer,integer) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
