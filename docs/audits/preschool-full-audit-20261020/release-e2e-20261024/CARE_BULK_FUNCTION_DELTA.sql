CREATE OR REPLACE FUNCTION public.preschool_save_care_records(p_tenant_id uuid, p_course_id uuid, p_day date, p_records jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE rec jsonb; party_id uuid; v_session_id uuid; stamp timestamptz:=clock_timestamp(); count_saved integer:=0; affected integer;
BEGIN
 IF current_setting('role',true)<>'authenticated' OR auth.uid() IS NULL
 OR p_day IS DISTINCT FROM (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
 OR NOT EXISTS (SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
 WHERE u.id=auth.uid() AND u.tenant_id=p_tenant_id AND u.status='active' AND u.role='admin'
 AND t.status='active' AND t.product_key='bella_preschool')
 OR NOT public.edu_attendance_can_read_course(p_tenant_id,p_course_id)
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='CARE_ACCESS_DENIED'; END IF;
 IF jsonb_typeof(p_records) IS DISTINCT FROM 'array' THEN
 RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_RECORDS'; END IF;
 IF jsonb_array_length(p_records)=0 THEN
 RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_TARGETS_REQUIRED'; END IF;
 -- Validate every field and every target before creating a session or writing.
 FOR rec IN SELECT value FROM jsonb_array_elements(p_records) LOOP
  IF jsonb_typeof(rec) IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_RECORD'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(rec) AS keys(key) WHERE keys.key NOT IN ('studentPartyId','meal','nap','hygiene','note'))
  OR jsonb_typeof(rec->'studentPartyId') IS DISTINCT FROM 'string'
  OR (rec ? 'note' AND jsonb_typeof(rec->'note') IS DISTINCT FROM 'string')
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_RECORD'; END IF;
  party_id:=(rec->>'studentPartyId')::uuid;
  IF NOT EXISTS (SELECT 1 FROM public.edu_enrollments e WHERE e.tenant_id=p_tenant_id
   AND e.course_id=p_course_id AND e.student_party_id=party_id)
  THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='CARE_STUDENT_ACCESS_DENIED'; END IF;
  IF rec ? 'meal' AND rec->'meal'<>'null'::jsonb THEN
   IF jsonb_typeof(rec->'meal') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_MEAL'; END IF;
   IF coalesce(rec->'meal'->>'portion','') NOT IN ('ALL','HALF','FEW','NONE')
   OR EXISTS (SELECT 1 FROM jsonb_object_keys(rec->'meal') AS keys(key) WHERE keys.key NOT IN ('portion','notes'))
   OR (rec->'meal' ? 'notes' AND jsonb_typeof(rec->'meal'->'notes') IS DISTINCT FROM 'string')
   THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_MEAL'; END IF;
  END IF;
  IF rec ? 'nap' AND rec->'nap'<>'null'::jsonb THEN
   IF jsonb_typeof(rec->'nap') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_NAP'; END IF;
   IF coalesce(rec->'nap'->>'quality','') NOT IN ('DEEP','RESTLESS','REFUSED')
   OR EXISTS (SELECT 1 FROM jsonb_object_keys(rec->'nap') AS keys(key) WHERE keys.key NOT IN ('quality','notes'))
   OR (rec->'nap' ? 'notes' AND jsonb_typeof(rec->'nap'->'notes') IS DISTINCT FROM 'string')
   THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_NAP'; END IF;
  END IF;
  IF rec ? 'hygiene' AND rec->'hygiene'<>'null'::jsonb THEN
   IF jsonb_typeof(rec->'hygiene') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_HYGIENE'; END IF;
   IF coalesce(rec->'hygiene'->>'type','') NOT IN ('TOILET','DIAPER','BOWEL_MOVEMENT')
   OR EXISTS (SELECT 1 FROM jsonb_object_keys(rec->'hygiene') AS keys(key) WHERE keys.key NOT IN ('type','notes'))
   OR (rec->'hygiene' ? 'notes' AND jsonb_typeof(rec->'hygiene'->'notes') IS DISTINCT FROM 'string')
   THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_HYGIENE'; END IF;
  END IF;
 END LOOP;
 IF (SELECT count(DISTINCT (v->>'studentPartyId')::uuid) FROM jsonb_array_elements(p_records) v)<>jsonb_array_length(p_records)
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_DUPLICATE_TARGET'; END IF;
 INSERT INTO public.edu_daily_care_sessions(tenant_id,class_id,date,status)
 VALUES(p_tenant_id,p_course_id,p_day,'OPEN') ON CONFLICT(tenant_id,class_id,date) DO NOTHING RETURNING id INTO v_session_id;
 IF v_session_id IS NULL THEN
 SELECT s.id INTO STRICT v_session_id FROM public.edu_daily_care_sessions s
 WHERE s.tenant_id=p_tenant_id AND s.class_id=p_course_id AND s.date=p_day;
 END IF;
  INSERT INTO public.edu_daily_care_records AS target(tenant_id,session_id,student_party_id,arrival_status,morning_condition,meal_records,nap_records,hygiene_records,updated_at)
  SELECT p_tenant_id,v_session_id,(input.rec->>'studentPartyId')::uuid,'PRESENT',coalesce(input.rec->>'note',''),
   CASE WHEN input.rec->'meal' IS NOT NULL AND input.rec->'meal'<>'null'::jsonb
    THEN jsonb_build_array(jsonb_build_object('mealType','LUNCH','portion',input.rec->'meal'->>'portion','notes',coalesce(input.rec->'meal'->>'notes',''),'recordedAt',stamp)) ELSE '[]'::jsonb END,
   CASE WHEN input.rec->'nap' IS NOT NULL AND input.rec->'nap'<>'null'::jsonb
    THEN jsonb_build_object('quality',input.rec->'nap'->>'quality','notes',coalesce(input.rec->'nap'->>'notes',''),'updatedAt',stamp) ELSE '{}'::jsonb END,
   CASE WHEN input.rec->'hygiene' IS NOT NULL AND input.rec->'hygiene'<>'null'::jsonb
    THEN jsonb_build_array(jsonb_build_object('type',input.rec->'hygiene'->>'type','notes',coalesce(input.rec->'hygiene'->>'notes',''),'time',stamp)) ELSE '[]'::jsonb END,stamp
  FROM jsonb_array_elements(p_records) WITH ORDINALITY AS input(rec,ordinal)
  ORDER BY input.ordinal
  ON CONFLICT(session_id,student_party_id) WHERE student_party_id IS NOT NULL
  DO UPDATE SET morning_condition=excluded.morning_condition,meal_records=excluded.meal_records,
   nap_records=excluded.nap_records,hygiene_records=excluded.hygiene_records,updated_at=excluded.updated_at
  WHERE target.tenant_id=p_tenant_id;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>jsonb_array_length(p_records) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='CARE_WRITE_NOT_CONFIRMED'; END IF;
  count_saved:=affected;
 RETURN jsonb_build_object('savedCount',count_saved,'total',jsonb_array_length(p_records));
END;
$function$
;
