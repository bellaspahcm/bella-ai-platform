-- Catalog metadata only. No job commands, URLs, query text, credentials or business rows returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_build_object(
  'checkedAt', clock_timestamp(),
  'transactionReadOnly', current_setting('transaction_read_only'),
  'extensions', (SELECT jsonb_agg(extname ORDER BY extname) FROM pg_catalog.pg_extension),
  'schedulerRelations', (SELECT jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'relation',c.relname,
    'columns',(SELECT jsonb_agg(a.attname ORDER BY a.attnum) FROM pg_catalog.pg_attribute a
      WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)))
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE (n.nspname='cron' AND c.relname IN ('job','job_run_details'))
      OR (n.nspname='net' AND c.relname IN ('http_request_queue','_http_response'))),
  'attendanceFunctionReferences', (SELECT jsonb_agg(jsonb_build_object(
    'signature',p.oid::regprocedure::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),
    'securityDefiner',p.prosecdef,'language',l.lanname,'bodyMd5',md5(p.prosrc),
    'eventReference',p.prosrc ~* '\medu_attendance\M',
    'stateReference',p.prosrc ~* '\medu_attendance_daily_state\M',
    'writerReference',p.prosrc ~* '\m(edu_set_daily_attendance|edu_set_scoped_daily_attendance|preschool_set_scoped_daily_attendance)\M',
    'dynamicExecuteToken',p.prosrc ~* '\mEXECUTE\M') ORDER BY p.oid::regprocedure::text)
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_catalog.pg_language l ON l.oid=p.prolang
    WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND p.prokind='f'
      AND p.prosrc ~* '\m(edu_attendance|edu_attendance_daily_state|edu_set_daily_attendance|edu_set_scoped_daily_attendance|preschool_set_scoped_daily_attendance)\M'),
  'eventTableTriggers', (SELECT jsonb_agg(jsonb_build_object(
    'trigger',t.tgname,'internal',t.tgisinternal,'enabled',t.tgenabled,
    'function',t.tgfoid::regprocedure::text) ORDER BY t.tgname)
    FROM pg_catalog.pg_trigger t WHERE t.tgrelid='public.edu_attendance'::regclass)
) AS inventory;
ROLLBACK;
