BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

WITH targets(signature) AS MATERIALIZED (VALUES
  ('public.get_booking_as_of(uuid,timestamptz,uuid)'),
  ('public.get_journey_as_of(uuid,timestamptz,uuid)'),
  ('public.get_temporal_vehicle_inventory(uuid,timestamptz)'),
  ('public.get_vehicle_as_of(uuid,timestamptz,uuid)'),
  ('public.get_vehicle_status_history(uuid,uuid,timestamptz,timestamptz)'),
  ('public.reconstruct_temporal_state_at(uuid,uuid,timestamptz,text)'),
  ('public.temporal_snapshot_auto_bookings()'),
  ('public.temporal_snapshot_auto_customer_journeys()'),
  ('public.temporal_snapshot_auto_vehicles()'),
  ('public.platform_current_actor_profile()'),
  ('public.platform_current_actor_org_unit_access()'),
  ('public.platform_org_unit_access_for_actor(uuid,uuid)')
)
SELECT targets.signature,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  pg_get_userbyid(p.proowner) AS owner_role,
  p.prosecdef AS security_definer,
  p.proconfig AS function_config,
  p.proacl::text AS function_acl,
  md5(coalesce(p.proacl::text, '')) AS function_acl_md5,
  md5(p.prosrc) AS body_md5,
  length(p.prosrc) AS body_length,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
  position('auth.uid' IN lower(p.prosrc)) > 0 AS references_auth_uid,
  position('auth.role' IN lower(p.prosrc)) > 0 AS references_auth_role,
  position('platform_current_actor_profile' IN lower(p.prosrc)) > 0 AS references_current_actor_contract,
  position('platform_org_unit_access_for_actor' IN lower(p.prosrc)) > 0 AS references_trusted_actor_contract
FROM targets
JOIN pg_proc p ON p.oid = to_regprocedure(targets.signature)
ORDER BY p.proname, targets.signature;

ROLLBACK;
