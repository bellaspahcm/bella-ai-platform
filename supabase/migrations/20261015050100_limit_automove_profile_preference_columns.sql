-- Preserve applied migration history; narrow the new management write surface.
REVOKE INSERT, UPDATE ON public.auto_customer_profiles FROM authenticated;
GRANT INSERT (tenant_id,customer_id,preferred_brands,preferred_segments,budget_range,purchasing_purpose,updated_at)
  ON public.auto_customer_profiles TO authenticated;
-- PostgREST upsert includes the unchanged conflict keys in its UPDATE target.
-- RLS independently enforces both keys' tenant/customer binding.
GRANT UPDATE (tenant_id,customer_id,preferred_brands,preferred_segments,budget_range,purchasing_purpose,updated_at)
  ON public.auto_customer_profiles TO authenticated;
