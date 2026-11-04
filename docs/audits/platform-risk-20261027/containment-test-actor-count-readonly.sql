BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT count(DISTINCT u.tenant_id)::int AS eligible_active_actor_tenants
FROM public.users u
JOIN auth.users a ON a.id = u.id
JOIN public.tenants t ON t.id = u.tenant_id
WHERE u.status = 'active'
  AND t.status = 'active'
  AND a.deleted_at IS NULL
  AND (a.banned_until IS NULL OR a.banned_until <= now());

ROLLBACK;
