# Platform Identity / HQ Alignment

## Process Gate

PASS - implementation authority explicitly granted by the Platform owner on
2026-10-15. This is a scoped repair, not a new OS, product or authorization system.
Truth -> ownership -> reuse -> contract -> minimal fix -> verification -> stop.

## Product Manifest

AutoMove needs a consistent Platform identity baseline before further business-chain
verification. Preserve PR #336 and all sealed business capabilities. No ProductRegistry,
Finance posting, Warranty, commission, kernel or Production work.

## Ownership Map

- Supabase Auth owns authenticated actor identity.
- Platform public.users owns current actor status, role and tenant membership.
- Platform tenants owns current tenant status and product_key.
- Platform owns the existing SQL identity/HQ helpers and server admission functions.
- AutoMove continues consuming these contracts; it does not own a parallel identity model.

## Contract Dependency Map

Auth actor -> live public.users -> live active tenant -> existing role/HQ helpers -> RLS.
Server getCurrentUser() uses that same live authority; checkHqAuth() additionally requires
admin and active tenant product_key = bella_hq. JWT metadata, Redis profiles, tenant names,
email lookup and development mock headers cannot supply current authority.

Existing explicit HQ policies are not removed. HQ receives its real tenant ID, not a
NULL sentinel, and gains no implicit AutoMove cross-tenant access.

## Change Authority

Authorized: forward replacement of six existing helper bodies, getCurrentUser(),
checkHqAuth(), focused tests and Non-Production verification/CI routing. The owner also
approved explicit HQ SELECT/UPDATE policies on public.tenants only after the legacy
NULL-sentinel dependency was demonstrated. Use a second forward migration because
the helper migration is already applied on E2E; never rewrite that recorded migration.
Not authorized: historical migration edits, broad policy rewrites, grants expansion,
Production database access/mutation, manual deployment and Vercel configuration changes.
The owner subsequently authorized commit/PR and merge after required checks PASS,
including Vercel's automatic application deployment; this grants no Production DB authority.

## UI -> Contract Reconciliation

No UI changes. Existing authenticated callers receive an active canonical profile or
null. Invalid identities do not receive placeholder or cached authority.

## Additive Migration Plan

Forward-only CREATE OR REPLACE of get_auth_tenant_id(), is_admin(), is_hr(),
is_accountant(), is_hq_admin(), is_hq_super_admin(); preserve signatures, owners and ACLs.
No new tables, indexes or grants. Existing exact-role semantics remain. Add exactly
two authenticated HQ policies on public.tenants; require live active HQ admin in both
UPDATE USING and WITH CHECK. Preserve every existing policy and AutoMove boundary.
Invalid/missing identity or inactive/missing tenant raises SQLSTATE 42501 from the tenant
helper: returning NULL would activate existing legacy NULL-as-HQ policy bypasses.
Boolean role/HQ helpers return false for invalid authority. Security-definer helpers use
qualified objects and a fixed search_path. Rehearse with rollback before durable E2E apply.

## Eleven Verification Gates

1. Diff scope and frozen-artifact guard.
2. Migration syntax, safety, forward history and repeatability.
3. Helper signature/owner/ACL preservation; unrelated policies unchanged.
4. Active Auth actor with matching active profile and tenant allowed.
5. Missing identity/profile/tenant and inactive actor denied at runtime.
6. Suspended/terminated tenant denied; reactivation works.
7. Real tenant ID and cross-tenant RLS with stale JWT metadata ignored.
8. HQ product_key vs misleading tenant name; non-admin and non-HQ denied.
9. Fresh application authority despite stale Redis/JWT and role/tenant changes.
10. Focused unit/regression, strict typecheck, lint and Architecture Guard.
11. Non-Production Real DB and real Auth/application checks with fixture cleanup;
    report local/E2E evidence separately from main, release and Go-Live.

## Status

IMPLEMENTATION = IMPLEMENTED_LOCAL_VERIFIED_ON_E2E
IDENTITY_HELPER_AND_APP_BASELINE = PROVEN_FOR_TESTED_SCOPE_ON_E2E
MAIN_SEAL = NOT_PERFORMED
COMMIT_PUSH_PR = AUTHORIZED_FOR_DELIVERY
FINAL_REVIEW = PASS_AFTER_P2_FIX
EVIDENCE_RECONCILIATION = VERIFIED_READ_ONLY
CLEANUP = PARTIAL_ACCEPTED_RETAINED_SHELLS
NEXT_ACTION = PR_CI_MERGE_AND_MAIN_VERIFICATION
PRODUCTION_MUTATION = NOT_AUTHORIZED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY
GO_LIVE = NOT_PROVEN

## Executed Evidence (2026-10-15)

- Baseline: main 84a492485521ff001df3a9cebb7715cfcf32e680, isolated branch
  codex/platform-identity-hq-alignment. No changes to #336 artifacts.
- 20261015040000 and 20261015040100 applied only to authorized E2E
  bmnbqbcdbuklhopfbopv using the existing E2E applier, verified TLS and transactions.
  Migration history was recorded by that applier, not by manual history repair.
- Helper/HQ rollback rehearsal: 58 assertions PASS, repeated migration application,
  unchanged helper signatures/owners/ACLs, unchanged table grants and all policies
  except the two approved public.tenants policies; zero rollback fixtures remain.
- Exact scoped CI command executed locally: durable verifier 59 assertions PASS,
  then real Auth -> getCurrentUser()/checkHqAuth() -> PostgREST/RLS PASS. Signed JWT
  and session remain unchanged while live role, membership and status change.
  This uses the real Auth and public client; only Next's cookie/client adapter and
  Redis are substituted. It is not full Next.js browser or release-candidate proof.
- Active/non-active actors, missing profiles/tenants, suspended/terminated tenants,
  stale JWT/Redis, exact role checks, HQ product_key vs tenant name, cross-tenant
  AutoMove denial and explicit HQ tenant SELECT/UPDATE were observed at runtime.
- Unit/regression run: 104 PASS, 3 existing skips, 1 pre-existing HQ layout source
  guard failure. The failed guard expects overflow-hidden in HqBranchFilters.tsx;
  git show of the baseline confirms it was already absent and neither UI file nor
  guard was changed. Do not label this aggregate run fully PASS.
- Strict full TypeScript: zero diagnostics. ESLint and Architecture Guard PASS.
  Zero-downtime migration check PASS for both forward migrations. git diff --check
  PASS. Ordinary CLI migration check was blocked by missing project link; the
  canonical drift analyzer was instead run against read-only E2E PG history:
  no new pending/remote-only versions, 426 grandfathered pending baseline versions.
  No bulk sync was attempted.

## Fixture Cleanup Boundary

The owner approved retaining fixed test tenants because public.timeline_events has
append-only rules that prevent the tenant FK cascade even for empty tenants. Do not
disable that rule, constraints or replication triggers to obtain a green cleanup.

- Real Auth tests reuse two fixed tenant shells; serialize reuse with an advisory
  lock. Remove all test Auth/public.users identities and suspend both shells.
- Two additional empty shells were created by the initial failed cleanup attempts;
  their actor fixtures were removed and both shells suspended. They remain E2E
  maintenance residue, not zero-fixture proof. Future runs create no new shells.
- SQL verifier fixtures are transaction-rollback clean. HTTP fixture cleanup is
  explicit and retains the four suspended shells above; immutable audit history
  is preserved. These are separate cleanup claims.

## Closure Boundary

Local/E2E scoped proof at this checkpoint; PR/main proof must be verified during
authorized delivery. No Production database access, Vercel configuration action,
business-chain rerun or AutoMove Go-Live assertion. Broader HQ cross-
tenant reporting contracts are not proven or modified by the public.tenants exception.

## Evidence / Cleanup Reconciliation (2026-10-15)

This follow-up performed read-only E2E inspection and Git/source comparison only.
The 59-assertion and real Auth PASS results above are the previously executed proof,
not a claim that those suites were rerun during reconciliation.

- PostgreSQL transaction_read_only = on; connection restricted to E2E project
  bmnbqbcdbuklhopfbopv with certificate verification. No Production connection.
- Both migration versions/names are present in E2E history. The two new HQ policies
  exist only on public.tenants, TO authenticated, SELECT/UPDATE only; UPDATE has
  is_hq_super_admin() in both USING and WITH CHECK. No GRANT statements or policies
  for another table occur in these migrations. Existing auto_* policies contain no
  is_hq helper predicates; the earlier runtime proof separately checks AutoMove lead
  SELECT and cross-tenant UPDATE denial. Do not generalize that to every Product flow.
- All four retained shells are suspended:
  - 3a2e462c-5f7a-441c-8b28-3a3752c37d95: reusable AutoMove test shell.
  - 064994d5-d50c-4322-afa6-5b53ecf270a9: reusable HQ test shell.
  - 26ca245b-1b6a-492b-899d-a77355603dc2: initial failed-run AutoMove shell.
  - 99f57cc2-0f2b-409e-a7ab-2617d17d13b8: initial failed-run HQ shell.
- Zero public.users rows refer to these tenants. Zero Auth fixture-email matches
  and zero Auth app/user metadata tenant links remain.
- Count-only inspection of 236 base-table tenant-reference columns (tenant_id,
  *_tenant_id and all direct FK columns referencing public.tenants) found no business
  rows for these IDs. The only nonzero references were 60 public.audit_logs rows:
  tenants INSERT 4 / UPDATE 31; users INSERT 5 / UPDATE 20. record_id and old/new
  tenant JSON references were also checked. No timeline_events rows refer to them.
  This is relational/known-audit-reference coverage, not an arbitrary JSON/text scan.
- timeline_events_no_delete and timeline_events_no_update remain DO INSTEAD NOTHING.
  No attempt was made to delete shells, disable rules/FKs or alter replication mode.
- The HQ layout failure is independently present at baseline
  84a492485521ff001df3a9cebb7715cfcf32e680; its component and guard have no diff.
  Regression remains PASS_WITH_BASELINE_FAILURE, not unqualified PASS.
- Exactly 11 intended batch files were identified. The pre-existing untracked
  .cache/automove-handover directory is excluded and untouched. Historical migrations,
  #336 artifacts, kernels, ProductRegistry and Vercel configuration have no batch diff.

Migration SHA-256 fingerprints:

- 20261015040000: 1e75e3f25d24814ca0e2f3f31e80447b091d34a53c1c7f2c5fd12e96d208c108
- 20261015040100: fa50ead7cadc449fa0f05359e9f222b2996323bfb0775d595a8796ed4533413c

Evidence is reconciled for final review with the explicit partial-cleanup exception.
The later delivery instruction authorizes commit/PR/CI/merge, but does not establish
CI/main proof or seal the batch before the corresponding results exist.

## Independent Final Review

- Blind Hunter and Edge Case Hunter: no actionable security/contract findings.
- Acceptance Auditor: one P2 fixture isolation defect. A session advisory lock is
  unsafe over transaction pooling (port 6543), which the shared connection validator
  otherwise permits. E2E uses that port. The verifier now holds an advisory transaction
  lock in a dedicated connection/transaction until cleanup completes, independent of
  the fixture connection's commits. A focused test checks the lock acquisition contract.
  No endpoint, credentials, shared connection validator or DB schema was changed.
- No business runtime, migration, grant or policy changes resulted from the review.
- Acceptance Auditor independently confirmed the P2 fix resolved. Focused integration
  now passes 2/2 tests, including a competing Real DB transaction unable to acquire
  the held fixture lock. Strict TypeScript and scoped lint pass after the repair.
- Existing audit records are preserved. Subsequent authorized CI fixture execution
  can append audit history; 60 records is the reconciliation snapshot, not a fixed
  count to enforce by deleting later history. Cleanup remains PARTIAL.

## PR #337 CI Follow-up

- Initial reviewed implementation: 11 files, commit 8abe895d091d264710ebf356e10005fda847b570.
- Real DB CI run 38714109255 / job 116352565579: durable verifier 59 assertions
  PASS and real Auth/application integration 2/2 PASS; both E2E migrations already
  recorded. This is PR CI proof, not main proof.
- Affected-test CI exposed three stale dependent fixtures: consolidated P&L lacked
  an active HQ tenant; the suspended-tenant test expected an authorized profile;
  booking fixtures lacked active user/tenant states, cascading into a pre-existing
  unmocked fallback path. Only fixtures/assertions were aligned with the approved
  fail-closed contract. The three focused suites pass 27/27; no runtime or fallback
  query was changed, no skip/exclusion added, no layout baseline fix attempted.
- Delivery therefore adds exactly three dependent test files to the original
  11-file batch. No new business capability, schema or policy scope is introduced.
