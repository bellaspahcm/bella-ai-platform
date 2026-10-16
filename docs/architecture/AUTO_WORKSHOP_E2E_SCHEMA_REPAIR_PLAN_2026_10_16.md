# Auto Workshop E2E Schema Repair Plan

Status: BLOCKED_PENDING_MIGRATION_APPROVAL. No deployment has been executed.
Target: canonical isolated E2E project `bmnbqbcdbuklhopfbopv`, public schema.
Production project `lvnvkpyxtuilhrabtlwv` is excluded.

## Proven gap

The canonical E2E schema and migration ledger lack existing migration
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

The E2E approval registry exists but contains no matching approval record. The
mandatory execution contract in
`docs/architecture/R4_3_EXECUTION_CONTRACT_SPECIFICATION.md` requires approval
verification and a migration/environment-bound gate token before executor access.
Do not forge an approval identity, bypass the wrapper, substitute production or
rewrite the historical migration to make the test pass.

## Verification after approved execution

1. Verify all migration prerequisites and exact target/content binding.
2. Execute through BDGF with an authorized approval record; preserve its audit.
3. Confirm committed columns and migration ledger, and reload PostgREST schema
   through the approved deployment path if required.
4. Run the complete 19-test Phase 6 suite with canonical E2E credentials and the
   E2E JWT alias mapped process-only; require the authenticated history immutability
   assertion to execute, not skip.
5. Verify owned fixture cleanup, report actual counters and any new root failure.

Until this succeeds: Phase 6 Real DB/RLS = NOT_PROVEN. Typecheck/lint/CI success
must not be used to claim that the missing database migration is deployed.
