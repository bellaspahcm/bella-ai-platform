BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

WITH eligible AS (
  SELECT DISTINCT u.id AS actor_id, u.tenant_id
  FROM public.users u
  JOIN auth.users a ON a.id = u.id
  JOIN public.tenants t ON t.id = u.tenant_id
  WHERE u.status = 'active' AND t.status = 'active'
    AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until <= now())
),
tenant_capabilities AS (
  SELECT e.tenant_id,
         bool_or(EXISTS (SELECT 1 FROM public.auto_vehicles v WHERE v.tenant_id = e.tenant_id)) AS has_vehicle,
         bool_or(EXISTS (SELECT 1 FROM public.auto_bookings b WHERE b.tenant_id = e.tenant_id)) AS has_booking,
         bool_or(EXISTS (SELECT 1 FROM public.customers c WHERE c.tenant_id = e.tenant_id)) AS has_customer,
         bool_or(EXISTS (SELECT 1 FROM public.auto_journey_stages s WHERE s.tenant_id = e.tenant_id)) AS has_journey_stage
  FROM eligible e
  GROUP BY e.tenant_id
)
SELECT count(*) FILTER (WHERE has_vehicle)::int AS eligible_vehicle_tenants,
       count(*) FILTER (WHERE has_booking)::int AS eligible_booking_tenants,
       count(*) FILTER (WHERE has_vehicle AND has_booking)::int AS eligible_vehicle_and_booking_tenants,
       count(*) FILTER (WHERE has_customer AND has_journey_stage)::int AS eligible_journey_fixture_tenants
FROM tenant_capabilities;

ROLLBACK;
