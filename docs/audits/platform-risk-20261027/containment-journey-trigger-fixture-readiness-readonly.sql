BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT count(*)::int AS candidate_count
FROM public.customers c
JOIN public.auto_journey_stages s ON s.tenant_id = c.tenant_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.auto_customer_journeys j
  WHERE j.tenant_id = c.tenant_id AND j.customer_id = c.id
);

ROLLBACK;
