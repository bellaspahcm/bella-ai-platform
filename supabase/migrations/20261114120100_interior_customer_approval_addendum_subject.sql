-- Add one customer approval subject after all existing users of the enum have
-- committed. Keep this in its own migration because a new enum value cannot
-- be consumed by other SQL in the same PostgreSQL transaction.
ALTER TYPE public.interior_approval_subject_type
  ADD VALUE IF NOT EXISTS 'contract_addendum';
