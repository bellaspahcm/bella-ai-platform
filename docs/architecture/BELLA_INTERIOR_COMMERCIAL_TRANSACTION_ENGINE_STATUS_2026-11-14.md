# Bella Interior Commercial Transaction Engine — Status

**Date:** 2026-11-14
**Branch:** `codex/commercial-transaction-engine-20261113`
**Base:** latest observed `origin/main` at `9290fc08cdf402f4ad40a6075e59cb29059e0a19` (includes PR #537 merge)
**Production:** no migration or write issued; Supabase read-only migration-list and catalog checks succeeded on 2026-11-14
**PR #537:** not accessed or changed

## Recovery status retained

- `ARCHIVE_RESTORE = PARTIAL`
- `CLUSTER_ROLE_RECOVERY = PARTIAL`
- `PRODUCTION_RECOVERY_READINESS = NOT_PROVEN`
- The reported 38 orphan accounting rows remain unmodified and unexplained.

Recovery investigation is paused while Commercial work proceeds.

## Production read-only findings (2026-11-14)

- The Production migration list includes `20261112230707` (`interior_trigger_function_hardening`). The five migrations in this worktree (`20261113165251` and `20261114110000`–`20261114120200`) are absent from that list; none was applied by this work.
- Production catalog checks returned no `manufacturing_production_orders`, `manufacturing_production_plans`, `manufacturing_bom_revisions`, or `manufacturing_routing_revisions` table. The tenant catalog showed 1 `bella_interior` tenant and 0 `bella_manufacturing` tenants. This confirms there is no deployed Manufacturing runtime/schema target to receive an Interior order in the inspected Production project.
- Supabase's Production schema advisory reported 30 public tables with RLS disabled. A read-only privilege check confirmed 27 grant `SELECT`, `INSERT`, `UPDATE`, and `DELETE` to both `anon` and `authenticated`; 3 have no direct grants to either role. This includes Platform, Healthcare, proof-data, and verification tables outside Bella Interior ownership. No RLS or grants were changed. Each owning team must choose the correct access policies before remediation; enabling RLS alone would block existing access.
- These were metadata/catalog reads only. No business rows were read, and no Production mutation was issued. The duplicate-version migration ledger reconciliation remains outside this work and unresolved.

## Existing UI/API handoff check

- **Pre-change baseline:** static inspection found the Interior contracts screen had no caller for the quotation, customer-approval, contract-creation, or payment APIs. The release action reached a route that returned `INTERIOR_PRODUCTION_RELEASE_PERSISTENCE_UNAVAILABLE`.
- The existing contracts screen's visual structure is retained. Its workflow controls now call the existing quotation, customer-approval, contract-creation, and payment APIs. The Manufacturing release action remains closed because no persisted Manufacturing target exists.

## Commercial UI/API handoff change map (2026-11-14)

| UI action | Classification | Canonical capability and source of truth | Authorized change | Verification |
|---|---|---|---|---|
| Build quotation from an approved BOQ version | `EXISTING_CAPABILITY_REUSE` | `GET/POST /api/interior/boq` and `GET/POST /api/interior/quotations`; server validates project scope and the exact approved/locked BOQ version; quote totals/default terms come from `InteriorQuotationMarginService` | Connect existing contracts workflow controls to these APIs; do not calculate commercial totals in the browser | Focused component/API contract tests; verify denied/malformed requests do not create rows |
| Request quotation or contract approval | `EXISTING_CAPABILITY_REUSE` | `/api/interior/customer-approvals` creates a scoped single-use token for the exact subject/version; the public bearer endpoint validates token, expiry, signature artifact and transition | Provide a customer-facing handoff for the existing bearer API; never simulate customer action or auto-accept/sign | Public approval route tests; verify token stays out of logs/referrers and only real customer input is submitted |
| Create contract draft from accepted quotation | `EXISTING_CAPABILITY_REUSE` | `POST /api/interior/contracts` derives contract baseline, BOQ/design lineage, and schedule from the exact persisted accepted quotation plus its approved evidence | Connect UI action only; no client-supplied totals or lineage | Existing route tests plus focused UI request/error tests |
| Record a payment receipt | `EXISTING_CAPABILITY_REUSE` | `POST /api/interior/contracts` with `record-payment`; actual amount, method, bank reference and date are supplied by an authorized staff member; PostgreSQL enforces balance, uniqueness and transactional outbox | Add an explicit form to the existing milestone detail; no optimistic balance mutation or fabricated receipt | Focused form tests and existing payment/authorization tests |
| Addendum read/list | `IMPLEMENTED_CANDIDATE · RUNTIME_NOT_PROVEN` | Reads persisted `interior_contract_addenda` through the project contract read RPC; rows are returned only with project Finance Read and exact linked customer-approval evidence | Read-only list and narrowly scoped additive migration are implemented; do not add edit/create behavior | Focused API/UI/RLS contract tests; database execution remains pending |
| Addendum create/edit and Manufacturing release | `CAPABILITY GAP` | No staff write workflow is being exposed; Manufacturing still has no persisted runtime target | Keep these actions closed; do not infer schedule rules or substitute Interior identities for Manufacturing records | Record as residual gap; verify release remains unavailable |

This change preserves the existing Interior contracts page visual structure. Production, schema, migration ledger, PR #537 and real business rows remain out of scope. Database-backed Commercial E2E and customer actions remain `BLOCKED`/`NOT_PROVEN` until their respective authorized runtime evidence exists.

## UI/API handoff implementation (2026-11-14)

- The existing contracts screen now opens a scoped workflow: select an approved/locked BOQ snapshot, create a persisted quotation draft, create a customer approval request for that exact version, and then create an unsigned contract draft only after the exact quotation is accepted. Totals and lineage remain server-owned.
- The customer-facing page displays the exact quotation, contract, or addendum snapshot and records an explicit accept/reject decision. Contract acceptance requires a customer-provided PDF/PNG/JPEG signature artifact; the UI never auto-accepts, auto-signs, or fabricates evidence.
- The existing payment milestone detail can record an actual receipt only for a signed/active contract and an actor allowed by the server. It requires amount, method, reference, and transaction date, then reloads the persisted balance after success; the browser does not advance balances optimistically.
- API availability flags are derived from project-scoped authorization decisions. Manufacturing release remains unavailable. Addendum staff view is read-only and uses the persisted project contract read model; addendum write actions remain unavailable.
- No database call, migration, Production mutation, Non-Production mutation, or PR #537 action was performed for this UI/API handoff change.

## Implemented in this worktree

- New quotations are created as `draft`; requesting customer review moves the exact quotation version to `sent_to_client`.
- Contract creation now requires an accepted quotation and its exact approved customer record, then creates an unsigned `draft` contract with exact quotation, BOQ, and design revision lineage.
- Contract and payment API inputs now reject malformed optional fields and impossible calendar dates before persistence.
- Contract signature evidence is required before a customer approval can move the contract to `signed`.
- The existing contracts POST route can create a contract draft only when it finds one exact accepted quotation and one approved record for that version. It derives the draft from persisted project/quotation/BOQ/design data; the atomic RPC inserts the contract and milestone schedule together and serializes duplicate requests for that quotation.
- Project status and first Finance milestone are advanced only after the contract signature is recorded.
- Payment receipts, invoices, and addenda are rejected for unsigned contracts.
- Supabase approval transitions now use token-bearing RPCs. Direct authenticated `UPDATE`, `DELETE`, and token-column `SELECT` on approval records are revoked; tenant-scoped reads use selected columns and token resolution uses a scoped RPC.
- Payment receipt writes now rely on PostgreSQL triggers to lock the milestone, enforce its remaining balance, and advance `collected_amount`/`paid` in the same transaction. The same transaction inserts a Finance outbox receipt event; contract signature approval inserts the first milestone Finance event. Reference uniqueness is case-insensitive; the application no longer performs a separate read-then-update aggregation.
- Payment receipt RLS is scoped through the parent contract's Finance-read/payment-record permission, and receipts are append-only for authenticated users.
- The contract read model returns nullable `signedDate` and the stored commercial lineage fields.
- A new additive migration, `20261113165251_interior_commercial_transaction_engine.sql`, adds the lineage columns, evidence guards, approval transition RPCs, payment authorization/aggregation guards, atomic contract-plus-milestones creation, and contract read-model fields.
- Quotation creation and reads now have an API path. The quotation and all line snapshots are written atomically from one exact approved BOQ version; totals, source item lineage, tenant, and financial permissions are checked in the RPC.
- Contract creation reads project data through its scoped RPC rather than direct table access, preserving the RBAC boundary after direct table grants were revoked.
- The in-memory repository uses an explicit fixture-only approval seeding method. Workflow writes accept only pending requests and transition them through the same state rules as the database path.
- Manufacturing intake validation now requires the exact accepted quotation, both customer approvals (quotation acceptance and contract signature), sealed BOQ, and exact captured BOQ/design versions. It rejects a quotation approval being substituted for the signed contract evidence.
- Authenticated users can create exact-version quotation/contract approval requests. Customers receive a scoped bearer endpoint; contract approval requires a PDF/JPEG/PNG signature artifact stored privately with a server-computed SHA-256. The route fails closed when private storage is unavailable.
- Contract addenda now snapshot a complete replacement payment schedule and the contract value on which it is based. A customer bearer approval is bound to that exact addendum; only approval updates eligible unpaid, uninvoiced milestone terms and `current_contract_value` atomically. Paid/collected/invoiced milestone terms cannot be changed. Contract, addendum, and milestone rows are locked in order to serialize payment receipt against approval.
- Handover completion is now fail-closed. The API and in-memory service reject staff-supplied customer names as acceptance proof, and the new migration revokes the legacy RPC that marked a dossier accepted without customer evidence. The legacy staff-asserted path cannot issue a warranty.
- A separate customer handover acceptance token now captures the customer's signature evidence and atomically accepts the dossier and issues its warranty certificate. Existing unverified handover rows remain explicitly `legacy_unverified`.
- Manufacturing release remains closed at the adapter boundary until an authenticated Manufacturing actor, authorized factory, and persisted finished-good/BOM mapping can be resolved from canonical records. Interior role names and BOQ item IDs are not substituted for those records.

## Verification evidence

- Earlier UI/API handoff snapshot: full-repository `npx tsc --noEmit --pretty false` exited 0; ESLint exited 0 for every changed TS/TSX file; targeted Jest passed **8 suites / 63 tests**, including workflow permission availability, exact BOQ-only create request, customer decision/signature requirements, and existing Commercial route tests. This was a local code check and does not establish database-backed or real-customer E2E.
- The prior full Bella Interior Jest scope reported **46/46 suites and 544/544 tests** on the committed implementation; it did not connect to a database. After the runtime migration fix, the current `rbac-migration-contract.test.ts` passed **17/17 assertions**.
- A scoped strict TypeScript check passed for the changed Commercial core files. This is not a full repository typecheck and does not cover every API route.
- Prior committed-scope checks: `git diff --check` PASS; `node scripts/check-zero-downtime-migrations.cjs --base origin/main` PASS for **5 migrations**; RPC grant guard PASS **36/36**; targeted migration-contract test PASS **17/17**.
- Non-Production project `bmnbqbcdbuklhopfbopv`: all five migration SQL files were executed in order. Catalog verification confirmed the new tables/functions/triggers/constraints, RLS, grants, approval token checks, and fail-closed invalid-token behavior. This is bounded PostgreSQL evidence, not a real-customer E2E.
- Follow-up aggregate-only Non-Production census (2026-11-14) found 1 accepted quotation, 1 signed contract, 3 approved customer-approval rows, 3 pending payment milestones, 0 payment transactions, 2 pre-existing Interior finance outbox events, and no addenda, handover dossiers/requests, or warranty certificates. The only signed contract carries an E2E/test marker and is not valid positive-flow evidence: its referenced quotation and BOQ versions match, but the BOQ snapshot is not sealed, contract design lineage is missing, and both explicit customer-approval foreign-key links are null. Related approved evidence rows exist, but their authenticity was not established. No records were changed during this audit.
- Read-only privilege/RLS matrix for 11 Commercial tables: RLS is enabled throughout; `anon` has no direct table privileges. `authenticated` has no direct access to 10 tables; payment transactions allow only `SELECT`/`INSERT` under two RLS policies, with no `UPDATE`/`DELETE`. Handover acceptance requests have zero policies and zero direct grants, so direct table access remains denied and the intended interface is the scoped RPC.
- The same catalog check reported RLS disabled on seven public tables outside Bella Interior (`knowledge_documents`, two Healthcare temporal tables, and four temporary Finance proof tables). No policies or grants were changed; those tables need decisions from their owning teams. See [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).
- Local environment safety scan printed host/project metadata only: no verified Non-Production DB URL is configured. The root `.env.e2e` combines the Non-Production Supabase API URL with a `DATABASE_EXECUTOR_URL` targeting Production; Bella Interior tests do not consume that variable, and it was not used. Do not run DB-writing E2E scripts with this mixed environment.
- The migration tool recorded the five successful executions under generated versions `20261114082943`, `20261114083605`, `20261114084959`, `20261114085112`, and `20261114085747`, while the repository files retain their original versions `20261113165251` and `20261114110000`–`20261114120200`. `MIGRATION_LEDGER_PARITY = PARTIAL`; no ledger rows were manually edited. The `.env.test` DB URL resolves to Production `lvnvkpyxtuilhrabtlwv`, so it was not used for repair. The Supabase CLI's read-only migration-list attempt failed on direct IPv6 connectivity; a retry using DNS-over-HTTPS also failed to resolve the Non-Production direct DB host. Official CLI ledger repair therefore remains unavailable from this network until a verified Non-Production pooler connection is provided.
- Migration 5 initially failed PostgreSQL compilation because a `%ROWTYPE` variable shared a multi-target `INTO` list. The function now selects the addendum row and project ID separately; the corrected migration then applied successfully. The current targeted migration-contract test passes.
- Three explicitly confirmed Non-Production test payment rows were removed under the user's approval. Payment transactions now number **0**, milestones remain pending with **0 collected**, and no addenda, customer handover requests, or warranty certificates exist. Two pre-existing Finance outbox events remain and were not treated as evidence from this run.
- Post-migration advisors: health returned no lints. Security reported 22 `rls_enabled_no_policy` findings; the new handover request table is RLS-enabled and has no direct grants, so it remains deny-by-default and is accessed through scoped RPCs. Existing broad SECURITY DEFINER and performance advisories were not expanded into unrelated remediation.
- Production database and deployment remain unchanged by this work. PR #537 was not accessed or changed.

## Addendum read/list and PR #538 update (2026-11-14)

- Added `20261114120300_interior_contract_addenda_finance_scoped_read.sql`. It revokes direct `anon`/`authenticated` table access, replaces the tenant-only addendum policy with deny-all direct access, and extends the existing security-definer project read RPC to return addenda only to project Finance Read actors. Approval evidence is matched by tenant, project, subject type, and addendum ID; stored `approved` status without matching approval evidence is displayed as unverified.
- The Contracts page now shows the canonical persisted addendum list as read-only. It does not offer a fake create action. The contract approval modal fails closed when it cannot verify existing pending requests and does not load unrelated BOQ/quotation APIs for a contract-only action.
- A Non-Production catalog read confirmed the old tenant-only policy and absence of direct table grants to `anon`/`authenticated`. This turn performed metadata reads only. The new migration was not applied to Non-Production or Production; the earlier five-migration Non-Production evidence does not cover this sixth candidate migration.
- The PR #538 Gitleaks SARIF contained seven `generic-api-key` findings. All seven pointed to deterministic example UUIDs used as bearer-token fixtures in five test files; the findings were false positives, not production credentials. The fixtures are now assembled from low-entropy UUID segments so tests retain valid UUID format without embedding secret-looking literals. The two commits that introduced them were rewritten locally, and Gitleaks passed on updated head `5a8eaa0753619b6229ee1b0f91923d061ea3a46a`.
- On updated head `5a8eaa0753619b6229ee1b0f91923d061ea3a46a`, Build Verification, Type Check (changed), Affected Unit and Integration Tests, Changed-file Lint, Security Gates, CodeQL, Gitleaks, Baseline Comparison, Test Decision Engine, Architecture Guard, Frozen File Check, Dependency Boundary, Logistics Kernel Regression, migration validation, and Vercel completed successfully. `All Required Gates Passed` failed because Real Database Business E2E failed during migration apply; the customer/business E2E itself did not run. Migration Gates were skipped.
- The exact E2E failure was `policy "interior_payment_transactions_finance_read" for table "interior_payment_transactions" already exists` while the helper tried to apply the first changed migration, `20261113165251_interior_commercial_transaction_engine.sql`. The helper only recognized equivalent SQL when it appeared under the same migration name as one statements-array entry. The known generated-version ledger aliases and split statement storage therefore caused a duplicate apply attempt. No ledger repair was performed; `MIGRATION_LEDGER_PARITY = PARTIAL` remains. The migration batch failed before a successful record or the later candidate migration; the database post-state was not independently re-audited.
- Updated `scripts/apply-e2e-pr-migrations.cjs` to detect an exact normalized SQL match across recorded versions and statement-array splits, without inserting or editing any ledger entry. Added a regression test for an equivalent migration stored under a generated name/version and split statements. This only changes the CI helper; the next exact-head CI run must confirm the isolated E2E migration path.
- GitHub Actions logs are now available for the exact failed job; the duplicate policy is the observed cause. PR #538 remains unmerged until required gates pass and the additive addendum migration is reviewed. PR #537 and Production remain unchanged.

### Local verification after the candidate changes (2026-11-14)

- Combined targeted Jest: **9 suites / 71 tests passed** across the migration runner, public approval/handover routes, handover evidence, contract RBAC, workflow availability, migration contract, and the Commercial workflow modal.
- Full repository TypeScript: `npx tsc --noEmit --pretty false` exited 0.
- ESLint exited 0 for all changed TS/TSX files and the changed migration runner/test (only the repository's existing `.eslintignore` deprecation warning was printed).
- `node scripts/check-zero-downtime-migrations.cjs --base origin/main` passed for **6 migrations**; `git diff --check` passed.
- The migration runner regression proves exact SQL matching across an alias version and split statement entries without writing a ledger row.
- These checks cover local code and migration shape only. The sixth migration has not been applied to any database; database authorization, addendum runtime, customer transaction E2E, and Go-Live remain `NOT_PROVEN`/`BLOCKED`.

## Blockers by goal (2026-11-14)

| Goal | State | Blocker | Next evidence/action |
|---|---|---|---|
| Migration ledger parity | `PARTIAL` | The five applied Non-Production migrations were recorded under generated versions; no verified Non-Production pooler URL is available to use the official repair flow. The PR CI helper now matches exact SQL across split statements without changing the ledger. | Verify the helper on the next isolated E2E run; obtain a verified Non-Production connection and reconcile through the official CLI route after version/schema preflight. Never repair the ledger manually or use Production credentials. |
| Customer quotation approval | `NOT_PROVEN` | No authorized customer has reviewed and acted on a real quotation in this run. | Send the exact persisted quotation link through an authorized channel and retain the actual customer decision. |
| Contract signature | `NOT_PROVEN` | No valid customer-signed contract artifact was provided. | Use the customer handoff and verify the uploaded real signature artifact and exact quotation/BOQ/design lineage. |
| Payment and Finance outbox | `NOT_PROVEN` | There is no authorized real payment receipt to record. | Enter a real receipt through the signed-contract payment workflow; verify the persisted balance and outbox event. |
| Addendum and handover/warranty | `NOT_PROVEN` | Read/list is implemented as a candidate but its new migration has not run; no real approved addendum or customer handover acceptance exists. | Verify the candidate migration on the authorized isolated target; verify approval and handover transitions only with actual customer evidence. |
| Manufacturing release | `NOT_PROVEN` | No deployed Manufacturing runtime/schema/tenant target is present in the inspected environment. | Keep release closed until the canonical Manufacturing actor, factory scope, finished good, BOM and persisted order contract exist. |

These blockers apply only to the corresponding runtime goals. They do not block the independently completed implementation-level UI/API handoff, authorization gating, input/error handling, or exact-version lineage wiring; local checks do not establish live database authorization. `CUSTOMER_TRANSACTION_E2E = BLOCKED`; this does not mark the entire Commercial implementation as blocked.

## Still needed before calling Commercial operational

1. Reconcile the five Non-Production ledger aliases through the official migration-repair route once a verified Non-Production DB connection is available. Do not use the Production URL or edit the ledger directly.
2. Complete a bounded E2E using a real authorized customer approval and signature through the configured private storage bucket. The one existing E2E-marked signed contract is not eligible: its BOQ is not sealed, exact design lineage is missing, and explicit approval links are absent. No synthetic customer decision/signature is used here.
3. Verify a real payment receipt, balance locking, Finance outbox insertion, addendum approval, and handover-to-warranty transition. Invalid-token PostgreSQL probes passed, but successful business transitions remain `NOT_PROVEN` because there is no authorized real-customer evidence in this run.
4. Deploy and reconcile the authorized Manufacturing schema/tenant foundation before connecting validated intake to its canonical order contract. The Production catalog currently has no Manufacturing tables or `bella_manufacturing` tenant. Once that target exists, resolve the Manufacturing actor, factory access, finished-good identity, and approved BOM from authorized records; do not substitute Interior roles or BOQ item IDs. Order creation, lineage persistence, idempotency, and concurrency remain `NOT_PROVEN`.
5. Run applicable authorization, tenant-isolation, concurrency, and application E2E checks before any Go-Live conclusion.
6. The existing Interior UI handoff for quotation, customer approval, contract draft, payment, and read-only addendum list is implemented in code. The candidate addendum migration still needs database/CI verification; addendum create/edit and a persisted Manufacturing release target remain gaps.

**Current product decision:** `COMMERCIAL_IMPLEMENTATION = IN_PROGRESS`; `COMMERCIAL_SCHEMA_NONPROD = VERIFIED` for the prior five migrations only; `MIGRATION_LEDGER_PARITY = PARTIAL`; `CUSTOMER_TRANSACTION_E2E = BLOCKED`; `COMMERCIAL_GO_LIVE = NOT_READY`.
**Current-turn boundaries:** `PRODUCTION_CHANGE = NONE`; no direct database repair was performed. CI attempted the first historical migration on isolated E2E and failed on an existing policy; no successful migration record followed and the database post-state was not independently re-audited. Candidate migration `20261114120300` was not reached or applied; `PR_537 = UNCHANGED`.
**Production database and deployment:** unchanged by this worktree.
**Separate Production security finding:** 27 RLS-disabled tables grant full CRUD to `anon` and `authenticated`; owner-specific policy design and remediation are still required.
