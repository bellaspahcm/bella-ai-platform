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

- Static source inspection found the Interior contracts screen calls `GET /api/interior/contracts` and `POST /api/interior/contracts` with `release-to-workshop` only. No in-repository UI caller was found for the new quotation endpoint, customer-approval request endpoint, or `create-contract`, `record-payment`, and `create-addendum` actions. Those APIs may be consumed by an external client, but that integration is not represented or verified in this repository.
- No UI was changed. The existing contracts screen's release action still reaches a route that returns `INTERIOR_PRODUCTION_RELEASE_PERSISTENCE_UNAVAILABLE`; there is no in-repo flow from that action to a persisted Manufacturing order.

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

- The full Bella Interior Jest scope passed **46/46 suites and 544/544 tests**. The runner used the shared Next/SWC transformer without loading the checkout's `next.config`; no test connected to a database.
- A scoped strict TypeScript check passed for the changed Commercial core files. This is not a full repository typecheck and does not cover every API route.
- `git diff --check` passed; `node scripts/check-zero-downtime-migrations.cjs --base origin/main` passed for **5 migrations**; and the RPC grant guard passed **36/36**. The addendum migration contract test passed **17/17 assertions** within the full suite.
- `node scripts/check-supabase-migrations.cjs` did not complete: its linked read-only migration-list call failed before returning ledger results because the CLI could not write its local telemetry file. A separate Supabase read-only migration-list call succeeded later; the current five worktree migrations are absent from the returned Production ledger. No migration command or DDL was issued.
- The five new migrations have **not** been applied or executed by PostgreSQL. No database runtime result is claimed; the application tests are in-memory/static contract tests and mocked route tests.
- Production database and deployment remain unchanged by this work. PR #537 was not accessed or changed.

## Still needed before calling Commercial operational

1. The five migrations have application/static-contract evidence only. Database behavior remains `NOT_PROVEN`; do not represent unit tests or catalog checks as a database runtime result. Any later database execution requires its own authorized release action.
2. Complete a bounded E2E using real authorized customer approval and signature evidence through the configured private storage bucket. No synthetic customer decision/signature is used here.
3. Verify payment receipt permissions, row locking, balance limits, Finance outbox insertion, and milestone reconciliation against an authorized database runtime. Finance receipts persist through PostgreSQL triggers; general domain notifications still use the process-local Host Event Bus.
4. Deploy and reconcile the authorized Manufacturing schema/tenant foundation before connecting validated intake to its canonical order contract. The Production catalog currently has no Manufacturing tables or `bella_manufacturing` tenant. Once that target exists, resolve the Manufacturing actor, factory access, finished-good identity, and approved BOM from authorized records; do not substitute Interior roles or BOQ item IDs. Order creation, lineage persistence, idempotency, and concurrency remain `NOT_PROVEN`.
5. Run applicable authorization, tenant-isolation, concurrency, and application E2E checks before any Go-Live conclusion.
6. Verify the external Sales/customer client handoff for quotation and customer-approval APIs. If these workflows are expected to run from the current Interior UI, the existing UI has no caller for them; no UI changes were made under the current scope.

**Current product decision:** `COMMERCIAL_TRANSACTION_ENGINE = IN_PROGRESS`; `COMMERCIAL_GO_LIVE = NOT_READY`.
**Production database and deployment:** unchanged by this worktree.
**Separate Production security finding:** 27 RLS-disabled tables grant full CRUD to `anon` and `authenticated`; owner-specific policy design and remediation are still required.
