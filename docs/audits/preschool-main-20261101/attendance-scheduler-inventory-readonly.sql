-- Scheduler operational metadata only. Never return command/return_message, URLs or credentials.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_build_object(
  'checkedAt',clock_timestamp(),
  'transactionReadOnly',current_setting('transaction_read_only'),
  'jobCount',(SELECT count(*) FROM cron.job),
  'activeJobCount',(SELECT count(*) FROM cron.job WHERE active),
  'jobs',(SELECT jsonb_agg(jsonb_build_object(
    'jobId',j.jobid,'active',j.active,'schedule',j.schedule,
    'commandMd5',md5(j.command),
    'roleClass',CASE WHEN j.username IN ('postgres','service_role','anon','authenticated','supabase_admin')
      THEN j.username ELSE 'other_role' END,
    'sameDatabase',j.database=current_database(),
    'attendanceToken',j.command ~* '\m(edu_attendance|edu_attendance_daily_state|edu_set_daily_attendance|edu_set_scoped_daily_attendance|preschool_set_scoped_daily_attendance)\M',
    'backupRestoreToken',j.command ~* '\m(backup|restore|pg_dump|pg_restore|wal_g|pitr)\M',
    'networkToken',j.command ~* '(https?://|\m(http_post|http_get|dblink)\M)',
    'publicFunctionTokens',(SELECT jsonb_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prokind='f' AND j.command ~* ('\m'||p.proname||'\M')),
    'relationTokens',(SELECT jsonb_agg(n.nspname||'.'||c.relname ORDER BY n.nspname,c.relname)
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('public','cron','auth','storage','extensions')
        AND c.relname ~ '^[a-zA-Z_][a-zA-Z0-9_]*$'
        AND j.command ~* ('\m'||c.relname||'\M')),
    'functionCallTokens',(SELECT jsonb_agg(jsonb_build_object(
      'function',p.oid::regprocedure::text,
      'attendanceBodyToken',p.prosrc ~* '\m(edu_attendance|edu_attendance_daily_state|edu_set_daily_attendance|edu_set_scoped_daily_attendance|preschool_set_scoped_daily_attendance)\M',
      'dynamicExecuteToken',p.prosrc ~* '\mEXECUTE\M') ORDER BY p.oid::regprocedure::text)
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND p.prokind='f'
        AND p.proname ~ '^[a-zA-Z_][a-zA-Z0-9_]*$'
        AND j.command ~* ('\m'||p.proname||'[[:space:]]*\(')),
    'retainedRuns',(SELECT count(*) FROM cron.job_run_details d WHERE d.jobid=j.jobid),
    'retainedSucceeded',(SELECT count(*) FROM cron.job_run_details d WHERE d.jobid=j.jobid AND d.status='succeeded'),
    'retainedFailed',(SELECT count(*) FROM cron.job_run_details d WHERE d.jobid=j.jobid AND d.status='failed'),
    'lastRetainedStart',(SELECT max(start_time) FROM cron.job_run_details d WHERE d.jobid=j.jobid)
  ) ORDER BY j.jobid) FROM cron.job j)
) AS scheduler;
ROLLBACK;
