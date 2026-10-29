-- REVIEW ONLY: outside the approved32-table allowlist. Owner expansion required.
-- This addresses direct table ACL only; privileged user writers need separate guards.
-- No business rows/roles/policies/functions are changed. Keep original ACL snapshot.
-- Intentionally ROLLBACK-only; do not mistake this proposal for production execution.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='20s';
DO $review_identity_acl$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.users'::regclass
            AND attnum>0 AND NOT attisdropped AND attacl IS NOT NULL) THEN
    RAISE EXCEPTION 'Column ACL path changed; review exact live baseline first';
  END IF;
END;
$review_identity_acl$;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
ON TABLE public.users FROM anon, authenticated;
ROLLBACK;
