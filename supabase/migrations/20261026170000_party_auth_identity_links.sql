-- Platform Party identity links; owner-approved local/E2E scope only.
-- No provisioning of real identities, grants, tenant settings or Product permissions.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';

CREATE TABLE public.party_identity_link_managers (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  valid_from timestamptz NOT NULL CHECK(isfinite(valid_from)),
  valid_until timestamptz NULL CHECK(valid_until IS NULL OR (isfinite(valid_until) AND valid_until>valid_from)),
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reference text NOT NULL CHECK(length(reference) BETWEEN 1 AND 500 AND reference=btrim(reference) AND reference!~'[[:cntrl:]]'),
  revoked_at timestamptz NULL,
  revoked_by uuid NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  revocation_reason text NULL,
  CHECK ((revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL)
    OR (revoked_at IS NOT NULL AND isfinite(revoked_at) AND revoked_by IS NOT NULL
      AND revocation_reason IS NOT NULL AND length(revocation_reason) BETWEEN 1 AND 500
      AND revocation_reason=btrim(revocation_reason) AND revocation_reason!~'[[:cntrl:]]'))
);
ALTER TABLE public.party_identity_link_managers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.party_identity_link_managers FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON TABLE public.party_identity_link_managers IS
  'Explicit tenant identity-link management grant. Trusted DB-owner provisioning only; no role/config fallback or public provisioning command.';

CREATE TABLE public.party_auth_links (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  party_id uuid NOT NULL REFERENCES public.party_parties(id) ON DELETE RESTRICT,
  valid_from timestamptz NOT NULL CHECK(isfinite(valid_from)),
  valid_until timestamptz NULL CHECK(valid_until IS NULL OR (isfinite(valid_until) AND valid_until>valid_from)),
  confirmed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  attestation text NOT NULL CHECK(length(attestation) BETWEEN 1 AND 500 AND attestation=btrim(attestation) AND attestation!~'[[:cntrl:]]'),
  revoked_at timestamptz NULL,
  revoked_by uuid NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  revocation_reason text NULL,
  CHECK ((revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL)
    OR (revoked_at IS NOT NULL AND isfinite(revoked_at) AND revoked_by IS NOT NULL
      AND revocation_reason IS NOT NULL AND length(revocation_reason) BETWEEN 1 AND 500
      AND revocation_reason=btrim(revocation_reason) AND revocation_reason!~'[[:cntrl:]]'))
);
ALTER TABLE public.party_auth_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.party_auth_links FROM PUBLIC,anon,authenticated,service_role;
-- A non-revoked link reserves both identities, including scheduled/expired links.
-- Replacement requires explicit revocation; never rewrite the old identity pair.
-- zero-downtime: allow blocking-index - reviewed new empty table in this transaction; no existing data is indexed.
CREATE UNIQUE INDEX party_auth_links_live_user ON public.party_auth_links(tenant_id,auth_user_id) WHERE revoked_at IS NULL;
-- zero-downtime: allow blocking-index - reviewed new empty table in this transaction; no existing data is indexed.
CREATE UNIQUE INDEX party_auth_links_live_party ON public.party_auth_links(tenant_id,party_id) WHERE revoked_at IS NULL;
COMMENT ON TABLE public.party_auth_links IS
  'Attested Auth subject to Party identity evidence. Not a Product role, employment record, teacher assignment or business authorization.';

CREATE FUNCTION public.party_auth_link_preserve_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $history$
BEGIN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['revoked_at','revoked_by','revocation_reason'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['revoked_at','revoked_by','revocation_reason'])
    OR (OLD.revoked_at IS NOT NULL AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD)) THEN
    RAISE EXCEPTION 'PARTY_AUTH_LINK_HISTORY_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$history$;
REVOKE ALL ON FUNCTION public.party_auth_link_preserve_history() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER party_auth_link_history BEFORE UPDATE OR DELETE ON public.party_auth_links
  FOR EACH ROW EXECUTE FUNCTION public.party_auth_link_preserve_history();
CREATE TRIGGER party_auth_link_manager_history BEFORE UPDATE OR DELETE ON public.party_identity_link_managers
  FOR EACH ROW EXECUTE FUNCTION public.party_auth_link_preserve_history();

CREATE FUNCTION public.party_auth_link_context(p_manage boolean,p_lock boolean DEFAULT false)
RETURNS TABLE(actor_id uuid,tenant_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $context$
DECLARE v_actor uuid:=auth.uid(); v_profile record; v_grant uuid;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'authenticated' OR v_actor IS NULL THEN
    RAISE EXCEPTION 'PARTY_AUTH_LINK_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'PARTY_AUTH_LINK_READ_COMMITTED_REQUIRED' USING ERRCODE='40001';
  END IF;
  IF p_lock THEN
    PERFORM 1 FROM auth.users a JOIN public.users u ON u.id=a.id JOIN public.tenants t ON t.id=u.tenant_id
      WHERE a.id=v_actor FOR SHARE OF a,u,t;
  END IF;
  SELECT * INTO v_profile FROM public.platform_current_actor_profile();
  IF NOT FOUND OR v_profile.id IS DISTINCT FROM v_actor OR v_profile.status IS DISTINCT FROM 'active'
    OR v_profile.tenant_status IS DISTINCT FROM 'active' OR v_profile.tenant_id IS NULL
    OR (p_manage AND v_profile.role IS DISTINCT FROM 'admin') THEN
    RAISE EXCEPTION 'PARTY_AUTH_LINK_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
  IF p_manage THEN
    IF p_lock THEN
      PERFORM 1 FROM public.party_identity_link_managers g
        WHERE g.tenant_id=v_profile.tenant_id AND g.auth_user_id=v_actor AND g.revoked_at IS NULL
          AND g.valid_from<=clock_timestamp() AND (g.valid_until IS NULL OR g.valid_until>clock_timestamp())
        ORDER BY g.id FOR SHARE;
    END IF;
    SELECT g.id INTO v_grant FROM public.party_identity_link_managers g
      WHERE g.tenant_id=v_profile.tenant_id AND g.auth_user_id=v_actor AND g.revoked_at IS NULL
        AND g.valid_from<=clock_timestamp() AND (g.valid_until IS NULL OR g.valid_until>clock_timestamp())
      ORDER BY g.id LIMIT 1;
    IF v_grant IS NULL THEN RAISE EXCEPTION 'PARTY_AUTH_LINK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN QUERY SELECT v_actor,v_profile.tenant_id::uuid;
END;
$context$;
REVOKE ALL ON FUNCTION public.party_auth_link_context(boolean,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.party_auth_link_receipt(p_row public.party_auth_links) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $receipt$
  SELECT jsonb_build_object('id',p_row.id,'tenantId',p_row.tenant_id,'authUserId',p_row.auth_user_id,
    'partyId',p_row.party_id,'validFrom',p_row.valid_from,'validUntil',p_row.valid_until,
    'confirmedBy',p_row.confirmed_by,'confirmedAt',p_row.confirmed_at,'attestation',p_row.attestation,
    'revokedAt',p_row.revoked_at,'revokedBy',p_row.revoked_by,'revocationReason',p_row.revocation_reason);
$receipt$;
REVOKE ALL ON FUNCTION public.party_auth_link_receipt(public.party_auth_links) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.party_confirm_auth_link(
  p_operation_key uuid,p_auth_user_id uuid,p_party_id uuid,p_valid_from timestamptz,
  p_valid_until timestamptz,p_attestation text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $confirm$
DECLARE c record; r public.party_auth_links%ROWTYPE; v_tenant uuid;
BEGIN
  SELECT * INTO c FROM public.party_auth_link_context(true,false);
  v_tenant:=c.tenant_id;
  IF p_operation_key IS NULL OR p_auth_user_id IS NULL OR p_party_id IS NULL OR p_valid_from IS NULL
    OR NOT isfinite(p_valid_from) OR (p_valid_until IS NOT NULL AND (NOT isfinite(p_valid_until) OR p_valid_until<=p_valid_from))
    OR p_attestation IS NULL OR length(p_attestation) NOT BETWEEN 1 AND 500
    OR p_attestation<>btrim(p_attestation) OR p_attestation~'[[:cntrl:]]' THEN
    RAISE EXCEPTION 'PARTY_AUTH_LINK_INVALID_INPUT' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('party-auth-link:request:'||p_operation_key::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('party-auth-link:user:'||p_auth_user_id::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('party-auth-link:party:'||p_party_id::text,0));
  PERFORM 1 FROM auth.users a JOIN public.users u ON u.id=a.id
    WHERE a.id=p_auth_user_id AND u.tenant_id=c.tenant_id AND u.status='active'
      AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp()) FOR SHARE OF a,u;
  IF NOT FOUND THEN RAISE EXCEPTION 'PARTY_AUTH_LINK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.party_parties p WHERE p.id=p_party_id AND p.tenant_id=c.tenant_id
    AND p.party_type='person' AND p.deleted_at IS NULL AND btrim(p.display_name)<>'' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PARTY_AUTH_LINK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.party_auth_link_context(true,true);
  IF c.tenant_id IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION 'PARTY_AUTH_LINK_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO r FROM public.party_auth_links WHERE id=p_operation_key FOR UPDATE;
  IF FOUND THEN
    IF r.tenant_id<>c.tenant_id OR r.confirmed_by<>c.actor_id OR r.auth_user_id<>p_auth_user_id
      OR r.party_id<>p_party_id OR r.valid_from<>p_valid_from OR r.valid_until IS DISTINCT FROM p_valid_until
      OR r.attestation<>p_attestation THEN
      RAISE EXCEPTION 'PARTY_AUTH_LINK_CONFLICT' USING ERRCODE='P0001';
    END IF;
    PERFORM 1 FROM public.party_auth_link_context(true,false);
    RETURN public.party_auth_link_receipt(r);
  END IF;
  INSERT INTO public.party_auth_links(id,tenant_id,auth_user_id,party_id,valid_from,valid_until,confirmed_by,attestation)
    VALUES(p_operation_key,c.tenant_id,p_auth_user_id,p_party_id,p_valid_from,p_valid_until,c.actor_id,p_attestation) RETURNING * INTO r;
  PERFORM 1 FROM public.party_auth_link_context(true,false);
  RETURN public.party_auth_link_receipt(r);
END;
$confirm$;

CREATE FUNCTION public.party_revoke_auth_link(p_link_id uuid,p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $revoke$
DECLARE c record; r public.party_auth_links%ROWTYPE; v_tenant uuid;
BEGIN
  SELECT * INTO c FROM public.party_auth_link_context(true,false);
  v_tenant:=c.tenant_id;
  IF p_link_id IS NULL OR p_reason IS NULL OR length(p_reason) NOT BETWEEN 1 AND 500
    OR p_reason<>btrim(p_reason) OR p_reason~'[[:cntrl:]]' THEN
    RAISE EXCEPTION 'PARTY_AUTH_LINK_INVALID_INPUT' USING ERRCODE='22023';
  END IF;
  SELECT * INTO r FROM public.party_auth_links WHERE id=p_link_id AND tenant_id=c.tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PARTY_AUTH_LINK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('party-auth-link:request:'||p_link_id::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('party-auth-link:user:'||r.auth_user_id::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('party-auth-link:party:'||r.party_id::text,0));
  PERFORM 1 FROM auth.users a JOIN public.users u ON u.id=a.id
    WHERE a.id=r.auth_user_id AND u.tenant_id=c.tenant_id AND u.status='active'
      AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp()) FOR SHARE OF a,u;
  IF NOT FOUND THEN RAISE EXCEPTION 'PARTY_AUTH_LINK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.party_parties p WHERE p.id=r.party_id AND p.tenant_id=c.tenant_id
    AND p.party_type='person' AND p.deleted_at IS NULL AND btrim(p.display_name)<>'' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PARTY_AUTH_LINK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.party_auth_link_context(true,true);
  IF c.tenant_id IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION 'PARTY_AUTH_LINK_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO r FROM public.party_auth_links WHERE id=p_link_id AND tenant_id=c.tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PARTY_AUTH_LINK_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF r.revoked_at IS NOT NULL THEN
    IF r.revoked_by<>c.actor_id OR r.revocation_reason<>p_reason THEN
      RAISE EXCEPTION 'PARTY_AUTH_LINK_CONFLICT' USING ERRCODE='P0001';
    END IF;
  ELSE
    UPDATE public.party_auth_links SET revoked_at=clock_timestamp(),revoked_by=c.actor_id,revocation_reason=p_reason
      WHERE id=p_link_id RETURNING * INTO r;
  END IF;
  PERFORM 1 FROM public.party_auth_link_context(true,false);
  RETURN public.party_auth_link_receipt(r);
END;
$revoke$;

CREATE FUNCTION public.party_resolve_current_auth_link() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $resolve$
DECLARE c record; r public.party_auth_links%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.party_auth_link_context(false,false);
  SELECT l.* INTO r FROM public.party_auth_links l JOIN public.party_parties p ON p.id=l.party_id AND p.tenant_id=l.tenant_id
    WHERE l.auth_user_id=c.actor_id AND l.tenant_id=c.tenant_id AND l.revoked_at IS NULL
      AND l.valid_from<=clock_timestamp() AND (l.valid_until IS NULL OR l.valid_until>clock_timestamp())
      AND p.party_type='person' AND p.deleted_at IS NULL AND btrim(p.display_name)<>'';
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id',r.id,'tenantId',r.tenant_id,'authUserId',r.auth_user_id,
    'partyId',r.party_id,'validFrom',r.valid_from,'validUntil',r.valid_until);
END;
$resolve$;

REVOKE ALL ON FUNCTION public.party_confirm_auth_link(uuid,uuid,uuid,timestamptz,timestamptz,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.party_revoke_auth_link(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.party_resolve_current_auth_link() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.party_confirm_auth_link(uuid,uuid,uuid,timestamptz,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.party_revoke_auth_link(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.party_resolve_current_auth_link() TO authenticated;
COMMIT;
