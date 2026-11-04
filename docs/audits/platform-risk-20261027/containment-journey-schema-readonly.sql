BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT c.column_name, c.data_type, c.is_nullable, c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.table_name = 'auto_customer_journeys'
ORDER BY c.ordinal_position;

SELECT conname, contype, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.auto_customer_journeys'::regclass
ORDER BY contype, conname;

ROLLBACK;
