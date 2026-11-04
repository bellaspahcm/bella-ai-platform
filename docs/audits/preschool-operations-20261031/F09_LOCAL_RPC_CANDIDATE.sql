-- LOCAL TEST CANDIDATE ONLY. Not a deployment migration.
-- Requires the two existing Weekly Menu migrations in an isolated test stack.
BEGIN;
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='preschool_weekly_menu_executor') THEN
    CREATE ROLE preschool_weekly_menu_executor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;
  END IF;
END
$role$;
-- Remove memberships left by earlier local candidate revisions before applying
-- the least-privilege grants below.
REVOKE authenticated FROM preschool_weekly_menu_executor;
-- The local migration role needs temporary membership to replace/change owner
-- of this function. Revoke it again before commit so it is not persistent.
GRANT preschool_weekly_menu_executor TO postgres WITH SET TRUE;
GRANT USAGE ON SCHEMA public TO preschool_weekly_menu_executor;
GRANT EXECUTE ON FUNCTION public.platform_current_actor_profile() TO preschool_weekly_menu_executor;
GRANT SELECT ON public.users, public.tenants TO preschool_weekly_menu_executor;
-- PostgreSQL row locks require UPDATE privilege; executor is NOLOGIN and is
-- never granted to callers. The function only locks these rows, never updates them.
GRANT UPDATE (id) ON public.users, public.tenants TO preschool_weekly_menu_executor;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edu_weekly_menus, public.edu_weekly_menu_days TO preschool_weekly_menu_executor;
-- The current platform users policies target authenticated. Give this non-login
-- function owner visibility of only the actor row needed for its locked check.
DROP POLICY IF EXISTS preschool_weekly_menu_executor_actor_read ON public.users;
CREATE POLICY preschool_weekly_menu_executor_actor_read ON public.users
  FOR SELECT TO preschool_weekly_menu_executor
  USING (id = (SELECT a.id FROM public.platform_current_actor_profile() a) AND status = 'active');
-- FOR SHARE row locking also needs an UPDATE policy; column privilege remains
-- limited to id and this policy cannot move the actor row to another identity.
DROP POLICY IF EXISTS preschool_weekly_menu_executor_actor_lock ON public.users;
CREATE POLICY preschool_weekly_menu_executor_actor_lock ON public.users
  FOR UPDATE TO preschool_weekly_menu_executor
  USING (id = (SELECT a.id FROM public.platform_current_actor_profile() a) AND status = 'active')
  WITH CHECK (id = (SELECT a.id FROM public.platform_current_actor_profile() a) AND status = 'active');

CREATE OR REPLACE FUNCTION public.preschool_save_weekly_menu(p_tenant_id uuid, p_actor_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_menu_id uuid;
  v_current public.edu_weekly_menus%ROWTYPE;
  v_version timestamptz;
  v_day jsonb;
  v_seen text[] := ARRAY[]::text[];
  v_start date;
  v_end date;
  v_status text;
  v_actor_id uuid;
BEGIN
  SELECT a.id INTO v_actor_id FROM public.platform_current_actor_profile() a;
  IF v_actor_id IS NULL OR p_actor_id IS NULL OR v_actor_id <> p_actor_id OR p_tenant_id IS NULL OR p_payload IS NULL THEN
    RAISE EXCEPTION 'WEEKLY_MENU_DENIED' USING ERRCODE = '42501';
  END IF;
  -- Until a canonical Staff grant producer exists, Staff is denied at the
  -- final write boundary. Never trust role/tenant values from the request.
  PERFORM 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=v_actor_id AND u.tenant_id=p_tenant_id AND u.status='active'
      AND lower(u.role)='admin' AND t.status='active' AND t.product_key='bella_preschool'
    FOR SHARE OF u, t;
  IF NOT FOUND THEN RAISE EXCEPTION 'WEEKLY_MENU_DENIED' USING ERRCODE = '42501'; END IF;

  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR jsonb_typeof(p_payload->'days') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_payload->'days')=0 OR nullif(trim(p_payload->>'title'),'') IS NULL
     OR p_payload->>'weekNumber' IS NULL OR p_payload->>'year' IS NULL OR p_payload->>'status' IS NULL
     OR (p_payload->>'weekNumber')::integer NOT BETWEEN 1 AND 53
     OR (p_payload->>'year')::integer NOT BETWEEN 2020 AND 2050
     OR coalesce(p_payload->>'ageGroup','ALL') NOT IN ('ALL','NURSERY','TODDLER','KINDY_1','KINDY_2')
     OR p_payload->>'status' NOT IN ('DRAFT','PUBLISHED','ARCHIVED') THEN
    RAISE EXCEPTION 'WEEKLY_MENU_INVALID' USING ERRCODE='22023';
  END IF;
  v_start := (p_payload->>'startDate')::date;
  v_end := (p_payload->>'endDate')::date;
  v_status := p_payload->>'status';
  IF v_start IS NULL OR v_end IS NULL OR v_end < v_start THEN RAISE EXCEPTION 'WEEKLY_MENU_INVALID' USING ERRCODE='22023'; END IF;
  FOR v_day IN SELECT value FROM jsonb_array_elements(p_payload->'days') LOOP
    IF v_day->>'dayOfWeek' IS NULL OR v_day->>'menuDate' IS NULL
       OR v_day->>'dayOfWeek' NOT IN ('MON','TUE','WED','THU','FRI','SAT','SUN')
       OR v_day->>'dayOfWeek' = ANY(v_seen) OR (v_day->>'menuDate')::date NOT BETWEEN v_start AND v_end
       OR jsonb_typeof(v_day->'mealsPayload') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'WEEKLY_MENU_INVALID_DAY' USING ERRCODE='22023';
    END IF;
    v_seen := array_append(v_seen, v_day->>'dayOfWeek');
  END LOOP;

  IF nullif(p_payload->>'menuId','') IS NOT NULL THEN
    v_menu_id := (p_payload->>'menuId')::uuid;
    IF nullif(p_payload->>'expectedUpdatedAt','') IS NULL THEN RAISE EXCEPTION 'WEEKLY_MENU_VERSION_REQUIRED' USING ERRCODE='22023'; END IF;
    SELECT * INTO v_current FROM public.edu_weekly_menus WHERE id=v_menu_id AND tenant_id=p_tenant_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'WEEKLY_MENU_NOT_FOUND' USING ERRCODE='P0002'; END IF;
    IF v_current.updated_at IS DISTINCT FROM (p_payload->>'expectedUpdatedAt')::timestamptz THEN
      RAISE EXCEPTION 'WEEKLY_MENU_VERSION_CONFLICT' USING ERRCODE='40001';
    END IF;
    UPDATE public.edu_weekly_menus SET academic_year=coalesce(p_payload->>'academicYear','2026-2027'),
      week_number=(p_payload->>'weekNumber')::integer, year=(p_payload->>'year')::integer,
      start_date=v_start,end_date=v_end,age_group=coalesce(p_payload->>'ageGroup','ALL'),
      title=trim(p_payload->>'title'),status=v_status,notes=p_payload->>'notes',
      approved_by=CASE WHEN v_status='PUBLISHED' THEN p_actor_id ELSE NULL END,
      updated_at=greatest(clock_timestamp(), v_current.updated_at + interval '1 microsecond')
      WHERE id=v_menu_id AND tenant_id=p_tenant_id RETURNING updated_at INTO v_version;
  ELSE
    INSERT INTO public.edu_weekly_menus(tenant_id,academic_year,week_number,year,start_date,end_date,age_group,title,status,notes,created_by,approved_by)
    VALUES(p_tenant_id,coalesce(p_payload->>'academicYear','2026-2027'),(p_payload->>'weekNumber')::integer,
      (p_payload->>'year')::integer,v_start,v_end,coalesce(p_payload->>'ageGroup','ALL'),trim(p_payload->>'title'),v_status,
      p_payload->>'notes',p_actor_id,CASE WHEN v_status='PUBLISHED' THEN p_actor_id ELSE NULL END)
    RETURNING id,updated_at INTO v_menu_id,v_version;
  END IF;
  FOR v_day IN SELECT value FROM jsonb_array_elements(p_payload->'days') LOOP
    INSERT INTO public.edu_weekly_menu_days(tenant_id,menu_id,day_of_week,menu_date,summary_dishes,calories_kcal,meals_payload)
      VALUES(p_tenant_id,v_menu_id,v_day->>'dayOfWeek',(v_day->>'menuDate')::date,
        coalesce(nullif(trim(v_day->>'summaryDishes'),''),'Thực đơn tiêu chuẩn trường'),
        coalesce((v_day->>'caloriesKcal')::integer,680),v_day->'mealsPayload')
      ON CONFLICT (tenant_id,menu_id,day_of_week) DO UPDATE SET menu_date=excluded.menu_date,
        summary_dishes=excluded.summary_dishes,calories_kcal=excluded.calories_kcal,meals_payload=excluded.meals_payload;
  END LOOP;
  DELETE FROM public.edu_weekly_menu_days WHERE tenant_id=p_tenant_id AND menu_id=v_menu_id AND NOT (day_of_week=ANY(v_seen));
  RETURN jsonb_build_object('menuId',v_menu_id,'updatedAt',v_version);
END;
$function$;
ALTER FUNCTION public.preschool_save_weekly_menu(uuid,uuid,jsonb) OWNER TO preschool_weekly_menu_executor;
REVOKE ALL ON FUNCTION public.preschool_save_weekly_menu(uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preschool_save_weekly_menu(uuid,uuid,jsonb) TO authenticated;
REVOKE preschool_weekly_menu_executor FROM postgres;
COMMIT;
