-- Aggregate DB role/statement shape only. No raw statements, users, IPs or query IDs returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
WITH matched AS (
 SELECT s.calls,
 CASE WHEN r.rolname IN ('anon','authenticated','service_role','postgres','authenticator','supabase_admin')
   THEN r.rolname ELSE 'other_role' END AS role_class,
 CASE WHEN s.query ~* '^[[:space:]]*with[[:space:]]' THEN 'WITH'
   WHEN s.query ~* '^[[:space:]]*insert[[:space:]]' THEN 'INSERT'
   WHEN s.query ~* '^[[:space:]]*update[[:space:]]' THEN 'UPDATE'
   WHEN s.query ~* '^[[:space:]]*delete[[:space:]]' THEN 'DELETE'
   ELSE 'COPY_OR_TRUNCATE' END AS statement_class,
 CASE WHEN position('pgrst_' IN lower(s.query))>0 THEN 'POSTGREST_SHAPED' ELSE 'UNCLASSIFIED_SQL_SESSION' END AS shape
 FROM extensions.pg_stat_statements s JOIN pg_catalog.pg_roles r ON r.oid=s.userid
 WHERE s.dbid=(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database()) AND s.toplevel
   AND s.query ~* '^[[:space:]]*(insert|update|delete|with|copy|truncate)[[:space:]]'
   AND s.query ~* '(insert[[:space:]]+into|update|delete[[:space:]]+from|copy|truncate([[:space:]]+table)?)[[:space:]]+(only[[:space:]]+)?("?public"?\.)?"?edu_attendance"?([[:space:]]|\(|$)'
)
SELECT jsonb_build_object('checkedAt',clock_timestamp(),
 'transactionReadOnly',current_setting('transaction_read_only'),
 'groups',(SELECT jsonb_agg(jsonb_build_object('roleClass',role_class,'statementClass',statement_class,
   'shape',shape,'entries',entries,'calls',calls)) FROM (
   SELECT role_class,statement_class,shape,count(*) AS entries,sum(calls) AS calls
   FROM matched GROUP BY role_class,statement_class,shape ORDER BY role_class,statement_class,shape) x),
 'rawStatementsReturned',false,'queryIdsReturned',false,
 'limitation','DB role and query shape cannot identify a caller application, business owner, intent or current activity.'
) AS role_counters;
ROLLBACK;
