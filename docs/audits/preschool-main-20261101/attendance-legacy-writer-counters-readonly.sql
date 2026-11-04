-- Aggregate telemetry only: no raw statement text, query IDs, actors, IPs or row values returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
WITH activity AS (
 SELECT calls,stats_since,toplevel,
   (toplevel AND query ~* '^[[:space:]]*(insert|update|delete|with|copy|truncate)[[:space:]]'
    AND query ~* '(insert[[:space:]]+into|update|delete[[:space:]]+from|copy|truncate([[:space:]]+table)?)[[:space:]]+(only[[:space:]]+)?("?public"?\.)?"?edu_attendance"?([[:space:]]|\(|$)') AS direct_event_candidate,
   (toplevel AND query ~* '^[[:space:]]*(select|with)[[:space:]]'
    AND query ~* '"?edu_set_daily_attendance"?[[:space:]]*\(') AS writer_rpc_mention
 FROM extensions.pg_stat_statements
 WHERE dbid=(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database())
)
SELECT jsonb_build_object('checkedAt',clock_timestamp(),
 'transactionReadOnly',current_setting('transaction_read_only'),
 'track',current_setting('pg_stat_statements.track',true),
 'auditLog',current_setting('pgaudit.log',true),
 'resetInfo',(SELECT jsonb_build_object('statsReset',stats_reset,'deallocations',dealloc) FROM extensions.pg_stat_statements_info),
 'trackedEntries',(SELECT count(*) FROM activity),
 'earliestEntrySince',(SELECT min(stats_since) FROM activity),
 'directEventDmlCandidates',(SELECT jsonb_build_object('entries',count(*),'calls',coalesce(sum(calls),0),
   'earliestEntrySince',min(stats_since)) FROM activity WHERE direct_event_candidate),
 'writerRpcMentions',(SELECT jsonb_build_object('entries',count(*),'calls',coalesce(sum(calls),0),
   'earliestEntrySince',min(stats_since)) FROM activity WHERE writer_rpc_mention),
 'rawStatementsReturned',false,'clientIdentitiesReturned',false,
 'limitation','Bounded normalized-statement pattern inventory; no proof of external-client absence or complete audit coverage.'
) AS counters;
ROLLBACK;
