BEGIN;

-- Education-owned capture only. No consumer, Finance effect or delivery claim.
CREATE TABLE public.edu_enrollment_event_records (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  enrollment_id uuid NOT NULL REFERENCES public.edu_enrollments(id) ON DELETE RESTRICT,
  request_id text NOT NULL,
  event_type text NOT NULL DEFAULT 'edu.enrollment.created.v1' CHECK (event_type='edu.enrollment.created.v1'),
  event_version text NOT NULL DEFAULT 'v1' CHECK (event_version='v1'),
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
  replay_state text NOT NULL DEFAULT 'pending' CHECK (replay_state IN ('pending','leased','retryable','intervention_required')),
  replay_attempts integer NOT NULL DEFAULT 0 CHECK (replay_attempts BETWEEN 0 AND 5),
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text CHECK (last_error_code ~ '^[A-Z0-9_]{1,80}$'),
  captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, enrollment_id),
  UNIQUE (tenant_id, request_id),
  CHECK ((replay_state='leased') = (lease_token IS NOT NULL AND lease_until IS NOT NULL)),
  CHECK (replay_state='leased' OR (lease_token IS NULL AND lease_until IS NULL))
);

CREATE TABLE public.edu_enrollment_event_replays (
  event_id uuid NOT NULL REFERENCES public.edu_enrollment_event_records(event_id) ON DELETE RESTRICT,
  replay_key uuid NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number BETWEEN 1 AND 5),
  lease_token uuid NOT NULL UNIQUE,
  lease_until timestamptz NOT NULL,
  outcome text NOT NULL DEFAULT 'leased' CHECK (outcome IN ('leased','released','failed')),
  error_code text CHECK (error_code ~ '^[A-Z0-9_]{1,80}$'),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  PRIMARY KEY (event_id,replay_key),
  UNIQUE (event_id,attempt_number),
  CHECK ((outcome='leased') = (finished_at IS NULL)),
  CHECK ((outcome='failed') = (error_code IS NOT NULL))
);

ALTER TABLE public.edu_enrollment_event_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_enrollment_event_replays ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.edu_enrollment_event_records,public.edu_enrollment_event_replays FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.edu_capture_enrollment_created_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.edu_enrollment_event_records(tenant_id,enrollment_id,request_id,occurred_at,payload)
  VALUES(NEW.tenant_id,NEW.id,NEW.request_id,NEW.created_at,
    jsonb_build_object('enrollmentId',NEW.id::text,'studentPartyId',NEW.student_party_id::text,
      'courseId',NEW.course_id::text,'status',NEW.status));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.edu_capture_enrollment_created_event() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER edu_capture_enrollment_created_event
AFTER INSERT ON public.edu_enrollments FOR EACH ROW
EXECUTE FUNCTION public.edu_capture_enrollment_created_event();

CREATE FUNCTION public.edu_require_enrollment_event(
  p_tenant_id uuid,p_request_id text,p_enrollment_id uuid,p_student_party_id uuid,p_course_id uuid
) RETURNS public.edu_enrollment_event_records
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_event public.edu_enrollment_event_records%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'EDUCATION_EVENT_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
  IF p_tenant_id IS NULL OR p_request_id IS NULL OR length(p_request_id)=0
    OR p_enrollment_id IS NULL OR p_student_party_id IS NULL OR p_course_id IS NULL THEN
    RAISE EXCEPTION 'EDUCATION_EVENT_CONTEXT_REQUIRED' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_event FROM public.edu_enrollment_event_records
    WHERE tenant_id=p_tenant_id AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_event.enrollment_id IS DISTINCT FROM p_enrollment_id
    OR (v_event.payload->>'studentPartyId')::uuid IS DISTINCT FROM p_student_party_id
    OR (v_event.payload->>'courseId')::uuid IS DISTINCT FROM p_course_id
    OR NOT EXISTS(SELECT 1 FROM public.edu_enrollments e WHERE e.id=p_enrollment_id
      AND e.tenant_id=p_tenant_id AND e.request_id=p_request_id
      AND e.student_party_id=p_student_party_id AND e.course_id=p_course_id) THEN
    RAISE EXCEPTION 'EDUCATION_EVENT_CANONICAL_CONFLICT' USING ERRCODE='23505';
  END IF;
  RETURN v_event;
END;
$$;

CREATE FUNCTION public.edu_enrollment_event_result(
  p_event public.edu_enrollment_event_records,p_replay public.edu_enrollment_event_replays DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SET search_path='' AS $$
  SELECT jsonb_build_object(
    'event',jsonb_build_object('eventId',p_event.event_id,'eventType',p_event.event_type,
      'eventVersion',p_event.event_version,'tenantId',p_event.tenant_id,
      'aggregateId',p_event.enrollment_id,'aggregateType','enrollment',
      'requestId',p_event.request_id,'occurredAt',p_event.occurred_at,'payload',p_event.payload),
    'replayState',p_event.replay_state,'attempts',p_event.replay_attempts,
    'lastErrorCode',p_event.last_error_code,'downstreamProcessing','NOT_PROVEN',
    'replay',CASE WHEN p_replay.replay_key IS NULL THEN NULL ELSE jsonb_build_object(
      'replayKey',p_replay.replay_key,'leaseToken',p_replay.lease_token,
      'leaseUntil',p_replay.lease_until,'attemptNumber',p_replay.attempt_number,
      'outcome',p_replay.outcome,'errorCode',p_replay.error_code) END);
$$;

CREATE FUNCTION public.edu_get_enrollment_created_event(
  p_tenant_id uuid,p_request_id text,p_enrollment_id uuid,p_student_party_id uuid,p_course_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_event public.edu_enrollment_event_records%ROWTYPE;
BEGIN
  v_event:=public.edu_require_enrollment_event(p_tenant_id,p_request_id,p_enrollment_id,p_student_party_id,p_course_id);
  IF v_event.event_id IS NULL THEN RETURN NULL; END IF;
  RETURN public.edu_enrollment_event_result(v_event);
END;
$$;

CREATE FUNCTION public.edu_claim_enrollment_event_replay(
  p_tenant_id uuid,p_request_id text,p_enrollment_id uuid,p_student_party_id uuid,p_course_id uuid,p_replay_key uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_event public.edu_enrollment_event_records%ROWTYPE;
  v_replay public.edu_enrollment_event_replays%ROWTYPE;
BEGIN
  v_event:=public.edu_require_enrollment_event(p_tenant_id,p_request_id,p_enrollment_id,p_student_party_id,p_course_id);
  IF v_event.event_id IS NULL THEN RAISE EXCEPTION 'EDUCATION_EVENT_NOT_CAPTURED' USING ERRCODE='P0002'; END IF;
  IF p_replay_key IS NULL THEN RAISE EXCEPTION 'EDUCATION_EVENT_REPLAY_KEY_REQUIRED' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_replay FROM public.edu_enrollment_event_replays
    WHERE event_id=v_event.event_id AND replay_key=p_replay_key;
  IF FOUND THEN
    -- Receipt recovery never grants a new lease or replays a completed attempt.
    IF v_replay.outcome='leased' AND v_replay.lease_until<=clock_timestamp() THEN
      RAISE EXCEPTION 'EDUCATION_EVENT_REPLAY_EXPIRED' USING ERRCODE='55000';
    END IF;
    RETURN public.edu_enrollment_event_result(v_event,v_replay);
  END IF;
  IF v_event.replay_state='leased' THEN
    IF v_event.lease_until>clock_timestamp() THEN
      RAISE EXCEPTION 'EDUCATION_EVENT_REPLAY_BUSY' USING ERRCODE='55P03';
    END IF;
    UPDATE public.edu_enrollment_event_replays SET outcome='failed',error_code='LEASE_EXPIRED',finished_at=clock_timestamp()
      WHERE event_id=v_event.event_id AND lease_token=v_event.lease_token AND outcome='leased';
    UPDATE public.edu_enrollment_event_records SET replay_state=CASE WHEN replay_attempts>=5 THEN 'intervention_required' ELSE 'retryable' END,
      lease_token=NULL,lease_until=NULL,last_error_code='LEASE_EXPIRED'
      WHERE event_id=v_event.event_id RETURNING * INTO v_event;
  END IF;
  IF v_event.replay_attempts>=5 OR v_event.replay_state='intervention_required' THEN
    -- A response is returned so lease expiry/exhaustion state commits durably.
    RETURN public.edu_enrollment_event_result(v_event);
  END IF;
  INSERT INTO public.edu_enrollment_event_replays(event_id,replay_key,attempt_number,lease_token,lease_until)
    VALUES(v_event.event_id,p_replay_key,v_event.replay_attempts+1,gen_random_uuid(),clock_timestamp()+interval '30 seconds')
    RETURNING * INTO v_replay;
  UPDATE public.edu_enrollment_event_records SET replay_attempts=v_replay.attempt_number,
    replay_state='leased',lease_token=v_replay.lease_token,lease_until=v_replay.lease_until
    WHERE event_id=v_event.event_id RETURNING * INTO v_event;
  RETURN public.edu_enrollment_event_result(v_event,v_replay);
END;
$$;

CREATE FUNCTION public.edu_finish_enrollment_event_replay(
  p_tenant_id uuid,p_request_id text,p_enrollment_id uuid,p_student_party_id uuid,p_course_id uuid,
  p_replay_key uuid,p_lease_token uuid,p_outcome text,p_error_code text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_event public.edu_enrollment_event_records%ROWTYPE;
  v_replay public.edu_enrollment_event_replays%ROWTYPE;
BEGIN
  v_event:=public.edu_require_enrollment_event(p_tenant_id,p_request_id,p_enrollment_id,p_student_party_id,p_course_id);
  IF v_event.event_id IS NULL THEN RAISE EXCEPTION 'EDUCATION_EVENT_NOT_CAPTURED' USING ERRCODE='P0002'; END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('released','failed')
    OR (p_outcome='released' AND p_error_code IS NOT NULL)
    OR (p_outcome='failed' AND (p_error_code IS NULL OR p_error_code !~ '^[A-Z0-9_]{1,80}$')) THEN
    RAISE EXCEPTION 'EDUCATION_EVENT_REPLAY_OUTCOME_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_replay FROM public.edu_enrollment_event_replays
    WHERE event_id=v_event.event_id AND replay_key=p_replay_key;
  IF NOT FOUND OR v_replay.lease_token IS DISTINCT FROM p_lease_token THEN
    RAISE EXCEPTION 'EDUCATION_EVENT_REPLAY_CONFLICT' USING ERRCODE='23505';
  END IF;
  IF v_replay.outcome<>'leased' THEN
    IF v_replay.outcome IS DISTINCT FROM p_outcome OR v_replay.error_code IS DISTINCT FROM p_error_code THEN
      RAISE EXCEPTION 'EDUCATION_EVENT_REPLAY_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN public.edu_enrollment_event_result(v_event,v_replay);
  END IF;
  IF v_event.lease_token IS DISTINCT FROM p_lease_token OR v_replay.lease_until<=clock_timestamp() THEN
    RAISE EXCEPTION 'EDUCATION_EVENT_REPLAY_EXPIRED' USING ERRCODE='55000';
  END IF;
  UPDATE public.edu_enrollment_event_replays SET outcome=p_outcome,error_code=p_error_code,finished_at=clock_timestamp()
    WHERE event_id=v_event.event_id AND replay_key=p_replay_key RETURNING * INTO v_replay;
  UPDATE public.edu_enrollment_event_records SET replay_state=CASE WHEN replay_attempts>=5 THEN 'intervention_required'
      WHEN p_outcome='failed' THEN 'retryable' ELSE 'pending' END,
    lease_token=NULL,lease_until=NULL,last_error_code=p_error_code
    WHERE event_id=v_event.event_id RETURNING * INTO v_event;
  RETURN public.edu_enrollment_event_result(v_event,v_replay);
END;
$$;

REVOKE ALL ON FUNCTION public.edu_require_enrollment_event(uuid,text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.edu_enrollment_event_result(public.edu_enrollment_event_records,public.edu_enrollment_event_replays) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.edu_get_enrollment_created_event(uuid,text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.edu_claim_enrollment_event_replay(uuid,text,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.edu_finish_enrollment_event_replay(uuid,text,uuid,uuid,uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.edu_get_enrollment_created_event(uuid,text,uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.edu_claim_enrollment_event_replay(uuid,text,uuid,uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.edu_finish_enrollment_event_replay(uuid,text,uuid,uuid,uuid,uuid,uuid,text,text) TO service_role;

COMMENT ON TABLE public.edu_enrollment_event_records IS
  'Education-owned immutable capture at enrollment INSERT. Replay state is not a delivery or consumer-processing acknowledgement. No historical backfill.';
COMMENT ON TABLE public.edu_enrollment_event_replays IS
  'Bounded controlled replay attempts. released means the envelope lease was released, never delivered or processed.';

COMMIT;
