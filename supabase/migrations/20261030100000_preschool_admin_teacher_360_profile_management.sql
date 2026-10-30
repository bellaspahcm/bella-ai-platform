-- ============================================================================
-- Migration: 20261030100000_preschool_admin_teacher_360_profile_management.sql
-- Description: Canonical Teacher 360 profile management RPCs for Preschool.
-- Enforces strict tenant isolation, role verification, and synchronized updates
-- across party_parties, party_identifiers, users, and party_roles.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.preschool_admin_get_teacher_profile(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_teacher_party_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth' AS $$
DECLARE
  v_actor uuid := coalesce(p_actor_id, auth.uid());
  v_tenant uuid;
  v_party public.party_parties%ROWTYPE;
  v_phone text;
  v_email text;
  v_hire_date date;
  v_role_record public.party_roles%ROWTYPE;
  v_assignment record;
  v_res jsonb;
BEGIN
  IF p_teacher_party_id IS NULL OR v_actor IS NULL THEN
    RAISE EXCEPTION 'PRESCHOOL_TEACHER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  -- Verify caller is active preschool admin
  SELECT u.tenant_id INTO v_tenant
  FROM public.users u
  JOIN public.tenants t ON t.id = u.tenant_id
  JOIN auth.users a ON a.id = u.id
  WHERE u.id = v_actor
    AND (p_tenant_id IS NULL OR u.tenant_id = p_tenant_id)
    AND u.status = 'active'
    AND lower(u.role) = 'admin'
    AND t.status = 'active'
    AND t.product_key = 'bella_preschool'
    AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until <= clock_timestamp());

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'PRESCHOOL_TEACHER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  -- Verify teacher exists in tenant
  SELECT * INTO v_party
  FROM public.party_parties
  WHERE id = p_teacher_party_id AND tenant_id = v_tenant AND party_type = 'person' AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRESCHOOL_TEACHER_NOT_FOUND' USING ERRCODE = '44404';
  END IF;

  -- Get phone & email from party_identifiers or linked user
  SELECT identifier_value INTO v_phone
  FROM public.party_identifiers
  WHERE party_id = p_teacher_party_id AND tenant_id = v_tenant AND identifier_type = 'phone'
  ORDER BY created_at DESC LIMIT 1;

  SELECT identifier_value INTO v_email
  FROM public.party_identifiers
  WHERE party_id = p_teacher_party_id AND tenant_id = v_tenant AND identifier_type = 'email'
  ORDER BY created_at DESC LIMIT 1;

  SELECT u.phone, u.email, u.hire_date INTO v_phone, v_email, v_hire_date
  FROM public.party_auth_links pal
  JOIN public.users u ON u.id = pal.auth_user_id AND u.tenant_id = v_tenant
  WHERE pal.party_id = p_teacher_party_id AND pal.tenant_id = v_tenant AND pal.revoked_at IS NULL
  LIMIT 1;

  -- Get attributes from party_roles
  SELECT * INTO v_role_record
  FROM public.party_roles
  WHERE tenant_id = v_tenant AND party_id = p_teacher_party_id AND vertical = 'education' AND role_type = 'teacher';

  -- Get active assignment & course
  SELECT ta.role, c.title AS course_title, c.id AS course_id INTO v_assignment
  FROM public.teacher_assignments ta
  LEFT JOIN public.edu_courses c ON c.id = ta.canonical_course_id AND c.tenant_id = v_tenant
  WHERE ta.tenant_id = v_tenant AND ta.teacher_party_id = p_teacher_party_id AND ta.status = 'active'
  ORDER BY ta.created_at DESC LIMIT 1;

  v_res := jsonb_build_object(
    'partyId', v_party.id,
    'name', v_party.display_name,
    'phone', coalesce(v_phone, ''),
    'email', coalesce(v_email, ''),
    'address', coalesce(v_role_record.attributes->>'address', 'Chưa được cung cấp'),
    'joinedDate', CASE WHEN v_hire_date IS NOT NULL THEN v_hire_date::text ELSE coalesce(v_role_record.attributes->>'joinedDate', 'Chưa được cung cấp') END,
    'degree', coalesce(v_role_record.attributes->>'degree', 'Chưa được cung cấp'),
    'totalExperience', coalesce(v_role_record.attributes->>'totalExperience', 'Chưa được cung cấp'),
    'workloadHours', coalesce((v_role_record.attributes->>'workloadHours')::int, 0),
    'maxWorkloadHours', 40,
    'status', 'Đã xác nhận',
    'role', CASE 
      WHEN v_assignment.role = 'lead_teacher' THEN 'Giáo viên chủ nhiệm'
      WHEN v_assignment.role = 'assistant' THEN 'Giáo viên trợ giảng'
      WHEN v_assignment.role = 'co_teacher' THEN 'Giáo viên cùng lớp'
      WHEN v_assignment.role = 'substitute' THEN 'Giáo viên thay thế'
      ELSE 'Chưa phân công' END,
    'currentClass', coalesce(v_assignment.course_title, 'Chưa phân công lớp'),
    'compliance', coalesce(v_role_record.attributes->'compliance', jsonb_build_object(
      'officialRecords', false,
      'healthCheck', false,
      'firstAidWarning', 'unknown'
    ))
  );

  RETURN v_res;
END;
$$;

-- Single parameter overload for authenticated browser sessions
CREATE OR REPLACE FUNCTION public.preschool_admin_get_teacher_profile(
  p_teacher_party_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth' AS $$
BEGIN
  RETURN public.preschool_admin_get_teacher_profile(NULL, auth.uid(), p_teacher_party_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.preschool_admin_update_teacher_profile(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_teacher_party_id uuid,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_joined_date text DEFAULT NULL,
  p_degree text DEFAULT NULL,
  p_total_experience text DEFAULT NULL,
  p_workload_hours int DEFAULT NULL,
  p_compliance jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth' AS $$
DECLARE
  v_actor uuid := coalesce(p_actor_id, auth.uid());
  v_tenant uuid;
  v_party public.party_parties%ROWTYPE;
  v_clean_name text := nullif(btrim(p_name), '');
  v_clean_phone text := nullif(btrim(p_phone), '');
  v_clean_email text := nullif(lower(btrim(p_email)), '');
  v_clean_address text := nullif(btrim(p_address), '');
  v_clean_degree text := nullif(btrim(p_degree), '');
  v_clean_exp text := nullif(btrim(p_total_experience), '');
  v_date date;
  v_attrs jsonb;
  v_auth_user_id uuid;
BEGIN
  IF p_teacher_party_id IS NULL OR v_actor IS NULL THEN
    RAISE EXCEPTION 'PRESCHOOL_TEACHER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  -- 1. Verify caller is active preschool admin
  SELECT u.tenant_id INTO v_tenant
  FROM public.users u
  JOIN public.tenants t ON t.id = u.tenant_id
  JOIN auth.users a ON a.id = u.id
  WHERE u.id = v_actor
    AND (p_tenant_id IS NULL OR u.tenant_id = p_tenant_id)
    AND u.status = 'active'
    AND lower(u.role) = 'admin'
    AND t.status = 'active'
    AND t.product_key = 'bella_preschool'
    AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until <= clock_timestamp());

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'PRESCHOOL_TEACHER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  -- 2. Verify teacher party exists in tenant
  SELECT * INTO v_party
  FROM public.party_parties
  WHERE id = p_teacher_party_id AND tenant_id = v_tenant AND party_type = 'person' AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRESCHOOL_TEACHER_NOT_FOUND' USING ERRCODE = '44404';
  END IF;

  -- 3. Update party_parties display_name if provided
  IF v_clean_name IS NOT NULL THEN
    IF length(v_clean_name) > 120 THEN
      RAISE EXCEPTION 'PRESCHOOL_TEACHER_INVALID_NAME' USING ERRCODE = '22023';
    END IF;
    UPDATE public.party_parties
    SET display_name = v_clean_name,
        legal_name = coalesce(legal_name, v_clean_name),
        updated_at = clock_timestamp(),
        updated_by = v_actor,
        version = version + 1
    WHERE id = p_teacher_party_id AND tenant_id = v_tenant;
  END IF;

  -- 4. Update party_identifiers for phone & email
  IF v_clean_phone IS NOT NULL THEN
    INSERT INTO public.party_identifiers (id, tenant_id, party_id, identifier_type, identifier_value)
    VALUES (gen_random_uuid(), v_tenant, p_teacher_party_id, 'phone', v_clean_phone)
    ON CONFLICT (tenant_id, identifier_type, identifier_value) 
    DO UPDATE SET party_id = EXCLUDED.party_id;
  END IF;

  IF v_clean_email IS NOT NULL THEN
    INSERT INTO public.party_identifiers (id, tenant_id, party_id, identifier_type, identifier_value)
    VALUES (gen_random_uuid(), v_tenant, p_teacher_party_id, 'email', v_clean_email)
    ON CONFLICT (tenant_id, identifier_type, identifier_value) 
    DO UPDATE SET party_id = EXCLUDED.party_id;
  END IF;

  -- 5. Parse joined date
  IF p_joined_date IS NOT NULL AND btrim(p_joined_date) <> '' THEN
    BEGIN
      v_date := p_joined_date::date;
    EXCEPTION WHEN OTHERS THEN
      v_date := NULL;
    END;
  END IF;

  -- 6. Upsert party_roles (vertical: 'education', role_type: 'teacher')
  SELECT coalesce(attributes, '{}'::jsonb) INTO v_attrs
  FROM public.party_roles
  WHERE tenant_id = v_tenant AND party_id = p_teacher_party_id AND vertical = 'education' AND role_type = 'teacher';

  IF v_attrs IS NULL THEN
    v_attrs := '{}'::jsonb;
  END IF;

  IF v_clean_address IS NOT NULL THEN v_attrs := jsonb_set(v_attrs, '{address}', to_jsonb(v_clean_address)); END IF;
  IF v_clean_degree IS NOT NULL THEN v_attrs := jsonb_set(v_attrs, '{degree}', to_jsonb(v_clean_degree)); END IF;
  IF v_clean_exp IS NOT NULL THEN v_attrs := jsonb_set(v_attrs, '{totalExperience}', to_jsonb(v_clean_exp)); END IF;
  IF p_workload_hours IS NOT NULL THEN v_attrs := jsonb_set(v_attrs, '{workloadHours}', to_jsonb(p_workload_hours)); END IF;
  IF p_compliance IS NOT NULL THEN v_attrs := jsonb_set(v_attrs, '{compliance}', p_compliance); END IF;
  IF p_joined_date IS NOT NULL THEN v_attrs := jsonb_set(v_attrs, '{joinedDate}', to_jsonb(p_joined_date)); END IF;

  INSERT INTO public.party_roles (id, tenant_id, party_id, vertical, role_type, attributes, active_from)
  VALUES (gen_random_uuid(), v_tenant, p_teacher_party_id, 'education', 'teacher', v_attrs, coalesce(v_date, current_date))
  ON CONFLICT (tenant_id, party_id, vertical, role_type)
  DO UPDATE SET attributes = EXCLUDED.attributes, active_from = coalesce(v_date, party_roles.active_from);

  -- 7. Sync with public.users if account linked
  SELECT auth_user_id INTO v_auth_user_id
  FROM public.party_auth_links
  WHERE party_id = p_teacher_party_id AND tenant_id = v_tenant AND revoked_at IS NULL
  LIMIT 1;

  IF v_auth_user_id IS NOT NULL THEN
    UPDATE public.users
    SET full_name = coalesce(v_clean_name, full_name),
        phone = coalesce(v_clean_phone, phone),
        email = coalesce(v_clean_email, email),
        hire_date = coalesce(v_date, hire_date),
        updated_at = clock_timestamp()
    WHERE id = v_auth_user_id AND tenant_id = v_tenant;
  END IF;

  -- 8. Return updated profile
  RETURN public.preschool_admin_get_teacher_profile(v_tenant, v_actor, p_teacher_party_id);
END;
$$;

-- Single parameter overload for authenticated browser sessions
CREATE OR REPLACE FUNCTION public.preschool_admin_update_teacher_profile(
  p_teacher_party_id uuid,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_joined_date text DEFAULT NULL,
  p_degree text DEFAULT NULL,
  p_total_experience text DEFAULT NULL,
  p_workload_hours int DEFAULT NULL,
  p_compliance jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth' AS $$
BEGIN
  RETURN public.preschool_admin_update_teacher_profile(
    NULL, auth.uid(), p_teacher_party_id,
    p_name, p_phone, p_email, p_address, p_joined_date,
    p_degree, p_total_experience, p_workload_hours, p_compliance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preschool_admin_get_teacher_profile(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preschool_admin_get_teacher_profile(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preschool_admin_update_teacher_profile(uuid, uuid, uuid, text, text, text, text, text, text, text, int, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preschool_admin_update_teacher_profile(uuid, text, text, text, text, text, text, text, int, jsonb) TO authenticated, service_role;
