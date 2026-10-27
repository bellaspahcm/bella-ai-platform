BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
WITH expected(name, body_md5) AS (VALUES
('platform_org_unit_access_for_actor','cf17872b338a26bb81395c5a5713c6ad'),
('platform_current_actor_profile','563f7f18daa70952a72c5bc7add29918'),
('platform_current_actor_org_unit_access','c977b9b71235497bbecda3407992f10c')
) SELECT e.name,e.body_md5 AS expected_body_md5,md5(btrim(replace(p.prosrc,chr(13),''),chr(10)||chr(9)||chr(32))) AS actual_body_md5,md5(btrim(replace(p.prosrc,chr(13),''),chr(10)||chr(9)||chr(32)))=e.body_md5 AS normalized_body_matches,p.prosecdef AS security_definer,has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute FROM expected e LEFT JOIN pg_proc p ON p.proname=e.name AND p.pronamespace='public'::regnamespace ORDER BY e.name;
ROLLBACK;
