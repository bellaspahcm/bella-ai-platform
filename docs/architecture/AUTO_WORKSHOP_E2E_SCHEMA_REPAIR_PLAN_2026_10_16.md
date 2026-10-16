# Auto Workshop E2E Schema Repair Plan

Status: EXECUTED_AND_VERIFIED_ON_E2E after explicit human approval in this chat.
Target: canonical isolated E2E project `bmnbqbcdbuklhopfbopv`, public schema.
Production project `lvnvkpyxtuilhrabtlwv` is excluded.

## Original proven gap

The canonical E2E schema and migration ledger originally lacked existing migration
`supabase/migrations/20260804360000_migrate_workshop_schema.sql`.
Read-only inspection confirms missing appointment `scheduled_date`, `vehicle_info`
and repair-order `customer_name`, `vehicle_info` columns. The source migration is
already on main; no new migration or runtime field should be invented.

Exact checked-out migration SHA-256:
`23bcf0f6fb4b7221d12d4fc24d13c02d3a53feb7fa807a5f3cab053c1ec75514`.
The authorized executor must recompute and bind the content hash before execution.

## Requested execution scope

Apply only this existing workshop migration through the established BDGF wrapper,
bound to the E2E target. It adds denormalized appointment/repair-order columns,
backfills from existing customer/vehicle data, sets required constraints and adds
the appointment schedule index. It performs UPDATE backfills and SET NOT NULL;
it must be reviewed as a database change, not a test-only patch.

The E2E approval registry initially contained no matching approval record. The
mandatory execution contract in
`docs/architecture/R4_3_EXECUTION_CONTRACT_SPECIFICATION.md` requires approval
verification and a migration/environment-bound gate token before executor access.
Do not forge an approval identity, bypass the wrapper, substitute production or
rewrite the historical migration to make the test pass.

## Execution result

BDGF wrapper executed the exact LF-content hash listed above. The worktree's CRLF
copy has the same Git blob; execution used the reviewed LF content so approval
was bound to the exact approved bytes. No historical migration file was rewritten.

- Migration approval: `055497f6-9a39-4a40-aabf-2018d6362b5f`, dev environment, public
  schema, canonical E2E connection; actual executor principal `postgres`.
- Ledger/lifecycle finalization approval: `0120a02e-b2e2-40c7-9f34-1dd308f6869e`.
- Both wrapper executions succeeded; both approval records and tokens are used.
- Columns and migration ledger version `20260804360000` verified after commit.
- Phase 6: 19/19 PASS, including authenticated read, denied/zero-row valid-column
  update and unchanged persisted service history. Owned fixture cleanup succeeded.

The existing dev-only signing-key backend was used for dev/E2E. No Production
secret, signing configuration, approval invariant or token check was changed.
The initial connection-URI repair was exercised before gated execution. Main
PR #343 independently supplies the canonical URI/TLS implementation; final code
adopts main unchanged and retains its TLS/identity regression tests. The temporary
duplicate parser is discarded. The 19 approval regressions passed as well.

## Verification performed

1. Verify all migration prerequisites and exact target/content binding.
2. Execute through BDGF with an authorized approval record; preserve its audit.
3. Confirm committed columns and migration ledger, and reload PostgREST schema
   through the approved deployment path if required.
4. Run the complete 19-test Phase 6 suite with canonical E2E credentials and the
   E2E JWT alias mapped process-only; require the authenticated history immutability
   assertion to execute, not skip.
5. Verify owned fixture cleanup, report actual counters and any new root failure.

Phase 6 Real DB/RLS = PASS for this isolated suite and E2E target. This does not
prove Production, the full AutoMove product or Go-Live.
