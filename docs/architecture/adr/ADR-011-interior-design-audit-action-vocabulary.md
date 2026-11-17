# ADR-011: Alignment of Interior Design RPC Audit Actions with Canonical Audit Logs Vocabulary

## Status
ACCEPTED / IMPLEMENTED

## Context
During Operational Acceptance testing of Bella Interior OS (Batch O1: Design to BOQ on pilot project `INT-2024-004`), execution of the canonical RPC `public.interior_create_design_revision` failed with check constraint violation:
```text
ERROR: 23514: new row for relation "audit_logs" violates check constraint "audit_logs_action_check"
DETAIL: Failing row contains (..., 'CREATE', ...)
```

The underlying table `public.audit_logs` enforces:
```sql
CONSTRAINT audit_logs_action_check CHECK (action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text]))
```

In migration `20261109130000_bella_interior_rbac_scopes.sql`, two design lifecycle functions were authored with non-canonical audit action strings:
1. `public.interior_create_design_revision`: used `action = 'CREATE'` instead of `'INSERT'`.
2. `public.interior_approve_design_revision`: used `action = 'APPROVE'` instead of `'UPDATE'`.

A direct precedent was established in `supabase/migrations/20261114171657_interior_boq_approval_audit_action.sql`, which aligned `interior_approve_boq` by updating its audit action from `'APPROVE'` to `'UPDATE'`, noting:
> "Keep BOQ approval audit entries within the canonical audit_logs action vocabulary. The status transition remains identified by old_data/new_data."

## Decision
Under governance directive for O1 remediation:
1. Create additive migration `supabase/migrations/20261117195500_interior_design_audit_action_vocabulary.sql`.
2. Update `public.interior_create_design_revision` to write `action = 'INSERT'`.
3. Update `public.interior_approve_design_revision` to write `action = 'UPDATE'`.
4. Keep all RPC signatures, return types, error codes, Four-Eyes validation (`v_revision.submitted_by_user_id = v_actor`), permission checks (`interior:design:create`, `interior:design:approve`), and tenant isolation logic 100% intact.
5. Provide comprehensive automated contract tests in `src/products/bella-interior/__tests__/design-audit-action-contract.test.ts`.

## Consequences
- The RPC functions now satisfy `audit_logs_action_check` while retaining business audit fidelity via `old_data` and `new_data` jsonb payloads.
- No table schema, columns, or constraints are modified.
- Windows A–D remain sealed.
- Operational Acceptance Batch O1 can resume safely upon deployment.
