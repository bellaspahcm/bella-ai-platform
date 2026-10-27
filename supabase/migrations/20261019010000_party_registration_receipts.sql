-- Approved additive Platform Party registration/recovery capability.
-- Party, optional identifier and registration receipt commit in one identity step.
CREATE TABLE IF NOT EXISTS public.party_registration_receipts (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  registration_key text NOT NULL CHECK (length(registration_key) BETWEEN 1 AND 200),
  actor_id uuid NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  party_id uuid NOT NULL REFERENCES public.party_parties(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, registration_key)
);
ALTER TABLE public.party_registration_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.party_registration_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.party_registration_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.party_register_or_recover(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_registration_key text,
  p_payload jsonb,
  p_reuse_identifier_type text DEFAULT NULL,
  p_reuse_identifier_value text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_receipt public.party_registration_receipts%ROWTYPE;
  v_party public.party_parties%ROWTYPE;
  v_effective_payload jsonb;
  v_identifier_party_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    JOIN auth.users a ON a.id=u.id
    WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id
      AND u.status='active' AND t.status='active'
  ) THEN RAISE EXCEPTION 'PARTY_REGISTRATION_ACTOR_DENIED' USING ERRCODE='42501'; END IF;
  IF p_registration_key IS NULL OR length(p_registration_key) NOT BETWEEN 1 AND 200
    OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
    OR coalesce(p_payload->>'displayName','')='' OR p_payload->>'partyType' IS DISTINCT FROM 'person'
    OR (p_payload->>'gender' IS NOT NULL AND p_payload->>'gender' NOT IN ('male','female','other'))
    OR ((p_reuse_identifier_type IS NULL) <> (p_reuse_identifier_value IS NULL))
    OR p_reuse_identifier_type='' OR p_reuse_identifier_value=''
  THEN RAISE EXCEPTION 'PARTY_REGISTRATION_INVALID_INPUT' USING ERRCODE='22023'; END IF;
  v_effective_payload := jsonb_build_object('person',p_payload,
    'identifierType',p_reuse_identifier_type,'identifierValue',p_reuse_identifier_value);
  PERFORM pg_advisory_xact_lock(hashtextextended('party-request:'||p_tenant_id||':'||p_registration_key,0));
  IF p_reuse_identifier_type IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('party-identifier:'||p_tenant_id||':'||p_reuse_identifier_type||':'||p_reuse_identifier_value,0));
  END IF;
  -- Recheck after every potentially blocking identity lock and hold authority
  -- until the identity transaction commits. No Product role is inferred here.
  PERFORM 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id JOIN auth.users a ON a.id=u.id
    WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id AND u.status='active' AND t.status='active'
    FOR SHARE OF u,t,a;
  IF NOT FOUND THEN RAISE EXCEPTION 'PARTY_REGISTRATION_ACTOR_DENIED' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_receipt FROM public.party_registration_receipts
    WHERE tenant_id=p_tenant_id AND registration_key=p_registration_key;
  IF FOUND THEN
    IF v_receipt.actor_id<>p_actor_id THEN
      RAISE EXCEPTION 'PARTY_REGISTRATION_ACTOR_DENIED' USING ERRCODE='42501';
    END IF;
    IF v_receipt.payload<>v_effective_payload THEN
      RAISE EXCEPTION 'PARTY_REGISTRATION_PAYLOAD_CONFLICT' USING ERRCODE='P0001';
    END IF;
    SELECT * INTO v_party FROM public.party_parties
      WHERE id=v_receipt.party_id AND tenant_id=p_tenant_id AND party_type='person' AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'PARTY_REGISTRATION_CANONICAL_PARTY_MISSING'; END IF;
    IF p_reuse_identifier_type IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.party_identifiers WHERE tenant_id=p_tenant_id
        AND party_id=v_party.id AND identifier_type=p_reuse_identifier_type
        AND identifier_value=p_reuse_identifier_value
    ) THEN RAISE EXCEPTION 'PARTY_REGISTRATION_CANONICAL_IDENTIFIER_MISSING'; END IF;
    RETURN jsonb_build_object('partyId',v_party.id,'displayName',v_party.display_name,'dateOfBirth',v_party.dob,'gender',v_party.gender);
  END IF;
  IF p_reuse_identifier_type IS NOT NULL THEN
    -- Lock before creating a Party, so a losing identifier race leaves no shell.
    SELECT party_id INTO v_identifier_party_id FROM public.party_identifiers
      WHERE tenant_id=p_tenant_id AND identifier_type=p_reuse_identifier_type AND identifier_value=p_reuse_identifier_value;
    IF FOUND THEN
      SELECT * INTO v_party FROM public.party_parties WHERE id=v_identifier_party_id
        AND tenant_id=p_tenant_id AND party_type='person' AND deleted_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'PARTY_REGISTRATION_CANONICAL_IDENTIFIER_INVALID'; END IF;
    END IF;
  END IF;
  IF v_party.id IS NULL THEN
    -- A concurrent legacy writer may not take our advisory lock. Its identifier
    -- uniqueness conflict rolls this subtransaction back, including our Party.
    BEGIN
      INSERT INTO public.party_parties(tenant_id,party_type,display_name,legal_name,dob,gender,created_by,updated_by)
        VALUES(p_tenant_id,'person',p_payload->>'displayName',p_payload->>'legalName',
          (p_payload->>'dob')::date,p_payload->>'gender',p_actor_id,p_actor_id)
        RETURNING * INTO v_party;
      IF p_reuse_identifier_type IS NOT NULL THEN
        INSERT INTO public.party_identifiers(tenant_id,party_id,identifier_type,identifier_value)
          VALUES(p_tenant_id,v_party.id,p_reuse_identifier_type,p_reuse_identifier_value);
      END IF;
    EXCEPTION WHEN unique_violation THEN
      IF p_reuse_identifier_type IS NULL THEN RAISE; END IF;
      SELECT p.* INTO v_party FROM public.party_identifiers i JOIN public.party_parties p ON p.id=i.party_id
        WHERE i.tenant_id=p_tenant_id AND p.tenant_id=p_tenant_id
          AND i.identifier_type=p_reuse_identifier_type AND i.identifier_value=p_reuse_identifier_value
          AND p.party_type='person' AND p.deleted_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'PARTY_REGISTRATION_IDENTIFIER_RACE_UNRESOLVED'; END IF;
    END;
  END IF;
  INSERT INTO public.party_registration_receipts(tenant_id,registration_key,actor_id,payload,party_id)
    VALUES(p_tenant_id,p_registration_key,p_actor_id,v_effective_payload,v_party.id);
  RETURN jsonb_build_object('partyId',v_party.id,'displayName',v_party.display_name,'dateOfBirth',v_party.dob,'gender',v_party.gender);
END;
$$;
REVOKE ALL ON FUNCTION public.party_register_or_recover(uuid,uuid,text,jsonb,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.party_register_or_recover(uuid,uuid,text,jsonb,text,text) TO service_role;
COMMENT ON TABLE public.party_registration_receipts IS
  'Platform Party request identity receipt; not an authorization grant or workflow checkpoint.';
