BEGIN READ ONLY;
SELECT jsonb_build_object(
 'auth_functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='auth' AND p.proname IN ('jwt','uid')),
 'trigger_functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('fn_check_sent_snapshot_immutable','fn_check_invoice_line_items_immutable','fn_check_invoice_immutable','update_students_updated_at'))
) AS evidence;
ROLLBACK;
