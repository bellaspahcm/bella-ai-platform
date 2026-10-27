BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT p.proname AS function_name,
       p.prosecdef AS security_definer,
       p.proconfig AS function_config,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
       COALESCE((SELECT bool_or(a.grantee = 0 AND a.privilege_type = 'EXECUTE')
                 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a), false) AS public_execute,
       pg_get_userbyid(p.proowner) AS owner_role
FROM pg_proc p
WHERE p.oid IN (
  'public.get_vehicle_as_of(uuid,timestamptz,uuid)'::regprocedure,
  'public.get_booking_as_of(uuid,timestamptz,uuid)'::regprocedure,
  'public.get_journey_as_of(uuid,timestamptz,uuid)'::regprocedure,
  'public.get_temporal_vehicle_inventory(uuid,timestamptz)'::regprocedure,
  'public.get_vehicle_status_history(uuid,uuid,timestamptz,timestamptz)'::regprocedure,
  'public.reconstruct_temporal_state_at(uuid,uuid,timestamptz,text)'::regprocedure
)
ORDER BY p.proname;
ROLLBACK;
