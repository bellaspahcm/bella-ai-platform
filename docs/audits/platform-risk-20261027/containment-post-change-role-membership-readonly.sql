BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT r.rolname,
       r.rolcanlogin,
       r.rolsuper,
       r.rolbypassrls,
       pg_has_role(r.rolname, 'service_role', 'MEMBER') AS member_of_service_role,
       pg_has_role(r.rolname, 'authenticated', 'MEMBER') AS member_of_authenticated,
       has_table_privilege(r.rolname, 'public.auto_vehicles_history', 'SELECT') AS vehicle_history_select
FROM pg_roles r
WHERE r.rolname IN (
  'anon', 'authenticated', 'service_role', 'bella_developer',
  'verification_executor', 'bella_migration_executor', 'postgres'
)
ORDER BY r.rolname;
ROLLBACK;
