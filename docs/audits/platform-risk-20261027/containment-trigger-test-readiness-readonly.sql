BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

WITH eligible AS (
  SELECT DISTINCT u.tenant_id
  FROM public.users u
  JOIN auth.users a ON a.id = u.id
  JOIN public.tenants t ON t.id = u.tenant_id
  WHERE u.status = 'active' AND t.status = 'active'
    AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until <= now())
)
SELECT 'auto_vehicles' AS parent,
       count(*)::int AS eligible_parent_rows
FROM public.auto_vehicles v JOIN eligible e ON e.tenant_id = v.tenant_id
UNION ALL
SELECT 'auto_bookings', count(*)::int
FROM public.auto_bookings b JOIN eligible e ON e.tenant_id = b.tenant_id
UNION ALL
SELECT 'auto_customer_journeys', count(*)::int
FROM public.auto_customer_journeys j JOIN eligible e ON e.tenant_id = j.tenant_id;

ROLLBACK;
