# Preschool Teacher SQL provenance

The three SQL files and `DESIGN.md`/`WIRE.md` are exact copies of the reviewed package from the classroom audit checkout. The original design headers describe their state when drafted; the subsequent approved application and read-back supersede that draft status.

On 2026-10-25, E2E received the empty-profile `011` and shared `020`; Production received the legacy-preserving `010` and shared `020`. E2E Auth/HTTP/DB verification covered the lifecycle and denials. Production retained its 16 legacy rows and received no canonical teacher fixture. The local no-op migration checkpoint records the manual application event; it does not provision a clean database. Target-aware provisioning remains separate work.

SHA256: `010` 242e943d8bdba6905d5369b381306bd28bcc4e2eaa14ddf91ede6b046e51465e; `011` 058aaaf478e78eb88b2b503256b24b8d6ab26e3a2b3eea2b05e43c306145b02a; `020` a551fbd6a35cb668ffda6f6ac03e441c2718ff027d94f5e6959ef463b2e62764.

Current source wiring and acceptance are tracked in `../ARCHITECTURE_GATE_RESULT_TEACHER.md`.

## Official clean-database provisioning

Owner approval on 2026-10-27 authorizes a separate-branch migration sequence and isolated local/E2E verification only. The selected profile is the existing legacy profile because the canonical migration chain already creates `teacher_assignments` with its validated `course_id -> courses.course_id` foreign key. `011-empty-e2e-bootstrap.sql` remains a profile-specific historical bootstrap and is not part of the standard migration chain.

The official sequence is `20261027010000` (compatible legacy profile expansion), `20261027010100` (the approved confirmation relation and canonical assignment contract), and `20261027010200` (a narrow integrity check requiring an end date on terminated canonical assignments). The third migration addresses an independent review finding without changing the original 020 SQL package or any ACL. These migrations have not been applied to the shared Preschool stack or Production.

The 010 and 020 migration bodies derive from the reviewed source package whose LF-normalized SHA-256 values are recorded above. The migration files carry updated provenance headers; the original design files remain unchanged as historical review artifacts. Migration and isolated-database verification results will be appended after execution.

The earlier paragraph about manual E2E/Production application is retained as historical provenance from the source checkout; it was not independently read back from either database in this task and is not evidence of current database state.

Rollback is limited to the authorized disposable local/E2E environment: on any failed step, discard the owned stack and synthetic fixture as a unit. No reversible down migration is provided because rollback after canonical rows exist would require a separate data-preservation decision. These migrations have not been applied to the shared Preschool stack or Production.

### Verification attempts — 2026-10-27

- The unmodified repository migration chain has an ordering defect: `20260515010000_the_great_purge.sql` writes `bookings.package_name` before `20260515040000_create_packages_table.sql` adds it. The historical migrations remain unchanged. An additive migration `20260515000002_add_bookings_package_name_before_backfill.sql` is now in this branch before the first executable use and preserves the existing nullable `TEXT` column shape with `IF NOT EXISTS`.
- Main has call sites for `get_my_tenant_id()` but no executable creator. A historical `core-platform-lab` migration defines a `SECURITY DEFINER` variant, unlike the pinned Production catalog snapshot. The user explicitly selected that 2026-10-21 snapshot as the canonical source for this local/E2E migration. The additive `20260515040001_add_get_my_tenant_id_from_approved_catalog.sql` restores its zero-argument `RETURNS uuid`, `STABLE`, `SECURITY INVOKER` behavior and observed effective execute rights before the first dependency. `get_auth_tenant_id()` remains distinct and is not substituted.
- Supabase CLI supports `--include-all` for migrations absent from remote history. Because the package prerequisite is intentionally timestamped before already-existing migrations, applying it to an environment whose history includes later versions requires a separately reviewed migration-history plan. No shared or Production database was contacted or changed.
#### First replay, before helper source selection

- On 2026-10-27, `supabase db start` ran against a fresh temporary project with a unique project ID and non-overlapping ports. The unchanged chain plus the new package migration applied through `20260516000000_financial_reconciliation.sql`; `20260515010000_the_great_purge.sql` succeeded after `package_name` was added. The next migration, `20260516000001_audit_logs.sql`, failed while creating `Admins can view audit logs`, with SQLSTATE `42883`, `function get_my_tenant_id() does not exist`.
- Supabase reported stopping the disposable database after the migration failure. Read-back found no containers or volumes matching the temporary project ID; the existing `bella-preschool-course-20261022` stack remained running. No business fixture, shared database or Production database was changed. The temporary config/migration copy remains under the OS Temp directory because recursive filesystem cleanup was blocked by policy; no alternate deletion path was attempted.
- `db:migration:zero-downtime` previously passed for the three teacher candidate migrations; the reviewed 010/020 SQL bodies match their source drafts after removing provenance/guard comments; four focused contract/API test suites passed (60 tests). These tests use mocks and do not establish DB/RLS behavior. Results will be rerun after this branch delta.
#### Rerun after helper source selection

- After the user selected the pinned catalog definition, the isolated clean replay applied both prerequisites and progressed through `20260516000002_fix_chat_schema.sql`. It then failed in the unrelated historical `20260516000003_fix_chat_rpc_ambiguous.sql` with SQLSTATE `42601`: the function body contains escaped `\$\$` delimiters. No historical migration was edited or skipped. This is the next clean-bootstrap blocker and is outside the approved two-prerequisite scope.
- The isolated project was stopped by Supabase after failure; read-back confirmed no containers or volumes for its unique project ID, while the shared Preschool stack remained running. A recursive deletion request for the temporary config/migration copy was rejected by policy, so that harmless Temp directory remains; no alternative deletion method was attempted.
- Teacher migrations, schema/constraint/ACL/RLS read-back, JWT authorization checks and Browser E2E were not reached. `db:migration:zero-downtime` passed for five candidate migrations and `git diff --check` passed (only line-ending conversion warnings). No candidate migration was applied to a shared or Production database.
