# Preschool disposable Browser acceptance profile

This profile creates an isolated local Supabase project from a source-pinned dependency closure for the Preschool classroom → teacher → attendance acceptance path. It is not a fix for whole-repository migration replay and does not claim that the full migration history was applied.

The profile intentionally excludes the broken historical chat migration, the competing Student Training `courses(id)` schema, the full Platform Rule Engine migration, and the R3 business-data backfill that requires 848 sealed identity mappings. The Education enrollment migration consumes only the source-defined `platform_rule_domain` enum, so the profile carries a separately versioned projection of that exact enum block; it does not create the unrelated Rule Engine tables or its feature-flag seed. The only R3 operation represented is a separately versioned, profile-only projection of the source-defined nullable `students.party_id` column, `ON DELETE RESTRICT` foreign key, and index. The canonical Education enrollment migration is included because Preschool branch security consumes its `edu_enrollments.request_id` contract. The official `20260523030000` grant migration is included for existing trusted server-side tenant reads; the profile asserts that neither `anon` nor `authenticated` gains direct SELECT on tenant or user identity tables. No students, identity mappings, Auth users, or Preschool business rows are imported by bootstrap.

The migration sources are bound by the manifest hashes. Each run captures the exact checked-out commit SHA in its owner marker and receipt; CI passes `GITHUB_SHA` explicitly so a receipt cannot be reused for a different PR candidate.

The two source migrations with version `20260914` are preserved byte-for-byte and mapped to unique profile ledger versions. The runner records this mapping in the manifest/receipt; it does not write migration ledger rows manually. The profile-only schema projection has its own version and is not represented as the root R3 migration.

The current chain-assignment RPC also reads `preschool_admission_operations`, and its latest source definition is part of a mixed admission/Finance migration. The profile therefore applies source-exact schema fragments for the admission-operation table and exact `preschool_branch_access` / `preschool_assign_chain` definitions from that migration. It deliberately excludes the unrelated admission, pickup, and Finance routines; the manifest records each source-file hash and fragment provenance.

The profile includes the canonical `20260608104000` tenant presentation-column migration because the existing dashboard projection consumes those fields. The forward migration `20261027010300` makes the two attendance-state RLS policies call the existing authorization helper directly. This avoids requiring `authenticated` callers to read `public.tenants` from policy subqueries; it does not grant any additional table or function privileges. The forward migration `20261027020000` adds a zero-argument Platform contract that returns only the current authenticated actor's tenant presentation projection. It does not grant `SELECT` on `public.tenants`; the profile acceptance verifies anonymous/orphan denial, no caller-selected tenant argument, tenant scoping, and direct table-read denial.

## Run

From the repository root, run:

```powershell
pwsh -NoProfile -File scripts/ci/preschool-browser-profile/run.ps1 -Action Prepare
```

`Prepare` requires a reachable Docker Engine and Supabase CLI. It creates a random project ID, chooses a free port range, starts only that project, verifies the public schema starts empty, copies the pinned migration allowlist into the temporary project, applies it with `supabase db reset --local --no-seed`, and runs `verify-bootstrap.sql`. It does not run JWT or Browser E2E.

On success, the disposable stack remains running for a later JWT/RLS and Browser E2E phase. The result directory and ownership marker are printed. To inspect or stop only that owned project:

```powershell
pwsh -NoProfile -File scripts/ci/preschool-browser-profile/run.ps1 -Action Status -RunDirectory <printed-directory>
pwsh -NoProfile -File scripts/ci/preschool-browser-profile/run.ps1 -Action Cleanup -RunDirectory <printed-directory>
```

Cleanup checks the run marker and the recorded database container ID before asking Supabase CLI to stop the matching project. It does not delete the result directory or receipts.

## Run the isolated teacher acceptance stage

After `Prepare` returns schema acceptance `PASS`, run:

```powershell
pwsh -NoProfile -File scripts/ci/preschool-browser-profile/accept.ps1 -RunDirectory <printed-directory>
```

The acceptance runner rechecks the recorded owner marker, project ID, loopback API origin, and database port. It creates a temporary detached application worktree at the exact source revision in the receipt, then overlays only tracked local changes under `src/app`, `src/services`, `src/platform`, and `src/products` (test files are excluded); each copied file is hash-checked and recorded in `application-overlay.json` and the acceptance receipt. This lets the run exercise the current uncommitted application fix without claiming that the commit alone contains it. Untracked runtime files fail closed. Next.js runs against this profile's local Supabase API. The temporary app worktree and disposable Supabase stack are removed in `finally`; receipts and redacted logs remain in the result directory.

Only synthetic fixtures are created. A trusted database-owner connection seeds the fixture grant and base Party/tenant records; identity confirmation, teacher confirmation/assignment, attendance access, and attendance writes use the public RPC or the real authenticated teacher JWT. The Browser stage logs into the app through Supabase Auth, checks the assigned class and roster, denies another branch and tenant, writes attendance, reads it back after a page reload, then revokes the identity link and confirms later access is denied. Out-of-scope rows are seeded only inside the disposable project so RLS denials are observable. The harness refuses a non-loopback Supabase target.

The result is recorded in `acceptance-receipt.json` and summarized in `receipt.json`. JWT/DB and Browser results are separate. `PASS` applies only to the checked local profile; it does not prove full migration-history replay, Production RLS, or Go-Live.

## Acceptance boundary

`PRESCHOOL_PROFILE_SCHEMA_ACL_RLS_PASS` is schema/ACL/RLS-catalog acceptance only. It is not real-JWT proof, Browser E2E, whole-history replay, Production readiness, or Go-Live. JWT and Browser tests must wait until this profile produces a PASS receipt. If migration replay or schema acceptance fails, the runner preserves redacted logs/receipt, stops only resources bearing this run's ownership marker, and exits nonzero.
