---
status: controlled-production-release-withdrawn-smoke-login-not-proven
baseline_commit: bbe57b5500ea5c4c9be6542d93f3497aa1482e53
---

# AutoMove Business-Chain Verification

## Controlled Production Runtime Authority - 2026-10-16

Process gate: PASS for the owner's explicit approval of controlled Production
runtime activation and operational verification. This supersedes the historical
runtime prohibition below only for this scope. Single-agent execution; existing
business-chain seals and migrations are not reopened. Backup remains deferred
under the recorded owner exception; no backup work or expenditure authorized.

Production schema/security adoption of SHA-256
a5e574c6985924d41436c2b05ff1ea9ffc45530861302b60f9ff8687a2e22f23
committed through canonical BDGF in run 38875771934. Retain its original CI FAIL
caused by reporting after commit. Independent read-only postcheck at
2026-10-16T08:52:10.258Z passed the frozen final assertions, exact metadata
comparison, canonical approval integrity and one consumed token. Do NOT replay
DDL, issue a second token or repair migration history. PR #343 independently
merged as 2f760b7eb836b7f0beb74ae2ba5833e3895c283e.

Product manifest/ownership: enable only the existing AutoMove HTTP connection
boundary and its seven consumers. AutoMove owns runtime configuration; current
Auth, Platform identity, tenant/RLS, Mobility and Accounting public contracts
continue to own their existing invariants. No kernel, helper, policy/grant,
ProductRegistry, Finance posting, Warranty or commission changes.

Contract/UI reconciliation: unchanged dashboard -> authenticated AutoMove API ->
existing service -> public Mobility/Accounting contracts and tenant-bound SQL.
No new UI controls or domain behavior. Server-only AUTOMOVE_DATABASE_URL is
separate from shared DB settings; it cannot enable another product's SQL path.
Production additionally requires VERCEL_ENV=production and exact server flag
AUTOMOVE_PRODUCTION_RUNTIME=enabled. Missing/changed flag fails closed before
connecting; URL matching and CA/hostname verification remain mandatory. Preview
and local processes cannot opt into Production even with the flag.

Migration plan: NONE. Approved changes are this configuration guard, exact
AutoMove environment variables, one reviewed application release, read-only
authenticated operational smoke and a known-good deployment stop path. Do not
create Production test actors, sales/receipts, financial fixtures or change real
business records to manufacture smoke-test proof. If no authorized operating
identity exists, do not invent one or elevate a role.

Eleven focused gates: (1) exact baseline/release SHA; (2) code scope/no DDL;
(3) default-closed and re-disabled flag; (4) Production-only environment/project;
(5) strict DB URL/TLS and dedicated credential binding; (6) unchanged Auth and
active tenant authorization; (7) existing HTTP transaction/RLS regressions;
(8) focused typecheck/lint/Architecture Guard; (9) exact PR CI and build;
(10) deployment SHA/domain and authenticated read-only operational results;
(11) known-good closed-guard deployment/stop command and sanitized evidence.
Only affected tests run locally; existing full-chain Real DB/browser proof is
reused. A deployment or unauthorized 401 alone is not operational PASS.

Stop plan: record the current READY closed-guard deployment before any release.
Keep activation off until checks PASS; if operational verification fails, remove
the Production activation flag and immediately roll application aliases back to
that closed-guard deployment without reverting DB objects or financial history.
Environment changes apply to new deployments, not existing instances, so changing
the flag alone is NOT an immediate stop. Preserve the old deployment for rollback.
If verification lacks a valid actor or exposes a real failure, leave runtime
closed/rolled back and report the exact boundary, not GO_LIVE PASS.

Baseline stop deployment: dpl_EnDqBpKPJitRfpu28ZCsCx6tqWmA,
source bbe57b5500ea5c4c9be6542d93f3497aa1482e53; READY at preflight.
Implementation and live release results remain PENDING until executed.
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY; GO_LIVE = NOT_PROVEN.

### Runtime Local Verification

Eight existing guard/HTTP suites: 94/94 PASS, no skip. Four offline smoke safety
tests PASS. Full strict tsc --noEmit --strict --incremental false, focused ESLint
and Architecture Guard PASS. Review found no DB migration, grant/role/helper or
domain invariant change. The owner confirmed use of the existing secrets
PRODUCTION_E2E_ADMIN_EMAIL/PASSWORD for the read-only operating identity; do not
create/elevate an actor if that identity fails current authority checks.

The manual main-only Production smoke uses ephemeral real-browser login, then
requires an authenticated BOOKING_NOT_FOUND from a fresh nonexistent UUID to
prove the SQL/actor/tenant path (generic 404/401/403/503 do not qualify). It reads
the canonical report and dashboard, never creates a sale, receipt or snapshot.
Its exact expected SHA must match the dispatched main SHA. Only sanitized
status/provenance is retained: no session files, credentials, identities, raw
business responses or screenshots. This is scoped operational read proof, not a
Production financial-write E2E or an automatic Go-Live declaration.

### Controlled Runtime Attempt and Safe Stop

PR #346 merged as 4fd2c73f3e099f231a07aab931f4837fedb51437 after all required
PR checks passed. Source tree equals tested head ed061b9fba3ea1c3a3fcee7af4ec0ca1cab6d792.
The first build failed in unchanged next/font; rerun passed without source change.
The first Real DB attempt hit serialization during parallel RC verification;
isolated rerun passed with unchanged assertions. These initial failures remain
historical failures, not clean first-attempt proof.

Exactly two AutoMove-only Production variables were configured. Vercel deployment
dpl_3YAjNnsJsi5dU3PaQL1oc7V5urpS reached READY on the exact merge SHA and the
public alias matched. No migration, grants/roles, business records or historical
adoption evidence was changed.

Actual Production smoke run 38888043099 FAILED at REAL_LOGIN between
2026-10-16T10:34:56.407Z and 10:35:45.802Z. Unauthenticated API denial was 401;
no authenticated SQL, financial report or dashboard proof was reached. The
sanitized artifact does not establish whether credentials, MFA or redirect caused
the login failure. Do not claim a password or role defect without evidence.

The stop plan was executed immediately: future runtime flag set to disabled,
public aliases rolled back to dpl_EnDqBpKPJitRfpu28ZCsCx6tqWmA and only the
failed release deployment was retired so its direct URL no longer runs code.
Independent alias read-back matched the closed-guard deployment and the retired
URL returned 404. No DB rollback, trigger bypass or deletion of financial data.
Sensitive flag-value API metadata does not expose plaintext; CLI write receipt
is retained, not mislabeled as plaintext read-back. Closed source deployment is
the independently verified current runtime stop.

Owner is checking the two existing Production E2E login secrets. No actor, role,
MFA setting or auth bypass was created/changed; no automatic reactivation while
waiting. Main's eight other workflows passed; Quality Gates subsequently passed
on isolated rerun after the first serialization failure. This is not Production
operational or Go-Live PASS. Evidence is in the existing local runtime
release-evidence.json and smoke-38888043099/evidence.json packet.

RUNTIME_PRODUCTION = CLOSED_AFTER_FAILED_LOGIN_SMOKE
PRODUCTION_OPERATIONAL_VERIFICATION = NOT_PROVEN
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY
GO_LIVE = NOT_PROVEN

### Reuse Proven Production Auth Smoke - 2026-10-16

Process gate: PASS for the owner's request to recover Bella's previously working
smoke path. Scope is test harness/workflow only; keep Production runtime disabled,
no migrations, business writes, identity changes or new approval gates. Reuse
the existing auth fixture's real-credential helper and context settings rather
than duplicating login. Exporting these existing test helpers does not change
their behavior or the application auth contract.

Historical evidence was refreshed live: run 37237569628 on db9a28c00e8a024cde02834d2d26185f980e46de
passed all 17 authenticated smoke cases on 2026-10-04. The two Production secrets
were last updated earlier that day and remain unchanged. Run 37944272985 later
reached authenticated Hospitality UI assertions; its failure was the mutation
collector, not a reported login failure. These are historical scope/provenance,
not current AutoMove or current credential PASS. Current main Quality Gates at
4fd2c73f3e099f231a07aab931f4837fedb51437 subsequently passed on isolated rerun.

The new bespoke runner omitted fixture page-load settling and context/protection
settings. That is a verified implementation difference, NOT proof that hydration
or credentials caused the failed login. Correct the harness to reuse the proven
path, then run auth-only with guard closed. Require real Auth and the actual
authenticated AUTOMOVE_RUNTIME_DISABLED response; do not count HTTP 200, a generic
503, an MFA prompt, skip or a different account as successful AutoMove access.
Retain sanitized response status/login-stage evidence, never credentials,
cookies, token responses, screenshots or raw user/profile data.

Ownership/contract/manifest: test helper exports, current AutoMove smoke script,
focused unit tests and its existing manual workflow. No UI/domain/Platform helper
change. Migration plan NONE; default workflow mode auth-only. Full mode preserves
all existing accountant/SQL/report/dashboard assertions and still needs the
approved controlled activation path. No credential fallback or dev mock path.
Verification: pure safety tests, real-login helper focused regression, lint,
strict typecheck and diff-check; existing business/Real DB seals reused. Actual
auth-only run must pass at exact main SHA before any further activation.

Executed local harness verification: 7/7 safety/helper tests PASS, full strict
typecheck PASS, focused ESLint and diff-check PASS. No application/runtime,
migration, grant or identity implementation changed in this correction. Reuse
the earlier architecture/business-chain evidence; do not rerun unrelated suites.

## Historical Checkpoints

Current checkpoint: RC #341 is already merged; the draft/local RC evidence below
is historical, not a current CI wait. Live GitHub metadata confirms RC Browser CI
success on PR head d7c1780e36f691ea1c289fe1143c1880059b20a4 (run 38832452302)
and main c9b4d2a1a61a539a18c27089438b552b9f74c0ad (run 38835173062).
The current unsealed work is the separate BDGF owner-DDL Non-Production rehearsal.
No business-chain workflow was rerun to establish this metadata correction.
That owner-DDL route is now PROVEN_NON_PRODUCTION_BY_CI at b6e29da2937c830aa1c0f313b59b1788e212d3ec
(run 38862036244). Earlier local NOT_PROVEN entries below describe the preceding
preparation phases, not the current E2E governance state. Production remains held.

## RC Business-Chain Authority - 2026-10-16

Process gate: PASS for AUTOMOVE_RC_BUSINESS_CHAIN_VERIFICATION, explicitly
approved by the owner after #339/#340 seals. Baseline main is
3356a04d15b021c5098512739bc5b3676922ce3b. Single agent, branch
codex/automove-rc-business-chain. Existing seals are not reopened.

Manifest: verification of the release build, not new product behavior. Build the
exact checked-out candidate with next build; launch next start, real Auth and
canonical E2E DB only. Record candidate SHA, build ID, environment and actual test
counts. Missing credentials, build/start failure, skip or partial chain cannot
be PASS. No reuse of a previously running server or stale build.

Ownership/contract: AutoMove owns its API/UI/financial records, Mobility owns
allocation/handover, Accounting owns the existing public period guard; tests
consume the already-approved public contracts. Supabase Auth -> active
public.users/accountant -> active same tenant remains authoritative. No runtime,
Platform helper, Finance, kernel, registry or business-rule change authorized.

Change authority: existing Browser spec extension, test-only continuation,
production-mode test configuration, supervised build/start runner, scoped CI and
this checkpoint. UI reconciliation is verification-only: actual dashboard/API
commands create booking, receipts, approved snapshot, evidence and recognition;
read back real DB after each milestone. Customer/catalog/vehicle/Auth and OPEN
period are explicit Non-Production setup fixtures, not claimed UI creation.
Migration plan: NONE. Do not alter schemas, migrate Production or remove the
Production rejection in AutoMoveSaleChainConnection.ts.

Business test contract: reuse owner-approved amounts (1.4B recognized sale, 1B
cost, 100M deposit, 1.3B later receipts). After full collection, document price
delta -100M and cost delta +50M, then manually refund 100M against an original
receipt. Documented delivered cancellation does not return the vehicle, refund
more money or reverse revenue. Explicit full reversal remains a separate command
in OPEN source/current periods. Refund remaining original receipts separately;
verify net cash/revenue/outstanding zero without changing original records.
These operations are allowed by the sealed contracts; no invented fee, forfeiture
or period reopening. A forbidden transition is a blocker, not an assertion to
weaken. Test retries use original intent/key; cross-tenant/inactive/suspended
denials remain required. No Finance posting, commission or Warranty scope.

Eleven gates: (1) exact SHA/clean build inputs; (2) next build/start provenance;
(3) Non-Production target and TLS; (4) real authenticated UI chain; (5) tenant/RLS
and active authority; (6) snapshot/evidence/policy read-back; (7) receipt totals
and idempotency; (8) documented independent compensation and OPEN periods;
(9) immutable originals/dashboard reconciliation; (10) cleanup and evidence
integrity; (11) focused regression/typecheck/lint/Architecture Guard and actual
Browser CI on exact PR SHA. Existing unaffected Real DB proof is reused.

Acceptance: Given canonical E2E and the exact candidate, a fresh production-mode
build must execute the whole applicable chain on the same booking, preserve
original receipts/snapshot/recognition, deny unauthorized requests and read back
the expected final balances after reload. Given wrong target/SHA/dirty build or
any failed/skipped test, the runner fails closed and terminates its own server.
Only fixture-owned periods may be closed during cleanup; immutable history and
archived tenant shells remain PARTIAL cleanup, never deleted through a bypass.

Commit/push/PR/CI are allowed for this batch; merge and Production deployment
are not authorized. Production runtime activation, DB/schema adoption and
restore/rollback evidence remain separate. Full readiness stays NOT_READY.

### RC Executed Evidence - 2026-10-16

Candidate 95e0ac6204b94acca6dd523a159d1c3bd842db81: fresh next build --webpack
and next start PASS; build ID GBWL-U2d5ZhgyPH3IgiNN. Main runtime source remains
unchanged from 3356a04d1; only verification/CI/checkpoint files changed.
Runner records SHA, build manifest hash, canonical E2E project and test counts.
Health verifies production-mode process against Non-Production DB, not a
Production deployment. No pre-existing server or stale build accepted.

Actual Browser: 1/1 PASS, zero skipped/flaky/unexpected, 3.6 minutes. Same
UI-created booking/recognition across allocation, deposit, approved snapshot,
persisted handover, explicit recognition, full collection, receipt read-back,
dashboard, stale-Auth cross-tenant/inactive/suspended denials, then documented
price -100M/cost +50M deltas, 100M receipt-linked refund, independent delivered
cancellation, explicit full reversal and remaining receipt-linked refunds.
Final sale/cash/outstanding are zero, reconciliation MATCHED; original financial
snapshot/recognition/deposit/payment rows unchanged and vehicle still delivered.
Lost acknowledgement, concurrent receipt requests and same-intent replay passed.
No financial records were inserted to shortcut the chain; customer/catalog/vehicle,
Auth profiles and the isolated OPEN period are explicit setup fixtures. The
negative completed-without-recognition booking is a denial fixture, not revenue.

Initial candidate 289c90747 reached reversal but failed its retry HTTP request at
the Browser default 15-second timeout: NOT_PROVEN, not a PASS. The RC-only test
timeout was aligned to 60 seconds (existing transactional API bounds retained),
then a fresh committed candidate was built and the entire test rerun. No runtime
change or automatic test retries were introduced.

13 runner safety regressions PASS; strict TypeScript for 6 roots/dependencies has
zero diagnostics; changed-file ESLint, Architecture Guard, workflow YAML parse and
diff-check PASS. Desktop/mobile screenshot evidence retained locally; 390px dialog
horizontal bounds asserted. Sanitized artifacts live under .cache/automove-rc and
are not committed. CI is configured to build/test the exact PR head or main SHA,
publish sanitized evidence, fail on absent credentials/build/test/skip, and never
deploy or run migrations. Remote execution remains pending, not Browser CI PASS.

Cleanup PARTIAL: Auth removed, active actor zero, Storage documents zero, two
tenant shells terminated with read-back; original append-only history retained.
Fixture period closed in cleanup; no period, FK, RLS or append-only bypass.

`RC_BUSINESS_CHAIN = PROVEN_LOCAL_NON_PRODUCTION_PENDING_CI`
`RC_BROWSER_ON_MAIN = NOT_PROVEN`
`PRODUCTION_RUNTIME_ACTIVATION = NOT_AUTHORIZED`
`PRODUCTION_SCHEMA_CONFIG_ADOPTION = NOT_PROVEN`
`RECOVERY_READINESS = NOT_PROVEN`
`AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`
`GO_LIVE = NOT_PROVEN`

## 2026-10-16: BDGF TLS and Production delta preparation

Pre-code scope decision: PASS_FOR_SCOPED_PREPARATION_ONLY. This extends the
existing checkpoint, not a new deployment gate or business capability. Reuse
business-chain proof #339-#341 on baseline c9b4d2a1a61a539a18c27089438b552b9f74c0ad.

Manifest/scope: correct certificate verification in the BDGF wrapper/executor
connection path and prepare the exact AutoMove adoption delta. No new product,
schema execution, Production configuration, runtime enablement, backup or cost.

Ownership: Platform/BDGF owns execution transport, approval and gate tokens;
Mobility owns its public vehicle contract; AutoMove owns its sale evidence and
receipts; Platform owns identity/HQ. Do not import a Product service into BDGF.
Dependency map: migration caller -> approved BDGF wrapper -> approval/token
contract -> isolated executor -> pg with verified TLS. Product -> Mobility and
Accounting contracts remain unchanged. No frozen kernel or ProductRegistry edit.

Initial transport authority: user authorized the two transport callers, a small shared
connection configuration helper and focused tests, plus this preparation packet.
No change to approval invariants, token consumption or accounting rules. UI to
contract reconciliation: N/A, no UI change. Additive migration plan: NONE written
or executed; a needed catalog/ACL adoption delta is specified for later approval.

Security test contract (source: approved requirement to verify certificates,
not current insecure implementation): a trusted server with matching hostname
can connect; untrusted certificates and wrong hostnames fail before SQL; URL
parameters cannot disable verification, redirect the validated host or load TLS
files. Credentials and raw URLs must not appear in validation errors. Given no
valid approval/token, transport repair never permits migration execution.

The helper removes duplicated regex URL parsing from exactly two callers, uses
the existing structured pg-connection-string parser, pins rejectUnauthorized=true
and hostname verification, and never forwards connectionString to pg to overwrite
the verified configuration. Use bundled public Supabase CA plus normal Node roots;
do not weaken verification to satisfy tests or support arbitrary URL overrides.

Eleven verification checks: (1) scope/ownership diff; (2) structured URL parsing;
(3) TLS downgrade/override rejection; (4) actual trusted local TLS handshake;
(5) untrusted and hostname-mismatch handshake failures; (6) wrapper/executor wiring
and unchanged authorization ordering; (7) existing offline BDGF guard regressions;
(8) scoped syntax/lint; (9) Architecture Guard; (10) whitespace and secret/scope
review; (11) read-only E2E TLS smoke if available, otherwise NOT_PROVEN. No
Production handshake/mutation or re-run of sealed business tests is required.

Backup/recovery remains DEFERRED_PENDING_BUDGET. The owner's subsequent scoped
backup exception is recorded below; package-specific execution bindings remain
pending. This preparation is not a completed Production execution approval.
Production schema/security NOT_READY; runtime guard HELD; Go-Live NOT_PROVEN.

### Initial transport result (before the prerequisite extension below)

Initial phase status: IMPLEMENTED_LOCAL_VERIFIED, NOT_COMMITTED, NOT_ON_MAIN.
That phase repaired wrapper/executor transport, not all historical BDGF utilities;
the subsequent prerequisite extension below adds the reachable approval callers.
The helper stays Platform/BDGF-local; the AutoMove runtime guard and
Product/Mobility/Accounting code are unchanged. No workflow was added.

Executed evidence:

- `node --test scripts/bdgf/database-connection.test.mjs`: 37/37 PASS, zero skips.
  Includes actual trusted/untrusted/hostname-mismatch TLS handshakes, rejection
  of query-driven TLS/host/file overrides and weak PGSSLMODE not overriding pg's
  explicit TLS options. Synthetic fixture keys are generated temporarily and
  deleted after validating that cleanup stays inside the named temp directory.
- Existing offline BDGF suites: owner authority 19/19, Production workflow
  12/12 and workshop closure 12/12 PASS; total 80 focused tests including TLS.
  The first workshop invocation was 11/12 due to Windows CRLF on an unchanged
  hashed migration; Git blob bytes matched the approved hash. Restoring only
  that clean working file to exact LF Git bytes made the same command pass.
  No migration content or expected hash was changed and no migration was run.
  Native checkout line endings were restored afterward; the historical file has
  no final diff. The hash-bound suite must run against exact Git bytes in CI.
- Syntax checks for all four JS files, scoped ESLint and Architecture Guard PASS.
  ESLint emitted the existing config-format warning about .eslintignore; no
  scoped lint violations. No full-repository typecheck is claimed for JS-only
  tooling; unchanged business test suites #339-#341 were not repeated.
  Single-agent scoped diff review found no remaining blocker in the TLS patch;
  no independent multi-agent review, remote CI or main seal is claimed.
- Real E2E read-only pg connection using the new helper: certificate authorized,
  default hostname validation, transaction_read_only=on, SELECT 1 and ROLLBACK.
  No mutation or fixture provisioning. This is transport evidence, not an
  authorized migration-execution or post-deployment proof.

### Authorized prerequisite implementation - 2026-10-16

The user authorizes completing catalog/ACL and governed execution prerequisites
locally and on Non-Production, not Production adoption or runtime enablement.
Reuse this gate; no new approval tier, business feature or backup work.

Ownership/manifest: exactly auto_brands/models/variants for the forward read-only
ACL correction; BDGF owns approval creation/verification, token and execution
transport. No ProductRegistry, shared identity helper, kernel or UI change.
Contract dependency remains caller -> approval -> gate token -> executor -> pg;
the current database principal must equal the token-bound executor, never an
implicitly substituted administrator. UI reconciliation is N/A.

Minimal additive plan: one new forward catalog migration, no historical edit.
Preserve table ownership/service-role grants; revoke inappropriate table/column
writes and dangerous rights only from PUBLIC/anon/authenticated on these three
tables. Supply explicit active, same-tenant permissive and restrictive SELECT
policies; reject inherited privileges that remain outside the contract.

Verification contract: rollback rehearsal must reproduce the catalog's empty
policy/broad-ACL baseline, prove the historical migration rejects it, then prove
the forward delta and historical read guard compose safely and are retryable.
Read exact fixture rows for two tenants; deny invalid/inactive/suspended actors,
forged claims, HQ bypass, anon and writes. Rollback restores security metadata
and fixtures. BDGF TLS tests cover all four reachable database callers; role
mismatch blocks before token issuance/consumption or DDL. Preserve hash/schema/
environment/identity/single-use token checks and transaction rollback ordering.

Reuse the eleven scoped checks above, adding only affected approval/identity
tests and the catalog rollback verifier. Do not bootstrap BDGF roles/tables,
transfer owners or grant owner membership as a test shortcut. E2E read-only
metadata found no bella_migration_executor, bella_migration_approval or
bella_gate_tokens; full governed Real DB execution remains NOT_PROVEN unless
an existing authorized environment can supply these contracts.

Pre-code decision: PASS_FOR_NON_PRODUCTION_PREREQUISITE_IMPLEMENTATION_ONLY.

### Initial local prerequisite evidence (before the owner rehearsal)

Status: IMPLEMENTED_LOCAL_VERIFIED_FOR_CATALOG_AND_TRANSPORT;
GOVERNED_DDL_REAL_DB_PATH = NOT_PROVEN. No commit, PR or Production operation.

Catalog forward delta:

- New file: 20261016010000_align_automove_catalog_read_acl.sql; current LF-byte
  SHA-256 4b87b19444ef4b5f788278c94d8709983d94fe991674e48b9fcdc091fa83750e.
  This is a local input hash, not a final approved release-bundle hash.
- Exactly auto_brands/models/variants: validate existing table/RLS/uuid tenant
  shape and owner authority before DDL; revoke PUBLIC/anon/authenticated writes
  and dangerous table/column rights; grant authenticated SELECT. Both permissive
  and restrictive reads require canonical active actor/tenant match. No NULL/HQ
  bypass, owner transfer, shared helper or service-role grant edit.
- `verify-automove-catalog-reads.ts --test-adoption-delta` PASS on the authorized
  E2E project using verified TLS. In one rollback transaction it reproduces the
  observed empty-policy/broad-ACL baseline, proves the historical guard refuses
  it, proves non-owner refusal, applies/retries the forward delta and historical
  guard, then checks actual rows for two tenants, inactive/missing/suspended/
  terminated identity, forged tenant claims, HQ isolation, anon and write denial.
  Final metadata fingerprints and fixture checks confirm clean rollback.
- Historical SQL files and history are unchanged. Production adoption must apply
  this dependency before the historical catalog guard, in the approved atomic
  package; this is not permission for sorted blanket migration replay or manual
  history recording. E2E was not durably changed by this rehearsal.

Governed execution preparation:

- Approval creation, verifyApproval, wrapper and executor now all consume the
  same strict CA/hostname configuration. No insecure regex URL parser or
  rejectUnauthorized=false remains in these four callers. Other historical
  utilities are outside this path and are not certified by this result.
- Wrapper checks actual current_user AND session_user against its executor
  identity before token issuance. Executor repeats the check before token
  validation/consumption. A privileged fallback or SET ROLE session cannot silently
  masquerade as the approved executor. No database role/owner grants were made.
- 72 focused tests PASS with zero skips: TLS/identity 45, actual approval/token/
  executor function paths against an explicitly unit-only database double 8,
  owner-authority regression 19. Binding tests reject hash/environment/schema/
  identity mismatches and reused tokens; failed DDL rolls back without reviving
  the consumed token. These unit tests do NOT prove real DDL privileges or DB
  concurrency. No token contract, signature algorithm or single-use SQL changed.
- Separate actual E2E READ ONLY connection through the new BDGF TLS helper
  confirms certificate authorization and rejects postgres impersonating the
  bella_migration_executor identity. No token/approval/DDL was written there.
- Scoped lint and nine JS syntax checks PASS; Architecture Guard PASS; zero-
  downtime check PASS for the one new migration; git diff --check PASS.
  `npm run typecheck:changed` selected its full strict fallback and completed with
  zero diagnostics. Existing sealed business suites were not repeated. ESLint's
  existing .eslintignore configuration-format warning remains unrelated.

Blockers observed at the end of that local phase, before owner rehearsal:

1. E2E has no bella_migration_executor, bella_migration_approval or
   bella_gate_tokens. Do not create imitation governance fixtures or grant broad
   roles to turn the end-to-end result into PASS.
2. The previously inspected Production executor cannot inherit/SET the owners
   postgres/supabase_storage_admin for the existing objects. TLS/BYPASSRLS/CREATE
   on public cannot supply ALTER/POLICY/function-replacement ownership. Neither
   this migration nor a string executor_identity grants that authority.
3. The next deployment step needs an explicitly scoped governed owner-authority
   route for the listed public/storage objects, first rehearsed in an authorized
   environment with the actual BDGF schema/role. Preserve token bindings and final
   transaction states; no silent admin URL substitution, broad owner membership,
   owner transfer, fake history or relabeling storage SQL as public-only.

Until that existing execution infrastructure or a specifically authorized narrow
owner route is available, stop before issuing an adoption token or running the
package. Catalog/RLS proof and verified transport are not full adoption proof.
Backup exception remains recorded; runtime guard and Production stay unchanged.

Ownership-route clarification from Non-Production READ ONLY metadata: public
targets are owned by postgres; storage.objects/buckets remain owned by
supabase_storage_admin, with no inherited/SET membership for postgres. However,
the current E2E supautils.policy_grants explicitly delegates policy management
on those two Storage tables to postgres. Membership checks alone therefore do
not prove that postgres cannot manage Storage policies. Supabase's existing
supautils contract supports this narrow policy delegation without owner transfer:
https://github.com/supabase/supautils#table-ownership-bypass

This is a candidate existing owner-operated route, not actual DDL proof and not
evidence of the Production configuration. Do not replace the configured executor
or grant privileges automatically. Rehearsal under an explicitly declared
postgres executor requires the owner's scoped authorization and the actual
canonical BDGF approval/token infrastructure; preserve hash, principal and
transaction binding. No new execution framework, backup task or runtime change.

The owner subsequently authorized this explicit postgres owner-operated
Non-Production rehearsal, plus commit/push/PR and real CI; merge and Production
remain forbidden. Reuse the existing wrapper, owner-authority resolver and
approval/token contract. Instantiate only its missing canonical approval/token
tables on the pinned E2E project, deny application access, and retain execution
records. No new DB role, membership, owner transfer or copied Production data.
The legacy deploy-schema.sql is not a compatible substitute for these contracts.
Bind fixed rehearsal SQL to its source SHA/hash and verified Actions admin;
exercise catalog DDL and a fixture-named Storage policy in rollback boundaries,
read back unchanged business/security state and consumed tokens. No local
GitHub Actions spoof or fabricated approved row. A successful Non-Production
rehearsal establishes this route only, not Production adoption or readiness.

The scoped runner and same-repository PR workflow are now prepared. Twelve new
rehearsal safety tests, scoped lint, workflow YAML/syntax and secret/log guard
PASS locally. Existing 72 focused tests/strict TypeScript/Real DB catalog evidence
above are reused. The catalog migration maps to its existing focused Real DB CI
verifier rather than triggering an unrelated full suite. Actual owner-operated
approval/DDL remains PENDING_CI until the trusted job executes; local unit tests
or owner-readable metadata are not substituted for that result. The owner
authorized commit/push/PR and rehearsal CI only, not merge or Production deploy.

Owner-operated governed DDL subsequently PASSed in real CI on PR #343 head
b6e29da2937c830aa1c0f313b59b1788e212d3ec, run 38862036244:
https://github.com/bellaspahcm/bella-ai-platform/actions/runs/38862036244
The trusted job verified operator bellaspahcm/admin and the exact source SHA,
created the previously absent canonical E2E approval/token tables, and executed
both fixed cases through the existing wrapper as postgres. Actual public catalog
DDL, delegated storage.objects policy creation and private bucket creation/read-
back succeeded. The success case restored security metadata inside its rollback
boundary; the deliberate execution failure was rolled back by the executor.
Both tokens stayed consumed and a second consumption was rejected; no policy or
bucket probe remained. Governance schema/approval/token audit rows are retained.
Evidence status: PROVEN_NON_PRODUCTION_OWNER_DDL_ROUTE. This does not establish
Production delegation/configuration, final adoption-package approval, main seal
or Go-Live. The PR remains open and must not be merged under this authorization.

PR static analysis flagged the synthetic encoded-password URI in a TLS test,
not a real credential. The fixture now uses a fresh synthetic password and URL
username/password setters rather than an inline URI; the encoding invariant and
scanner rules remain unchanged. The corrected
PR head must finish its own required checks; no alert was suppressed.

### Exact Production delta, not a blanket migration replay

Production/E2E metadata rechecked at 2026-10-16 12:37 Asia/Saigon (05:37 UTC),
with TLS-verified connections and enforced READ ONLY transactions. No customer
or financial data rows were read or exported. This is not a backup preflight.
Baseline source is c9b4d2a1a61a539a18c27089438b552b9f74c0ad.

Seventeen candidate versions are recorded in E2E and absent from Production
history. Direct catalog checks confirm eight relations absent in Production:
policy_registry, mobility_domain_events, mobility_command_idempotency,
auto_vehicle_sale_recognitions, auto_vehicle_sale_recognition_adjustments,
auto_vehicle_sale_financial_snapshots, auto_vehicle_sale_payments and
auto_vehicle_sale_settlement_actions. The private automove-sale-documents bucket
is absent. History absence alone is NOT permission to re-run every statement.

The reviewed inputs below bind Git blob bytes at the baseline SHA, not a Windows
CRLF working copy. They are an inventory, NOT a final executable bundle/hash:

| Version | Component / dependency | Git-byte SHA-256 |
| --- | --- | --- |
| 20261013120000 | Mobility audit/idempotency and existing adapters | a905b45ee856b9e7eae6f93baa980b1745a60887cc71eb9ae1d72de6b5c07793 |
| 20261014010000 | Recognition/adjustment tables and append-only checks | 75f165b8f134fcf537d4bf71357ccbbc9b09421f53a0d0a92ab2c752e5297dbc |
| 20261014020000 | Global policy registry using public.users identity | b121ac951eeba088bf26949826fb43f4d2a44e225a09942d95befb52eb881878 |
| 20261014020100 | Policy registry read/security hardening | 30b7cc545eb3c01a15536f54ee6e0781a82ea35b75bb78181d309264dd37d660 |
| 20261014020200 | Sales permissive tenant policies and least privilege | aad8e91eb7797166c499a8c9cc0e594e9d0e95500079300d1225ab223c729244 |
| 20261014030000 | Snapshot plus private document bucket/policies | 4afd86afa61e33f73e53ff955ae5689c8f2719a98a8281b9c657bfb35c3942f7 |
| 20261014030100 | Accountant-only snapshot approval | 0a0ba76957fb7aa0da35ffbdcdd7cacc9f875f614fb6f6a3f6020aba57f76696 |
| 20261014030200 | Server-controlled draft correction | 203bca7a093c55e3bda0b827803b0ca15e0320b14fcf22282da5aa491dc30776 |
| 20261015010000 | Restrictive catalog SELECT guards; unmet prerequisites | 64d9485d8fe9db557dd38ac534e770d1661bc2bdac7bf6011e9e081412610bbc |
| 20261015020000 | Post-sale receipts, requires recognition | 419db046db933dfcba7f196dce2b36d1c6a64643ac5e4e808a49a23c2dbac24c |
| 20261015020100 | Combined receipt/deposit collection cap | 87e55490677965eda8a6031eed8b5191b2827469c5c128e69b80f19b0e73e460 |
| 20261015030000 | Active-identity guards, needs permissive sales policies | b3f90e3a740aa8e13711a67285d1b4b040fb130f5f8a5e58e9d3a75a4fbd45ef |
| 20261015040000 | Shared Platform live identity/HQ helpers | 1e75e3f25d24814ca0e2f3f31e80447b091d34a53c1c7f2c5fd12e96d208c108 |
| 20261015040100 | Explicit HQ SELECT/UPDATE on public.tenants only | fa50ead7cadc449fa0f05359e9f222b2996323bfb0775d595a8796ed4533413c |
| 20261015050000 | Customer preference policy | fa3c1d08104435250d7f815f79e4b160f3a400622323a6d2a9fd833dcde8a296 |
| 20261015050100 | Restrict preference column writes | 41fcd3eb3a899b37413b1db2da86434ee650aa2c78c9ed896ec89f81f8800ea2 |
| 20261015060000 | Documented refund/cancellation settlement actions | 7b5881798a24fae53a1eb9758c8709832d3fdb760d64fba64e9b81c6c0c4d231 |

Confirmed differences that the final executable package must resolve explicitly:

1. Each of auto_brands/models/variants has RLS enabled, zero policies and
   authenticated write privileges. Existing 20261015010000 correctly raises
   before DDL on this baseline. Proposed minimum delta: after writer impact and
   authority approval, remove inappropriate catalog write/dangerous ACLs and
   provide an explicit permissive SELECT policy requiring active canonical
   actor/tenant and matching tenant_id, then keep/apply the reviewed restrictive
   guard. Do NOT add the old NULL/HQ bypass or weaken the migration's checks.
   The separately authorized prerequisite extension above now supplies and
   rollback-verifies that forward correction. Production application is not
   authorized by the rehearsal.
2. Existing sales/profile relations also have zero policies; auto_vehicles has
   one legacy policy. Effective anon TRUNCATE is present on all eight inspected
   existing relations, and old profile table grants exceed the intended column
   writes. Therefore the final narrow object ACL delta must be specified for
   the approved contract; column grants or RLS alone do not revoke inherited
   dangerous privileges. No broad default-grant or unrelated-table change.
3. Canonical helper fingerprints differ for get_auth_tenant_id, is_admin, is_hr,
   is_accountant, is_hq_super_admin and is_hq_admin; Mobility helper is absent.
   Adopting 20261015040000 is a shared Platform change, not only eight new tables.
   Pair it with 20261015040100 and review the approved shared identity/HQ impact;
   no default cross-tenant AutoMove exception is allowed.
4. Existing inspected public relations are owned by postgres; storage.objects
   and storage.buckets by supabase_storage_admin. bella_migration_executor is
   not superuser and cannot inherit or SET either owning role. It has public
   CREATE but not storage CREATE. BYPASSRLS is not DDL ownership. The current
   executor cannot be assumed to ALTER these tables/policies or replace owned
   helpers. Platform/data owners must approve the least-privileged execution
   authority strategy before dispatch. Do not grant broad ownership membership,
   transfer owner, use admin SQL directly or claim this transport fix grants DDL.

### Conditional execution sequence and stop conditions

This is one ordered release proposal, NOT rollout authorization:

1. Carry the scoped owner backup exception below into the existing BDGF approval
   process; do not request a second approver or restart backup. Freeze final
   source SHA, project, approved dependency-ordered delta, exact execution hashes,
   ownership route and before-state fingerprints. Stop before any write if the
   package's authorization/token binding, object shape or DDL authority is unproven.
2. Use the rollback-verified forward catalogue/ACL correction above, not a fake
   legacy bootstrap. Preserve all historical files and the sealed workshop
   history. Bind its exact bytes with the full approved package before execution.
3. Stage policy_registry identity/read inputs 20261014020000/20100, Mobility
   20261013120000 and recognition 20261014010000, with active global accounting
   policy available before any recognition inserts. These depend on canonical
   users/tenants/customer/vehicle/org-unit schema, not a fake public.profiles.
   Stages 3-5 are dependency staging, not independently committable security
   states: use one approved transaction unless each committed unit is separately
   proven to preserve the final access boundary. Existing per-file wrappers must
   not be assumed to make a multi-file sequence atomic.
4. Apply shared identity/HQ 20261015040000/40100 as one logical security unit,
   sales policies 20261014020200 and active guards 20261015030000 after their
   permissive dependencies; satisfy catalog preconditions before 20261015010000.
   All changes exposing existing access must be transactional with their final
   restrictive guards/least-privilege ACLs. If approved tooling cannot guarantee
   that or requires an unapproved maintenance operation, STOP; do not expose an
   intermediate permissive state or silently re-order an approved package.
5. Apply snapshot/bucket 20261014030000/30100/30200 as a final-state unit,
   receipts/cap 20261015020000/20100, preferences 20261015050000/50100 and
   settlement 20261015060000 after their dependencies. Approval must explicitly
   cover both public and storage mutations under supported schema bindings;
   do not relabel mixed-schema DDL as public-only to fit a token.
6. After each authorized transaction verify actual columns, constraints/indexes,
   trigger invariants, policies, effective table/column privileges and current
   helper definitions against the approved final-state manifest, not only names
   or counts. Verify the policy seed/private bucket/document rules. History
   records only verified committed changes via the approved migration mechanism.
   No manual history inserts, blanket db push or reused workshop confirmation.
7. Keep runtime closed. Only after a separate explicit runtime decision and
   successful adoption may a controlled default-deny enablement be implemented
   and tested on the exact deployed SHA. No fixture/write probes on Production
   without explicit test actor/data authorization. Reuse #339-#341; run only
   affected regressions plus mandatory CI. Deployment success is not Go-Live.

The four reachable approval/execution callers now use verified TLS; unrelated
historical BDGF probe scripts are not covered. The old workshop workflows are
not an authorized adoption entrypoint. Do not claim the entire framework or a
new Real DB rollout path is sealed by transport and unit-test evidence.

### Human decision and rollback boundary

BDGF lists Bella Platform Architecture Team as owner and Platform Chief Architect
as approval authority, with Amendment + Architecture Review + Security Review.
The user's subsequent decision identifies the Bella AI Platform owner as the
final human authority for this release. Do not require an additional person only
because the framework describes organizational roles. Human authority, technical
readiness and the machine-enforced execution approval are separate facts.

Owner decision recorded from the current conversation, limited to this AutoMove
Production adoption effort:

- OWNER_BACKUP_EXCEPTION = APPROVED_BY_OWNER_IN_CONVERSATION. The owner accepts
  proceeding without independent backup and the associated risk of data loss or
  inability to restore independently. This does not prove a backup exists or that
  recovery is possible. No global BDGF rule or other release is changed.
- BACKUP_RECOVERY = DEFERRED_PENDING_BUDGET. Do not restart preflight, export,
  backup/restore work, tasks or paid services. No expiry or standing waiver for
  future releases is inferred from this decision.
- Keep verified CA/hostname TLS. Do not replay all 17 historical migrations,
  fabricate migration history, weaken catalog/ACL checks or bypass DDL ownership.
- RUNTIME_GUARD = HELD until adoption and actual schema/security verification
  succeed and runtime enablement is separately authorized.
- EXECUTION_BINDING = NOT_READY. No final executable delta/hash, valid approval
  record or gate token has been created for this adoption. Recording the owner's
  decision in this document does not create one or impersonate a database actor.

Technical prerequisites stay within the existing release preparation:

1. Catalog/ACL delta: now implemented and rollback-verified in the prerequisite
   extension above for exactly three tables under the reviewed tenant/least-
   privilege contract. The historical migration is unchanged; no fake legacy
   policy was added to pass its assertions. Production adoption is still pending.
2. Governed DDL route: specify how the approved public/storage changes run with
   their required object-owner authority, transaction boundaries and exact token
   bindings. Do not silently switch to an administrator connection, grant broad
   owner membership or treat BYPASSRLS as ownership. The prerequisite extension
   above fixes TLS on all four reachable callers and enforces real DB principal
   matching, but cannot create missing owner authority or E2E governance objects.

These are prerequisites of the same release, not new architectural gates or a
request to find another human approver. No Production mutation is authorized by
an unfinished execution package, and no machine approval check is disabled.

Rollback proposal: fail before mutation on any unmet precondition; failed
uncommitted changes ROLLBACK under bounded locks/timeouts; verify before-state
fingerprints and stop subsequent steps. For committed changes, retain runtime
closure/history and use an explicitly authorized forward fix or proven recovery
procedure. Never drop financial/append-only tables or erase history. A source
revert or transaction test does not provide full-database restore capability.

Current report for decision:

| Requested field | Current result |
| --- | --- |
| DEPLOYMENT_STATUS | PREPARED_LOCAL; EXECUTION_HELD |
| MIGRATION_DELTA | 17 historical candidates mapped plus one rollback-verified forward catalog correction; final adoption package NOT_READY |
| SCHEMA_SECURITY_VERIFICATION | FAIL_PROVEN_FOR_CURRENT_PRODUCTION_ADOPTION; metadata only, no write probes |
| RUNTIME_GUARD_STATUS | UNCHANGED_HELD |
| BDGF_APPROVAL | OWNER_BACKUP_EXCEPTION_RECORDED; package execution binding NOT_READY |
| ROLLBACK_PLAN | CONDITIONAL; independent recovery NOT_PROVEN |
| GO_LIVE_STATUS | NOT_PROVEN |

BUSINESS_CHAIN remains PROVEN_ON_MAIN for the sealed Non-Production proof.
BACKUP_RECOVERY remains DEFERRED_PENDING_BUDGET; full product readiness NOT_READY.
No Production mutation, backup/export, restore, configuration change, deployment,
kernel/registry/business change, commit, push or PR was performed in this batch.

## Recognition Adjustment Authority - 2026-10-16

Process gate: PASS for the owner's approval following scoped seal #339, main
`5f939791eddaac5eff45d0b089c0ec74042f6dba`. This is a separate Non-Production
batch; #339 is not reopened. Single agent, branch
`codex/automove-recognition-adjustments`. Generated AGENTS/cache changes remain
outside the commit. No merge, application deployment or Production DB authority.

Manifest: accountant-confirmed, documented price/cost deltas and explicit full
reversal against canonical, not-Finance-posted recognition. Use the existing
append-only adjustment ledger, stable request key and immutable original policy
version. No automatic cancellation, refund, vehicle return, fee or forfeiture.
The owner's prior three financial decisions plus latest approval authorize this
batch; approval does not make execution or Go-Live PROVEN.

Ownership/contract: AutoMove owns recognition and its adjustments; Accounting
owns accounting_periods and its public period guard. Product -> Accounting public
transactional read-guard -> tenant period rows; Product -> existing AutoMove
recognition ledger. No direct Product period query, Finance ledger engine/table,
Mobility/Logistics/Healthcare kernel or ProductRegistry change.

Change authority is limited to one additive public transactional read-guard in
the existing Accounting period-guards module, AutoMove command/API/UI and the
affected reporting/reconciliation consumers. The existing Supabase RPC guard is
not changed: it cannot share the caller's PostgreSQL transaction and may create
periods, so it is unsuitable here. Metadata-only E2E READ ONLY verified period
schema, accountant RLS and lock privileges. Migration plan: NONE; reuse existing
tables/grants and fail closed if runtime schema or rights are unavailable.

Business test contract: actor must be currently active accountant in the active
matching tenant. Each change references original recognition, verified tenant
Storage document, actor/time, reason, source period and original policy version.
Sale/cost totals may not become negative or exceed safe integer VND limits.
Reversal negates remaining adjusted sale/cost totals once, not the cash received;
any excess cash remains visible for separate manual refund, not auto-refunded.
Only the sealed explicit snapshot-based recognition producer is in scope; legacy
or unknown posting metadata fails closed rather than inspecting Finance internals.

Both original recognition date and server command date must resolve unambiguously
to OPEN tenant accounting_periods. Hold ordered row SHARE locks until outer
transaction commit/rollback so closing cannot race the write. No period creation,
reopening or status update in runtime; isolated test-fixture periods only for
rollback/concurrency proof. Missing, overlapping, closed, foreign-tenant or
unknown-state periods deny new changes. Persisted same-intent retry rechecks
current identity but is not rejected because a period later closed, policy
changed or evidence was removed. New requests require current reviewed revision.

UI -> contract reconciliation: separate price/cost/reversal commands, explicit
confirmation/document upload, server totals/revision and persisted history;
retain pending exact key/intent across lost acknowledgement. Dashboard reads
canonical adjusted totals, not client price or current vehicle cost. Cancelled
booking history remains readable; reversal does not mutate booking/vehicle.

Eleven verification gates: (1) scoped ownership; (2) public period boundary;
(3) current Auth/active accountant; (4) cross-tenant/inactive/suspended denials;
(5) original/current OPEN period and concurrent close; (6) append-only originals;
(7) safe positive/negative deltas and explicit reversal; (8) idempotency/concurrent
retry/read-back rollback; (9) adjusted reporting/cash reconciliation regression;
(10) Real DB plus actual Next.js Browser E2E; (11) strict typecheck, lint,
Architecture Guard, diff safety and exact-PR-SHA CI.

Acceptance: Given matching valid actor/evidence/open periods, append exactly one
documented adjustment with read-back. Given closed/missing/ambiguous periods,
wrong authority/tenant or invalid evidence, write nothing. Given concurrent close,
either adjustment commits before close or rejects/retries without a stale write.
Given retry after success, return the original fact once, never a second delta.

### Executed Evidence - 2026-10-16

Final scoped review: PASS for the new command, public Accounting guard and
affected reporting/payment consumers. This is single-agent review, not an
independent multi-agent security certification. Unknown recognition producer or
posting metadata fails closed; this does not establish arbitrary Finance posting
state outside the sealed AutoMove producer. No schema/migration, period mutation
in runtime, kernel, commission, Warranty or Finance posting changes.

- Real DB verifier: PASS, 33 assertions, financial fixtures rolled back and zero
  recognition/adjustment fixture rows read back. Independent connection attempting
  to close a SHARE-locked period was blocked with SQLSTATE 55P03. Both source and
  current closed periods, overlap, invalid evidence, inactive/suspended actors,
  wrong role/tenant, stale review, failed read-back, immutable originals and
  same-key replay after period close/evidence removal were exercised.
- Actual Next.js Browser E2E: 1/1 PASS on E2E Non-Production. Real Auth, Storage
  upload, dashboard dialog -> API -> DB -> reload; lost acknowledgement and
  same-key retry, concurrent cost requests, closed period rejection, authority
  denials, explicit reversal, reporting zero active recognized sales and retained
  cash/excess balance were verified. Setup seeded original financial fixtures;
  this is not new proof of booking/deposit/recognition creation UI. Desktop and
  390px screenshots inspected; dialog horizontal bounds asserted.
- Jest: 7 suites, 72 tests PASS (command, HTTP, UI, reporting and payment
  regression). Failed commit/asynchronous connection failure never acknowledged.
- Strict changed-source/dependency TypeScript: 17 root TS/TSX files, zero
  diagnostics. Changed-file ESLint, Architecture Guard, API documentation and
  git diff --check: PASS. Scoped CI selector lists the new verifier once.

Cleanup: PARTIAL by design. Verifier-owned periods removed; Auth zero and actors
inactive, tenant shells terminated, with read-back. Browser Auth/Storage zero;
its fixture period closed, actor inactive and tenant shells terminated. Browser
immutable history/snapshot and audit references retained; no append-only/FK
bypass. Local screenshots/logs and unrelated AGENTS.md changes are not committed.

PR/CI on remote and main seal remain pending; local Browser proof must not be
reported as Browser CI on main. No merge or automatic application deployment is
authorized in this batch. #339 remains sealed without rewriting prior evidence.
Initial PR #340 Core Freeze failed because its machine-readable approval binding
was missing. ACR-2026-019 records the existing owner approval for exactly
src/core/services/accounting/period-guards.ts and PR #340; no guard was weakened
and no additional Core/runtime scope was introduced.

`ADJUSTMENT_REVERSAL = PROVEN_ON_E2E_PENDING_PR_CI`
`MAIN_SEAL = NOT_PERFORMED`
`PRODUCTION_MUTATION = NOT_AUTHORIZED`
`AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`

## Settlement Batch Authority - 2026-10-15

Process gate: PASS for the owner-authorized Non-Production refund/cancellation
batch, based on main ef059443dbe328a1a8eef4e9faab31c80d6272df (#338 sealed).
Single-agent execution; no reopening of sealed identity/HQ or management work.

Manifest: manually confirmed cash refunds, independent cancellation, immutable
receipt-linked history, stable retry and post-refund internal reconciliation.
Only active accountants in an active matching tenant may execute these commands;
Supabase Auth -> current public.users/tenants is authoritative, not client roles.
Refunds cannot exceed the unrefunded amount of their original confirmed receipt.
Cancellation before handover releases only this booking's allocation through the
existing Mobility transition contract. After handover, documented cancellation
does not return the vehicle, refund money or reverse revenue automatically.

The owner explicitly HELD adjustment/reversal after discovery that the existing
accounting-period public read cannot lock the period in the command transaction.
No Accounting/Finance change, period creation, adjustment writer, fee, forfeiture,
Warranty, commission, ProductRegistry, kernel or Production access is authorized.

Ownership: AutoMove owns refund/cancellation facts, bookings and receipt
reconciliation; Mobility owns vehicle allocation/status; Platform owns identity
and Storage access; Finance owns journal postings and accounting-period controls.
Dependencies: authenticated UI -> AutoMove settlement command -> existing
Mobility public contract. Existing recognition and receipts remain immutable.

Migration plan: one forward migration creates only the minimum AutoMove
settlement-action table, indexes, validation/append-only triggers and least-
privilege RLS. Refunds before recognition cannot use the adjustment table because
its recognition_id is mandatory. The new table records cash/cancellation facts,
not a parallel revenue ledger. It also forward-aligns existing collection guards
with net cash after recorded refunds; historical migrations are not rewritten.

UI reconciliation: separate refund/cancel requests, verified tenant Storage
document and explicit confirmation; read persisted history/balances, preserve
pending intent/key after lost acknowledgement, and show failures as failures.

Business test contract: per-receipt refund cap, receipt/recognition immutability,
no automatic revenue reversal or physical vehicle return, safe sequential and
concurrent retries, and current accountant/tenant authority come from the user's
three explicit decisions and subsequent adjustment/reversal HOLD in this chat.

Eleven verification gates: (1) architecture/frozen boundaries; (2) public Mobility
contract; (3) real authenticated HTTP; (4) active accountant authority; (5) tenant,
inactive and suspended denial; (6) safe forward migration; (7) atomic persistence
and rollback; (8) unchanged original financial history; (9) idempotency/concurrency;
(10) Non-Production Real DB and actual Next.js Browser E2E/read-back; (11) focused
regression, strict typecheck, lint, required CI and honest readiness classification.
No Production deployment or merge is authorized for this batch. Commit/push/PR
are allowed after verification. Full readiness and Go-Live remain NOT_READY /
NOT_PROVEN; local/PR/main evidence must remain separate.

Current settlement result: see "Settlement Batch Executed Results" below. The
older management checkpoint remains historical evidence for sealed PR #338.

Baseline: main `2652d3b645b89715e4ca970d76b057a94775f7d2` (PR #337).
Single agent. Identity/HQ is sealed and is not reopened.

Current checkpoint: see "Management Batch Executed Results" at the end. The
initial verification/failures below are retained as chronological evidence,
not the final management result or a main/release seal.

## Process Gate and Manifest

PASS for owner-authorized Non-Production business-chain verification and repairs
of proven blockers within existing contracts. This is not Go-Live approval.
Verify real Auth, vehicle/customer UI, booking/allocation, deposit, approved
snapshot, persisted handover, explicit recognition, collection and reconciliation.
Prior proofs are reused, not reimplemented. Missing business policies, new public
contracts or schema changes stop at the approval boundary.

## Ownership Map and Contract Dependencies

| Data / capability | Owner | Runtime boundary |
| --- | --- | --- |
| Actor / current authority | Platform | Supabase Auth -> active users / tenants; unchanged |
| Vehicle identity, allocation, handover | Mobility OS | existing public Mobility contracts |
| Customer, booking, deposit | AutoMove / existing customer contract | existing authenticated UI/API |
| Approved snapshots, recognition, receipts | AutoMove | sale-chain and payment commands, canonical persisted records |
| Journal posting | Finance | excluded; operational reconciliation is not Finance posting |

Product -> public Mobility contract -> existing adapters. Verification may inspect
DB independently, but must not manufacture business success using privileged
fixture writes. Initial catalog/customer/vehicle setup is explicitly fixture data.

## Change Authority

In scope: existing E2E harness, focused assertions, one evidence report and minimal
boundary-local repairs supported by runtime evidence. No Production access,
Vercel changes, Identity/HQ/helper changes, kernel, registry, Warranty, commission
or Finance posting. No commit, PR, merge or deployment in this verification batch.

## UI to Contract Reconciliation

Reuse dashboard browser spec 42 for actual UI -> API -> DB read-back. Add negative
checks against that same transaction and expose unimplemented management paths.
A success toast/state update is not persistence. A fixture-created customer or
vehicle does not prove customer creation or vehicle intake through the UI.
Payment, handover and recognized revenue remain separate facts; handover never
implicitly recognizes revenue. Cancellation/refund/adjustment execution requires
approved policy and runtime; guard rejection alone does not prove those workflows.

## Additive Migration Plan

NONE. Use durably applied Non-Production schema. No migration replay, bootstrap,
new tables, grants or RLS changes. New schema needs separate authorization.

## Business Test Contract

Owner-approved inputs: separate deposit/payment/revenue; accountant-only snapshot
approval; immutable snapshots/history; explicit recognition; stable retry keys;
current active identity and tenant, without default HQ bypass. Test these through
the actual Next.js dashboard and persisted DB facts. Exact retry cannot increase
receipt count, collected amount or recognized revenue. Cross-tenant, inactive and
suspended contexts cannot read/write the transaction. Failure is not zero revenue
or success. Retain immutable audit/history and report cleanup limitations.

## Eleven Verification Gates

1. Architecture: no kernel, helper, registry or cross-product change.
2. Contract: reuse current UI/API/Mobility boundaries; no invented sales source.
3. Identity: real Auth login; no development/mock identity.
4. Authorization: active accountant, inactive actor and suspended tenant.
5. Tenant: own transaction visible; second controlled tenant cannot access it.
6. Persistence: independent DB read-back for every executed business operation.
7. Finance semantics: snapshots, recognized period and internal reconciliation;
   no journal/commission/bank reconciliation claim.
8. History: approved snapshot/recognition unchanged after retries/collections.
9. Idempotency: booking, recognition and receipts including concurrent retries.
10. Real DB/browser: matching E2E project, verified TLS, actual Next.js/Chromium;
    document fixture bootstrap and retained append-only records.
11. Regression/readiness: run only changed tests and relevant checks; report
    missing operations and release/recovery evidence without claiming Go-Live.

## Execution

Baseline browser run persisted the sale and receipts, then timed out while
reopening the payment panel before its response arrived. The test now awaits
and validates that real response instead of assuming completion within 10s.

The expanded run proved cross-tenant DB/API rejection, but inactive sale-chain
state returned HTTP 500. A separate READ ONLY diagnostic confirmed SQLSTATE
42501 on the trusted profile lookup. Scope-local repair: map PostgreSQL permission
denial to HTTP 403 in the existing sale-chain/payment HTTP boundaries, rollback
and return no business result; keep genuine DB/configuration errors as errors.
No helper, RLS, grants, financial semantics or transaction boundary changes.
Focused HTTP regression tests and the same business-chain negative assertions
must pass after the repair. Management persistence probes remain real failing
readiness assertions, not approved new write capabilities or tests to weaken.

The management browser also recorded the inventory read failing with UUID input
`dev-tenant`. The consumer used the generic development tenant context instead
of canonical current user authority. Scope-local repair: resolve tenant using
the sealed `getCurrentUser()` server action before calling the unchanged public
Mobility inventory contract. Missing identity rejects the read. No Platform
provider/helper change and no new vehicle write capability. Verify exact tenant
binding and missing/error identity with focused component tests and browser.

## Executed Results

| Flow | Evidence / result |
| --- | --- |
| Real login -> catalog/customer selection -> booking/allocation | PROVEN_ON_NON_PRODUCTION; actual Auth, Next.js and Chromium; one persisted booking/allocation after retry |
| Deposit -> approved financial snapshot | PROVEN_ON_NON_PRODUCTION; 100M VND receipt, separate accountant approval and source documents |
| Handover -> explicit recognition | PROVEN_ON_NON_PRODUCTION; no revenue after deposit/handover alone; one 1.4B VND recognition after explicit command and retry |
| Post-sale collection -> internal reconciliation | PROVEN_ON_NON_PRODUCTION; five receipts sum to 1.3B VND, 100M deposit, outstanding zero, MATCHED; lost-response/concurrent retries, overcollection and mismatch rejection |
| Dashboard canonical revenue | PROVEN_ON_NON_PRODUCTION; correct recognized month/model, 1.4B VND after reload, immutable 1B cost basis |
| Sales transaction DB/RLS and HTTP | PROVEN_ON_NON_PRODUCTION; own access, cross-tenant 404, inactive/suspended 403, denied mutations leave ledger/receipts unchanged; valid authority restored |
| Vehicle inventory read | PROVEN_ON_NON_PRODUCTION after consumer repair; seeded VIN displayed through unchanged Mobility contract with canonical tenant |
| Customer management / preference save | FAIL_PROVEN_ON_NON_PRODUCTION; real DB customer absent, displayed mock preference save lost after reload |
| Vehicle intake | FAIL_PROVEN_ON_NON_PRODUCTION; success toast observed, independent DB query finds zero vehicle rows |
| Refund / cancellation / adjustment execution | NOT_PROVEN; existing collection guards do not prove a refund or reversal workflow |
| Release candidate deployment / approved recovery | NOT_PROVEN in this batch; no Production adoption or deployment authorized |

### Evidence and Checks

- `e2e/tests/42-automove-dashboard-sales-chain.spec.ts`: final run 1/1 PASS,
  4.6 minutes, no skipped tests or automatic retries. Full chain plus current
  authority negative assertions ran together on actual Next.js/Chromium.
- `e2e/tests/44-automove-management-persistence.spec.ts`: real failing readiness
  assertions remain. Do not merge or describe the overall browser batch as PASS.
  The management probe verifies inventory read separately from intake writes.
  Final confirmation: actual tenant customer matches zero UI rows, preference
  reverts to `BMW, Porsche` after reload rather than the submitted value, and
  successful intake yields zero DB rows. Retrying assertions waits for UI updates;
  these failures are not an immediate hydration read or a skipped operation.
- Final sales booking: `2ab96bd1-3a6f-4b44-aea9-57231ca3f701`. An independent
  post-run READ ONLY DB query confirms one recognition, approved snapshot, one
  confirmed 100M deposit, five 1.3B receipts, no remaining Auth actor/active
  profile/Storage document and terminated fixture tenant. Monetary units: VND.
- Local artifacts: `.cache/automove-business-chain/final-chain.log`,
  `persisted-chain-readback.json`, browser screenshots under `final-chain/`,
  management logs/screenshots under the same scoped evidence directory.
- Focused HTTP tests 21/21 PASS; inventory component tests 3/3 PASS. Initial
  component attempt used Node instead of jsdom; corrected test environment,
  not runtime behavior. Scoped strict TypeScript: zero diagnostics. Focused
  ESLint, Architecture Guard and whitespace check PASS.
- The earlier timeout and HTTP 500 run are FAIL, not ignored PASS. The mapping
  repair preserves rollback and hides DB details; non-permission failures still
  return server errors. No new permission or RLS bypass was introduced.

### Proven Blockers and Minimal Next Scope

1. Customer UI reads module-level mock arrays and saves only React state after
   a timer. Actual customer/profile persistence exists behind a provider, but
   the page is not wired to it. Confirm the existing write authority and tenant
   contract before wiring that UI; do not infer authority from the mock screen.
2. Vehicle intake and status controls currently use timer + toast, not a persisted
   Mobility write. An intake workflow needs the approved required catalog/vehicle
   fields and write authority at the existing Mobility ownership boundary; do not
   create a parallel Product direct-table write or invent lifecycle semantics.
3. Refund/cancellation/adjustment policy and execution are still unproven beyond
   collection-denial safeguards. No forfeiture, fees or journal posting inferred.
4. Legacy inventory/trend/delivery analytics RPCs return PGRST202 on E2E. They are
   not canonical revenue and are not repaired here. Do not label all dashboard
   metrics proven because the recognized-sales path passed.

Next implementation should address real management persistence through existing
public contracts, with explicit authority for any missing Mobility intake write.
This is a concrete Product capability boundary, not a new architecture audit.
No new financial/identity framework is requested or created.

### Cleanup and Delivery Boundary

Cleanup is PARTIAL by design: test Auth identities and Storage documents removed,
profiles deactivated, fixture tenants archived. Immutable receipts, financial
snapshots, recognition and audit history remain in Non-Production; this is not
zero-residual rollback. Historical #337 shells/audit records are untouched.
No FK, append-only rule or financial trigger was disabled.
Independent READ ONLY cleanup read-back covers all eight tenants created across
this batch's diagnostic/final runs: all terminated, zero active actors and zero
remaining Auth actors. Three recognition rows and fifteen post-sale receipts
remain intentionally. Exact evidence: `.cache/automove-business-chain/cleanup-readback.json`.

Only Product consumers/HTTP boundaries, focused tests and this checkpoint changed.
No migration/schema/grants/RLS/helper/kernel/registry change; no Production DB,
Vercel configuration, commit, PR, merge or deployment. These are local results
on the approved baseline plus the scoped patch, not main/CI/release seals.

`BUSINESS_SALES_CHAIN = PROVEN_ON_NON_PRODUCTION`
`MANAGEMENT_PERSISTENCE = FAIL_PROVEN_ON_NON_PRODUCTION`
`AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`
`GO_LIVE = NOT_PROVEN`

### PR 338 CI Follow-Up

PR 338 is OPEN, not merged or sealed. Initial CI on `7e9ea47ea` exposed:

- Gitleaks generic-api-key matched a synthetic UUID fixture named `key`, not a
  credential. Rename it to `intentId`; no secret-scanner ignore or rule change.
- Catalog, allocation, deposit, handover and receipt verifiers still expected
  legacy empty rows/service errors for inactive/missing actors, or null HQ tenant
  identity. The sealed #337 helper instead denies with PostgreSQL 42501 and
  returns the real active HQ tenant. Align only these fixture/assertion consumers:
  HQ uses product_key bella_hq, denied reads/commands assert exact 42501, active
  reads and cross-tenant isolation remain mandatory. No shared helper/RLS change.
- The actual authenticated dashboard reporting read classified canonical 42501
  during actor/tenant verification as 503. Minimal Product read-boundary repair
  maps only missing/denied authority to 403, retaining 503 for schema/configuration
  failures. No recognition query, amount, period, adjustment or ledger write changed.

Executed Non-Production regressions: catalog, booking allocation, deposit,
handover/approved-snapshot recognition, recognized-sales reporting, actual
authenticated dashboard, post-sale receipts and management verifier all PASS.
Failed diagnostic attempts remain FAIL in local logs; they are not the final
proof. The existing rollback/archive/Auth/Storage cleanup paths remain enabled.
Related reporting/management unit regression: 3 suites / 37 tests PASS, including
four cases distinguishing 42501 denial from schema error 42703. Focused lint and
diff checks PASS. CI on the follow-up commit must run before READY_FOR_MERGE;
initial Vercel/other checks do not carry over as proof for a new SHA.

## Batch tiep noi: Browser Management Persistence

Owner da duyet sua ba blocker trong mot batch Non-Production. Architecture:
PASS cho pham vi nay; khong mo lai Identity/HQ, sales-chain, kernel hoac Finance.

- Truth: customer UI dang doc mock va luu React state; intake chi timer/toast.
- Contract: AutoCustomerProvider.getProfile/upsertProfile va public
  MobilityFoundationService.registerVehicle da ton tai; tai su dung nguyen ven.
- Ownership: customers/core identity qua authenticated client; preferences thuoc
  AutoMove; vehicle/catalog binding va registration qua Mobility public contract.
- Authority: Auth -> getCurrentUser hien huu -> active users/tenant; RLS con lai
  kiem tra hien hanh. Khong tao role moi, HQ bypass hoac service-role business write.
- UI/API: list/profile/preferences co API rieng; intake them chon variant that,
  stable retry key, transaction va read-back; chi bao thanh cong sau persistence.
- Migration can thiet: READ ONLY E2E metadata chung minh auto_customer_profiles
  ton tai nhung authenticated khong co SELECT/INSERT/UPDATE. Forward migration
  20261015050000 chi cap ba quyen nay va scope policy dung tenant/customer. Khong
  sua lich su, helper hoac bang khac. Apply qua co che E2E migration hien huu.
- Business tests: tenant customer that hien thi; preferences reload dung; intake
  tao dung 1 vehicle in_transit voi variant cung tenant, 1 command/event/log;
  retry khong nhan doi, changed payload/foreign variant/customer bi tu choi;
  auth/inactive/suspended/wrong tenant fail closed, loi API khong thanh cong gia.
- Eleven gates: architecture boundary; public contract; real Auth; active
  authority; tenant negative tests; forward-migration safety; atomic persistence;
  audit/history; retry; Real DB + actual browser; focused regression/type/lint/diff.
- Pham vi tiep theo: cap nhat checkpoint nay, Final Review/PR neu dat. Chua co
  quyen merge/deploy Production; refund/cancellation/adjustment van ngoai batch.

### Management Batch Executed Results

`ARCHITECTURE_GATE = PASS_FOR_APPROVED_MANAGEMENT_SCOPE`
`MANAGEMENT_PERSISTENCE = PROVEN_ON_NON_PRODUCTION`
`DELIVERY = PR_338_OPEN_PENDING_CI`
`MAIN_SEAL = NOT_PERFORMED`

Root causes and repairs:

1. Customer page used mock rows/state. It now uses authenticated tenant-bound
   list/profile/preference APIs and the existing AutoCustomerProvider. Search
   and pagination are bounded. Save success requires a persisted read-back;
   errors remain visible. Loading/changing customer cannot submit a stale form.
2. Preference persistence existed, but E2E authenticated access was absent and
   the legacy policy allowed null-tenant fallback. Forward migrations
   `20261015050000` and `20261015050100` bind rows to the canonical tenant and
   an existing same-tenant customer. SELECT is granted; INSERT/UPDATE are limited
   to preferences and the unchanged upsert keys/timestamp. No aggregate, metadata
   or DELETE write grant. Existing metadata is preserved, not overwritten by an
   omitted preference field. Both migrations are durably applied and recorded
   through the existing E2E migration applier; no historical migration changed.
3. Intake used timer/toast without a write. It now selects a real tenant catalog
   variant and calls the existing public Mobility registration contract under
   authenticated SQL context. One transaction contains vehicle/status/event/
   idempotency persistence, with verified TLS, tenant/catalog binding, stable
   retry key, serialization and read-back before commit/success. No direct
   Product vehicle-table write or new Mobility contract was introduced.

Executed checks on the final scoped runtime patch:

| Check | Actual evidence |
| --- | --- |
| Real Next.js + Chromium management | 1/1 PASS, 2.7 minutes, no retry/skip; real Auth, customer list, preference save/reload and intake/reload |
| Failure/retry | Injected preference 503 does not save or report success; lost intake acknowledgement, sequential/concurrent same-key retries produce one vehicle; changed payload and duplicate VIN rejected |
| Authority | Cross-tenant customer/catalog blocked; injected tenant field rejected; inactive actor and suspended tenant return 403; restored valid actor can read persisted results |
| Real DB rollback verifier | PASS against durable migrations, including execution with CI's SUPABASE_DB_URL and no DB_URL; profile/vehicle reads, column restrictions, tenant denials, one command/event, zero rollback fixtures |
| Focused regression | 6 suites / 45 tests PASS: HTTP, customer loading race, vehicle authority, scoped CI selector, existing Mobility read contracts |
| Earlier permission mapping regression | 21 HTTP tests PASS for the retained sale-chain/payment 42501 -> 403 repair |
| Full strict application typecheck | `npx tsc --noEmit --strict --incremental false`: exit 0 |
| Lint / architecture / migration safety / whitespace | Focused ESLint, Architecture Guard, both migration SQL analyses and diff-check PASS |

The new Real DB suite is selected by exact management paths, not a fallback full
product run. It uses the CI-provided DB variable as well as local DB_URL and
keeps the existing effective-connection/Non-Production/TLS guard. CI and Vercel
must verify the PR head separately; see PR 338 CI Follow-Up above. Browser proof is
local Non-Production, not Browser CI on main or an approved release candidate.

Earlier browser attempts are not reclassified as PASS: one customer assertion
timed out during a cold request; another test raced fixture cleanup against an
unfinished lost-ack interception. The final spec awaits the actual list response
and intercepted registration completion before assertions/cleanup. No RLS, Auth,
TLS or business assertion was weakened. Final review also fixed stale-customer
form submission with two focused component regressions.

Independent post-run READ ONLY read-back confirms the final fixture has exactly
one preference profile with original metadata, one in_transit vehicle, one status
log, one domain event and one idempotency record. Both new migration versions
are present in history; preference UPDATE is allowed while metadata/aggregate
UPDATE is denied. Evidence: `.cache/automove-management-fix/reviewed-browser.log`
and `persistence-cleanup-readback.json`, plus scoped screenshots. The intake
screenshot captures the refresh/loading moment; the later reload/VIN assertion,
not that screenshot alone, proves the persisted vehicle appears in inventory.

Cleanup is PARTIAL: across the five management browser attempts, all ten fixture
tenant shells are terminated, Auth actors are removed and active actors are zero.
Customer/vehicle/audit history remains intentionally. The rollback-only verifier
leaves no fixture rows. Earlier business-chain fixtures and #337 immutable
records remain as previously documented; no rule, trigger or FK was disabled.

Final review found no remaining blocker in these three approved operations.
Owner authority permits commit/push/PR after verification, but not merge or
Production deployment. No Production DB access/mutation, Vercel/config change,
Platform helper/kernel, registry, Warranty, commission or Finance posting change.
Vehicle status controls/import and legacy analytics are not certified by intake
proof. Refund/cancellation/adjustment and release/recovery evidence remain outside
this management scope and unproven; no cancellation fee or forfeiture inferred.

`AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`
`GO_LIVE = NOT_PROVEN`

## Settlement Batch Executed Results

Implemented one scoped refund/cancellation batch on
`codex/automove-settlement-workflow`, based on sealed main `ef059443d` (#338).
Adjustment/reversal remains HELD by the owner's explicit decision; no accounting
period guard, recognition adjustment writer or Finance posting was introduced.

The additive migration `20261015060000` creates one append-only, receipt-linked
settlement-action table with active-accountant tenant RLS and server-owned
writes. It preserves existing receipt guards while accounting for recorded cash
refunds in the collection cap. Applied and recorded durably only on the approved
E2E project through the existing migration applier; no history rewrite or
Production DB access. No original receipt, snapshot or recognition is rewritten.

The API verifies real Auth, current active accountant/tenant authority, tenant
Storage content/checksum, original receipt and remaining refundable balance.
The booking lock and transaction cover the persisted fact, Mobility allocation
release, booking cancellation and reconciliation read-back. An aborted write
retains its original retry SQLSTATE; no role-reset query masks it. Network loss
fails closed, with bounded DB queries and no implicit command replay. A valid
retry retains its original key and returns the persisted action; changed intent
under that key is rejected. Current actor/tenant authority is still checked.

Cancellation before handover releases only the matching allocation through the
existing Mobility contract. Documented cancellation after handover leaves the
vehicle delivered and does not auto-refund or reverse revenue. The UI exposes
separate confirmed requests, retained retry intent and cancelled-booking history.
Cash reconciliation uses gross receipts minus recorded refunds, not revenue
reversal. Recognition after a pre-sale cash refund uses the verified net deposit
without changing the approved sale-price/cost snapshot.

| Check | Actual executed evidence |
| --- | --- |
| Settlement Real DB/RLS | 53 assertions PASS; allowed and denied actor/tenant operations, receipt caps, immutable originals, rollback injection, zero rollback fixture rows |
| Existing handover/recognition verifier | PASS with real Auth/Storage; 100M receipt less 20M refund recognizes 80M cash and 1,320M receivable against unchanged 1,400M revenue; savepoint rolled back |
| Existing post-sale payment verifier | PASS against the durable schema, including collection/retry/reconciliation regression |
| Actual Next.js + Chromium | 2/2 PASS, no automatic retry/skip: manual refund/lost acknowledgement/concurrent same and independent keys, wrong actor/tenant/document, delivered cancellation, reload/read-back; pre-recognition refund/cancellation releases allocation without revenue |
| Mobile follow-up | Recognized-sale browser test rerun PASS after a width-only fix; asserts dialog/control bounds at 390px and captures desktop/mobile screenshots |
| Focused regression | 9 suites / 71 tests PASS, including original SQLSTATE preservation, idle disconnect and malformed-success handling |
| Strict typecheck | 23 changed TypeScript root files plus dependencies, strict/noEmit, zero diagnostics |
| Other gates | Focused ESLint, Architecture Guard, one-migration zero-downtime analysis, API-doc coverage and whitespace checks PASS |
| Scoped CI selection | The new browser spec selects the settlement Real DB verifier; existing required selectors remain intact |

Browser fixture creation of customers/catalog/bookings/receipts/recognition is
privileged test setup, NOT evidence of those UI creation paths. The proven
browser operations use the real login, dashboard, API, Storage and database.
Evidence is local Non-Production, not Browser CI on main, release readiness or
a main seal. Screenshots/logs are local `.cache/automove-settlement/` artifacts,
not committed credentials or fixtures.

Earlier cold-compile, intercepted-response timeout, Auth/DNS/network failures
are not counted as PASS. The actual concurrency failure exposed a masked
SQLSTATE and was fixed with focused regression and subsequent runtime proof.
No Auth/RLS/TLS or financial assertion was weakened. Generic linked-project
migration check was not executable in this unlinked worktree; it is not reported
as PASS. Existing E2E apply/history verification and migration safety are the
executed local evidence; remote CI still has to verify this exact PR SHA.

Cleanup is PARTIAL: successful browser runs verify zero temporary Auth users,
zero active fixture actors, zero Storage objects and terminated own tenant
shells. Failed-network fixtures were recovered and their temporary identities
removed. Immutable financial/audit records and archived fixture shells remain
intentionally; no FK, append-only rule or trigger was disabled. The rollback
verifier leaves zero fixture rows. Unrelated generated `AGENTS.md` and cache
artifacts are excluded from the commit.

Single-agent final security/contract diff review found no remaining blocker in
this approved scope. Commit/push/open PR are authorized; merge, Production DB
mutation, deployment and configuration changes are not. Required remote checks
must PASS independently before any later merge decision.

`REFUND_CANCELLATION_RECONCILIATION = IMPLEMENTED_LOCAL_VERIFIED`
`ADJUSTMENT_REVERSAL = HELD`
`MAIN_SEAL = NOT_PERFORMED`
`PRODUCTION_MUTATION = NOT_PERFORMED`
`AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`
`GO_LIVE = NOT_PROVEN`
