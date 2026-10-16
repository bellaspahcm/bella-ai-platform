-- REVIEW CANDIDATE ONLY. No Production execution is authorized by this file.
-- The BDGF wrapper owns BEGIN/COMMIT/ROLLBACK; never execute files one by one.
-- Bound public AND storage mutations. Explicit project/executor/Human GO required.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $adoption_lock$ BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('automove-production-adoption')) THEN RAISE EXCEPTION 'Adoption already running'; END IF;
END $adoption_lock$;
LOCK TABLE public.auto_brands,public.auto_models,public.auto_variants,public.auto_leads,public.auto_bookings,public.auto_deposits,public.auto_customer_profiles,public.auto_vehicles,public.auto_vehicle_status_logs,public.auto_vehicle_owners,public.auto_service_history,public.tenants,storage.objects,storage.buckets IN SHARE ROW EXCLUSIVE MODE;
-- Metadata checks only. Does not create an approval or grant execution authority.
DO $adoption_before$
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'Explicit owner-operated postgres principal required'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['policy_registry','mobility_domain_events','mobility_command_idempotency','auto_vehicle_sale_recognitions','auto_vehicle_sale_recognition_adjustments','auto_vehicle_sale_financial_snapshots','auto_vehicle_sale_payments','auto_vehicle_sale_settlement_actions']) x(name) WHERE to_regclass('public.'||name) IS NOT NULL) THEN RAISE EXCEPTION 'A new relation already exists: stop, inspect committed state; do not replay'; END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id='automove-sale-documents') THEN RAISE EXCEPTION 'Document bucket before-state changed'; END IF;
  IF current_setting('supautils.policy_grants',true) IS DISTINCT FROM '{"postgres":["auth.audit_log_entries","auth.flow_state","auth.identities","auth.instances","auth.mfa_amr_claims","auth.mfa_challenges","auth.mfa_factors","auth.oauth_clients","auth.one_time_tokens","auth.refresh_tokens","auth.saml_providers","auth.saml_relay_states","auth.sessions","auth.sso_domains","auth.sso_providers","auth.users","realtime.messages","realtime.subscription","storage.buckets","storage.buckets_analytics","storage.objects","storage.prefixes","storage.s3_multipart_uploads","storage.s3_multipart_uploads_parts"]}' THEN RAISE EXCEPTION 'Storage delegation metadata changed'; END IF;
  IF (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'schema',to_jsonb(x)->>'name'),'[]'::jsonb) FROM (SELECT n.nspname AS schema,c.relname AS name,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner,c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='public' AND c.relname=ANY(ARRAY['accounting_periods','auto_bookings','auto_brands','auto_customer_profiles','auto_deposits','auto_leads','auto_models','auto_service_history','auto_variants','auto_vehicle_owners','auto_vehicle_status_logs','auto_vehicles','bella_gate_tokens','bella_migration_approval','customers','org_units','tenants','user_org_unit_access','users']::text[])) OR (n.nspname='storage' AND c.relname IN ('objects','buckets'))) x) IS DISTINCT FROM (SELECT coalesce(jsonb_agg(value ORDER BY value->>'schema',value->>'name'),'[]'::jsonb) FROM jsonb_array_elements('[{"schema":"public","name":"accounting_periods","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,anon=arwdDxtm/postgres}"},{"schema":"public","name":"auto_bookings","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,anon=arwdDxtm/postgres}"},{"schema":"public","name":"auto_brands","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,anon=arwdDxtm/postgres}"},{"schema":"public","name":"auto_customer_profiles","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres}"},{"schema":"public","name":"auto_deposits","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,anon=arwdDxtm/postgres}"},{"schema":"public","name":"auto_leads","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,anon=arwdDxtm/postgres}"},{"schema":"public","name":"auto_models","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,anon=arwdDxtm/postgres}"},{"schema":"public","name":"auto_service_history","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres}"},{"schema":"public","name":"auto_variants","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,anon=arwdDxtm/postgres}"},{"schema":"public","name":"auto_vehicle_owners","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres}"},{"schema":"public","name":"auto_vehicle_status_logs","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,anon=arwdDxtm/postgres}"},{"schema":"public","name":"auto_vehicles","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,anon=arwdDxtm/postgres}"},{"schema":"public","name":"bella_gate_tokens","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres}"},{"schema":"public","name":"bella_migration_approval","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres}"},{"schema":"public","name":"customers","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres}"},{"schema":"public","name":"org_units","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres}"},{"schema":"public","name":"tenants","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres}"},{"schema":"public","name":"user_org_unit_access","relkind":"v","relrowsecurity":false,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,authenticated=r/postgres}"},{"schema":"public","name":"users","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"postgres","relacl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres}"},{"schema":"storage","name":"buckets","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"supabase_storage_admin","relacl":"{supabase_storage_admin=a*r*w*d*D*x*t*m*/supabase_storage_admin,service_role=arwdDxtm/supabase_storage_admin,authenticated=arwdDxtm/supabase_storage_admin,anon=arwdDxtm/supabase_storage_admin,postgres=a*r*w*d*D*x*t*m*/supabase_storage_admin}"},{"schema":"storage","name":"objects","relkind":"r","relrowsecurity":true,"relforcerowsecurity":false,"owner":"supabase_storage_admin","relacl":"{supabase_storage_admin=a*r*w*d*D*x*t*m*/supabase_storage_admin,service_role=arwdDxtm/supabase_storage_admin,authenticated=arwdDxtm/supabase_storage_admin,anon=arwdDxtm/supabase_storage_admin,postgres=a*r*w*d*D*x*t*m*/supabase_storage_admin}"}]'::jsonb)) THEN RAISE EXCEPTION 'Adoption before-state drift: relations'; END IF;
  IF (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'schema',to_jsonb(x)->>'table_name',to_jsonb(x)->>'attname'),'[]'::jsonb) FROM (SELECT n.nspname AS schema,c.relname AS table_name,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_expression,a.attacl::text FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE a.attnum>0 AND NOT a.attisdropped AND ((n.nspname='public' AND c.relname=ANY(ARRAY['accounting_periods','auto_bookings','auto_brands','auto_customer_profiles','auto_deposits','auto_leads','auto_models','auto_service_history','auto_variants','auto_vehicle_owners','auto_vehicle_status_logs','auto_vehicles','bella_gate_tokens','bella_migration_approval','customers','org_units','tenants','user_org_unit_access','users']::text[])) OR (n.nspname='storage' AND c.relname IN ('objects','buckets')))) x) IS DISTINCT FROM (SELECT coalesce(jsonb_agg(value ORDER BY value->>'schema',value->>'table_name',value->>'attname'),'[]'::jsonb) FROM jsonb_array_elements('[{"schema":"public","table_name":"accounting_periods","attname":"id","type":"uuid","attnotnull":true,"default_expression":"gen_random_uuid()","attacl":null},{"schema":"public","table_name":"accounting_periods","attname":"tenant_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"accounting_periods","attname":"name","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"accounting_periods","attname":"start_date","type":"date","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"accounting_periods","attname":"end_date","type":"date","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"accounting_periods","attname":"status","type":"text","attnotnull":true,"default_expression":"''OPEN''::text","attacl":null},{"schema":"public","table_name":"accounting_periods","attname":"created_at","type":"timestamp with time zone","attnotnull":false,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"accounting_periods","attname":"updated_at","type":"timestamp with time zone","attnotnull":false,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"auto_bookings","attname":"id","type":"uuid","attnotnull":true,"default_expression":"gen_random_uuid()","attacl":null},{"schema":"public","table_name":"auto_bookings","attname":"tenant_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_bookings","attname":"customer_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_bookings","attname":"lead_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_bookings","attname":"variant_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_bookings","attname":"vehicle_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_bookings","attname":"color_exterior","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_bookings","attname":"booking_number","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_bookings","attname":"total_price","type":"numeric(18,0)","attnotnull":true,"default_expression":"0","attacl":null},{"schema":"public","table_name":"auto_bookings","attname":"deposit_amount","type":"numeric(18,0)","attnotnull":true,"default_expression":"0","attacl":null},{"schema":"public","table_name":"auto_bookings","attname":"deposit_paid","type":"numeric(18,0)","attnotnull":true,"default_expression":"0","attacl":null},{"schema":"public","table_name":"auto_bookings","attname":"payment_status","type":"text","attnotnull":true,"default_expression":"''unpaid''::text","attacl":null},{"schema":"public","table_name":"auto_bookings","attname":"status","type":"text","attnotnull":true,"default_expression":"''pending''::text","attacl":null},{"schema":"public","table_name":"auto_bookings","attname":"accounting_entry_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_bookings","attname":"metadata","type":"jsonb","attnotnull":true,"default_expression":"''{}''::jsonb","attacl":null},{"schema":"public","table_name":"auto_bookings","attname":"created_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_bookings","attname":"updated_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_brands","attname":"id","type":"uuid","attnotnull":true,"default_expression":"gen_random_uuid()","attacl":null},{"schema":"public","table_name":"auto_brands","attname":"tenant_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_brands","attname":"name","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_brands","attname":"country_of_origin","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_brands","attname":"is_active","type":"boolean","attnotnull":true,"default_expression":"true","attacl":null},{"schema":"public","table_name":"auto_brands","attname":"created_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_brands","attname":"updated_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_customer_profiles","attname":"id","type":"uuid","attnotnull":true,"default_expression":"gen_random_uuid()","attacl":null},{"schema":"public","table_name":"auto_customer_profiles","attname":"tenant_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_customer_profiles","attname":"customer_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_customer_profiles","attname":"preferred_brands","type":"text[]","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_customer_profiles","attname":"preferred_segments","type":"text[]","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_customer_profiles","attname":"budget_range","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_customer_profiles","attname":"purchasing_purpose","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_customer_profiles","attname":"total_vehicles_owned","type":"integer","attnotnull":true,"default_expression":"0","attacl":null},{"schema":"public","table_name":"auto_customer_profiles","attname":"total_value_spent","type":"numeric(18,0)","attnotnull":true,"default_expression":"0","attacl":null},{"schema":"public","table_name":"auto_customer_profiles","attname":"metadata","type":"jsonb","attnotnull":true,"default_expression":"''{}''::jsonb","attacl":null},{"schema":"public","table_name":"auto_customer_profiles","attname":"created_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_customer_profiles","attname":"updated_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_deposits","attname":"id","type":"uuid","attnotnull":true,"default_expression":"gen_random_uuid()","attacl":null},{"schema":"public","table_name":"auto_deposits","attname":"tenant_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_deposits","attname":"booking_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_deposits","attname":"amount","type":"numeric(18,0)","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_deposits","attname":"payment_method","type":"text","attnotnull":true,"default_expression":"''cash''::text","attacl":null},{"schema":"public","table_name":"auto_deposits","attname":"payment_date","type":"timestamp with time zone","attnotnull":true,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"auto_deposits","attname":"transaction_ref","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_deposits","attname":"status","type":"text","attnotnull":true,"default_expression":"''pending''::text","attacl":null},{"schema":"public","table_name":"auto_deposits","attname":"notes","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_deposits","attname":"created_by","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_deposits","attname":"confirmed_by","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_deposits","attname":"confirmed_at","type":"timestamp with time zone","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_deposits","attname":"created_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_deposits","attname":"updated_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_leads","attname":"id","type":"uuid","attnotnull":true,"default_expression":"gen_random_uuid()","attacl":null},{"schema":"public","table_name":"auto_leads","attname":"tenant_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_leads","attname":"customer_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_leads","attname":"source","type":"text","attnotnull":true,"default_expression":"''direct''::text","attacl":null},{"schema":"public","table_name":"auto_leads","attname":"preferred_variant_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_leads","attname":"preferred_color","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_leads","attname":"budget_limit","type":"numeric(18,0)","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_leads","attname":"notes","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_leads","attname":"assigned_sales_agent_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_leads","attname":"assigned_at","type":"timestamp with time zone","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_leads","attname":"status","type":"text","attnotnull":true,"default_expression":"''new''::text","attacl":null},{"schema":"public","table_name":"auto_leads","attname":"lost_reason","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_leads","attname":"metadata","type":"jsonb","attnotnull":true,"default_expression":"''{}''::jsonb","attacl":null},{"schema":"public","table_name":"auto_leads","attname":"created_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_leads","attname":"updated_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_models","attname":"id","type":"uuid","attnotnull":true,"default_expression":"gen_random_uuid()","attacl":null},{"schema":"public","table_name":"auto_models","attname":"tenant_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_models","attname":"brand_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_models","attname":"name","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_models","attname":"segment","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_models","attname":"is_active","type":"boolean","attnotnull":true,"default_expression":"true","attacl":null},{"schema":"public","table_name":"auto_models","attname":"created_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_models","attname":"updated_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"id","type":"uuid","attnotnull":true,"default_expression":"gen_random_uuid()","attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"tenant_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"vehicle_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"vin","type":"character varying(17)","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"repair_order_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"appointment_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"service_date","type":"date","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"service_type","type":"character varying(50)","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"service_description","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"mileage","type":"integer","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"services_performed","type":"jsonb","attnotnull":true,"default_expression":"''[]''::jsonb","attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"parts_replaced","type":"jsonb","attnotnull":false,"default_expression":"''[]''::jsonb","attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"labor_hours","type":"numeric(5,2)","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"technician_ids","type":"jsonb","attnotnull":false,"default_expression":"''[]''::jsonb","attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"labor_cost","type":"numeric(15,2)","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"parts_cost","type":"numeric(15,2)","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"total_cost","type":"numeric(15,2)","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"is_warranty_service","type":"boolean","attnotnull":false,"default_expression":"false","attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"warranty_expiry_date","type":"date","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"warranty_mileage_limit","type":"integer","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"service_advisor_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"workshop_location","type":"character varying(200)","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"quality_rating","type":"integer","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"customer_feedback","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"next_service_due_date","type":"date","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"next_service_due_mileage","type":"integer","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"is_locked","type":"boolean","attnotnull":false,"default_expression":"true","attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"locked_at","type":"timestamp with time zone","attnotnull":false,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"locked_by","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"recorded_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"recorded_by","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_service_history","attname":"created_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"auto_variants","attname":"id","type":"uuid","attnotnull":true,"default_expression":"gen_random_uuid()","attacl":null},{"schema":"public","table_name":"auto_variants","attname":"tenant_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_variants","attname":"model_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_variants","attname":"name","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_variants","attname":"year","type":"integer","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_variants","attname":"fuel_type","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_variants","attname":"transmission","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_variants","attname":"specs_json","type":"jsonb","attnotnull":true,"default_expression":"''{}''::jsonb","attacl":null},{"schema":"public","table_name":"auto_variants","attname":"is_active","type":"boolean","attnotnull":true,"default_expression":"true","attacl":null},{"schema":"public","table_name":"auto_variants","attname":"created_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_variants","attname":"updated_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_vehicle_owners","attname":"id","type":"uuid","attnotnull":true,"default_expression":"gen_random_uuid()","attacl":null},{"schema":"public","table_name":"auto_vehicle_owners","attname":"tenant_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicle_owners","attname":"customer_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicle_owners","attname":"vehicle_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicle_owners","attname":"ownership_type","type":"text","attnotnull":true,"default_expression":"''primary''::text","attacl":null},{"schema":"public","table_name":"auto_vehicle_owners","attname":"license_plate","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicle_owners","attname":"registration_date","type":"date","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicle_owners","attname":"is_active","type":"boolean","attnotnull":true,"default_expression":"true","attacl":null},{"schema":"public","table_name":"auto_vehicle_owners","attname":"transferred_at","type":"timestamp with time zone","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicle_owners","attname":"transfer_notes","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicle_owners","attname":"metadata","type":"jsonb","attnotnull":true,"default_expression":"''{}''::jsonb","attacl":null},{"schema":"public","table_name":"auto_vehicle_owners","attname":"created_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_vehicle_owners","attname":"updated_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_vehicle_status_logs","attname":"id","type":"uuid","attnotnull":true,"default_expression":"gen_random_uuid()","attacl":null},{"schema":"public","table_name":"auto_vehicle_status_logs","attname":"tenant_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicle_status_logs","attname":"vehicle_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicle_status_logs","attname":"from_status","type":"auto_vehicle_status","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicle_status_logs","attname":"to_status","type":"auto_vehicle_status","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicle_status_logs","attname":"changed_by_user_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicle_status_logs","attname":"reason","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicle_status_logs","attname":"metadata","type":"jsonb","attnotnull":true,"default_expression":"''{}''::jsonb","attacl":null},{"schema":"public","table_name":"auto_vehicle_status_logs","attname":"created_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"id","type":"uuid","attnotnull":true,"default_expression":"gen_random_uuid()","attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"tenant_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"variant_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"vin","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"chassis_number","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"engine_number","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"color_exterior","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"color_interior","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"model_year","type":"integer","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"list_price","type":"numeric(18,0)","attnotnull":true,"default_expression":"0","attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"cost_price","type":"numeric(18,0)","attnotnull":true,"default_expression":"0","attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"status","type":"auto_vehicle_status","attnotnull":true,"default_expression":"''in_transit''::auto_vehicle_status","attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"location_note","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"allocated_to_contract_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"allocated_at","type":"timestamp with time zone","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"allocated_by_user_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"delivered_at","type":"timestamp with time zone","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"delivered_to_customer_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"delivery_notes","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"expected_arrival_date","type":"date","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"actual_arrival_date","type":"date","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"import_declaration_number","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"metadata","type":"jsonb","attnotnull":true,"default_expression":"''{}''::jsonb","attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"created_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"auto_vehicles","attname":"updated_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"timezone(''utc''::text, now())","attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"token_id","type":"uuid","attnotnull":true,"default_expression":"gen_random_uuid()","attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"approval_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"migration_id","type":"character varying(255)","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"migration_hash","type":"character varying(64)","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"target_environment","type":"character varying(50)","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"target_schema","type":"character varying(255)","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"executor_identity","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"execution_attempt_id","type":"uuid","attnotnull":true,"default_expression":"gen_random_uuid()","attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"nonce","type":"character varying(64)","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"token_signature","type":"character varying(128)","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"issued_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"expires_at","type":"timestamp with time zone","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"status","type":"character varying(20)","attnotnull":true,"default_expression":"''issued''::character varying","attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"used_at","type":"timestamp with time zone","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"execution_result","type":"character varying(20)","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"execution_error","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"created_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"bella_gate_tokens","attname":"created_by","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"approval_id","type":"uuid","attnotnull":true,"default_expression":"gen_random_uuid()","attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"migration_id","type":"character varying(255)","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"migration_hash","type":"character varying(64)","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"requester_id","type":"character varying(255)","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"approver_id","type":"character varying(255)","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"approver_role","type":"character varying(50)","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"approved_at","type":"timestamp without time zone","attnotnull":true,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"target_environment","type":"character varying(20)","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"target_schema","type":"character varying(255)","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"expires_at","type":"timestamp without time zone","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"valid_from","type":"timestamp without time zone","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"valid_until","type":"timestamp without time zone","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"status","type":"character varying(20)","attnotnull":true,"default_expression":"''requested''::character varying","attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"used_at","type":"timestamp without time zone","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"used_by","type":"character varying(255)","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"approval_hash","type":"character varying(64)","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"signature","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"created_by","type":"character varying(255)","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"created_at","type":"timestamp without time zone","attnotnull":true,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"notes","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"execution_started_at","type":"timestamp with time zone","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"execution_completed_at","type":"timestamp with time zone","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"execution_error","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"bella_migration_approval","attname":"approval_mode","type":"character varying(32)","attnotnull":true,"default_expression":"''separated''::character varying","attacl":null},{"schema":"public","table_name":"customers","attname":"id","type":"uuid","attnotnull":true,"default_expression":"uuid_generate_v4()","attacl":null},{"schema":"public","table_name":"customers","attname":"phone","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"customers","attname":"name_mother","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"customers","attname":"name_baby","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"customers","attname":"dob_baby","type":"date","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"customers","attname":"dob_expected","type":"date","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"customers","attname":"address","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"customers","attname":"referrer_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"customers","attname":"zalo_oa_id","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"customers","attname":"status","type":"text","attnotnull":false,"default_expression":"''active''::text","attacl":null},{"schema":"public","table_name":"customers","attname":"notes","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"customers","attname":"tenant_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"customers","attname":"created_at","type":"timestamp with time zone","attnotnull":false,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"customers","attname":"updated_at","type":"timestamp with time zone","attnotnull":false,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"customers","attname":"gender_baby","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"customers","attname":"loyalty_points","type":"integer","attnotnull":false,"default_expression":"0","attacl":null},{"schema":"public","table_name":"customers","attname":"latitude","type":"double precision","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"customers","attname":"longitude","type":"double precision","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"customers","attname":"metadata","type":"jsonb","attnotnull":false,"default_expression":"''{}''::jsonb","attacl":null},{"schema":"public","table_name":"org_units","attname":"id","type":"uuid","attnotnull":true,"default_expression":"gen_random_uuid()","attacl":null},{"schema":"public","table_name":"org_units","attname":"tenant_id","type":"uuid","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"org_units","attname":"unit_type","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"org_units","attname":"name","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"org_units","attname":"code","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"org_units","attname":"parent_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"org_units","attname":"is_active","type":"boolean","attnotnull":true,"default_expression":"true","attacl":null},{"schema":"public","table_name":"org_units","attname":"metadata","type":"jsonb","attnotnull":true,"default_expression":"''{}''::jsonb","attacl":null},{"schema":"public","table_name":"org_units","attname":"created_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"org_units","attname":"updated_at","type":"timestamp with time zone","attnotnull":true,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"tenants","attname":"id","type":"uuid","attnotnull":true,"default_expression":"uuid_generate_v4()","attacl":null},{"schema":"public","table_name":"tenants","attname":"name","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"parent_tenant_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"franchise_agreement_date","type":"date","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"royalty_rate","type":"numeric","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"contact_name","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"contact_phone","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"address","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"status","type":"text","attnotnull":false,"default_expression":"''active''::text","attacl":null},{"schema":"public","table_name":"tenants","attname":"created_at","type":"timestamp with time zone","attnotnull":false,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"tenants","attname":"updated_at","type":"timestamp with time zone","attnotnull":false,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"tenants","attname":"zalo_app_id","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"zalo_secret_key","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"zalo_oa_id","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"zalo_access_token","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"zalo_refresh_token","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"zalo_token_expires_at","type":"timestamp with time zone","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"zalo_template_reminder_id","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"zalo_template_birthday_id","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"zalo_auto_scan","type":"boolean","attnotnull":false,"default_expression":"true","attacl":null},{"schema":"public","table_name":"tenants","attname":"email","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"qr_bank_code","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"qr_account_number","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"qr_account_name","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"salary_config","type":"jsonb","attnotnull":false,"default_expression":"''{\"bonus_4_star\": 10000, \"bonus_5_star\": 50000, \"bonus_4_5_star\": 30000, \"kpi_bonus_amount\": 1000000, \"kpi_target_sessions\": 30}''::jsonb","attacl":null},{"schema":"public","table_name":"tenants","attname":"subscription_tier","type":"character varying(50)","attnotnull":false,"default_expression":"''free_trial''::character varying","attacl":null},{"schema":"public","table_name":"tenants","attname":"subscription_expires_at","type":"timestamp with time zone","attnotnull":false,"default_expression":"(now() + ''30 days''::interval)","attacl":null},{"schema":"public","table_name":"tenants","attname":"sms_allotment_used","type":"integer","attnotnull":false,"default_expression":"0","attacl":null},{"schema":"public","table_name":"tenants","attname":"role_permissions","type":"jsonb","attnotnull":false,"default_expression":"''{\"ktv_lead\": {\"crm\": true, \"chat\": true, \"audit\": false, \"salary\": false, \"finance\": false, \"bookings\": true, \"services\": true, \"sessions\": true, \"settings\": false, \"customers\": false, \"dashboard\": true, \"inventory\": false, \"reconciliation\": false}}''::jsonb","attacl":null},{"schema":"public","table_name":"tenants","attname":"royalty_type","type":"character varying(20)","attnotnull":false,"default_expression":"''percentage''::character varying","attacl":null},{"schema":"public","table_name":"tenants","attname":"royalty_fixed_amount","type":"numeric(12,2)","attnotnull":false,"default_expression":"0.00","attacl":null},{"schema":"public","table_name":"tenants","attname":"internal_clearing_rate","type":"numeric(12,2)","attnotnull":false,"default_expression":"150000.00","attacl":null},{"schema":"public","table_name":"tenants","attname":"tenant_lat","type":"double precision","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"tenant_lon","type":"double precision","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"gps_threshold_m","type":"integer","attnotnull":false,"default_expression":"200","attacl":null},{"schema":"public","table_name":"tenants","attname":"accounting_mode","type":"text","attnotnull":false,"default_expression":"''SIMPLE''::text","attacl":null},{"schema":"public","table_name":"tenants","attname":"logo_url","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"tenants","attname":"enabled_modules","type":"jsonb","attnotnull":true,"default_expression":"''{\"babycare\": true, \"beauty_spa\": false, \"student_training\": false}''::jsonb","attacl":null},{"schema":"public","table_name":"tenants","attname":"brand_theme","type":"jsonb","attnotnull":true,"default_expression":"''{}''::jsonb","attacl":null},{"schema":"public","table_name":"tenants","attname":"metadata","type":"jsonb","attnotnull":false,"default_expression":"''{}''::jsonb","attacl":null},{"schema":"public","table_name":"tenants","attname":"commission_config","type":"jsonb","attnotnull":false,"default_expression":"''{}''::jsonb","attacl":null},{"schema":"public","table_name":"tenants","attname":"product_key","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"user_org_unit_access","attname":"user_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"user_org_unit_access","attname":"tenant_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"user_org_unit_access","attname":"org_unit_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"user_org_unit_access","attname":"root_org_unit_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"user_org_unit_access","attname":"relationship_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"user_org_unit_access","attname":"access_source","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"users","attname":"id","type":"uuid","attnotnull":true,"default_expression":"uuid_generate_v4()","attacl":null},{"schema":"public","table_name":"users","attname":"email","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"users","attname":"full_name","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"users","attname":"phone","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"users","attname":"role","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"public","table_name":"users","attname":"avatar_url","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"users","attname":"status","type":"text","attnotnull":false,"default_expression":"''active''::text","attacl":null},{"schema":"public","table_name":"users","attname":"tenant_id","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"users","attname":"created_at","type":"timestamp with time zone","attnotnull":false,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"users","attname":"updated_at","type":"timestamp with time zone","attnotnull":false,"default_expression":"now()","attacl":null},{"schema":"public","table_name":"users","attname":"base_salary","type":"numeric","attnotnull":false,"default_expression":"6000000","attacl":null},{"schema":"public","table_name":"users","attname":"hire_date","type":"date","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"users","attname":"resignation_date","type":"date","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"public","table_name":"users","attname":"metadata","type":"jsonb","attnotnull":false,"default_expression":"''{}''::jsonb","attacl":null},{"schema":"public","table_name":"users","attname":"position_tier","type":"text","attnotnull":true,"default_expression":"''junior''::text","attacl":null},{"schema":"public","table_name":"users","attname":"leave_balance","type":"integer","attnotnull":false,"default_expression":"12","attacl":null},{"schema":"storage","table_name":"buckets","attname":"id","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"storage","table_name":"buckets","attname":"name","type":"text","attnotnull":true,"default_expression":null,"attacl":null},{"schema":"storage","table_name":"buckets","attname":"owner","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"storage","table_name":"buckets","attname":"created_at","type":"timestamp with time zone","attnotnull":false,"default_expression":"now()","attacl":null},{"schema":"storage","table_name":"buckets","attname":"updated_at","type":"timestamp with time zone","attnotnull":false,"default_expression":"now()","attacl":null},{"schema":"storage","table_name":"buckets","attname":"public","type":"boolean","attnotnull":false,"default_expression":"false","attacl":null},{"schema":"storage","table_name":"buckets","attname":"avif_autodetection","type":"boolean","attnotnull":false,"default_expression":"false","attacl":null},{"schema":"storage","table_name":"buckets","attname":"file_size_limit","type":"bigint","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"storage","table_name":"buckets","attname":"allowed_mime_types","type":"text[]","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"storage","table_name":"buckets","attname":"owner_id","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"storage","table_name":"buckets","attname":"type","type":"storage.buckettype","attnotnull":true,"default_expression":"''STANDARD''::storage.buckettype","attacl":null},{"schema":"storage","table_name":"buckets","attname":"versioning_status","type":"text","attnotnull":true,"default_expression":"''DISABLED''::text","attacl":null},{"schema":"storage","table_name":"buckets","attname":"lifecycle_configuration","type":"jsonb","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"storage","table_name":"buckets","attname":"lifecycle_configuration_generation","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"storage","table_name":"objects","attname":"id","type":"uuid","attnotnull":true,"default_expression":"gen_random_uuid()","attacl":null},{"schema":"storage","table_name":"objects","attname":"bucket_id","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"storage","table_name":"objects","attname":"name","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"storage","table_name":"objects","attname":"owner","type":"uuid","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"storage","table_name":"objects","attname":"created_at","type":"timestamp with time zone","attnotnull":false,"default_expression":"now()","attacl":null},{"schema":"storage","table_name":"objects","attname":"updated_at","type":"timestamp with time zone","attnotnull":false,"default_expression":"now()","attacl":null},{"schema":"storage","table_name":"objects","attname":"last_accessed_at","type":"timestamp with time zone","attnotnull":false,"default_expression":"now()","attacl":null},{"schema":"storage","table_name":"objects","attname":"metadata","type":"jsonb","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"storage","table_name":"objects","attname":"path_tokens","type":"text[]","attnotnull":false,"default_expression":"string_to_array(name, ''/''::text)","attacl":null},{"schema":"storage","table_name":"objects","attname":"version","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"storage","table_name":"objects","attname":"owner_id","type":"text","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"storage","table_name":"objects","attname":"user_metadata","type":"jsonb","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"storage","table_name":"objects","attname":"archived_at","type":"timestamp with time zone","attnotnull":false,"default_expression":null,"attacl":null},{"schema":"storage","table_name":"objects","attname":"is_delete_marker","type":"boolean","attnotnull":true,"default_expression":"false","attacl":null},{"schema":"storage","table_name":"objects","attname":"is_versioned","type":"boolean","attnotnull":true,"default_expression":"false","attacl":null}]'::jsonb)) THEN RAISE EXCEPTION 'Adoption before-state drift: columns'; END IF;
  IF (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'schema',to_jsonb(x)->>'table_name',to_jsonb(x)->>'conname'),'[]'::jsonb) FROM (SELECT n.nspname AS schema,c.relname AS table_name,k.conname,k.contype,CASE WHEN n.nspname='public' AND c.relname='bella_gate_tokens' AND k.conname='bella_gate_tokens_execution_result_check' AND k.contype='c' AND pg_get_constraintdef(k.oid)='CHECK (((execution_result)::text = ANY (ARRAY[(''success''::character varying)::text, (''failed''::character varying)::text, (''rollback''::character varying)::text])))' THEN 'CHECK (((execution_result)::text = ANY ((ARRAY[''success''::character varying, ''failed''::character varying, ''rollback''::character varying])::text[])))'
WHEN n.nspname='public' AND c.relname='bella_gate_tokens' AND k.conname='bella_gate_tokens_status_check' AND k.contype='c' AND pg_get_constraintdef(k.oid)='CHECK (((status)::text = ANY (ARRAY[(''issued''::character varying)::text, (''used''::character varying)::text, (''expired''::character varying)::text, (''revoked''::character varying)::text])))' THEN 'CHECK (((status)::text = ANY ((ARRAY[''issued''::character varying, ''used''::character varying, ''expired''::character varying, ''revoked''::character varying])::text[])))'
WHEN n.nspname='public' AND c.relname='bella_migration_approval' AND k.conname='bella_migration_approval_approver_role_check' AND k.contype='c' AND pg_get_constraintdef(k.oid)='CHECK (((approver_role)::text = ANY (ARRAY[(''admin''::character varying)::text, (''dba''::character varying)::text, (''tech_lead''::character varying)::text, (''emergency_override''::character varying)::text])))' THEN 'CHECK (((approver_role)::text = ANY ((ARRAY[''admin''::character varying, ''dba''::character varying, ''tech_lead''::character varying, ''emergency_override''::character varying])::text[])))'
WHEN n.nspname='public' AND c.relname='bella_migration_approval' AND k.conname='bella_migration_approval_mode_check' AND k.contype='c' AND pg_get_constraintdef(k.oid)='CHECK (((approval_mode)::text = ANY (ARRAY[(''separated''::character varying)::text, (''owner_operated''::character varying)::text])))' THEN 'CHECK (((approval_mode)::text = ANY ((ARRAY[''separated''::character varying, ''owner_operated''::character varying])::text[])))'
WHEN n.nspname='public' AND c.relname='bella_migration_approval' AND k.conname='bella_migration_approval_status_check' AND k.contype='c' AND pg_get_constraintdef(k.oid)='CHECK (((status)::text = ANY (ARRAY[(''requested''::character varying)::text, (''approved''::character varying)::text, (''revoked''::character varying)::text, (''used''::character varying)::text, (''expired''::character varying)::text, (''rejected''::character varying)::text])))' THEN 'CHECK (((status)::text = ANY ((ARRAY[''requested''::character varying, ''approved''::character varying, ''revoked''::character varying, ''used''::character varying, ''expired''::character varying, ''rejected''::character varying])::text[])))'
WHEN n.nspname='public' AND c.relname='bella_migration_approval' AND k.conname='bella_migration_approval_target_environment_check' AND k.contype='c' AND pg_get_constraintdef(k.oid)='CHECK (((target_environment)::text = ANY (ARRAY[(''production''::character varying)::text, (''staging''::character varying)::text, (''dev''::character varying)::text])))' THEN 'CHECK (((target_environment)::text = ANY ((ARRAY[''production''::character varying, ''staging''::character varying, ''dev''::character varying])::text[])))'
WHEN n.nspname='public' AND c.relname='bella_migration_approval' AND k.conname='status_valid' AND k.contype='c' AND pg_get_constraintdef(k.oid)='CHECK (((status)::text = ANY (ARRAY[(''requested''::character varying)::text, (''approved''::character varying)::text, (''executing''::character varying)::text, (''executed''::character varying)::text, (''execution_failed''::character varying)::text, (''revoked''::character varying)::text, (''expired''::character varying)::text, (''rejected''::character varying)::text])))' THEN 'CHECK (((status)::text = ANY ((ARRAY[''requested''::character varying, ''approved''::character varying, ''executing''::character varying, ''executed''::character varying, ''execution_failed''::character varying, ''revoked''::character varying, ''expired''::character varying, ''rejected''::character varying])::text[])))'
WHEN n.nspname='public' AND c.relname='tenants' AND k.conname='tenants_royalty_type_check' AND k.contype='c' AND pg_get_constraintdef(k.oid)='CHECK (((royalty_type)::text = ANY (ARRAY[(''fixed''::character varying)::text, (''percentage''::character varying)::text])))' THEN 'CHECK (((royalty_type)::text = ANY ((ARRAY[''fixed''::character varying, ''percentage''::character varying])::text[])))' ELSE pg_get_constraintdef(k.oid) END AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='public' AND c.relname=ANY(ARRAY['accounting_periods','auto_bookings','auto_brands','auto_customer_profiles','auto_deposits','auto_leads','auto_models','auto_service_history','auto_variants','auto_vehicle_owners','auto_vehicle_status_logs','auto_vehicles','bella_gate_tokens','bella_migration_approval','customers','org_units','tenants','user_org_unit_access','users']::text[])) OR (n.nspname='storage' AND c.relname IN ('objects','buckets'))) x) IS DISTINCT FROM (SELECT coalesce(jsonb_agg(value ORDER BY value->>'schema',value->>'table_name',value->>'conname'),'[]'::jsonb) FROM jsonb_array_elements('[{"schema":"public","table_name":"accounting_periods","conname":"accounting_periods_pkey","contype":"p","definition":"PRIMARY KEY (id)"},{"schema":"public","table_name":"accounting_periods","conname":"accounting_periods_status_check","contype":"c","definition":"CHECK ((status = ANY (ARRAY[''OPEN''::text, ''CLOSED''::text])))"},{"schema":"public","table_name":"accounting_periods","conname":"accounting_periods_tenant_id_fkey","contype":"f","definition":"FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE"},{"schema":"public","table_name":"accounting_periods","conname":"accounting_periods_tenant_id_name_key","contype":"u","definition":"UNIQUE (tenant_id, name)"},{"schema":"public","table_name":"accounting_periods","conname":"valid_date_range","contype":"c","definition":"CHECK ((start_date <= end_date))"},{"schema":"public","table_name":"auto_bookings","conname":"auto_bookings_customer_id_fkey","contype":"f","definition":"FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_bookings","conname":"auto_bookings_lead_id_fkey","contype":"f","definition":"FOREIGN KEY (lead_id) REFERENCES auto_leads(id) ON DELETE SET NULL"},{"schema":"public","table_name":"auto_bookings","conname":"auto_bookings_pkey","contype":"p","definition":"PRIMARY KEY (id)"},{"schema":"public","table_name":"auto_bookings","conname":"auto_bookings_tenant_id_fkey","contype":"f","definition":"FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_bookings","conname":"auto_bookings_variant_id_fkey","contype":"f","definition":"FOREIGN KEY (variant_id) REFERENCES auto_variants(id) ON DELETE RESTRICT"},{"schema":"public","table_name":"auto_bookings","conname":"auto_bookings_vehicle_id_fkey","contype":"f","definition":"FOREIGN KEY (vehicle_id) REFERENCES auto_vehicles(id) ON DELETE RESTRICT"},{"schema":"public","table_name":"auto_bookings","conname":"uq_auto_bookings_number","contype":"u","definition":"UNIQUE (tenant_id, booking_number)"},{"schema":"public","table_name":"auto_brands","conname":"auto_brands_pkey","contype":"p","definition":"PRIMARY KEY (id)"},{"schema":"public","table_name":"auto_brands","conname":"auto_brands_tenant_id_fkey","contype":"f","definition":"FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_brands","conname":"uq_auto_brands_name","contype":"u","definition":"UNIQUE (tenant_id, name)"},{"schema":"public","table_name":"auto_customer_profiles","conname":"auto_customer_profiles_customer_id_fkey","contype":"f","definition":"FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_customer_profiles","conname":"auto_customer_profiles_pkey","contype":"p","definition":"PRIMARY KEY (id)"},{"schema":"public","table_name":"auto_customer_profiles","conname":"auto_customer_profiles_tenant_id_fkey","contype":"f","definition":"FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_customer_profiles","conname":"uq_auto_customer_profiles","contype":"u","definition":"UNIQUE (tenant_id, customer_id)"},{"schema":"public","table_name":"auto_deposits","conname":"auto_deposits_amount_check","contype":"c","definition":"CHECK ((amount > (0)::numeric))"},{"schema":"public","table_name":"auto_deposits","conname":"auto_deposits_booking_id_fkey","contype":"f","definition":"FOREIGN KEY (booking_id) REFERENCES auto_bookings(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_deposits","conname":"auto_deposits_confirmed_by_fkey","contype":"f","definition":"FOREIGN KEY (confirmed_by) REFERENCES users(id)"},{"schema":"public","table_name":"auto_deposits","conname":"auto_deposits_created_by_fkey","contype":"f","definition":"FOREIGN KEY (created_by) REFERENCES users(id)"},{"schema":"public","table_name":"auto_deposits","conname":"auto_deposits_pkey","contype":"p","definition":"PRIMARY KEY (id)"},{"schema":"public","table_name":"auto_deposits","conname":"auto_deposits_tenant_id_fkey","contype":"f","definition":"FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_leads","conname":"auto_leads_assigned_sales_agent_id_fkey","contype":"f","definition":"FOREIGN KEY (assigned_sales_agent_id) REFERENCES users(id)"},{"schema":"public","table_name":"auto_leads","conname":"auto_leads_customer_id_fkey","contype":"f","definition":"FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_leads","conname":"auto_leads_pkey","contype":"p","definition":"PRIMARY KEY (id)"},{"schema":"public","table_name":"auto_leads","conname":"auto_leads_preferred_variant_id_fkey","contype":"f","definition":"FOREIGN KEY (preferred_variant_id) REFERENCES auto_variants(id) ON DELETE RESTRICT"},{"schema":"public","table_name":"auto_leads","conname":"auto_leads_tenant_id_fkey","contype":"f","definition":"FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_models","conname":"auto_models_brand_id_fkey","contype":"f","definition":"FOREIGN KEY (brand_id) REFERENCES auto_brands(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_models","conname":"auto_models_pkey","contype":"p","definition":"PRIMARY KEY (id)"},{"schema":"public","table_name":"auto_models","conname":"auto_models_tenant_id_fkey","contype":"f","definition":"FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_models","conname":"uq_auto_models_name","contype":"u","definition":"UNIQUE (tenant_id, brand_id, name)"},{"schema":"public","table_name":"auto_service_history","conname":"auto_service_history_appointment_id_fkey","contype":"f","definition":"FOREIGN KEY (appointment_id) REFERENCES auto_service_appointments(id) ON DELETE SET NULL"},{"schema":"public","table_name":"auto_service_history","conname":"auto_service_history_pkey","contype":"p","definition":"PRIMARY KEY (id)"},{"schema":"public","table_name":"auto_service_history","conname":"auto_service_history_quality_rating_check","contype":"c","definition":"CHECK (((quality_rating >= 1) AND (quality_rating <= 5)))"},{"schema":"public","table_name":"auto_service_history","conname":"auto_service_history_repair_order_id_fkey","contype":"f","definition":"FOREIGN KEY (repair_order_id) REFERENCES auto_repair_orders(id) ON DELETE SET NULL"},{"schema":"public","table_name":"auto_service_history","conname":"auto_service_history_tenant_id_fkey","contype":"f","definition":"FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_service_history","conname":"auto_service_history_vehicle_id_fkey","contype":"f","definition":"FOREIGN KEY (vehicle_id) REFERENCES auto_vehicles(id) ON DELETE RESTRICT"},{"schema":"public","table_name":"auto_variants","conname":"auto_variants_model_id_fkey","contype":"f","definition":"FOREIGN KEY (model_id) REFERENCES auto_models(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_variants","conname":"auto_variants_pkey","contype":"p","definition":"PRIMARY KEY (id)"},{"schema":"public","table_name":"auto_variants","conname":"auto_variants_tenant_id_fkey","contype":"f","definition":"FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_variants","conname":"uq_auto_variants_name","contype":"u","definition":"UNIQUE (tenant_id, model_id, name, year)"},{"schema":"public","table_name":"auto_vehicle_owners","conname":"auto_vehicle_owners_customer_id_fkey","contype":"f","definition":"FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_vehicle_owners","conname":"auto_vehicle_owners_pkey","contype":"p","definition":"PRIMARY KEY (id)"},{"schema":"public","table_name":"auto_vehicle_owners","conname":"auto_vehicle_owners_tenant_id_fkey","contype":"f","definition":"FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_vehicle_owners","conname":"auto_vehicle_owners_vehicle_id_fkey","contype":"f","definition":"FOREIGN KEY (vehicle_id) REFERENCES auto_vehicles(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_vehicle_owners","conname":"uq_primary_owner_per_vehicle","contype":"u","definition":"UNIQUE (tenant_id, vehicle_id, ownership_type) DEFERRABLE INITIALLY DEFERRED"},{"schema":"public","table_name":"auto_vehicle_status_logs","conname":"auto_vehicle_status_logs_changed_by_user_id_fkey","contype":"f","definition":"FOREIGN KEY (changed_by_user_id) REFERENCES users(id)"},{"schema":"public","table_name":"auto_vehicle_status_logs","conname":"auto_vehicle_status_logs_pkey","contype":"p","definition":"PRIMARY KEY (id)"},{"schema":"public","table_name":"auto_vehicle_status_logs","conname":"auto_vehicle_status_logs_tenant_id_fkey","contype":"f","definition":"FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_vehicle_status_logs","conname":"auto_vehicle_status_logs_vehicle_id_fkey","contype":"f","definition":"FOREIGN KEY (vehicle_id) REFERENCES auto_vehicles(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_vehicles","conname":"auto_vehicles_allocated_by_user_id_fkey","contype":"f","definition":"FOREIGN KEY (allocated_by_user_id) REFERENCES users(id)"},{"schema":"public","table_name":"auto_vehicles","conname":"auto_vehicles_pkey","contype":"p","definition":"PRIMARY KEY (id)"},{"schema":"public","table_name":"auto_vehicles","conname":"auto_vehicles_tenant_id_fkey","contype":"f","definition":"FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE"},{"schema":"public","table_name":"auto_vehicles","conname":"auto_vehicles_variant_id_fkey","contype":"f","definition":"FOREIGN KEY (variant_id) REFERENCES auto_variants(id) ON DELETE RESTRICT"},{"schema":"public","table_name":"auto_vehicles","conname":"chk_auto_vehicles_vin_length","contype":"c","definition":"CHECK ((char_length(vin) = 17))"},{"schema":"public","table_name":"auto_vehicles","conname":"uq_auto_vehicles_vin","contype":"u","definition":"UNIQUE (tenant_id, vin)"},{"schema":"public","table_name":"bella_gate_tokens","conname":"bella_gate_tokens_approval_id_fkey","contype":"f","definition":"FOREIGN KEY (approval_id) REFERENCES bella_migration_approval(approval_id)"},{"schema":"public","table_name":"bella_gate_tokens","conname":"bella_gate_tokens_execution_result_check","contype":"c","definition":"CHECK (((execution_result)::text = ANY ((ARRAY[''success''::character varying, ''failed''::character varying, ''rollback''::character varying])::text[])))"},{"schema":"public","table_name":"bella_gate_tokens","conname":"bella_gate_tokens_nonce_key","contype":"u","definition":"UNIQUE (nonce)"},{"schema":"public","table_name":"bella_gate_tokens","conname":"bella_gate_tokens_pkey","contype":"p","definition":"PRIMARY KEY (token_id)"},{"schema":"public","table_name":"bella_gate_tokens","conname":"bella_gate_tokens_status_check","contype":"c","definition":"CHECK (((status)::text = ANY ((ARRAY[''issued''::character varying, ''used''::character varying, ''expired''::character varying, ''revoked''::character varying])::text[])))"},{"schema":"public","table_name":"bella_gate_tokens","conname":"token_expiry_max_ttl","contype":"c","definition":"CHECK ((expires_at <= (issued_at + ''00:01:00''::interval)))"},{"schema":"public","table_name":"bella_gate_tokens","conname":"token_expiry_valid","contype":"c","definition":"CHECK ((expires_at > issued_at))"},{"schema":"public","table_name":"bella_gate_tokens","conname":"token_used_at_valid","contype":"c","definition":"CHECK (((used_at IS NULL) OR (used_at >= issued_at)))"},{"schema":"public","table_name":"bella_gate_tokens","conname":"token_used_when_status_used","contype":"c","definition":"CHECK (((((status)::text = ''used''::text) AND (used_at IS NOT NULL)) OR (((status)::text <> ''used''::text) AND (used_at IS NULL))))"},{"schema":"public","table_name":"bella_migration_approval","conname":"bella_migration_approval_approver_role_check","contype":"c","definition":"CHECK (((approver_role)::text = ANY ((ARRAY[''admin''::character varying, ''dba''::character varying, ''tech_lead''::character varying, ''emergency_override''::character varying])::text[])))"},{"schema":"public","table_name":"bella_migration_approval","conname":"bella_migration_approval_mode_check","contype":"c","definition":"CHECK (((approval_mode)::text = ANY ((ARRAY[''separated''::character varying, ''owner_operated''::character varying])::text[])))"},{"schema":"public","table_name":"bella_migration_approval","conname":"bella_migration_approval_pkey","contype":"p","definition":"PRIMARY KEY (approval_id)"},{"schema":"public","table_name":"bella_migration_approval","conname":"bella_migration_approval_status_check","contype":"c","definition":"CHECK (((status)::text = ANY ((ARRAY[''requested''::character varying, ''approved''::character varying, ''revoked''::character varying, ''used''::character varying, ''expired''::character varying, ''rejected''::character varying])::text[])))"},{"schema":"public","table_name":"bella_migration_approval","conname":"bella_migration_approval_target_environment_check","contype":"c","definition":"CHECK (((target_environment)::text = ANY ((ARRAY[''production''::character varying, ''staging''::character varying, ''dev''::character varying])::text[])))"},{"schema":"public","table_name":"bella_migration_approval","conname":"no_self_approval","contype":"c","definition":"CHECK (((((approval_mode)::text = ''separated''::text) AND ((requester_id)::text <> (approver_id)::text)) OR ((approval_mode)::text = ''owner_operated''::text)))"},{"schema":"public","table_name":"bella_migration_approval","conname":"status_valid","contype":"c","definition":"CHECK (((status)::text = ANY ((ARRAY[''requested''::character varying, ''approved''::character varying, ''executing''::character varying, ''executed''::character varying, ''execution_failed''::character varying, ''revoked''::character varying, ''expired''::character varying, ''rejected''::character varying])::text[])))"},{"schema":"public","table_name":"customers","conname":"customers_phone_key","contype":"u","definition":"UNIQUE (phone)"},{"schema":"public","table_name":"customers","conname":"customers_pkey","contype":"p","definition":"PRIMARY KEY (id)"},{"schema":"public","table_name":"customers","conname":"customers_referrer_id_fkey","contype":"f","definition":"FOREIGN KEY (referrer_id) REFERENCES users(id)"},{"schema":"public","table_name":"customers","conname":"customers_tenant_id_fkey","contype":"f","definition":"FOREIGN KEY (tenant_id) REFERENCES tenants(id)"},{"schema":"public","table_name":"org_units","conname":"org_units_parent_id_fkey","contype":"f","definition":"FOREIGN KEY (parent_id) REFERENCES org_units(id) ON DELETE SET NULL"},{"schema":"public","table_name":"org_units","conname":"org_units_pkey","contype":"p","definition":"PRIMARY KEY (id)"},{"schema":"public","table_name":"org_units","conname":"org_units_tenant_id_fkey","contype":"f","definition":"FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE"},{"schema":"public","table_name":"org_units","conname":"org_units_unit_type_check","contype":"c","definition":"CHECK ((unit_type = ANY (ARRAY[''company''::text, ''region''::text, ''branch''::text, ''department''::text, ''team''::text, ''project''::text, ''task_force''::text, ''committee''::text])))"},{"schema":"public","table_name":"org_units","conname":"uq_org_unit_code","contype":"u","definition":"UNIQUE (tenant_id, code)"},{"schema":"public","table_name":"tenants","conname":"tenants_accounting_mode_check","contype":"c","definition":"CHECK ((accounting_mode = ANY (ARRAY[''SIMPLE''::text, ''PROFESSIONAL''::text])))"},{"schema":"public","table_name":"tenants","conname":"tenants_parent_tenant_id_fkey","contype":"f","definition":"FOREIGN KEY (parent_tenant_id) REFERENCES tenants(id)"},{"schema":"public","table_name":"tenants","conname":"tenants_pkey","contype":"p","definition":"PRIMARY KEY (id)"},{"schema":"public","table_name":"tenants","conname":"tenants_royalty_type_check","contype":"c","definition":"CHECK (((royalty_type)::text = ANY ((ARRAY[''fixed''::character varying, ''percentage''::character varying])::text[])))"},{"schema":"public","table_name":"tenants","conname":"tenants_status_check","contype":"c","definition":"CHECK ((status = ANY (ARRAY[''active''::text, ''suspended''::text, ''terminated''::text])))"},{"schema":"public","table_name":"users","conname":"users_email_key","contype":"u","definition":"UNIQUE (email)"},{"schema":"public","table_name":"users","conname":"users_pkey","contype":"p","definition":"PRIMARY KEY (id)"},{"schema":"public","table_name":"users","conname":"users_position_tier_check","contype":"c","definition":"CHECK ((position_tier = ANY (ARRAY[''junior''::text, ''senior''::text, ''lead''::text])))"},{"schema":"public","table_name":"users","conname":"users_role_check","contype":"c","definition":"CHECK ((role = ANY (ARRAY[''admin''::text, ''ktv_lead''::text, ''ktv''::text, ''admin_staff''::text, ''accountant''::text, ''hr''::text, ''student''::text, ''parent''::text])))"},{"schema":"public","table_name":"users","conname":"users_tenant_id_fkey","contype":"f","definition":"FOREIGN KEY (tenant_id) REFERENCES tenants(id)"},{"schema":"storage","table_name":"buckets","conname":"buckets_lifecycle_configuration_pair_check","contype":"c","definition":"CHECK (((lifecycle_configuration IS NULL) = (lifecycle_configuration_generation IS NULL)))"},{"schema":"storage","table_name":"buckets","conname":"buckets_lifecycle_configuration_shape_check","contype":"c","definition":"CHECK (((lifecycle_configuration IS NULL) OR ((jsonb_typeof(lifecycle_configuration) = ''object''::text) AND (lifecycle_configuration ? ''rules''::text) AND\nCASE\n    WHEN (jsonb_typeof((lifecycle_configuration -> ''rules''::text)) = ''array''::text) THEN ((jsonb_array_length((lifecycle_configuration -> ''rules''::text)) >= 1) AND (jsonb_array_length((lifecycle_configuration -> ''rules''::text)) <= 1000))\n    ELSE false\nEND)))"},{"schema":"storage","table_name":"buckets","conname":"buckets_lifecycle_configuration_standard_only_check","contype":"c","definition":"CHECK (((type = ''STANDARD''::storage.buckettype) OR ((lifecycle_configuration IS NULL) AND (lifecycle_configuration_generation IS NULL))))"},{"schema":"storage","table_name":"buckets","conname":"buckets_pkey","contype":"p","definition":"PRIMARY KEY (id)"},{"schema":"storage","table_name":"buckets","conname":"buckets_versioning_dark_check","contype":"c","definition":"CHECK ((versioning_status = ''DISABLED''::text))"},{"schema":"storage","table_name":"buckets","conname":"buckets_versioning_standard_only_check","contype":"c","definition":"CHECK (((type = ''STANDARD''::storage.buckettype) OR (versioning_status = ''DISABLED''::text)))"},{"schema":"storage","table_name":"buckets","conname":"buckets_versioning_status_check","contype":"c","definition":"CHECK ((versioning_status = ANY (ARRAY[''DISABLED''::text, ''ENABLED''::text, ''SUSPENDED''::text])))"},{"schema":"storage","table_name":"objects","conname":"objects_bucketId_fkey","contype":"f","definition":"FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id)"},{"schema":"storage","table_name":"objects","conname":"objects_pkey","contype":"p","definition":"PRIMARY KEY (id)"}]'::jsonb)) THEN RAISE EXCEPTION 'Adoption before-state drift: constraints'; END IF;
  IF (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'schemaname',to_jsonb(x)->>'tablename',to_jsonb(x)->>'policyname'),'[]'::jsonb) FROM (SELECT * FROM pg_policies WHERE (schemaname='public' AND tablename=ANY(ARRAY['accounting_periods','auto_bookings','auto_brands','auto_customer_profiles','auto_deposits','auto_leads','auto_models','auto_service_history','auto_variants','auto_vehicle_owners','auto_vehicle_status_logs','auto_vehicles','bella_gate_tokens','bella_migration_approval','customers','org_units','tenants','user_org_unit_access','users']::text[])) OR (schemaname='storage' AND tablename IN ('objects','buckets'))) x) IS DISTINCT FROM (SELECT coalesce(jsonb_agg(value ORDER BY value->>'schemaname',value->>'tablename',value->>'policyname'),'[]'::jsonb) FROM jsonb_array_elements('[{"schemaname":"public","tablename":"auto_service_history","policyname":"auto_service_history_no_delete","permissive":"PERMISSIVE","roles":["public"],"cmd":"DELETE","qual":"false","with_check":null},{"schemaname":"public","tablename":"auto_service_history","policyname":"auto_service_history_no_update","permissive":"PERMISSIVE","roles":["public"],"cmd":"UPDATE","qual":"false","with_check":null},{"schemaname":"public","tablename":"auto_service_history","policyname":"auto_service_history_tenant_isolation","permissive":"PERMISSIVE","roles":["public"],"cmd":"ALL","qual":"(tenant_id = (current_setting(''app.current_tenant_id''::text))::uuid)","with_check":null},{"schemaname":"public","tablename":"auto_vehicle_status_logs","policyname":"Anon view auto_vehicle_status_logs","permissive":"PERMISSIVE","roles":["anon"],"cmd":"SELECT","qual":"((get_auth_tenant_id() IS NOT NULL) AND (tenant_id = get_auth_tenant_id()))","with_check":null},{"schemaname":"public","tablename":"auto_vehicles","policyname":"Anon view auto_vehicles","permissive":"PERMISSIVE","roles":["anon"],"cmd":"SELECT","qual":"((get_auth_tenant_id() IS NOT NULL) AND (tenant_id = get_auth_tenant_id()))","with_check":null},{"schemaname":"public","tablename":"bella_gate_tokens","policyname":"gate_tokens_executor_only","permissive":"PERMISSIVE","roles":["public"],"cmd":"ALL","qual":"(CURRENT_USER = ''bella_migration_executor''::name)","with_check":"(CURRENT_USER = ''bella_migration_executor''::name)"},{"schemaname":"public","tablename":"customers","policyname":"Guest tạo customer khi booking","permissive":"PERMISSIVE","roles":["anon"],"cmd":"INSERT","qual":null,"with_check":"is_valid_tenant(tenant_id)"},{"schemaname":"public","tablename":"customers","policyname":"Staff can create/update customers in tenant","permissive":"PERMISSIVE","roles":["public"],"cmd":"ALL","qual":"(tenant_id = current_tenant_id())","with_check":null},{"schemaname":"public","tablename":"customers","policyname":"Staff can view customers in tenant","permissive":"PERMISSIVE","roles":["public"],"cmd":"SELECT","qual":"(tenant_id = current_tenant_id())","with_check":null},{"schemaname":"public","tablename":"customers","policyname":"Tenant isolation for customers","permissive":"PERMISSIVE","roles":["public"],"cmd":"ALL","qual":"(tenant_id = current_tenant_id())","with_check":null},{"schemaname":"public","tablename":"org_units","policyname":"org_units_admin_write","permissive":"PERMISSIVE","roles":["authenticated"],"cmd":"ALL","qual":"(is_hq_super_admin() OR ((tenant_id = get_auth_tenant_id()) AND (EXISTS ( SELECT 1\n   FROM users u\n  WHERE ((u.id = auth.uid()) AND (lower(u.role) = ANY (ARRAY[''admin''::text, ''super_admin''::text])))))))","with_check":"(is_hq_super_admin() OR ((tenant_id = get_auth_tenant_id()) AND (EXISTS ( SELECT 1\n   FROM users u\n  WHERE ((u.id = auth.uid()) AND (lower(u.role) = ANY (ARRAY[''admin''::text, ''super_admin''::text])))))))"},{"schemaname":"public","tablename":"org_units","policyname":"org_units_tenant_read","permissive":"PERMISSIVE","roles":["authenticated"],"cmd":"SELECT","qual":"(is_hq_super_admin() OR (tenant_id = get_auth_tenant_id()))","with_check":null},{"schemaname":"public","tablename":"tenants","policyname":"Admin can update their own tenant","permissive":"PERMISSIVE","roles":["authenticated"],"cmd":"UPDATE","qual":"(id = ( SELECT users.tenant_id\n   FROM users\n  WHERE ((users.id = auth.uid()) AND (users.role = ''admin''::text))))","with_check":"(id = ( SELECT users.tenant_id\n   FROM users\n  WHERE ((users.id = auth.uid()) AND (users.role = ''admin''::text))))"},{"schemaname":"public","tablename":"tenants","policyname":"Tenant read tenants","permissive":"PERMISSIVE","roles":["authenticated"],"cmd":"SELECT","qual":"((get_auth_tenant_id() IS NULL) OR (id = get_auth_tenant_id()))","with_check":null},{"schemaname":"public","tablename":"tenants","policyname":"block_rest_api_access","permissive":"PERMISSIVE","roles":["public"],"cmd":"ALL","qual":"false","with_check":"false"},{"schemaname":"public","tablename":"users","policyname":"Admins can view all users in tenant","permissive":"PERMISSIVE","roles":["public"],"cmd":"SELECT","qual":"((current_user_role() = ''admin''::text) AND (tenant_id = current_tenant_id()))","with_check":null},{"schemaname":"public","tablename":"users","policyname":"Admins manage tenant users","permissive":"PERMISSIVE","roles":["public"],"cmd":"ALL","qual":"((current_user_role() = ''admin''::text) AND (tenant_id = current_tenant_id()))","with_check":null},{"schemaname":"public","tablename":"users","policyname":"User tự xem và sửa chính mình","permissive":"PERMISSIVE","roles":["authenticated"],"cmd":"ALL","qual":"(id = auth.uid())","with_check":null},{"schemaname":"public","tablename":"users","policyname":"Users can view own profile","permissive":"PERMISSIVE","roles":["public"],"cmd":"SELECT","qual":"(auth.uid() = id)","with_check":null},{"schemaname":"public","tablename":"users","policyname":"Users can view their own profile","permissive":"PERMISSIVE","roles":["public"],"cmd":"SELECT","qual":"(auth.uid() = id)","with_check":null}]'::jsonb)) THEN RAISE EXCEPTION 'Adoption before-state drift: policies'; END IF;
  IF (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'schema',to_jsonb(x)->>'table_name',to_jsonb(x)->>'tgname'),'[]'::jsonb) FROM (SELECT n.nspname AS schema,c.relname AS table_name,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND ((n.nspname='public' AND c.relname=ANY(ARRAY['accounting_periods','auto_bookings','auto_brands','auto_customer_profiles','auto_deposits','auto_leads','auto_models','auto_service_history','auto_variants','auto_vehicle_owners','auto_vehicle_status_logs','auto_vehicles','bella_gate_tokens','bella_migration_approval','customers','org_units','tenants','user_org_unit_access','users']::text[])) OR (n.nspname='storage' AND c.relname IN ('objects','buckets')))) x) IS DISTINCT FROM (SELECT coalesce(jsonb_agg(value ORDER BY value->>'schema',value->>'table_name',value->>'tgname'),'[]'::jsonb) FROM jsonb_array_elements('[{"schema":"public","table_name":"auto_bookings","tgname":"auto_bookings_temporal_trigger","tgenabled":"O","definition":"CREATE TRIGGER auto_bookings_temporal_trigger BEFORE UPDATE ON public.auto_bookings FOR EACH ROW EXECUTE FUNCTION temporal_snapshot_auto_bookings()"},{"schema":"public","table_name":"auto_bookings","tgname":"trg_auto_bookings_updated_at","tgenabled":"O","definition":"CREATE TRIGGER trg_auto_bookings_updated_at BEFORE UPDATE ON public.auto_bookings FOR EACH ROW EXECUTE FUNCTION auto_set_updated_at()"},{"schema":"public","table_name":"auto_customer_profiles","tgname":"trg_auto_customer_profiles_updated_at","tgenabled":"O","definition":"CREATE TRIGGER trg_auto_customer_profiles_updated_at BEFORE UPDATE ON public.auto_customer_profiles FOR EACH ROW EXECUTE FUNCTION auto_set_updated_at()"},{"schema":"public","table_name":"auto_deposits","tgname":"trg_auto_deposits_updated_at","tgenabled":"O","definition":"CREATE TRIGGER trg_auto_deposits_updated_at BEFORE UPDATE ON public.auto_deposits FOR EACH ROW EXECUTE FUNCTION auto_set_updated_at()"},{"schema":"public","table_name":"auto_leads","tgname":"trg_auto_leads_updated_at","tgenabled":"O","definition":"CREATE TRIGGER trg_auto_leads_updated_at BEFORE UPDATE ON public.auto_leads FOR EACH ROW EXECUTE FUNCTION auto_set_updated_at()"},{"schema":"public","table_name":"auto_vehicle_owners","tgname":"trg_auto_vehicle_owners_updated_at","tgenabled":"O","definition":"CREATE TRIGGER trg_auto_vehicle_owners_updated_at BEFORE UPDATE ON public.auto_vehicle_owners FOR EACH ROW EXECUTE FUNCTION auto_set_updated_at()"},{"schema":"public","table_name":"auto_vehicles","tgname":"auto_vehicles_temporal_trigger","tgenabled":"O","definition":"CREATE TRIGGER auto_vehicles_temporal_trigger BEFORE UPDATE ON public.auto_vehicles FOR EACH ROW EXECUTE FUNCTION temporal_snapshot_auto_vehicles()"},{"schema":"public","table_name":"auto_vehicles","tgname":"trg_auto_vehicles_updated_at","tgenabled":"O","definition":"CREATE TRIGGER trg_auto_vehicles_updated_at BEFORE UPDATE ON public.auto_vehicles FOR EACH ROW EXECUTE FUNCTION auto_set_updated_at()"},{"schema":"public","table_name":"customers","tgname":"audit_customers_changes","tgenabled":"O","definition":"CREATE TRIGGER audit_customers_changes AFTER INSERT OR DELETE OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION log_audit_event()"},{"schema":"public","table_name":"customers","tgname":"update_customers_updated_at","tgenabled":"O","definition":"CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()"},{"schema":"public","table_name":"tenants","tgname":"audit_tenants_changes","tgenabled":"O","definition":"CREATE TRIGGER audit_tenants_changes AFTER INSERT OR DELETE OR UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION log_audit_event()"},{"schema":"public","table_name":"tenants","tgname":"update_tenants_updated_at","tgenabled":"O","definition":"CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()"},{"schema":"public","table_name":"users","tgname":"audit_users_changes","tgenabled":"O","definition":"CREATE TRIGGER audit_users_changes AFTER INSERT OR DELETE OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION log_audit_event()"},{"schema":"public","table_name":"users","tgname":"tr_sync_user_claims","tgenabled":"O","definition":"CREATE TRIGGER tr_sync_user_claims AFTER INSERT OR UPDATE OF role, tenant_id ON public.users FOR EACH ROW EXECUTE FUNCTION sync_user_claims_to_auth()"},{"schema":"public","table_name":"users","tgname":"update_users_updated_at","tgenabled":"O","definition":"CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()"},{"schema":"storage","table_name":"buckets","tgname":"enforce_bucket_name_length_trigger","tgenabled":"O","definition":"CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length()"},{"schema":"storage","table_name":"buckets","tgname":"protect_bucket_control_insert","tgenabled":"O","definition":"CREATE TRIGGER protect_bucket_control_insert BEFORE INSERT ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns(''service_role'')"},{"schema":"storage","table_name":"buckets","tgname":"protect_bucket_control_update","tgenabled":"O","definition":"CREATE TRIGGER protect_bucket_control_update BEFORE UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns()"},{"schema":"storage","table_name":"buckets","tgname":"protect_bucket_control_update_role","tgenabled":"O","definition":"CREATE TRIGGER protect_bucket_control_update_role AFTER UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_lifecycle_service_role(''service_role'')"},{"schema":"storage","table_name":"buckets","tgname":"protect_buckets_delete","tgenabled":"O","definition":"CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete()"},{"schema":"storage","table_name":"objects","tgname":"protect_objects_delete","tgenabled":"O","definition":"CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete()"},{"schema":"storage","table_name":"objects","tgname":"update_objects_updated_at","tgenabled":"O","definition":"CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column()"}]'::jsonb)) THEN RAISE EXCEPTION 'Adoption before-state drift: triggers'; END IF;
  IF (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'proname',to_jsonb(x)->>'arguments'),'[]'::jsonb) FROM (SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proacl::text,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') AS definition_sha256 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND (p.proname IN ('get_auth_tenant_id','is_admin','is_hr','is_accountant','is_hq_super_admin','is_hq_admin','mobility_tenant_access_allowed') OR p.proname LIKE '%automove%' OR p.proname LIKE '%auto_vehicle_sale%')) x) IS DISTINCT FROM (SELECT coalesce(jsonb_agg(value ORDER BY value->>'proname',value->>'arguments'),'[]'::jsonb) FROM jsonb_array_elements('[{"proname":"get_auth_tenant_id","arguments":"","owner":"postgres","prosecdef":true,"proacl":"{=X/postgres,postgres=X/postgres,service_role=X/postgres,bella_migration_executor=X/postgres}","definition_sha256":"50a64782ca01ca5bbc1eff647af2ba61830d41611227878f2a43af7b4a6addbd"},{"proname":"is_accountant","arguments":"","owner":"postgres","prosecdef":true,"proacl":"{=X/postgres,postgres=X/postgres,service_role=X/postgres,bella_migration_executor=X/postgres}","definition_sha256":"fac12c4d0f84adee6c2c62c395907b22f6910da2ef22ce17b852bb4d719bc92e"},{"proname":"is_admin","arguments":"","owner":"postgres","prosecdef":true,"proacl":"{=X/postgres,postgres=X/postgres,service_role=X/postgres,bella_migration_executor=X/postgres}","definition_sha256":"d83d499fee5628327c49b4e4e2bbb0741e3caf62732b7ba1939b708da839654a"},{"proname":"is_hq_admin","arguments":"","owner":"postgres","prosecdef":true,"proacl":"{=X/postgres,postgres=X/postgres,service_role=X/postgres,bella_migration_executor=X/postgres}","definition_sha256":"95cecedeb92bd9aef48f9103a648217b938cf0b9c37ca2e33ae240b7ed6829cb"},{"proname":"is_hq_super_admin","arguments":"","owner":"postgres","prosecdef":true,"proacl":"{=X/postgres,postgres=X/postgres,service_role=X/postgres,bella_migration_executor=X/postgres}","definition_sha256":"2a9b05b30676870aae1f3c2b7af3e09c3ead2e4fa8dbce1a38b16a8a77a07a8d"},{"proname":"is_hr","arguments":"","owner":"postgres","prosecdef":true,"proacl":"{=X/postgres,postgres=X/postgres,service_role=X/postgres,bella_migration_executor=X/postgres}","definition_sha256":"b66de364108b6fcf950abb8d2a4eb8d627848c7eb438c89fb07c8dcc5142238a"}]'::jsonb)) THEN RAISE EXCEPTION 'Adoption before-state drift: functions'; END IF;
END $adoption_before$;

-- Dependency unit 1: supabase/migrations/20261016010000_align_automove_catalog_read_acl.sql
-- Git SHA-256 4b87b19444ef4b5f788278c94d8709983d94fe991674e48b9fcdc091fa83750e
-- Forward-only catalog adoption. Run atomically with its checks; no owner changes.
DO $$
DECLARE
  target_name text;
  target_oid oid;
  column_name text;
  grantee_name text;
BEGIN
  IF to_regclass('public.users') IS NULL OR to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Catalog ACL alignment requires canonical users and tenants.';
  END IF;
  FOREACH target_name IN ARRAY ARRAY['auto_brands', 'auto_models', 'auto_variants'] LOOP
    target_oid := to_regclass('public.' || target_name);
    IF target_oid IS NULL OR NOT EXISTS (
      SELECT 1 FROM pg_class WHERE oid = target_oid AND relkind = 'r' AND relrowsecurity
    ) THEN
      RAISE EXCEPTION 'Catalog ACL alignment requires an existing RLS table: public.%.', target_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_roles r ON r.rolname = current_user
      WHERE c.oid = target_oid AND (r.rolsuper OR pg_has_role(current_user, c.relowner, 'USAGE'))
    ) THEN
      RAISE EXCEPTION 'Catalog ACL alignment requires table-owner DDL authority: public.%.', target_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute WHERE attrelid = target_oid AND attname = 'tenant_id'
        AND atttypid = 'uuid'::regtype AND attnum > 0 AND NOT attisdropped
    ) THEN
      RAISE EXCEPTION 'Catalog ACL alignment requires canonical uuid tenant_id: public.%.', target_name;
    END IF;
  END LOOP;

  FOREACH target_name IN ARRAY ARRAY['auto_brands', 'auto_models', 'auto_variants'] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM PUBLIC, anon, authenticated', target_name);
    EXECUTE format('REVOKE SELECT ON TABLE public.%I FROM PUBLIC, anon', target_name);
    -- Table revocation does not remove column grants or privileges inherited via roles.
    FOR column_name IN
      SELECT attname FROM pg_attribute
      WHERE attrelid = to_regclass('public.' || target_name) AND attnum > 0 AND NOT attisdropped
    LOOP
      EXECUTE format('REVOKE INSERT (%I), UPDATE (%I), REFERENCES (%I) ON TABLE public.%I FROM PUBLIC, anon, authenticated',
        column_name, column_name, column_name, target_name);
      EXECUTE format('REVOKE SELECT (%I) ON TABLE public.%I FROM PUBLIC, anon', column_name, target_name);
    END LOOP;

    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', target_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', target_name || '_tenant_read_access', target_name);
    EXECUTE format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
        WHERE u.id = (SELECT auth.uid()) AND u.status = ''active''
          AND u.tenant_id = %I.tenant_id AND t.status = ''active''))',
      target_name || '_tenant_read_access', target_name, target_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', target_name || '_tenant_read_guard', target_name);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
        WHERE u.id = (SELECT auth.uid()) AND u.status = ''active''
          AND u.tenant_id = %I.tenant_id AND t.status = ''active''))',
      target_name || '_tenant_read_guard', target_name, target_name);

    FOREACH grantee_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_table_privilege(grantee_name, 'public.' || target_name, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
         OR has_any_column_privilege(grantee_name, 'public.' || target_name, 'INSERT,UPDATE,REFERENCES') THEN
        RAISE EXCEPTION 'Catalog inherited write privileges require separate authority: public.%, role %.', target_name, grantee_name;
      END IF;
    END LOOP;
    IF has_any_column_privilege('anon', 'public.' || target_name, 'SELECT')
       OR NOT has_table_privilege('authenticated', 'public.' || target_name, 'SELECT') THEN
      RAISE EXCEPTION 'Catalog effective SELECT contract not satisfied: public.%.', target_name;
    END IF;
  END LOOP;
END $$;

-- Dependency unit 2: supabase/migrations/20261014020000_create_policy_registry_user_identity_forward.sql
-- Git SHA-256 b121ac951eeba088bf26949826fb43f4d2a44e225a09942d95befb52eb881878
-- ============================================================================
-- Policy registry user identity forward migration
-- Scope: AutoMove active global accounting policy resolution only.
-- Non-goals: no public.profiles compatibility table, no policy_history lifecycle,
-- no Finance ledger posting, no tenant-specific policy assignment.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'policy_registry forward migration requires public.users as canonical actor identity.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.policy_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  category TEXT,
  tenant_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  parent_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_by UUID,
  published_at TIMESTAMPTZ,
  published_by UUID,
  deprecated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  owner_department TEXT,
  business_owner TEXT,
  business_owner_email TEXT,
  technical_owner TEXT,
  technical_owner_email TEXT,
  review_date DATE,
  effective_date DATE,
  expire_date DATE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_decisions INTEGER NOT NULL DEFAULT 0,
  total_approvals INTEGER NOT NULL DEFAULT 0,
  total_rejections INTEGER NOT NULL DEFAULT 0,
  avg_confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_decision_at TIMESTAMPTZ
);

ALTER TABLE public.policy_registry
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS policy_id TEXT,
  ADD COLUMN IF NOT EXISTS version TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_version TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID,
  ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID,
  ADD COLUMN IF NOT EXISTS owner_department TEXT,
  ADD COLUMN IF NOT EXISTS business_owner TEXT,
  ADD COLUMN IF NOT EXISTS business_owner_email TEXT,
  ADD COLUMN IF NOT EXISTS technical_owner TEXT,
  ADD COLUMN IF NOT EXISTS technical_owner_email TEXT,
  ADD COLUMN IF NOT EXISTS review_date DATE,
  ADD COLUMN IF NOT EXISTS effective_date DATE,
  ADD COLUMN IF NOT EXISTS expire_date DATE,
  ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS total_decisions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_approvals INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_rejections INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_confidence NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_decision_at TIMESTAMPTZ;

DO $$
DECLARE
  legacy_profile_fk TEXT;
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    SELECT constraint_info.conname
      INTO legacy_profile_fk
      FROM pg_constraint constraint_info
     WHERE constraint_info.conrelid = 'public.policy_registry'::regclass
       AND constraint_info.confrelid = 'public.profiles'::regclass
       AND constraint_info.contype = 'f'
     LIMIT 1;

    IF legacy_profile_fk IS NOT NULL THEN
      RAISE EXCEPTION 'policy_registry still has legacy public.profiles foreign key %. Resolve identity ownership before applying this forward migration.', legacy_profile_fk;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND conname = 'policy_registry_pkey'
  ) THEN
    ALTER TABLE public.policy_registry ADD CONSTRAINT policy_registry_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND contype = 'u'
       AND conkey = ARRAY[
         (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.policy_registry'::regclass AND attname = 'policy_id'),
         (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.policy_registry'::regclass AND attname = 'version')
       ]::int2[]
  ) THEN
    ALTER TABLE public.policy_registry
      ADD CONSTRAINT policy_registry_policy_version_key UNIQUE (policy_id, version);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND conname = 'policy_registry_status_check'
  ) THEN
    ALTER TABLE public.policy_registry
      ADD CONSTRAINT policy_registry_status_check
      CHECK (status IN ('draft', 'active', 'deprecated', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND conname = 'policy_registry_version_check'
  ) THEN
    ALTER TABLE public.policy_registry
      ADD CONSTRAINT policy_registry_version_check
      CHECK (version ~ '^[0-9]+[.][0-9]+[.][0-9]+$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND conname = 'policy_registry_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.policy_registry
      ADD CONSTRAINT policy_registry_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND conname = 'policy_registry_created_by_users_fkey'
  ) THEN
    ALTER TABLE public.policy_registry
      ADD CONSTRAINT policy_registry_created_by_users_fkey
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND conname = 'policy_registry_updated_by_users_fkey'
  ) THEN
    ALTER TABLE public.policy_registry
      ADD CONSTRAINT policy_registry_updated_by_users_fkey
      FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND conname = 'policy_registry_published_by_users_fkey'
  ) THEN
    ALTER TABLE public.policy_registry
      ADD CONSTRAINT policy_registry_published_by_users_fkey
      FOREIGN KEY (published_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND conname = 'policy_registry_deleted_by_users_fkey'
  ) THEN
    ALTER TABLE public.policy_registry
      ADD CONSTRAINT policy_registry_deleted_by_users_fkey
      FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- zero-downtime: allow blocking-index - new forward-compatible registry lookup index for additive table
CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_registry_one_active
  ON public.policy_registry (policy_id)
  WHERE is_active = true AND deleted_at IS NULL;

-- zero-downtime: allow blocking-index - new forward-compatible active policy lookup index for additive table
CREATE INDEX IF NOT EXISTS idx_policy_registry_active_lookup
  ON public.policy_registry (policy_id, effective_date, expire_date)
  WHERE status = 'active' AND is_active = true AND deleted_at IS NULL;

ALTER TABLE public.policy_registry ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'policy_registry'
       AND policyname = 'policy_registry_read_active_global_accounting_policy'
  ) THEN
    CREATE POLICY "policy_registry_read_active_global_accounting_policy"
      ON public.policy_registry
      FOR SELECT TO authenticated
      USING (
        tenant_id IS NULL
        AND status = 'active'
        AND is_active = true
        AND deleted_at IS NULL
      );
  END IF;
END $$;

REVOKE ALL ON TABLE public.policy_registry FROM PUBLIC;
REVOKE ALL ON TABLE public.policy_registry FROM anon;
REVOKE ALL ON TABLE public.policy_registry FROM authenticated;
GRANT SELECT ON TABLE public.policy_registry TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.policy_registry TO service_role;

DO $$
DECLARE
  conflicting_policy RECORD;
BEGIN
  SELECT policy_id, version, status, is_active, tenant_id, deleted_at
    INTO conflicting_policy
    FROM public.policy_registry
   WHERE policy_id = 'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY'
     AND version = '1.0.0'
   LIMIT 1;

  IF FOUND THEN
    IF conflicting_policy.status <> 'active'
       OR conflicting_policy.is_active IS DISTINCT FROM true
       OR conflicting_policy.tenant_id IS NOT NULL
       OR conflicting_policy.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Existing AutoMove accounting policy v1 conflicts with approved active global policy semantics.';
    END IF;
  ELSE
    INSERT INTO public.policy_registry (
      policy_id,
      version,
      name,
      description,
      status,
      category,
      tenant_id,
      is_active,
      effective_date,
      expire_date,
      owner_department,
      business_owner,
      technical_owner,
      config,
      metadata
    )
    VALUES (
      'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY',
      '1.0.0',
      'AutoMove Vehicle Sale Accounting Policy v1',
      'Approved v1 policy identity for trusted AutoMove vehicle sale revenue recognition resolution. Ledger posting remains outside this migration.',
      'active',
      'accounting',
      NULL,
      true,
      DATE '2026-01-01',
      NULL,
      'Finance',
      'Bella AutoMove',
      'Bella Platform',
      jsonb_build_object(
        'scope', 'vehicle_sale_revenue_recognition',
        'currency_code', 'VND',
        'ledger_posting_authorized', false,
        'finance_ledger_posting', 'NOT_AUTHORIZED'
      ),
      jsonb_build_object(
        'approval_scope', 'ACCOUNTING_POLICY_V1_PROPOSED_DEFAULTS',
        'historical_policy_immutability', 'REQUIRED',
        'trusted_policy_resolution', 'REQUIRED',
        'production_mutation', 'NOT_AUTHORIZED'
      )
    );
  END IF;
END $$;

COMMENT ON TABLE public.policy_registry IS
  'Forward-compatible trusted policy registry for active global AutoMove accounting policy resolution. Actor identity references public.users; public.profiles is not part of this contract.';

COMMENT ON POLICY "policy_registry_read_active_global_accounting_policy" ON public.policy_registry IS
  'Authenticated users may read only active non-deleted global policies. Policy writes remain service-role/governance controlled.';

-- Dependency unit 3: supabase/migrations/20261015040000_align_platform_identity_hq_authority.sql
-- Git SHA-256 1e75e3f25d24814ca0e2f3f31e80447b091d34a53c1c7f2c5fd12e96d208c108
-- Current authorization comes from canonical live data, not cached JWT metadata.
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT u.tenant_id INTO v_tenant_id
  FROM public.users AS u
  JOIN public.tenants AS t ON t.id = u.tenant_id
  WHERE u.id = auth.uid() AND u.status = 'active' AND t.status = 'active';

  -- NULL would enable legacy policies using NULL as an unrestricted HQ sentinel.
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Active canonical identity and tenant required' USING ERRCODE = '42501';
  END IF;
  RETURN v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u JOIN public.tenants AS t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.status = 'active' AND t.status = 'active' AND u.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_hr()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u JOIN public.tenants AS t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.status = 'active' AND t.status = 'active' AND u.role = 'hr'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_accountant()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u JOIN public.tenants AS t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.status = 'active' AND t.status = 'active' AND u.role = 'accountant'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_hq_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u JOIN public.tenants AS t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.status = 'active' AND t.status = 'active'
      AND u.role = 'admin' AND t.product_key = 'bella_hq'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_hq_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_hq_super_admin();
$$;

-- Dependency unit 4: supabase/migrations/20261015040100_preserve_explicit_active_hq_tenant_management.sql
-- Git SHA-256 fa50ead7cadc449fa0f05359e9f222b2996323bfb0775d595a8796ed4533413c
-- Explicit Platform tenant management, not a NULL-tenant bypass into Product data.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.tenants'::regclass AND polname = 'platform_active_hq_tenant_select') THEN
    CREATE POLICY platform_active_hq_tenant_select ON public.tenants
      FOR SELECT TO authenticated USING (public.is_hq_super_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.tenants'::regclass AND polname = 'platform_active_hq_tenant_update') THEN
    CREATE POLICY platform_active_hq_tenant_update ON public.tenants
      FOR UPDATE TO authenticated
      USING (public.is_hq_super_admin()) WITH CHECK (public.is_hq_super_admin());
  END IF;
END;
$$;

ALTER POLICY platform_active_hq_tenant_select ON public.tenants
  TO authenticated USING (public.is_hq_super_admin());
ALTER POLICY platform_active_hq_tenant_update ON public.tenants
  TO authenticated USING (public.is_hq_super_admin()) WITH CHECK (public.is_hq_super_admin());

-- Dependency unit 5: supabase/migrations/20261013120000_create_mobility_os_foundation_contract.sql
-- Git SHA-256 a905b45ee856b9e7eae6f93baa980b1745a60887cc71eb9ae1d72de6b5c07793
-- Mobility OS Foundation MVP contract controls
-- Scope: command idempotency and domain audit only.
-- Existing auto_* tables remain the persistence adapter for vehicles, ownership,
-- lifecycle logs, appointments, repair orders, and service history.

CREATE TABLE IF NOT EXISTS public.mobility_domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  org_unit_id UUID REFERENCES public.org_units(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL CHECK (
    entity_type IN ('vehicle', 'vehicle_owner', 'vehicle_status', 'service_history')
  ),
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_mobility_domain_events_tenant_id UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.mobility_command_idempotency (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  org_unit_id UUID REFERENCES public.org_units(id) ON DELETE SET NULL,
  operation TEXT NOT NULL,
  business_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT pk_mobility_command_idempotency PRIMARY KEY (tenant_id, operation, business_key)
);

-- zero-downtime: allow blocking-index - new Mobility OS control tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_mobility_domain_events_entity
  ON public.mobility_domain_events(tenant_id, entity_id, recorded_at);

-- zero-downtime: allow blocking-index - new Mobility OS control tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_mobility_domain_events_org_unit
  ON public.mobility_domain_events(tenant_id, org_unit_id, recorded_at);

-- zero-downtime: allow blocking-index - new Mobility OS control tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_mobility_command_idempotency_org_unit
  ON public.mobility_command_idempotency(tenant_id, org_unit_id, created_at);

CREATE OR REPLACE FUNCTION public.mobility_tenant_access_allowed(
  p_tenant_id UUID,
  p_org_unit_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p_tenant_id = public.get_auth_tenant_id()
    AND (
      (
        p_org_unit_id IS NULL
        AND auth.uid() IS NOT NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_org_unit_access access
        WHERE access.tenant_id = p_tenant_id
          AND access.org_unit_id = p_org_unit_id
          AND access.user_id = auth.uid()
      )
    );
$$;

ALTER TABLE public.mobility_domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_command_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mobility_domain_events_tenant_access ON public.mobility_domain_events;
CREATE POLICY mobility_domain_events_tenant_access
  ON public.mobility_domain_events
  FOR ALL TO authenticated
  USING (public.mobility_tenant_access_allowed(tenant_id, org_unit_id))
  WITH CHECK (public.mobility_tenant_access_allowed(tenant_id, org_unit_id));

DROP POLICY IF EXISTS mobility_command_idempotency_tenant_access ON public.mobility_command_idempotency;
CREATE POLICY mobility_command_idempotency_tenant_access
  ON public.mobility_command_idempotency
  FOR ALL TO authenticated
  USING (public.mobility_tenant_access_allowed(tenant_id, org_unit_id))
  WITH CHECK (public.mobility_tenant_access_allowed(tenant_id, org_unit_id));

REVOKE ALL ON public.mobility_domain_events FROM anon;
REVOKE ALL ON public.mobility_command_idempotency FROM anon;

GRANT SELECT, INSERT ON public.mobility_domain_events TO authenticated;
GRANT SELECT, INSERT ON public.mobility_command_idempotency TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_domain_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_command_idempotency TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_tenant_access_allowed(UUID, UUID) TO authenticated, service_role;

-- Replace historical Bella Auto adapter policies that allowed NULL tenant
-- context. Mobility grants below are safe only when these adapter tables enforce
-- a trusted authenticated user tenant.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_vehicles') THEN
    EXECUTE 'ALTER TABLE public.auto_vehicles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Tenant view auto_vehicles" ON public.auto_vehicles';
    EXECUTE 'DROP POLICY IF EXISTS mobility_auto_vehicles_tenant_access ON public.auto_vehicles';
    EXECUTE 'CREATE POLICY mobility_auto_vehicles_tenant_access ON public.auto_vehicles FOR ALL TO authenticated USING (public.mobility_tenant_access_allowed(tenant_id, NULL)) WITH CHECK (public.mobility_tenant_access_allowed(tenant_id, NULL))';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_vehicle_status_logs') THEN
    EXECUTE 'ALTER TABLE public.auto_vehicle_status_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Tenant view auto_vehicle_status_logs" ON public.auto_vehicle_status_logs';
    EXECUTE 'DROP POLICY IF EXISTS mobility_auto_vehicle_status_logs_tenant_access ON public.auto_vehicle_status_logs';
    EXECUTE 'CREATE POLICY mobility_auto_vehicle_status_logs_tenant_access ON public.auto_vehicle_status_logs FOR ALL TO authenticated USING (public.mobility_tenant_access_allowed(tenant_id, NULL)) WITH CHECK (public.mobility_tenant_access_allowed(tenant_id, NULL))';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_vehicle_owners') THEN
    EXECUTE 'ALTER TABLE public.auto_vehicle_owners ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Tenant view auto_vehicle_owners" ON public.auto_vehicle_owners';
    EXECUTE 'DROP POLICY IF EXISTS mobility_auto_vehicle_owners_tenant_access ON public.auto_vehicle_owners';
    EXECUTE 'CREATE POLICY mobility_auto_vehicle_owners_tenant_access ON public.auto_vehicle_owners FOR ALL TO authenticated USING (public.mobility_tenant_access_allowed(tenant_id, NULL)) WITH CHECK (public.mobility_tenant_access_allowed(tenant_id, NULL))';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_service_history') THEN
    EXECUTE 'ALTER TABLE public.auto_service_history ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS auto_service_history_tenant_isolation ON public.auto_service_history';
    EXECUTE 'DROP POLICY IF EXISTS mobility_auto_service_history_tenant_read ON public.auto_service_history';
    EXECUTE 'CREATE POLICY mobility_auto_service_history_tenant_read ON public.auto_service_history FOR SELECT TO authenticated USING (public.mobility_tenant_access_allowed(tenant_id, NULL))';
  END IF;
END $$;

-- Minimal grants for existing auto_* adapter tables used by the Mobility public
-- contract. RLS remains the tenant boundary.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_vehicles') THEN
    GRANT SELECT, INSERT, UPDATE ON public.auto_vehicles TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_vehicle_status_logs') THEN
    GRANT SELECT, INSERT ON public.auto_vehicle_status_logs TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_vehicle_owners') THEN
    GRANT SELECT, INSERT, UPDATE ON public.auto_vehicle_owners TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_service_history') THEN
    GRANT SELECT ON public.auto_service_history TO authenticated, service_role;
  END IF;
END $$;

COMMENT ON TABLE public.mobility_domain_events IS
  'Mobility OS domain audit events for vehicle identity, ownership, lifecycle, and service-history trace.';

COMMENT ON TABLE public.mobility_command_idempotency IS
  'Mobility OS idempotency record keyed by tenant, operation, and business key.';

-- Dependency unit 6: supabase/migrations/20261014010000_create_automove_vehicle_sale_recognition_ledgers.sql
-- Git SHA-256 75f165b8f134fcf537d4bf71357ccbbc9b09421f53a0d0a92ab2c752e5297dbc
-- ============================================================================
-- AutoMove vehicle sale recognition ledgers
-- Scope: additive schema only; no service implementation, no ledger posting.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_auto_vehicle_sale_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AutoMove vehicle sale recognition ledgers are append-only.';
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_auto_vehicle_sale_recognition_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  vehicle_tenant_id UUID;
  customer_tenant_id UUID;
  actor_tenant_id UUID;
  policy_exists BOOLEAN;
  booking_row RECORD;
BEGIN
  IF to_regclass('public.policy_registry') IS NULL THEN
    RAISE EXCEPTION 'Vehicle sale recognition requires policy_registry before inserts are allowed.';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.policy_registry
     WHERE policy_id = NEW.accounting_policy_id
       AND version = NEW.accounting_policy_version
  )
    INTO policy_exists;

  IF NOT policy_exists THEN
    RAISE EXCEPTION 'Vehicle sale recognition references an unregistered accounting policy version.';
  END IF;

  SELECT tenant_id
    INTO vehicle_tenant_id
    FROM public.auto_vehicles
   WHERE id = NEW.vehicle_id;

  IF vehicle_tenant_id IS NULL OR vehicle_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Vehicle sale recognition references a vehicle outside the recognition tenant.';
  END IF;

  SELECT tenant_id
    INTO customer_tenant_id
    FROM public.customers
   WHERE id = NEW.customer_id;

  IF customer_tenant_id IS NULL OR customer_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Vehicle sale recognition references a customer outside the recognition tenant.';
  END IF;

  IF NEW.booking_id IS NOT NULL THEN
    IF to_regclass('public.auto_bookings') IS NULL THEN
      RAISE EXCEPTION 'Vehicle sale recognition booking evidence cannot be validated because auto_bookings is unavailable.';
    END IF;

    SELECT tenant_id, customer_id, vehicle_id
      INTO booking_row
      FROM public.auto_bookings
     WHERE id = NEW.booking_id;

    IF booking_row.tenant_id IS NULL OR booking_row.tenant_id <> NEW.tenant_id THEN
      RAISE EXCEPTION 'Vehicle sale recognition references a booking outside the recognition tenant.';
    END IF;

    IF booking_row.customer_id <> NEW.customer_id THEN
      RAISE EXCEPTION 'Vehicle sale recognition customer does not match the booking customer.';
    END IF;

    IF booking_row.vehicle_id IS NOT NULL AND booking_row.vehicle_id <> NEW.vehicle_id THEN
      RAISE EXCEPTION 'Vehicle sale recognition vehicle does not match the booking vehicle.';
    END IF;
  END IF;

  IF NEW.recognized_by_user_id IS NOT NULL THEN
    SELECT tenant_id
      INTO actor_tenant_id
      FROM public.users
     WHERE id = NEW.recognized_by_user_id;

    IF actor_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Vehicle sale recognition actor is outside the recognition tenant.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_auto_vehicle_sale_adjustment_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  recognition_tenant_id UUID;
  actor_tenant_id UUID;
  policy_exists BOOLEAN;
BEGIN
  IF to_regclass('public.policy_registry') IS NULL THEN
    RAISE EXCEPTION 'Vehicle sale recognition adjustment requires policy_registry before inserts are allowed.';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.policy_registry
     WHERE policy_id = NEW.accounting_policy_id
       AND version = NEW.accounting_policy_version
  )
    INTO policy_exists;

  IF NOT policy_exists THEN
    RAISE EXCEPTION 'Vehicle sale recognition adjustment references an unregistered accounting policy version.';
  END IF;

  SELECT tenant_id
    INTO recognition_tenant_id
    FROM public.auto_vehicle_sale_recognitions
   WHERE id = NEW.recognition_id;

  IF recognition_tenant_id IS NULL OR recognition_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Vehicle sale recognition adjustment references a recognition outside the adjustment tenant.';
  END IF;

  IF NEW.created_by_user_id IS NOT NULL THEN
    SELECT tenant_id
      INTO actor_tenant_id
      FROM public.users
     WHERE id = NEW.created_by_user_id;

    IF actor_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Vehicle sale recognition adjustment actor is outside the adjustment tenant.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.auto_vehicle_sale_recognitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_transaction_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  booking_id UUID,
  vehicle_id UUID NOT NULL REFERENCES public.auto_vehicles(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  recognized_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  recognized_by_user_id UUID REFERENCES public.users(id),
  recognition_basis TEXT NOT NULL,
  source_document_type TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  handover_evidence_ref TEXT,
  accounting_policy_id TEXT NOT NULL,
  accounting_policy_version TEXT NOT NULL,
  sale_price_recognized NUMERIC(18,0) NOT NULL CHECK (sale_price_recognized >= 0),
  discount_amount NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  price_adjustment_amount NUMERIC(18,0) NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL DEFAULT 'VND',
  deposit_received_total NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (deposit_received_total >= 0),
  payment_received_total NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (payment_received_total >= 0),
  receivable_amount_at_recognition NUMERIC(18,0) NOT NULL DEFAULT 0,
  cost_basis_at_sale NUMERIC(18,0) NOT NULL CHECK (cost_basis_at_sale >= 0),
  cost_basis_source_type TEXT NOT NULL,
  cost_basis_source_ref TEXT NOT NULL,
  cost_basis_components JSONB NOT NULL DEFAULT '{}'::jsonb,
  warranty_entitlement_ref TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT uq_auto_vehicle_sale_recognitions_transaction UNIQUE (tenant_id, sale_transaction_id),
  CONSTRAINT uq_auto_vehicle_sale_recognitions_idempotency UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_idempotency_key CHECK (btrim(idempotency_key) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_basis CHECK (btrim(recognition_basis) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_source_type CHECK (btrim(source_document_type) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_source_id CHECK (btrim(source_document_id) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_policy_id CHECK (btrim(accounting_policy_id) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_policy_version CHECK (accounting_policy_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_currency CHECK (currency_code = 'VND'),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_cost_source_type CHECK (btrim(cost_basis_source_type) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_cost_source_ref CHECK (btrim(cost_basis_source_ref) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_cost_components CHECK (jsonb_typeof(cost_basis_components) = 'object'),
  CONSTRAINT chk_auto_vehicle_sale_recognitions_metadata CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.auto_vehicle_sale_recognition_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recognition_id UUID NOT NULL REFERENCES public.auto_vehicle_sale_recognitions(id) ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence_ref TEXT NOT NULL,
  affected_period_ref TEXT,
  created_by_user_id UUID REFERENCES public.users(id),
  accounting_policy_id TEXT NOT NULL,
  accounting_policy_version TEXT NOT NULL,
  sale_price_delta NUMERIC(18,0) NOT NULL DEFAULT 0,
  cost_basis_delta NUMERIC(18,0) NOT NULL DEFAULT 0,
  receivable_delta NUMERIC(18,0) NOT NULL DEFAULT 0,
  refund_amount NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  currency_code TEXT NOT NULL DEFAULT 'VND',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT uq_auto_vehicle_sale_adjustments_idempotency UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT chk_auto_vehicle_sale_adjustments_type
    CHECK (adjustment_type IN (
      'sale_revenue_adjusted',
      'sale_revenue_reversed',
      'cost_basis_adjusted',
      'refund_recorded',
      'warranty_entitlement_adjusted'
    )),
  CONSTRAINT chk_auto_vehicle_sale_adjustments_idempotency_key CHECK (btrim(idempotency_key) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_adjustments_reason CHECK (btrim(reason) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_adjustments_evidence_ref CHECK (btrim(evidence_ref) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_adjustments_policy_id CHECK (btrim(accounting_policy_id) <> ''),
  CONSTRAINT chk_auto_vehicle_sale_adjustments_policy_version CHECK (accounting_policy_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'),
  CONSTRAINT chk_auto_vehicle_sale_adjustments_currency CHECK (currency_code = 'VND'),
  CONSTRAINT chk_auto_vehicle_sale_adjustments_metadata CHECK (jsonb_typeof(metadata) = 'object')
);

ALTER TABLE public.auto_vehicle_sale_recognitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_vehicle_sale_recognition_adjustments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'trg_auto_vehicle_sale_recognitions_validate_tenant'
       AND tgrelid = 'public.auto_vehicle_sale_recognitions'::regclass
  ) THEN
    CREATE TRIGGER trg_auto_vehicle_sale_recognitions_validate_tenant
      BEFORE INSERT ON public.auto_vehicle_sale_recognitions
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_auto_vehicle_sale_recognition_tenant();
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'trg_auto_vehicle_sale_recognitions_append_only'
       AND tgrelid = 'public.auto_vehicle_sale_recognitions'::regclass
  ) THEN
    CREATE TRIGGER trg_auto_vehicle_sale_recognitions_append_only
      BEFORE UPDATE OR DELETE ON public.auto_vehicle_sale_recognitions
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_auto_vehicle_sale_ledger_mutation();
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'trg_auto_vehicle_sale_adjustments_validate_tenant'
       AND tgrelid = 'public.auto_vehicle_sale_recognition_adjustments'::regclass
  ) THEN
    CREATE TRIGGER trg_auto_vehicle_sale_adjustments_validate_tenant
      BEFORE INSERT ON public.auto_vehicle_sale_recognition_adjustments
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_auto_vehicle_sale_adjustment_tenant();
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'trg_auto_vehicle_sale_adjustments_append_only'
       AND tgrelid = 'public.auto_vehicle_sale_recognition_adjustments'::regclass
  ) THEN
    CREATE TRIGGER trg_auto_vehicle_sale_adjustments_append_only
      BEFORE UPDATE OR DELETE ON public.auto_vehicle_sale_recognition_adjustments
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_auto_vehicle_sale_ledger_mutation();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'auto_vehicle_sale_recognitions'
       AND policyname = 'Tenant select auto vehicle sale recognitions'
  ) THEN
    CREATE POLICY "Tenant select auto vehicle sale recognitions"
      ON public.auto_vehicle_sale_recognitions
      FOR SELECT TO authenticated
      USING (tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'auto_vehicle_sale_recognition_adjustments'
       AND policyname = 'Tenant select auto vehicle sale adjustments'
  ) THEN
    CREATE POLICY "Tenant select auto vehicle sale adjustments"
      ON public.auto_vehicle_sale_recognition_adjustments
      FOR SELECT TO authenticated
      USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

REVOKE ALL ON TABLE public.auto_vehicle_sale_recognitions FROM PUBLIC;
REVOKE ALL ON TABLE public.auto_vehicle_sale_recognitions FROM anon;
REVOKE ALL ON TABLE public.auto_vehicle_sale_recognitions FROM authenticated;
GRANT SELECT ON TABLE public.auto_vehicle_sale_recognitions TO authenticated;
GRANT SELECT, INSERT ON TABLE public.auto_vehicle_sale_recognitions TO service_role;

REVOKE ALL ON TABLE public.auto_vehicle_sale_recognition_adjustments FROM PUBLIC;
REVOKE ALL ON TABLE public.auto_vehicle_sale_recognition_adjustments FROM anon;
REVOKE ALL ON TABLE public.auto_vehicle_sale_recognition_adjustments FROM authenticated;
GRANT SELECT ON TABLE public.auto_vehicle_sale_recognition_adjustments TO authenticated;
GRANT SELECT, INSERT ON TABLE public.auto_vehicle_sale_recognition_adjustments TO service_role;

COMMENT ON TABLE public.auto_vehicle_sale_recognitions IS
  'AutoMove append-only recognized vehicle sale revenue snapshots. Schema only; ledger posting is not authorized by this migration.';

COMMENT ON TABLE public.auto_vehicle_sale_recognition_adjustments IS
  'AutoMove append-only adjustments and reversals linked to vehicle sale recognition snapshots.';

-- Dependency unit 7: supabase/migrations/20261014020200_harden_automove_sales_chain_rls_grants.sql
-- Git SHA-256 aad8e91eb7797166c499a8c9cc0e594e9d0e95500079300d1225ab223c729244
-- ============================================================================
-- AutoMove sales-chain RLS hardening
-- Scope: auto_leads, auto_bookings, auto_deposits only.
-- Forward migration only. No historical migration rewrite.
-- ============================================================================

DO $$
DECLARE
  missing_table TEXT;
BEGIN
  SELECT table_name
    INTO missing_table
    FROM (
      VALUES
        ('auto_leads'),
        ('auto_bookings'),
        ('auto_deposits')
    ) AS required_tables(table_name)
   WHERE to_regclass('public.' || required_tables.table_name) IS NULL
   LIMIT 1;

  IF missing_table IS NOT NULL THEN
    RAISE EXCEPTION 'AutoMove sales-chain RLS hardening requires public.% to exist.', missing_table;
  END IF;
END $$;

ALTER TABLE public.auto_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant view auto_leads" ON public.auto_leads;
DROP POLICY IF EXISTS "Tenant view auto_bookings" ON public.auto_bookings;
DROP POLICY IF EXISTS "Tenant view auto_deposits" ON public.auto_deposits;

DROP POLICY IF EXISTS auto_leads_tenant_select ON public.auto_leads;
DROP POLICY IF EXISTS auto_leads_tenant_insert ON public.auto_leads;
DROP POLICY IF EXISTS auto_leads_tenant_update ON public.auto_leads;

DROP POLICY IF EXISTS auto_bookings_tenant_select ON public.auto_bookings;
DROP POLICY IF EXISTS auto_bookings_tenant_insert ON public.auto_bookings;
DROP POLICY IF EXISTS auto_bookings_tenant_update ON public.auto_bookings;

DROP POLICY IF EXISTS auto_deposits_tenant_select ON public.auto_deposits;
DROP POLICY IF EXISTS auto_deposits_tenant_insert ON public.auto_deposits;
DROP POLICY IF EXISTS auto_deposits_tenant_update ON public.auto_deposits;

CREATE POLICY auto_leads_tenant_select
  ON public.auto_leads
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY auto_leads_tenant_insert
  ON public.auto_leads
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY auto_leads_tenant_update
  ON public.auto_leads
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY auto_bookings_tenant_select
  ON public.auto_bookings
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY auto_bookings_tenant_insert
  ON public.auto_bookings
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY auto_bookings_tenant_update
  ON public.auto_bookings
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY auto_deposits_tenant_select
  ON public.auto_deposits
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY auto_deposits_tenant_insert
  ON public.auto_deposits
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY auto_deposits_tenant_update
  ON public.auto_deposits
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

REVOKE ALL ON TABLE public.auto_leads FROM PUBLIC;
REVOKE ALL ON TABLE public.auto_bookings FROM PUBLIC;
REVOKE ALL ON TABLE public.auto_deposits FROM PUBLIC;

REVOKE ALL ON TABLE public.auto_leads FROM anon;
REVOKE ALL ON TABLE public.auto_bookings FROM anon;
REVOKE ALL ON TABLE public.auto_deposits FROM anon;

REVOKE ALL ON TABLE public.auto_leads FROM authenticated;
REVOKE ALL ON TABLE public.auto_bookings FROM authenticated;
REVOKE ALL ON TABLE public.auto_deposits FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.auto_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.auto_bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.auto_deposits TO authenticated;

DO $$
DECLARE
  unsafe_policy RECORD;
  unsafe_grant RECORD;
  public_grant RECORD;
BEGIN
  SELECT tablename, policyname
    INTO unsafe_policy
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('auto_leads', 'auto_bookings', 'auto_deposits')
     AND (
       COALESCE(qual, '') ILIKE '%get_auth_tenant_id() IS NULL%'
       OR COALESCE(with_check, '') ILIKE '%get_auth_tenant_id() IS NULL%'
       OR COALESCE(qual, '') ILIKE '%IS NULL OR%'
       OR COALESCE(with_check, '') ILIKE '%IS NULL OR%'
     )
   LIMIT 1;

  IF unsafe_policy.tablename IS NOT NULL THEN
    RAISE EXCEPTION 'Unsafe AutoMove sales-chain RLS policy remains on %.%: %.',
      'public', unsafe_policy.tablename, unsafe_policy.policyname;
  END IF;

  SELECT table_name, privilege_type
    INTO unsafe_grant
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name IN ('auto_leads', 'auto_bookings', 'auto_deposits')
     AND grantee = 'authenticated'
     AND privilege_type IN ('DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
   LIMIT 1;

  IF unsafe_grant.table_name IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected authenticated % grant remains on public.%.',
      unsafe_grant.privilege_type, unsafe_grant.table_name;
  END IF;

  SELECT table_name, grantee, privilege_type
    INTO public_grant
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name IN ('auto_leads', 'auto_bookings', 'auto_deposits')
     AND grantee IN ('anon', 'PUBLIC')
   LIMIT 1;

  IF public_grant.table_name IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected % % grant remains on public.%.',
      public_grant.grantee, public_grant.privilege_type, public_grant.table_name;
  END IF;
END $$;

COMMENT ON POLICY auto_leads_tenant_select ON public.auto_leads IS
  'AutoMove sales-chain read: authenticated users may read only rows for their resolved tenant. Null-tenant fallback is intentionally forbidden.';
COMMENT ON POLICY auto_bookings_tenant_select ON public.auto_bookings IS
  'AutoMove sales-chain read: authenticated users may read only rows for their resolved tenant. Null-tenant fallback is intentionally forbidden.';
COMMENT ON POLICY auto_deposits_tenant_select ON public.auto_deposits IS
  'AutoMove sales-chain read: authenticated users may read only rows for their resolved tenant. Null-tenant fallback is intentionally forbidden.';

-- Dependency unit 8: supabase/migrations/20261015030000_guard_automove_active_identity_access.sql
-- Git SHA-256 b3f90e3a740aa8e13711a67285d1b4b040fb130f5f8a5e58e9d3a75a4fbd45ef
-- Intersect existing policies with live identity/tenant authority; do not replace helpers.
-- SELECT also constrains row selection for writes; valid active access is verified separately.
DO $$
DECLARE
  target_name TEXT;
  target_oid OID;
  command_code "char";
BEGIN
  IF to_regclass('public.users') IS NULL OR to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Active identity guards require canonical public.users and public.tenants.';
  END IF;
  FOREACH target_name IN ARRAY ARRAY['auto_vehicles', 'auto_leads', 'auto_bookings', 'auto_deposits']
  LOOP
    target_oid := to_regclass('public.' || target_name);
    IF target_oid IS NULL THEN
      RAISE EXCEPTION 'Active identity guards require public.%.', target_name;
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = target_oid) THEN
      RAISE EXCEPTION 'Active identity guards require existing RLS on public.%.', target_name;
    END IF;
    FOREACH command_code IN ARRAY ARRAY['r'::"char", 'w'::"char"]
    LOOP
      IF target_name = 'auto_vehicles' AND command_code = 'w' THEN CONTINUE; END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_policy p
        WHERE p.polrelid = target_oid AND p.polpermissive AND p.polcmd IN (command_code, '*')
          AND (0::oid = ANY(p.polroles) OR 'authenticated'::regrole::oid = ANY(p.polroles))
      ) THEN
        RAISE EXCEPTION 'Active identity guards require an existing permissive % policy on public.%.', command_code, target_name;
      END IF;
    END LOOP;
  END LOOP;
END $$;

DROP POLICY IF EXISTS auto_vehicles_active_identity_select_guard ON public.auto_vehicles;
CREATE POLICY auto_vehicles_active_identity_select_guard ON public.auto_vehicles
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_vehicles.tenant_id AND t.status = 'active'
  ));

DROP POLICY IF EXISTS auto_leads_active_identity_select_guard ON public.auto_leads;
CREATE POLICY auto_leads_active_identity_select_guard ON public.auto_leads
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_leads.tenant_id AND t.status = 'active'
  ));

DROP POLICY IF EXISTS auto_bookings_active_identity_select_guard ON public.auto_bookings;
CREATE POLICY auto_bookings_active_identity_select_guard ON public.auto_bookings
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_bookings.tenant_id AND t.status = 'active'
  ));

DROP POLICY IF EXISTS auto_deposits_active_identity_select_guard ON public.auto_deposits;
CREATE POLICY auto_deposits_active_identity_select_guard ON public.auto_deposits
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_deposits.tenant_id AND t.status = 'active'
  ));

DROP POLICY IF EXISTS auto_leads_active_identity_update_guard ON public.auto_leads;
CREATE POLICY auto_leads_active_identity_update_guard ON public.auto_leads
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_leads.tenant_id AND t.status = 'active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_leads.tenant_id AND t.status = 'active'
  ));

DROP POLICY IF EXISTS auto_bookings_active_identity_update_guard ON public.auto_bookings;
CREATE POLICY auto_bookings_active_identity_update_guard ON public.auto_bookings
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_bookings.tenant_id AND t.status = 'active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_bookings.tenant_id AND t.status = 'active'
  ));

DROP POLICY IF EXISTS auto_deposits_active_identity_update_guard ON public.auto_deposits;
CREATE POLICY auto_deposits_active_identity_update_guard ON public.auto_deposits
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_deposits.tenant_id AND t.status = 'active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_deposits.tenant_id AND t.status = 'active'
  ));

-- Dependency unit 9: supabase/migrations/20261014030000_create_automove_approved_financial_snapshots.sql
-- Git SHA-256 4afd86afa61e33f73e53ff955ae5689c8f2719a98a8281b9c657bfb35c3942f7
-- AutoMove financial source snapshots. Approval is a separate server action.
CREATE TABLE IF NOT EXISTS public.auto_vehicle_sale_financial_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  sale_transaction_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (btrim(idempotency_key) <> ''),
  booking_id UUID NOT NULL REFERENCES public.auto_bookings(id),
  vehicle_id UUID NOT NULL REFERENCES public.auto_vehicles(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  sale_price NUMERIC(18,0) NOT NULL CHECK (sale_price > 0),
  discount_amount NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  cost_basis NUMERIC(18,0) NOT NULL CHECK (cost_basis >= 0),
  sale_document JSONB NOT NULL,
  cost_document JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  CONSTRAINT automove_snapshot_discount CHECK (discount_amount < sale_price),
  CONSTRAINT automove_snapshot_approval CHECK (
    (status = 'draft' AND approved_by IS NULL AND approved_at IS NULL) OR
    (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
  ),
  CONSTRAINT automove_snapshot_transaction UNIQUE (tenant_id, sale_transaction_id),
  CONSTRAINT automove_snapshot_idempotency UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT automove_snapshot_booking_vehicle UNIQUE (tenant_id, booking_id, vehicle_id),
  CONSTRAINT automove_snapshot_sale_document CHECK (
    jsonb_typeof(sale_document) = 'object' AND
    coalesce(sale_document->>'bucket', '') <> '' AND
    coalesce(sale_document->>'path', '') <> '' AND
    coalesce(sale_document->>'sha256', '') ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT automove_snapshot_cost_document CHECK (
    jsonb_typeof(cost_document) = 'object' AND
    coalesce(cost_document->>'bucket', '') <> '' AND
    coalesce(cost_document->>'path', '') <> '' AND
    coalesce(cost_document->>'sha256', '') ~ '^[a-f0-9]{64}$'
  )
);

CREATE OR REPLACE FUNCTION public.guard_automove_financial_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  actor_row RECORD;
  booking_row RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Financial source snapshots cannot be deleted.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'draft' OR NEW.status <> 'approved' OR
       (to_jsonb(NEW) - ARRAY['status','approved_by','approved_at']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status','approved_by','approved_at']) THEN
      RAISE EXCEPTION 'Only draft approval is allowed; financial snapshots are immutable.';
    END IF;
    IF current_setting('role', true) <> 'service_role' THEN
      RAISE EXCEPTION 'Snapshot approval requires the server action.';
    END IF;
    IF NEW.approved_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Approval actor must match authenticated identity.';
    END IF;
    SELECT tenant_id, role, status INTO actor_row FROM public.users WHERE id = NEW.approved_by;
  ELSE
    IF NEW.status <> 'draft' OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN
      RAISE EXCEPTION 'New snapshots must be unapproved drafts.';
    END IF;
    IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Snapshot creator must match authenticated identity.';
    END IF;
    SELECT tenant_id, role, status INTO actor_row FROM public.users WHERE id = NEW.created_by;
  END IF;
  IF actor_row.tenant_id IS DISTINCT FROM NEW.tenant_id OR
     actor_row.status IS DISTINCT FROM 'active' OR
     actor_row.role IS NULL OR actor_row.role NOT IN ('accountant','finance_manager') THEN
    RAISE EXCEPTION 'An active tenant accountant or finance manager is required.';
  END IF;
  SELECT tenant_id, customer_id, vehicle_id, status, payment_status INTO booking_row
    FROM public.auto_bookings WHERE id = NEW.booking_id;
  IF booking_row.tenant_id IS DISTINCT FROM NEW.tenant_id OR
     booking_row.customer_id IS DISTINCT FROM NEW.customer_id OR
     booking_row.vehicle_id IS DISTINCT FROM NEW.vehicle_id OR
     booking_row.status = 'cancelled' OR booking_row.payment_status = 'refunded' OR
     NOT EXISTS (SELECT 1 FROM public.auto_vehicles WHERE id = NEW.vehicle_id AND tenant_id = NEW.tenant_id) OR
     NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'Snapshot business references are invalid.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_automove_financial_snapshot ON public.auto_vehicle_sale_financial_snapshots;
CREATE TRIGGER guard_automove_financial_snapshot BEFORE INSERT OR UPDATE OR DELETE
ON public.auto_vehicle_sale_financial_snapshots FOR EACH ROW
EXECUTE FUNCTION public.guard_automove_financial_snapshot();

ALTER TABLE public.auto_vehicle_sale_financial_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auto_vehicle_sale_financial_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.auto_vehicle_sale_financial_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.auto_vehicle_sale_financial_snapshots TO service_role;
CREATE POLICY automove_snapshot_read ON public.auto_vehicle_sale_financial_snapshots
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
    AND u.tenant_id = auto_vehicle_sale_financial_snapshots.tenant_id
    AND u.status = 'active' AND u.role IN ('accountant','finance_manager'))
);
CREATE POLICY automove_snapshot_draft ON public.auto_vehicle_sale_financial_snapshots
FOR INSERT TO authenticated WITH CHECK (
  status = 'draft' AND approved_by IS NULL AND approved_at IS NULL AND created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
    AND u.tenant_id = auto_vehicle_sale_financial_snapshots.tenant_id
    AND u.status = 'active' AND u.role IN ('accountant','finance_manager'))
);

REVOKE ALL ON FUNCTION public.guard_automove_financial_snapshot() FROM PUBLIC, anon, authenticated;

-- Reuse Platform Storage for the source documents; content is write-once.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('automove-sale-documents', 'automove-sale-documents', false, 20971520,
  ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY automove_sale_document_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'automove-sale-documents' AND EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status = 'active'
    AND u.role IN ('accountant','finance_manager') AND u.tenant_id::text = (storage.foldername(name))[1]
));
CREATE POLICY automove_sale_document_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'automove-sale-documents' AND EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status = 'active'
    AND u.role IN ('accountant','finance_manager') AND u.tenant_id::text = (storage.foldername(name))[1]
));

-- Dependency unit 10: supabase/migrations/20261014030100_restrict_automove_snapshot_accountant_authority.sql
-- Git SHA-256 0a0ba76957fb7aa0da35ffbdcdd7cacc9f875f614fb6f6a3f6020aba57f76696
-- Owner-approved accountant-only authority; preserve the applied snapshot migration.
CREATE OR REPLACE FUNCTION public.guard_automove_financial_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  actor_row RECORD;
  booking_row RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Financial source snapshots cannot be deleted.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'draft' OR NEW.status <> 'approved' OR
       (to_jsonb(NEW) - ARRAY['status','approved_by','approved_at']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status','approved_by','approved_at']) THEN
      RAISE EXCEPTION 'Only draft approval is allowed; financial snapshots are immutable.';
    END IF;
    IF current_setting('role', true) <> 'service_role' THEN
      RAISE EXCEPTION 'Snapshot approval requires the server action.';
    END IF;
    IF NEW.approved_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Approval actor must match authenticated identity.';
    END IF;
    SELECT tenant_id, role, status INTO actor_row FROM public.users WHERE id = NEW.approved_by;
  ELSE
    IF NEW.status <> 'draft' OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN
      RAISE EXCEPTION 'New snapshots must be unapproved drafts.';
    END IF;
    IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Snapshot creator must match authenticated identity.';
    END IF;
    SELECT tenant_id, role, status INTO actor_row FROM public.users WHERE id = NEW.created_by;
  END IF;
  IF actor_row.tenant_id IS DISTINCT FROM NEW.tenant_id OR
     actor_row.status IS DISTINCT FROM 'active' OR
     actor_row.role IS DISTINCT FROM 'accountant' THEN
    RAISE EXCEPTION 'An active tenant accountant is required.';
  END IF;
  SELECT tenant_id, customer_id, vehicle_id, status, payment_status INTO booking_row
    FROM public.auto_bookings WHERE id = NEW.booking_id;
  IF booking_row.tenant_id IS DISTINCT FROM NEW.tenant_id OR
     booking_row.customer_id IS DISTINCT FROM NEW.customer_id OR
     booking_row.vehicle_id IS DISTINCT FROM NEW.vehicle_id OR
     booking_row.status = 'cancelled' OR booking_row.payment_status = 'refunded' OR
     NOT EXISTS (SELECT 1 FROM public.auto_vehicles WHERE id = NEW.vehicle_id AND tenant_id = NEW.tenant_id) OR
     NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'Snapshot business references are invalid.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_automove_financial_snapshot() FROM PUBLIC, anon, authenticated;

ALTER POLICY automove_snapshot_read ON public.auto_vehicle_sale_financial_snapshots
USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
    AND u.tenant_id = auto_vehicle_sale_financial_snapshots.tenant_id
    AND u.status = 'active' AND u.role = 'accountant')
);
ALTER POLICY automove_snapshot_draft ON public.auto_vehicle_sale_financial_snapshots
WITH CHECK (
  status = 'draft' AND approved_by IS NULL AND approved_at IS NULL AND created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
    AND u.tenant_id = auto_vehicle_sale_financial_snapshots.tenant_id
    AND u.status = 'active' AND u.role = 'accountant')
);
ALTER POLICY automove_sale_document_read ON storage.objects
USING (bucket_id = 'automove-sale-documents' AND EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status = 'active'
    AND u.role = 'accountant' AND u.tenant_id::text = (storage.foldername(name))[1]
));
ALTER POLICY automove_sale_document_upload ON storage.objects
WITH CHECK (bucket_id = 'automove-sale-documents' AND EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status = 'active'
    AND u.role = 'accountant' AND u.tenant_id::text = (storage.foldername(name))[1]
));

-- Dependency unit 11: supabase/migrations/20261014030200_allow_automove_server_draft_correction.sql
-- Git SHA-256 203bca7a093c55e3bda0b827803b0ca15e0320b14fcf22282da5aa491dc30776
-- Separate server-only draft correction; approved financial evidence stays immutable.
CREATE OR REPLACE FUNCTION public.guard_automove_financial_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  actor_row RECORD;
  booking_row RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Financial source snapshots cannot be deleted.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Approved financial snapshots are immutable.';
    END IF;
    IF current_setting('role', true) <> 'service_role' THEN
      RAISE EXCEPTION 'Snapshot changes require the server action.';
    END IF;
    IF NEW.status = 'draft' THEN
      IF (to_jsonb(NEW) - ARRAY['sale_price','discount_amount','cost_basis','sale_document','cost_document']) IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['sale_price','discount_amount','cost_basis','sale_document','cost_document']) THEN
        RAISE EXCEPTION 'Draft correction can change only financial values and source documents.';
      END IF;
    ELSIF NEW.status = 'approved' THEN
      IF (to_jsonb(NEW) - ARRAY['status','approved_by','approved_at']) IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['status','approved_by','approved_at']) THEN
        RAISE EXCEPTION 'Approval cannot change financial values or source documents.';
      END IF;
      IF NEW.approved_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Approval actor must match authenticated identity.';
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid financial snapshot state transition.';
    END IF;
    SELECT tenant_id, role, status INTO actor_row FROM public.users WHERE id = auth.uid();
  ELSE
    IF NEW.status <> 'draft' OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN
      RAISE EXCEPTION 'New snapshots must be unapproved drafts.';
    END IF;
    IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Snapshot creator must match authenticated identity.';
    END IF;
    SELECT tenant_id, role, status INTO actor_row FROM public.users WHERE id = NEW.created_by;
  END IF;
  IF actor_row.tenant_id IS DISTINCT FROM NEW.tenant_id OR
     actor_row.status IS DISTINCT FROM 'active' OR actor_row.role IS DISTINCT FROM 'accountant' THEN
    RAISE EXCEPTION 'An active tenant accountant is required.';
  END IF;
  SELECT tenant_id, customer_id, vehicle_id, status, payment_status INTO booking_row
    FROM public.auto_bookings WHERE id = NEW.booking_id;
  IF booking_row.tenant_id IS DISTINCT FROM NEW.tenant_id OR
     booking_row.customer_id IS DISTINCT FROM NEW.customer_id OR
     booking_row.vehicle_id IS DISTINCT FROM NEW.vehicle_id OR
     booking_row.status = 'cancelled' OR booking_row.payment_status = 'refunded' OR
     NOT EXISTS (SELECT 1 FROM public.auto_vehicles WHERE id = NEW.vehicle_id AND tenant_id = NEW.tenant_id) OR
     NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'Snapshot business references are invalid.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_automove_financial_snapshot() FROM PUBLIC, anon, authenticated;

-- Dependency unit 12: supabase/migrations/20261015020000_create_automove_post_sale_receipts.sql
-- Git SHA-256 419db046db933dfcba7f196dce2b36d1c6a64643ac5e4e808a49a23c2dbac24c
-- Operational receipt facts only. No Finance posting or historical mutation.
CREATE TABLE public.auto_vehicle_sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  booking_id UUID NOT NULL REFERENCES public.auto_bookings(id),
  recognition_id UUID NOT NULL REFERENCES public.auto_vehicle_sale_recognitions(id),
  idempotency_key UUID NOT NULL,
  amount NUMERIC(18,0) NOT NULL CHECK (amount > 0 AND amount <= 9007199254740991),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','bank_transfer','card')),
  transaction_ref TEXT CHECK (transaction_ref IS NULL OR
    (transaction_ref = btrim(transaction_ref) AND length(transaction_ref) BETWEEN 1 AND 200)),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 1000),
  received_by UUID NOT NULL REFERENCES public.users(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT automove_sale_payment_key UNIQUE (tenant_id,idempotency_key),
  CONSTRAINT automove_sale_payment_reference_required CHECK (
    payment_method = 'cash' OR transaction_ref IS NOT NULL)
);
-- zero-downtime: allow blocking-index - Indexes target only the new empty receipt table.
CREATE INDEX automove_sale_payment_booking ON public.auto_vehicle_sale_payments(tenant_id,booking_id,received_at,id);
-- zero-downtime: allow blocking-index - Unique reference index targets the same new empty table.
CREATE UNIQUE INDEX automove_sale_payment_reference ON public.auto_vehicle_sale_payments(tenant_id,payment_method,transaction_ref)
  WHERE transaction_ref IS NOT NULL;

CREATE FUNCTION public.guard_automove_post_sale_receipt()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  booking_row RECORD;
  recognition_row RECORD;
  deposit_total NUMERIC;
  payment_total NUMERIC;
  price_delta NUMERIC;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'AutoMove sale receipts are append-only.';
  END IF;
  IF NEW.received_by IS DISTINCT FROM auth.uid() OR NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=auth.uid() AND u.status='active' AND u.role='accountant'
      AND u.tenant_id=NEW.tenant_id AND t.status='active'
  ) THEN
    RAISE EXCEPTION 'An active tenant accountant must record the receipt.';
  END IF;
  SELECT * INTO booking_row FROM public.auto_bookings
    WHERE id=NEW.booking_id AND tenant_id=NEW.tenant_id FOR UPDATE;
  IF booking_row.id IS NULL OR booking_row.status='cancelled' OR booking_row.payment_status='refunded' THEN
    RAISE EXCEPTION 'Booking is unavailable for collection.';
  END IF;
  SELECT * INTO recognition_row FROM public.auto_vehicle_sale_recognitions
    WHERE id=NEW.recognition_id AND tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id;
  IF recognition_row.id IS NULL OR recognition_row.customer_id IS DISTINCT FROM booking_row.customer_id OR
     recognition_row.vehicle_id IS DISTINCT FROM booking_row.vehicle_id OR
     (SELECT count(*) FROM public.auto_vehicle_sale_recognitions WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id) <> 1 THEN
    RAISE EXCEPTION 'Receipt must reference the canonical sale for this booking.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.auto_vehicle_sale_recognition_adjustments
    WHERE tenant_id=NEW.tenant_id AND recognition_id=NEW.recognition_id
      AND (refund_amount<>0 OR receivable_delta<>sale_price_delta OR adjustment_type IN ('refund_recorded','sale_revenue_reversed'))) THEN
    RAISE EXCEPTION 'Settlement requires resolution of refund/reversal adjustments.';
  END IF;
  SELECT coalesce(sum(amount),0) INTO deposit_total FROM public.auto_deposits
    WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id AND status='confirmed';
  IF deposit_total IS DISTINCT FROM booking_row.deposit_paid OR
     recognition_row.payment_received_total <> recognition_row.deposit_received_total OR
     recognition_row.receivable_amount_at_recognition <> recognition_row.sale_price_recognized-recognition_row.payment_received_total OR
     deposit_total < recognition_row.deposit_received_total THEN
    RAISE EXCEPTION 'Receipt/deposit reconciliation mismatch.';
  END IF;
  SELECT coalesce(sum(sale_price_delta),0) INTO price_delta FROM public.auto_vehicle_sale_recognition_adjustments
    WHERE tenant_id=NEW.tenant_id AND recognition_id=NEW.recognition_id;
  SELECT coalesce(sum(amount),0) INTO payment_total FROM public.auto_vehicle_sale_payments
    WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id;
  IF deposit_total+payment_total+NEW.amount > recognition_row.sale_price_recognized+price_delta THEN
    RAISE EXCEPTION 'Receipt exceeds the remaining recognized sale amount.';
  END IF;
  NEW.received_at := statement_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_automove_post_sale_receipt BEFORE INSERT OR UPDATE OR DELETE
  ON public.auto_vehicle_sale_payments FOR EACH ROW EXECUTE FUNCTION public.guard_automove_post_sale_receipt();
REVOKE ALL ON FUNCTION public.guard_automove_post_sale_receipt() FROM PUBLIC,anon,authenticated;

ALTER TABLE public.auto_vehicle_sale_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auto_vehicle_sale_payments FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.auto_vehicle_sale_payments TO authenticated,service_role;
CREATE POLICY automove_sale_payment_read ON public.auto_vehicle_sale_payments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=auth.uid() AND u.status='active' AND u.role='accountant' AND t.status='active'
      AND u.tenant_id=auto_vehicle_sale_payments.tenant_id)
);
CREATE POLICY automove_sale_payment_insert ON public.auto_vehicle_sale_payments FOR INSERT TO authenticated WITH CHECK (
  received_by=auth.uid() AND EXISTS (SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=auth.uid() AND u.status='active' AND u.role='accountant' AND t.status='active'
      AND u.tenant_id=auto_vehicle_sale_payments.tenant_id)
);
COMMENT ON TABLE public.auto_vehicle_sale_payments IS
  'Append-only AutoMove post-sale collection receipts; not Finance postings or revenue recognition.';

-- Dependency unit 13: supabase/migrations/20261015020100_guard_automove_combined_collection_cap.sql
-- Git SHA-256 87e55490677965eda8a6031eed8b5191b2827469c5c128e69b80f19b0e73e460
-- Protect the same balance when collection enters through the existing deposit API.
-- No receipt mutation, additional write grants, or refund policy is introduced.
CREATE FUNCTION public.guard_automove_deposit_collection_cap()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  recognized_total NUMERIC;
  post_sale_total NUMERIC;
  confirmed_total NUMERIC;
  recognized_count INTEGER;
  previous_id UUID;
BEGIN
  IF NEW.status <> 'confirmed' THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.auto_bookings
    WHERE id=NEW.booking_id AND tenant_id=NEW.tenant_id FOR UPDATE;
  SELECT coalesce(sum(amount),0) INTO post_sale_total
    FROM public.auto_vehicle_sale_payments
    WHERE booking_id=NEW.booking_id AND tenant_id=NEW.tenant_id;
  -- Before the first post-sale receipt, retain the established deposit contract.
  IF post_sale_total = 0 THEN RETURN NEW; END IF;
  SELECT count(*),sum(r.sale_price_recognized + coalesce((
    SELECT sum(a.sale_price_delta) FROM public.auto_vehicle_sale_recognition_adjustments a
      WHERE a.recognition_id=r.id AND a.tenant_id=r.tenant_id
  ),0)) INTO recognized_count,recognized_total
    FROM public.auto_vehicle_sale_recognitions r
    WHERE r.booking_id=NEW.booking_id AND r.tenant_id=NEW.tenant_id;
  IF TG_OP = 'UPDATE' THEN previous_id := OLD.id; END IF;
  SELECT coalesce(sum(amount),0) INTO confirmed_total FROM public.auto_deposits
    WHERE booking_id=NEW.booking_id AND tenant_id=NEW.tenant_id AND status='confirmed'
      AND id IS DISTINCT FROM previous_id;
  IF recognized_count <> 1 OR recognized_total IS NULL OR
     confirmed_total + post_sale_total + NEW.amount > recognized_total THEN
    RAISE EXCEPTION 'Combined collections exceed the canonical recognized sale balance.'
      USING ERRCODE='23514', CONSTRAINT='automove_combined_collection_cap';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_automove_deposit_collection_cap() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_automove_deposit_collection_cap
  BEFORE INSERT OR UPDATE OF amount,status,booking_id,tenant_id ON public.auto_deposits
  FOR EACH ROW EXECUTE FUNCTION public.guard_automove_deposit_collection_cap();

-- Dependency unit 14: supabase/migrations/20261015050000_authorize_automove_customer_profile_management.sql
-- Git SHA-256 fa3c1d08104435250d7f815f79e4b160f3a400622323a6d2a9fd833dcde8a296
-- Existing AutoMove preference storage lacks authenticated access.
-- Only customer-owned preference rows are writable; no new table/helper.
DO $$ BEGIN
  IF to_regclass('public.auto_customer_profiles') IS NULL THEN
    RAISE EXCEPTION 'Canonical AutoMove customer profiles must already exist';
  END IF;
END $$;

DROP POLICY IF EXISTS "Tenant view auto_customer_profiles" ON public.auto_customer_profiles;
CREATE POLICY automove_customer_profile_tenant_access ON public.auto_customer_profiles
  FOR ALL TO authenticated
  USING (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (SELECT 1 FROM public.customers c
      WHERE c.id = customer_id AND c.tenant_id = auto_customer_profiles.tenant_id)
  )
  WITH CHECK (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (SELECT 1 FROM public.customers c
      WHERE c.id = customer_id AND c.tenant_id = auto_customer_profiles.tenant_id)
  );

GRANT SELECT, INSERT, UPDATE ON public.auto_customer_profiles TO authenticated;

-- Dependency unit 15: supabase/migrations/20261015050100_limit_automove_profile_preference_columns.sql
-- Git SHA-256 41fcd3eb3a899b37413b1db2da86434ee650aa2c78c9ed896ec89f81f8800ea2
-- Preserve applied migration history; narrow the new management write surface.
REVOKE INSERT, UPDATE ON public.auto_customer_profiles FROM authenticated;
GRANT INSERT (tenant_id,customer_id,preferred_brands,preferred_segments,budget_range,purchasing_purpose,updated_at)
  ON public.auto_customer_profiles TO authenticated;
-- PostgREST upsert includes the unchanged conflict keys in its UPDATE target.
-- RLS independently enforces both keys' tenant/customer binding.
GRANT UPDATE (tenant_id,customer_id,preferred_brands,preferred_segments,budget_range,purchasing_purpose,updated_at)
  ON public.auto_customer_profiles TO authenticated;

-- Dependency unit 16: supabase/migrations/20261015060000_record_automove_refunds_and_cancellations.sql
-- Git SHA-256 7b5881798a24fae53a1eb9758c8709832d3fdb760d64fba64e9b81c6c0c4d231
-- Cash refunds and operational cancellation only: no revenue or journal posting.
CREATE TABLE public.auto_vehicle_sale_settlement_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  booking_id UUID NOT NULL REFERENCES public.auto_bookings(id),
  idempotency_key UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('refund','cancel')),
  source_deposit_id UUID REFERENCES public.auto_deposits(id),
  source_payment_id UUID REFERENCES public.auto_vehicle_sale_payments(id),
  amount NUMERIC(18,0) NOT NULL CHECK (amount >= 0 AND amount <= 9007199254740991),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  source_document JSONB NOT NULL CHECK (jsonb_typeof(source_document) = 'object'),
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT automove_settlement_key UNIQUE(tenant_id,idempotency_key),
  CONSTRAINT automove_settlement_source CHECK (
    (action_type='cancel' AND amount=0 AND source_deposit_id IS NULL AND source_payment_id IS NULL) OR
    (action_type='refund' AND amount>0 AND num_nonnulls(source_deposit_id,source_payment_id)=1)
  )
);
-- zero-downtime: allow blocking-index - The new action table is empty.
CREATE INDEX automove_settlement_booking ON public.auto_vehicle_sale_settlement_actions(tenant_id,booking_id,created_at,id);
-- zero-downtime: allow blocking-index - One cancellation fact per booking in the new table.
CREATE UNIQUE INDEX automove_settlement_cancel ON public.auto_vehicle_sale_settlement_actions(tenant_id,booking_id)
  WHERE action_type='cancel';

CREATE FUNCTION public.guard_automove_settlement_action()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  original_amount NUMERIC;
  returned_amount NUMERIC;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Settlement actions are append-only.'; END IF;
  IF NEW.created_by IS DISTINCT FROM auth.uid() OR NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=auth.uid() AND u.role='accountant' AND u.status='active'
      AND u.tenant_id=NEW.tenant_id AND t.status='active'
  ) THEN RAISE EXCEPTION 'An active tenant accountant is required.'; END IF;
  PERFORM id FROM public.auto_bookings WHERE id=NEW.booking_id AND tenant_id=NEW.tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Settlement booking is outside the actor tenant.'; END IF;
  IF NEW.source_document->>'bucket' IS DISTINCT FROM 'automove-sale-documents' OR
    split_part(NEW.source_document->>'path','/',1) IS DISTINCT FROM NEW.tenant_id::text OR
    coalesce(NEW.source_document->>'sha256','') !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Tenant source document and checksum are required.';
  END IF;
  IF NEW.action_type='refund' THEN
    IF NEW.source_deposit_id IS NOT NULL THEN
      SELECT amount INTO original_amount FROM public.auto_deposits
        WHERE id=NEW.source_deposit_id AND booking_id=NEW.booking_id AND tenant_id=NEW.tenant_id AND status='confirmed';
    ELSE
      SELECT amount INTO original_amount FROM public.auto_vehicle_sale_payments
        WHERE id=NEW.source_payment_id AND booking_id=NEW.booking_id AND tenant_id=NEW.tenant_id;
    END IF;
    IF original_amount IS NULL THEN RAISE EXCEPTION 'Confirmed original receipt is required.'; END IF;
    SELECT coalesce(sum(amount),0) INTO returned_amount FROM public.auto_vehicle_sale_settlement_actions
      WHERE tenant_id=NEW.tenant_id AND action_type='refund' AND
        (source_deposit_id=NEW.source_deposit_id OR source_payment_id=NEW.source_payment_id);
    IF returned_amount+NEW.amount > original_amount THEN RAISE EXCEPTION 'Refund exceeds the unrefunded original receipt.'; END IF;
  END IF;
  NEW.created_at := statement_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_automove_settlement_action BEFORE INSERT OR UPDATE OR DELETE
  ON public.auto_vehicle_sale_settlement_actions FOR EACH ROW EXECUTE FUNCTION public.guard_automove_settlement_action();
REVOKE ALL ON FUNCTION public.guard_automove_settlement_action() FROM PUBLIC,anon,authenticated;
ALTER TABLE public.auto_vehicle_sale_settlement_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auto_vehicle_sale_settlement_actions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.auto_vehicle_sale_settlement_actions TO authenticated;
GRANT SELECT,INSERT ON public.auto_vehicle_sale_settlement_actions TO service_role;
CREATE POLICY automove_settlement_read ON public.auto_vehicle_sale_settlement_actions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=auth.uid() AND u.status='active' AND u.role='accountant' AND t.status='active'
      AND u.tenant_id=auto_vehicle_sale_settlement_actions.tenant_id)
);
COMMENT ON TABLE public.auto_vehicle_sale_settlement_actions IS
  'Immutable receipt-linked manual refund and independent cancellation facts; not revenue adjustments or Finance postings.';

-- Forward-align the existing receipt cap with net cash; preserve every prior guard.
CREATE OR REPLACE FUNCTION public.guard_automove_post_sale_receipt()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  booking_row RECORD;
  recognition_row RECORD;
  deposit_total NUMERIC;
  payment_total NUMERIC;
  refund_total NUMERIC;
  price_delta NUMERIC;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'AutoMove sale receipts are append-only.'; END IF;
  IF NEW.received_by IS DISTINCT FROM auth.uid() OR NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=auth.uid() AND u.status='active' AND u.role='accountant'
      AND u.tenant_id=NEW.tenant_id AND t.status='active'
  ) THEN RAISE EXCEPTION 'An active tenant accountant must record the receipt.'; END IF;
  SELECT * INTO booking_row FROM public.auto_bookings WHERE id=NEW.booking_id AND tenant_id=NEW.tenant_id FOR UPDATE;
  IF booking_row.id IS NULL OR booking_row.status='cancelled' OR booking_row.payment_status='refunded' THEN
    RAISE EXCEPTION 'Booking is unavailable for collection.';
  END IF;
  SELECT * INTO recognition_row FROM public.auto_vehicle_sale_recognitions
    WHERE id=NEW.recognition_id AND tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id;
  IF recognition_row.id IS NULL OR recognition_row.customer_id IS DISTINCT FROM booking_row.customer_id OR
     recognition_row.vehicle_id IS DISTINCT FROM booking_row.vehicle_id OR
     (SELECT count(*) FROM public.auto_vehicle_sale_recognitions WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id) <> 1 THEN
    RAISE EXCEPTION 'Receipt must reference the canonical sale for this booking.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.auto_vehicle_sale_recognition_adjustments
    WHERE tenant_id=NEW.tenant_id AND recognition_id=NEW.recognition_id AND
      (refund_amount<>0 OR receivable_delta<>sale_price_delta OR adjustment_type IN ('refund_recorded','sale_revenue_reversed'))) THEN
    RAISE EXCEPTION 'Settlement requires resolution of refund/reversal adjustments.';
  END IF;
  SELECT coalesce(sum(amount),0) INTO deposit_total FROM public.auto_deposits
    WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id AND status='confirmed';
  IF deposit_total IS DISTINCT FROM booking_row.deposit_paid OR
     recognition_row.payment_received_total <> recognition_row.deposit_received_total OR
     recognition_row.receivable_amount_at_recognition <> recognition_row.sale_price_recognized-recognition_row.payment_received_total OR
     deposit_total < recognition_row.deposit_received_total THEN
    RAISE EXCEPTION 'Receipt/deposit reconciliation mismatch.';
  END IF;
  SELECT coalesce(sum(sale_price_delta),0) INTO price_delta FROM public.auto_vehicle_sale_recognition_adjustments
    WHERE tenant_id=NEW.tenant_id AND recognition_id=NEW.recognition_id;
  SELECT coalesce(sum(amount),0) INTO payment_total FROM public.auto_vehicle_sale_payments
    WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id;
  SELECT coalesce(sum(amount),0) INTO refund_total FROM public.auto_vehicle_sale_settlement_actions
    WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id AND action_type='refund';
  IF deposit_total+payment_total-refund_total+NEW.amount > recognition_row.sale_price_recognized+price_delta THEN
    RAISE EXCEPTION 'Receipt exceeds the remaining recognized sale amount.';
  END IF;
  NEW.received_at := statement_timestamp();
  RETURN NEW;
END;
$$;

-- Production-specific effective ACL closure; separately visible in this package.
-- Review-only Production delta: close inherited/default ACLs on the exact
-- adapter/control surfaces already used by the selected source contracts.
-- No owner, role membership, shared default privilege or Storage grant changes.
DO $adoption_acl$
DECLARE
  target_name text;
  column_name text;
  contract record;
BEGIN
  FOREACH target_name IN ARRAY ARRAY[
    'auto_brands','auto_models','auto_variants','auto_leads','auto_bookings','auto_deposits',
    'auto_customer_profiles','auto_vehicles','auto_vehicle_status_logs','auto_vehicle_owners',
    'auto_service_history','policy_registry','mobility_domain_events','mobility_command_idempotency',
    'auto_vehicle_sale_recognitions','auto_vehicle_sale_recognition_adjustments',
    'auto_vehicle_sale_financial_snapshots','auto_vehicle_sale_payments','auto_vehicle_sale_settlement_actions'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',target_name);
    FOR column_name IN SELECT attname FROM pg_attribute
      WHERE attrelid=to_regclass('public.'||target_name) AND attnum>0 AND NOT attisdropped
    LOOP
      EXECUTE format('REVOKE SELECT (%I),INSERT (%I),UPDATE (%I),REFERENCES (%I) ON public.%I FROM PUBLIC,anon,authenticated',
        column_name,column_name,column_name,column_name,target_name);
    END LOOP;
  END LOOP;

  FOR contract IN SELECT * FROM (VALUES
    ('auto_brands','SELECT'),('auto_models','SELECT'),('auto_variants','SELECT'),
    ('auto_leads','SELECT,INSERT,UPDATE'),('auto_bookings','SELECT,INSERT,UPDATE'),
    ('auto_deposits','SELECT,INSERT,UPDATE'),('auto_vehicles','SELECT,INSERT,UPDATE'),
    ('auto_vehicle_status_logs','SELECT,INSERT'),('auto_vehicle_owners','SELECT,INSERT,UPDATE'),
    ('auto_service_history','SELECT'),('auto_customer_profiles','SELECT'),('policy_registry','SELECT'),
    ('mobility_domain_events','SELECT,INSERT'),('mobility_command_idempotency','SELECT,INSERT'),
    ('auto_vehicle_sale_recognitions','SELECT'),('auto_vehicle_sale_recognition_adjustments','SELECT'),
    ('auto_vehicle_sale_financial_snapshots','SELECT,INSERT'),('auto_vehicle_sale_payments','SELECT,INSERT'),
    ('auto_vehicle_sale_settlement_actions','SELECT')
  ) AS contracts(table_name,privileges) LOOP
    EXECUTE format('GRANT %s ON TABLE public.%I TO authenticated',contract.privileges,contract.table_name);
  END LOOP;
  GRANT INSERT (tenant_id,customer_id,preferred_brands,preferred_segments,budget_range,purchasing_purpose,updated_at),
    UPDATE (tenant_id,customer_id,preferred_brands,preferred_segments,budget_range,purchasing_purpose,updated_at)
    ON public.auto_customer_profiles TO authenticated;

  -- New tables only: replace Supabase default service-role ACL with the exact
  -- table contract. Existing service-role ACLs are intentionally left unchanged.
  FOR contract IN SELECT * FROM (VALUES
    ('policy_registry','SELECT,INSERT,UPDATE'),
    ('mobility_domain_events','SELECT,INSERT,UPDATE,DELETE'),
    ('mobility_command_idempotency','SELECT,INSERT,UPDATE,DELETE'),
    ('auto_vehicle_sale_recognitions','SELECT,INSERT'),
    ('auto_vehicle_sale_recognition_adjustments','SELECT,INSERT'),
    ('auto_vehicle_sale_financial_snapshots','SELECT,INSERT,UPDATE'),
    ('auto_vehicle_sale_payments','SELECT,INSERT'),
    ('auto_vehicle_sale_settlement_actions','SELECT,INSERT')
  ) AS contracts(table_name,privileges) LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM service_role',contract.table_name);
    EXECUTE format('GRANT %s ON TABLE public.%I TO service_role',contract.privileges,contract.table_name);
  END LOOP;
END $adoption_acl$;

-- Abort BEFORE wrapper commit if any final security invariant is unmet.
-- Necessary in-transaction checks, not a claim of runtime/Go-Live proof.
DO $adoption_after$
DECLARE
  target_name text;
  contract record;
  privilege_name text;
  column_name text;
  expected boolean;
BEGIN
  FOR contract IN SELECT * FROM (VALUES
    ('auto_brands','SELECT'),('auto_models','SELECT'),('auto_variants','SELECT'),
    ('auto_leads','SELECT,INSERT,UPDATE'),('auto_bookings','SELECT,INSERT,UPDATE'),
    ('auto_deposits','SELECT,INSERT,UPDATE'),('auto_vehicles','SELECT,INSERT,UPDATE'),
    ('auto_vehicle_status_logs','SELECT,INSERT'),('auto_vehicle_owners','SELECT,INSERT,UPDATE'),
    ('auto_service_history','SELECT'),('auto_customer_profiles','SELECT'),('policy_registry','SELECT'),
    ('mobility_domain_events','SELECT,INSERT'),('mobility_command_idempotency','SELECT,INSERT'),
    ('auto_vehicle_sale_recognitions','SELECT'),('auto_vehicle_sale_recognition_adjustments','SELECT'),
    ('auto_vehicle_sale_financial_snapshots','SELECT,INSERT'),('auto_vehicle_sale_payments','SELECT,INSERT'),
    ('auto_vehicle_sale_settlement_actions','SELECT')
  ) AS contracts(table_name,privileges) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=contract.table_name AND c.relkind='r'
        AND c.relrowsecurity AND pg_get_userbyid(c.relowner)='postgres') THEN
      RAISE EXCEPTION 'Final table/RLS/ownership mismatch: %',contract.table_name;
    END IF;
    IF has_table_privilege('anon','public.'||contract.table_name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege('anon','public.'||contract.table_name,'SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'Anonymous/inherited privileges remain: %',contract.table_name;
    END IF;
    FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      expected:=privilege_name=ANY(string_to_array(contract.privileges,','));
      IF has_table_privilege('authenticated','public.'||contract.table_name,privilege_name) IS DISTINCT FROM expected THEN
        RAISE EXCEPTION 'Effective authenticated % mismatch: %',privilege_name,contract.table_name;
      END IF;
    END LOOP;
    FOR column_name IN SELECT attname FROM pg_attribute
      WHERE attrelid=to_regclass('public.'||contract.table_name) AND attnum>0 AND NOT attisdropped
    LOOP
      FOREACH privilege_name IN ARRAY ARRAY['INSERT','UPDATE','REFERENCES'] LOOP
        expected:=privilege_name=ANY(string_to_array(contract.privileges,',')) OR
          (contract.table_name='auto_customer_profiles' AND privilege_name IN ('INSERT','UPDATE') AND
          column_name=ANY(ARRAY['tenant_id','customer_id','preferred_brands','preferred_segments','budget_range','purchasing_purpose','updated_at']));
        IF has_column_privilege('authenticated','public.'||contract.table_name,column_name,privilege_name) IS DISTINCT FROM expected THEN
          RAISE EXCEPTION 'Effective column % mismatch: %.%',privilege_name,contract.table_name,column_name;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  FOREACH target_name IN ARRAY ARRAY['auto_brands','auto_models','auto_variants'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=target_name
      AND policyname=target_name||'_tenant_read_access' AND permissive='PERMISSIVE' AND cmd='SELECT') OR
      NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=target_name
      AND policyname=target_name||'_tenant_read_guard' AND permissive='RESTRICTIVE' AND cmd='SELECT') THEN
      RAISE EXCEPTION 'Catalog policy pair missing: %',target_name;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='automove-sale-documents' AND name=id
      AND public=false AND file_size_limit=20971520
      AND allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png']) THEN
    RAISE EXCEPTION 'Private document bucket contract mismatch';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname IN ('automove_sale_document_read','automove_sale_document_upload')
    AND roles=ARRAY['authenticated']::name[] AND qual IS DISTINCT FROM 'true'
    AND coalesce(qual,with_check) LIKE '%accountant%' AND coalesce(qual,with_check) NOT LIKE '%finance_manager%')<>2 THEN
    RAISE EXCEPTION 'Accountant-only document policy mismatch';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='storage' AND c.relname IN ('objects','buckets') AND c.relrowsecurity
      AND pg_get_userbyid(c.relowner)='supabase_storage_admin')<>2 THEN
    RAISE EXCEPTION 'Storage ownership/RLS must remain unchanged';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.policy_registry
      WHERE policy_id='AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY' AND version='1.0.0'
      AND status='active' AND is_active AND tenant_id IS NULL AND deleted_at IS NULL
      AND effective_date=DATE '2026-01-01'
      AND config->>'ledger_posting_authorized'='false') THEN
    RAISE EXCEPTION 'Approved global policy seed mismatch';
  END IF;
  FOR contract IN SELECT * FROM (VALUES
    ('auto_vehicle_sale_recognitions','trg_auto_vehicle_sale_recognitions_append_only'),
    ('auto_vehicle_sale_recognitions','trg_auto_vehicle_sale_recognitions_validate_tenant'),
    ('auto_vehicle_sale_recognition_adjustments','trg_auto_vehicle_sale_adjustments_append_only'),
    ('auto_vehicle_sale_recognition_adjustments','trg_auto_vehicle_sale_adjustments_validate_tenant'),
    ('auto_vehicle_sale_financial_snapshots','guard_automove_financial_snapshot'),
    ('auto_vehicle_sale_payments','guard_automove_post_sale_receipt'),
    ('auto_deposits','guard_automove_deposit_collection_cap'),
    ('auto_vehicle_sale_settlement_actions','guard_automove_settlement_action')
  ) AS triggers(table_name,trigger_name) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.'||contract.table_name)
      AND tgname=contract.trigger_name AND tgenabled='O' AND NOT tgisinternal) THEN
      RAISE EXCEPTION 'Required enabled trigger missing: %.%',contract.table_name,contract.trigger_name;
    END IF;
  END LOOP;
END $adoption_after$;

DO $adoption_function_readback$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.get_auth_tenant_id()')
    AND prosrc='
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT u.tenant_id INTO v_tenant_id
  FROM public.users AS u
  JOIN public.tenants AS t ON t.id = u.tenant_id
  WHERE u.id = auth.uid() AND u.status = ''active'' AND t.status = ''active'';

  -- NULL would enable legacy policies using NULL as an unrestricted HQ sentinel.
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION ''Active canonical identity and tenant required'' USING ERRCODE = ''42501'';
  END IF;
  RETURN v_tenant_id;
END;
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=pg_catalog, public']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.get_auth_tenant_id()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.is_admin()')
    AND prosrc='
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u JOIN public.tenants AS t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.status = ''active'' AND t.status = ''active'' AND u.role = ''admin''
  );
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=pg_catalog, public']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.is_admin()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.is_hr()')
    AND prosrc='
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u JOIN public.tenants AS t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.status = ''active'' AND t.status = ''active'' AND u.role = ''hr''
  );
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=pg_catalog, public']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.is_hr()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.is_accountant()')
    AND prosrc='
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u JOIN public.tenants AS t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.status = ''active'' AND t.status = ''active'' AND u.role = ''accountant''
  );
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=pg_catalog, public']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.is_accountant()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.is_hq_super_admin()')
    AND prosrc='
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u JOIN public.tenants AS t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.status = ''active'' AND t.status = ''active''
      AND u.role = ''admin'' AND t.product_key = ''bella_hq''
  );
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=pg_catalog, public']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.is_hq_super_admin()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.is_hq_admin()')
    AND prosrc='
  SELECT public.is_hq_super_admin();
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=pg_catalog, public']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.is_hq_admin()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.mobility_tenant_access_allowed(uuid,uuid)')
    AND prosrc='
  SELECT
    p_tenant_id = public.get_auth_tenant_id()
    AND (
      (
        p_org_unit_id IS NULL
        AND auth.uid() IS NOT NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_org_unit_access access
        WHERE access.tenant_id = p_tenant_id
          AND access.org_unit_id = p_org_unit_id
          AND access.user_id = auth.uid()
      )
    );
' AND prosecdef=false
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=public']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.mobility_tenant_access_allowed(uuid,uuid)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.prevent_auto_vehicle_sale_ledger_mutation()')
    AND prosrc='
BEGIN
  RAISE EXCEPTION ''AutoMove vehicle sale recognition ledgers are append-only.'';
END;
' AND prosecdef=false
    AND pg_get_userbyid(proowner)='postgres' AND proconfig IS NULL)
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.prevent_auto_vehicle_sale_ledger_mutation()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.validate_auto_vehicle_sale_recognition_tenant()')
    AND prosrc='
DECLARE
  vehicle_tenant_id UUID;
  customer_tenant_id UUID;
  actor_tenant_id UUID;
  policy_exists BOOLEAN;
  booking_row RECORD;
BEGIN
  IF to_regclass(''public.policy_registry'') IS NULL THEN
    RAISE EXCEPTION ''Vehicle sale recognition requires policy_registry before inserts are allowed.'';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.policy_registry
     WHERE policy_id = NEW.accounting_policy_id
       AND version = NEW.accounting_policy_version
  )
    INTO policy_exists;

  IF NOT policy_exists THEN
    RAISE EXCEPTION ''Vehicle sale recognition references an unregistered accounting policy version.'';
  END IF;

  SELECT tenant_id
    INTO vehicle_tenant_id
    FROM public.auto_vehicles
   WHERE id = NEW.vehicle_id;

  IF vehicle_tenant_id IS NULL OR vehicle_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION ''Vehicle sale recognition references a vehicle outside the recognition tenant.'';
  END IF;

  SELECT tenant_id
    INTO customer_tenant_id
    FROM public.customers
   WHERE id = NEW.customer_id;

  IF customer_tenant_id IS NULL OR customer_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION ''Vehicle sale recognition references a customer outside the recognition tenant.'';
  END IF;

  IF NEW.booking_id IS NOT NULL THEN
    IF to_regclass(''public.auto_bookings'') IS NULL THEN
      RAISE EXCEPTION ''Vehicle sale recognition booking evidence cannot be validated because auto_bookings is unavailable.'';
    END IF;

    SELECT tenant_id, customer_id, vehicle_id
      INTO booking_row
      FROM public.auto_bookings
     WHERE id = NEW.booking_id;

    IF booking_row.tenant_id IS NULL OR booking_row.tenant_id <> NEW.tenant_id THEN
      RAISE EXCEPTION ''Vehicle sale recognition references a booking outside the recognition tenant.'';
    END IF;

    IF booking_row.customer_id <> NEW.customer_id THEN
      RAISE EXCEPTION ''Vehicle sale recognition customer does not match the booking customer.'';
    END IF;

    IF booking_row.vehicle_id IS NOT NULL AND booking_row.vehicle_id <> NEW.vehicle_id THEN
      RAISE EXCEPTION ''Vehicle sale recognition vehicle does not match the booking vehicle.'';
    END IF;
  END IF;

  IF NEW.recognized_by_user_id IS NOT NULL THEN
    SELECT tenant_id
      INTO actor_tenant_id
      FROM public.users
     WHERE id = NEW.recognized_by_user_id;

    IF actor_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION ''Vehicle sale recognition actor is outside the recognition tenant.'';
    END IF;
  END IF;

  RETURN NEW;
END;
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=public, pg_temp']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.validate_auto_vehicle_sale_recognition_tenant()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.validate_auto_vehicle_sale_adjustment_tenant()')
    AND prosrc='
DECLARE
  recognition_tenant_id UUID;
  actor_tenant_id UUID;
  policy_exists BOOLEAN;
BEGIN
  IF to_regclass(''public.policy_registry'') IS NULL THEN
    RAISE EXCEPTION ''Vehicle sale recognition adjustment requires policy_registry before inserts are allowed.'';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.policy_registry
     WHERE policy_id = NEW.accounting_policy_id
       AND version = NEW.accounting_policy_version
  )
    INTO policy_exists;

  IF NOT policy_exists THEN
    RAISE EXCEPTION ''Vehicle sale recognition adjustment references an unregistered accounting policy version.'';
  END IF;

  SELECT tenant_id
    INTO recognition_tenant_id
    FROM public.auto_vehicle_sale_recognitions
   WHERE id = NEW.recognition_id;

  IF recognition_tenant_id IS NULL OR recognition_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION ''Vehicle sale recognition adjustment references a recognition outside the adjustment tenant.'';
  END IF;

  IF NEW.created_by_user_id IS NOT NULL THEN
    SELECT tenant_id
      INTO actor_tenant_id
      FROM public.users
     WHERE id = NEW.created_by_user_id;

    IF actor_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION ''Vehicle sale recognition adjustment actor is outside the adjustment tenant.'';
    END IF;
  END IF;

  RETURN NEW;
END;
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=public, pg_temp']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.validate_auto_vehicle_sale_adjustment_tenant()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.guard_automove_financial_snapshot()')
    AND prosrc='
DECLARE
  actor_row RECORD;
  booking_row RECORD;
BEGIN
  IF TG_OP = ''DELETE'' THEN
    RAISE EXCEPTION ''Financial source snapshots cannot be deleted.'';
  END IF;
  IF TG_OP = ''UPDATE'' THEN
    IF OLD.status <> ''draft'' THEN
      RAISE EXCEPTION ''Approved financial snapshots are immutable.'';
    END IF;
    IF current_setting(''role'', true) <> ''service_role'' THEN
      RAISE EXCEPTION ''Snapshot changes require the server action.'';
    END IF;
    IF NEW.status = ''draft'' THEN
      IF (to_jsonb(NEW) - ARRAY[''sale_price'',''discount_amount'',''cost_basis'',''sale_document'',''cost_document'']) IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY[''sale_price'',''discount_amount'',''cost_basis'',''sale_document'',''cost_document'']) THEN
        RAISE EXCEPTION ''Draft correction can change only financial values and source documents.'';
      END IF;
    ELSIF NEW.status = ''approved'' THEN
      IF (to_jsonb(NEW) - ARRAY[''status'',''approved_by'',''approved_at'']) IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY[''status'',''approved_by'',''approved_at'']) THEN
        RAISE EXCEPTION ''Approval cannot change financial values or source documents.'';
      END IF;
      IF NEW.approved_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION ''Approval actor must match authenticated identity.'';
      END IF;
    ELSE
      RAISE EXCEPTION ''Invalid financial snapshot state transition.'';
    END IF;
    SELECT tenant_id, role, status INTO actor_row FROM public.users WHERE id = auth.uid();
  ELSE
    IF NEW.status <> ''draft'' OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN
      RAISE EXCEPTION ''New snapshots must be unapproved drafts.'';
    END IF;
    IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION ''Snapshot creator must match authenticated identity.'';
    END IF;
    SELECT tenant_id, role, status INTO actor_row FROM public.users WHERE id = NEW.created_by;
  END IF;
  IF actor_row.tenant_id IS DISTINCT FROM NEW.tenant_id OR
     actor_row.status IS DISTINCT FROM ''active'' OR actor_row.role IS DISTINCT FROM ''accountant'' THEN
    RAISE EXCEPTION ''An active tenant accountant is required.'';
  END IF;
  SELECT tenant_id, customer_id, vehicle_id, status, payment_status INTO booking_row
    FROM public.auto_bookings WHERE id = NEW.booking_id;
  IF booking_row.tenant_id IS DISTINCT FROM NEW.tenant_id OR
     booking_row.customer_id IS DISTINCT FROM NEW.customer_id OR
     booking_row.vehicle_id IS DISTINCT FROM NEW.vehicle_id OR
     booking_row.status = ''cancelled'' OR booking_row.payment_status = ''refunded'' OR
     NOT EXISTS (SELECT 1 FROM public.auto_vehicles WHERE id = NEW.vehicle_id AND tenant_id = NEW.tenant_id) OR
     NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION ''Snapshot business references are invalid.'';
  END IF;
  RETURN NEW;
END;
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=public, pg_temp']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.guard_automove_financial_snapshot()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.guard_automove_post_sale_receipt()')
    AND prosrc='
DECLARE
  booking_row RECORD;
  recognition_row RECORD;
  deposit_total NUMERIC;
  payment_total NUMERIC;
  refund_total NUMERIC;
  price_delta NUMERIC;
BEGIN
  IF TG_OP <> ''INSERT'' THEN RAISE EXCEPTION ''AutoMove sale receipts are append-only.''; END IF;
  IF NEW.received_by IS DISTINCT FROM auth.uid() OR NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=auth.uid() AND u.status=''active'' AND u.role=''accountant''
      AND u.tenant_id=NEW.tenant_id AND t.status=''active''
  ) THEN RAISE EXCEPTION ''An active tenant accountant must record the receipt.''; END IF;
  SELECT * INTO booking_row FROM public.auto_bookings WHERE id=NEW.booking_id AND tenant_id=NEW.tenant_id FOR UPDATE;
  IF booking_row.id IS NULL OR booking_row.status=''cancelled'' OR booking_row.payment_status=''refunded'' THEN
    RAISE EXCEPTION ''Booking is unavailable for collection.'';
  END IF;
  SELECT * INTO recognition_row FROM public.auto_vehicle_sale_recognitions
    WHERE id=NEW.recognition_id AND tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id;
  IF recognition_row.id IS NULL OR recognition_row.customer_id IS DISTINCT FROM booking_row.customer_id OR
     recognition_row.vehicle_id IS DISTINCT FROM booking_row.vehicle_id OR
     (SELECT count(*) FROM public.auto_vehicle_sale_recognitions WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id) <> 1 THEN
    RAISE EXCEPTION ''Receipt must reference the canonical sale for this booking.'';
  END IF;
  IF EXISTS (SELECT 1 FROM public.auto_vehicle_sale_recognition_adjustments
    WHERE tenant_id=NEW.tenant_id AND recognition_id=NEW.recognition_id AND
      (refund_amount<>0 OR receivable_delta<>sale_price_delta OR adjustment_type IN (''refund_recorded'',''sale_revenue_reversed''))) THEN
    RAISE EXCEPTION ''Settlement requires resolution of refund/reversal adjustments.'';
  END IF;
  SELECT coalesce(sum(amount),0) INTO deposit_total FROM public.auto_deposits
    WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id AND status=''confirmed'';
  IF deposit_total IS DISTINCT FROM booking_row.deposit_paid OR
     recognition_row.payment_received_total <> recognition_row.deposit_received_total OR
     recognition_row.receivable_amount_at_recognition <> recognition_row.sale_price_recognized-recognition_row.payment_received_total OR
     deposit_total < recognition_row.deposit_received_total THEN
    RAISE EXCEPTION ''Receipt/deposit reconciliation mismatch.'';
  END IF;
  SELECT coalesce(sum(sale_price_delta),0) INTO price_delta FROM public.auto_vehicle_sale_recognition_adjustments
    WHERE tenant_id=NEW.tenant_id AND recognition_id=NEW.recognition_id;
  SELECT coalesce(sum(amount),0) INTO payment_total FROM public.auto_vehicle_sale_payments
    WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id;
  SELECT coalesce(sum(amount),0) INTO refund_total FROM public.auto_vehicle_sale_settlement_actions
    WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id AND action_type=''refund'';
  IF deposit_total+payment_total-refund_total+NEW.amount > recognition_row.sale_price_recognized+price_delta THEN
    RAISE EXCEPTION ''Receipt exceeds the remaining recognized sale amount.'';
  END IF;
  NEW.received_at := statement_timestamp();
  RETURN NEW;
END;
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=public, pg_temp']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.guard_automove_post_sale_receipt()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.guard_automove_deposit_collection_cap()')
    AND prosrc='
DECLARE
  recognized_total NUMERIC;
  post_sale_total NUMERIC;
  confirmed_total NUMERIC;
  recognized_count INTEGER;
  previous_id UUID;
BEGIN
  IF NEW.status <> ''confirmed'' THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.auto_bookings
    WHERE id=NEW.booking_id AND tenant_id=NEW.tenant_id FOR UPDATE;
  SELECT coalesce(sum(amount),0) INTO post_sale_total
    FROM public.auto_vehicle_sale_payments
    WHERE booking_id=NEW.booking_id AND tenant_id=NEW.tenant_id;
  -- Before the first post-sale receipt, retain the established deposit contract.
  IF post_sale_total = 0 THEN RETURN NEW; END IF;
  SELECT count(*),sum(r.sale_price_recognized + coalesce((
    SELECT sum(a.sale_price_delta) FROM public.auto_vehicle_sale_recognition_adjustments a
      WHERE a.recognition_id=r.id AND a.tenant_id=r.tenant_id
  ),0)) INTO recognized_count,recognized_total
    FROM public.auto_vehicle_sale_recognitions r
    WHERE r.booking_id=NEW.booking_id AND r.tenant_id=NEW.tenant_id;
  IF TG_OP = ''UPDATE'' THEN previous_id := OLD.id; END IF;
  SELECT coalesce(sum(amount),0) INTO confirmed_total FROM public.auto_deposits
    WHERE booking_id=NEW.booking_id AND tenant_id=NEW.tenant_id AND status=''confirmed''
      AND id IS DISTINCT FROM previous_id;
  IF recognized_count <> 1 OR recognized_total IS NULL OR
     confirmed_total + post_sale_total + NEW.amount > recognized_total THEN
    RAISE EXCEPTION ''Combined collections exceed the canonical recognized sale balance.''
      USING ERRCODE=''23514'', CONSTRAINT=''automove_combined_collection_cap'';
  END IF;
  RETURN NEW;
END;
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=public, pg_temp']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.guard_automove_deposit_collection_cap()'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.guard_automove_settlement_action()')
    AND prosrc='
DECLARE
  original_amount NUMERIC;
  returned_amount NUMERIC;
BEGIN
  IF TG_OP <> ''INSERT'' THEN RAISE EXCEPTION ''Settlement actions are append-only.''; END IF;
  IF NEW.created_by IS DISTINCT FROM auth.uid() OR NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=auth.uid() AND u.role=''accountant'' AND u.status=''active''
      AND u.tenant_id=NEW.tenant_id AND t.status=''active''
  ) THEN RAISE EXCEPTION ''An active tenant accountant is required.''; END IF;
  PERFORM id FROM public.auto_bookings WHERE id=NEW.booking_id AND tenant_id=NEW.tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION ''Settlement booking is outside the actor tenant.''; END IF;
  IF NEW.source_document->>''bucket'' IS DISTINCT FROM ''automove-sale-documents'' OR
    split_part(NEW.source_document->>''path'',''/'',1) IS DISTINCT FROM NEW.tenant_id::text OR
    coalesce(NEW.source_document->>''sha256'','''') !~ ''^[a-f0-9]{64}$'' THEN
    RAISE EXCEPTION ''Tenant source document and checksum are required.'';
  END IF;
  IF NEW.action_type=''refund'' THEN
    IF NEW.source_deposit_id IS NOT NULL THEN
      SELECT amount INTO original_amount FROM public.auto_deposits
        WHERE id=NEW.source_deposit_id AND booking_id=NEW.booking_id AND tenant_id=NEW.tenant_id AND status=''confirmed'';
    ELSE
      SELECT amount INTO original_amount FROM public.auto_vehicle_sale_payments
        WHERE id=NEW.source_payment_id AND booking_id=NEW.booking_id AND tenant_id=NEW.tenant_id;
    END IF;
    IF original_amount IS NULL THEN RAISE EXCEPTION ''Confirmed original receipt is required.''; END IF;
    SELECT coalesce(sum(amount),0) INTO returned_amount FROM public.auto_vehicle_sale_settlement_actions
      WHERE tenant_id=NEW.tenant_id AND action_type=''refund'' AND
        (source_deposit_id=NEW.source_deposit_id OR source_payment_id=NEW.source_payment_id);
    IF returned_amount+NEW.amount > original_amount THEN RAISE EXCEPTION ''Refund exceeds the unrefunded original receipt.''; END IF;
  END IF;
  NEW.created_at := statement_timestamp();
  RETURN NEW;
END;
' AND prosecdef=true
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=public, pg_temp']::text[])
    THEN RAISE EXCEPTION 'Final function definition/authority mismatch: public.guard_automove_settlement_action()'; END IF;
END $adoption_function_readback$;

