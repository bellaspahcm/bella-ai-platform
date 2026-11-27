-- Additive migration: Enable TT99 (99/2025/TT-BTC) in accounting_event_templates
-- and seed baseline TT99 accounting event templates.

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname
  INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.accounting_event_templates'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%standard_profile%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.accounting_event_templates DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE public.accounting_event_templates
    ADD CONSTRAINT accounting_event_templates_standard_profile_check
    CHECK (standard_profile IN ('TT133', 'TT200', 'TT99'));
END $$;

INSERT INTO public.accounting_event_templates (
  tenant_id, standard_profile, business_event_type, template_name, description,
  source_module, template_lines, required_fields, auto_post_allowed, requires_review, is_system
)
SELECT
  NULL,
  'TT99',
  business_event_type,
  template_name || ' (TT99)',
  description,
  source_module,
  template_lines,
  required_fields,
  auto_post_allowed,
  requires_review,
  true
FROM public.accounting_event_templates
WHERE tenant_id IS NULL
  AND standard_profile = 'TT133'
  AND is_active = true
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
