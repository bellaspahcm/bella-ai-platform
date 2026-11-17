-- Migration: 20261118060000_interior_o3_storage_lineage_and_audit_canonical.sql
-- Purpose:
--   1. Create private Storage bucket 'interior-site-evidence' with RLS policies and size/mime constraints.
--   2. Add additive lineage columns to public.interior_site_diaries: production_order_id, plan_id, diary_type.
--   3. Align RPC audit actions in site operations, QC, and warranty with canonical audit_logs vocabulary (INSERT/UPDATE)
--      while strictly preserving business action semantics ('CREATE', 'APPROVE') in new_data payload.

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 1: Storage Bucket & RLS for Interior Site Evidence
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'interior-site-evidence',
  'interior-site-evidence',
  FALSE,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'interior_site_evidence_no_direct_client_access'
  ) THEN
    CREATE POLICY interior_site_evidence_no_direct_client_access
      ON storage.objects AS RESTRICTIVE
      FOR ALL TO anon, authenticated
      USING (bucket_id <> 'interior-site-evidence')
      WITH CHECK (bucket_id <> 'interior-site-evidence');
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 2: Additive Lineage Columns on interior_site_diaries
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.interior_site_diaries
  ADD COLUMN IF NOT EXISTS production_order_id UUID NULL REFERENCES public.interior_production_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_id UUID NULL REFERENCES public.interior_site_installation_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS diary_type TEXT NOT NULL DEFAULT 'daily_log';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.interior_site_diaries'::regclass
      AND conname = 'chk_interior_site_diaries_diary_type'
  ) THEN
    ALTER TABLE public.interior_site_diaries
      ADD CONSTRAINT chk_interior_site_diaries_diary_type
      CHECK (diary_type IN ('material_receiving', 'installation_progress', 'inspection_qc', 'daily_log'));
  END IF;
END $$;

-- zero-downtime: allow blocking-index - newly added lineage foreign key indexing on interior vertical table
CREATE INDEX IF NOT EXISTS idx_interior_site_diaries_tenant_po
  ON public.interior_site_diaries(tenant_id, project_id, production_order_id);

-- zero-downtime: allow blocking-index - newly added lineage foreign key indexing on interior vertical table
CREATE INDEX IF NOT EXISTS idx_interior_site_diaries_tenant_plan
  ON public.interior_site_diaries(tenant_id, project_id, plan_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 3: Canonicalize RPC Audit Actions (Preserving Business Action in new_data)
-- ─────────────────────────────────────────────────────────────────────────────

-- 3.1 interior_create_site_diary
CREATE OR REPLACE FUNCTION public.interior_create_site_diary(
  p_project_id uuid,p_entry_date date,p_labor_headcount integer,p_weather text,
  p_activities_completed text[],p_issues_noted text DEFAULT ''
)
RETURNS TABLE(status text,reason text,entry_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_tenant uuid:=public.interior_actor_tenant();
  v_supervisor text;
  v_entry_id uuid;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text,'ACTIVE_ACTOR_REQUIRED'::text,NULL::uuid; RETURN;
  END IF;
  IF p_project_id IS NULL OR p_entry_date IS NULL OR p_labor_headcount IS NULL OR p_labor_headcount<0
    OR p_weather IS NULL OR p_weather NOT IN ('sunny','cloudy','rainy','stormy')
    OR p_activities_completed IS NULL OR cardinality(p_activities_completed)<1 OR cardinality(p_activities_completed)>50
    OR EXISTS (SELECT 1 FROM unnest(p_activities_completed) item WHERE nullif(trim(item),'') IS NULL OR length(item)>2000)
    OR length(coalesce(p_issues_noted,''))>5000 THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_SITE_DIARY_INPUT'::text,NULL::uuid; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.interior_projects p
    WHERE p.id=p_project_id AND p.tenant_id=v_tenant) THEN
    RETURN QUERY SELECT 'DENIED'::text,'PROJECT_NOT_FOUND'::text,NULL::uuid; RETURN;
  END IF;
  IF NOT public.interior_has_permission('interior:installation:create',v_tenant,p_project_id,NULL) THEN
    RETURN QUERY SELECT 'DENIED'::text,'SITE_DIARY_CREATE_PERMISSION_REQUIRED'::text,NULL::uuid; RETURN;
  END IF;
  SELECT coalesce(nullif(trim(a.full_name),''),'Interior staff') INTO v_supervisor
  FROM public.platform_current_actor_profile() a WHERE a.id=v_actor;
  INSERT INTO public.interior_site_diaries(
    tenant_id,project_id,date,weather,labor_headcount,activities_completed,material_delivered,
    issues_noted,supervisor_name,photo_urls,diary_type
  ) VALUES(v_tenant,p_project_id,p_entry_date,p_weather,p_labor_headcount,p_activities_completed,
    ARRAY[]::text[],nullif(trim(coalesce(p_issues_noted,'')),''),coalesce(v_supervisor,'Interior staff'),ARRAY[]::text[],'daily_log')
  RETURNING id INTO v_entry_id;
  INSERT INTO public.audit_logs(tenant_id,table_name,record_id,action,old_data,new_data,changed_by_id,created_at)
  VALUES(v_tenant,'interior_site_diaries',v_entry_id,'INSERT',NULL,
    jsonb_build_object('project_id',p_project_id,'date',p_entry_date,'labor_headcount',p_labor_headcount,
      'weather',p_weather,'business_action','CREATE','activities_count',cardinality(p_activities_completed)),
    v_actor,statement_timestamp());
  RETURN QUERY SELECT 'COMMITTED'::text,'SITE_DIARY_CREATED'::text,v_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.interior_create_site_diary(uuid,date,integer,text,text[],text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_create_site_diary(uuid,date,integer,text,text[],text) TO authenticated;

-- 3.2 interior_create_qc_item
CREATE OR REPLACE FUNCTION public.interior_create_qc_item(
  p_project_id uuid,p_room_zone_id uuid,p_description text,p_category text,p_severity text
)
RETURNS TABLE(status text,reason text,item jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_tenant uuid:=public.interior_actor_tenant();
  v_actor uuid:=auth.uid();
  v_room_name text:='Khu vực chính';
  v_item public.interior_qc_punch_list_items%ROWTYPE;
BEGIN
  IF v_tenant IS NULL OR v_actor IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text,'ACTIVE_ACTOR_REQUIRED'::text,NULL::jsonb; RETURN;
  END IF;
  IF p_project_id IS NULL OR p_description IS NULL OR length(trim(p_description)) NOT BETWEEN 1 AND 4000
    OR p_category IS NULL OR p_category NOT IN ('finishing','structural','furniture_fit','electrical_coordination','painting')
    OR p_severity IS NULL OR p_severity NOT IN ('critical','major','minor') THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_QC_ITEM_INPUT'::text,NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.interior_projects p WHERE p.id=p_project_id AND p.tenant_id=v_tenant) THEN
    RETURN QUERY SELECT 'DENIED'::text,'PROJECT_NOT_FOUND'::text,NULL::jsonb; RETURN;
  END IF;
  IF NOT public.interior_has_permission('interior:qc:create',v_tenant,p_project_id,NULL) THEN
    RETURN QUERY SELECT 'DENIED'::text,'QC_CREATE_PERMISSION_REQUIRED'::text,NULL::jsonb; RETURN;
  END IF;
  IF p_room_zone_id IS NOT NULL THEN
    SELECT z.name INTO v_room_name FROM public.interior_project_room_zones z
    WHERE z.id=p_room_zone_id AND z.project_id=p_project_id AND z.tenant_id=v_tenant;
    IF NOT FOUND THEN
      RETURN QUERY SELECT 'DENIED'::text,'ROOM_ZONE_NOT_FOUND'::text,NULL::jsonb; RETURN;
    END IF;
  END IF;
  INSERT INTO public.interior_qc_punch_list_items(
    tenant_id,project_id,room_zone_id,reported_by_user_id,room_zone_name,item_name,defect_category,description,severity,
    assigned_fixer,deadline,status
  ) VALUES(v_tenant,p_project_id,p_room_zone_id,v_actor,v_room_name,left(trim(p_description),30),p_category,
    trim(p_description),p_severity,'Chưa phân công',current_date+3,'open')
  RETURNING * INTO v_item;
  INSERT INTO public.audit_logs(tenant_id,table_name,record_id,action,old_data,new_data,changed_by_id,created_at)
  VALUES(v_tenant,'interior_qc_punch_list_items',v_item.id,'INSERT',NULL,
    jsonb_build_object('project_id',p_project_id,'room_zone_id',p_room_zone_id,'severity',p_severity,'status','open','business_action','CREATE'),
    v_actor,statement_timestamp());
  RETURN QUERY SELECT 'COMMITTED'::text,'QC_ITEM_CREATED'::text,
    jsonb_build_object('id',v_item.id,'tenantId',v_item.tenant_id,'projectId',v_item.project_id,
      'roomZoneId',v_item.room_zone_id,'reportedByUserId',v_item.reported_by_user_id,
      'roomZoneName',v_item.room_zone_name,'itemName',v_item.item_name,
      'category',v_item.defect_category,'description',v_item.description,'severity',v_item.severity,
      'photoUrl',v_item.photo_url,'assignedFixer',v_item.assigned_fixer,'deadline',v_item.deadline,
      'status',v_item.status,'rectificationNote',v_item.rectification_note,'verifiedBy',v_item.verified_by,
      'verifiedAt',v_item.verified_at,'createdAt',v_item.created_at,'updatedAt',v_item.updated_at);
END;
$$;

REVOKE ALL ON FUNCTION public.interior_create_qc_item(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_create_qc_item(uuid,uuid,text,text,text) TO authenticated;

-- 3.3 interior_update_qc_item
CREATE OR REPLACE FUNCTION public.interior_update_qc_item(
  p_item_id uuid,p_status text,p_rectification_note text DEFAULT NULL
)
RETURNS TABLE(status text,reason text,item jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_tenant uuid:=public.interior_actor_tenant();
  v_actor uuid:=auth.uid();
  v_item public.interior_qc_punch_list_items%ROWTYPE;
  v_old_item public.interior_qc_punch_list_items%ROWTYPE;
  v_permission text;
BEGIN
  IF v_tenant IS NULL OR v_actor IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text,'ACTIVE_ACTOR_REQUIRED'::text,NULL::jsonb; RETURN;
  END IF;
  IF p_item_id IS NULL OR p_status IS NULL OR p_status NOT IN ('open','in_progress','rectified','verified')
    OR (p_rectification_note IS NOT NULL AND length(p_rectification_note)>4000) THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_QC_ITEM_INPUT'::text,NULL::jsonb; RETURN;
  END IF;
  SELECT * INTO v_item FROM public.interior_qc_punch_list_items q
  WHERE q.id=p_item_id AND q.tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'DENIED'::text,'QC_ITEM_NOT_FOUND'::text,NULL::jsonb; RETURN;
  END IF;
  v_old_item:=v_item;
  v_permission:=CASE WHEN p_status='verified' THEN 'interior:qc:approve' ELSE 'interior:qc:update' END;
  IF NOT public.interior_has_permission(v_permission,v_tenant,v_item.project_id,NULL) THEN
    RETURN QUERY SELECT 'DENIED'::text,'QC_UPDATE_PERMISSION_REQUIRED'::text,NULL::jsonb; RETURN;
  END IF;
  IF p_status IS DISTINCT FROM v_item.status AND NOT (
    (v_item.status='open' AND p_status='in_progress')
    OR (v_item.status='in_progress' AND p_status='rectified')
    OR (v_item.status='rectified' AND p_status='verified')
  ) THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_QC_STATE_TRANSITION'::text,NULL::jsonb; RETURN;
  END IF;
  IF p_status='verified' AND v_item.status<>'rectified' THEN
    RETURN QUERY SELECT 'DENIED'::text,'QC_ITEM_MUST_BE_RECTIFIED_BEFORE_VERIFICATION'::text,NULL::jsonb; RETURN;
  END IF;
  UPDATE public.interior_qc_punch_list_items q SET
    status=p_status,
    rectification_note=coalesce(p_rectification_note,q.rectification_note),
    verified_by=CASE WHEN p_status='verified' THEN v_actor::text ELSE q.verified_by END,
    verified_at=CASE WHEN p_status='verified' THEN statement_timestamp() ELSE q.verified_at END,
    updated_at=statement_timestamp()
  WHERE q.id=p_item_id AND q.tenant_id=v_tenant
  RETURNING * INTO v_item;
  INSERT INTO public.audit_logs(tenant_id,table_name,record_id,action,old_data,new_data,changed_by_id,created_at)
  VALUES(v_tenant,'interior_qc_punch_list_items',v_item.id,'UPDATE',to_jsonb(v_old_item),
    to_jsonb(v_item) || jsonb_build_object('business_action', CASE WHEN p_status='verified' THEN 'APPROVE' ELSE 'UPDATE' END),
    v_actor,statement_timestamp());
  RETURN QUERY SELECT 'COMMITTED'::text,'QC_ITEM_UPDATED'::text,
    jsonb_build_object('id',v_item.id,'tenantId',v_item.tenant_id,'projectId',v_item.project_id,
      'roomZoneId',v_item.room_zone_id,'reportedByUserId',v_item.reported_by_user_id,
      'roomZoneName',v_item.room_zone_name,'itemName',v_item.item_name,
      'category',v_item.defect_category,'description',v_item.description,'severity',v_item.severity,
      'photoUrl',v_item.photo_url,'assignedFixer',v_item.assigned_fixer,'deadline',v_item.deadline,
      'status',v_item.status,'rectificationNote',v_item.rectification_note,'verifiedBy',v_item.verified_by,
      'verifiedAt',v_item.verified_at,'createdAt',v_item.created_at,'updatedAt',v_item.updated_at);
END;
$$;

REVOKE ALL ON FUNCTION public.interior_update_qc_item(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_update_qc_item(uuid,text,text) TO authenticated;

-- 3.4 interior_create_warranty_ticket
CREATE OR REPLACE FUNCTION public.interior_create_warranty_ticket(
  p_certificate_id uuid,p_project_id uuid,p_reported_by_contact text,
  p_defect_category text,p_customer_report text,p_priority text
)
RETURNS TABLE(status text,reason text,ticket jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_tenant uuid:=public.interior_actor_tenant(); v_actor uuid:=auth.uid();
  v_certificate public.interior_warranty_certificates%ROWTYPE;
  v_ticket public.interior_warranty_service_tickets%ROWTYPE;
  v_ticket_number text:='WTK-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
BEGIN
  IF v_tenant IS NULL OR v_actor IS NULL THEN RETURN QUERY SELECT 'DENIED'::text,'ACTIVE_ACTOR_REQUIRED'::text,NULL::jsonb; RETURN; END IF;
  IF p_certificate_id IS NULL OR p_project_id IS NULL OR nullif(trim(p_customer_report),'') IS NULL
    OR length(trim(p_customer_report))>4000 OR length(coalesce(p_reported_by_contact,''))>200
    OR p_defect_category IS NULL OR p_defect_category NOT IN ('misaligned_door','scratched_surface','color_mismatch','hardware_defect',
      'stone_seam_flaw','lighting_failure','missing_accessory','dimensional_error')
    OR p_priority IS NULL OR p_priority NOT IN ('urgent','high','medium','low') THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_WARRANTY_TICKET_INPUT'::text,NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.interior_projects p WHERE p.id=p_project_id AND p.tenant_id=v_tenant) THEN
    RETURN QUERY SELECT 'DENIED'::text,'PROJECT_NOT_FOUND'::text,NULL::jsonb; RETURN;
  END IF;
  IF NOT public.interior_has_permission('interior:warranty:create',v_tenant,p_project_id,NULL) THEN
    RETURN QUERY SELECT 'DENIED'::text,'WARRANTY_CREATE_PERMISSION_REQUIRED'::text,NULL::jsonb; RETURN;
  END IF;
  SELECT * INTO v_certificate FROM public.interior_warranty_certificates w
  WHERE w.id=p_certificate_id AND w.tenant_id=v_tenant AND w.project_id=p_project_id;
  IF NOT FOUND THEN RETURN QUERY SELECT 'DENIED'::text,'WARRANTY_CERTIFICATE_NOT_FOUND'::text,NULL::jsonb; RETURN; END IF;
  INSERT INTO public.interior_warranty_service_tickets(
    tenant_id,certificate_id,project_id,ticket_number,reported_date,customer_report,
    room_zone_name,item_name,defect_category,status,reported_by_user_id,reported_by_contact,priority,updated_at
  ) VALUES(v_tenant,p_certificate_id,p_project_id,v_ticket_number,statement_timestamp(),trim(p_customer_report),
    'Toàn bộ công trình',left(trim(p_customer_report),30),p_defect_category,'submitted',v_actor,
    nullif(trim(coalesce(p_reported_by_contact,'')),''),p_priority,statement_timestamp())
  RETURNING * INTO v_ticket;
  INSERT INTO public.audit_logs(tenant_id,table_name,record_id,action,old_data,new_data,changed_by_id,created_at)
  VALUES(v_tenant,'interior_warranty_service_tickets',v_ticket.id,'INSERT',NULL,
    jsonb_build_object('project_id',p_project_id,'certificate_id',p_certificate_id,
      'defect_category',p_defect_category,'priority',p_priority,'status','submitted','business_action','CREATE'),
    v_actor,statement_timestamp());
  RETURN QUERY SELECT 'COMMITTED'::text,'WARRANTY_TICKET_CREATED'::text,
    jsonb_build_object('id',v_ticket.id,'tenantId',v_ticket.tenant_id,'warrantyId',v_ticket.certificate_id,
      'projectId',v_ticket.project_id,'reportedByUserId',v_ticket.reported_by_user_id,
      'reportedByContact',v_ticket.reported_by_contact,'ticketNumber',v_ticket.ticket_number,
      'reportedDate',v_ticket.reported_date,'customerReport',v_ticket.customer_report,
      'roomZoneName',v_ticket.room_zone_name,'itemName',v_ticket.item_name,
      'defectCategory',v_ticket.defect_category,'priority',v_ticket.priority,'status',v_ticket.status,
      'assignedTechnician',v_ticket.assigned_technician,'scheduledFixDate',v_ticket.scheduled_fix_date,
      'resolvedDate',v_ticket.resolved_date,'resolutionDetails',v_ticket.resolution_details,
      'supplierChargebackEligible',v_ticket.supplier_chargeback_eligible,'updatedAt',v_ticket.updated_at);
END;
$$;

REVOKE ALL ON FUNCTION public.interior_create_warranty_ticket(uuid,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_create_warranty_ticket(uuid,uuid,text,text,text,text) TO authenticated;
