-- Migration: Set product_key for Interior tenants that have bella_interior module enabled
-- but product_key was not set during onboarding.
-- This fixes the tenant identity resolution bug where settings page falls back to wrong tenant.

-- Idempotent: only updates tenants where product_key is NULL and bella_interior module is enabled
UPDATE tenants
SET product_key = 'bella_interior'
WHERE product_key IS NULL
  AND (enabled_modules->>'bella_interior')::boolean = true;

-- Verify: all bella_interior tenants should now have correct product_key
DO $$
DECLARE
  unclassified_count INT;
BEGIN
  SELECT COUNT(*) INTO unclassified_count
  FROM tenants
  WHERE (enabled_modules->>'bella_interior')::boolean = true
    AND product_key IS NULL;

  IF unclassified_count > 0 THEN
    RAISE EXCEPTION 'Migration incomplete: % bella_interior tenant(s) still have NULL product_key', unclassified_count;
  END IF;
END $$;
