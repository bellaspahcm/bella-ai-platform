-- Attendance source uses platform_current_actor_tenant_presentation (exact name).
-- Metadata only, explicit project lvnvkpyxtuilhrabtlwv, no business RPC/rows.
BEGIN TRANSACTION READ ONLY;
SELECT jsonb_build_object(
 'capturedAt',clock_timestamp(),'transactionReadOnly',current_setting('transaction_read_only'),
 'tenantPresentation',(SELECT coalesce(jsonb_agg(jsonb_build_object(
   'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
   'definitionMd5',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,
   'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef)), '[]'::jsonb)
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prokind='f'
     AND p.proname='platform_current_actor_tenant_presentation'),
 'statePolicyRoles',(SELECT jsonb_agg(jsonb_build_object('name',p.polname,
   'roles',(SELECT jsonb_agg(CASE WHEN role_id=0 THEN 'PUBLIC' ELSE pg_get_userbyid(role_id) END)
     FROM unnest(p.polroles) role_id)))
   FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='edu_attendance_daily_state')
) AS catalog;
ROLLBACK;
