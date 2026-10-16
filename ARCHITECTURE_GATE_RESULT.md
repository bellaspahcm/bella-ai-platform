# ARCHITECTURE GATE RESULT — PRE SCHOOL CLASSROOM OPERATIONS & CAPACITY WORKSPACE REDESIGN (IMAGE 1 & 2 TO IMAGE 3)

> **Status:** PASS  
> **Date:** 2026-10-16  
> **Scope:** Redesign Classroom Operations & Capacity Management UI (`src/app/dashboard/education/courses/page.tsx`) from the cluttered layout (Image 1 & 2) to the streamlined, high-hierarchy visual layout (Image 3) exclusively for Preschool tenants (`bella_education`).  
> **Strict Type Invariant:** ZERO use of `any` and `unknown` in all code and handlers.

---

## 1. Bella OS/Product Development Process Gate

- **Truth:**
  - Preschool classroom management requires clear visual hierarchy: single unified primary color (`#075548`), reduced container nesting, compact card height, removal of noisy technical contract badges from end-user view, 4 lightweight neutral KPI stats, 2-tier search and grade filter bar, student avatar stacks, clear health alerts distinction, and direct classroom actions ("Vào lớp học →", "Điểm danh").
  - Non-preschool tenants visiting `/dashboard/education/courses` must retain the standard courses view without breaking changes or visual regression.
- **Source of Truth:**
  - Image 3 reference screenshot and user UX/UI evaluation specification.
  - Preschool Vertical Manifest (`src/products/bella-education/manifest.ts`).
  - Tenant Brand Identity (`src/lib/business-rules/tenant-modules.ts` -> `brand.moduleKey === 'bella_education'`).
  - Education OS Constitution (`docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md`).
- **Canonical Contract:**
  - API: `/api/education/courses` (GET classrooms summary, POST create new classroom).
  - Public Contracts: `TeacherAssignmentContractImpl` & Course canonical tables (`edu_courses`, `courses`).
- **Gate Result:** `PASS`
  - All modifications are strictly scoped to the presentation and client interaction layer in `src/app/dashboard/education/courses/page.tsx`.
  - Kernel H1–H12 (Healthcare), Kernel E7.1–E7.3 (Logistics), and Education Kernel (`src/platform/education/`) remain 100% frozen.
  - Zero database schema modifications (no migrations required).

---

## 2. Product Manifest (Capabilities & Scope)

- **Target Vertical:** Bella Education (Preschool Vertical — `bella_education`).
- **Target Page:** `src/app/dashboard/education/courses/page.tsx`
- **Capabilities in Scope:**
  1. **Clean Header:**
     - Simplified page title: "Quản lý lớp học".
     - Subtitle: "Theo dõi sĩ số, sức chứa và tình trạng điểm danh theo lớp".
     - Subdued category pill: "Preschool ERP Operations" (removed technical "P3.2 Verified Contracts" badge).
     - Academic year switcher ("Năm học 2025 - 2026" / "Năm học 2026 - 2027").
     - Single primary action: "+ Mở Lớp Học Mới" in unified brand green (`#075548`).
     - Overflow actions menu (three dots button next to create button).
  2. **4 Compact Neutral KPI Stat Cards:**
     - Tổng số lớp (4 lớp) with green icon.
     - Tổng học sinh (86 bé) with blue icon.
     - Chỗ trống còn lại (7 chỗ) with orange icon.
     - Tỷ lệ lấp đầy (92%) with purple icon and mini progress bar.
  3. **Two-Tier Search & Filter Bar:**
     - Row 1: Search input ("Tìm tên lớp, giáo viên, phòng học..."), Grade selector ("Tất cả khối"), Status selector ("Tất cả trạng thái"), and filter settings button.
     - Row 2: Grade pill tabs with dynamic counts: "Tất cả lớp (4)", "Nhà Trẻ (1)", "Khối Mầm (1)", "Khối Chồi (1)", "Khối Lá (1)".
  4. **Refined Classroom Cards (Grid):**
     - Class mascot icon/illustration (Họa Mi, Thỏ Ngọc, Vàng Anh, Gấu Misa).
     - Grade & capacity threshold badges ("Còn 3 chỗ", "Gần đầy (Còn 1 chỗ)", "Đã đầy").
     - Teacher row with avatar & room info.
     - Single clean capacity progress bar.
     - Flat "Điểm danh hôm nay" section (Có mặt, Có phép, Chưa báo, Cảnh báo SK) without heavy nested container boxes.
     - Health alert badge ("♥ 1 lưu ý sức khỏe") placed as an operational annotation, clarifying it is not an attendance subset conflict.
     - Student roster avatar stack (6 student photos + count badge like `+18`).
     - Primary button "Điểm danh" in brand green (`#075548`) and secondary action "Vào lớp học →".
  5. **Tenant Scoping Guard:**
     - Detect `isPreschoolTenant` via `getCachedTenantSettings()` and `resolveTenantBrandIdentity()`.
     - Non-preschool tenants retain the existing general layout; preschool tenants receive the Image 3 layout.
  6. **Strict Typing Guard:**
     - Zero `any` or `unknown`.

---

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Data / Component | Owner | Boundary & Scope |
|---|---|---|
| Classroom UI (`courses/page.tsx`) | Preschool Product UI (`src/app/dashboard/education/courses/`) | Redesign to match Image 3 for preschool |
| Classroom API (`api/education/courses`) | Education Module API | Unaltered contract; consumed by client |
| Course & Enrollment Aggregates | Education OS Kernel | Frozen contract; consumed via API |
| Tenant Settings & Brand Theme | Core Platform Context | Read-only access via `getCachedTenantSettings` |
| Healthcare OS & Logistics OS | Respective Kernels | 100% Frozen & untouched |

---

## 4. Contract Dependency Map

```text
Preschool Classroom Page (src/app/dashboard/education/courses/page.tsx)
   │
   ├─► Client Context: getCachedTenantSettings() ──► resolveTenantBrandIdentity()
   │     └─► isPreschool: boolean (moduleKey === 'bella_education')
   │
   ├─► API Route: GET /api/education/courses
   │     └─► edu_courses, courses, edu_enrollments, preschool_classrooms
   │
   └─► API Route: POST /api/education/courses
         └─► TeacherAssignmentContractImpl -> create classroom
```

---

## 5. Change Authority

- **Authorized to Modify:**
  - `src/app/dashboard/education/courses/page.tsx`
  - `ARCHITECTURE_GATE_RESULT.md`
- **Strictly Prohibited:**
  - Modifying files in `src/platform/**` (Kernel freeze lock).
  - Modifying database schemas, tables, or running database migrations.
  - Adding `any` or `unknown` types.
  - Modifying non-preschool views.

---

## 6. UI -> Contract Reconciliation

| UI Element in Image 3 | Contract Source | Binding Strategy |
|---|---|---|
| Page Title: "Quản lý lớp học" | Localized Title | Fixed UI text for Preschool vertical |
| Subtitle: "Theo dõi sĩ số..." | Localized Subtitle | Fixed UI text for Preschool vertical |
| KPI: Tổng số lớp | `classList.length` | Aggregated from `ClassItem[]` |
| KPI: Tổng học sinh | `classList.reduce(students)` | Aggregated from `ClassItem[]` |
| KPI: Chỗ trống còn lại | `classList.reduce(max - students)` | Aggregated from `ClassItem[]` |
| KPI: Tỷ lệ lấp đầy | `(students / max) * 100` | Aggregated percentage with rounded math |
| Classroom Mascot | `cls.gradeKey` / `cls.id` | Mapped to thematic preschool mascot illustration |
| Teacher Avatar & Details | `cls.teacher` | Mapped from teacher assignment |
| Capacity Progress | `cls.students / cls.maxStudents` | Single capacity progress bar with threshold color |
| Attendance Numbers | `cls.todayStatus` | Present, excused, unmarked, healthAlerts |
| Health Alert Badge | `cls.todayStatus.healthAlerts > 0` | Rendered as "♥ N lưu ý sức khỏe" badge |
| Student Avatar Stack | Mock / Roster Preview | Rendered with 6 child avatar portraits + overflow counter |
| Action: "Điểm danh" | Link `/dashboard/education/attendance` | Primary action with brand green `#075548` |
| Action: "Vào lớp học →" | Link `/dashboard/education/courses/[id]` | Secondary action |

---

## 7. Additive Migration Plan

- **Migrations Needed:** NONE (0).
- Pure UI and client presentation refactoring without any database mutations.

---

## 8. 11 Automated Verification Gates Plan

1. **Gate 0 (P0 - Multi-Tenant Isolation):** Verified via tenant filtering in API and client brand checking.
2. **Gate 1 (Zero-Cheating Types):** Verified with `tsc --project tsconfig.education.json` and explicit grep for `any` / `unknown`.
3. **Gate 2 (Kernel Freeze Compliance):** No files in `src/platform/` or `src/core/` are edited.
4. **Gate 3 (Lint & Quality):** Pass ESLint checks.
5. **Gate 4 (Public Contract Adherence):** API consumption matches `/api/education/courses`.
6. **Gate 5 (Visual Regression & UX):** Matches Image 3 hierarchy and styling tokens.
7. **Gate 6 (Interactive Verification):** Modal create class, filter tabs, search, and navigation links operate smoothly.
8. **Gate 7 (Theme Consistency):** Primary green `#075548` used consistently for primary buttons and active pills.
9. **Gate 8 (Performance):** Zero unneeded re-renders, lightweight markup without excess containers.
10. **Gate 9 (Accessibility & Responsive Layout):** Keyboard focusable, ARIA attributes, responsive 1-col to 2-col grid.
11. **Gate 10 (Non-Preschool Fallback):** Safe conditional rendering for other tenant modules.

**CONCLUSION: PASS.** Coding phase authorized.

---

# PR #344 Execution Follow-up - Adopt Main BDGF Connection Contract

Status: PASS for adopting main's BDGF connection contract from PR #343 when
resolving the PR #344 conflict. The initial E2E execution investigation identified
an old parser excluding reserved password characters; main independently repaired
it through createBdgfDatabaseConfig with verified TLS and executor identity checks.

Truth/contract: PostgreSQL connection URIs percent-encode reserved password
characters. Main's createBdgfDatabaseConfig owns parsing/TLS, and
assertExecutionIdentity owns executor-role verification. Owner: BDGF scripts.
Resolve by reusing these implementations unchanged, not retaining duplicate parser
logic. Preserve the approval/hash/environment/token boundaries and main regressions.
No gate invariant, signing rule, authority matrix, credential or frozen spec change.
UI/migration plan: only the explicitly approved existing E2E workshop migration
and its normal ledger bookkeeping. No direct executor SQL or secret persistence.

---

# PR #344 Follow-up Gate - Phase 6 Test Contract Repair (2026-10-16)

Status: PASS for the user's request to fix all PR errors, including the previously
deferred Phase 6 diagnostics. The eight sections in the recovery gate below still
apply, with this scoped extension:

- Manifest/ownership: existing workshop QA fixtures only, owned by AutoMove QA.
- Truth: number RPC results are nullable on failure; reject error/null before
  insertion. `auto_service_history.service_description` is the canonical field.
- Independent semantic authority: `docs/bella-auto/DATABASE_SCHEMA_DOCUMENTATION.md`
  declares service history append-only, with no UPDATE/DELETE. The schema and
  `20261013120000_create_mobility_os_foundation_contract.sql` provide read/tenant
  contracts. A service-role attempt with a nonexistent field does not prove RLS.
- Contract: authenticated JWT -> same-tenant history read -> update denied or zero
  affected rows -> privileged observer verifies the persisted description unchanged.
- Authority: repair test narrowing, real field selection, fixture ownership/cleanup,
  focused test config and evidence. No application behavior/schema/RLS changes.
- UI reconciliation: no additional UI change. Migration plan: none.
- Positive/negative test contract: inserted history must be readable by the owning
  tenant; a valid-column UPDATE must leave it unchanged. Missing history cannot skip
  the assertion. Existing vehicle/tenant are read only; all created rows are tracked
  by test-generated IDs and cleanup is limited to those IDs and the same tenant.
- Verification: preserve the previous 11 gates; strict-check the complete Phase 6
  suite, run it only on verified canonical E2E, and retain DB/RLS failures as failures.

---

# Architecture Gate - Recover Auto Workshop Tenant Filters (2026-10-16)

Status: PASS for scoped local recovery; execution evidence is recorded separately.
Base: origin/main 5483cc55e. Source checkout: f6ed9cec7, dirty Manufacturing branch.

## 1. Bella OS/Product Development Process Gate
Problem: security filters and regression evidence were left only in the old checkout.
Truth/source: Bella Constitution sections 30/31 require tenant isolation; existing
workshop policies and migration 20261013090000 enforce the database boundary.
Reuse main's RLS migration unchanged. Recover only missing consumer filters.
No business lifecycle or accounting meaning changes. MULTI_AGENT = OFF.

## 2. Product Manifest
Bella Auto/AutoMove workshop appointments and repair orders. Existing capability
only: check-in, cancel, reschedule, repair handoff, technician assignment, totals,
and reminders. No new Product, OS, registry entry, finance or Manufacturing work.

## 3. Ownership Map
Workshop tables/UI/services: Bella Auto Product. Tenant identity/RLS: Platform
security, consume unchanged. Tests: Product QA. No kernel/Core changes authorized.

## 4. Contract Dependency Map
Workshop UI/services -> existing Supabase Product table access -> tenant_id
predicate plus existing authenticated get_auth_tenant_id() RLS policy.
No Healthcare/Education/Logistics kernel dependency or direct access.

## 5. Change Authority
User authorized separating missing changes from dirty checkout into fresh worktrees
and verification. Allowed: three workshop consumer files, focused regression tests,
Phase 6 fixture dates, this gate and evidence. No DB deployment or migration edits.

## 6. UI -> Contract Reconciliation
Check-in/cancel/reschedule/repair handoff: MATCH for existing fields/statuses;
STALE UI for omitted tenant predicate. Add tenant_id to the existing query only.
No visual redesign, new actions, permissions or business state transitions.

## 7. Additive Migration Plan
None. Existing RLS migration is already on main with a safer guarded COMMENT.
Do not copy the untracked older migration or stale NOT_READY closure as current.

## Business Test Contract
Invariant: reads/mutations for an object ID also carry the caller tenant context.
Authority: Constitution tenant-isolation invariant and existing workshop policy.
Positive: authorized same-tenant query retains its existing operation and ID.
Negative: an ID alone must never be sufficient for the eight recovered queries.
Persistence: existing RLS remains the enforcement boundary; mocks/static evidence
are local consumer proof only. DB/RLS/browser/production remain NOT_PROVEN here.
Fixture date authority: phase6 number generators count rows for CURRENT_DATE;
fixtures must use the current date, not the old 2026-08-09 literal.

## 8. Eleven Automated Verification Gates Plan
1. Record base/branch/worktree and original checkout fingerprints.
2. Confirm only three Product consumers and focused tests change.
3. Static regression covers each affected query without crossing statements.
4. Service execution tests observe ID and tenant predicates on calls.
5. Existing RLS migration remains unchanged.
6. No new any/types/suppressions or public contracts.
7. Focused Jest tests and negative control on unmodified main sources.
8. Targeted ESLint.
9. Fresh TypeScript check; classify pre-existing failures separately.
10. Architecture guard and diff whitespace checks.
11. Evidence report with exact commands; Real DB tests require isolated target.

---

# PR #345 Follow-up Gate - Runtime Fixture Contract Repair (2026-10-16)

Status: PASS for the user's request to fix all PR errors, including the previously
deferred missing import. The eight recovery-gate sections below remain applicable.

- Scope/owner: Runtime QA helper fixtures and their mock consumer, not Finance,
  Healthcare or Education product/kernel behavior.
- Canonical contract: public `types/financial-intent.types.ts` / exported types;
  `FinancialIntentSchema` requires a Date and top-level source. Do not invent a
  runtime-domain compatibility file or widen the runtime contract.
- Semantic evidence: Runtime architecture v1.1 and Phase 3C test plan require
  structural validation and explicit rejection of malformed effectiveDate. Valid
  fixtures follow the public type; malformed raw input remains deliberately invalid.
- Authority: update two stale helper imports, Date/source fixture values, focused
  tests/typecheck configuration, evidence. Preserve existing rejection assertions.
- Dependency: QA helper -> public FinancialIntent contract -> existing validator;
  no Kernel access, schema, RPC, RLS or implementation changes. No UI/migration.
- Test contract: valid fixtures and overrides satisfy the existing public schema;
  malformed date/currency/missing-tenant inputs still fail the existing validator.
- Verification: existing 11 gates plus complete Security E2E entrypoint typecheck,
  fixture regressions and Real DB Security E2E on verified canonical project
  `bmnbqbcdbuklhopfbopv`, with JWT_E2E mapped process-only to SUPABASE_JWT_SECRET.
  No secret values or environment files may be persisted in either worktree.

---

# Architecture Gate - Recover Runtime Security E2E Coverage (2026-10-16)

Status: PASS for test/harness-only recovery from origin/main 5483cc55e.

## 1. Bella OS/Product Development Process Gate
Truth/source: migration 20261011193000_fix_runtime_submit_financial_intent_schema.sql
and BELLA_RUNTIME_TRANSACTION_ARCHITECTURE_DECISION_V1_1_CORRECTED.md define the
current submit_financial_intent contract. Recover explicit payload coverage while
retaining main's default-metadata and structural-validation assertions.
MULTI_AGENT = OFF. No Runtime/RPC/schema/business semantics change.

## 2. Product Manifest
No Product. Integration/Common Runtime security E2E consumer and Vitest env loader.
Scope: opt-in env-file selection and explicit correlation/entity/source coverage.

## 3. Ownership Map
RPC/runtime tables: Integration/Common Runtime, read only. E2E and env selection:
QA harness. Credentials: environment owner, consume only, never persist/disclose.

## 4. Contract Dependency Map
Security E2E -> tenant JWT -> submit_financial_intent(text,text,jsonb) -> runtime
outbox.id, registry.outbox_id/correlation_id, audit correlation/entity/source.
Server derives tenant/actor. No Product -> private Kernel bypass.

## 5. Change Authority
Recover missing test/harness changes into fresh worktree, retaining stronger main
checks. Authorized files: Vitest config, Runtime Security E2E, focused env-loader
regression test and gate/evidence.
No migrations, runtime implementation, auth/RLS changes, seeds or DB deployment.

## 6. UI -> Contract Reconciliation
Not applicable: no UI/data/action change.

## 7. Additive Migration Plan
None. Current migration is the contract evidence and must remain unchanged.

## Business Test Contract
Authority: Runtime architecture decision defines atomic outbox/idempotency/audit
writes, JWT tenant identity, duplicate rejection and privilege boundary.
Positive: explicit correlation/entity/source are persisted across the three rows;
existing main tests continue to prove server defaults when those are omitted.
Negative: empty intent_type rejected; anon submission rejected; duplicate blocked.
No removed assertions or widened business rules. No ledger/posting semantics.

## 8. Eleven Automated Verification Gates Plan
1. Record exact main base and isolated branch.
2. Verify current RPC field/default mappings.
3. Preserve main tests and assertions; add explicit metadata case.
4. Verify JWT-derived tenant and actor preconditions remain unchanged.
5. Keep idempotency/atomicity/privilege tests intact.
6. No schema/RPC/RLS/runtime implementation diff.
7. No new any/suppression or frozen/Core changes.
8. Executable env-loader precedence/default/override checks without credentials.
9. Scoped lint and TypeScript checks.
10. Run Runtime E2E only with proven isolated target + required JWT secret;
    absent preconditions mean NOT_PROVEN, never skip-as-PASS.
11. Record evidence/limitations and diff checks.

---
# Architecture Gate - Customer Loyalty Read-Only (2026-10-15)

## AutoMove Sales Settlement Readiness - 2026-10-15

Baseline: main 9503feaea10806424ffc6cd2944617d70fda903a (sealed PR 332).
Single-agent execution. Result: PASS for the proven cancelled/refunded booking
deposit blocker and the subsequently owner-approved post-sale receipt scope.
This is not a Product MVP or Go-Live seal.

### Process Gate, Manifest and Business Semantic Proof

- Goal authorized by the owner: complete the remaining vehicle-sales chain on
  Non-Production, preserving previously proven capabilities and Production safety.
- Canonical business source: the approved separation of payments and recognition,
  and the revenue contract's prohibition on proceeding with cancelled/refunded
  bookings (AUTOMOVE_VEHICLE_SALE_REVENUE_CONTRACT_2026_10_14.md, recognition
  preconditions and cancellation/refund sections).
- New evidence: on the isolated E2E project, the actual authenticated deposit
  command accepted a NEW 30,000,000 VND receipt for a cancelled booking and
  increased deposit_paid from zero. The entire probe rolled back; fixture tenant
  count after rollback was zero. This is a newly proven defect, not a reopening
  of PR 332 or an assumption that an earlier deposit proof was false.
- Invariant: a cancelled/refunded booking cannot accept a new deposit. An exact
  retry of an existing, still-confirmed receipt is a read, not another collection;
  payload conflict or a refunded receipt must still fail the existing binding.
- Persistence: reject before receipt insertion or balance mutation, while holding
  the same booking row lock already used by the command. No new state machine.

### Ownership, Contracts, Authority and UI Reconciliation

| Capability/data | Owner | Public path / change authority |
| --- | --- | --- |
| Auth identity and active tenant | Platform | existing Auth -> users -> tenants; unchanged |
| Booking and deposit receipts | AutoMove Product | authenticated confirm-deposit API -> existing transaction command |
| Vehicle allocation/handover | Mobility OS | existing public contract; regression only |
| Recognized financial history | AutoMove Product | immutable recognition/adjustment tables; unchanged |
| Actual Finance cash/AR posting | Finance OS | existing public allocation contract; not invoked or modified |

UI confirm-deposit -> HTTP dispatcher -> confirmBookingDeposit -> existing RLS
transaction. The local fix changes only rejection of a new invalid operation;
success/retry response and tenant resolution remain unchanged. No new UI action
or amount field is introduced. Contract/API/Platform/kernel changes: none.
Additive migration plan: NONE for this blocker; no schema/grants/RLS changes.

The read-only E2E schema inspection confirmed recognition snapshots, adjustment
history and deposit receipts, but no AutoMove post-sale payment receipt relation.
The existing Finance confirmed-payment allocation path posts a cash transaction;
it is not a read-only substitute and is outside the prior no-Finance-posting
authority. Do not repurpose deposit receipts, refund adjustments, metadata, a
Beauty revenue RPC or immutable recognition totals as a payment subsystem.
Settlement/refund authority and its canonical persistence must be approved before
implementing that missing capability.

### Owner-Approved Post-Sale Receipt Implementation

The subsequent owner decision authorizes one additive Non-Production receipt
table, tenant/RLS enforcement, payment API/UI and internal reconciliation. It
does not authorize Finance posting, refund/forfeiture rules or Production access.
Result: PASS for this concrete implementation scope; not Go-Live approval.

- AutoMove owns operational receipt facts, not Finance cash/AR projections.
  Reuse the active tenant accountant authority from the sale-chain contract.
- One table: auto_vehicle_sale_payments. Immutable receipt references the existing
  recognition and booking. Positive integer VND amount, server receipt time/actor,
  method/reference/notes, tenant-scoped unique idempotency UUID and external
  transaction reference. No mutation of deposits or recognition snapshots.
- Source of amount due: recognition plus existing signed sale-price adjustments,
  less confirmed deposit receipts and persisted post-sale receipts. Never use
  current list_price/cost_price or booking.total_price as the sale amount.
- Internal reconciliation compares booking deposit_paid with confirmed receipt
  sum, recognition arithmetic/payment snapshot and current collections. Missing,
  duplicate references and overcollection are MISMATCH, not a successful zero.
  This is not bank-statement or Finance-ledger reconciliation.
- Refund/reversal-bearing adjustments or refunded/cancelled booking block new
  collection pending the separately approved refund policy. Existing exact receipt
  retry remains a read; a reused key with changed intent is a conflict.
- API derives actor/tenant from Auth and users, validates amount, serializes by
  booking, and reads the committed receipt back. Database guard independently
  enforces identity, ownership, totals and cap for direct authenticated inserts.
- UI uses the existing sale dossier, a separate payment form and persisted receipt
  list/reconciliation. Errors retain the same intent key and never show success.
  Reload reads DB; collection never emits PACKAGE_SALE or recognizes revenue.
- Verification extends the existing rollback verifier and actual Next.js sales
  chain with partial/full collection, sequential/concurrent retry, changed intent,
  overpayment, inactive/wrong-role/tenant/anonymous denial, integrity mismatch,
  append-only constraints and transaction failure rollback. PR CI must run it.
- Migration safety: one new product table/function/index/policy only; existing
  history/helpers/Finance/kernel unchanged. Apply only to verified isolated E2E
  after static checks, with explicit transaction and migration history via the
  repository's changed-migration mechanism. Never invoke Production URLs.

SETTLEMENT_IMPLEMENTATION_AUTHORITY = APPROVED_NON_PRODUCTION_ONLY
ADD_NEW_RECEIPT_SCHEMA = AUTHORIZED_MINIMAL_ADDITIVE_SCOPE
REFUND_POLICY_OR_FINANCE_POSTING = NOT_AUTHORIZED

### Eleven Verification Gates Plan

1. Architecture: scoped diff and Architecture Guard; no frozen/kernel changes.
2. Contract: existing API/response and sequential/concurrent idempotency preserved.
3. Tenant: existing A/B rejection remains exercised by the Real DB verifier.
4. Authorization: active identity/tenant checks remain before receipt access.
5. Migration: the deposit guard needs no schema changes. The subsequently
   approved post-sale scope adds migration 20261015020000 and the subsequently
   proven cap guard 20261015020100; existing migrations/helpers stay intact.
6. Persistence/events: invalid operation writes zero receipts/balance changes;
   injected-write-failure rollback still passes; no financial event emitted.
7. Business: new receipts denied after cancellation/refund, including an amount
   that would otherwise fit the remaining deposit; independent valid deposits work.
8. History: existing confirmed receipt remains unchanged across cancellation/retry.
9. Retry: exact receipt replays, changed payload/refunded receipt conflicts remain.
10. Real DB: isolated E2E only, verified TLS, transaction rollback and zero residual
    fixture tenants/Auth rows; no Production connection or mutation.
11. Regression: focused service/HTTP/API/UI tests, typecheck, lint, diff-check and
    the existing actual Next.js deposit browser regression where executable.

### Executed Evidence and Current Boundary

- Before the fix: isolated authenticated Real DB reproduction accepted a new
  30,000,000 VND receipt for a cancelled booking; rollback left zero fixture
  tenants. Three new unit cases failed on the unmodified command.
- After the fix: 10 focused suites / 100 tests PASS. Covers active identity,
  changed payload, refunded receipt, cancelled/refunded booking, exact receipt
  replay, allocation, recognition, reporting and UI retry regressions.
- Existing Real DB transaction verifier PASS, including
  DEPOSIT_CLOSED_BOOKING_DENIAL_AND_EXISTING_RECEIPT_RETRY=PASS. Rejected commands
  leave the full booking/receipt records unchanged. Injected-write failure and
  rollback, independent deposits, caps, tenant/inactive denial still PASS.
  Final rollback verifies zero fixture tenants and Auth actors.
- Actual Next.js + Chromium specs 42 and 43: 2/2 PASS (4.4 minutes, no skips or
  flaky retries). The dashboard sale chain still recognizes exactly one 1.4B VND
  sale; API closure tests return HTTP 409 with BOOKING_CLOSED_FOR_DEPOSIT, persist
  no new receipt/credit, and allow the exact previously confirmed receipt retry.
  Sequential/concurrent retry, independent collections and cap tests still PASS.
  Browser fixture Auth removed and tenants archived. Desktop/mobile inspected.
- Full strict application typecheck PASS; separate changed test/verifier/E2E
  compiler check reports zero diagnostics. Focused ESLint, Architecture Guard and
  git diff --check PASS. Single-agent scoped diff review: no additional blocking
  path in the changed guard; no independent multi-agent sign-off is claimed.
- No Production query, mutation or deployment; no migration, grants/RLS,
  Finance posting, ProductRegistry or kernel changes. No commit/push/PR performed.
  Existing legacy inventory/delivery RPC errors remain outside this proof.
- These are local Non-Production results, not main/release Browser CI or Go-Live
  proof. The missing post-sale settlement source is not repaired by this guard.

### Post-Sale Receipt Verification Checkpoint

Final cross-entry review reproduced a further cap defect: after post-sale receipts
fully settle the recognized amount, a new deposit still succeeds when the booking
deposit limit is not full. The probe rolled back. Existing receipt retries are
not new collections. Within the approved total-collection/reconciliation scope,
add forward migration 20261015020100 (do not edit the applied receipt migration):
a deposit INSERT/financial UPDATE guard locks the same booking and caps confirmed
deposits plus post-sale receipts against the canonical recognized amount. Preserve
existing deposit grants/RLS and pre-sale behavior; no refund/forfeiture semantics.
Acceptance requires direct DB and actual API denial, unchanged receipt history,
and a valid deposit below the combined cap.

- Forward guard applied only to isolated E2E via the same transaction-wrapped
  migration applier. Rollback proof passes both additional valid deposit/retry
  and denial of deposit INSERT/amount UPDATE after full settlement. Neither
  deposits nor recognition snapshots change after the rejected operations.
- Seventeen focused suites / 159 tests, strict application compiler, ESLint,
  Architecture Guard and zero-downtime checks PASS for the guard delta.
- Fresh Playwright-owned Next.js server: both actual browser specs PASS (2/2,
  3.6 minutes, zero skipped/flaky retries). Combined cap API denial returns 409
  with no additional deposit credit. Receipt read-back, retry/concurrency,
  full collection, completed dossier, dashboard revenue and deposit regressions
  pass. Desktop/mobile screenshots inspected. A reused-preview run stopped at
  login before any business operation and is NOT PASS; Auth/login assertions
  were not bypassed or weakened in the successful fresh-server run.

- Migration 20261015020000 passed the zero-downtime checker and was applied ONLY
  to isolated E2E via the existing explicit-file applier, wrapped in a transaction
  and the existing verified-TLS/non-Production connection guard. Read-only
  read-back confirms that exact version in migration history and RLS enabled.
  One new table; no mutation of previous migrations or Finance schema.
- Actual rollback verifier PASS: partial/full receipts, exact retry, altered-key
  intent, reused external reference, cap, anonymous/wrong-role/inactive/cross-tenant
  denial, database-trigger cap/identity denial, UPDATE/DELETE denial and immutable
  trigger even under the proof connection. Injected failure after INSERT rolls
  back the receipt. Missing/duplicate deposit facts and unresolved refunds are
  detected. Final rollback leaves zero fixture tenants and Auth actors.
- 15 focused suites / 149 tests PASS. Covers service, HTTP transaction/auth/error,
  UI uncertain acknowledgement/remount retry, completed-booking access, receipt
  schema safety, CI selector and existing deposit/recognition/reporting regression.
- Actual Next.js/Chromium: latest clean run 2/2 PASS (4.1 minutes, zero skips and
  zero automatic/flaky retries). Browser simulates loss of the response AFTER
  actual HTTP commit; UI shows an error, retains the same key, and recovers the
  one existing receipt. Concurrent same-key and independent requests, duplicate
  reference/overpayment denial, mismatch blocking, full settlement to zero and
  completed-dossier read-back pass against independently queried DB records.
  Recognition and deposit history remain unchanged; revenue remains 1.4B VND.
  Desktop/mobile receipt screenshots inspected. Auth removed and tenants archived.
- Earlier local attempts: cold-route compilation exceeded a message assertion;
  test now awaits the actual operation response before checking success. Another
  pre-fixture connection attempt timed out, and an earlier deposit retry returned
  HTTP 500 without an attributable business error. Those attempts are NOT PASS;
  the fresh complete run and DB proof above succeeded without TLS weakening or
  test skips. This is not a claim that the network cannot fail.
- Focused ESLint, separate strict compiler check for new tests/verifier/browser,
  Architecture Guard and whitespace diff check PASS. Fresh full strict application
  compiler (no incremental cache) exited 0 for the final diff before commit.
- Internal receipt reconciliation is NOT bank-statement reconciliation, a Finance
  cash/AR position, or posting proof. Refund/forfeiture semantics, Finance posting
  and Production adoption still require separate authority. Full release browser
  proof on main is not inferred from this local run.

IMPLEMENTATION = IMPLEMENTED_LOCAL_VERIFIED_POST_SALE_RECEIPTS
DEPOSIT_CLOSED_BOOKING_NEW_COLLECTION = DENIED_PROVEN_ON_E2E
POST_SALE_PAYMENT_PERSISTENCE = PROVEN_ON_E2E
SETTLEMENT_IMPLEMENTATION = LOCAL_VERIFIED_PENDING_PR_CI
MAIN_SEAL = NOT_PERFORMED
PRODUCTION_MUTATION = NOT_AUTHORIZED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY

## AutoMove Dashboard Recognized Sales Read Alignment - 2026-10-15

Architecture result: PASS for the owner-approved E2E-only implementation.
Baseline: 49f78e358817bb3991f699cc678204a3bd5ea8f9. Single-agent execution.
Local implementation/evidence are recorded below; this is not a main or Product MVP seal.

### Process, Product Manifest and Business Test Contract

- Source: explicit owner approval in this conversation, sealed recognition
  contracts from PRs 319-321/327/329, recognition/adjustment migrations.
- Capability: monthly recognized vehicle revenue and top models on the actual
  dashboard, reusing FinancialReportingService and Mobility display.
- Invariant: booking completion, deposits and handover alone are not revenue.
  Only recognition snapshots plus existing approved adjustment semantics count.
  Current vehicle prices never rewrite historical sale/cost snapshots.
- Period: recognized_at, six UTC calendar months including this month. Top-model
  counts retain the existing all-time scope but count recognition transactions.
- Negative cases: missing/inactive identity or tenant, cross-tenant reads, query
  errors, missing display rows, repeated reads, unrecognized bookings/deposits.
- Expected amounts come from approved fixtures and independent ledger read-back.
  An error is never a verified zero.

### Ownership and Contract Dependency Map

| Data | Owner | Access |
| --- | --- | --- |
| Identity / active tenant | Platform | Auth getUser -> public.users -> tenants |
| Recognition / adjustment history | AutoMove Product | existing reporting service, authenticated RLS client |
| Vehicle/model display | Mobility OS | listMobilityVehicleDisplayByIds |
| Chart, loading, error state | AutoMove UI | authenticated read API -> reporting service |

Dashboard -> authenticated AutoMove API -> FinancialReportingService -> canonical
recognition/adjustment reads + public Mobility display. No client-supplied tenant,
price or policy establishes authority.

### Change Authority and UI Reconciliation

Approved: Product reporting client binding, one read API, sales charts/counters,
focused tests, E2E proof and this checkpoint. Reuse this approved scope as the
implementation specification; no additional approval document or architecture gate.
Remove legacy sales RPC calls from these consumers; preserve inventory/delivery
analytics. Label actual periods; omit nonfunctional filters on these two charts.
Missing vehicle display must not remove a recognized sale. Screenshot review also
identified the first-viewport AutoAnalyticsCharts hardcoded financial counters and
monthly series. Bind them to the same authenticated response, without duplicating
requests. Remove fabricated financial growth and salesperson amounts; do not infer
salespeople from recognition actors. Lead funnel/response metrics remain outside
this implementation/proof and must not be claimed as verified.

Forbidden: migrations/schema/grant/RLS changes, Production access/deployment,
Finance posting, commission, Warranty, ProductRegistry, shared helpers or kernels.
Additive migration plan: NONE; stop at a proven schema gap.

### Eleven Verification Gates Plan

1. Architecture: arch:guard and scope-only diff.
2. Contract: aligned charts no longer consume booking-based sales RPCs.
3. Tenant: actual authenticated A/B clients; server-derived tenant.
4. Authorization: missing/inactive actor or tenant fails closed.
5. Migration: no migration or generated-type changes.
6. Persistence/events: read-only runtime, no events/postings/snapshot updates.
7. Business: canonical amounts/deltas; preserve missing display rows.
8. Temporal: UTC month/year boundaries, historical cost immutability.
9. Retry: repeated recognition/read keeps one sale and stable totals.
10. Evidence: actual reporting service on non-Production DB and actual Next.js
    browser UI, explicit error states, append-only fixture history preserved.
11. Regression: focused tests, reporting/sales-chain regression, full typecheck,
    focused lint and git diff --check.

### Local Verification Checkpoint

- Actual service verifier: PASS with two real Supabase Auth sessions, public-key
  RLS reads, independent ledger comparison, current/historical periods, approved
  adjustment deltas, current-cost mutation immunity, stable retries and denial for
  anonymous/inactive actor/inactive tenant. Fixture Auth removed; financial history
  preserved under archived E2E tenants. No DDL, migration or policy seed performed.
- Actual Next.js/Chromium: specs 42 and 43 PASS (2/2, zero skips/flaky). Spec 42
  proves a completed but unrecognized booking contributes zero; deposit/handover
  alone remain zero; explicit recognition and retry produce one 1.4B VND sale;
  API, executive counters and monthly UI agree with independent ledger read-back.
  Reload stays 1.4B; desktop/mobile screenshots inspected. Spec 43 re-verifies
  deposit sequential/concurrent retries, independent payments and overpayment.
- Focused service/API/component/selector regression: 15 suites / 131 tests PASS. Full strict application
  typecheck, separate changed verifier/test typecheck, focused ESLint, Architecture
  Guard and diff whitespace check: PASS. CI selector includes this actual-service
  verifier for dashboard/API/service changes; remote CI has not run for this diff.
- Pre-existing E2E gaps: inventory trend, inventory stats and weekly-delivery RPCs
  are absent (PGRST202). Their existing fallback UI is not verified by this batch.
  Lead funnel/response metrics remain legacy/unverified. These are not recognition
  errors and are not repaired or converted to PASS here.

IMPLEMENTATION = IMPLEMENTED_LOCAL_VERIFIED
READ_SIDE_RECOGNIZED_SALES = PROVEN_ON_E2E_FOR_APPROVED_SCOPE
FINAL_REVIEW = PASS_SCOPED_LOCAL_REVIEW
COMMIT_PUSH_PR = AUTHORIZED_AFTER_FINAL_REVIEW
MAIN_SEAL = NOT_PERFORMED
SCHEMA_MIGRATION = NOT_PERFORMED
PRODUCTION_MUTATION = NOT_AUTHORIZED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY

Final review (2026-10-15): no blocking finding in the scoped local review.
Rechecked 15 suites / 131 tests, Architecture Guard and diff-check: PASS.
No legacy revenue RPC fallback, client tenant authority, schema/kernel changes or
out-of-scope runtime repair. Existing Real DB and Browser evidence above remains
non-Production/local evidence; PR CI and merge-SHA verification are still required.
This was a single-agent review, not independent multi-agent sign-off.

Status: PASS for application customer-profile write protection. Single-agent.

## Follow-Up Gate - Official KTV Accounts for AI (2026-10-15)

Result: PASS for booking-service eligibility and suggestion action boundaries.

- Development process / business truth: the user explicitly requires AI to use
  only officially authorized KTV accounts. Staff provisioning in `createUser`
  creates Auth first, then a tenant profile with the same ID and assigned role.
  `@bella/shared` owns the KTV / KTV lead role group. Auth existence alone does
  not grant a technician role; profile metadata or display names grant nothing.
- Product manifest: existing shared Spa/BabyCare AI recommendations and applying
  their selection. Keep ranking, capacity rules, product identity and UI intact.
- Ownership: Auth owns login identity/ban/deletion; staff profiles own tenant,
  assigned role, active status and resignation; booking services own eligibility.
- Contract map: booking suggestion / auto-assignment -> local booking eligibility
  -> authenticated tenant-scoped profile query + existing Auth Admin getUserById
  contract. Never query auth tables or use an admin client for profile reads/writes.
- Change authority: add a boundary-local eligibility helper, consume it before
  ranking and again before applying a selected KTV, enforce the documented admin
  selection action, and test negative cases. No changes to Platform, Auth/RLS,
  organization contracts, staff provisioning/data, score algorithms or kernels.
- UI -> contract: cards contain only verified candidates; stale/tampered choices
  are rejected on save. An unverifiable identity cannot fall back into results.
- Migration plan: none; no schema, policy, RPC, production mutation or data cleanup.

Business Test Contract: a same-tenant active, non-resigned KTV/KTV lead with a
matching non-deleted, non-anonymous, non-banned Auth identity may be ranked.
Missing Auth, wrong role/tenant, inactive/resigned or locked identities cannot be
ranked or selected. Missing verifier credentials / unexpected Auth errors fail
closed. Selection requires an active tenant admin and a tenant-owned booking.

Eleven verification gates:
1. Scope / architecture guard: no frozen/Core/Platform edits.
2. Contract: typed existing users fields and Auth Admin API only.
3. Tenant: reject mismatched caller; candidate reads always tenant-scoped.
4. Authorization: canonical technician roles and admin selection enforcement.
5. Migration: no SQL or schema changes.
6. Identity: missing, mismatched, deleted, anonymous and banned accounts excluded.
7. Fail-closed: verifier absence/errors never yield unverified candidates.
8. Ranking: only eligible candidates reach the unchanged provider.
9. Write: recheck eligibility; rejected/stale IDs cause no booking update.
10. Quality: focused Jest, ESLint, full typecheck, diff and architecture guards.
11. Evidence: distinguish mock boundary tests from read-only live verification;
    no production assignment or account mutation for proof.

## Development Process and Business Semantic Gate

User-approved invariant: loyalty is calculated automatically; the customer editor
must not allow manual changes. Live read-only catalog inspection proved active
revenue trigger `trg_calculate_loyalty_points` -> `tr_calculate_loyalty_points` ->
`increment_loyalty_points`. Confirmed booking revenue awards floor(amount/100000).
The five screenshot customer balances match current confirmed-receipt totals.
This task does not change that earning policy or claim refund/reconfirmation safety.

## Product Manifest

Existing shared BabyCare/Beauty customer profile: read loyalty, edit ordinary
profile fields. No new product, loyalty engine, points adjustment workflow or UI.
The KTV question is a read-only origin investigation, not staff cleanup authority.

## Ownership Map

- Revenue trigger owns automatic points accrual and persisted balance changes.
- Customer UI owns display and editable profile data, not points calculation.
- Customer actions own accepted profile write fields and their audit rollback.
- Identity/staff provisioning owns staff validity; no staff rows are changed here.

## Contract Dependency Map

Customer UI -> existing customer read/update actions -> tenant-scoped customers.
Confirmed revenue -> existing DB trigger -> persisted loyalty balance.
KTV suggestion -> booking-decision service -> active tenant KTV users (read only).
No Kernel/Platform dependency changes or direct kernel-table access.

## Change Authority

Authorized: readonly loyalty output, remove points from editor state/submission,
ignore client-supplied points on create/update, exclude points from rollback,
disable the unused application action that manually invokes the increment RPC,
focused tests and evidence. Preserve other customer updates and tenant filters.
Forbidden: DB/schema/RLS/RPC/trigger changes, staff deletion/deactivation/provisioning,
AI ranking changes, payroll/payment rules, Core/Platform/frozen kernels.

## UI -> Contract Reconciliation

| UI/action | Contract |
|---|---|
| Loyalty display | current customer.loyalty_points, null displayed as zero |
| Editor | readonly output; points absent from edit state/save payload |
| Create/update | supplied loyalty_points never written by profile action |
| Audit rollback | cannot restore an old loyalty snapshot over automatic accrual |
| Direct addLoyaltyPoints action | reject without an RPC call; no runtime callers found |
| Bella Test suggestion | persisted active KTV in same BabyCare tenant, Auth identity absent; report only |

## Additive Migration Plan

None. Database privilege enforcement beyond these application actions is not
changed or claimed as proven by this batch.

## Eleven Verification Gates Plan

1. Scope: customer UI/actions/tests/docs only.
2. Semantic: explicit user invariant plus live revenue trigger evidence.
3. Read: existing nonzero/null points remain visible.
4. UI: no editable loyalty control in BabyCare or Beauty profile.
5. Update: tampered/old-client points ignored; other fields persist.
6. Create: supplied initial points excluded; DB default unchanged.
7. Rollback: old points not written after audit failure.
8. Direct action: reject manual increment without calling RPC.
9. Isolation: existing tenant-scoped query/update controls retained.
10. Quality: focused regression, typecheck/lint/architecture/diff gates.
11. Evidence: local browser fixtures and readonly live inspection distinct from
    production mutation proof. No Production data changes in verification.

---

# ARCHITECTURE GATE RESULT - AUTOMOVE FINANCIAL REPORTING RECOGNIZED SALES READ

> **Status:** PASS - minimal read-side migration is authorized under the user-approved `AUTOMOVE_FINANCIAL_REPORTING_RECOGNIZED_SALES_READ` scope.
> **Date:** 2026-10-14
> **Scope:** Refactor only `FinancialReportingService` vehicle sales/profit read paths to consume `auto_vehicle_sale_recognitions` as the canonical recognized sale source. Keep `vehicleSalesCommission = NOT_PROVEN` and excluded from this batch. No Warranty migration, no Finance journal posting, no write-side lifecycle, no ProductRegistry change, no schema migration, and no Production mutation.

## Bella OS/Product Development Process Gate

- Truth: PR #319 proved the additive recognition ledger schema on `main`, and PR #320 proved the runtime command can write recognition rows in non-Production. The stale `auto_sales` table remains unproven and absent from the E2E schema audit.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, `docs/architecture/AUTOMOVE_VEHICLE_SALE_REVENUE_CONTRACT_2026_10_14.md`, merged migration `20261014010000_create_automove_vehicle_sale_recognition_ledgers.sql`, and user approval for `AUTOMOVE_FINANCIAL_REPORTING_RECOGNIZED_SALES_READ`.
- Canonical Contract: vehicle sales revenue and profit reporting must read recognized sale snapshots from `auto_vehicle_sale_recognitions`. Commission remains `NOT_PROVEN` because the canonical recognition schema has no commission field or approved commission source.
- Gate result: `PASS` for read-side reporting only. `FINANCE_LEDGER_POSTING = NOT_AUTHORIZED`, `WARRANTY_SERVICE_MIGRATION = HELD`, and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product/Domain: Bella AutoMove financial reporting.
- Capability in scope:
  - `getVehicleProfitMargins`
  - `getRevenueBreakdown.vehicleSales`
  - vehicle-derived metrics in `getFinancialMetrics`
- Canonical read source: `public.auto_vehicle_sale_recognitions`.
- Explicitly out of scope: `vehicleSalesCommission`, WarrantyService, Finance journal posting, Production, ProductRegistry, write-side lifecycle, and schema changes.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Recognized vehicle sale revenue | AutoMove recognition ledger | read `sale_price_recognized` |
| Historical vehicle cost basis | AutoMove recognition ledger | read immutable `cost_basis_at_sale` |
| Vehicle display | Mobility public contract | use tenant-scoped vehicle display mapping |
| Vehicle sales commission | Not proven | keep excluded; do not infer from recognition rows |
| Finance journal posting | Finance/accounting owner | out of scope |
| Tenant isolation | RLS + explicit tenant filters | preserve tenant-scoped queries |

## Contract Dependency Map

```text
FinancialReportingService
  -> getPrimaryClient authenticated/read context
  -> auto_vehicle_sale_recognitions tenant-scoped recognized sale rows
  -> Mobility listMobilityVehicleDisplayByIds for display only
  -> existing service/loan/insurance/trade-in reads unchanged
```

## Change Authority

Authorized:

- Replace stale `auto_sales` vehicle-sales reads in scoped reporting methods.
- Keep `vehicleSalesCommission` excluded and reported as zero until a canonical commission source exists.
- Add focused unit tests and non-Production Real DB verification for recognized sales reporting reads.
- Update scoped Real DB runner only for this verifier.

Not authorized:

- Add or alter schema/migrations.
- Post Finance ledger entries or infer Vietnamese account mapping.
- Modify WarrantyService, ProductRegistry, write-side lifecycle, booking/deposit logic, or Production workflows.
- Create compatibility `auto_sales` tables or aliases.

## UI -> Contract Reconciliation

- No UI change.
- Existing reporting method shapes are preserved.
- Values now trace to canonical recognized sale snapshots instead of unproven legacy sale rows.

## Additive Migration Plan

- No migration.
- No schema, RLS, grants, generated type, or data changes.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to gate, reporting service, focused tests, and verifier wiring.
2. Contract Boundary: vehicle sale report reads `auto_vehicle_sale_recognitions`, not `auto_sales`.
3. Tenant Isolation: reporting and Mobility display reads remain tenant-scoped.
4. RLS & Authorization: no grants or policies changed; non-Production verifier checks authenticated tenant isolation.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: Warranty, Finance posting, ProductRegistry, and write lifecycle remain untouched.
8. Type Safety: no `any`, suppressions, or generated type edits.
9. Regression: focused unit tests, typecheck/lint, architecture guard, and scoped Real DB verifier.
10. Evidence Integrity: report local/non-Production proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after read-side reporting proof; do not proceed to Warranty/Finance/Production without new authorization.

---

# ARCHITECTURE GATE RESULT - AUTOMOVE VEHICLE SALE RECOGNITION ADDITIVE SCHEMA

> **Status:** PASS - additive schema migration is authorized under the approved `approve schema` scope.
> **Date:** 2026-10-14
> **Scope:** Create exactly two additive AutoMove vehicle sale recognition ledger tables plus required schema-level controls: immutable recognition snapshot, append-only adjustment/reversal records, idempotency keys, tenant-consistency validation, strict RLS, and minimum grants. No service implementation, no ledger posting, no FinancialReportingService migration, no WarrantyService migration, no ProductRegistry change, and no Production mutation.

## Bella OS/Product Development Process Gate

- Truth: AutoMove has no proven canonical vehicle sale revenue recognition persistence object. The approved Accounting Policy v1 scope requires trusted policy resolution, historical immutability, idempotency, and append-only adjustment/reversal boundaries before services or reports can safely migrate.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, `docs/architecture/AUTOMOVE_ACCOUNTING_POLICY_V1_IMPLEMENTATION_PLAN_2026_10_14.md`, `docs/architecture/AUTOMOVE_SCHEMA_IMPLEMENTATION_SCOPE_REVIEW_2026_10_14.md`, and `docs/architecture/AUTOMOVE_ADDITIVE_SCHEMA_AUTHORIZATION_REVIEW_2026_10_14.md`.
- Canonical Contract: AutoMove vehicle sale revenue must be represented by explicit `sale_revenue_recognized` persistence, not by booking creation, deposit receipt, `PACKAGE_SALE`, `auto_bookings.total_price`, mutable `auto_vehicles.cost_price`, or missing legacy `auto_sales`.
- Gate result: `PASS` for additive schema only. `CODE_IMPLEMENTATION = NOT_AUTHORIZED`, `LEDGER_POSTING = NOT_AUTHORIZED`, and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product/Domain: Bella AutoMove vehicle sale recognition.
- Capability: canonical persistence for recognized vehicle sale revenue snapshots and later adjustment/reversal records.
- Schema artifacts in scope:
  - `public.auto_vehicle_sale_recognitions`
  - `public.auto_vehicle_sale_recognition_adjustments`
- Non-goals: no command/service implementation, no report migration, no warranty migration, no journal posting, no tax invoice rules, no Production deployment.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Vehicle sale recognition snapshot | AutoMove financial source-of-truth contract | create additive ledger table |
| Adjustment/reversal history | AutoMove financial source-of-truth contract | create append-only child ledger table |
| Accounting policy registry | Finance/Platform governance | reuse only global active policy v1; do not change registry uniqueness |
| Vehicle identity and cost candidate | Mobility / AutoMove vehicle persistence | reference and snapshot, do not recompute historical profit from mutable current cost |
| Ledger postings and account mapping | Finance/accounting owner | explicitly out of scope |
| Tenant isolation | Platform auth/RLS plus schema tenant consistency | strict RLS and insert-time tenant validation required |

## Contract Dependency Map

```text
future recognizeVehicleSaleRevenue command (not implemented here)
  -> trusted global policy_registry entry
  -> auto_bookings / auto_vehicles / customers / users source checks
  -> auto_vehicle_sale_recognitions immutable snapshot
  -> auto_vehicle_sale_recognition_adjustments append-only corrections
  -> future reporting and warranty consumers after separate authorization
```

## Change Authority

Authorized:

- Add one migration creating the two reviewed tables.
- Add RLS, grants, constraints, idempotency uniqueness, append-only triggers, and tenant-consistency validation triggers.
- Add focused static and non-Production Real DB verification artifacts for the migration.

Not authorized:

- Implement `recognizeVehicleSaleRevenue` runtime service.
- Insert live policy records or seed business policy data.
- Change `policy_registry` uniqueness or introduce tenant-specific policy behavior.
- Modify `FinancialReportingService`, `WarrantyService`, `AutoSalesProvider`, ProductRegistry, or Production workflows.
- Post journal entries or map Vietnamese accounting accounts.

## UI -> Contract Reconciliation

- No UI change.
- No new screen, route, KPI, or action is introduced.
- Any future UI or report must consume the ledger only after service/report migration is separately authorized and verified.

## Additive Migration Plan

- Create `supabase/migrations/20261014010000_create_automove_vehicle_sale_recognition_ledgers.sql`.
- Use only additive objects: new tables, new trigger functions, new triggers, new RLS policies, and minimum grants.
- Keep zero-downtime posture: no drops, no rewrites, no table renames, no broad grants.
- Verify on non-Production only.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to gate, migration, docs, and verification tests/scripts.
2. Contract Boundary: no service/report/warranty/ledger posting code.
3. Tenant Isolation: strict RLS plus tenant consistency trigger on referenced booking/vehicle/customer/user/recognition rows.
4. RLS & Grants: no anon access, authenticated `SELECT` only, no direct authenticated `INSERT`/`UPDATE`/`DELETE` before recognition command authorization.
5. Database Migration Safety: additive only; zero-downtime migration check must pass.
6. Event-After-Persistence: no event or ledger posting in this schema batch.
7. Domain Safety Routing: no ProductRegistry, Finance posting, Warranty entitlement, or Mobility read contract change.
8. Type Safety: no runtime TypeScript service changes or generated type edits.
9. Regression: focused static migration test and non-Production Real DB verification.
10. Evidence Integrity: report local/static/non-Production DB separately from Production.
11. Stop Condition: stop after schema and verification; do not implement revenue command until separately authorized.

---

# ARCHITECTURE GATE RESULT - AUTOMOVE VEHICLES PAGE MOBILITY READ BATCH

> **Status:** PASS - minimal AutoMove `/dashboard/bella-auto/vehicles` read-side migration is authorized.
> **Date:** 2026-10-13
> **Scope:** Move the vehicle inventory page's direct `auto_vehicles` list query behind the existing Mobility OS public Supabase contract. Preserve the current client-side search, status filtering, pagination, export, detail drawer, and demo-only add/transition UI behavior. No write-side lifecycle change, no booking/workshop/rollback change, no schema migration, no ProductRegistry change, no Production mutation, and no other OS changes.

## Bella OS/Product Development Process Gate

- Truth: Mobility OS Foundation owns reusable vehicle inventory read mapping. After PR #311, `/dashboard/bella-auto/vehicles/page.tsx` remains a direct product UI read of `auto_vehicles`.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, current `src/platform/mobility/supabase-vehicle-contract.ts`, existing `VehicleInventoryDashboard` precedent, and the post-#311 direct reference inventory.
- Canonical Contract: AutoMove vehicle inventory read consumers should call Mobility public contract functions; the Mobility adapter owns persistence mapping to reused `auto_*` tables.
- Gate result: `PASS` for this vehicle inventory page read-only consumer. `AUTOMOVE_WRITE_CONSUMERS_MIGRATED = NOT_PROVEN` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product: Bella AutoMove / Bella Auto vehicle inventory page.
- OS capability consumed: Mobility vehicle inventory list read contract.
- Consumer in scope: `src/app/dashboard/bella-auto/vehicles/page.tsx`.
- Non-goals: no vehicle creation, no lifecycle transition execution, no booking, no allocation/deallocation, no workshop joins, no rollback flows, no ProductRegistry entry, no schema migration, and no Production deployment.

## Direct Reference Inventory After PR #311

| Category | Files | Decision |
|---|---|---|
| Mobility-owned persistence mapping | `src/platform/mobility/**` | allowed owner of `auto_vehicles` mapping |
| Read-side independent candidate | `src/app/dashboard/bella-auto/vehicles/page.tsx` | migrate in this batch |
| Read-side candidate but separate scope | `NextBestActionEngine`, `FinancialReportingService`, `WarrantyService` reads | defer; each needs its own semantic contract |
| Booking/workshop joins | booking table, service appointment/order/history joins | defer by explicit scope boundary |
| Write lifecycle/allocation/rollback | status machine, allocation, rollback, booking POST vehicle update | out of scope |
| Tests/generated types | `src/__tests__/**`, generated DB types | not product consumer migration targets |

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Vehicle inventory list, catalog joins, `list_price`, status fields | Mobility OS | use existing `listMobilityVehicleInventory` contract |
| Vehicle inventory page presentation, local filters, pagination, CSV export | AutoMove Product UI | preserve current behavior |
| Tenant identity | Platform tenant context | use `useTenantContext().tenantId`; no hardcoded tenant and no service-role bypass |
| Vehicle writes/transitions | AutoMove Product / future Mobility write contract | unchanged in this batch |

## Contract Dependency Map

```text
Bella Auto vehicles page
  -> useTenantContext().tenantId
  -> src/platform/mobility/supabase-vehicle-contract
  -> Supabase client with authenticated RLS context
  -> reused auto_vehicles / variant-model-brand persistence
  -> existing page table, filters, export, and detail drawer
```

## Change Authority

Authorized:
- Refactor the scoped vehicle inventory page read path to call the existing Mobility public contract.
- Preserve current page state, local filter/pagination semantics, and response shape.
- Add/update static contract tests preventing direct `auto_vehicles` access from the page.
- Update this gate record.

Not authorized:
- Modify vehicle add/import, allocation, deallocation, status lifecycle, booking, rollback, workshop, or service repair behavior.
- Add or edit migrations, RLS/grants, generated database types, ProductRegistry, other OS/product scopes, or Production state.

## UI -> Contract Reconciliation

- No UI redesign.
- Existing page fields are already present in `MobilityVehicleInventoryItem`.
- Existing client-side filtering and pagination remain local over the loaded inventory list.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to one AutoMove page, focused Mobility static test, and this gate record.
2. Contract Boundary: vehicles page imports Mobility public contract instead of direct `auto_vehicles` query.
3. Tenant Isolation: vehicles page uses current tenant context and the contract applies explicit `tenant_id` filtering.
4. RLS & Authorization: no grants or policies changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no ProductRegistry or other OS/product scope touched.
8. Type Safety: no `any`, suppressions, generated type edits, or provider runtime import into the client page.
9. Regression: focused static contract test, changed typecheck, lint, build, and architecture guard.
10. Evidence Integrity: report local/CI proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after this vehicle page read-side batch without broad AutoMove rewrite.

---

# ARCHITECTURE GATE RESULT - AUTOMOVE WARRANTY COVERAGE MOBILITY READ BATCH

> **Status:** PASS - minimal AutoMove warranty coverage vehicle identity read migration is authorized.
> **Date:** 2026-10-14
> **Scope:** Move `WarrantyService.validateWarrantyCoverage` vehicle identity/existence read behind the Mobility OS public Supabase contract. Preserve warranty date and mileage validation semantics from `auto_sales`. No claim workflow change, write-side lifecycle, booking/workshop workflow, rollback, schema migration, ProductRegistry, Production mutation, or other OS changes.

## Bella OS/Product Development Process Gate

- Truth: Mobility OS owns reusable vehicle identity/tenant boundary reads; AutoMove Warranty owns warranty coverage rules and claim workflow.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, merged Mobility public contract in `src/platform/mobility/supabase-vehicle-contract.ts`, current `WarrantyService.validateWarrantyCoverage` behavior, and post-#313 direct `auto_vehicles` inventory.
- Canonical Contract: Product consumers should obtain vehicle identity through Mobility public contract functions; warranty-specific `auto_sales` coverage fields remain AutoMove warranty/business data in this batch.
- Gate result: `PASS` for this read-side warranty coverage validation only. `AUTOMOVE_WRITE_CONSUMERS_MIGRATED = NOT_PROVEN` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product: Bella AutoMove / Warranty coverage validation.
- OS capability consumed: Mobility tenant-scoped vehicle identity read contract.
- Consumer in scope: `src/modules/bella-auto/services/WarrantyService.ts` inside `validateWarrantyCoverage`.
- Non-goals: no warranty claim creation/update/cancel behavior changes, no financial reporting, no service appointment/repair-order joins, no booking allocation, no vehicle lifecycle write migration, no schema migration, no Production deployment.

## Direct Reference Inventory After PR #313

| Category | Files | Decision |
|---|---|---|
| Mobility-owned persistence mapping | `src/platform/mobility/**` | allowed owner of `auto_vehicles` mapping |
| Read-side independent candidate | `WarrantyService.validateWarrantyCoverage` | migrate in this batch |
| Read-side candidate but separate scope | `FinancialReportingService` | defer; `purchase_price`/profit semantics need separate contract proof |
| Booking/workshop joins | booking table, service appointment/order/history joins | defer by explicit scope boundary |
| Write lifecycle/allocation/rollback | status machine, allocation, rollback, booking POST vehicle update, provider add vehicle | out of scope |
| Tests/generated/scripts/docs | `src/__tests__/**`, generated DB types, scripts, docs | not product consumer migration targets |

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Vehicle identity/existence by tenant | Mobility OS | add a minimal public read DTO/function |
| Warranty period and mileage limit | AutoMove Warranty/Product | preserve existing `auto_sales` read semantics |
| Warranty claim creation/review/update/cancel | AutoMove Warranty/Product | unchanged in this batch |
| Tenant isolation | Mobility contract plus existing warranty sale query | preserve explicit `tenantId` filters; no service-role bypass |

## Contract Dependency Map

```text
WarrantyService.validateWarrantyCoverage
  -> src/platform/mobility/supabase-vehicle-contract
  -> getMobilityVehicleIdentity
  -> Supabase client with authenticated RLS context
  -> reused auto_vehicles persistence
  -> existing auto_sales warranty coverage read
  -> existing date/mileage validation response
```

## Change Authority

Authorized:
- Add a minimal Mobility vehicle identity read function that returns vehicle ID and VIN for a tenant-scoped vehicle lookup.
- Refactor only `validateWarrantyCoverage` vehicle identity lookup to call Mobility public contract.
- Preserve `auto_sales` warranty coverage fields and existing invalid reasons.
- Add focused tests proving tenant-scoped identity lookup and no direct `auto_vehicles` read in the scoped warranty validation method.
- Update this gate record.

Not authorized:
- Modify warranty claim write flows, vehicle status transition, allocation/deallocation, booking POST allocation, rollback, workshop creation/update flows, financial reporting, ProductRegistry, generated DB types, migrations, grants/RLS, or Production.

## UI -> Contract Reconciliation

- No UI change.
- No new field, KPI, status, or action is introduced.
- The coverage validation result shape and messages remain product-owned and unchanged.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to Mobility read contract, warranty read consumer, focused Mobility tests, and this gate record.
2. Contract Boundary: `validateWarrantyCoverage` imports Mobility public contract instead of direct `auto_vehicles` query.
3. Tenant Isolation: Mobility identity read and warranty sale lookup are tenant-scoped.
4. RLS & Authorization: no policies or grants changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no ProductRegistry, other OS, booking/workshop, or lifecycle write path touched.
8. Type Safety: no `any`, suppressions, generated type edits, or compatibility aliases.
9. Regression: focused Mobility static/unit tests, changed typecheck, lint, architecture guard, and security guard.
10. Evidence Integrity: report local/CI proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after this read-side warranty coverage batch without broad AutoMove rewrite.

---

# ARCHITECTURE GATE RESULT - AUTOMOVE CUSTOMER OWNERSHIP MOBILITY READ BATCH

> **Status:** PASS - minimal AutoMove customer ownership read-side migration is authorized.
> **Date:** 2026-10-13
> **Scope:** Move `AutoCustomerProvider.getProfile` owned-vehicle reads and `recalculateProfileAggregates` active ownership valuation reads behind the Mobility OS public Supabase contract. Preserve existing Customer 360 response shape and aggregate semantics: active ownership count plus sum of owned vehicles' `list_price`. No write-side ownership/lifecycle change, no migration, no ProductRegistry change, no Production mutation, and no other OS changes.

## Bella OS/Product Development Process Gate

- Truth: Mobility OS Foundation owns reusable vehicle identity and ownership contracts. `AutoCustomerProvider` still directly reads `auto_vehicles` for customer-owned vehicle details and aggregate valuation.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, merged Mobility Foundation contract, current `AutoCustomerProvider` behavior, and the approved user scope for `AUTO_CUSTOMER_OWNERSHIP_MOBILITY_READ`.
- Canonical Contract: AutoMove customer read consumers should obtain vehicle ownership/valuation data through `src/platform/mobility` public contract functions; the Mobility adapter owns persistence mapping to reused `auto_*` tables.
- Gate result: `PASS` for this customer ownership read-side consumer only. `AUTOMOVE_WRITE_CONSUMERS_MIGRATED = NOT_PROVEN` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product: Bella AutoMove / Bella Auto customer 360 ownership surface.
- OS capability consumed: Mobility vehicle ownership and vehicle identity read contract.
- Consumers in scope: `AutoCustomerProvider.getProfile` and the read portion of `AutoCustomerProvider.recalculateProfileAggregates`.
- Non-goals: no booking, allocation, deallocation, status lifecycle, rollback, workshop joins, ProductRegistry entry, schema migration, or Production deployment.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Vehicle identity and `list_price` read mapping | Mobility OS | expose minimal customer ownership read contract |
| Vehicle owner relationship read mapping | Mobility OS | expose customer-owned vehicle list with existing owner metadata |
| Customer 360 profile response shape | AutoMove Product | preserve existing `OwnedVehicle` and aggregate semantics |
| Ownership writes and transfers | AutoMove Product / future Mobility write batch | unchanged in this batch |
| Tenant isolation | Supabase RLS plus tenant-scoped query input | preserve `tenantId` filters across owner, vehicle, variant, model, and brand reads |

## Contract Dependency Map

```text
AutoCustomerProvider read methods
  -> src/platform/mobility/supabase-vehicle-contract
  -> Supabase client with authenticated RLS context
  -> reused auto_vehicle_owners / auto_vehicles / variant-model-brand persistence
  -> existing AutoMove Customer 360 response and aggregate profile update
```

## Change Authority

Authorized:
- Extend Mobility public Supabase contract with customer-owned vehicle list and customer ownership aggregate reads.
- Refactor the scoped AutoMove customer provider read paths to call Mobility public contract functions.
- Add focused tests for empty ownerships, multiple vehicles, tenant-scoped reads, aggregate `list_price`, and static consumer boundary.
- Update this gate record.

Not authorized:
- Modify ownership write semantics, status lifecycle, allocation/deallocation, booking, rollback, or workshop joins.
- Add migrations, change RLS/grants, change ProductRegistry, mutate Production, or touch unrelated OS/product scopes.

## UI -> Contract Reconciliation

- No UI redesign.
- Existing Customer 360 `OwnedVehicle` fields remain unchanged.
- Existing aggregate meaning remains unchanged: count active ownership records and sum `list_price` for active owned vehicles.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to Mobility contract, one AutoMove customer provider consumer, focused tests, and this gate record.
2. Contract Boundary: customer provider imports Mobility public contract instead of direct `auto_vehicles` queries.
3. Tenant Isolation: contract tests verify every read query is scoped by `tenant_id`.
4. RLS & Authorization: no grants or policies changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no ProductRegistry or other OS/product scope touched.
8. Type Safety: no `any`, suppressions, or generated type edits.
9. Regression: focused customer provider, Mobility contract, static contract tests, changed typecheck, lint, build, and architecture guard.
10. Evidence Integrity: report local/CI proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after this customer ownership read-side batch without broad AutoMove rewrite.

---

# ARCHITECTURE GATE RESULT - AUTOMOVE DASHBOARD SHELL MOBILITY READ BATCH

> **Status:** PASS - minimal AutoMove dashboard shell read-side migration is authorized.
> **Date:** 2026-10-13
> **Scope:** Move `src/app/dashboard/bella-auto/page.tsx` vehicle status KPI reads behind the Mobility OS public Supabase contract. Preserve existing dashboard route behavior and chart props. No write path change, no migration, no ProductRegistry change, no Production mutation, and no other OS changes.

## Bella OS/Product Development Process Gate

- Truth: Mobility OS Foundation and prior AutoMove read-side batches are merged on `main`. The dashboard shell still directly reads `auto_vehicles` for status counts used by `AutoAnalyticsCharts`.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, merged Mobility Foundation work, existing `src/platform/mobility/supabase-vehicle-contract.ts`, and current dashboard shell behavior.
- Canonical Contract: AutoMove read consumers should call Mobility public contract functions for vehicle inventory/status reads; the Mobility adapter owns persistence mapping to reused `auto_*` tables.
- Gate result: `PASS` for this dashboard shell read-only consumer. `AUTOMOVE_WRITE_CONSUMERS_MIGRATED = NOT_PROVEN` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product: Bella AutoMove / Bella Auto dashboard shell.
- OS capability consumed: Mobility vehicle inventory status summary read contract.
- Consumer in scope: `src/app/dashboard/bella-auto/page.tsx`.
- Non-goals: no vehicle creation, no lifecycle transition, no booking/workshop/service repair flows, no ProductRegistry entry, no schema migration, no Production deployment.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Vehicle inventory status summary | Mobility OS | use existing `getMobilityVehicleInventorySummary` contract |
| Dashboard shell presentation and chart props | AutoMove Product UI | preserve current prop shape and rendering behavior |
| Tenant isolation | Supabase RLS plus tenant-scoped query input | preserve tenant filter from authenticated profile; do not add service-role bypass |
| Vehicle writes/transitions | AutoMove Product / future Mobility write contract | unchanged in this batch |

## Contract Dependency Map

```text
Bella Auto dashboard shell
  -> src/platform/mobility/supabase-vehicle-contract
  -> Supabase client with authenticated RLS context
  -> reused auto_vehicles persistence
  -> existing AutoAnalyticsCharts props
```

## Change Authority

Authorized:
- Refactor the scoped dashboard shell status summary read to call the existing Mobility public contract.
- Add a focused static test proving this dashboard shell consumer no longer directly reads `auto_vehicles`.
- Update this gate record.

Not authorized:
- Modify write-side vehicle creation or lifecycle transition semantics.
- Add migrations, change RLS, change ProductRegistry, mutate Production, or touch unrelated OS/product scopes.

## UI -> Contract Reconciliation

- No UI redesign.
- Existing `AutoAnalyticsCharts` props remain unchanged: total, showroom, warehouse, allocated, delivered.
- This batch moves the data-access boundary only; it does not introduce new UI states, KPIs, actions, or workflows.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to one AutoMove dashboard shell consumer, focused tests, and this gate record.
2. Contract Boundary: dashboard shell imports Mobility public contract instead of direct `auto_vehicles` query.
3. Tenant Isolation: existing authenticated profile `tenant_id` filter and Supabase RLS context are preserved.
4. RLS & Authorization: no grants or policies changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no ProductRegistry or other OS/product scope touched.
8. Type Safety: no `any`, suppressions, or generated type edits.
9. Regression: focused Mobility/AutoMove contract tests plus changed typecheck/build.
10. Evidence Integrity: report local/CI proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after this dashboard shell read-side batch without broad AutoMove rewrite.

---

# ARCHITECTURE GATE RESULT - AUTOMOVE MOBILITY CONSUMER READ-SIDE BATCH

> **Status:** PASS - minimal AutoMove read-side consumer migration is authorized.
> **Date:** 2026-10-13
> **Scope:** Move the `AutoInventoryProvider` vehicle inventory read-side paths for summary, inventory list, and vehicle status history behind the Mobility OS public Supabase contract. Keep write-side vehicle creation and lifecycle transition unchanged for a later batch because those require separate idempotency and write-semantic proof. No migration, no ProductRegistry change, no Production mutation, and no other OS changes.

## Bella OS/Product Development Process Gate

- Truth: Mobility OS Foundation MVP is merged on `main` and exposes the approved public contract boundary in `src/platform/mobility`. `AutoInventoryProvider` still owns product-facing inventory methods that directly query `auto_vehicles` and `auto_vehicle_status_logs` for read-side workflows.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, merged PR #307, existing Mobility Foundation public contract files, and current `AutoInventoryProvider` consumer behavior.
- Canonical Contract: AutoMove product services should consume shared vehicle identity/lifecycle reads through `src/platform/mobility` public contract functions. The Mobility adapter owns persistence mapping to reused `auto_*` tables.
- Gate result: `PASS` for read-side consumer migration only. `AUTOMOVE_WRITE_CONSUMERS_MIGRATED = NOT_PROVEN` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product: Bella AutoMove / Bella Auto vehicle inventory surface.
- OS capability consumed: Mobility vehicle identity and lifecycle read contract.
- Consumer in scope: `src/modules/bella-auto/services/AutoInventoryProvider.ts` read-side methods: `getSummary`, `listVehicles`, and `getStatusHistory`.
- Non-goals: no state-machine write rewrite, no booking/sales/customer/finance flows, no marketplace capabilities, no ProductRegistry entry, no migration, no Production deployment.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Vehicle identity and lifecycle read mapping | Mobility OS | move read persistence access into Mobility public Supabase contract |
| AutoMove inventory provider response shape | AutoMove Product | preserve existing product-facing interfaces and legacy status-history row shape |
| Vehicle creation and status transition writes | AutoMove Product / future Mobility write contract | keep unchanged in this batch |
| Tenant isolation | Supabase RLS plus tenant-scoped query inputs | preserve existing tenant filters and do not add service-role bypass |

## Contract Dependency Map

```text
AutoInventoryProvider read method
  -> src/platform/mobility/supabase-vehicle-contract
  -> Supabase client with authenticated RLS context
  -> reused auto_vehicles / auto_vehicle_status_logs persistence
  -> legacy AutoMove provider response shape
```

## Change Authority

Authorized:
- Extend Mobility public Supabase contract with vehicle inventory summary, inventory list, and status history read functions.
- Refactor the scoped AutoMove provider read methods to call the Mobility contract.
- Add focused static tests proving the consumer no longer performs direct read-side `auto_*` access.

Not authorized:
- Modify write-side vehicle creation or status transition semantics.
- Add migrations, change RLS, change ProductRegistry, or mutate Production.
- Modify Logistics, Warehouse, Finance, Healthcare, Education, Manufacturing, or frozen kernels.

## UI -> Contract Reconciliation

- No UI redesign.
- Existing product-facing provider response shape must remain compatible for inventory UI consumers.
- This batch moves the data-access boundary only; it does not add new UI states, KPIs, filters, or workflows.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to Mobility contract, one AutoMove provider consumer, focused tests, and this gate record.
2. Contract Boundary: provider imports Mobility public contract instead of direct read-side `auto_*` queries.
3. Tenant Isolation: existing tenantId filters and authenticated Supabase RLS context are preserved.
4. RLS & Authorization: no grants or policies changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no ProductRegistry or other OS/product scope touched.
8. Type Safety: no `any`, suppressions, or generated type edits.
9. Regression: focused Mobility/AutoMove contract tests plus changed typecheck.
10. Evidence Integrity: report local proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after this read-side batch without broad AutoMove rewrite.

---

# ARCHITECTURE GATE RESULT - BELLA AUTO WORKSHOP SECURITY CLOSURE

> **Status:** PASS - minimal closure for the already-repaired Bella Auto workshop RLS incident is authorized.
> **Date:** 2026-10-13
> **Scope:** Prepare a protected Production workflow that repairs migration history for `20261013090000`, applies one least-privilege migration for the two workshop tables through BDGF, records that migration with Supabase migration repair, then verifies RLS, grants, history, and tenant isolation. No direct local Production SQL, no `supabase db push`, no bulk migration sync, no ProductRegistry, and no OS/kernel changes.

## Bella OS/Product Development Process Gate

- Truth: Production RLS repair is already proven for `auto_service_appointments` and `auto_repair_orders`, but `20261013090000` is not recorded in migration history and `authenticated` still has `REFERENCES`, `TRIGGER`, and `TRUNCATE` table privileges.
- Source of Truth: Production read-only evidence, successful BDGF workflow `38376099290`, Supabase migration history, `scripts/bdgf/execute-migration-wrapper.mjs`, and the existing post-deploy Bella Auto workshop RLS probe.
- Canonical Contract: Production DDL must use BDGF approval -> gate token -> wrapper -> executor. Migration-history repair must use the official Supabase CLI `migration repair --status applied` against the confirmed Production DB URL and must not rerun migration DDL.
- Gate result: `PASS` for preparing the workflow, least-privilege migration, probes, and static guard tests. `MIGRATION_HISTORY = NOT_RECORDED` and `AUTHENTICATED_LEAST_PRIVILEGE = NOT_SEALED` remain true until the protected workflow is merged, manually dispatched, and passes.

## Product Manifest

- Product: Bella Auto / Automove workshop security boundary.
- Capability in scope: incident closure for two workshop tables only.
- Existing capabilities reused: GitHub Actions Production environment protection, owner-operated BDGF approval, BDGF migration wrapper/executor, Supabase migration repair, and Real DB post-deploy probes.
- Non-goals: no broad migration synchronization, no direct Production SQL, no `supabase db push`, no Logistics/Healthcare/Education/Manufacturing changes, no ProductRegistry change, and no Bella Auto Go-Live claim.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Migration history row for `20261013090000` | Supabase migration management / operator | repair as applied only after verifying DDL is already applied |
| `authenticated` table privileges on workshop tables | Bella Auto workshop persistence | revoke only `REFERENCES`, `TRIGGER`, `TRUNCATE` |
| Least-privilege Production DDL | BDGF governance / executor | execute through owner-operated approval and wrapper |
| Tenant isolation proof | Bella Auto workshop RLS policies | reuse transactional tenant A/B Real DB probe |
| Full Bella Auto readiness | separate product readiness gate | not claimed by this closure |

## Contract Dependency Map

```text
Manual workflow_dispatch on main
  -> GitHub Environment Production protection
  -> Production URL project-ref preflight
  -> Supabase migration repair for already-applied 20261013090000
  -> owner_operated BDGF approval for 20261013103000
  -> execute-migration-wrapper.mjs
  -> Supabase migration repair for 20261013103000 after successful DDL
  -> post-deploy RLS / grants / history / tenant-isolation probes
```

## Change Authority

Authorized:
- Add one least-privilege migration limited to `auto_service_appointments` and `auto_repair_orders`.
- Add one protected manual workflow for Bella Auto workshop security closure.
- Add read-only closure probes and static guard tests for the workflow and migration.
- Update package scripts and this architecture gate record.

Not authorized:
- Run Production mutation from this local session.
- Manually edit `supabase_migrations.schema_migrations`.
- Use `supabase db push`, bulk sync, direct executor invocation, or direct `psql`.
- Modify ProductRegistry, app product workflows, frozen kernels, Logistics, Healthcare, Education, Manufacturing, or unrelated Bella Auto features.

## UI -> Contract Reconciliation

- No UI change.
- No user-facing product workflow or action contract change.

## Additive Migration Plan

- Add `20261013103000_restrict_bella_auto_workshop_authenticated_grants.sql`.
- Migration behavior: revoke only `REFERENCES`, `TRIGGER`, and `TRUNCATE` from `authenticated` on the two workshop tables; preserve `SELECT`, `INSERT`, `UPDATE`, and `DELETE` for existing RLS policies.
- Deployment is deferred to a protected manual Production workflow. The workflow repairs migration history with Supabase CLI only after preflight verification and records the new migration only after BDGF execution succeeds.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to Bella Auto workshop closure workflow, migration, BDGF probes/tests, package script, and gate record.
2. Contract Boundary: least-privilege DDL runs only through BDGF wrapper; history repair uses Supabase CLI migration repair, not direct SQL.
3. Tenant Isolation: final workflow reruns the transactional tenant A/B RLS probe.
4. RLS & Authorization: final workflow checks RLS enabled, anon denied, authenticated CRUD retained, and management privileges revoked.
5. Database Migration Safety: static tests bind migration SHA-256 and zero-downtime check reviews the changed migration.
6. Event-After-Persistence: no product write/event path changed.
7. Domain Safety Routing: no Healthcare, Education, Logistics, Manufacturing, ProductRegistry, or kernel files changed.
8. Temporal Provenance: workflow records exact migration versions and hashes in logs without secrets.
9. Rule Governance: no accounting/legal/domain rule changed.
10. Audit & Evidence Integrity: workflow fails closed on wrong project URL, missing secrets, history/grant mismatch, invalid approval, wrapper failure, repair failure, or post-probe failure.
11. Regression: run focused BDGF tests, closure workflow guard tests, zero-downtime migration check, diff check, and final diff review.

---

# ARCHITECTURE GATE RESULT - BDGF PRODUCTION WORKFLOW FOR BELLA AUTO WORKSHOP RLS

> **Status:** PASS - add a manual, protected Production workflow for the already-approved Bella Auto workshop RLS migration.
> **Date:** 2026-10-13
> **Scope:** Add the missing official GitHub Actions execution path for `20261013090000_reenable_bella_auto_workshop_rls.sql`. No migration content change, no automatic execution on merge, no Mobility OS, no ProductRegistry, and no kernel changes.

## Bella OS/Product Development Process Gate

- Truth: PR #300 merged the owner-operated BDGF approval mechanism and the approved workshop RLS migration. Production execution remains unproven until a protected operator-triggered workflow creates approval, executes through the BDGF wrapper, and passes post-deploy Real DB probes.
- Source of Truth: BDGF R4 approval and execution contracts, `scripts/bdgf/create-migration-approval.mjs`, `scripts/bdgf/execute-migration-wrapper.mjs`, GitHub Actions Production environment protections, and the approved migration hash.
- Canonical Contract: production mutation must be manual/authorized, run from `main`, use Production environment secrets, create an owner-operated approval from trusted GitHub Actions identity, issue a gate token, execute through the wrapper, and prove RLS after deployment.
- Gate result: `PASS` for adding the workflow and static guard tests. `MIGRATION = NOT_APPLIED` and `POST_DEPLOY_RLS = NOT_PROVEN` until the workflow is merged, manually dispatched, and passes against the target database.

## Product Manifest

- Product: Bella Auto / Automove workshop security boundary.
- Capability in scope: official BDGF Production migration execution workflow and post-deploy RLS probe.
- Existing capabilities reused: GitHub Actions Production environment, BDGF owner-operated approval, BDGF wrapper/executor boundary, approved migration artifact.
- Non-goals: no migration rewrite, no direct SQL deployment path, no Mobility OS, no ProductRegistry, no kernel change, no browser E2E, no Bella Auto Go-Live claim.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Production migration execution | BDGF governance / operator | add manual workflow only |
| Owner authority | GitHub Actions trusted runtime + GitHub API | reuse PR #300 mechanism |
| Gate token and mutation | BDGF wrapper and executor | wrapper-only execution |
| Workshop RLS proof | Bella Auto workshop persistence | transactional post-deploy probe |
| Production readiness | separate Go-Live gate | not claimed |

## Contract Dependency Map

```text
Manual workflow_dispatch on main
  -> GitHub Environment Production protection
  -> approved migration SHA-256 check
  -> owner_operated approval
  -> execute-migration-wrapper.mjs
  -> migration-executor.mjs
  -> post-deploy RLS probe
  -> SECURITY_REPAIR = PROVEN only after probe PASS
```

## Change Authority

Authorized:
- Add one GitHub Actions workflow for the approved migration.
- Add one post-deploy probe script for the two Bella Auto workshop tables.
- Add focused static/pure tests for workflow guards and probe fail-closed behavior.
- Add a package script for the focused tests.

Not authorized:
- Modify the approved migration content or hash.
- Run production migration from this local session.
- Use `supabase db push`, `psql`, or direct `migration-executor.mjs`.
- Modify ProductRegistry, kernels, Mobility OS, Logistics/Warehouse/Healthcare/Education, or unrelated Bella Auto features.

## UI -> Contract Reconciliation

- No UI change.
- No product workflow or user-facing data/action contract change.

## Additive Migration Plan

- No new migration in this PR.
- Workflow binds to the existing approved file and SHA-256: `1FEDCE34702106E86A38D650AAF43FEC52A763F54E66A11187EEF6D3A37C2425`.
- Database mutation remains deferred until the protected manual Production workflow is dispatched by an authorized operator.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to workflow, BDGF probe/test scripts, package script, and gate record.
2. Contract Boundary: workflow uses `create-migration-approval.mjs` and `execute-migration-wrapper.mjs`.
3. Tenant Isolation: post-deploy probe checks tenant A/B read/write separation.
4. RLS & Authorization: post-deploy probe checks RLS enabled and anon table privileges revoked.
5. Database Migration Safety: workflow verifies exact approved migration hash before approval/execution.
6. Event-After-Persistence: no app event path changed.
7. Domain Safety Routing: no Healthcare, Education, Logistics, Warehouse, ProductRegistry, Mobility OS, or kernel files changed.
8. Temporal Provenance: workflow runs only via manual dispatch from `main` in Production environment.
9. Rule Governance: no accounting/legal/domain rule changed.
10. Audit & Evidence Integrity: workflow fails closed on hash mismatch, missing secrets, invalid owner authority, wrapper failure, or probe failure.
11. Regression: run focused BDGF owner tests, production workflow guard tests, diff check, secret scan, and final diff review.

---

# ARCHITECTURE GATE RESULT - CUSTOMER DETAIL TENANT THEME UI REPAIR

> **Status:** PASS - minimal presentation-layer repair authorized.
> **Date:** 2026-10-13
> **Scope:** Replace hardcoded customer detail service-card and primary button colors with existing runtime tenant theme tokens. No schema, API, domain, ProductRegistry, Healthcare, Education, Logistics, or kernel change.

## Bella OS/Product Development Process Gate

- Truth: customer detail card/button colors must follow the active tenant brand preset.
- Source of Truth: tenant brand resolver and runtime CSS variables in `src/lib/business-rules/tenant-modules.ts`.
- Canonical Contract: UI consumes `--primary`, `--primary-hover`, `--primary-foreground`, `--accent`, and `--accent-foreground`; UI must not bake a product color into shared customer detail card classes.
- Gate result: `PASS` for presentation CSS/classes only.

## Product Manifest

- Product surface: customer detail service/package UI.
- Capability in scope: active booking card, package selector active card, customer detail primary actions, and modal primary actions.
- Non-goals: booking/session/payment semantics, KTV matching logic, tenant identity, schema, migrations, RLS, authorization, service actions.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Tenant preset tokens | Platform tenant branding contract | consume only |
| Customer detail presentation | Product/UI layer | may update classes |
| Booking/payment/session data | Existing service/domain contracts | unchanged |
| Frozen kernels | Healthcare/Education/Logistics OS | not touched |

## Contract Dependency Map

```text
Customer Detail UI
  -> semantic CSS theme classes / Tailwind primary tokens
  -> runtime tenant CSS variables
  -> resolved tenant brand preset
```

## Change Authority

Authorized:
- Modify customer-detail presentation classes.
- Modify existing CSS theme helper classes to use runtime tenant variables.

Not authorized:
- Change database, API, service, domain, ProductRegistry, migrations, generated types, or frozen kernels.

## UI -> Contract Reconciliation

- Current UI defect: global `.beauty-customer-theme-card` had a fixed jade fallback that could affect non-jade tenants such as babycare.
- Required UI contract: card backgrounds and primary buttons resolve from the active tenant preset.
- Reconciliation result: `MATCH` after converting the presentation layer to existing runtime tokens.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to presentation and this gate record.
2. Contract Boundary: no service/API/domain/schema changes.
3. Tenant Isolation: no runtime data path change.
4. RLS & Authorization: unchanged.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no event path changed.
7. Product UI Theme Contract: verify card/button styles consume tenant CSS variables.
8. Type Safety: run scoped static checks where available.
9. Visual Smoke: browser/manual screenshot if local runtime is practical.
10. Regression Scope: run `git diff --check` and focused lint/type validation.
11. Evidence: report PASS/NOT_RUN honestly.

---

# ARCHITECTURE GATE RESULT - BDGF OWNER-OPERATED WORKSHOP RLS REPAIR

> **Status:** PASS - minimal BDGF owner-operated authority and Bella Auto workshop RLS repair are authorized.
> **Date:** 2026-10-13
> **Scope:** Add a trusted GitHub Actions owner-authority source for BDGF `owner_operated` approvals, bind role integrity, include the rehearsed Bella Auto workshop RLS migration, and add focused BDGF tests. No production execution in this PR.

## Bella OS/Product Development Process Gate

- Truth: The Bella Auto workshop RLS defect is already proven and the repair migration passed rehearsal, but target deployment remains blocked because BDGF lacks a trusted owner-operated approval source.
- Source of Truth: BDGF R4 approval/execution contracts, current BDGF scripts, GitHub Actions run identity/permission API, and the existing rehearsed migration content.
- Canonical Contract: production database mutation must pass BDGF approval -> gate token -> wrapper -> executor. Owner-operated approval is allowed only when approver role is verified by trusted authority, not CLI self-declaration.
- Gate result: `PASS` for BDGF control-plane code, focused tests, and the Bella Auto workshop RLS migration file. `DEPLOYMENT = NOT_EXECUTED` until merge, credentials, approval record, wrapper execution, and post-deploy probes are complete.

## Product Manifest

- Product: Bella Auto / Automove workshop security boundary.
- Capability in scope: BDGF owner-operated migration approval and workshop RLS repair migration.
- Existing capabilities reused: `bella_migration_approval`, `verifyApproval()`, gate token issuance, migration wrapper, GitHub Actions identity and permission API.
- Non-goals: no Mobility OS, no ProductRegistry, no kernel changes, no production migration execution, no browser E2E, no Finance Go-Live claim.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| BDGF approval contract | Platform / BDGF governance | minimally extend implementation within existing `owner_operated` contract |
| Owner identity source | GitHub Actions + GitHub API | verify workflow run actor and repository admin permission |
| `auto_service_appointments` RLS | Bella Auto workshop persistence | re-enable RLS and revoke anon via approved migration |
| `auto_repair_orders` RLS | Bella Auto workshop persistence | re-enable RLS and revoke anon via approved migration |
| Production execution | BDGF wrapper / operator | not executed in this PR |

## Contract Dependency Map

```text
GitHub Actions run
  -> GitHub API run identity + collaborator permission
  -> owner_operated approval request
  -> bella_migration_approval role/hash/environment binding
  -> verifyApproval()
  -> gate token
  -> execute-migration-wrapper.mjs
  -> migration-executor.mjs
  -> target database mutation
```

## Change Authority

Authorized:
- Modify `scripts/bdgf/create-migration-approval.mjs`.
- Add a small BDGF owner authority helper.
- Modify `scripts/bdgf/r4-verify-approval.mjs` to bind `approver_role` into the approval integrity hash while preserving legacy separated approvals.
- Update focused BDGF approval tests.
- Add `supabase/migrations/20261013090000_reenable_bella_auto_workshop_rls.sql`.

Not authorized:
- Execute production migration.
- Use direct executor access or `supabase db push`.
- Add broad RBAC, `BDGF_OWNER_*` self-declared authority, ProductRegistry, Mobility OS, kernels, or unrelated OS/Product changes.

## UI -> Contract Reconciliation

- No UI change.
- No product workflow or user-facing data contract change.

## Additive Migration Plan

- Add one migration only: `20261013090000_reenable_bella_auto_workshop_rls.sql`.
- Migration behavior: if each workshop table exists, enable RLS, revoke all anon table privileges, and grant authenticated table privileges for policies to enforce tenant boundaries.
- Production application is explicitly deferred until PR approval and BDGF wrapper execution with post-deploy probes.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to BDGF control plane, focused tests, gate record, and Bella Auto workshop RLS migration.
2. Contract Boundary: `owner_operated` derives identity/role from GitHub API, not CLI role claims.
3. Tenant Isolation: RLS repair preserves `public.get_auth_tenant_id()` policy boundary.
4. RLS & Authorization: migration revokes anon table privileges and keeps authenticated path policy-bound.
5. Database Migration Safety: run zero-downtime migration check for the new migration.
6. Event-After-Persistence: no application write/event path changed.
7. Domain Safety Routing: no Healthcare, Education, Logistics, Warehouse, ProductRegistry, or kernel files changed.
8. Temporal Provenance: approval audit notes include run identity evidence without secrets.
9. Rule Governance: no accounting/legal/domain business rule changed.
10. Audit & Evidence Integrity: tests cover valid owner approval, non-admin spoof block, role tamper/hash mismatch, and environment mismatch.
11. Regression: run focused BDGF tests, migration check, secret scan or diff check, and final diff review.

---

# ARCHITECTURE GATE RESULT - MULTI-AGENT CODING PROTOCOL GOVERNANCE RULE

> **Status:** PASS - governance rule addition authorized
> **Date:** 2026-10-08
> **Scope:** Add Bella AI Platform multi-agent coding protocol to the single canonical AI coding constitution and entrypoint instructions.

## Bella OS/Product Development Process Gate

- Truth: Multi-agent execution is an execution-control concern, not a product/runtime capability.
- Source of Truth: user-provided "Bella AI Platform - Multi-Agent Coding Protocol", `AGENTS.md`, `CLAUDE.md`, and `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`.
- Canonical Contract: Bella AI coding rules live in `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`; local agent entrypoints must point to that single source rather than duplicating complete rules.
- Gate result: `PASS` for documentation/governance-only rule update.

## Product Manifest

- Product: none.
- Capability in scope: AI coding governance for controlled multi-agent development.
- Runtime behavior in scope: none.
- Non-goals: no Platform/Core/Product runtime change, no new OS kernel, no migration, no test harness change, no CI automation.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Cross-agent coding protocol | Governance Constitution | may update |
| Agent entrypoint reminders | `AGENTS.md`, `CLAUDE.md` | may point to canonical rule |
| ProductRegistry / Product identity | Platform registry | not modified |
| Healthcare H1-H12 Kernel | Healthcare OS Kernel | not modified |
| Logistics E7.1-E7.3 Kernel | Logistics OS Kernel | not modified |
| Education Kernel | Education OS Kernel | not modified |

## Contract Dependency Map

```text
User request / Lead decision
  -> Bella AI Coding Constitution
  -> Multi-Agent Coding Protocol
  -> Lead decomposition / ownership / worktree / branch / PR strategy
  -> Builder or QA agent scoped execution
  -> Evidence / integration / seal
```

## Change Authority

Authorized:
- Modify `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`.
- Modify `AGENTS.md` and `CLAUDE.md` only as entrypoint reminders.
- Update this architecture gate record.

Not authorized:
- Modify runtime code, product code, Platform/Core, frozen Healthcare/Education/Logistics kernels, migrations, generated types, package scripts, or CI workflows.

## UI -> Contract Reconciliation

- No UI change.
- No data-bound or action-bound UI element changed.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or production data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: verify only governance docs and this gate record changed.
2. Contract Boundary: protocol requires Product -> Public Contract -> Kernel and public contracts across domains.
3. Tenant Isolation: no runtime path changed; protocol preserves tenant/RLS/auth invariants.
4. RLS & Authorization: no runtime path changed; protocol forbids RLS/auth weakening.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no Healthcare/Education/Logistics domain route touched.
8. Temporal Provenance: no historical mutation.
9. Rule Governance: protocol text only; no governed business rule changed.
10. Audit & Evidence Integrity: verify evidence states distinguish PASS from skipped, timeout, assumed, or not-run.
11. Regression: run `git diff --check` and inspect changed-file diff.

---

# ARCHITECTURE GATE RESULT - BEAUTY V2 CHAIN STAFF AUTH IDENTITY GUARD

> **Status:** PASS - product service guard authorized
> **Date:** 2026-10-08
> **Scope:** Prevent Beauty V2 Chain Management staff assignment from leaking `people_directory_user_id_fkey` when a selectable `public.users` row is not backed by `auth.users`.

## Bella OS/Product Development Process Gate

- Truth: `people_directory.user_id` is an Auth identity link and references `auth.users(id)`.
- Source of Truth: `supabase/migrations/20260801030000_foundation_org_people_schema.sql`, `src/services/beauty-chain-actions.ts`, live read-only Supabase evidence captured in `implementation-artifacts/investigations/beauty-v2-chain-staff-assignment-fk-investigation.md`.
- Canonical Contract: Beauty Chain staff assignment consumes Platform People Directory and Org Unit contracts; linkable employee users must have a valid Auth identity before `people_directory.user_id` is populated.
- Gate result: `PASS` for a Product service guard and focused tests only.

## Product Manifest

- Product: Bella Beauty Spa V2 (`bella_spa`), Chain Management page.
- Capability in scope: assign an existing tenant staff user to a selected branch.
- Existing capabilities reused: `public.users` tenant profile, `people_directory`, `org_relationships`, `org_units`, and `user_org_unit_access`.
- Non-goals: no schema change, no Platform Org Unit change, no migration, no Healthcare/Education/Logistics kernel work, no demo-data mutation.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| `auth.users` identity existence | Supabase Auth / Platform identity | read only through server-side admin client |
| `public.users` tenant profile | Platform/user profile | consume only |
| `people_directory` | Platform People Directory | consume contract; do not change schema |
| `org_relationships` branch assignment | Platform Org Unit relationship | consume existing contract |
| Beauty Chain action orchestration | Beauty V2 Product service | may guard before mutation |

## Contract Dependency Map

```text
Beauty Chain UI
  -> linkBeautyStaffPerson / assignBeautyStaffToBranch
  -> public.users same-tenant staff profile
  -> auth.users identity existence guard
  -> people_directory employee link
  -> org_relationships person -> branch membership
  -> user_org_unit_access projection
```

## Change Authority

Authorized:
- Modify `src/services/beauty-chain-actions.ts`.
- Modify `src/__tests__/beauty-chain-actions.test.ts`.
- Update this architecture gate record.

Not authorized:
- Change `people_directory`, `auth.users`, `org_units`, `org_relationships`, `user_org_unit_access`, RLS, migrations, generated types, or seed production data.
- Create compatibility aliases or bypass the FK.

## UI -> Contract Reconciliation

| UI element / action | Contract status | Decision |
|---|---|---|
| Staff dropdown from tenant `public.users` | MAPPING BUG | Product action must reject users without Auth identity before People Directory insert. |
| `Gán vào chi nhánh` action | MATCH after guard | Same-tenant staff and active branch are still required; Auth identity is now validated before link. |
| Existing `Needs link` badge | PARTIAL | It only means no `people_directory` row; it does not prove Auth identity. No UI redesign in this change. |

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: confirm no frozen Healthcare/Education/Logistics/Platform kernel files are touched.
2. Contract Boundary: verify service guard follows `people_directory.user_id -> auth.users`.
3. Tenant Isolation: preserve same-tenant `public.users` and `org_units` filters.
4. RLS & Authorization: preserve admin-only Chain Management action gate.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no event path changed.
7. Domain Safety Routing: Product service guard only; no OS/kernel route touched.
8. Temporal Provenance: no historical/data mutation.
9. Rule Governance: no accounting or governed domain rule change.
10. Audit & Evidence Integrity: focused test for Auth-missing negative path.
11. Regression: run focused `beauty-chain-actions.test.ts` and `git diff --check`.

---

# ARCHITECTURE GATE RESULT - AI CODING BUSINESS SEMANTIC GATE

> **Status:** PASS - governance rule addition authorized
> **Date:** 2026-10-08
> **Scope:** Add cross-agent AI Coding Governance rules requiring business semantic proof and test independence before any AI Agent implements or writes tests for business-critical behavior.

## Bella OS/Product Development Process Gate

- Truth: Existing implementation, existing tests, database columns, names, and inferred relationships are not automatically business truth.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, AGENTS architecture-control instructions, Healthcare/Education constitutions, and the Laboratory patient-linkage incident evidence.
- Canonical Contract: AI coding work must follow `Evidence -> Truth -> Source of Truth -> Canonical Contract -> Ownership -> Boundary -> Change Authority -> Minimal Implementation -> Verification -> Evidence`.
- Gate result: `PASS` for a documentation/governance rule update only.

## Product Manifest

- Product: None.
- Capability in scope: AI Coding OS governance for all agents.
- Runtime behavior in scope: none.
- Non-goals: no Laboratory semantic fix, no Healthcare/Education/Logistics kernel change, no migration, no runtime code, no test harness repair.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Cross-agent AI coding process | Governance Constitution | may update |
| Healthcare H1-H12 Kernel | Healthcare OS Kernel | do not touch |
| Education Kernel | Education OS Kernel | do not touch |
| Laboratory patient linkage runtime mapping | Healthcare/Laboratory contract boundary | not modified in this change |
| Business-critical expected test values | Approved business invariant / canonical contract | must be independent from implementation under test |

## Contract Dependency Map

```text
AI Agent request
  -> Business Semantic Gate
  -> Business Test Contract
  -> Source of Truth / Canonical Contract / Ownership proof
  -> implementation or test only if semantics are PROVEN
```

## Change Authority

Authorized:
- Modify `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`.
- Update this architecture gate record.

Not authorized:
- Modify Healthcare, Education, Logistics, Platform/Core, product runtime, migrations, generated types, or tests.
- Implement the Laboratory patient-linkage semantic fix.

## UI -> Contract Reconciliation

- No UI change.
- No data-bound or action-bound UI element changed.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or production data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: verify only governance docs and this gate record changed.
2. Contract Boundary: rule points agents to canonical contracts and ownership before code/test.
3. Tenant Isolation: no runtime path changed.
4. RLS & Authorization: no runtime path changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no Healthcare/Education/Logistics domain route touched.
8. Temporal Provenance: no historical mutation.
9. Rule Governance: governance text only; no governed runtime rule changed.
10. Audit & Evidence Integrity: verify diff contains explicit `BUSINESS_SEMANTICS = NOT_PROVEN` stop rule.
11. Regression: run `git diff --check` and inspect final diff.

---

# ARCHITECTURE GATE RESULT - BABYCARE CUSTOMER CARD PROGRESS

> **Status:** PASS - product UI consumer correction authorized
> **Date:** 2026-10-07
> **Scope:** Fix BabyCare customer-list active package progress card so it renders persisted booking progress instead of hardcoded 80%.

## Bella OS/Product Development Process Gate

- Truth: Customer package progress for the customer list is derived from the selected booking's `completed_sessions` and `total_sessions`.
- Source of Truth: `bookings` rows returned by `getCustomers`, existing customer detail/booking selector UI behavior, and Bella architecture constitution.
- Canonical Contract: Product UI consumes customer rows with tenant-scoped nested `bookings`; progress is `completed_sessions / total_sessions`, clamped from 0 to 100.
- Gate result: `PASS` for product UI and focused helper/test changes only.

## Product Manifest

- Product: Bella BabyCare customer CRM list.
- Capability in scope: active package summary card on `/dashboard/customers`.
- Existing capability: customer list loads tenant-scoped `bookings` with `package_name`, `status`, `is_in_care`, `total_sessions`, `completed_sessions`, and payment data.
- Requested correction: remove hardcoded progress display and bind it to the selected display booking.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| `customers` rows | Product CRM persistence | consume only |
| `bookings.completed_sessions` / `bookings.total_sessions` | Booking/session product persistence | consume only |
| Customer-list selected booking | `customer-list-rules.ts` product UI rule | may extend helper logic |
| Active package card rendering | `/dashboard/customers` product UI | may modify |
| Healthcare/Education/Logistics kernels | Frozen OS kernels | do not touch |

## Contract Dependency Map

```text
/dashboard/customers UI
  -> getCustomers()
  -> tenant-scoped customers + nested bookings
  -> selectCustomerDisplayBooking()
  -> calculateCustomerBookingProgress()
  -> active package card progress text/bar
```

## Change Authority

Authorized:
- Modify `src/app/dashboard/customers/customer-list-rules.ts`.
- Modify `src/app/dashboard/customers/page.tsx`.
- Add focused tests for progress calculation and selected booking display state.

Not authorized:
- Database migration or schema changes.
- Platform/Core changes.
- Healthcare, Education, or Logistics kernel changes.
- Broad BabyCare redesign or unrelated CRM behavior changes.

## UI -> Contract Reconciliation

- UI currently uses real booking data for package name and active status, but hardcodes progress at 80%.
- Correct UI contract is to render progress from the same selected display booking used for package/status.
- Missing or invalid totals must not invent progress; use 0 percent and clamp valid computed values.

## Additive Migration Plan

- No migration required.
- No table, index, RLS, or generated type change required.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: confirm no frozen kernel/platform files are touched.
2. Contract Boundary: UI consumes existing `getCustomers` booking payload only.
3. Tenant Isolation: preserve existing `getCustomers().eq('tenant_id', tenantId)` filtering.
4. RLS & Authorization: no auth/RLS changes.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write path or event path touched.
7. Domain Safety Routing: not applicable; no Healthcare/Education/Logistics domain route touched.
8. Temporal Provenance: not applicable; no historical mutation.
9. Rule Governance: not applicable; no governed rule change.
10. Audit & Evidence Integrity: focused source/test evidence for UI calculation.
11. Regression: run focused customer-list tests and a targeted TypeScript check where feasible.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL CHAIN AUDIT & COMPLETION

> **Status:** PASS - product-layer Preschool Chain completion authorized
> **Date:** 2026-10-06
> **Scope:** Audit and complete Preschool Chain evidence from API trigger to product-owned branch/chain persistence and read-back, without modifying frozen Education Kernel code or Platform org-unit engine.

## Bella OS/Product Development Process Gate

- Truth: Preschool runtime enrollment uses canonical `edu_courses`, `edu_enrollments`, `students`, `party_parties`, `edu_attendance`, and `edu_attendance_daily_state`.
- Source of Truth: Education Constitution, product manifest, canonical Education public contracts, Supabase migrations/types, and existing Preschool operational tests.
- Canonical Contract: Product → Education public contracts for student/enrollment/attendance; Product → Platform org hierarchy data (`org_units`, `org_relationships`, `people_directory`, `user_org_unit_access`) for chain/branch scope.
- Gate result: `PASS` for product-layer additive completion only. No `src/platform/education/` changes are authorized.

## Product Manifest

- Product: Bella Education / Preschool implementation (`bella_education`).
- Existing capabilities: course catalog query, student enrollment command, attendance checkpoint command, grade reporting command.
- Gap found during audit: no explicit Preschool product capability records customer-chain/branch assignment through the canonical `edu_*` runtime path.
- Additive capability: Preschool branch/chain assignment and verification for enrollment flows.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| `org_units`, `org_relationships`, `people_directory` | Platform Org Unit / Authorization | consume only; do not modify engine |
| `edu_courses`, `edu_enrollments`, Education public contracts | Education Kernel | consume only; do not modify frozen code |
| Preschool course/enrollment branch assignment | Bella Education product layer | add product-owned tables/service |
| Enrollment API orchestration | Bella Education product/API layer | wire branch assignment after canonical enrollment |
| Real DB proof | Product verification | prove only when credentials/environment are available |

## Contract Dependency Map

```text
API Trigger
  -> Bella Education enrollment route
  -> StudentContract / EnrollmentContract
  -> Education Kernel persistence in canonical edu_* tables
  -> Preschool product chain assignment
  -> Platform org-unit membership/branch validation
  -> product read-back verification
```

## Change Authority

Authorized:
- Additive product-owned migration for Preschool chain assignment tables/indexes/RLS.
- Product service and route wiring under `src/products/bella-education` / `src/app/api/education`.
- Focused unit/integration tests for chain validation and route behavior.
- Minimal Preschool enrollment UI wiring for runtime branch selection/read-back when branch scope is available.

Not authorized:
- Modifying `src/platform/education/`.
- Modifying Platform org-unit engine.
- Altering frozen Healthcare/Logistics artifacts.
- Creating a Preschool-specific branch registration architecture.
- Broad UI redesign, unrelated Preschool features, or core abstractions.

## UI -> Contract Reconciliation

Authority boundary:
- Chain/branch lifecycle registration authority remains Platform Org Unit / tenant organization management. Preschool must not create a separate branch registry.
- HQ subscription/franchise setup is tenant/customer commercial authority and is not the Preschool runtime chain assignment authority.
- Preschool runtime authority is limited to assigning an enrollment/course to an existing active branch the current tenant/user can access.

UI reconciliation:
- Existing Preschool enrollment UI has classroom selection but no branch selection, so canonical runtime assignment is not proven from product UI.
- Minimal authorized UI fix is to fetch accessible tenant branches, require a branch only when branches are available, submit `branchId` with admission, and render backend read-back.
- Branch registration/management UI remains the existing organization/branch management surface; no new Preschool management surface is authorized unless a separate business contract requires it.

## Additive Migration Plan

- `CREATE TABLE public.preschool_chain_course_branch_assignments`.
- `CREATE TABLE public.preschool_chain_enrollment_branch_assignments`.
- Add indexes, unique constraints, FK constraints to canonical `edu_courses`, `edu_enrollments`, `org_units`, and `tenants`.
- Enable tenant RLS and grant standard authenticated/service-role access.
- No alteration of `edu_courses`, `edu_enrollments`, Platform tables, or frozen kernel code.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: no Platform/Education Kernel source modification.
2. Contract Boundary: product consumes Education public contracts.
3. Tenant Isolation: product chain service rejects cross-tenant branch/course/enrollment.
4. RLS & Authorization: migration enables tenant RLS; service checks user branch access.
5. Database Migration Safety: additive `CREATE TABLE`/indexes only.
6. Event-After-Persistence: no new async event; assignment follows successful enrollment persistence.
7. Academic Safety Routing: unchanged; enrollment remains in Education contract.
8. Temporal Provenance: additive timestamps/actor/request identifiers on chain rows.
9. Rule Governance: unchanged; no grading/prerequisite rule changes.
10. Audit Evidence Integrity: focused chain tests and read-back evidence.
11. Platform Regression: run targeted product tests, education architecture/conformance where feasible, typecheck/diff checks.

---

## Additional Architecture Gate - Education E2E Baseline Repair

> **Status:** PASS - isolated E2E migration orchestration repair authorized
> **Date:** 2026-10-06
> **Scope:** Repair schema/history drift in the isolated E2E database so PR changed migrations can depend on canonical Education runtime tables. Do not modify Preschool Chain migration to hide dependencies, do not create duplicate `edu_*` tables, and do not alter frozen Education Kernel source.

- Bella OS/Product Development Process Gate: PASS. This is CI/E2E database orchestration only. It consumes canonical migrations already in `supabase/migrations` and does not change product runtime contracts, Education Kernel source, or production schema design.
- Truth / Source of Truth: PR #240 changed migration `20261006010000_preschool_chain_assignments.sql` correctly references canonical `public.edu_courses` and `public.edu_enrollments`. CI proves the isolated E2E DB has migration history through later versions but lacks `public.edu_courses`, so the failure is baseline schema drift, not a Preschool migration ownership defect.
- Product Manifest: no new product capability. The existing Preschool Chain proof requires canonical Education enrollment tables and route support tables to exist in the isolated E2E database.
- Ownership Map: `party_parties` remains owned by the canonical Blueprint core schema migration. `platform_rule_domain` remains owned by the canonical Platform Rule Engine migration. `org_units`, `people_directory`, `org_relationships`, and `user_org_unit_access` remain owned by canonical Platform Org/Authorization migrations. `edu_courses`, `edu_enrollments`, and enrollment RPC remain owned by canonical Education migrations. `edu_preschool_pickup_authorizations` remains owned by the existing Preschool guardian authorization migration. `scripts/apply-e2e-pr-migrations.cjs` owns PR-scoped isolated E2E migration apply orchestration.
- Contract Dependency Map: CI Real Database Business E2E -> apply changed PR migrations -> verify/repair canonical E2E prerequisites from repository migrations -> Preschool Chain migration -> admission route -> Education contracts -> `edu_enrollments` -> Preschool chain read-back.
- Change Authority: limited to `scripts/apply-e2e-pr-migrations.cjs` and this gate note. Not authorized: modifying `src/platform/education/`, rewriting Education schema, adding duplicate tables to Preschool migration, resetting migration history, or broad CI workflow refactors.
- UI -> Contract Reconciliation: none.
- Additive Migration Plan: none. The script may apply existing canonical migrations to the isolated E2E DB only when required schema objects are missing despite migration history.
- Verification Gates Plan: script syntax check, dry-run migration discovery, zero-downtime migration validation, CI scope router check, `git diff --check`, then rerun PR #240 Real Database Business E2E and migration gates to terminal status.

---

## Additional Architecture Gate - Preschool Student Admission Read-Back

> **Status:** PASS - app read-model/UI registry fix authorized
> **Date:** 2026-10-06
> **Scope:** Prove Preschool Student/Admission read-back after canonical enrollment persistence without reopening Preschool Chain, modifying frozen Education Kernel code, or creating a new student architecture.

- Bella OS/Product Development Process Gate: PASS. This is a minimal Education app/API read-model and UI registry reconciliation, not a Kernel contract change, schema change, product redesign, or Chain continuation.
- Truth / Source of Truth: Admission mutation already persists canonical Party-backed Student and `edu_enrollments`; the registry page initializes from static demo data and has no `GET /api/education/enrollments` read-back path after reload.
- Product Manifest: no new product capability. Existing Student Registry / Admission surface should display canonical persisted admissions for the current tenant.
- Ownership Map: `edu_enrollments`, `students`, and Education public contracts remain Education-owned. The app route owns a tenant-scoped read model, matching existing classroom roster/finance read-model patterns. Guardian display uses existing Preschool guardian authorization service.
- Contract Dependency Map: Preschool registry UI -> `GET /api/education/enrollments` -> tenant/auth context -> canonical `edu_enrollments` + `students` + `party_parties` + `edu_courses` -> guardian authorization read service -> UI read-back.
- Change Authority: limited to `src/app/api/education/enrollments/route.ts`, `src/app/api/education/enrollments/__tests__/route.test.ts`, `src/app/dashboard/education/enrollments/page.tsx`, and this gate note.
- UI -> Contract Reconciliation: replace static-only student list with tenant-scoped API read-back; after admission submit, refresh from canonical read model. Demo rows may remain only as an empty/error fallback.
- Additive Migration Plan: none.
- Verification Gates Plan: targeted enrollment route tests, route/UI typecheck, targeted lint, `git diff --check`, education architecture/no-new-debt gates where relevant.
- Explicit non-goals: no `src/platform/education/` modification, no new list contract, no migration, no Chain changes, no persistence redesign for optional nickname/medical-note metadata.

---

## Additional Architecture Gate - English Operational Real DB Target Normalization

> **Status:** PASS - test/infrastructure configuration repair authorized
> **Date:** 2026-10-06
> **Scope:** Normalize the English Post-RC Real DB proof command to the canonical E2E Supabase project used by Browser E2E evidence. Do not create tenants, mutate data, modify English product runtime code, or expose secrets.

- Bella OS/Product Development Process Gate: PASS. This is a verification-target repair only. It does not change Product, Platform, Education Kernel, schema, or business behavior.
- Product Manifest: Bella English Center remains unchanged. Existing product identity and schema/RLS proof surfaces are consumed only for verification.
- Ownership Map: `package.json` owns local command routing. `scripts/run-english-center-post-rc-real-db.cjs` owns English-specific verification environment normalization. Supabase credentials and Postgres connection strings remain external secret configuration and are not committed.
- Contract Dependency Map: `npm run test:english-center-post-rc-real-db` -> English verification env wrapper -> `.env.e2e` / `E2E_ENV_FILE` -> Supabase project `bmnbqbcdbuklhopfbopv` -> existing Jest Real DB validation.
- Change Authority: authorized to modify test/infrastructure command routing and add a small wrapper script. Not authorized to modify `src/products/bella-english-center`, `src/platform/education`, HQ onboarding, migrations, production/customer data, or E2E tenant bootstrap.
- UI -> Contract Reconciliation: none.
- Additive Migration Plan: none.
- 11 Automated Verification Gates Plan: assert canonical project ref before test execution, require a runnable Postgres URL for the same project, run the focused English Real DB gate, run `git diff --check`, and inspect worktree status.

---

## Additional Architecture Gate - English Migration Packaging Contract Repair

> **Status:** PASS - migration packaging repair authorized; DB apply not authorized in this step
> **Date:** 2026-10-06
> **Scope:** Convert existing English Center migration files into the repository's approved E2E migration-runner contract without changing English product runtime code, creating tenants, resetting any database, or manually writing migration ledger rows.

- Bella OS/Product Development Process Gate: PASS. This is a schema-migration packaging repair only. It does not change Product service/API behavior, Education Kernel code, Platform contracts, or business semantics.
- Product Manifest: Bella English Center schema remains product-owned additive schema. The packaging repair preserves the existing English Center tables, RLS policies, grants, triggers, comments, and concurrent-index intent.
- Ownership Map: `supabase/migrations/*english_center*.sql` owns English product schema packaging. `scripts/apply-e2e-pr-migrations.cjs` owns the approved E2E apply contract requiring 14-digit migration versions and ledger recording after successful apply.
- Contract Dependency Map: existing English SQL -> valid 14-digit migration files -> approved E2E apply script -> canonical E2E DB `bmnbqbcdbuklhopfbopv` -> English Real DB schema/RLS validation.
- Change Authority: authorized to rename/split English migration files and separate `CREATE INDEX CONCURRENTLY` statements into standalone migration files so the existing runner can apply them one file at a time. Not authorized to modify `src/products/bella-english-center`, create tenants, mutate E2E DB in this step, reset DB, use `--include-all`, or manually alter migration history.
- UI -> Contract Reconciliation: none.
- Additive Migration Plan: no new schema semantics; packaging only. Existing `CREATE TABLE`, RLS, grants, triggers, and indexes remain additive.
- 11 Automated Verification Gates Plan: validate all English migration filenames against the approved parser, prove no duplicate migration versions, prove concurrent-index statements are standalone and outside explicit transactions, run script syntax checks, run migration/scope validation where local-only, run `git diff --check`, then stop before DB mutation.

---

## Additional Architecture Gate - English E2E Migration Apply Evidence

> **Status:** PASS_FOR_SCHEMA_RLS_AND_REAL_DB_GATE
> **Date:** 2026-10-06
> **Scope:** Apply the validated English Center migration set only to the canonical E2E Supabase project `bmnbqbcdbuklhopfbopv` using the approved E2E migration runner. No tenant bootstrap, production/customer mutation, reset/drop, manual ledger writes, or English product runtime changes are authorized.

- Bella OS/Product Development Process Gate: PASS. The DB mutation is limited to applying existing product-owned English Center schema migrations through the approved E2E process.
- Product Manifest: Bella English Center runtime/product code remains unchanged. This step proves schema/RLS availability on the canonical E2E DB only.
- Ownership Map: `supabase/migrations/*english_center*.sql` owns schema objects. `scripts/apply-e2e-pr-migrations.cjs` owns ordered apply and ledger recording. The canonical E2E database owns remote verification state.
- Contract Dependency Map: validated English migration set -> approved E2E migration runner -> `bmnbqbcdbuklhopfbopv` -> remote table/RLS/policy/ledger evidence -> `npm run test:english-center-post-rc-real-db`.
- Change Authority: authorized DB mutation is limited to those 31 English Center migrations. Not authorized: tenant creation, seed data, browser E2E, production/customer DB mutation, `--include-all`, manual ledger writes, or unrelated duplicate-version cleanup.
- UI -> Contract Reconciliation: none.
- Additive Migration Plan: applied 31 English Center migrations in repository order. Remote read-back found 20/20 `english_center_*` tables, RLS enabled on all checked tables, at least one policy per table, and 31/31 English migration ledger rows.
- Verification Gates: target project confirmed as `bmnbqbcdbuklhopfbopv`; approved apply completed; `npm run test:english-center-post-rc-real-db` PASS on `.env.e2e`; tenant bootstrap remains NOT_STARTED.
- Grant Evidence Boundary: service-role DML privileges are present for all 20 checked English tables. Authenticated DML grants are present for the core/program/course/class/enrollment/teacher/timetable/learning/tuition tables and absent for the four engagement tables because `20260914190000_create_english_center_engagement.sql` does not grant authenticated table privileges. Do not claim full authenticated engagement grant proof from this step.

---

## Additional Architecture Gate - English E2E Tenant Bootstrap Evidence

> **Status:** PASS_FOR_TENANT_RUNTIME_AND_POST_RC_BROWSER_GATE
> **Date:** 2026-10-07
> **Scope:** Bootstrap exactly one marker-scoped Bella English Center verification tenant on canonical E2E Supabase project `bmnbqbcdbuklhopfbopv`, then verify tenant, branch, auth/user, operational seed read-back, Real DB gate, and Browser E2E. No production/customer database mutation and no English product runtime code change are authorized.

- Bella OS/Product Development Process Gate: PASS. This is an authorized E2E test-data/bootstrap mutation only, following existing tenant/user/branch seed patterns and preserving product/runtime code.
- Product Manifest: Bella English Center product identity remains `bella_english_center`. The bootstrap tenant is a verification fixture, not a production/customer tenant.
- Ownership Map: `tenants.product_key` owns product identity. `org_units` owns branch runtime. `users` plus Supabase Auth own test admin identity. English Center product tables own marker-scoped operational seed rows.
- Contract Dependency Map: `bella_english_center` tenant -> branch `org_units` -> admin user/auth -> `user_org_unit_access` -> English product operational tables -> Post-RC browser/API validation.
- Change Authority: authorized to create one E2E tenant fixture and minimal operational seed on `bmnbqbcdbuklhopfbopv`. Not authorized: production/customer mutation, BabyCare fallback, English runtime code edits, grant repair without authenticated runtime failure evidence, or extra tenant creation.
- Additive Migration Plan: none. No schema changes in this step.
- Bootstrap Evidence: one tenant exists for `product_key = 'bella_english_center'`; branch count 1; admin DB user count 1; Supabase Auth user created for the same admin id; marker-scoped E2-E8 operational rows read back with count >= 1 for program, course, class, enrollment, teacher, teacher-branch, room, session, attendance, progress, tuition plan, tuition assignment, tuition invoice, tuition payment, engagement template, engagement message, engagement recipient, and engagement response.
- Branch/Auth Evidence: `user_org_unit_access` read-back under `app.current_tenant_id` and `app.current_user_id` returned branch access through both `belongs_to` and `tenant_admin`.
- Verification Gates: `npm run test:english-center-post-rc-real-db` PASS on `.env.e2e`; `E2E_TENANT_PRODUCT_KEY=bella_english_center npm run e2e:english-center-post-rc` PASS with 2/2 Playwright tests. Browser evidence includes `/dashboard/english-center/learning`, `/tuition`, `/engagement`, `/command-center` rendering <400 without runtime errors, and API probes returning expected statuses including `/api/english-center/command-center` = 200.
- Residual Boundary: this proves the Post-RC tenant/runtime/browser path on the seeded E2E fixture. It does not convert production/customer readiness or unrelated authenticated E8 engagement table grants into PASS beyond the runtime exercised here.

---

## Canonical Seal - English Center Operational Chain

> **Status:** ENGLISH CENTER OPERATIONAL CHAIN = PROVEN_FOR_MARKER_SCOPED_E2E_POST_RC
> **Date:** 2026-10-07

- Proven Scope: Product Identity, Schema/RLS, 31/31 migrations, migration ledger, Real DB gate, marker-scoped E2E tenant, branch, admin/auth fixture, operational seed, branch access, and Post-RC Browser E2E.
- Base/Main Commit: `77231ba1b93f889ecc797242e4b0d8cf0f8a703f`.
- Pull Request: NOT_CREATED in this step.
- Canonical E2E DB: `bmnbqbcdbuklhopfbopv`.
- Product Identity: `tenants.product_key = 'bella_english_center'`.
- Real DB Evidence: `npm run test:english-center-post-rc-real-db` PASS against `.env.e2e`.
- Browser Evidence: `E2E_TENANT_PRODUCT_KEY=bella_english_center npm run e2e:english-center-post-rc` PASS, 2/2 Playwright tests.
- Production/Customer Runtime: NOT_CLAIMED.
- Go-Live: NOT_CLAIMED.
- E8 Authenticated Grant Boundary: EVIDENCE GAP remains recorded for the four engagement tables. No grant repair is authorized unless a later authenticated runtime path proves it is a root cause.
- Scope Decision: STOP. Do not continue coding English Center in this workstream.

---

## Additional Architecture Gate - Preschool Class Canonical Course Read-Back

> **Status:** PASS - app route canonical course reconciliation authorized
> **Date:** 2026-10-06
> **Scope:** Reconcile Preschool Class UI/API options with canonical `edu_courses` used by admission/enrollment runtime, without modifying frozen Education Kernel contracts or creating a new class architecture.

- Bella OS/Product Development Process Gate: PASS. This is a route-level read-model and dual-write success validation fix for existing Class UI, not a Kernel schema/contract change.
- Truth / Source of Truth: `POST /api/education/courses` writes a legacy `courses` projection and an `edu_courses` row; `POST /api/education/enrollments` verifies active courses only in `edu_courses`. Before this fix, `GET /api/education/courses` listed `courses` projection rows, so UI/admission could select a class not proven enrollment-compatible.
- Product Manifest: no new product capability. Existing Class management must expose classes that can be used by canonical enrollment.
- Ownership Map: `edu_courses` remains Education runtime enrollment source; `courses` remains projection/detail surface for room/grade metadata and legacy classroom UI. Teacher assignment contract remains the teacher assignment authority.
- Contract Dependency Map: Class UI -> `GET /api/education/courses` -> tenant/auth context -> canonical `edu_courses` -> optional `courses` projection metadata -> teacher assignment contract -> enrollment/attendance counts.
- Change Authority: limited to `src/app/api/education/courses/route.ts`, focused tests, and this gate note.
- UI -> Contract Reconciliation: list class/admission options from canonical `edu_courses`; merge legacy projection only for display fields. Class creation must fail if canonical `edu_courses` persistence fails.
- Additive Migration Plan: none.
- Verification Gates Plan: targeted courses/enrollment route tests, changed-file typecheck, targeted lint, `git diff --check`, education no-new-debt and architecture baseline checks.
- Explicit non-goals: no Platform/Education Kernel modification, no migration, no table removal, no broad classroom redesign, no Chain reopen.

---

# ARCHITECTURE GATE RESULT - GLOBAL LINT BASELINE REMEDIATION

> **Status:** PASS - Platform/CI lint error baseline remediated
> **Date:** 2026-10-04
> **Scope:** Reduce pre-existing repo-wide `npm run lint` errors without touching Bella English business logic, product contracts, database schema, or frozen kernels.

## Additional Architecture Gate - Beauty V2 Runtime Branch Context

> **Status:** PASS - minimal runtime branch context integration authorized
> **Date:** 2026-10-06
> **Scope:** Connect the completed Beauty V2 Tenant Chain MVP to runtime branch selection and server-side branch authorization. Do not expand Chain UI, do not add Region, do not modify HQ Tenant Provisioning, do not modify `registerNewTenant()`, do not create Beauty-specific chain tables, and do not redesign Platform kernel.

- Bella OS/Product Development Process Gate: PASS. This change consumes existing Platform org/people/access primitives and existing branch-aware Beauty consumers; it does not alter frozen Healthcare/Education/Logistics kernels or Platform ownership boundaries.
- Product Manifest: runtime scope includes accessible branch read, active branch selection, branch selector UI in the Beauty shell, and canonical branch context resolution through `user_org_unit_access`. Out of scope: Region, new chain tables, broad module refactors, HQ tenant provisioning, accounting consolidation, franchise/inter-company, and claiming full Real DB E2E proof unless a real database proof is actually run.
- Ownership Map: Platform owns `org_units`, `org_relationships`, `people_directory`, and `user_org_unit_access`. Beauty V2 owns runtime selection UX and passes selected `branchId` into branch-aware flows. Existing business writers remain responsible for server-side deny-before-write checks.
- Contract Dependency Map: Chain Management writes Platform contract -> `user_org_unit_access` projects allowed branches -> Beauty runtime selector exposes active branch -> branch-aware consumers call `resolveSingleStaffBranchContext` -> writes persist canonical `branch_id`.
- Change Authority: authorized layers are Beauty runtime branch context service/action, a small shell selector component, focused tests, and minimal resolver hardening to prefer `user_org_unit_access`. Not authorized: HQ, Product Registry identity, migrations, generated type edits, Platform kernel redesign, or broad UI redesign.
- UI -> Contract Reconciliation:
  - Active branch selector: MATCH, reads accessible branch options from `user_org_unit_access` and `org_units`.
  - Selected branch: MATCH, persisted as runtime UI context and revalidated server-side before writes.
  - Attendance/booking/product sale/payroll consumers: PARTIAL/MATCH, existing consumers already accept or derive branch context; this PR standardizes the context source but does not refactor every product module.
- Additive Migration Plan: none. Existing Platform schema and view are reused.
- 11 Automated Verification Gates Plan: focused unit tests for branch option read, single-branch auto-selection, selected branch authorization, cross-tenant/unauthorized denial, runtime resolver using `user_org_unit_access`, plus targeted TypeScript/lint/diff checks. Real DB E2E remains a separate proof unless explicitly run against real Supabase.
- Explicit decision: `Runtime Branch Context` is `PROVEN_BY_REAL_DB_E2E`. `BEAUTY_V2_TENANT_CHAIN = PROVEN` for the MVP scope after the real Supabase E2E flow passed on 2026-10-06: create Company -> create Branch A/B -> create Staff user -> assign Staff to Branch A -> read `user_org_unit_access` -> runtime Branch A allowed -> runtime Branch B denied -> attendance write at Branch A -> database read-back.

## Additional Architecture Gate - Beauty V2 Branch Runtime Operational Verification

> **Status:** PASS - Booking, Inventory, Payroll, and Commission runtime branch verification sealed
> **Date:** 2026-10-06
> **Scope:** Verify branch-aware runtime correctness for Beauty V2 Booking, Inventory/Product Sales, Payroll, and Commission using the already sealed Tenant Chain MVP and canonical branch context. Do not reopen Chain MVP, do not modify HQ, do not modify `registerNewTenant()`, do not create Beauty-specific chain tables, and do not expand Region or Platform kernel scope.

- Bella OS/Product Development Process Gate: PASS. This change consumes existing Platform org access (`user_org_unit_access`) and existing Beauty operational writers. It does not alter frozen Healthcare/Education/Logistics kernels, Product Registry identity, HQ provisioning, or database schema.
- Product Manifest: operational verification scope includes Booking service-item commission writes, Product Sales inventory/commission writes, Attendance -> Payroll branch propagation, and Commission source branch matching. Out of scope: general stock movement redesign, every Booking mutation, Region, Payroll/Finance expansion, HQ, and cross-tenant chain modeling.
- Ownership Map: Platform owns org access projection and org units. Beauty V2 owns runtime branch selection and operational writer validation. Payroll owns salary branch derivation from attendance and commission source matching.
- Contract Dependency Map: Chain Management -> `org_units` / `org_relationships` / `people_directory` -> `user_org_unit_access` -> active branch context -> Booking/Product Sales/Attendance writers -> Payroll/Commission read-back.
- Change Authority: authorized code change is limited to replacing the remaining explicit KTV attendance branch authorization path with the existing canonical `resolveSingleStaffBranchContext`. Authorized tests include focused unit coverage and a Real DB operational proof. Not authorized: Platform kernel redesign, migrations, HQ provisioning, new Beauty chain tables, or broad product refactors.
- UI -> Contract Reconciliation: no UI redesign. Runtime selector remains the branch context entrypoint; server-side writers still enforce branch access before mutation.
- Additive Migration Plan: none.
- Verification Gates Plan: focused unit tests for attendance, booking service item writer, product sales writer, session completion, salary recalculation, and runtime branch actions; Real DB E2E through `.env.e2e`; changed-file typecheck; targeted lint; `git diff --check`.
- Explicit decision: `BEAUTY_V2_BRANCH_RUNTIME = PROVEN_FOR_BOOKING_INVENTORY_PAYROLL_COMMISSION` after Real DB E2E passed on 2026-10-06: Branch A allowed, Branch B denied before write, Booking service item and Product Sales persisted `branch_id = Branch A`, Payroll wrote `salary_records.branch_id = Branch A`, Commission source mismatch for Branch B was denied, and DB read-back confirmed no Branch B mutation.

## Additional Architecture Gate - Beauty V2 Tenant Chain Management MVP

> **Status:** PASS - minimal tenant-side Chain Management MVP authorized
> **Date:** 2026-10-06
> **Scope:** Implement Beauty V2 tenant-side Company, Branch, Staff, and Staff -> Branch assignment using existing Platform org/people primitives. Do not modify HQ Tenant Provisioning, do not modify `registerNewTenant()`, do not create Beauty-specific chain tables, and do not claim runtime branch enforcement in this PR.

- Bella OS/Product Development Process Gate: PASS. The audit in `investigations/beauty-v2-tenant-chain-platform-contract-investigation.md` proves the data model foundation exists in Platform (`org_units`, `people_directory`, `org_relationships`, `user_org_unit_access`) and this scope is a Product tenant-side capability consuming that contract.
- Product Manifest: Beauty V2 Chain Management MVP includes Company, Branch list/create/detail, existing Staff linking, Staff -> Branch assignment, and access read-back. Region, runtime branch selector, booking/customer/inventory/payroll enforcement, franchise/inter-company, analytics, and Real DB end-to-end proof are out of scope.
- Ownership Map: `org_units`, `people_directory`, `org_relationships`, and `user_org_unit_access` are Platform/Foundation-owned. Beauty V2 owns tenant-side UX/API and Beauty-specific branch configuration/labels. Auth users and tenant roles remain owned by existing `users` management.
- Contract Dependency Map: Beauty V2 UI -> Beauty chain server actions/service -> Platform org/people tables under tenant-scoped RLS/admin authorization -> `user_org_unit_access` projection. Product code may consume Platform primitives; it must not create a parallel chain schema.
- Change Authority: authorized layers are a small Beauty chain service/action boundary, Beauty tenant dashboard UI/navigation, focused tests, and a minimal hardening of the staff assignment boundary needed to prevent missing tenant identity or cross-tenant relationships. Not authorized: HQ provisioning, Product Registry identity, Platform kernel redesign, generated type edits, schema migrations, Healthcare/Education/Logistics frozen kernels.
- UI -> Contract Reconciliation:
  - Chain Management entry: MATCH, maps to Beauty tenant-side product UI over Platform org/people contract.
  - Company display/create: MATCH, maps to `org_units.unit_type = 'company'`.
  - Branch list/create/detail: MATCH, maps to `org_units.unit_type = 'branch'` with `parent_id` company.
  - Staff list/link: MATCH, maps existing `users` to `people_directory.user_id`.
  - Staff assignment: MATCH with boundary hardening, maps Person -> Branch through `org_relationships`.
  - Branch access read-back: MATCH, maps to `user_org_unit_access`.
- Additive Migration Plan: none. No DDL is required for this MVP; existing Platform schema is reused.
- 11 Automated Verification Gates Plan: targeted unit tests for company creation, branch creation, staff person registration/link, Staff -> Branch assignment, same-tenant access read-back, cross-tenant assignment denial; targeted TypeScript/test command; `git diff --check`. Runtime branch enforcement and Real DB E2E are deferred to follow-up PRs.
- Explicit decision: `BEAUTY_V2_TENANT_CHAIN` remains `NOT_PROVEN` after this PR until runtime integration and Real DB E2E are implemented. This PR can only close as `READY_FOR_RUNTIME_INTEGRATION` if targeted tests pass.

## Additional Architecture Gate - Real Estate Unit Test Coverage Upload Stability

> **Status:** PASS - CI plumbing fix authorized
> **Date:** 2026-10-05
> **Scope:** Prevent the Real Estate `Unit Tests` job from failing after the unit-test command succeeds solely because the optional external Codecov upload has no artifact or hits a transient TLS/upload failure.

- Bella OS/Product Development Process Gate: PASS. This is CI workflow plumbing only; no Bella OS/Product runtime, schema, contract, or frozen kernel behavior is modified.
- Product Manifest: no new product capability.
- Ownership Map: `.github/workflows/ci-real-estate.yml` is owned by CI/repository governance. `node scripts/test-changed-files.mjs` remains the unit-test authority.
- Contract Dependency Map: GitHub Actions `Unit Tests` -> changed-file Jest runner -> optional coverage artifact -> optional Codecov upload.
- Change Authority: limited to the Real Estate workflow coverage-upload step and the matching `pull_request` path filter needed to verify workflow-only CI fixes. Unit-test execution remains mandatory.
- UI -> Contract Reconciliation: none.
- Additive Migration Plan: none.
- Verification Gates Plan: workflow syntax inspection, `git diff --check`, rerun CI.

## Additional Architecture Gate - Vercel Production Promote Scope

> **Status:** PASS - minimal production workflow promotion fix authorized
> **Date:** 2026-10-04
> **Scope:** Production workflow run `37214892483` passed validate, immutable preview build, exact preview health, and authenticated smoke, then failed `Promote Verified Preview` because `vercel promote` ran without the team scope used by the canonical rollback tooling.

- Bella OS/Product Development Process Gate: PASS. This is Platform/CI production promotion configuration, not Product Vertical behavior, schema, tenant model, auth architecture, or English business logic.
- Truth / Source of Truth: run `37214892483` failed at `npx vercel promote "$DEPLOYMENT_URL" --yes --token="$VERCEL_TOKEN"` with Vercel CLI `User not found (404)` after smoke success; `scripts/emergency-rollback.sh` and rollback documentation already use Vercel scope `bella-spa-s-projects` for promote/inspect operations.
- Canonical Contract: verified preview deployment must be promoted in the same Vercel team/project scope used by operational rollback.
- Ownership Map: `.github/workflows/deploy-production.yml` owns controlled production promotion; Vercel project/team configuration remains external production configuration.
- Change Authority: add explicit `VERCEL_SCOPE` workflow env with the existing team-scope default and pass it to `vercel promote`.
- UI -> Contract Reconciliation: no UI change.
- Additive Migration Plan: none; no DDL, DML, tenant provisioning, production data mutation, or credential change.
- Verification Gates Plan: workflow diff review, `git diff --check`, security/architecture gates, PR CI, then re-dispatch `Deploy to Production`.
- Explicit non-goals: no runtime code, no English business code, no secret change, no auth bypass, no production gate weakening, no migration, no Vercel project recreation.

## Additional Architecture Gate - Vercel Production Promote API Path

> **Status:** PASS - minimal production workflow promotion API fix authorized
> **Date:** 2026-10-05
> **Scope:** Production workflow run `37216425595` passed validate, immutable preview build, exact preview health, and authenticated smoke, then failed `Promote Verified Preview` even with `--scope` because Vercel CLI still attempted to load a user and returned `User not found (404)`.

- Bella OS/Product Development Process Gate: PASS. This is Platform/CI production promotion transport, not Product Vertical behavior, schema, tenant model, auth architecture, or English business logic.
- Truth / Source of Truth: run `37216425595` shows `Smoke Exact Preview = PASS` and `vercel promote "$DEPLOYMENT_URL" --scope "$VERCEL_SCOPE"` failing with Vercel CLI user-loading error. Vercel REST API documents Bearer token auth, team resource access with `teamId`, deployment lookup by ID/URL, and project deployment promotion through `POST /v10/projects/{projectId}/promote/{deploymentId}`.
- Canonical Contract: verified preview deployment must be promoted using the existing Vercel token, project ID, team ID, and deployment ID without relying on CLI user profile resolution.
- Ownership Map: `.github/workflows/deploy-production.yml` owns controlled production promotion; Vercel project/team/token configuration remains external production configuration.
- Change Authority: replace only the promotion transport in the production workflow with direct Vercel REST API calls that resolve the deployment ID from the exact preview host and promote that deployment for the configured production project/team.
- UI -> Contract Reconciliation: no UI change.
- Additive Migration Plan: none; no DDL, DML, tenant provisioning, production data mutation, or credential change.
- Verification Gates Plan: workflow diff review, `git diff --check`, security/architecture gates, PR CI, then re-dispatch `Deploy to Production`.
- Explicit non-goals: no runtime code, no English business code, no secret change, no auth bypass, no production gate weakening, no migration, no Vercel project recreation.

## Additional Architecture Gate - Production Smoke Client Monitoring Hardening

> **Status:** PASS - minimal monitoring runtime and smoke-harness fix authorized
> **Date:** 2026-10-04
> **Scope:** Production workflow run `37211453061` passed validate/build/immutable preview health but failed `Smoke Exact Preview` after real-auth login because client-side routine Sentry tunnel traffic emitted a transient `/monitoring` 503 console error; the first attempt also hit the single-test timeout while the page snapshot showed the system monitor content had rendered.

- Bella OS/Product Development Process Gate: PASS. This is Platform production smoke/runtime monitoring hardening, not Product Vertical behavior, schema, tenant model, auth architecture, or English business logic.
- Truth / Source of Truth: Playwright artifact from run `37211453061` shows `/api/tenant/context` returned `200`, dashboard routes rendered, one `/monitoring` request returned `503` while surrounding Sentry tunnel requests returned `200`, and the single smoke test timed out after serially visiting many routes.
- Canonical Contract: production smoke must prove authenticated core routes render without app runtime errors; routine client telemetry must not create false route failures. Real application errors still remain captured by browser `pageerror`, app error text checks, failed app routes, and Sentry error replay.
- Ownership Map: `instrumentation-client.ts` owns client-side monitoring sampling; `e2e/tests/12-authenticated-core-routes-smoke.spec.ts` owns read-only production smoke route evidence.
- Change Authority: reduce routine browser telemetry traffic by disabling client traces/session replay while keeping error replay enabled; split the core route smoke into route-level cases so each route has independent timeout/evidence.
- UI -> Contract Reconciliation: no UI change.
- Additive Migration Plan: none; no DDL, DML, tenant provisioning, production data mutation, or credential change.
- Verification Gates Plan: targeted Sentry instrumentation test, targeted Playwright smoke syntax/lint, `typecheck:changed`, `git diff --check`, security/architecture gates as needed, PR CI, then production workflow after merge.
- Explicit non-goals: no auth bypass, no production credential change, no English business code, no monitoring tunnel removal, no broad E2E rewrite, no workflow gate bypass.

## Additional Architecture Gate - Tenant Context Runtime Auth Cookie Fix

> **Status:** PASS - Minimal runtime boundary fix authorized
> **Date:** 2026-10-04
> **Scope:** Production smoke blocker where `/api/tenant/context` receives a valid Supabase browser auth cookie but returns `401`.

- Bella OS/Product Development Process Gate: PASS. This is an existing Platform runtime/auth API boundary repair, not a Product Vertical feature, UI redesign, Kernel change, or schema change.
- Product Manifest: no new product capability; preserve existing contract `authenticated request -> Supabase user -> public.users.tenant_id -> public.tenants -> TenantContext`.
- Ownership Map: Platform runtime/auth API owns the route behavior; `users` and `tenants` remain the existing data owners.
- Contract Dependency Map: protected UI -> `TenantContextProvider` -> `/api/tenant/context` -> Supabase Auth + RLS-backed `users`/`tenants`.
- Change Authority: `src/app/api/tenant/context/route.ts` and targeted API route regression test only.
- UI -> Contract Reconciliation: no UI change; existing protected pages depend on successful tenant context resolution after real auth login.
- Additive Migration Plan: none; no DDL, DML, tenant provisioning, or production data mutation.
- Verification Gates Plan: targeted API regression, lint/typecheck where available, `git diff --check`, CI, then production smoke workflow after merge.
- Explicit non-goals: no auth redesign, middleware redesign, hard-coded tenant/user, credential change, English business logic change, bypass auth, migration, or `any` introduction.

## Additional Architecture Gate - Tenant Context Web Runtime Cookie Decoder

> **Status:** PASS - route-only runtime decoder fix authorized
> **Date:** 2026-10-04
> **Scope:** Production smoke blocker after PR #217 where `/api/tenant/context` still returns `401` even though sanitized Playwright trace shows same-origin requests carry the Supabase auth cookie.

- Bella OS/Product Development Process Gate: PASS. This is a minimal Platform tenant-context API runtime compatibility repair, not an auth architecture change, Product Vertical feature, UI redesign, Kernel change, or schema change.
- Truth / Source of Truth: production workflow run `37204581799` on SHA `cec170c56fa0bfe1dc12f6a7fff8d25c2c16edd5` passed validate/build/immutable preview health but failed `Smoke Exact Preview`; sanitized trace metadata shows `/api/tenant/context` requests returned `401` with `cookie` header present.
- Product Manifest: no product capability change. Preserve existing contract `authenticated Supabase cookie -> verified user -> public.users.tenant_id -> public.tenants -> TenantContext`.
- Ownership Map: `src/app/api/tenant/context/route.ts` owns tenant-context route behavior; Supabase Auth remains authentication source of truth; `users`/`tenants` remain existing data owners.
- Contract Dependency Map: protected UI -> `TenantContextProvider` -> `/api/tenant/context` -> Supabase Auth cookie decode -> `auth.getUser(accessToken)` -> tenant profile lookup.
- Change Authority: `src/app/api/tenant/context/route.ts`, targeted regression test in `src/__tests__/api-tenant-context.test.ts`, and this gate note only.
- UI -> Contract Reconciliation: no UI change; existing protected pages depend on successful tenant context resolution after real auth login.
- Additive Migration Plan: none; no DDL, DML, tenant provisioning, or production data mutation.
- Verification Gates Plan: unauthenticated request remains `401`; authenticated Supabase cookie decodes in a runtime without Node `Buffer`; targeted API regression; lint/typecheck; security/architecture gates; CI; production workflow after merge.
- Explicit non-goals: no auth redesign, middleware redesign, hard-coded tenant/user, credential change, English business logic change, bypass auth, migration, broad abstraction, or `any` introduction.

## Additional Architecture Gate - Tenant Context Public Env Contract

> **Status:** PASS - route-only stale env consumer fix authorized
> **Date:** 2026-10-04
> **Scope:** Production smoke blocker after PR #218 where `/api/tenant/context` still returns `401` even though sanitized Playwright trace proves the Supabase auth cookie is present, base64-decodable, contains a non-expired `access_token`, and reaches the exact preview route.

- Bella OS/Product Development Process Gate: PASS. This is a minimal Platform tenant-context API env-contract repair, not an auth architecture change, Product Vertical feature, UI redesign, Kernel change, or schema change.
- Truth / Source of Truth: production workflow run `37206117376` on SHA `458ca060b73b0119b687bab17571897869db02dc` passed validate/build/immutable preview health but failed `Smoke Exact Preview`; sanitized trace shows `/api/tenant/context` requests include `sb-[project]-auth-token`, the cookie payload has `access_token`, and the token is not expired.
- Canonical Contract: browser Supabase clients use `requireSupabasePublicEnv()`, whose public key contract is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Stale Consumer: `/api/tenant/context` used `NEXT_PUBLIC_SUPABASE_ANON_KEY` directly for both SSR and bearer clients, diverging from production workflow/build config where publishable key is the canonical public key.
- Ownership Map: `src/app/api/tenant/context/route.ts` owns tenant-context route behavior; `src/lib/supabase-public-env.ts` owns public Supabase env resolution; Supabase Auth remains authentication source of truth.
- Contract Dependency Map: protected UI -> `TenantContextProvider` -> `/api/tenant/context` -> Supabase public env -> Supabase Auth token verification -> `users`/`tenants`.
- Change Authority: `src/app/api/tenant/context/route.ts`, targeted regression test in `src/__tests__/api-tenant-context.test.ts`, and this gate note only.
- Additive Migration Plan: none; no DDL, DML, tenant provisioning, or production data mutation.
- Verification Gates Plan: targeted API regression proving publishable-key-only env works; lint/typecheck; security/architecture gates; CI; production workflow after merge.
- Explicit non-goals: no auth redesign, middleware redesign, hard-coded tenant/user, credential change, English business logic change, bypass auth, migration, broad abstraction, or `any` introduction.

## Additional Architecture Gate - Vercel Exact Preview Archive Deploy

> **Status:** PASS - Minimal production workflow packaging fix authorized
> **Date:** 2026-10-04
> **Scope:** Production workflow exact preview deploy fails after successful Vercel build because `vercel deploy --prebuilt` hits Vercel upload request limits (`api-upload-free`, more than 5000); Vercel CLI recommends `--archive=tgz`.

- Bella OS/Product Development Process Gate: PASS. This is production workflow packaging, not Product Vertical code, UI, schema, Kernel, auth, tenant, or business logic.
- Product Manifest: no product capability change and no runtime contract change.
- Ownership Map: Platform/CI production deployment workflow owns exact preview packaging.
- Contract Dependency Map: `Deploy to Production` workflow -> immutable preview build -> exact preview deployment -> smoke -> promote.
- Change Authority: `.github/workflows/deploy-production.yml` deploy command only, plus this gate note.
- Additive Migration Plan: none.
- Verification Gates Plan: workflow syntax/diff review, `git diff --check`, PR CI, then re-dispatch `Deploy to Production`.
- Explicit non-goals: no Vercel project change, no secret change, no production domain promotion bypass, no application/runtime code change.

## Bella OS/Product Development Process Gate

- Problem: production workflow is blocked by a pre-existing global lint baseline (`53 errors + 73 warnings` in CI), proven unchanged before and after PR #204.
- Truth / Source of Truth: `npm run lint`, GitHub production workflow run `37171535585`, and parent comparison against `89e9c4b14da8cd358c9aed0ca3f22a7641268919`.
- Ownership: Platform/CI governance and repository hygiene. This is not Bella English product work.
- Boundary: fix only local lint errors whose runtime semantics are obvious and do not require product/domain contract changes.
- Gate result: `PASS`; `npm run lint` now exits 0 with `0 errors / 73 warnings`.

## Product Manifest

No new product capability. No UI redesign. No production data mutation.

In scope:
- Mobile tooling inline ESLint rule drift.
- Playwright fixture parameter false-positive from React Hooks lint.
- Malformed legacy utility/docs scripts that currently cannot parse.
- Mechanical JSX entity escaping for text nodes.
- Minimal React compiler compliance where functions were used before declaration, a tooltip component was created during render, or refs were updated during render.

Out of scope:
- Bella English business code.
- Education, Healthcare, Logistics, Finance business behavior.
- Schema, RPC, API, RLS, tenant, auth, or migration changes.
- Workflow/gate weakening or lint bypass.

## Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `npm run lint` | Platform/CI Governance | Production workflow quality gate |
| `apps/mobile/*.js` | Mobile tooling | CommonJS tooling scripts, not product runtime contracts |
| `e2e/fixtures/auth.ts` | E2E harness | Playwright fixture setup; no auth semantics change |
| `docs/reference/scripts/*`, `scripts/*` | Repository utility/archive scripts | Must be parseable or excluded by a deliberate governance decision |
| JSX text nodes | UI rendering surface | Preserve displayed text while satisfying `react/no-unescaped-entities` |
| React hooks/compiler checks | React runtime contract | Preserve hook order and behavior while satisfying compiler constraints |

## Contract Dependency Map

```text
production workflow
  -> npm run lint
  -> repository source parse/rule checks
  -> production workflow continuation
```

No Product -> Contract -> Kernel dependency is modified.

## Change Authority

Authorized:
- Local syntax repairs for malformed scripts.
- Local lint-rule naming repair where the referenced rule is unavailable.
- E2E fixture naming repair if Playwright fixture semantics remain unchanged.
- JSX text escaping that preserves rendered content.
- Function ordering / component extraction / effect-based ref updates for React compiler compliance.

Not authorized:
- Disabling `npm run lint` globally.
- Adding `continue-on-error`.
- Broad ESLint ignores for product source.
- Product behavior or business contract changes.

## UI -> Contract Reconciliation

No UI change.

## Additive Migration Plan

No migration.

## Verification Plan

1. Focused ESLint on Batch 1 files: `PASS`.
2. `npm run lint -- --quiet`: `PASS` (`0 errors`).
3. `npm run lint`: `PASS` (`0 errors / 73 warnings`).
4. `npm run typecheck:changed`: `PASS`, zero diagnostics.
5. `git diff --check`: `PASS`.

---

# Full System Typecheck Architecture Gate

> **Status:** DEFER for frozen/kernel-owned diagnostics; PASS for non-frozen, contract-proven, local cleanup batches
> **Date:** 2026-10-03
> **Scope:** System-wide TypeScript/typecheck cleanup. No new product capability, no schema/RPC invention, no strictness reduction, no suppressions.

## Baseline

- Canonical full command: `npm run typecheck:full`
- Raw full diagnostics: `849`
- Raw full warnings: `0`
- Raw full affected files: `91`
- CI script result: allowed by reviewed baseline, but this is `FAIL` for the zero-debt target.
- Adjunct mobile command: `npm run mobile:typecheck` fails before compiler because `apps/mobile` is not registered as an npm workspace.
- Direct mobile compiler diagnostics: `30`, mostly missing Expo/React Native dependency/type resolution.
- `npm run shared:typecheck`: PASS.
- `mcp-server/tsconfig.json`: PASS.

## Bella OS/Product Development Process Gate

- Problem: eliminate TypeScript/typecheck debt across the repository without suppressions, weakened strictness, or unrelated refactors.
- Truth: current diagnostics come from compiler output and scoped typecheck commands.
- Source of Truth: `package.json`, `tsconfig*.json`, `.github/workflows/type-check.yml`, `scripts/ci-run-typecheck.mjs`, generated DB types, frozen-layer policies, and vertical constitutions.
- Canonical Contract: consumers must follow public Platform/OS/generated DB contracts; generated types are evidence, not a repair surface.
- Boundary: cleanup may fix stale consumers, config resolution, or mapper typing only when the canonical contract is proven.
- Stop Conditions: frozen Logistics/Healthcare kernel edits without required governance process; schema/RPC invention; public-contract widening; suppressions/casts to hide mismatch.

## Product Manifest

This is not a new product or UI redesign. It covers:

- Root web/app TypeScript surface from `tsconfig.json`.
- Scoped platform/product configs.
- Workspace package scopes: `packages/shared`, `apps/mobile`, `mcp-server`.

Non-goals:

- No new OS/product capability.
- No database migration.
- No production mutation.
- No broad refactor.

## Ownership Map

- Typecheck orchestration: CI/platform tooling.
- Generated DB contracts: database/generated types source of truth.
- Logistics E7.1/E7.2/E7.3: sealed Logistics OS kernel; modifications require ACR/ADR/unlock/regression/re-seal.
- Healthcare H1-H12: frozen Healthcare OS kernel; Product/legacy services must use public contracts.
- Mobile app workspace: app/tooling configuration.
- Shared package: package-owned TypeScript config/source.
- Decision-engine archive: Platform/legacy service ownership; archive inclusion must be justified rather than patched as live product code.

## Contract Dependency Map

- Product/UI/legacy services -> public Platform/OS contracts -> generated DB types.
- Logistics consumers -> Logistics public/domain contracts; no sealed artifact edits without governance process.
- Healthcare product/legacy surfaces -> Healthcare public contracts; no H1-H12 internal table bypass.
- Mobile typecheck -> npm workspace registration -> mobile package dependencies -> Expo/React Native tsconfig.

## Change Authority

Authorized:

- Type-only cleanup and config fixes required to make compiler commands run correctly.
- Stale consumer repairs when canonical contract is proven.
- Tests/tooling fixes that do not hide diagnostics or reduce strictness.

Not authorized without explicit architecture unlock:

- Frozen Healthcare kernel changes.
- Sealed Logistics E7.1/E7.2/E7.3 artifact changes outside approved process.
- Generated type hand edits.
- Schema/RPC inventions.
- Compatibility aliases that change public contracts.

## UI To Contract Reconciliation

No UI redesign requested. UI diagnostics must still trace data/action assumptions to canonical API/service/generated DB contracts before repair.

## Additive Migration Plan

No migrations planned. Any diagnostic implying missing table/column/RPC is a contract/schema gap until proven by migrations/generated types.

## 11 Automated Verification Gates Plan

1. Canonical full typecheck: `npm run typecheck:full`
2. Changed typecheck: `npm run typecheck:changed`
3. Relevant scoped typechecks for touched configs.
4. `npm run healthcare:verify` if Healthcare code changes.
5. `npm run logistics:verify` if Logistics code changes.
6. Relevant unit/integration tests for touched areas.
7. `git diff --check`.
8. Diff inspection.
9. No new `as any`.
10. No new `@ts-ignore` / `@ts-expect-error`.
11. No abnormal tsconfig/source exclusions.

---

# ARCHITECTURE GATE RESULT - BEAUTY SPA CRM CUSTOMER PAGE UI REDESIGN

> **Status:** PASS - Pure UI redesign for Beauty Spa CRM Customer Page (`/dashboard/customers`) matching the provided reference layout without changing any business logic, database schema, or kernel contracts
> **Date:** 2026-10-05
> **Scope:** `src/app/dashboard/customers/page.tsx` and customer list card components. No database schema, RPC, RLS, server action, business logic, accounting, Healthcare H1-H12, or Logistics E7.1-E7.3 changes.

---

## 1. Bella OS/Product Development Process Gate

The requested change is a visual redesign of the CRM Customer Page (`src/app/dashboard/customers/page.tsx`) for `beauty_spa` and default tenants to match the provided reference design. Gate decision: `PASS` for a dedicated frontend UI redesign that preserves all existing data services (`getCustomers`, `createCustomer`, `updateCustomer`, `deleteCustomer`), pagination, search, status filtering, and business invariants without changing any underlying business logic.

## 2. Product Manifest

In scope:
- Redesigning `src/app/dashboard/customers/page.tsx` layout and customer cards matching reference image.
- 4 Top Summary Metric Cards:
  1. "Tổng khách hàng": total customer count with trend badge & subtitle.
  2. "Đang sử dụng dịch vụ": customers with active care packages count, trend badge & subtitle.
  3. "Khách mới tháng này": new customer count this month, trend badge & subtitle.
  4. "Cần chăm sóc": care attention needed count, trend badge & subtitle.
- Filter & Control Bar:
  - Search input ("Tìm khách hàng, SĐT, liệu trình...")
  - Status filter ("Tất cả trạng thái", "Đang có gói liệu trình", "Đang chăm sóc", "Đã đặt cọc", "Tiềm năng", "Đã kết thúc")
  - Subgroup filter ("Tất cả phân nhóm")
  - Service Package filter ("Tất cả gói dịch vụ")
  - Year filter ("2026")
  - Date filter button & More filters button
  - View switcher ("Danh sách thẻ" card view vs "Bảng dữ liệu" data table view)
  - Sort dropdown ("Sắp xếp: Mới nhất") & Pagination counter/controls ("1-20 của 1.248")
- Customer Card Item Component Layout:
  - Left Section: Avatar with online status dot, customer name, status badge ("ĐANG CÓ LIỆU TRÌNH", "MỚI"), group/VIP badge ("VIP", "Khách thân thiết"), phone, group, gender badge ("Nữ" pink / "Nam" blue), location, loyalty points, total spend, and last visit date.
  - Middle Section: Current active service package card with thumbnail, package name, demo badge, completed/total sessions ("8 / 10 buổi"), progress bar, and percentage.
  - Right Section: Next appointment box with calendar icon, next appointment date & time ("28/07/2026 10:00 - 11:00"), quick calendar button, primary CTA button ("Chi tiết >"), and dropdown menu (`...`).
- Color Theme Compliance: All primary buttons, badges, links, focus rings, and active states strictly use theme preset CSS tokens (`bg-primary`, `text-primary`, `border-primary`, `hover:bg-primary-hover`, `text-primary-foreground`, `var(--primary)`).

Out of scope:
- Backend database schema or RPC changes.
- Server action logic or state transition modifications.
- Frozen Healthcare H1-H12 or Logistics E7.1-E7.3 kernels.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `src/app/dashboard/customers/page.tsx` | Beauty Spa / CRM Product UI | Render redesigned CRM Customer Page UI |
| `getCustomers` / `createCustomer` / `updateCustomer` | Customer Services | Provides data and actions to UI without logic mutation |

## 4. Contract Dependency Map

```text
Beauty Spa CRM Customer Page UI
  -> getCustomers({ limit, offset })
  -> selectCustomerDisplayBooking()
  -> calculateBookingPaymentState()
  -> getCustomerGenderPresentation()
  -> getCustomerSecondarySummary()
  -> Core/CRM Backend Services (Unchanged)
```

## 5. Change Authority

Authorized:
- Redesign UI elements in `src/app/dashboard/customers/page.tsx`.
- Update customer card item component styling and layout.
- Bind all UI elements to existing state and backend actions.

Not authorized:
- Modify business rules, server action logic, or database schemas.
- Touch frozen Healthcare H1-H12 or Logistics E7.1-E7.3 kernels.
- Introduce `any` types.

## 6. UI -> Contract Reconciliation

All UI controls (search input, status filter, subgroup filter, package filter, view switch, pagination buttons, add customer modal, detail button, Zalo button, edit/delete menu) map directly to existing state variables and server actions (`loadCustomers`, `handleAddNew`, `handleEdit`, `handleDelete`, `handleZalo`).

## 7. Additive Migration Plan

No migration required. Pure UI redesign.

## 8. 11 Automated Verification Gates Plan

1. Confirm no frozen kernel files modified.
2. Build redesigned CRM Customer Page view matching reference layout.
3. Integrate with existing customer data state and server actions.
4. Ensure zero business logic or schema mutations.
5. Verify theme preset color compliance (`bg-primary`, `text-primary`, etc.).
6. Verify responsive layout and interactive elements.
7. Run TypeScript type check.
8. Run ESLint check.
9. Run test suites.
10. Check git diff for cleanliness.
11. Output success summary and report `PASS`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PLATFORM PWA CONTRACT V1

> **Status:** PASS - Platform-owned PWA V1 contract for manifest identity and installability only
> **Date:** 2026-10-03
> **Scope:** Platform PWA identity, generated manifest, Product Registry default route integration, tenant brand display overlay, PWA install copy, and focused automated tests. No Beauty V2-specific PWA, offline strategy, runtime cache, Workbox/Serwist, database migration, or product business logic changes.

---

## 1. Bella OS/Product Development Process Gate

The requested change standardizes PWA as a Bella Platform capability consumed by products. Gate decision: `PASS` for a narrow Platform App Shell contract that generates a manifest from canonical Product Registry identity and tenant display branding while keeping offline/cache behavior explicitly out of V1.

## 2. Product Manifest

In scope:
- Platform PWA identity contract.
- Generated manifest route.
- Product Registry linkage for `productKey`, `displayName`, `subtitle`, and `defaultRoute`.
- Tenant brand overlay for display fields only.
- Root app manifest linkage.
- `PwaRegister` install copy without Bella Spa hard-code.
- Focused tests for manifest contract, start URL, scope, tenant overlay, PwaRegister source, SW boundary, and Beauty V2 shared consumption.

Out of scope:
- Product-specific PWA manifests.
- Beauty V2-specific PWA implementation.
- Runtime caching, precache, offline fallback, offline queue, Workbox, or Serwist.
- Database schema, auth, tenant provisioning, or product business logic changes.
- Healthcare H1-H12, Education OS, or Logistics E7.1/E7.2/E7.3 kernel changes.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| Product Registry | Platform product identity | Canonical `productKey`, display identity, subtitle, and `defaultRoute` |
| Tenant brand theme | Tenant configuration | Display overlay only: brand name, logo, and primary color |
| Platform PWA contract | Platform App Shell | Manifest fields, installability identity, fixed scope/display/security boundary |
| Service worker | Platform App Shell | Registration-only V1; no cache/offline capability |

## 4. Contract Dependency Map

```text
Authenticated tenant
  -> tenants.product_key
  -> ProductRegistry.get(productKey)
  -> ProductDefinition.defaultRoute
  -> PlatformPwaIdentity.startUrl
  -> generated manifest
  -> PwaRegister install copy
```

Tenant display brand may influence only display fields:

```text
tenant.brand_theme.brandName / logoUrl / primaryColor
  -> manifest name/short_name/theme_color
```

Tenant brand must not control:

```text
start_url
scope
display
service worker scope
manifest architecture
```

## 5. Change Authority

Authorized:
- Add Platform PWA resolver/contract if needed.
- Add generated manifest route matching current Next.js architecture.
- Update root manifest metadata to use generated manifest.
- Update `PwaRegister` install UI/copy to consume manifest identity.
- Add focused tests and source guards.

Not authorized:
- Add new PWA framework or offline engine.
- Modify product vertical business logic.
- Create Beauty V2-specific manifest or service worker.
- Allow tenant-provided start URLs or service worker scope.
- Change database schema or runtime tenant data.

## 6. UI -> Contract Reconciliation

The install banner is a Platform UI surface. Current implementation hard-codes Bella Spa copy and claims offline behavior while the service worker explicitly disables caching. V1 must map install display text to the generated Platform PWA identity and remove unsupported offline claims.

## 7. Additive Migration Plan

No migration.

## 8. 11 Automated Verification Gates Plan

1. Confirm Product Registry remains the canonical source for `defaultRoute`.
2. Confirm tenant brand overlay only affects display/branding fields.
3. Add generated manifest with required PWA fields.
4. Keep `scope = "/"` and `display = "standalone"`.
5. Confirm missing product falls back to `/dashboard`.
6. Confirm Beauty V2 uses shared `bella_spa` Product Registry default route rather than a product-specific PWA.
7. Confirm `PwaRegister` has no Bella Spa hard-code.
8. Confirm service worker remains no-cache/no-offline V1.
9. Run focused PWA tests.
10. Run targeted lint/typecheck where practical.
11. Run `git diff --check` and stop at V1.

## 9. Verification Evidence

Implemented V1:
- Added `src/platform/pwa/platform-pwa-contract.ts` as the Platform-owned resolver for `PlatformPwaIdentity`.
- Added generated `/manifest.webmanifest` route that resolves current tenant `product_key` through Product Registry and applies tenant brand overlay only to display fields.
- Updated root layout manifest metadata to `/manifest.webmanifest`.
- Kept `public/manifest.json` as neutral static fallback with `start_url = /dashboard`, `scope = /`, and `display = standalone`.
- Updated `PwaRegister` to fetch manifest identity for install UI/copy and removed Bella Spa/offline install copy.
- Simplified `public/sw.js` to registration/installability only: no precache, no runtime cache, no offline fallback.

Automated/local:
- `npx jest src/platform/pwa/platform-pwa-contract.test.ts --runInBand` -> PASS, 1 suite / 8 tests.
- `npx eslint src/platform/pwa/platform-pwa-contract.ts src/platform/pwa/platform-pwa-contract.test.ts src/app/manifest.webmanifest/route.ts src/app/layout.tsx src/components/common/PwaRegister.tsx` -> PASS.
- `rg "Bella Spa ERP|làm việc offline|Workbox|Serwist|cache\.addAll|caches\.open|respondWith"` over runtime PWA files -> runtime matches none; only test assertions contain the blocked strings.
- `git diff --check` -> PASS.

Not verified:
- `npm run typecheck:changed` invoked repository-wide strict `tsc`; stopped after 90 seconds without diagnostics. `TYPECHECK = NOT_VERIFIED`.

Gate result: `PLATFORM_PWA_CONTRACT = IMPLEMENTED_V1`.

---

# ARCHITECTURE GATE RESULT - HQ IDENTITY SEPARATION

> **Status:** PASS - HQ Identity Separation sealed; `TYPECHECK_NOT_VERIFIED`
> **Date:** 2026-10-03
> **Scope:** `/hq` identity and authorization only. Replace the experimental `tenant_type` slice with canonical `tenant.product_key = 'bella_hq'`, add direct HQ login, provision a separate HQ admin, and keep BabyCare data unchanged.

---

## 1. Bella OS/Product Development Process Gate

The requested change separates HQ portal identity from the BabyCare operating tenant. Gate decision: `PASS` for a narrow HQ auth/login change that reuses the existing Product Identity contract.

## 2. Product Manifest

In scope:
- HQ portal authorization.
- HQ direct login route.
- HQ tenant recognition by `product_key = 'bella_hq'`.
- HQ UI filters that exclude the HQ tenant from operating-tenant workflows.
- Inventory transfer central warehouse HQ tenant lookup.
- Runtime DB/Auth provisioning for HQ tenant/admin on the authorized target.
- Runtime smoke for HQ allow and BabyCare deny.

Out of scope:
- KPI/mock metric cleanup.
- Dashboard redesign.
- Healthcare H1-H12, Logistics E7.1/E7.2/E7.3, or product vertical kernel changes.
- Schema migration execution or changing the existing BabyCare tenant.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `tenants.product_key` | Platform product identity | Canonical tenant product identity |
| `checkHqAuth` | Platform/HQ auth boundary | Server-side HQ portal authorization |
| `/hq/login` | HQ portal auth entry | Direct HQ admin login |
| `/hq` components | HQ portal UI | Consume canonical identity for filters and labels |

## 4. Contract Dependency Map

```text
HQ Portal
  -> users.role
  -> users.tenant_id
  -> tenants.product_key = 'bella_hq'
  -> operating tenants where product_key != 'bella_hq'
```

## 5. Change Authority

Authorized:
- Replace experimental `tenant_type` consumers with `product_key = 'bella_hq'`.
- HQ server-action authorization update.
- Direct `/hq/login` route.
- HQ UI identity filters.
- Focused tests.
- Authorized runtime provisioning of `bella_hq` HQ tenant and HQ admin Auth user.
- Runtime smoke for `/hq/login`, `/hq`, `/hq/financial-overview`, and BabyCare admin denial.

Not authorized:
- New hardcoded HQ UUID.
- BabyCare-specific HQ identity.
- New `tenant_type` schema.
- Schema migration execution.
- BabyCare tenant mutation.
- KPI/mock data cleanup.
- Product vertical or kernel refactor.

## 6. UI -> Contract Reconciliation

Existing UI/action code treats `tenant.name === 'Bella Spa Headquarter'` as HQ identity. Tenant name is mutable display data and the current production record is also `product_key = 'bella_babycare'`. Canonical target for the separated HQ tenant is `product_key = 'bella_hq'`.

## 7. DB Provisioning Result

No migration in this code slice.

Completed with explicit runtime provisioning authority:
- Created HQ tenant `d33dd246-9d9c-4a95-bfff-03b4b51d4072` with `product_key = 'bella_hq'`.
- Created separate HQ Auth/public user `hq-admin@bellaspa.vn` with `role = 'admin'`.
- Bound HQ admin to tenant `d33dd246-9d9c-4a95-bfff-03b4b51d4072`.
- Left BabyCare tenant `0e66365b-42b0-420e-acca-f7d7692e125e` unchanged with `product_key = 'bella_babycare'`.
- Generated runtime smoke password was random, temporary, and not printed or stored in repo/docs/logs/commit.

## 8. 11 Automated Verification Gates Plan

1. Confirm no Healthcare/Logistics frozen kernel files changed.
2. Confirm no `tenant_type` code or migration remains in the HQ slice.
3. Confirm `checkHqAuth()` uses `product_key = 'bella_hq'`.
4. Confirm `/hq` pages redirect unauthorized users to `/hq/login`.
5. Confirm `/hq/login` verifies HQ auth after Supabase sign-in.
6. Confirm BabyCare admin with `product_key = 'bella_babycare'` is denied.
7. Confirm inventory HQ warehouse lookup uses `product_key = 'bella_hq'`.
8. Confirm `/hq` operating-tenant filters use canonical helper.
9. Run focused HQ auth/action tests.
10. Run `git diff --check`.
11. Provision HQ tenant/admin only after explicit authority, then run runtime smoke and stop.

## 9. Verification Evidence

Read-only/preflight:
- `.env.local` REST target read-back found `product_key = 'bella_hq'` count `0`.
- Existing BabyCare/HQ-shared tenant remains `product_key = 'bella_babycare'`; no DB mutation was executed.
- `supabase/migrations/20261003010000_add_hq_tenant_identity.sql` removed from the working tree; no replacement migration added.

Runtime provisioning:
- Target project ref: `lvnvkpyxtuilhrabtlwv`.
- HQ tenant created/read back: `d33dd246-9d9c-4a95-bfff-03b4b51d4072`, `name = Bella Spa Headquarter`, `status = active`, `product_key = bella_hq`.
- HQ admin created/read back: `hq-admin@bellaspa.vn`, `role = admin`, `tenant_id = d33dd246-9d9c-4a95-bfff-03b4b51d4072`.
- BabyCare admin read-back: `admin@bellaspa.vn`, `role = admin`, `tenant_id = 0e66365b-42b0-420e-acca-f7d7692e125e`, `product_key = bella_babycare`.
- Password was not printed or persisted.

Automated/local:
- `npx jest src/__tests__/hq-actions.test.ts src/__tests__/onboarding.test.ts --runInBand` -> PASS, 2 suites / 15 tests.
- `npx jest src/__tests__/inventory-transfer.test.ts --runInBand` -> PASS, 1 suite / 29 tests.
- `git diff --check` -> PASS.
- Focused `npx eslint` on HQ login/auth/action files -> PASS.
- `rg tenant_type` over HQ/auth/onboarding/domain slice -> no matches.

Runtime smoke:
- `hq-admin@bellaspa.vn` -> `/hq/login` -> `/hq` -> PASS.
- `hq-admin@bellaspa.vn` -> `/hq/financial-overview` -> PASS.
- `admin@bellaspa.vn` with BabyCare tenant context -> `/hq` -> `/hq/login` redirect -> DENIED/PASS.

Not verified:
- `npm run typecheck:changed` invoked repository-wide strict `tsc`; stopped after 90 seconds without diagnostics. `TYPECHECK = NOT_VERIFIED`.

Gate result: `HQ_IDENTITY_SEPARATION = SEALED`.
Residual: `TYPECHECK_NOT_VERIFIED`; rotate/change the temporary HQ admin password before operational handoff.

---

# ARCHITECTURE GATE RESULT - BEAUTY F5 REAL DB IDEMPOTENCY FIXTURE DRIFT

> **Status:** PASS - fixture-only repair for Beauty/F5 Real DB idempotency proof
> **Date:** 2026-10-03
> **Scope:** `src/products/beauty-spa-v2/__tests__/beauty-spa-v2-real-db.test.ts` F5 AR reconciliation windows plus affected-test selector alignment for this Real DB file. No F5 RPC, Finance schema, Beauty business logic, tenant data, production DB, Healthcare H1-H12, or Logistics E7.1-E7.3 changes.

---

## 1. Bella OS/Product Development Process Gate

CI Real Database Business E2E failed because the Beauty/F5 idempotency proof called `f5_run_reconciliation` with an as-of timestamp before the AR ledger facts created by the fixture. The F5 AR read contract uses `finance_receivable_ledger.created_at <= p_reconciliation_as_of`, so the pass run could produce no persisted `f5_control_results` row for idempotent read-back and the mismatch leg could reconstruct AR from an incomplete F3 window. Gate decision: `PASS` for a fixture-only correction that derives the F5 as-of timestamp from the created AR ledger fact.

## 2. Product Manifest

In scope:
- Beauty/F5 Real DB test fixture windows for the matched and mismatch AR control runs.
- Preserve the same `passParams` object for duplicate idempotency proof.
- Keep `src/products/beauty-spa-v2/__tests__/beauty-spa-v2-real-db.test.ts` in the Real DB E2E lane, not the default unit Jest lane.

Out of scope:
- F5 RPC or schema changes.
- Finance F1/F3 posting semantics.
- Beauty session completion business logic.
- PR #200 HQ Identity Separation branch.
- Production or E2E database mutation outside the test run.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `finance_receivable_ledger.created_at` | Finance F3 AR canonical read basis | Timestamp used by F5 AR read contract |
| `finance_ar_facts_as_of` | Finance/F5 read contract | Filters AR facts by `created_at <= as_of` |
| Beauty/F5 Real DB test | Product integration proof | Must create a valid fixture inside the reconciliation window |
| `scripts/test-changed-files.mjs` | CI affected-test routing | Keeps Real DB files out of default Jest lane |

## 4. Contract Dependency Map

```text
Beauty completed service
  -> SemanticReceivableChargeService
  -> finance_receivable_ledger.created_at
  -> finance_ar_facts_as_of(as_of)
  -> f5_run_reconciliation
  -> f5_control_results idempotent read-back
```

## 5. Change Authority

Authorized:
- Adjust only the test fixture's F5 AR reconciliation timestamps.
- Add read-back of AR ledger timestamps inside the test if needed for deterministic fixture setup.
- Align affected-test direct exclusion with the existing Real DB scope router for the Beauty Real DB file.

Not authorized:
- Change F5 RPC behavior.
- Add migrations, constraints, or schema.
- Change Finance posting/ledger semantics.
- Change Beauty business logic or HQ PR #200.

## 6. UI -> Contract Reconciliation

No UI change.

## 7. Additive Migration Plan

No migration.

## 8. 11 Automated Verification Gates Plan

1. Confirm duplicate pass calls use the same params.
2. Confirm F5 AR read contract uses `finance_receivable_ledger.created_at <= as_of`.
3. Confirm Finance AR ledger facts are created before the test's F5 as-of timestamps.
4. Modify only the fixture timestamp/read-back.
5. Run Beauty/F5 targeted Real DB test.
6. Run Real DB E2E if credentials/environment are available.
7. Verify `passRun.run_id === duplicatePassRun.run_id`.
8. Run `git diff --check`.
9. Run affected tests where practical.
10. Keep PR #200 unchanged.
11. Stop after evidence; do not refactor F5 or Beauty logic.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - BEAUTY SPA V2 TENANT DASHBOARD UI REDESIGN

> **Status:** PASS - Pure UI redesign for Beauty Spa V2 tenant dashboard matching reference design without changing any business logic or kernel contracts
> **Date:** 2026-10-03
> **Scope:** `src/app/dashboard/` Beauty Spa V2 view and sidebar tenant presentation. No database schema, RPC, RLS, business logic, accounting, Healthcare H1-H12, or Logistics E7.1-E7.3 changes.

---

## 1. Bella OS/Product Development Process Gate

The requested change is a complete visual redesign of the Beauty Spa V2 tenant dashboard (`beauty_spa`) to match the provided reference design (Bella BEAUTY SPA ERP dashboard layout). Gate decision: `PASS` for a dedicated frontend UI view that preserves all existing data services, real-time subscriptions, business invariants, and action contracts without altering any underlying business logic.

## 2. Product Manifest

In scope:
- `src/app/dashboard/components/BeautySpaV2DashboardView.tsx` matching the reference UI layout.
- Wiring `beauty_spa` tenant dashboard in `src/app/dashboard/page.tsx` to render the V2 UI view.
- Sidebar aesthetic alignment for `beauty_spa` tenant identity (Emerald theme `#062C24`, lotus logo, Playfair Display typography, exact navigation items).
- All 6 dashboard zones from reference image:
  1. Top Header & 5 Metric Summary Cards (Tổng Khách Hàng, Lịch Hẹn Hôm Nay, Doanh Thu Tháng 10, Đánh Giá Khách Hàng, Tỷ Lệ Khách Quay Lại)
  2. Column 1: Lịch Hẹn Hôm Nay (28) list with filter tabs (Tất cả, Đang phục vụ, Đang chờ, Hoàn thành)
  3. Column 2: Bella AI Copilot (BETA) insights card with purple gradient theme
  4. Column 3: Tài Chính Tháng 10 bar chart & financial summary breakdown
  5. Row 2: Hiệu Suất Kinh Doanh line chart, Top Kỹ Thuật Viên ranking table, Đánh Giá Khách Hàng rating breakdown
  6. Row 3: Cần Xử Lý Ngay (8) urgent cards list & Vật Tư & Tồn Kho summary grid

Out of scope:
- Backend database schema or RPC changes.
- Business logic or payment/session state transition modifications.
- Frozen Healthcare H1-H12 or Logistics E7.1-E7.3 kernels.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `BeautySpaV2DashboardView.tsx` | Beauty Spa Product UI | Render reference dashboard UI for `beauty_spa` tenant |
| `src/app/dashboard/page.tsx` | Dashboard Router | Routes `beauty_spa` tenant to `BeautySpaV2DashboardView` |
| `getDashboardPrimaryData` / `getDashboardSecondaryData` | Analytics / Core Services | Provides data facts to UI without logic mutation |

## 4. Contract Dependency Map

```text
Beauty Spa V2 Dashboard UI
  -> getDashboardPrimaryData()
  -> getDashboardSecondaryData()
  -> getImportantAlerts()
  -> Core/Spa Backend Data Services (Unchanged)
```

## 5. Change Authority

Authorized:
- Create `src/app/dashboard/components/BeautySpaV2DashboardView.tsx`.
- Update `src/app/dashboard/page.tsx` to render `BeautySpaV2DashboardView` when `tenantModuleKey === 'beauty_spa'` or `product.productKey === 'bella_spa'`.
- Update sidebar visual presets for Beauty Spa V2 tenant.

Not authorized:
- Modify business rules or server action handlers.
- Touch frozen Healthcare H1-H12 or Logistics E7.1-E7.3 kernels.
- Introduce `any` types.

## 6. UI -> Contract Reconciliation

All UI controls (date picker, branch selector, search input, notification bell, "+ TẠO BOOKING", appointment tabs, KTV table, AI copilot actions, urgent alert items) connect to existing contracts and state props.

## 7. Additive Migration Plan

No migration required. Pure UI enhancement.

## 8. 11 Automated Verification Gates Plan

1. Verify `beauty_spa` tenant identification.
2. Confirm no kernel files modified.
3. Build pixel-perfect Beauty Spa V2 dashboard view matching reference image.
4. Integrate with `src/app/dashboard/page.tsx`.
5. Ensure zero business logic mutations.
6. Verify responsive layout and interactive elements.
7. Run TypeScript type check.
8. Run ESLint check.
9. Run test suites.
10. Check git diff for cleanliness.
11. Output success summary and report `PASS`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - HAIRCUT PAYMENT TO F3 AR ALLOCATION HARDENING

> **Status:** PASS - narrow Core consumer hardening for Finance OS canonical payment-to-AR allocation
> **Date:** 2026-09-29
> **Scope:** `recordRemainingPayment` Finance AR allocation call only. Use persisted confirmed `revenue` fact for idempotent retries before calling the Finance OS allocation contract. No Finance schema/RPC migration, direct `finance_*` writes, Debt/Reconciliation, BabyCare, Healthcare, Education, Logistics, or Haircut audit reopen.

---

## 1. Bella OS/Product Development Process Gate

PR #168 merged the Finance OS canonical contract:

```text
confirmed payment
  -> F1 cash receipt
  -> F2 cash movement
  -> F3 receivable allocation
```

The remaining Haircut integration gap is the Core consumer boundary. On idempotent retry, the consumer may receive an existing persisted `revenue` row while the retry request payload has drifted. Gate decision: `PASS` for a minimum consumer fix that treats persisted `revenue` as the financial fact for allocation amount/status/payment metadata and leaves Finance OS ownership intact.

## 2. Product Manifest

In scope:
- `src/core/services/order/payment-actions.ts` allocation input selection.
- Existing idempotency lookup result from `revenue`.
- Focused unit regression for retry amount drift and pending payment skip.

Out of scope:
- Finance F1/F2/F3 invariant changes.
- Finance schema, RPC, RLS, or migration work.
- Product-owned AR allocation logic.
- Debt/Reconciliation.
- BabyCare, Healthcare, Education, or Logistics changes.
- Re-auditing completed Haircut areas.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `revenue` persisted payment row | Core/Product payment persistence | Authoritative payment fact supplied to Finance |
| Finance payment-to-AR allocation contract | Finance OS | Canonical F1/F2/F3 allocation orchestration |
| `recordRemainingPayment` | Core consumer | Bridges confirmed persisted payment fact to Finance OS contract |

## 4. Contract Dependency Map

```text
Haircut/Core confirmed persisted revenue
  -> recordRemainingPayment consumer
  -> allocateConfirmedBookingPaymentToFinanceAr
  -> Finance OS F1 cash receipt
  -> F2 cash movement
  -> F3 AR allocation
```

## 5. Change Authority

Authorized:
- Harden Core consumer input selection for Finance allocation.
- Use persisted `revenue.amount`, `revenue.status`, `revenue.payment_method`, `revenue.received_date`, and `revenue.notes` when present.
- Add focused tests proving retry payload drift does not change Finance allocation amount.

Not authorized:
- Change Finance OS invariants.
- Add or modify migrations/RPCs.
- Write directly to `finance_*` from Product/Core.
- Implement Debt/Reconciliation.
- Touch BabyCare or reopen Haircut audit.

## 6. UI -> Contract Reconciliation

No UI change.

## 7. Additive Migration Plan

No migration.

## 8. 11 Automated Verification Gates Plan

1. Confirm branch base is merged `origin/main` after PR #168.
2. Read Bella constitution and F3 AR constitution.
3. Confirm Finance OS allocation contract remains the authority.
4. Confirm current Core consumer calls Finance allocation after persisted payment/idempotency lookup.
5. Fix consumer to prefer persisted `revenue` financial fact on retries.
6. Add idempotent retry regression where request amount differs from persisted amount.
7. Add pending-payment skip regression.
8. Run focused Core payment action test.
9. Run Finance semantic allocation test.
10. Run `git diff --check`.
11. Stop at first real failure; do not wait on unrelated gates after a failure.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PR168 AFFECTED JEST REAL-DB ROUTING FIX

> **Status:** PASS - CI affected-test routing only, keep Finance real-DB verification suites out of the mock/unit integration lane
> **Date:** 2026-09-29
> **Scope:** `scripts/test-changed-files.mjs` related-test ignore list only. No Finance OS runtime, Product runtime, schema, RLS, Healthcare, Education, or Logistics change.

---

## 1. Bella OS/Product Development Process Gate

PR #168 became mergeable after the conflict resolution, but CI `Affected Unit and Integration Tests` selected Finance real-DB verification suites through Jest `--findRelatedTests` and failed with `TypeError: fetch failed`. The failing suites require real database credentials/environment and belong in the dedicated real-DB/Finance verification contract, not the mock affected unit/integration lane. Gate decision: `PASS` for a CI-only selector correction.

## 2. Product Manifest

In scope:
- Affected Jest routing in `scripts/test-changed-files.mjs`.
- Exclude Finance F1/F2 real-DB verification suites from the mock affected unit/integration lane.

Out of scope:
- Finance OS runtime behavior.
- Finance contract semantics.
- Product/Core payment behavior.
- Database schema, RLS, migrations, or data.
- Healthcare, Education, or Logistics kernel work.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `scripts/test-changed-files.mjs` | CI governance | Selects mock/unit integration tests related to changed files |
| `finance-f1-ledger-verification.test.ts` | Finance OS real-DB verification | Validates F1 ledger behavior against database-backed environment |
| `finance-f2-projection-worker.test.ts` | Finance OS real-DB verification | Validates F2 projection behavior against database-backed environment |

## 4. Contract Dependency Map

```text
PR changed Finance/Core source files
  -> affected Jest selector
  -> mock unit/integration lane
  -> exclude real-DB Finance verification suites
  -> dedicated real-DB/Finance verification remains responsible
```

## 5. Change Authority

Authorized:
- Add exact Finance real-DB verification test paths to the affected-test ignore list.

Not authorized:
- Change Finance runtime or tests to hide `fetch failed`.
- Disable the affected-test job.
- Remove dedicated real-DB verification coverage.
- Modify Product/Core payment logic.

## 6. UI -> Contract Reconciliation

No UI change.

## 7. Additive Migration Plan

No migration.

## 8. 11 Automated Verification Gates Plan

1. Confirm PR #168 conflict is resolved and mergeable.
2. Read failed CI log for `Affected Unit and Integration Tests`.
3. Identify failing suites as Finance F1/F2 database-backed verification suites.
4. Apply exact affected-test ignore patterns.
5. Run `node --check scripts/test-changed-files.mjs`.
6. Run affected selector locally for PR #168 changed files.
7. Run focused payment/Finance unit suites.
8. Run `git diff --check`.
9. Push CI-only selector fix.
10. Cancel stale/known-failed runs after failure to avoid wasting CI time.
11. Re-run PR CI and stop at first real failure.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - FINANCE OS CONFIRMED PAYMENT TO AR CONTRACT

> **Status:** PASS - minimal Finance OS canonical payment-to-AR allocation contract
> **Date:** 2026-09-29
> **Scope:** Confirmed payment -> F1 cash receipt -> F2 cash movement -> F3 receivable resolution/allocation. Haircut may only consume this contract after it is proven. No Haircut AR workaround, Payment Engine redesign, COA, Payroll, Debt/Reconciliation, BabyCare, Healthcare, Education, or Logistics change.

---

## 1. Bella OS/Product Development Process Gate

Source evidence proves the final Haircut Financial Truth gap is not Haircut core:

```text
Finance OS already has:
F1 postTransaction()
F2 CashProjectionWorker -> finance_cash_movements
F3 recognizeServiceReceivable()
F3 allocatePaymentToReceivable(invoiceId, cashMovementId)

Missing canonical path:
Confirmed Payment
  -> F1 Cash Receipt
  -> F2 Cash Movement
  -> Receivable Resolution
  -> Idempotent F3 Allocation
```

Gate decision: `PASS` for the smallest Finance OS semantic contract that accepts a confirmed payment, preserves tenant/idempotency, posts the cash receipt through F1, projects cash through the existing F2 worker/outbox path, resolves open receivables by canonical invoice metadata, and allocates without duplicate F3 allocation on retry.

## 2. Product Manifest

In scope:
- Finance OS payment-to-receivable semantic contract.
- Existing Finance OS primitives only: F1 ledger, F2 cash projection, F3 invoice/receivable/allocation.
- Minimal Haircut consumer wiring only after the Finance OS contract is tested.

Out of scope:
- Haircut-owned AR/cash movement implementation.
- Payment engine redesign.
- COA/accounting posting repair.
- Payroll/commission.
- Debt/Reconciliation implementation.
- BabyCare, Preschool, Healthcare, Education, Logistics.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| Confirmed payment semantic contract | Finance OS | Canonical bridge from external payment fact to financial truth |
| F1 cash receipt | Finance OS Ledger | Double-entry cash/AR receipt |
| F2 cash movement | Finance OS Cash/Treasury | Projected liquidity movement from F1 event |
| F3 invoice/receivable/allocation | Finance OS AR | Receivable truth and settlement |
| Haircut payment action | Product/Core consumer | Supplies tenant/payment/source facts only |

## 4. Contract Dependency Map

```text
Haircut confirmed payment
  -> Finance OS confirmed payment receivable allocation contract
  -> F1 Ledger postTransaction
  -> F1 outbox finance.transaction.posted.v2
  -> F2 CashProjectionWorker
  -> finance_cash_movements
  -> F3 invoice/receivable resolver
  -> finance_allocate_payment
```

## 5. Change Authority

Authorized:
- `src/platform/finance/contracts/receivable-charge.contract.ts`
- `src/platform/finance/services/semantic-receivable-charge.service.ts`
- `src/platform/finance/gateways/supabase-receivable-charge.gateway.ts`
- Focused Finance OS tests.
- Minimal Haircut/Core consumer call through `ACR-2026-007` metadata for PR #168 if `src/core` files must change.

Not authorized:
- New AR schema.
- Direct product writes to `finance_cash_movements`.
- Direct Haircut allocation workaround.
- COA changes.
- Payroll changes.
- Debt/Reconciliation feature work.
- Payment engine redesign.

## 6. UI -> Contract Reconciliation

No UI change. This is backend financial truth plumbing only.

## 7. Additive Migration Plan

No migration planned. Existing Finance OS primitives are sufficient unless implementation evidence proves a concrete contract gap.

## 8. 11 Automated Verification Gates Plan

1. Verify source contract evidence for F1/F2/F3 existing primitives.
2. Add generic confirmed-payment input/result types.
3. Add Finance OS service method for payment-to-AR allocation.
4. Keep account semantics scoped to proven TT99 AR mapping plus canonical cash/bank payment-method mapping.
5. Resolve receivables through invoice metadata, not product-owned AR tables.
6. Preserve payment idempotency key through F1 and F3 allocation retry checks.
7. Add focused Finance OS unit tests for allocation, retry, and over-allocation block.
8. Wire Haircut payment only through the Finance OS contract if required.
9. Run focused Finance/Haircut payment tests.
10. Run scoped TypeScript or repository-available equivalent.
11. Run `git diff --check` and stop before Debt/Reconciliation re-evaluation.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - BABYCARE SPA SESSION REVIEW RLS FIX

> **Status:** PASS - keep Babycare/Beauty Spa session completion authorized by the existing server action, and write only the system-owned `session_reviews` placeholder through an operation client when service-role credentials are configured
> **Date:** 2026-09-29
> **Scope:** Babycare/Beauty Spa session completion review-placeholder side effect only; no schema migration, data migration, Product UI redesign, Healthcare/Education/Logistics kernel work, or accounting policy change

---

## 1. Bella OS/Product Development Process Gate

Observed runtime symptom: updating a Babycare/Spa session to completion fails with `new row violates row-level security policy for table "session_reviews"` while creating the `pending_review` placeholder. This is a product workflow bug in the shared Beauty/Spa completion path, not a new OS capability. Gate decision: `PASS` for a minimal server-side side-effect fix after existing tenant and action authorization have already succeeded.

## 2. Product Manifest

In scope:
- Existing Babycare/Beauty Spa session completion/update workflow.
- Existing `session_reviews` placeholder record created after a session is completed.
- Preserve tenant-scoped checks before writing the placeholder.
- Use existing Supabase admin env pattern for the placeholder write only.

Out of scope:
- Healthcare H1-H12, Logistics E7.1-E7.3, Education product contracts.
- Database schema, production data, RLS policy migration, UI redesign, salary/accounting policy redesign.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `session_logs` | Beauty/Spa booking workflow | Source session state and completion event |
| `bookings.customer_id`, `bookings.assigned_ktv_id`, `bookings.tenant_id` | Beauty/Spa booking workflow | Tenant-scoped source for placeholder review |
| `session_reviews` | Beauty/Spa customer feedback workflow | Analytics/customer-review target table |
| Server action authorization | Shared order/session service | Confirms current user tenant and role before completion side effects |

## 4. Contract Dependency Map

Admin/KTV session update -> existing server action tenant and role checks -> session completion side effects -> create pending `session_reviews` placeholder -> customer portal later updates the review.

## 5. Change Authority

Authorized:
- Change the internal server-side client used for `session_reviews` placeholder lookup/insert.
- Keep existing tenant equality checks before using the operation client.
- Preserve rollback behavior when placeholder creation still fails.

Not authorized:
- Loosen product UI permissions.
- Modify frozen Healthcare/Logistics kernel files.
- Change RLS policies or migrate data without explicit approval.
- Introduce `any` types.

## 6. UI -> Contract Reconciliation

No UI redesign. The current UI action "Cập nhật thông tin" maps to the existing `updateSessionLog` server action. The failing contract is the system side-effect that creates a review placeholder after a completed session.

## 7. Additive Migration Plan

No migration. The fix is code-only and does not create, alter, or backfill database objects.

## 8. 11 Automated Verification Gates Plan

1. Architecture scope check: no Healthcare/Logistics/Education kernel files touched.
2. Type-level check for changed order completion helper.
3. Focused regression where placeholder lookup/insert uses operation client fallback.
4. Existing completion rollback behavior remains unchanged.
5. Tenant check remains before placeholder creation.
6. No direct product access to `hc_*` tables.
7. No new `any` types.
8. No schema migration.
9. `git diff --check`.
10. Focused tests if an existing test target is available for this helper.
11. Manual runtime evidence remains required for deployed Supabase env/RLS state.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - BELLA AUTO PHASE 5 REAL DB E2E FIXTURE IDEMPOTENCY

> **Status:** PASS - test fixture idempotency fix only
> **Date:** 2026-09-29
> **Scope:** `src/__tests__/bella-auto-phase5-experience.test.ts` setup for `auto_journey_stages` only. No Bella Auto runtime behavior, schema, RPC, service contract, Haircut, Finance, Healthcare, Education, Logistics, Payment, Payroll, or COA change.

---

## 1. Bella OS/Product Development Process Gate

Evidence from PR #166 CI showed `Real Database Business E2E` failed before any Haircut assertion due to Bella Auto Phase 5 fixture setup:

```text
auto_journey_stages
tenant = Test Tenant Bella Auto Phase5 E2E
code = delivered
ERROR = duplicate key value violates unique constraint uq_auto_journey_stages_code
```

Source of truth:
- Migration `20260803230000_create_auto_journeys.sql` defines `auto_journey_stages` with unique `(tenant_id, code)`.
- The test intentionally reuses the same test tenant by name across runs.

Gate decision: `PASS` for a minimal test-only change that reuses an existing `delivered` stage for the test tenant when present, and only deletes the stage if this run created it.

## 2. Product Manifest

In scope:
- Bella Auto Phase 5 real-DB test fixture setup.
- `auto_journey_stages` lookup/insert idempotency for `code = delivered`.

Out of scope:
- Bella Auto production services.
- Journey schema or constraints.
- Haircut PR #166 implementation.
- Finance/accounting behavior.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `auto_journey_stages` | Bella Auto journey setup | Stage catalog rows scoped by tenant and code |
| `bella-auto-phase5-experience.test.ts` | Real DB E2E test fixture | Creates/reuses setup data for Phase 5 experience tests |

## 4. Contract Dependency Map

```text
Real DB test tenant
        ↓
auto_journey_stages(tenant_id, code = delivered)
        ↓
auto_customer_journeys.current_stage_id
        ↓
Bella Auto Phase 5 services under test
```

## 5. Change Authority

Authorized:
- Make the Real DB test fixture setup idempotent for the existing unique `(tenant_id, code)` stage contract.

Not authorized:
- Change Bella Auto stage semantics.
- Change `auto_journey_stages` schema/constraint.
- Change runtime services.
- Change unrelated verticals.

## 6. UI -> Contract Reconciliation

No UI change.

## 7. Additive Migration Plan

No migration. No DB mutation outside normal test fixture behavior.

## 8. 11 Automated Verification Gates Plan

1. Confirm CI failure is Bella Auto Phase 5 fixture setup.
2. Confirm canonical unique stage contract from migration.
3. Patch fixture lookup-before-insert.
4. Ensure reused stage is not deleted by cleanup.
5. Run focused Bella Auto Phase 5 real-DB test if feasible.
6. Run `git diff --check`.
7. Re-run PR CI and verify Real Database Business E2E.
8. Verify Haircut accounting files remain unchanged after this fix.
9. Verify no `src/core` diff is introduced.
10. Verify migration/build/unit checks still pass in CI.
11. Stop after CI evidence; no further Bella Auto scope expansion.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - HAIRCUT ACCOUNTING COA AND PACKAGE SALE FIX

> **Status:** PASS - exact Haircut tenant COA bootstrap plus minimal `PACKAGE_SALE` payment-method propagation
> **Date:** 2026-09-29
> **Scope:** Legacy accounting posting readiness for the 3 active `bella_haircut` tenants and the `PACKAGE_SALE` producer path only. No F3 payment allocation, Debt/Reconciliation, Payroll, BabyCare, Payment Engine redesign, or Finance OS kernel change.

---

## 1. Bella OS/Product Development Process Gate

Evidence proves two independent operational accounting gaps:

```text
A. Tenant COA/bootstrap configuration
   3 active bella_haircut tenants are missing active accounting_accounts:
   111, 112, 131, 334, 3387, 6421, 5113, 5111

B. PACKAGE_SALE producer mapping
   bank_transfer confirmed revenue emitted PACKAGE_SALE, but runtime path hard-coded 111.
   Canonical accounting template requires 111_OR_112 based on payment_method.
```

Gate decision: `PASS` for the minimum scoped implementation that seeds canonical existing COA definitions only for the 3 active Haircut tenants and propagates `paymentMethod` through `PACKAGE_SALE` to resolve `111/112`.

## 2. Product Manifest

In scope:
- `bella_haircut` tenants with current active status:
  - Haircut Shop
  - P1C-haircut-2055f3bb Tenant
  - P1D1-haircut-75b42702 Tenant
- Existing legacy accounting COA definitions from `seed_default_coa`.
- `PACKAGE_SALE` outbox payload and accounting worker producer path.
- Focused tests for `PACKAGE_SALE` payment-method account selection.

Out of scope:
- F3 Payment -> AR Allocation.
- Debt/Reconciliation.
- Payroll/Commission.
- BabyCare.
- Payment Engine redesign.
- Finance OS F1/F2/F3 kernel changes.
- Ad hoc account codes or accounting policy invention.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `accounting_accounts` rows | Tenant accounting configuration | Tenant-specific chart of accounts for legacy accounting postings |
| `seed_default_coa` definitions | Legacy accounting bootstrap | Canonical existing source for required legacy COA codes |
| `PACKAGE_SALE` outbox payload | Haircut/Beauty payment producer | Carries payment fact into legacy accounting worker |
| `RevenueRecognitionService.handlePackageSale` | Legacy accounting producer | Posts package/deposit/remaining-payment journal entry |
| `111_OR_112` template | Accounting event template | Canonical payment-method-dependent account selection |

## 4. Contract Dependency Map

```text
Haircut remaining payment / package sale revenue
        ↓
revenue.payment_method
        ↓
PACKAGE_SALE accounting outbox reference_id
        ↓
accounting worker
        ↓
payload.paymentMethod or revenue.payment_method fallback
        ↓
RevenueRecognitionService.handlePackageSale(paymentMethod)
        ↓
resolvePaymentAccountCode()
        ↓
111 or 112 + 3387 journal lines
```

COA bootstrap:

```text
Active bella_haircut tenant
        ↓
existing seed_default_coa canonical definitions
        ↓
tenant accounting_accounts
```

## 5. Change Authority

Authorized:
- Add an exact, idempotent migration scoped to the 3 verified active Haircut tenant IDs, using the existing canonical `seed_default_coa` function.
- Allow `PACKAGE_SALE` payloads to carry `paymentMethod` when known.
- Update `PACKAGE_SALE` worker handling to resolve `paymentMethod` from payload or the referenced revenue record.
- Update `handlePackageSale` to resolve `111/112` using existing `resolvePaymentAccountCode`.
- Add focused tests.

Not authorized:
- Create new accounting policy.
- Add arbitrary account definitions by hand when `seed_default_coa` exists.
- Touch Finance OS kernel primitives.
- Open F3 payment allocation, Debt/Reconciliation, Payroll, BabyCare, or Payment Engine redesign.

## 6. UI -> Contract Reconciliation

No UI redesign. No UI action contract is changed.

## 7. Additive Migration Plan

Additive/configuration-only migration:

```text
For exactly the 3 active bella_haircut tenant IDs:
  SELECT public.seed_default_coa(tenant_id)
  ensure 5113 from existing TT133 service revenue migration definition
```

The seed function is idempotent via `ON CONFLICT (tenant_id, account_code) DO NOTHING`. Account `5113` is also idempotent and uses the existing canonical definition from `20260603010000_tt133_service_revenue_5113.sql`, because the seed function predates that account.

## 8. 11 Automated Verification Gates Plan

1. Source evidence recheck for the 3 Haircut tenant IDs.
2. Migration scope inspection: exact tenant IDs only.
3. Focused unit test for `handlePackageSale` bank transfer -> account `112`.
4. Focused unit test for `handlePackageSale` cash -> account `111`.
5. Focused payload test or existing test update proving `paymentMethod` can be emitted when known.
6. Focused worker path test proving `paymentMethod` is resolved from the referenced revenue when absent from payload.
7. TypeScript scoped check if available/feasible.
8. Focused Jest for accounting/revenue recognition.
9. `git diff --check`.
10. Read-only post-migration DB verification after applying migration.
11. Focused accounting worker/runtime verification for prior `PACKAGE_SALE`/`SESSION_DONE` missing-account failures if safe and explicitly scoped.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - SPA COMPLETION ROLLBACK IS_IN_CARE FIX

> **Status:** PASS - restore pre-completion `bookings.is_in_care` during shared completion rollback
> **Date:** 2026-09-29
> **Scope:** Bella Spa shared completion rollback integrity only; no Payroll, Finance, Accounting, Haircut-specific code, schema, migration, UI redesign, or completion semantics redesign

---

## 1. Bella OS/Product Development Process Gate

The confirmed gap is rollback integrity, not a new product capability: the completion path can set `bookings.is_in_care = false` when the package reaches completion, while rollback currently restores only `completed_sessions` and `status`. Gate decision: `PASS` for the minimum rollback snapshot/payload correction that restores `is_in_care` to its pre-completion value when downstream completion side effects fail.

## 2. Product Manifest

In scope:
- Shared Beauty/Spa session completion rollback payload.
- Current booking snapshot captured before booking progress mutation.
- Focused regression proving failure-path rollback restores `completed_sessions`, `status`, and `is_in_care`.
- Focused regression preserving happy-path completion behavior where final package completion sets `is_in_care = false`.

Out of scope:
- Payroll, salary policy, Finance, Accounting policy, Haircut-specific code, UI, data migration, production data updates, or completion engine redesign.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `bookings.completed_sessions` | Beauty/Spa booking workflow | Completion progress counter |
| `bookings.status` | Beauty/Spa booking workflow | Booking lifecycle state |
| `bookings.is_in_care` | Beauty/Spa booking workflow | Active-care flag cleared on completed package |
| Completion rollback payload | Shared order/session completion service | Restores pre-completion booking workflow state after downstream failure |

## 4. Contract Dependency Map

```text
Session completion
        ↓
Count completed session logs
        ↓
Update booking progress/status/is_in_care
        ↓
Downstream completion side effects
        ↓
On failure: rollback booking fields to pre-completion snapshot
```

## 5. Change Authority

Authorized:
- Include `is_in_care` in the pre-completion booking snapshot.
- Include `is_in_care` in rollback payload with its original value.
- Add focused tests for the failure path and existing happy path.

Not authorized:
- Change the meaning of `is_in_care`.
- Change completion success semantics.
- Modify Payroll, Finance, Accounting, Haircut-specific code, schema, migrations, or UI.

## 6. UI -> Contract Reconciliation

No UI redesign. This is a service rollback integrity fix.

## 7. Additive Migration Plan

No database migration. `bookings.is_in_care` already exists in generated database types.

## 8. Verification Plan

- Reproduction test: completion reaches package completion with initial `is_in_care = true`, a downstream failure is forced, and rollback restores `completed_sessions`, `status`, and `is_in_care`.
- Happy-path test: successful package completion still sets `is_in_care = false`.
- Focused Jest for completion business rules and completion accounting side effects.
- `git diff --check`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL P7 TUITION RECOGNITION POLICY FOUNDATION

> **Status:** PASS - decouple invoice issuance from tuition service recognition and add Product-owned PERIOD_COMPLETION policy foundation
> **Date:** 2026-09-28
> **Scope:** Preschool Product P7 recognition boundary only; no Finance OS, TT99 mapping, payment, prepayment, 3387, refund, tax, e-invoice, or browser/production mutation

---

## 1. Bella OS/Product Development Process Gate

The proven blocker is a business-boundary mismatch: Preschool invoice issuance is not proof that tuition service has been performed. Gate decision: `PASS` for the smallest Product-owned correction that removes direct recognition from `InvoiceIssuanceService`, records tenant/effective-dated recognition policy vocabulary, records explicit service-period completion evidence, and emits Finance OS `TUITION_SERVICE_RECOGNIZED` only through a separate PERIOD_COMPLETION service.

## 2. Product Manifest

In scope:
- Preschool Product policy vocabulary: `PERIOD_COMPLETION`, `TIME_BASED`, `MILESTONE_EVENT`.
- Runtime execution for `PERIOD_COMPLETION` only.
- Explicit tuition service-period completion evidence.
- Tuition-only eligible amount guard.
- Reuse of sealed Finance OS semantic receivable contract after Preschool proves recognition eligibility.

Out of scope:
- Payment, prepayment, `111/112`, `3387`, refund, discount accounting, tax, VAT, e-invoice.
- Finance OS, TT99, 131/511, accounting periods, or semantic mapping changes.
- `TIME_BASED` or `MILESTONE_EVENT` execution.
- Generic policy framework or `edu_fin_*` cleanup.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `edu_fin_invoices` | Preschool Product Finance | Billing/invoice workflow state, not service-performance proof |
| `edu_fin_tuition_recognition_policies` | Preschool Product Finance | Tenant/effective-dated recognition policy vocabulary |
| `edu_fin_tuition_service_period_completions` | Preschool Product Finance | Explicit completion evidence for PERIOD_COMPLETION |
| `TUITION_SERVICE_RECOGNIZED` | Finance OS | Accounting execution after valid business semantic arrives |

## 4. Contract Dependency Map

```text
Invoice issuance
        ↓
Preschool invoice state only

Explicit service-period completion
        ↓
Tenant effective-dated recognition policy
        ↓
PERIOD_COMPLETION recognition service
        ↓
TUITION_SERVICE_RECOGNIZED
        ↓
Finance OS semantic receivable path
```

## 5. Change Authority

Authorized:
- Preschool Product Finance invoice issuance decoupling.
- Additive Preschool Product finance policy/completion tables.
- Separate Product-owned recognition service for PERIOD_COMPLETION only.
- Focused regression tests and this gate record.

Not authorized:
- Finance OS changes.
- Payment/prepayment/accounting slices.
- Generic policy framework.
- Production policy/config/completion creation.

## 6. UI -> Contract Reconciliation

No UI redesign. Existing invoice issue action remains a billing workflow action and must not claim revenue/service recognition.

## 7. Additive Migration Plan

One additive migration:

```text
supabase/migrations/20260928000000_preschool_tuition_recognition_policy_foundation.sql
```

It creates only Product-owned tuition recognition policy and service-period completion evidence tables plus tenant RLS/overlap guard.

## 8. Verification Plan

- Focused Jest proves invoice issuance emits zero Finance recognition.
- PERIOD_COMPLETION fails closed without completion evidence.
- Valid completion + effective policy emits one Finance semantic request.
- No policy, overlapping policy, unsupported policy types, cross-tenant invoice scope, and non-tuition amount all fail closed.
- Scoped ESLint, `git diff --check`, and one `typecheck:changed` attempt.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL P7 BILLING PERIOD PROVENANCE FIX

> **Status:** PASS - remove hardcoded September 2026 billing-period provenance from Preschool P7 invoice compilation
> **Date:** 2026-09-28
> **Scope:** Preschool Product P7 invoice compile API/UI only; no Finance OS, payment, accounting policy, runtime config, or production data mutation

---

## 1. Bella OS/Product Development Process Gate

The proven blocker is `BLOCKED_BY_HARDCODED_BILLING_PERIOD_PROVENANCE`: the P7 finance API manufactured a September 2026 billing period from source-code constants before invoice compilation. Gate decision: `PASS` for the smallest Product-owned consumer fix that requires a tenant-scoped `billingPeriodId` and derives invoice due date from the persisted P7 billing period.

## 2. Product Manifest

In scope:
- Preschool Product Finance API `compileDraftInvoice`.
- Preschool Finance UI billing-period selection.
- Existing `edu_fin_billing_periods` repository contract.
- Focused provenance regression tests.

Out of scope:
- Creating fee structures, billing periods, invoices, or Finance periods.
- Finance kernel, TT99, account mapping, payments, 3387, refund, tax, VAT, e-invoice.
- Generic billing configuration framework or legacy `edu_fin_*` cleanup.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `edu_fin_billing_periods` | Preschool Product Finance | Product billing-period configuration |
| `edu_fin_invoices` | Preschool Product Finance | Product invoice workflow/read model |
| Finance OS semantic receivable contract | Finance OS | Downstream accounting recognition boundary |

## 4. Contract Dependency Map

```text
Preschool operator selects configured billingPeriodId
        ↓
API resolves tenant-scoped edu_fin_billing_periods row
        ↓
TuitionBillingService.compileDraftInvoice
        ↓
Invoice dueDate comes from persisted billing period
        ↓
Later issueInvoice may recognize tuition through Finance OS
```

## 5. Change Authority

Authorized:
- Remove source-code billing-period/date hardcodes from Preschool Product API/UI.
- Require tenant-scoped billing-period lookup for invoice compilation.
- Add focused regression tests and gate record.

Not authorized:
- Finance OS changes.
- Runtime setup or production data mutation.
- New billing framework or accounting policy.

## 6. UI -> Contract Reconciliation

The staff billing UI previously collected only student and a due-date field while the API supplied the billing period. The corrected UI consumes real active billing periods from the API and sends only the selected `billingPeriodId`; source-code dates no longer create business truth.

## 7. Additive Migration Plan

No migration. This is a Product API/UI consumer correction over existing P7 tables.

## 8. Verification Plan

- Focused static provenance tests prove the route no longer contains September 2026 constants or `createBillingPeriod`.
- API guard test proves invoice compilation requires `billingPeriodId`, tenant-scoped lookup, active status, and due date from the persisted period.
- Existing tuition recognition test proves Finance connector dates come from billing-period fields rather than source-code September constants.
- Scoped ESLint and `git diff --check`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL P7 FINANCE OS TUITION RECOGNITION CONNECTION

> **Status:** PASS - connect Preschool P7 issued tuition invoice to sealed Finance OS semantic receivable path
> **Date:** 2026-09-28
> **Scope:** Preschool Product P7 -> Finance OS `TUITION_SERVICE_RECOGNIZED` only; no payment, 3387, refund, discount, tax, e-invoice, or `edu_fin_*` cleanup

---

## 1. Bella OS/Product Development Process Gate

The sealed Finance OS milestone proves `TUITION_SERVICE_RECOGNIZED -> TRADE_RECEIVABLE 131 / SERVICE_REVENUE 511 -> F1 ledger + F3 AR` with recovery and idempotency. The current Preschool blocker is a stale P7 consumer: issuing a Preschool invoice updates `edu_fin_invoices` but does not cross the Finance OS semantic boundary. Gate decision: `PASS` for the smallest Product-owned connector that sends issued tuition-only invoices to the sealed Finance OS semantic receivable contract.

## 2. Product Manifest

In scope:
- Preschool Product invoice issuance path.
- Reuse existing `SemanticReceivableChargeService` and `SupabaseReceivableChargeGateway`.
- Source identity: `PRESCHOOL_P7_TUITION_INVOICE` + `edu_fin_invoices.id`.
- Canonical student identity: `edu_fin_invoices.student_party_id`.
- Billing period dates as service period and recognition date.
- Fail-closed for non-tuition invoice lines so meal/discount/tax are not silently posted.

Out of scope:
- Payment, cash, `111/112`, customer advance, `3387`, refund, discount, tax, VAT, e-invoice.
- Deleting or refactoring `edu_fin_*`.
- New Finance kernel, Billing kernel, or generic integration framework.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `edu_fin_invoices` | Preschool Product Finance | Product invoice workflow/read model |
| `TUITION_SERVICE_RECOGNIZED` contract | Finance OS | Canonical business semantic for recognized service receivable |
| `finance_invoices` / `finance_transactions` / AR | Finance OS | Canonical financial truth |

## 4. Contract Dependency Map

```text
Preschool P7 issueInvoice
        ↓
edu_fin_invoices(student_party_id, tuition line, billing period)
        ↓
Finance OS semantic receivable contract
        ↓
TRADE_RECEIVABLE / SERVICE_REVENUE
        ↓
131 / 511
        ↓
Finance invoice + ledger + AR position
```

P7 does not supply account code, chart-of-account regime, tax treatment, or payment semantics.

## 5. Change Authority

Authorized:
- Preschool Product Finance issuance service.
- Preschool Product Finance API service construction.
- Tenant-scoped repository read for billing period.
- Focused service tests and this architecture gate artifact.

Not authorized:
- Finance kernel/accounting policy changes.
- Education Kernel changes.
- `edu_fin_*` cleanup or broad migration/RLS work.
- Payment/refund/discount/tax/e-invoice implementation.

## 6. UI -> Contract Reconciliation

No UI redesign. Existing UI `issueInvoice` action should now be truthful: success requires the Product invoice issuance service to invoke Finance OS recognition when configured by the server API.

## 7. Additive Migration Plan

No migration. This connector consumes already deployed P7 and Finance OS contracts.

## 8. Verification Plan

- Focused service tests prove tuition-only issuance calls Finance OS semantic contract.
- Recovery/idempotency: already issued P7 invoice still calls Finance OS by same business source.
- Unsupported non-tuition lines fail closed before P7 status update.
- Existing canonical student connection tests remain green.
- Scoped ESLint/diff check.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - FINANCE OS TT99 SLICE 1 ACCOUNTING ACTIVATION

> **Status:** PASS - TT99 Slice 1 accounting policy proven for tuition service recognition and target-tenant semantic mapping activation
> **Date:** 2026-09-27
> **Scope:** Finance OS `TUITION_SERVICE_RECOGNIZED` receivable contract + TT99 Slice 1 semantic mappings only; no Preschool connector, no payment, no 3387, no tax, no e-invoice

---

## 1. Bella OS/Product Development Process Gate

The proven blocker is not Preschool Finance UI logic. The Finance OS F3 AR kernel already supports draft invoice, invoice line, finalization, F1 transaction posting, AR ledger, and AR position creation, but the public usable path still requires callers to supply `revenue_account_code`. Under the Accounting Legal-Source Rule, the owner has now provided an authoritative accounting specification for Slice 1 only: `TUITION_SERVICE_RECOGNIZED`, where the education service obligation has already been performed and the amount is eligible for accounting revenue recognition under TT99-effective 2026 enterprise accounting. Gate decision: `PASS` for a Finance-owned contract that maps that semantic to `TRADE_RECEIVABLE -> 131` and `SERVICE_REVENUE -> 511` through Finance-owned, source-backed semantic GL mappings.

## 2. Product Manifest

In scope:
- Finance OS public contract for a semantic receivable charge.
- Finance-owned service/facade that creates/finalizes one AR invoice through existing F3 RPCs.
- Finance-owned implementation of only the accounting mappings specified by authoritative evidence: `TRADE_RECEIVABLE` and `SERVICE_REVENUE`.
- Forward-only activation of the minimum proven TT99 Slice 1 accounts and semantic mappings for the isolated Preschool browser-smoke tenant.
- Idempotency based on Finance-owned source identity.
- Focused tests proving account-code-free caller contract and AR RPC orchestration.

Out of scope:
- Preschool connector/payment implementation.
- P7 `edu_fin_*` runtime changes.
- TT133, TT200, or full TT99 regime engine.
- Customer advance / 3387 / payment / refund / tax / e-invoice treatment.
- New payment allocation flow.
- New Billing Kernel redesign.
- Broad Finance RLS/migration repair.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| semantic receivable charge contract | Finance OS | Vertical-neutral request to recognize a receivable charge |
| semantic GL mapping | Finance OS / authoritative accounting specification | Internal account code selection by semantic and effective date; never vertical supplied and never AI-guessed |
| `finance_invoices` / `finance_invoice_lines` | Finance F3 AR | Canonical invoice header and lines |
| `finance_transactions` / `finance_transaction_lines` | Finance F1 Ledger | Posted accounting transaction |
| `finance_receivable_ledger` / `finance_receivable_positions` | Finance F3 AR | AR subledger fact and derived position |

## 4. Contract Dependency Map

```text
Vertical/Product semantic charge
        ↓
Finance OS semantic receivable charge contract
        ↓
Finance-owned semantic GL mapping as of recognition date
        ↓
finance_create_draft_invoice
        ↓
finance_add_invoice_line
        ↓
finance_finalize_invoice
        ↓
finance_post_transaction
        ↓
finance_transactions + finance_receivable_ledger + finance_receivable_positions
```

The product/vertical caller must not provide `revenue_account_code`, account code, chart-of-account regime, or TT policy.

## 5. Change Authority

Authorized:
- Finance OS contract/service files for `TUITION_SERVICE_RECOGNIZED`.
- Finance-owned semantic GL mapping resolution for `TRADE_RECEIVABLE` and `SERVICE_REVENUE`.
- Finance-owned runtime migration for effective-dated semantic mapping resolution and target-tenant TT99 Slice 1 activation.
- Focused Finance OS tests for semantic input, account-code-free caller boundary, posting orchestration, and idempotency.
- This architecture gate artifact.

Not authorized:
- Education Kernel changes.
- Preschool Finance connector/payment path.
- Existing P7 product runtime changes.
- Regime-specific chart-of-accounts policy beyond Slice 1 proven semantics.
- Historical migration rewrite or migration-history repair.

## 6. UI -> Contract Reconciliation

No UI change in this gate. The stale consumer is any vertical that would otherwise call F3 AR RPCs directly and supply account codes. The canonical contract is now Finance OS semantic charge input.

## 7. Additive Migration Plan

One forward-only migration is required:

```text
supabase/migrations/20260927080000_finance_tt99_slice1_accounting_activation.sql
```

The migration:
- reuses `public.finance_control_account_mappings` as the Finance-owned semantic mapping storage;
- adds effective-date and authority metadata only if missing;
- replaces the semantic mapping RPCs so unsupported semantics fail closed;
- activates only target tenant account `131` and account `511`;
- saves `TRADE_RECEIVABLE -> 131` and `SERVICE_REVENUE -> 511` effective `2026-01-01`;
- does not seed a full chart of accounts, activate `5111`, post tuition, connect Preschool, or touch other tenants.

Post-deploy verification found a narrow PostgREST overload ambiguity between the repo-owned `uuid, varchar, date, varchar` RPC signature and an older `uuid, text, date, text` signature. A follow-up migration may drop only the obsolete `text` overload:

```text
supabase/migrations/20260927081000_finance_drop_legacy_semantic_gl_text_overload.sql
```

This follow-up does not alter accounts, mappings, COA data, accounting semantics, invoices, journals, or AR state.

The runtime must refuse to post if the required semantic mappings are absent or not marked as proven for `VI_TT99_2025|99/2025/TT-BTC|PROVEN`.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Finance OS files only.
- Gate 2 Contract Boundary: vertical request contains semantic charge only; no account code.
- Gate 3 Tenant Isolation: tenant id is required and passed through every F3 RPC/query.
- Gate 4 RLS & Authorization: no RLS change; existing F3 RPC privileges unchanged.
- Gate 5 Database Migration Safety: one bounded forward-only Finance migration; no historical migration rewrite.
- Gate 6 Event-After-Persistence: no new event path.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: semantic GL mapping is effective-date aware.
- Gate 9 Rule Governance: accounting regime and posting rule are source-backed for Slice 1 only.
- Gate 10 Audit Evidence Integrity: F3/F1 idempotency and request hash preserved.
- Gate 11 Platform Regression: focused Finance OS tests, scoped lint, scoped TypeScript, `git diff --check`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL FINANCE TENANT + ACTOR AUTHORIZATION

> **Status:** PASS - bounded Preschool Product Finance server authorization boundary
> **Date:** 2026-09-27
> **Scope:** F2 active finance UI/API path only; no Finance RLS hardening, no billing redesign, no browser field verification

---

## 1. Bella OS/Product Development Process Gate

F1 cut over Preschool Finance identity to canonical `student_party_id`. The next proven blocker is that the active Finance UI still supplies hardcoded tenant/staff/parent IDs from the browser. Gate decision: `PASS` for the smallest server boundary that derives tenant and actor from the authenticated session, permits only existing Bella finance roles, and preserves P7 fee/invoice/payment/reconciliation semantics.

## 2. Product Manifest

In scope:
- Preschool Product Finance API boundary for active Finance page read/actions.
- Finance page consumer change from direct Supabase/service calls to server API calls.
- Role mapping for existing Bella roles `admin` and `accountant`.
- Focused tests proving server-derived tenant/actor and parent denial.

Out of scope:
- Broad `edu_fin_*` RLS/grant remediation.
- Generic authorization framework.
- Finance/Billing Kernel redesign.
- Browser field verification before F3 RLS hardening.
- Parent Finance redesign or notification workflow expansion.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| authenticated user/session | Platform Auth / Bella user profile | Source for current user id, role, tenant |
| `admin` / `accountant` user roles | Bella existing user model | Allowed active Preschool finance operators |
| P7 Finance actions | Preschool Product Finance | Compile/issue invoices, payment reconciliation, finance projections |
| `edu_fin_*` RLS policies | Preschool Product Finance / DB security | Deferred F3 hardening target |

## 4. Contract Dependency Map

```text
Finance UI
        ↓
/api/education/finance
        ↓
getCurrentUser()
        ↓
server-derived tenant + actor + role
        ↓
P7 Finance services
        ↓
edu_fin_* canonical student_party_id rows
```

Client-supplied `tenantId`, `createdBy`, `payerPartyId`, or authorization status is not trusted.

## 5. Change Authority

Authorized:
- Preschool Product Finance route/UI boundary.
- Bounded finance authorization helper/service.
- Directly affected finance service call signatures where actor/guardian derivation must move server-side.
- Focused tests and this gate artifact.

Not authorized:
- Education Kernel changes.
- Generic Auth/RBAC framework.
- Broad RLS policy repair.
- Migration history or BDGF work.

## 6. UI -> Contract Reconciliation

| UI element/action | Old authority | New authority | Conclusion |
|---|---|---|---|
| Finance data load | browser Supabase + hardcoded tenant | server API derives tenant from authenticated profile | STALE UI |
| Draft invoice | browser sends `DEFAULT_TENANT_ID` / `DEFAULT_STAFF_ID` | server derives tenant/actor | STALE UI |
| Issued notice projection | browser sends `DEFAULT_PARENT_ID` | server derives guardians via canonical `guardian_of` relationship | STALE UI |
| Payment/reconciliation | browser sends payer/staff constants | server derives payer guardian and actor | STALE UI |

## 7. Additive Migration Plan

No migration in F2. Existing broad/permissive Finance RLS is recorded as F3:

```text
edu_fin_fee_structures
edu_fin_billing_periods
edu_fin_student_discount_profiles
edu_fin_invoices
edu_fin_invoice_line_items
edu_fin_payments
edu_fin_reconciliation_ledger
edu_fin_receipts
```

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Preschool Product Finance only; no Education Kernel change.
- Gate 2 Contract Boundary: API mediates UI to P7 services.
- Gate 3 Tenant Isolation: server derives tenant and repository filters by tenant.
- Gate 4 RLS & Authorization: app-layer roles `admin` and `accountant` allowed; `parent` denied; DB RLS hardening deferred to F3.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: no new domain event.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: not applicable.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence Integrity: existing invoice/receipt fingerprints preserved.
- Gate 11 Platform Regression: F1/F2 focused tests, scoped ESLint, `git diff --check`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL FINANCE CANONICAL STUDENT CONNECTION

> **Status:** PASS - bounded Preschool Product cutover from legacy `student_id` to canonical `student_party_id`
> **Date:** 2026-09-27
> **Scope:** P7 Preschool Finance student identity only; no Billing Kernel redesign or broad RLS/auth repair

---

## 1. Bella OS/Product Development Process Gate

The sealed Preschool operational chain now creates canonical Student Parties through Enrollment. The next Market Ready blocker is that P7 Preschool Finance still selects and persists legacy `students.student_id`, while the real enrolled student identity is:

```text
edu_enrollments.student_party_id
        ↓
students.party_id
        ↓
party_parties.id
```

Gate decision: `PASS` for the smallest Preschool Product-owned finance cutover that writes and reads canonical `student_party_id` for new invoice/payment/discount operations while preserving legacy rows.

## 2. Product Manifest

In scope:
- P7 finance domain types, repository, invoice compilation, inbound payment recording, issuance fingerprint identity, and the finance UI student selector/action path.
- One additive migration on directly affected `edu_fin_*` tables.
- Focused service/static tests proving canonical enrollment validation and legacy compatibility.

Out of scope:
- Generic Finance/Billing redesign.
- Finance RLS/grant hardening.
- Server auth/actor/tenant hardcode removal.
- Parent Communication or Notice redesign beyond the directly affected finance projection belonging check.
- Browser field verification before owner deployment.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `edu_enrollments.student_party_id` | Education Enrollment / Preschool consumer | Canonical enrolled student identity |
| `party_parties.id` | Platform Party | Canonical Party identity |
| `edu_fin_student_discount_profiles.student_party_id` | Preschool Product Finance | Canonical student identity for discounts |
| `edu_fin_invoices.student_party_id` | Preschool Product Finance | Canonical student identity for invoices |
| `edu_fin_payments.student_party_id` | Preschool Product Finance | Canonical student identity for payments |

## 4. Contract Dependency Map

```text
Finance UI
        ↓
edu_enrollments(active/pending)
        ↓
Student Party
        ↓
P7 Finance services
        ↓
edu_fin_* rows keyed by student_party_id
```

Payer identity remains separate as `payer_party_id`.

## 5. Change Authority

Authorized:
- Preschool Product finance code and UI path.
- Additive/cutover migration on P7 finance tables.
- Direct finance projection check required by issued-invoice notice creation.

Not authorized:
- Education Kernel changes.
- Finance OS Kernel changes.
- Generic billing engine rebuild.
- Broad RLS/security remediation.

## 6. UI -> Contract Reconciliation

| UI element | Old source | New source | Conclusion |
|---|---|---|---|
| Student selector | `students.student_id` with hardcoded P7 fallback | `edu_enrollments.student_party_id -> party_parties` | CUT OVER |
| Draft invoice action | legacy `studentId` | canonical `studentPartyId` | CUT OVER |
| Payment action | invoice legacy student key | invoice canonical `studentPartyId` | CUT OVER |

Known hardcoded tenant/staff/parent IDs remain a separate F2/auth-boundary finding and are not fixed in this F1 identity slice.

## 7. Additive Migration Plan

One migration:

```text
edu_fin_student_discount_profiles
edu_fin_invoices
edu_fin_payments
  ADD student_party_id UUID REFERENCES party_parties(id)
  ALTER student_id DROP NOT NULL
  ADD CHECK (student_id IS NOT NULL OR student_party_id IS NOT NULL)
  ADD tenant + student_party_id indexes
```

Legacy columns are preserved. No backfill, cleanup, RLS, grant, migration history, or data mutation is included.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Product-owned Preschool finance only; no Education/Finance Kernel change.
- Gate 2 Contract Boundary: validate canonical enrollment before new finance obligation/payment creation.
- Gate 3 Tenant Isolation: enrollment validation is scoped by tenant and `student_party_id`.
- Gate 4 RLS & Authorization: no policy change in this slice; existing broad finance RLS is deferred.
- Gate 5 Database Migration Safety: one bounded additive/cutover migration; no legacy drop/backfill.
- Gate 6 Event-After-Persistence: not applicable; no domain event emitted.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: not applicable.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence Integrity: invoice publication fingerprint uses canonical student identity.
- Gate 11 Platform Regression: focused Preschool finance tests, scoped ESLint, `git diff --check`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL PARENT USER ROLE ENABLEMENT

> **Status:** PASS - minimum auth/profile contract amendment for legitimate parent accounts
> **Date:** 2026-09-27
> **Scope:** `public.users.users_role_check` only; prerequisite for Parent Daily browser field verification

---

## 1. Bella OS/Product Development Process Gate

The Parent Daily backend, canonical Guardian Party mapping, and focused access tests are implemented. Browser field verification is blocked because a real parent account cannot have a legitimate `public.users` profile:

```text
Supabase Auth user
        ↓
public.users profile
        ↓
users_role_check rejects 'parent'
```

Gate decision: `PASS` for the smallest database contract amendment that permits a `parent` actor without granting staff/admin authority.

## 2. Product Manifest

In scope:
- Preserve all currently accepted `public.users.role` values.
- Add exactly one canonical role: `parent`.
- Keep role validation bounded by `users_role_check`.

Out of scope:
- Auth redesign, invitation workflow, password management, RBAC framework.
- Staff/admin permission changes.
- Parent Daily business semantics, Attendance, Daily Care, Handover, Guardian Authorization, Enrollment, R3, Course RLS.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `public.users.role` | Platform Auth/Profile | User profile role label used by app guards and tenant context |
| `parent` | Preschool Product consumer of Platform profile | External guardian/parent login actor; not staff/admin |

## 4. Contract Dependency Map

```text
Supabase Auth user
        ↓
public.users(role = parent, tenant_id, phone)
        ↓
Parent Daily access service
        ↓
party_identifiers(preschool_guardian_phone)
        ↓
Guardian Party
        ↓
party_relationships guardian_of
        ↓
Student Party
```

Pickup authorization remains excluded from parent data-access authority.

## 5. Change Authority

Authorized:
- One bounded migration changing only `public.users.users_role_check`.
- Focused static migration test and existing Parent Daily access tests.

Not authorized:
- Generic RBAC/permission engine.
- Staff/admin route permission expansion.
- Product workflow changes.

## 6. UI -> Contract Reconciliation

No UI change in this slice. This is a contract prerequisite for using a real parent browser session in the already implemented Parent Inbox.

## 7. Additive Migration Plan

One migration:

```sql
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
CHECK (role IN (... existing roles ..., 'parent'));
```

No RLS, policy, grant, profile data, or auth-user mutation.

## 8. Verification Plan

- Focused migration static test:
  - existing roles remain valid
  - `parent` is accepted
  - arbitrary roles are not accepted
  - validation is not weakened
- Existing Parent Daily access tests still pass.
- Scoped ESLint/diff check.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL PARENT DAILY EXPERIENCE

> **Status:** PASS - complete parent daily view from canonical Preschool operational truth
> **Date:** 2026-09-27
> **Scope:** Parent daily read model, canonical guardian access, Parent Digest `student_party_id` cutover, `/dashboard/education/parent-inbox`

---

## 1. Bella OS/Product Development Process Gate

The sealed Preschool operational chain is:

```text
New Student -> Enrollment -> Classroom Roster -> Daily Attendance
-> Daily Care -> Guardian Authorization -> Safe Pickup/Handover
= FIELD VERIFIED
```

The next proven product blocker is:

```text
Parent Daily Experience = PARTIAL
```

Operational truth exists for Attendance, Daily Care, and Handover, but Parent Digest and Parent Inbox still consume legacy/static paths. Gate decision: `PASS` for the minimum Preschool Product connection that exposes today's real child-day truth to an authenticated canonical Guardian Party.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Resolve authenticated user to Guardian Party using existing tenant-scoped guardian phone identifier.
- Validate `Guardian Party --guardian_of--> Student Party` before returning any child data.
- Cut Parent Digest operational key from legacy `student_id` to canonical `student_party_id`.
- Read today's Attendance, Daily Care, and Handover truth from existing FIELD VERIFIED sources.
- Replace operational Parent Inbox mock path with real backend read-back.

Out of scope:
- QR, SMS, push, mobile app, billing, medication workflow, temperature, staff scheduling, facilities.
- Generic parent authorization framework.
- Pickup authorization as parent data-access authority.
- Reopening R3, Enrollment, Roster, Attendance, Daily Care source semantics, Guardian Authorization, Safe Pickup/Handover, Course RLS.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `party_relationships guardian_of` | Platform Party | Family/guardian relationship between Guardian Party and Student Party |
| `edu_attendance_daily_state` | Education Attendance / Preschool consumer | Daily attendance state |
| `edu_daily_care_records.student_party_id` | Preschool Product | Daily care state for a canonical Student Party |
| `edu_preschool_pickup_handover_events` | Preschool Product | Immutable pickup handover event |
| `edu_daily_parent_digests.student_party_id` | Preschool Product | Parent digest projection keyed by canonical Student Party |
| `/dashboard/education/parent-inbox` | Preschool Product UI | Parent daily experience read surface |

## 4. Contract Dependency Map

```text
Authenticated user
        ↓
public.users.phone
        ↓
party_identifiers(preschool_guardian_phone)
        ↓
Guardian Party
        ↓
party_relationships guardian_of
        ↓
Student Party
        ↓
Attendance + Daily Care + Handover read model
        ↓
Parent Inbox UI
```

Pickup authorization is not part of the parent data-access contract.

## 5. Change Authority

Authorized:
- Preschool Product service/API/UI for parent daily read model.
- Additive/cutover migration on Preschool-owned `edu_daily_parent_digests`.
- Focused tests for related child access, unrelated child denial, cross-tenant denial, pickup authorization not granting data access, and canonical sources.

Not authorized:
- Platform identity redesign.
- Education Kernel changes.
- Generic authorization framework.
- Notification delivery, QR, mobile app, or parent communication redesign.

## 6. UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Parent daily child card | Shows real child | `party_relationships guardian_of -> party_parties` | MATCH |
| Attendance | Present/absent/excused/unmarked | `edu_attendance_daily_state` through canonical enrollment | MATCH |
| Arrival/meal/hygiene/nap | Today's care state | `edu_daily_care_records.student_party_id` | MATCH |
| Handover | Pickup complete/time/guardian | `edu_preschool_pickup_handover_events` | MATCH |
| Static NOT-* notices | Mock operational data | No real parent daily contract | STALE UI |

## 7. Additive Migration Plan

One migration only:

```text
edu_daily_parent_digests
  ADD student_party_id UUID REFERENCES party_parties(id)
  ALTER student_id DROP NOT NULL
  ADD unique/indexes for session + student_party_id
```

No legacy cleanup/drop.

## 8. Verification Plan

- Focused parent daily service tests.
- Focused Parent Digest canonical tests where practical.
- Scoped ESLint.
- `git diff --check`.
- Typecheck changed once; if it stalls, report `NOT_VERIFIED_STALL`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL DAILY CARE CANONICAL CONNECTION

> **Status:** PASS - minimum Preschool-owned Daily Care connection to canonical enrolled students
> **Date:** 2026-09-27
> **Scope:** `/dashboard/education/care`, Daily Care product service/API, canonical `student_party_id` persistence

---

## 1. Bella OS/Product Development Process Gate

The verified Preschool chain has reached:

```text
New Student -> Enrollment -> Classroom Roster -> Daily Attendance -> Guardian Authorization -> Safe Pickup/Handover = FIELD VERIFIED
```

The next proven blocker is:

```text
Daily Care / Care & Wellbeing = PARTIAL
```

The existing Care UI is a real Preschool menu capability, but still uses hardcoded tenant/class/student/date/static students and writes care records through legacy `students.student_id`.

Gate decision: `PASS` for the minimum Preschool Product connection that lets the existing Care workspace operate on the same canonical enrolled students already proven by Enrollment/Roster/Attendance.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Load real active courses and enrolled students for the authenticated Preschool tenant.
- Persist Daily Care records by canonical `student_party_id`.
- Preserve existing Care semantics for arrival, meal, hygiene, and nap.
- Return DB read-back so browser refresh can show persisted truth.

Out of scope:
- Parent Digest publishing.
- QR, pickup, handover, Attendance changes, Guardian Authorization changes.
- Medication authorization redesign.
- Platform/Education-wide Care engine or generic workflow framework.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `edu_daily_care_sessions` | Preschool Product | Care session per course/date |
| `edu_daily_care_records` | Preschool Product | Care state for one canonical student/day |
| `edu_enrollments` | Education OS Enrollment | Canonical course membership |
| `students.party_id` / `party_parties.id` | Education Student / Platform Party | Canonical student identity |
| `/dashboard/education/care` | Preschool Product UI | Staff care action workspace |

## 4. Contract Dependency Map

```text
Care UI
        ↓
GET /api/education/courses
        ↓
GET /api/education/care/bulk?courseId&date
        ↓
DailyCareService
        ↓
edu_enrollments.student_party_id
        ↓
edu_daily_care_records.student_party_id
        ↓
Care UI DB read-back
```

## 5. Change Authority

Authorized:
- One bounded migration for canonical Daily Care identity on existing product-owned table.
- `DailyCareService` and its product-local contract.
- `/api/education/care/bulk` server boundary.
- Existing Care page operational data/action wiring.
- Focused tests for canonical student persistence and tenant/course denial.

Not authorized:
- R3, Enrollment, Attendance, Guardian Authorization, Safe Pickup/Handover.
- Parent Digest, Parent Engagement, QR, Haircut, BDGF, migration history.

## 6. UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Course selector | Real Preschool class/course | `GET /api/education/courses` | MATCH |
| Student roster | Real enrolled students | `edu_enrollments.student_party_id -> party_parties` | MATCH |
| Care action | Persist care for current student/day | `edu_daily_care_records.student_party_id` | CONTRACT CHANGE REQUIRED |
| Temperature | Health check input | No real current input in Care page | DEFER |
| Parent Digest | Publish parent-facing snapshot | Existing separate digest projection | DEFER |

## 7. Additive Migration Plan

Minimum table correction:

```text
edu_daily_care_records.student_party_id -> party_parties.id
student_id DROP NOT NULL for canonical rows
unique session + student_party_id
index tenant + student_party_id
```

No parent digest migration, attendance change, guardian change, or R3 change.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Product-owned service/API/UI; no Education Kernel modification.
- Gate 2 Contract Boundary: Product consumes canonical enrollment/party identity only.
- Gate 3 Tenant Isolation: API derives tenant server-side and service validates tenant/course membership.
- Gate 4 RLS/Auth: no RLS weakening; server-side route owns mutation.
- Gate 5 Migration Safety: bounded product table identity correction only.
- Gate 6 Event-After-Persistence: not applicable; success after DB update/read-back.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: daily record update semantics preserved.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: focused tests prove DB-shaped persistence and denial.
- Gate 11 Regression: focused Daily Care tests, scoped lint, diff check.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL SAFE PICKUP HANDOVER EVENT

> **Status:** PASS - minimum Preschool-owned handover event truth
> **Date:** 2026-09-27
> **Scope:** Safe Pickup handover event persistence, API action, Attendance/Safe Pickup UI connection

---

## 1. Bella OS/Product Development Process Gate

The verified Preschool operational chain has reached:

```text
New Student -> Enrollment -> Classroom Roster -> Daily Attendance -> Guardian Authorization = FIELD VERIFIED
```

Discovery proved:

```text
Safe Pickup authorization != handover event
Existing canonical handover capability = NONE
Owner = Preschool Product
```

Gate decision: `PASS` for one minimum product-owned event record proving that an authorized guardian received a specific student from an authenticated operator at a specific time.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Create one Preschool-owned handover event table.
- Validate the active pickup authorization before recording handover.
- Derive tenant, operator, and timestamp server-side.
- Add one minimal API action for the existing Safe Pickup panel.
- Show persisted handover read-back in the existing Attendance/Safe Pickup UI.

Out of scope:
- QR, scanner/camera, pickup token, biometrics, signature capture.
- Notifications, pickup schedules, custody rules, effective authorization windows.
- Guardian Authorization semantic changes.
- Enrollment, Student/R3, Attendance status semantics, Course RLS, BDGF, migration history.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `edu_preschool_pickup_handover_events` | Preschool Product | Immutable handover business event |
| `edu_preschool_pickup_authorizations` | Preschool Product | Active authorization prerequisite |
| `party_parties` | Platform Party | Canonical Student and Guardian identities |
| Safe Pickup UI | Preschool Product UI | Action surface and truthful read-back |

## 4. Contract Dependency Map

```text
Safe Pickup UI
        ↓
POST /api/education/attendance/handover
        ↓
PreschoolSafePickupHandoverService
        ↓
Validate active authorization
        ↓
Insert edu_preschool_pickup_handover_events
        ↓
GET /api/education/attendance read-back
        ↓
Safe Pickup panel shows "Đã bàn giao"
```

## 5. Change Authority

Authorized:
- One additive Preschool Product migration.
- Product-owned service for handover event.
- Attendance API route read-back and one new handover endpoint.
- Existing Attendance/Safe Pickup UI action wiring.
- Focused tests for handover validation and failure paths.

Not authorized:
- Education Kernel handover engine.
- Guardian Authorization redesign.
- QR/custody/notification/Parent Engagement.
- Broad regression repair or migration history work.

## 6. UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Authorized guardian display | Existing active authorization shown | `edu_preschool_pickup_authorizations` | MATCH |
| Bàn giao action | Persist real handover event | New `edu_preschool_pickup_handover_events` | CONTRACT CHANGE REQUIRED |
| QR copy/status | QR verification | No canonical capability in this slice | DEFER |
| Handover success message | Only after persisted event read-back | Handover API + roster refresh | MATCH after slice |

## 7. Additive Migration Plan

Create one table only:

```text
edu_preschool_pickup_handover_events
tenant_id
student_party_id
guardian_party_id
pickup_authorization_id
handed_over_at
handed_over_by
created_at
```

No mutation of authorization, enrollment, student identity, attendance, QR, Parent Engagement, or legacy tables.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Product-owned service/API/UI only.
- Gate 2 Contract Boundary: No Education Kernel modification.
- Gate 3 Tenant Isolation: tenant derived server-side; service validates same tenant.
- Gate 4 RLS/Auth: new table has tenant RLS policy.
- Gate 5 Migration Safety: additive table/index/policy only.
- Gate 6 Event-After-Persistence: success only after insert/read-back.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: immutable event record.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: focused test/read-back proves event truth.
- Gate 11 Regression: focused handover test, scoped lint, diff check.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL DAILY ATTENDANCE STATE

> **Status:** PASS - canonical Education daily attendance state projection for Preschool roll call
> **Date:** 2026-09-26
> **Scope:** Education Attendance public contract extension, additive daily-state projection, Preschool Attendance UI wiring

---

## 1. Bella OS/Product Development Process Gate

The verified Preschool workflow has reached:

```text
New Student → Enrollment → Classroom Roster = FIELD VERIFIED
```

The next blocker is daily roll call. Discovery proved two distinct semantics:

```text
edu_attendance = event history
Preschool roll call = current daily state
```

Gate decision: `PASS` for the minimum canonical Education Attendance contract extension that preserves event history and adds a bounded daily-state projection.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Add an Education-owned daily attendance state projection.
- Preserve `edu_attendance` append-only event semantics.
- Add atomic write boundary: append event + upsert daily state.
- Add canonical read path for course/date roster attendance.
- Wire Preschool Attendance UI to the canonical Education Attendance service/API.

Out of scope:
- Pickup, temperature, Care, Parent notification, Billing, Reporting.
- R3, BDGF, migration history, credential debugging.
- Legacy `attendances` cleanup or dual-write.
- Generic timezone framework or event-sourcing framework.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `public.edu_attendance` | Education OS Attendance | Append-only attendance event history |
| Daily attendance state projection | Education OS Attendance | Effective state for tenant + enrollment + school_day |
| `public.edu_enrollments` | Education OS Enrollment | Canonical roster membership by course |
| `public.students` / `public.party_parties` | Education Student / Platform Party | Canonical student identity for roster display |
| Preschool Attendance page | Preschool Product UI | Presentation and user action surface only |

## 4. Contract Dependency Map

```text
Preschool Attendance UI
        ↓
Education Attendance API
        ↓
AttendanceProductService
        ↓
IEducationAttendanceContract
        ↓
AttendanceContractImpl
        ↓
Education DB boundary
        ├── edu_attendance event append
        └── daily attendance state upsert
```

Read path:

```text
course + school_day
        ↓
edu_enrollments
        ↓
students.party_id
        ↓
party_parties
        ↓
daily attendance state (nullable/unmarked)
```

## 5. Change Authority

Authorized:
- One additive Education attendance migration.
- `src/platform/education/contracts/attendance.contract.ts`
- `src/platform/education/contracts/attendance.contract.impl.ts`
- `src/products/bella-education/services/attendance.service.ts`
- Minimal Attendance API route(s).
- `src/app/dashboard/education/attendance/page.tsx`
- Focused tests for daily-state semantics and UI/API mapping.

Not authorized:
- Healthcare, Logistics, R3, BDGF, legacy cleanup.
- Legacy `attendances` dual-write.
- Product-specific attendance engine separate from Education.

## 6. UI → Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Class/course selector | Real course list | Existing Education courses API | MATCH |
| Roster rows | Enrolled students for selected course | `edu_enrollments.student_party_id → students.party_id → party_parties` | MATCH |
| Present/Absent/Excused action | One effective state for school day | New Education daily-state projection | CONTRACT CHANGE REQUIRED |
| History/correction evidence | Correction preserves history | Existing `edu_attendance` event log | MATCH |
| Pickup/temperature panels | Not proven for attendance mutation | Out of scope | DEFER |

## 7. Additive Migration Plan

Create only a new Education daily attendance state projection with:

```text
tenant_id
enrollment_id
school_day
status present|absent|excused
created_at
updated_at
UNIQUE (tenant_id, enrollment_id, school_day)
RLS tenant isolation consistent with Education tables
```

No modification to `edu_attendance`, `attendances`, `persons`, identity mappings, or enrollment tables.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Education contract and Product UI only; no cross-industry imports.
- Gate 2 Contract Boundary: Product calls public Education Attendance service/contract.
- Gate 3 Tenant Isolation: mutation/read validates tenant owns enrollment/course.
- Gate 4 RLS/Auth: new table has RLS and tenant policy.
- Gate 5 Migration Safety: additive table only.
- Gate 6 Event-After-Persistence: event + state mutation must be transactional/atomic.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: event history remains append-only.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: correction test proves two history events and one effective state.
- Gate 11 Regression: focused attendance tests, scoped lint, diff check.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL GUARDIAN AUTHORIZATION

> **Status:** PASS - minimal Preschool-owned guardian pickup authorization truth
> **Date:** 2026-09-27
> **Scope:** New Enrollment guardian identity/relationship/authorization; Safe Pickup panel read-only truth display

---

## 1. Bella OS/Product Development Process Gate

The verified Preschool operational chain has reached:

```text
New Student -> Enrollment -> Classroom Roster -> Daily Attendance = FIELD VERIFIED
```

The next blocker is not QR or pickup event execution. Discovery proved the first missing truth is:

```text
Student Party
      ↓
Guardian Party
      ↓
Guardian identity relationship
      ↓
Preschool pickup authorization
```

Gate decision: `PASS` for the minimum product-owned model answering only which Guardian Party is currently authorized to pick up which Student Party.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Resolve/create a tenant-scoped Guardian Party from required enrollment guardian input.
- Store a bounded tenant-scoped guardian phone identifier for this Preschool flow.
- Link Guardian Party to Student Party through `guardian_of` identity relationship.
- Create/read a separate Preschool pickup authorization.
- Extend the existing enrollment response and Safe Pickup panel to display real authorized guardian truth.

Out of scope:
- QR token/scanner.
- Pickup/handover/release event.
- Temperature or Daily Care changes.
- Parent Engagement refactor.
- Generic identity, phone, or authorization framework.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `party_parties` | Platform Party | Canonical Guardian and Student identity |
| `party_identifiers` | Platform Party | Tenant-scoped Preschool guardian phone resolution key |
| `party_relationships` | Platform Party | Guardian -> Student identity/family relationship |
| `edu_preschool_pickup_authorizations` | Preschool Product | Operational truth that a guardian is currently authorized for pickup |
| Attendance Safe Pickup panel | Preschool Product UI | Read-only display of authorization truth; no pickup event/QR claim |

## 4. Contract Dependency Map

```text
Preschool Enrollment API
        ↓
Student Party
        ↓
Guardian Party resolve/create
        ↓
party_relationships guardian_of
        ↓
edu_preschool_pickup_authorizations
        ↓
Student + Enrollment
```

Read path:

```text
Attendance roster
        ↓
student_party_id
        ↓
edu_preschool_pickup_authorizations
        ↓
guardian party display + phone identifier
        ↓
Safe Pickup panel
```

## 5. Change Authority

Authorized:
- One additive Preschool-owned authorization migration.
- Product service for guardian authorization.
- Enrollment API integration.
- Attendance API/UI read-only display of authorized guardian.
- Focused tests for identity, duplicate boundaries, and false-success prevention.

Not authorized:
- Education Attendance engine redesign.
- Parent Engagement refactor.
- QR, pickup event, custody scheduling, temperature, or Daily Care.
- BDGF/R3/migration-history work.

## 6. UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Enrollment guardian fields | Required guardian info becomes operational truth | Guardian Party + relationship + pickup authorization | CONTRACT CHANGE REQUIRED |
| Safe Pickup guardian display | Show who is authorized | `edu_preschool_pickup_authorizations` + Party identity | MATCH after slice |
| QR action | Verify pickup via QR | No canonical capability yet | DEFER |
| Pickup completion | Child released/handover event | No canonical capability yet | DEFER |
| Temperature | Care/health check | Daily Care capability, not Attendance | DEFER |

## 7. Additive Migration Plan

Create one table only:

```text
edu_preschool_pickup_authorizations
tenant_id
student_party_id
guardian_party_id
status authorized|revoked
created_at
updated_at
```

Add a partial unique boundary for active authorization:

```text
tenant_id + student_party_id + guardian_party_id WHERE status = authorized
```

No pickup event, QR token, schedule, custody, photo, signature, or geolocation fields.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Product-owned service/API/UI; Platform Party tables only for identity.
- Gate 2 Contract Boundary: Education attendance/enrollment contracts remain unchanged.
- Gate 3 Tenant Isolation: guardian phone resolution and authorization are tenant scoped.
- Gate 4 RLS/Auth: new table has RLS tenant policy.
- Gate 5 Migration Safety: additive table/index/policy only.
- Gate 6 Event-After-Persistence: no event behavior added.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: not applicable.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: read-back proves authorization truth.
- Gate 11 Regression: enrollment and attendance focused tests, scoped lint, diff check.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL NEW STUDENT ENROLLMENT PATH

> **Status:** PASS - minimal Product UI to canonical Education enrollment wiring
> **Date:** 2026-09-26
> **Scope:** Preschool New Student modal, product-owned API boundary, canonical Party/Student/Enrollment chain

---

## 1. Bella OS/Product Development Process Gate

Request targets the proven Preschool blocker:

```text
Enrollment UI
        ↓
static/local completion
        ↓
no canonical Party
no Student contract call
no edu_enrollments persistence/read-back
```

R3 Student identity is sealed; new canonical Student creation now supports:

```text
party_id = public.party_parties.id
person_id = NULL
```

Gate decision: `PASS` for a minimal Product-layer server boundary plus UI submit wiring.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Use the existing Preschool Enrollment UI/modal.
- Create one product-owned API route for the admission operation.
- Create a canonical person Party in `public.party_parties`.
- Register the Student through `StudentContractImpl`.
- Enroll through `EnrollmentProductService` and `EnrollmentContractImpl`.
- Report success only after Student and Enrollment read-back.

Out of scope:
- Attendance, Care, Parent Inbox, Pickup, Finance, Reporting.
- R3, BDGF, migration history, credential/debug work.
- New identity framework, fake `persons`, fake `identity_migration_mapping`, or compatibility layer.
- Broad Preschool redesign.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `public.party_parties` | Platform Party identity | Canonical person identity for the new student |
| `public.students` | Education OS Student | Student role bound to canonical Party |
| `public.edu_enrollments` | Education OS Enrollment | Canonical enrollment persistence/read-back |
| Enrollment modal state | Preschool Product UI | User input only; not source of operational truth |

## 4. Contract Dependency Map

```text
Preschool Enrollment UI
        ↓
POST /api/education/enrollments
        ↓
party_parties insert
        ↓
StudentContractImpl.registerStudent()
        ↓
EnrollmentProductService.enrollStudent()
        ↓
EnrollmentContractImpl
        ↓
EducationEngineService
        ↓
SupabaseEducationRepository
        ↓
edu_enrollments
        ↓
getStudent() + getEnrollment() read-back
```

## 5. Change Authority

Authorized:
- `src/app/dashboard/education/enrollments/page.tsx`
- `src/app/api/education/enrollments/route.ts`
- Focused tests for the new product API boundary.
- This architecture gate artifact.

Not authorized:
- Education Kernel schema changes.
- Attendance/Care/Parent/Finance/Reporting.
- Migration deployment, BDGF, or production credential work.

## 6. UI → Contract Reconciliation

The previous button only closed the modal. The new path must submit the UI payload to the product API and display failure if the server chain fails. Course/class identity must come from the existing `GET /api/education/courses` source, not from a hardcoded ID.

Browser smoke discovered a direct mapping bug in that existing course source:

```text
Enrollment modal
        ↓
GET /api/education/courses
        ↓
hardcoded tenant fallback
        ↓
classrooms: []
        ↓
submit blocked before canonical enrollment request
```

Authorized minimal correction: the course API must prefer the authenticated
user's tenant context before legacy fallback so the Enrollment UI can submit a
canonical course/class ID for the current Preschool tenant.

## 7. Additive Migration Plan

No migration in this task.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: product API uses public Education contracts.
- Gate 2 Contract Boundary: Student registration uses `partyId`; enrollment uses `studentPartyId`.
- Gate 3 Tenant Isolation: API resolves tenant from authenticated user context before writes.
- Gate 4 RLS/Auth: no RLS/grant changes.
- Gate 5 Migration Safety: no schema change.
- Gate 6 Event-After-Persistence: Enrollment engine remains responsible.
- Gate 7 Academic Safety Routing: course validation remains in Education engine.
- Gate 8 Temporal Provenance: not changed.
- Gate 9 Rule Governance: not changed.
- Gate 10 Audit Evidence: API response includes persisted/read-back IDs.
- Gate 11 Regression: focused route tests, existing R3 Student tests, scoped lint/diff checks.

---

# ARCHITECTURE GATE RESULT - R3 STUDENT CREATE-SIDE COMPLETION

> **Status:** PASS - minimal R3 create-side cutover for canonical Party-backed Students
> **Date:** 2026-09-26
> **Scope:** Education Student create path only; prerequisite for Preschool New Student enrollment

---

## 1. Product Manifest (Capabilities & Scope)

This change completes the proven R3 create-side gap:

```text
New canonical Party
        ↓
Student role creation
        ↓
students.party_id = party_parties.id
students.person_id = NULL
```

Included:
- Relax the transitional `students.person_id` NOT NULL requirement.
- Preserve `students.person_id` column, FK, index, and legacy read path.
- Preserve canonical `partyId` requirement at the Student application/contract boundary.
- Stop requiring `identity_migration_mapping` for brand-new canonical Student creation.
- Fix the proven semantic bug where `studentPartyId` was queried against `students.person_id`.

Excluded:
- No Preschool Enrollment implementation in this task.
- No `persons` creation for new Students.
- No fake `identity_migration_mapping` rows.
- No `students.party_id NOT NULL` schema hardening.
- No legacy cleanup, mapping removal, BDGF, migration history, or production deployment.

## 2. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `public.students` | Education OS Student bounded context | Student role state for canonical Party identity |
| `public.party_parties` | Platform Party identity | Canonical person Party identity |
| `public.persons` | Legacy Platform Host Person | Transitional legacy identity retained for existing rows |
| `public.identity_migration_mapping` | R3 migration bridge | Legacy mapping for migrated rows only |

## 3. Contract Dependency Map

```text
Preschool Product
        ↓
Education Student Contract
        ↓
StudentService
        ↓
StudentAggregate
        ↓
StudentRepository
        ↓
public.students
        ↓
party_id → public.party_parties(id)
```

Legacy compatibility remains:

```text
Existing legacy consumers
        ↓
StudentRepository.findByPersonId()
        ↓
students.person_id → public.persons(id)
```

## 4. Change Authority

Authorized by owner prompt:
- Education Student create path.
- One additive/transitional schema migration: `ALTER COLUMN person_id DROP NOT NULL`.
- Generated DB type refresh/update for `students.person_id` nullability.
- Focused tests for Student create/read-back/legacy compatibility.

Not authorized:
- Preschool UI/backend wiring.
- BDGF/governance changes.
- Production migration execution.
- Broad Education architecture refactor.

## 5. UI → Contract Reconciliation

No UI changes in this task. Preschool UI remains out of scope until R3 create-side is reviewed and deployed.

## 6. Additive Migration Plan

One migration only:

```sql
ALTER TABLE public.students
ALTER COLUMN person_id DROP NOT NULL;
```

No data mutation, backfill, FK/index removal, Party hardening, or legacy cleanup.

## 7. Verification Gates Plan

- Gate 1 Architecture Compliance: scoped Education changes only; no cross-industry imports.
- Gate 2 Contract Boundary: Student public contract remains Party-based.
- Gate 3 Tenant Isolation: preserve tenant filters in StudentRepository/Service.
- Gate 4 RLS/Auth: no RLS or grant changes.
- Gate 5 Migration Safety: transitional nullable change only; no destructive column/FK removal.
- Gate 6 Event-After-Persistence: not applicable; no event behavior changed.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: not applicable.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: not applicable.
- Gate 11 Regression: focused Student tests, affected Education tests where available, scoped TypeScript/lint.

---

# ARCHITECTURE GATE RESULT - BELLA ENGLISH CENTER POST-RC ENVIRONMENT CLOSURE

> **Status:** PASS - dev-only API auth-context repair for Post-RC runtime validation
> **Date:** 2026-09-15
> **Canonical base:** `origin/main@fbff36721c3f53067cbd3992157dbb3ba04e634a`
> **Scope:** English Center API runtime validation path only

---

## 1. Product Manifest (Capabilities & Scope)

This closure does not add a new English Center business capability. It fixes the local Post-RC browser validation path where development mock authentication resolves a tenant/user but the API repository Supabase client remains anonymous, causing RLS-backed Command Center reads to fail against `public.user_org_unit_access`.

Included:
- Keep E6-E9 product surfaces unchanged.
- Keep canonical Education OS contracts unchanged.
- Use a service-role Supabase client only for the existing development mock-user branch.
- Preserve production cookie/JWT Supabase client behavior.

Excluded:
- No Education Kernel modification.
- No Healthcare, Logistics, Finance, or cross-industry dependency.
- No `anon` database grant expansion to make tests pass.
- No new database table, policy, or migration in code.

## 2. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `src/app/api/english-center/_shared.ts` | Bella English Center API boundary | API context resolution only |
| `public.user_org_unit_access` | Platform Authorization projection | Existing branch/org-unit access read model |
| English Center E2-E8 tables | Bella English Center Product | Existing product-owned projections and runtime data |

## 3. Contract Dependency Map

```
Post-RC browser gate
        |
        v
English Center API context
        |
        +-- production auth: SSR Supabase client with user JWT
        |
        +-- development mock auth: service-role Supabase client
        |
        v
English Center repositories
        |
        v
Platform Authorization projection (user_org_unit_access)
        |
        v
Product RLS / tenant / branch scope
```

No Product -> Education Kernel bypass is introduced.

## 4. Additive Migration Plan

No code migration is added. Environment closure applied canonical existing migrations/grants to the linked Supabase project and refreshed PostgREST schema cache separately from this source patch.

## 5. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no `src/platform/education/` change; no cross-industry import.
- Gate 2 Contract Boundary: no Education contract bypass change.
- Gate 3 Tenant Isolation: preserve tenant lookup and RLS-backed branch filtering.
- Gate 4 RLS & Authorization: do not grant `anon`; development mock uses controlled admin client.
- Gate 5 Database Migration Safety: no new migration.
- Gate 6 Event-After-Persistence: not applicable; read-only API context path.
- Gate 7 Academic Safety Routing: not applicable; no assessment calculation change.
- Gate 8 Temporal Provenance: not applicable; no temporal write.
- Gate 9 Rule Governance: not applicable; no grading rule change.
- Gate 10 Audit Evidence Integrity: not applicable; no transcript/export change.
- Gate 11 Platform Regression: run Post-RC browser gate and targeted English Center API tests.

---

# ARCHITECTURE GATE RESULT — PR82 CI REMEDIATION

> **Status:** PASS — CI-only remediation, no Product Vertical or Kernel impact
> **Date:** 2026-09-13
> **Scope:** GitHub Actions checks for PR #82 (`infra/git-workflow-constitution-install`)

---

## 1. Product Manifest (Capabilities & Scope)

This change is limited to CI workflow execution policy:
- Bound API documentation checks to API/API-documentation changes.
- Bound live Supabase/DB checks to database, application, or DB-check changes.
- Remove unsafe direct GitHub context interpolation from shell `run:` blocks.
- Pin the branch-cleanup GitHub Action to an immutable commit SHA.

No Healthcare, Education, Logistics, Finance, or Product Vertical runtime capability is added or changed.

## 2. Ownership Map ("WHO OWNS THIS DATA?")

No business data or domain entity is owned or modified by this change.

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `.github/workflows/*` | Repository CI Governance | Automation policy only |
| `docs/api-reference.md` | API Documentation Governance | Referenced deliverable, not created in this change |

## 3. Contract Dependency Map

```
GitHub PR event
        │
        ▼
GitHub Actions workflow checks
        │
        ├── Repo scripts (`npm run docs:api:*`)
        └── GitHub Advanced Security Semgrep OSS
```

No Product -> Contract -> Kernel dependency exists in this remediation.

## 4. Additive Migration Plan

No database migration. No schema change. No RLS policy change.

## 5. 11 Automated Verification Gates Plan

The Healthcare/Education 11-gate product-vertical suite is not applicable because no vertical or kernel code is touched.

Targeted verification for this CI remediation:
- YAML parse / workflow syntax validation.
- Semgrep OSS annotations addressed without disabling scanner.
- API docs check remains enforced for API/API-doc changes and is skipped for infra-only PRs.
- Live DB checks remain enforced for DB/application/DB-check changes and are skipped for infra-only PRs.
- GitHub Actions status rechecked after commit/push.

---

# ARCHITECTURE GATE RESULT — BELLA FINANCE OS KERNEL F1

> **Status:** APPROVED BY HUMAN ARCHITECT
> **Milestone:** Phase F1.1 & F1.2 Initialization
> **Author:** Architecture Review AI (Antigravity)
> **Date:** 2026-08-15

---

## 1. Product Manifest (Capabilities & Scope)

Finance OS Kernel F1 Ledger Engine provides core double-entry bookkeeping and accounting capabilities to the Bella Platform. It handles the financial truth layer without any business vertical dependencies.

### Capabilities Exposed:
- **COA Management**: Chart of accounts definition with strict normal balances (Debit/Credit).
- **Accounting Periods**: Open, close, and lock periods. Prevent posting to closed/locked periods.
- **Double-Entry Posting**: Balanced journal entry transactions.
- **Traceable Sourcing**: Map financial records back to vertical business events via opaque `source_type`/`source_id` references.
- **Immutability Enforcement**: Voiding and reversing transactions. No direct updates to posted entries.
- **Idempotent Dispatch**: Prevent duplicate posting using client-provided unique idempotency keys.
- **Decimal Precision**: Represent money in string-based minor units (`amount_minor`) to avoid floating-point math errors.
- **Reporting Dimensions**: Support cost center, BU, location, and department dimensions natively.

---

## 2. Ownership Map ("WHO OWNS THIS DATA?")

| Table Name | Owner Context | Data Definition |
|---|---|---|
| `finance_accounts` | F1 Ledger | Chart of accounts list |
| `finance_accounting_periods` | F1 Ledger | Accounting periods & locks |
| `finance_transactions` | F1 Ledger | Transaction headers, idempotency keys, source mapping |
| `finance_transaction_lines` | F1 Ledger | Double-entry line items, debit/credit string amounts, dimensions |
| `finance_outbox_events` | F1 Ledger | Transactional outbox records for event publishing |
| `finance_audit_trail` | F1 Ledger | Immutable log of all updates to financial state |

---

## 3. Contract Dependency Map

```
Vertical Layer (Spa, Hospital, etc.)
               │
               ▼
Vertical Finance Bridge (ACL)
               │
               ▼ (Calls via Public Contracts only)
ILedgerEngine Contract (F1)
               │
               ▼
LedgerEngineService (F1 Implementation)
               │
               ├── Updates database (finance_*)
               └── Writes to transactional outbox (finance_outbox_events)
```

---

## 4. Additive Migration Plan

No existing accounting or business tables will be deleted or modified. The migration strictly creates new tables.

### SQL Migrations Proposed:
- `CREATE TABLE finance_accounting_periods` with columns for period range and status.
- `CREATE TABLE finance_accounts` with code, normal balance, and status.
- `CREATE TABLE finance_transactions` with status, functional/transaction currency, source type/id, and idempotency key.
- `CREATE TABLE finance_transaction_lines` with debit/credit string representation and dimensions.
- `CREATE TABLE finance_outbox_events` with payload and status.
- `CREATE TABLE finance_audit_trail` for immutable history tracking.
- Enable RLS on all tables with policies asserting `tenant_id = auth.jwt()->>'tenant_id'`.

---

## 5. 10 Automated Verification Gates Plan

| Gate | Verification Target | Test Method |
|---|---|---|
| **Gate F-1** | Architecture Compliance | Static analysis to ensure no vertical imports in F1, and strict typing (no `any` type). |
| **Gate F-2** | Contract Boundary | Verify vertical layers cannot query `finance_*` tables directly, only via contracts. |
| **Gate F-3** | Tenant Isolation (P0) | Assert that data from Tenant A is never visible/accessible to Tenant B across all F1 methods. |
| **Gate F-4** | Double-Entry Invariant | Assert that trying to post an imbalanced entry (Σ debit ≠ Σ credit) throws `DOUBLE_ENTRY_IMBALANCE`. |
| **Gate F-5** | Transaction Immutability | Assert that updating a transaction with status `POSTED` throws an exception, and that reversing creates mirror lines. |
| **Gate F-6** | Idempotency | Assert that two consecutive `postTransaction` calls with the same key return the same transaction ID without duplication. |
| **Gate F-7** | Period Control | Assert that posting to a `CLOSED` or `LOCKED` period is blocked with `PERIOD_NOT_OPEN`. |
| **Gate F-8** | Event-After-Persistence | Verify that `finance_outbox_events` has the event record committed in the same transaction, and the dispatcher publishes it successfully. |
| **Gate F-9** | Full Regression | Run all Finance OS test suites to ensure 100% test coverage. |
| **Gate F-10** | Financial State Reconstruction | Rebuild materialized state from authoritative records and verify equality. |

---

# Additional Architecture Gate - Production Smoke Network Evidence

> **Status:** PASS - production workflow diagnostics only
> **Date:** 2026-10-04
> **Scope:** `Deploy to Production` smoke evidence for exact preview gate

## 1. Bella OS/Product Development Process Gate

Truth: production workflow run `37189982072` passed immutable config, lint, critical tests, security, migration, build, exact preview deploy, and exact preview health, then failed in `Smoke Exact Preview` because `/dashboard` stayed on the TenantContextProvider loading screen.

Source of Truth: GitHub Actions run logs and the existing Playwright smoke route contract.

Canonical Contract: production smoke must use real authentication and must not bypass app auth, mutate business data, or infer readiness from health alone.

Ownership: `.github/workflows/deploy-production.yml` is Repository CI/Production Ops governance. `e2e/tests/12-authenticated-core-routes-smoke.spec.ts` is read-only production smoke evidence.

Boundary: diagnostic-only. No runtime route, auth architecture, tenant model, database, credential, or English business logic is changed.

## 2. Product Manifest

This change adds no product capability. It improves failure evidence for the existing production smoke gate by:

- recording sanitized app network status metadata for the smoke browser session;
- surfacing `/api/tenant/context` status/path evidence when a route remains stuck before expected content renders;
- uploading Playwright artifacts from the production smoke job for RCA.
- keeping Playwright E2E specs out of the direct Jest changed-test runner.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `.github/workflows/deploy-production.yml` | Platform/CI Governance | Production workflow artifact collection |
| `e2e/tests/12-authenticated-core-routes-smoke.spec.ts` | Production Ops Evidence | Read-only browser smoke diagnostics |
| `scripts/test-changed-files.mjs` | CI Governance | Changed-file Jest routing only |

## 4. Contract Dependency Map

```text
Deploy to Production workflow
        ↓
Exact preview
        ↓
Real-auth Playwright smoke
        ↓
Sanitized browser network evidence
        ↓
RCA for first failing production gate
```

No Product -> Contract -> Kernel path is modified.

## 5. Change Authority

Authorized by Production Ops Go-Live audit boundary. The change is limited to evidence collection for the current production smoke blocker.

## 6. UI -> Contract Reconciliation

Not applicable. No UI behavior, route content, or user-facing component is changed.

## 7. Additive Migration Plan

No migration. No schema change. No production data mutation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Healthcare, Education, Logistics, Finance, or Product runtime code changed.
- Gate 2 Contract Boundary: production smoke remains real-auth and read-only.
- Gate 3 Tenant Isolation: no tenant query or policy change.
- Gate 4 Permission: no auth bypass or credential change.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: not applicable.
- Gate 7 Business Flow: not modified.
- Gate 8 Runtime Evidence: exact preview smoke gets sanitized network diagnostics.
- Gate 9 Secret Hygiene: diagnostics exclude headers, cookies, tokens, and secrets.
- Gate 10 CI Governance: artifacts retained for failed smoke RCA.
- Gate 11 Regression: run targeted lint/typecheck/diff checks.

---

# Additional Architecture Gate - Tenant Context Route Session Resolution

> **Status:** PASS - minimal runtime fix authorized
> **Date:** 2026-10-04
> **Scope:** `/api/tenant/context` production smoke authentication blocker

## 1. Bella OS/Product Development Process Gate

Truth: production workflow run `37192393312` passed immutable config, lint, critical tests, security, migration, build, exact preview deploy, and exact preview health, then failed in `Smoke Exact Preview` because `/api/tenant/context` returned `401` while `/dashboard` loaded as an authenticated document.

Source of Truth: GitHub Actions smoke artifact `production-smoke-artifacts`, sanitized Playwright network evidence, and the Supabase SSR cookie contract.

Canonical Contract: `/api/tenant/context` must resolve a verified Supabase Auth user from the request session and then read that user's tenant profile. It must not bypass authentication, hard-code tenant/user identity, or convert health/auth smoke into a fake PASS.

Ownership: `src/app/api/tenant/context/route.ts` owns the tenant-context API route session resolution. Supabase Auth remains the authentication source of truth. `public.users.tenant_id` remains the tenant ownership source.

Boundary: route-handler session handling only. No English business logic, tenant model, schema, migration, credential, middleware redesign, or broad auth abstraction is changed.

## 2. Product Manifest

This change adds no product capability. It restores the existing tenant context route's ability to read production Supabase SSR auth cookies, including chunked cookies.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `src/app/api/tenant/context/route.ts` | Platform tenant context API | Authenticated user -> tenant context read |
| `src/__tests__/api-tenant-context.test.ts` | Route regression coverage | Unauthenticated and authenticated cookie/session paths |

## 4. Contract Dependency Map

```text
Browser Supabase Auth cookie
        ↓
Supabase SSR Route Handler client
        ↓
Verified auth user
        ↓
public.users.tenant_id
        ↓
public.tenants
        ↓
TenantContext response
```

No Product -> Education Kernel contract is modified.

## 5. Change Authority

Authorized by Production Smoke RCA for a hẹp runtime blocker: valid authenticated production session reaches `/api/tenant/context` as `401`. The allowed change is limited to session/cookie resolution in the route handler.

## 6. UI -> Contract Reconciliation

Not applicable. No UI behavior or visual contract changes.

## 7. Additive Migration Plan

No migration. No schema change. No production data mutation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Healthcare, Logistics, Finance, or Education Kernel files changed.
- Gate 2 Contract Boundary: route continues to require verified Supabase Auth user.
- Gate 3 Tenant Isolation: tenant context still derives from authenticated user's `tenant_id`.
- Gate 4 Permission: unauthenticated request must remain `401`.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: not applicable.
- Gate 7 Business Flow: English business logic not modified.
- Gate 8 Runtime Evidence: production smoke should move past `/api/tenant/context 401`.
- Gate 9 Secret Hygiene: no credential logging or fixture secrets.
- Gate 10 CI Governance: targeted route test, lint, typecheck, architecture, security.
- Gate 11 Regression: production workflow remains final authority after merge.

---

# Additional Architecture Gate - Preschool Critical Flow Audit

> **Status:** PASS for authorized product/API/service fixes; Real DB and browser E2E remain NOT_PROVEN
> **Date:** 2026-10-06
> **Scope:** Preschool critical user journey audit after Chain implementation seal

## 1. Bella OS/Product Development Process Gate

Truth: Preschool Chain implementation is complete but Go-Live proof is not complete without Real DB/UI E2E. The follow-up scope is the non-Chain Preschool critical flow audit: Student/Admission, Branch/Chain assignment, Class, Enrollment, Attendance, Tuition/Payment, Parent/Guardian, and Reporting.

Source of Truth: existing Education product routes, product services, public Education contracts, canonical `edu_*`, `party_*`, `org_units`, `user_org_unit_access`, and `edu_fin_*` tables.

Canonical Contract: Product UI/API must route through Bella Education product services or existing public contracts, preserve tenant isolation, derive tenant/user authority server-side, and read back from canonical persistence. Mock/static UI data cannot prove runtime product readiness.

Ownership: Preschool product/API layers own UI orchestration and route authorization. Education contracts/kernel own canonical student/enrollment/course/attendance persistence and remain frozen. Platform Org Unit remains the Branch/Chain registration authority.

Boundary: authorized product/API/service fixes only. No Education Kernel modification, no Platform authority change, no frozen Healthcare/Logistics artifacts, no non-additive schema mutation, and no new architecture/framework.

## 2. Product Manifest

No new product capability is introduced. Fixes wire existing Preschool capabilities and screens to already-present product/service/contract paths.

## 3. Ownership Map

| Flow | Owner | Canonical Data |
|---|---|---|
| Student/Admission | Preschool UI/API + Education Student/Enrollment contracts | `party_parties`, `students`, `edu_enrollments` |
| Branch/Chain | Platform Org Unit + Preschool runtime assignment | `org_units`, `user_org_unit_access`, `preschool_chain_*` |
| Class | Preschool API + Education course/teacher contracts | `edu_courses`, projection `courses`, `teacher_assignments` |
| Attendance/Handover | Preschool API + Attendance contract + handover service | `edu_attendance_daily_state`, `edu_preschool_pickup_handover_events` |
| Tuition/Payment | Preschool Finance services/repository | `edu_fin_*` |
| Parent/Guardian | Preschool guardian/parent services | `party_relationships`, `party_identifiers`, `edu_preschool_pickup_authorizations` |
| Reporting | Preschool Analytics service/repository | canonical current snapshot reads across `edu_*`, `edu_fin_*`, `edu_comm_*` |

## 4. Contract Dependency Map

```text
Preschool UI
  -> Product API route
  -> Existing Product service / Education public contract
  -> Canonical DB tables
  -> Product read-back API
  -> UI read-back
```

## 5. Change Authority

Authorized changes are limited to product UI/API/services and tests needed to close true gaps found during the audit. Education kernel and Platform authority boundaries are not modified.

## 6. UI -> Contract Reconciliation

Static/demo Preschool UI surfaces were reconciled to canonical APIs where they affected critical read-back: enrollment registry, class list, attendance/handover authorization, parent daily access, and reporting current KPIs.

## 7. Additive Migration Plan

No new migration in this continuation. Existing Preschool Chain migration remains part of the prior Chain implementation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Education Kernel, Healthcare Kernel, or Logistics sealed files modified.
- Gate 2 Contract Boundary: product routes call existing product services/contracts.
- Gate 3 Tenant Isolation: API routes derive tenant from authenticated user or existing context.
- Gate 4 Authorization: attendance/handover, finance, parent, and analytics role boundaries are covered.
- Gate 5 Database Migration Safety: no continuation migration.
- Gate 6 Event-After-Persistence: enrollment evidence remains contract/engine-owned.
- Gate 7 Business Flow: focused tests cover route/service GAPs.
- Gate 8 Real DB Evidence: BLOCKED/NOT_PROVEN without environment.
- Gate 9 Secret Hygiene: no credential or secret output.
- Gate 10 CI Governance: focused tests, typecheck, lint, education gates, diff check.
- Gate 11 Regression: browser UI E2E remains NOT_PROVEN until environment is available.

---

# Additional Architecture Gate - Tenant Context Raw Cookie Header Fallback

> **Status:** PASS - route-only follow-up authorized
> **Date:** 2026-10-04
> **Scope:** `/api/tenant/context` production smoke authentication blocker follow-up

## 1. Bella OS/Product Development Process Gate

Truth: production workflow run `37198145961` deployed merge SHA `9bd313b8c9398788234f2cc8ef182f012c1e922f`; validate/build/preview health passed, but `Smoke Exact Preview` still failed with `/api/tenant/context` returning `401`. Sanitized trace evidence shows the request includes a Supabase Auth cookie named `sb-lvnvkpyxtuilhrabtlwv-auth-token`; decoded JWT metadata confirms the token is unexpired, `aud=authenticated`, `role=authenticated`, and issued by the matching Supabase project. The blocker is therefore narrower than credential, cookie-domain, or English business logic.

Source of Truth: GitHub Actions smoke artifact `production-smoke-artifacts` from run `37198145961`, sanitized Playwright trace network headers, and `/api/tenant/context` route session resolution code.

Canonical Contract: `/api/tenant/context` may only return tenant context after resolving a verified Supabase Auth user. It may read the raw `Cookie` header only as an additional source of the same Supabase Auth cookie already present on the request, then still validate the access token through Supabase Auth.

Ownership: `src/app/api/tenant/context/route.ts` owns this fallback. Supabase Auth remains the authentication source of truth. `public.users.tenant_id` remains the tenant ownership source.

Boundary: route-only cookie candidate resolution. No provider change, middleware redesign, schema/migration, credential, tenant model, permission redesign, English business logic, or auth bypass.

## 2. Product Manifest

No product capability is added. This follow-up hardens existing production Route Handler session resolution when `Cookie` is present in the HTTP request but the route cookie abstraction does not expose the auth cookie.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `src/app/api/tenant/context/route.ts` | Platform tenant context API | Raw Cookie header fallback to verified Supabase Auth user |
| `src/__tests__/api-tenant-context.test.ts` | Route regression coverage | Header-present/cookie-abstraction-empty authenticated request |

## 4. Contract Dependency Map

```text
HTTP Cookie header
        ↓
Supabase auth cookie candidate
        ↓
Decoded access token
        ↓
Supabase auth.getUser(accessToken)
        ↓
public.users.tenant_id
        ↓
TenantContext response
```

No Product -> Education Kernel contract is modified.

## 5. Change Authority

Authorized by production smoke RCA after the first route session fix merged cleanly but the same production 401 remained. The new evidence shows the auth cookie is present in the browser request; the minimal permitted change is to read that raw request header as a fallback and still verify the token through Supabase.

## 6. UI -> Contract Reconciliation

Not applicable. No UI behavior or visual contract changes.

## 7. Additive Migration Plan

No migration. No schema change. No production data mutation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Healthcare, Logistics, Finance, or Education Kernel files changed.
- Gate 2 Contract Boundary: route still requires Supabase Auth verification.
- Gate 3 Tenant Isolation: tenant context still derives from authenticated user's `tenant_id`.
- Gate 4 Permission: unauthenticated request must remain `401`.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: not applicable.
- Gate 7 Business Flow: English business logic not modified.
- Gate 8 Runtime Evidence: production smoke should move past `/api/tenant/context 401`.
- Gate 9 Secret Hygiene: no credential, cookie, or token value logging.
- Gate 10 CI Governance: targeted route test, lint, typecheck, architecture, security.
- Gate 11 Regression: production workflow remains final authority after merge.

---

# Additional Architecture Gate - Supabase Server Client Public Env Contract

> **Status:** PASS - runtime client follow-up authorized
> **Date:** 2026-10-04
> **Scope:** Dashboard production smoke server-action authentication blocker

## 1. Bella OS/Product Development Process Gate

Truth: production workflow run `37208465631` deployed merge SHA `fec5eb0110833cd50e9c00010159849f446e54e7`; validate/build immutable preview passed, `/api/tenant/context` returned `200`, and `X-Environment` was `production`. The remaining blocker is `Smoke Exact Preview`, where the dashboard layout server-action sequence returned one `/dashboard` POST `200` followed by one `/dashboard` POST `500` with React Server Component digest `2492357065`.

Source of Truth: GitHub Actions run `37208465631`, sanitized Playwright trace artifact `production-smoke-artifacts`, dashboard layout client chunk mapping, and `src/lib/supabase-server.ts`.

Canonical Contract: server-side Supabase clients must use the shared public environment contract: `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` fallback. Runtime auth must continue to validate the Supabase session through Supabase Auth; no mock, bypass, hard-coded user, or credential fallback is allowed.

Ownership: `src/lib/supabase-server.ts` owns the server-side SSR Supabase client. `src/lib/supabase-public-env.ts` owns public Supabase environment resolution. `src/services/user-actions.ts` consumes the server client but does not own environment resolution.

Boundary: shared runtime client environment resolution only. No English business code, schema/migration, production data mutation, credential logging, auth bypass, tenant model, or dashboard UX redesign.

## 2. Product Manifest

No product capability is added. This change aligns the server-action auth path with the existing production public-env contract already used by browser and tenant-context code.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `src/lib/supabase-server.ts` | Platform runtime Supabase SSR client | Server-side Supabase URL/key resolution and cookie-bound auth client |
| `src/lib/supabase-public-env.ts` | Platform env contract | Canonical public URL/key fallback logic |
| `src/__tests__/supabase-server-env.test.ts` | Runtime env regression coverage | Server SSR client must work when only publishable key is configured |

## 4. Contract Dependency Map

```text
DashboardLayout client
        ↓
getCurrentUser server action
        ↓
createClient() / Supabase SSR client
        ↓
Canonical public env contract
        ↓
Supabase auth.getUser()
        ↓
public.users.tenant_id
```

No Product -> Education Kernel contract is modified.

## 5. Change Authority

Authorized by production smoke RCA after tenant-context moved from `401` to `200` and the first failing runtime boundary became dashboard server-action auth. The minimal permitted change is to reuse the shared public Supabase env resolver in the server client.

## 6. UI -> Contract Reconciliation

Not applicable. No UI behavior or visual contract changes.

## 7. Additive Migration Plan

No migration. No schema change. No production data mutation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Healthcare, Logistics, Finance, or Education Kernel files changed.
- Gate 2 Contract Boundary: runtime continues to require verified Supabase Auth session.
- Gate 3 Tenant Isolation: current user still derives `tenant_id` from `public.users`.
- Gate 4 Permission: unauthenticated behavior remains login redirect / unauthorized.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: not applicable.
- Gate 7 Business Flow: English business logic not modified.
- Gate 8 Runtime Evidence: production smoke should move past `/dashboard` server-action auth 500.
- Gate 9 Secret Hygiene: no credential, cookie, or token value logging.
- Gate 10 CI Governance: targeted auth test, lint, typecheck, architecture, security.
- Gate 11 Regression: production workflow remains final authority after merge.

---

# Additional Architecture Gate - Preschool Chain Real DB Evidence Harness

> **Status:** PASS for harness integration; BLOCKED for real DB execution evidence
> **Date:** 2026-10-06
> **Scope:** Bella Preschool Chain proof wiring only

## 1. Bella OS/Product Development Process Gate

Truth: Preschool Chain runtime implementation is locally proven, but Go-Live proof still requires a real database run. The canonical real DB evidence path in this repository is `jest.real-db.config.ts` plus `jest.real-db.setup.ts`, which fails on missing or mock Supabase credentials.

Source of Truth: existing real DB Jest config/setup, existing Haircut/Nail and Beauty real DB tests, Preschool enrollment route, Education contracts, Platform Org Unit, and the additive Preschool Chain migration.

Canonical Contract: Preschool uses Platform `org_units` branches as the registration/management authority and product-owned `preschool_chain_*` assignment tables for runtime course/enrollment branch assignment. The proof must run through the existing real DB Jest lane; no new DB E2E framework is introduced.

Ownership: Platform owns `org_units` and `org_relationships`; Education Kernel owns `edu_courses` and `edu_enrollments`; Bella Education product owns Preschool Chain assignment persistence and admission UI/API consumption.

Boundary: test harness and evidence integration only. No runtime Chain logic, Education Kernel, Platform Org Unit, Healthcare, Logistics, Finance, or shared Core code changed.

## 2. Product Manifest

No new product capability is added. This work adds real DB proof coverage for the existing Preschool admission/enrollment/branch assignment capability.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `jest.real-db.config.ts` | CI evidence lane | Canonical allowlist for real DB E2E suites |
| `src/products/bella-education/__tests__/preschool-chain-real-db.test.ts` | Bella Education product test | Real DB proof of Preschool branch assignment chain |
| `supabase/migrations/20261006010000_preschool_chain_assignments.sql` | Bella Education product schema | Product-owned additive Preschool Chain tables |

## 4. Contract Dependency Map

```text
Preschool admission route
        ↓
Student / Enrollment public contracts
        ↓
edu_enrollments
        ↓
PreschoolChainService
        ↓
Platform org_units / org_relationships
        ↓
preschool_chain_course_branch_assignments
        ↓
preschool_chain_enrollment_branch_assignments
        ↓
service read-back / tenant isolation / branch authorization / idempotent retry
```

## 5. Change Authority

Authorized by the request to complete Preschool Chain evidence execution, specifically by reusing the existing canonical real DB workflow and not continuing runtime Chain feature work.

## 6. UI -> Contract Reconciliation

No UI changes. Existing local route/UI tests cover branch selection and admission response. Real DB proof is added at API/service/database boundary because current local environment does not provide browser-authenticated real DB credentials.

## 7. Additive Migration Plan

No new migration in this step. The real DB test verifies the existing additive Preschool Chain migration tables, RLS enablement, and tenant-isolation policies are present in the target database.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Education Kernel or Platform runtime change.
- Gate 2 Contract Boundary: route still uses Student/Enrollment contracts and Platform Org Unit contract.
- Gate 3 Tenant Isolation: test verifies tenant-scoped read-back and cross-tenant null read.
- Gate 4 Authorization: test verifies only assigned branch is accessible and another branch is denied.
- Gate 5 Database Migration Safety: test checks real DB tables/RLS/policies from the additive migration.
- Gate 6 Event-After-Persistence: not changed in this evidence step.
- Gate 7 Academic Safety Routing: not applicable to branch assignment.
- Gate 8 Runtime Evidence: `npx jest --config jest.real-db.config.ts src/products/bella-education/__tests__/preschool-chain-real-db.test.ts --runInBand`.
- Gate 9 Secret Hygiene: test reads env only through existing Supabase env helpers; no secrets logged.
- Gate 10 CI Governance: targeted lint, typecheck, no-new-debt, architecture baseline.
- Gate 11 Regression: existing Preschool Chain local route/service tests remain passing.

## 9. Current Evidence

```ini
REAL_DB_E2E = BLOCKED
Reason = jest.real-db.setup.ts detected mock Supabase credentials
Observed = NEXT_PUBLIC_SUPABASE_URL=mock.supabase.co, SUPABASE_SERVICE_ROLE_KEY=mock-service-role-key
```

---

# Additional Architecture Gate - Legacy BabyCare KTV Branchless Attendance

> **Status:** PASS
> **Date:** 2026-10-06
> **Scope:** KTV daily attendance branch resolution for legacy `bella_babycare` tenants only.

## 1. Bella OS/Product Development Process Gate

Truth: BabyCare legacy tenant identity is `tenants.product_key = 'bella_babycare'`. The legacy Bella Spa BabyCare runtime is not registered as a Platform branch/chain tenant, so KTV shift attendance must not require `people_directory -> org_relationships -> org_units` branch proof when no branch is selected.

Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, `src/platform/registry/product-registry.ts`, `src/services/attendance-actions.ts`, and the user-provided KTV UI error showing branch resolution failure before check-in.

Canonical Contract: Product identity comes from `tenant.product_key -> ProductRegistry`. Branch-aware attendance remains required for branch-platform Beauty products; legacy BabyCare attendance remains tenant-scoped and branchless.

Ownership: Product Registry owns product identity. Attendance actions own KTV check-in/check-out mutation behavior. Platform branch registration owns branch membership and must not be retrofitted onto legacy BabyCare for this fix.

Boundary: no migration, no HQ tenant registration mutation, no Product Registry change, no Healthcare/Education/Logistics kernel change, and no payroll recalculation change.

## 2. Product Manifest

| Product | Product key | Attendance branch requirement |
|---|---|---|
| Bella Mommy Baby Care legacy | `bella_babycare` | Branchless tenant-scoped attendance allowed |
| Bella Beauty Spa v2 / Haircut / Nail | `bella_spa`, `bella_haircut`, `bella_nail` | Platform branch proof required |

## 3. Ownership Map

| Artifact | Owner | Role |
|---|---|---|
| `src/services/attendance-actions.ts` | Attendance workflow | KTV daily attendance read/write |
| `src/services/beauty-branch-context.ts` | Beauty branch context | Branch proof for branch-aware products |
| `src/__tests__/attendance-actions.test.ts` | Regression test | Proves BabyCare branchless exception and preserves branch-aware guard |

## 4. Contract Dependency Map

```text
KTV check-in
  -> current user tenant_id
  -> tenants.product_key
  -> bella_babycare legacy branchless exception OR Platform branch resolver
  -> attendance insert/update
```

## 5. Change Authority

The user reported KTV check-in failure after HQ tenant registration management changed, and clarified this BabyCare is legacy Bella Spa BabyCare, not registered under Platform. This authorizes only the BabyCare legacy attendance branch-resolution correction.

## 6. UI -> Contract Reconciliation

| UI symptom | Contract | Result |
|---|---|---|
| KTV screen shows "Không xác định được chi nhánh chấm công của KTV" | Legacy BabyCare does not have Platform branch registration | `STALE CONSUMER` |
| KTV "Đầu ca: CHECK-IN" | Tenant-scoped attendance is enough for BabyCare | `MATCH AFTER FIX` |

## 7. Additive Migration Plan

No migration. Existing `attendance.branch_id` remains nullable for legacy rows. No production data mutation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Healthcare, Logistics, Finance, or Education Kernel files changed.
- Gate 2 Contract Boundary: product identity read uses `tenants.product_key`, not `enabled_modules`.
- Gate 3 Tenant Isolation: attendance insert still writes and filters by `tenant_id`.
- Gate 4 Permission: only authenticated KTV users can check in/out.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: no new event behavior.
- Gate 7 Audit: audit log remains after attendance persistence.
- Gate 8 UI Contract: BabyCare KTV check-in no longer depends on Platform branch registration.
- Gate 9 Secret Hygiene: no credential or environment value touched.
- Gate 10 Targeted Regression: `attendance-actions.test.ts` covers legacy BabyCare branchless check-in.
- Gate 11 Type Safety: run targeted Jest and TypeScript/type-focused verification as available.

---

# Additional Architecture Gate - HQ Admin Dashboard Product Shell Denial

> **Status:** PASS
> **Date:** 2026-10-06
> **Scope:** Prevent HQ-only admin accounts from entering `/dashboard` product shells.

## 1. Bella OS/Product Development Process Gate

Truth: HQ identity is `tenants.product_key = 'bella_hq'`. HQ users are administrative system users for `/hq`, not product users for `/dashboard` vertical runtimes.

Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, `src/lib/business-rules/hq-tenant.ts`, `src/services/hq-actions.ts`, `src/app/hq/login/hq-login-client.tsx`, and the reported UI evidence showing `Bella HQ Admin` inside the Beauty/Spa dashboard shell.

Canonical Contract: Product identity comes from `tenant.product_key`. `bella_hq` must route to `/hq` and must not be rendered by dashboard product shell consumers.

Ownership: HQ auth boundary owns HQ authorization. Dashboard layout owns product-shell admission. Product verticals own their own runtime views but do not own HQ identity.

Boundary: no schema change, no data mutation, no Product Registry change, no Healthcare/Education/Logistics kernel change, no HQ feature expansion, and no Beauty UI redesign.

## 2. Product Manifest

No product capability is added. This is a route-boundary correction for the existing HQ administrative tenant.

## 3. Ownership Map

| Artifact | Owner | Role |
|---|---|---|
| `src/lib/business-rules/hq-tenant.ts` | HQ business rule | Canonical `bella_hq` predicate |
| `src/app/dashboard/layout.tsx` | Dashboard product shell | Deny HQ tenant from product shell |
| `src/__tests__/tenant-isolation-source-guards.test.ts` | Source guard regression | Proves dashboard shell redirects HQ tenant to `/hq` |

## 4. Contract Dependency Map

```text
DashboardLayout
  -> getCachedCurrentUser()
  -> getCachedTenantSettings()
  -> tenants.product_key
  -> isHqTenant()
  -> /hq redirect before product shell authorization
```

## 5. Change Authority

The user reported that HQ admin is being assigned/rendered as Bella Spa and clarified the account is HQ-only, not a product login. This authorizes dashboard route-boundary correction only.

## 6. UI -> Contract Reconciliation

| UI symptom | Contract | Result |
|---|---|---|
| `Bella HQ Admin` appears in `/dashboard` Beauty/Spa shell | `bella_hq` users belong in `/hq` only | `STALE CONSUMER` |
| Generic `/login` sends successful users to `/dashboard` | Dashboard shell must enforce tenant product boundary | `GUARD REQUIRED` |

## 7. Additive Migration Plan

No migration. No production data mutation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Healthcare, Logistics, Finance, or Education Kernel files changed.
- Gate 2 Contract Boundary: use `isHqTenant()` and `tenant.product_key`, not tenant name or enabled modules.
- Gate 3 Tenant Isolation: dashboard shell no longer renders HQ tenant product UI.
- Gate 4 Permission: existing `/hq` auth remains enforced by `checkHqAuth()`.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: not applicable.
- Gate 7 Audit: no mutation, no audit event.
- Gate 8 UI Contract: HQ users redirect to `/hq` before dashboard shell authorization.
- Gate 9 Secret Hygiene: no credentials touched.
- Gate 10 Targeted Regression: static source guard for dashboard HQ redirect.
- Gate 11 Type Safety: run targeted Jest and type-focused verification as available.

---

## Additional Architecture Gate - Timeline KTV Presentation Alignment

> **Status:** PASS
> **Date:** 2026-10-06
> **Scope:** Presentation Layer (`TimelineKtvView.tsx`) - synchronize timeline grid slot heights, card positioning, card height, and live current-time line position.

### 1. Bella OS/Product Development Process Gate
- **Constitution:** Bella AI Coding Constitution (`docs/governance/BELLA_AI_CODING_CONSTITUTION.md`) read before source modification.
- **Truth / Evidence:** Timeline cards used time-derived positioning that no longer matched the visible row height, causing misalignment in the daily KTV schedule view.
- **Source of Truth:** `TimelineSession` read DTO plus the existing timeline UI layout contract.
- **Canonical Contract:** Presentation layer reads `assigned_time` / `preferred_time` and renders it without changing booking/session persistence.
- **Gate Result:** `PASS`.

### 2. Product Manifest
- **Product:** Bella Spa ERP (`/dashboard/bookings` timeline view).
- **Capability:** Daily schedule timeline visualization.
- **Scope:** UI-only alignment for row height, card top offset, card height, and current-time line.

### 3. Ownership Map
- **Data Owner:** Beauty OS / Bella Spa booking and session services.
- **UI Owner:** `src/app/dashboard/sessions/components/TimelineKtvView.tsx`.

### 4. Contract Dependency Map
`Product UI (TimelineKtvView)` -> `TimelineSession DTO` -> read-only booking/session data.

### 5. Change Authority
- Authorized layer: presentation layer only.
- Not authorized and not modified: database schema, service contracts, Product Registry, Healthcare H1-H12, Logistics E7.

### 6. UI -> Contract Reconciliation
| UI Element | UI Expectation | Canonical Contract | Conclusion |
|---|---|---|---|
| Card time offset | Card `top` matches assigned/preferred time | `TimelineSession.assigned_time` / `bookings.preferred_time` | `MATCH` |
| Timeline row height | Spacious 30-minute rows | UI layout constant | `UI FIX` |
| Card height | Session card fits standard care duration | Presentation math only | `UI FIX` |
| Live time line | Current-time indicator follows live clock | `currentTimeStr` | `UI FIX` |

### 7. Additive Migration Plan
No migration.

### 8. 11 Automated Verification Gates Plan
1. Verify no data/API/schema contract changes.
2. Verify row height and card offset use the same slot scale.
3. Verify card height does not overflow compact content.
4. Verify current-time line uses the same time scale.
5. Verify text remains truncated inside card bounds.
6. Verify no Healthcare/Logistics frozen files touched.
7. Verify `git diff --check`.
8. Verify targeted lint where available.
9. Verify booking/session DTO access remains read-only.
10. Verify merge conflict markers absent.
11. Verify final PR checks after push.

### Conclusion
`PASS`

---

## 2026-10-07 English Center Residual Go-Live Boundary Gate

### 1. Bella OS/Product Development Process Gate
- Constitution read before source modification: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`.
- Education constitution read because Bella English Center is an Education product vertical boundary.
- PR #244 baseline evidence is preserved: English Center marker-scoped Post-RC operational Real DB and Browser E2E are already recorded above and must not be rebuilt.
- Current root cause found by read-only audit: HQ onboarding allowlists omit `bella_english_center` while Product Registry already contains that canonical product key.
- Gate result for code change: `PASS_FOR_HQ_ONBOARDING_GAP_FIX`.
- Gate result for production/customer/backup/legal posting seal: `NOT_PROVEN_UNTIL_EXECUTED_EVIDENCE`.

### 2. Product Manifest
- Product: `bella_english_center`.
- Existing proven scope: product identity, schema/RLS, marker-scoped Real DB tenant runtime, branch access, operational seed, and Post-RC Browser E2E.
- Residual authorized capability: HQ can create/select an English Center tenant/branch using the same onboarding contract used for other product tenants.
- Non-goals: no English operational chain rebuild, no Education Kernel change, no Finance legal-accounting policy invention, no production/customer mutation without explicit runtime evidence.

### 3. Ownership Map
- Product identity owner: `ProductRegistry` plus `tenants.product_key`.
- HQ onboarding owner: `src/app/hq/components/HqBranchRegistrationModal.tsx` and `src/services/onboarding-actions.ts`.
- Branch/runtime access owner: `org_units`, `users`, `user_org_unit_access`, and existing HQ/tenant auth contracts.
- English operations owner: `src/products/bella-english-center/**`.
- Finance posting policy owner: Finance contracts and authoritative accounting specifications, not English product code.
- Production integrity owner: deployment/operations evidence, backup/restore drill evidence, and production/staging runtime smoke evidence.

### 4. Contract Dependency Map
`HQ UI product option -> registerNewTenant(input.productKey) -> ProductRegistry.has(productKey) -> PRODUCT_MODULE_MAP -> onboard_tenant -> tenants.product_key -> enabled_modules -> ProductResolver/UserProvider -> /dashboard/english-center -> English operational services -> optional Finance contracts`.

### 5. Change Authority
- Authorized: add `bella_english_center` to HQ onboarding product selection/type map and targeted onboarding tests.
- Authorized: preserve existing module mapping by treating English Center as an Education module tenant (`bella_education`) while keeping product identity as `bella_english_center`.
- Not authorized: modify `src/platform/education/**`, Healthcare H1-H12, Logistics E7 kernels, ProductRegistry semantics, database schema, production data, or accounting legal-source mappings.

### 6. UI -> Contract Reconciliation
| UI / Contract Surface | Expected Product Truth | Current Audit Result | Action |
|---|---|---|---|
| HQ product selector | Offers canonical products including `bella_english_center` | Missing English option | Add option only |
| `registerNewTenant.productKey` | Accepts canonical product key if registered and allowed | Type/map omit English | Add key/map only |
| Tenant module flags | Education products use `bella_education` module flag | Preschool already maps to `bella_education` | Reuse same module flag |
| Product identity | Persist exact `tenants.product_key` | PR #244 proves English identity/runtime fixture | Preserve |

### 7. Additive Migration Plan
No migration. No schema/RLS/grant changes are authorized by this gate.

### 8. 11 Automated Verification Gates Plan
1. Verify HQ UI allowlist includes English Center.
2. Verify server-side `RegisterTenantProductKey` accepts `bella_english_center`.
3. Verify `registerNewTenant` persists `product_key = 'bella_english_center'`.
4. Verify English onboarding enables `bella_education` and not BabyCare/Beauty modules.
5. Verify non-HQ user cannot set up English Center before auth/database writes.
6. Verify BabyCare remains self-service compatible.
7. Verify Beauty/Haircut/Nail/Preschool mappings remain unchanged.
8. Verify ProductRegistry/ProductResolver focused tests still pass.
9. Verify English tuition/finance contract unit tests still pass without invented legal posting.
10. Verify existing English Real DB/Browser evidence is cited but not overclaimed as production/customer proof unless rerun.
11. Verify `git diff --check` and inspect touched files only.

### Conclusion
`PASS_FOR_HQ_ONBOARDING_GAP_FIX`

### Verification Result - 2026-10-07
- `npm test -- src\__tests__\onboarding.test.ts --runInBand`: PASS, 10/10 tests.
- `npm test -- src\platform\registry\__tests__\product-registry.test.ts src\platform\registry\__tests__\product-resolver.test.ts --runInBand`: PASS, 73/73 tests.
- `npm test -- src\products\bella-english-center\__tests__\tuition-billing.service.test.ts --runInBand`: PASS, 8/8 tests.
- `npm run typecheck:changed`: PASS, full TypeScript scope passed with zero diagnostics.
- `git diff --check`: PASS.
- Changed-file `any` scan: PASS; no `as any`/explicit-any introduced in touched source/test files.
- `npm run check:any-types`: NOT_PROVEN for repo-wide gate because existing baseline reports 91 violations in 21 unrelated files; no touched file is in the report.
- `E2E_ENV_FILE=<secure local .env.e2e> npm run test:english-center-post-rc-real-db`: PASS against canonical project `bmnbqbcdbuklhopfbopv`.
- `E2E_TENANT_PRODUCT_KEY=bella_english_center E2E_PORT=3110 E2E_REUSE_SERVER=0 npm run e2e:english-center-post-rc`: PASS, 2/2 Playwright tests, after installing real worktree dependencies instead of using an out-of-root `node_modules` junction.
- HQ runtime precondition audit: canonical E2E DB has 1 `bella_english_center` tenant and 0 `bella_hq` tenants. Because `checkHqAuth()` authorizes only `product_key = 'bella_hq'`, the live HQ -> register English tenant flow remains NOT_PROVEN without creating a new HQ fixture. No HQ fixture was created in this workstream.
- Production/customer runtime, backup/restore, and legal accounting posting seal: NOT_PROVEN in this workstream; no blocker is proven for the current English decision, and no English-specific scope expansion is authorized without executable evidence.

### HQ Runtime Residual Gate - 2026-10-07
- **Problem:** The only remaining English Center boundary is `HQ RUNTIME = NOT_PROVEN`.
- **Truth / Evidence:** Canonical E2E DB has no `bella_hq` tenant, while `checkHqAuth()` requires an admin user whose tenant has `product_key = 'bella_hq'`.
- **Root Cause:** This is an evidence fixture gap first. Read-only code audit also shows `registerNewTenant()` persists `tenants.product_key` after `onboard_tenant()`, but the base onboarding RPC does not create Platform `org_units`. English Center branch identity and branch RLS depend on `org_units` and `user_org_unit_access`.
- **Authorized Minimal Change:** Add only the runtime proof surface needed for HQ -> English Center onboarding: a focused Playwright E2E with an HQ fixture, and a default branch bootstrap inside existing HQ onboarding using existing `org_units` schema. No registry, product architecture, Finance, backup/restore, Healthcare, Logistics, or Education kernel change is authorized.
- **Verification Plan:** Run focused onboarding unit tests, focused HQ runtime Playwright E2E, changed-file typecheck, and diff whitespace checks. Do not rerun or reopen the already proven English browser E2E unless this focused flow depends on it.
- **Verification Result:**
  - `npm test -- src\__tests__\onboarding.test.ts --runInBand`: PASS, 11/11 tests.
  - `E2E_ENV_FILE=<secure local .env.e2e> E2E_PORT=3112 E2E_REUSE_SERVER=0 npx playwright test e2e/tests/32-english-center-hq-runtime.spec.ts`: PASS, 1/1 test.
  - Runtime proof covered HQ dev-bypass login through canonical `bella_hq` fixture, selecting `English Center`, creating the tenant through the actual HQ modal/server action, persisting `tenant.product_key = 'bella_english_center'`, creating default Platform branch `org_units(code='MAIN')`, authenticating the created English admin with Supabase Auth, reading `user_org_unit_access` as `tenant_admin`, and opening `/dashboard/english-center/command-center` with HTTP 200.
  - `npm run typecheck:changed`: PASS, full TypeScript scope passed with zero diagnostics.
  - `git diff --check`: PASS.
  - Changed-file `any` scan: PASS; no `as any`/explicit-any introduced in touched source/test files.
- **Conclusion:** `HQ_RUNTIME_PROVEN_FOR_ENGLISH_CENTER`


---

## 2026-10-07 PR #244 CI Security Dependency Gate

### 1. Bella OS/Product Development Process Gate
- **Problem:** PR #244 CI failed at `Trivy filesystem` and `Security Gates`.
- **Truth / Evidence:** Trivy reported fixable high/critical advisories in lockfiles only: `sharp@0.35.4`, `source-map-js@1.2.1`, `@modelcontextprotocol/sdk@1.29.0`, `proxy-addr@2.0.7`, `compression@1.8.1`, and `shell-quote@1.10.0`.
- **Root Cause:** Dependency security drift in root and `mcp-server` lockfiles; not an English Center product/runtime regression.
- **Gate Result:** `PASS`.

### 2. Product Manifest
- **Product:** None.
- **Capability:** CI security dependency gate remediation.
- **Scope:** `package.json`, `package-lock.json`, `mcp-server/package.json`, `mcp-server/package-lock.json`, `apps/mobile/package.json`, and `apps/mobile/package-lock.json`.
- **Non-goals:** No English product code, no tenant data, no migration SQL, no production/customer DB mutation.

### 3. Ownership Map
- **Owner:** Repository dependency governance.
- **Data Owner:** N/A.

### 4. Contract Dependency Map
`CI Security Gate` -> `npm audit --omit=dev` / Trivy filesystem scan -> npm lockfiles.

### 5. Change Authority
- Authorized layers: dependency metadata and lockfiles required to unblock CI security scan.
- Not authorized and not modified: Platform Core, Education runtime, Product Registry, tenant bootstrap data, Healthcare H1-H12, Logistics E7.

### 6. UI -> Contract Reconciliation
No UI change.

### 7. Additive Migration Plan
No migration.

### 8. 11 Automated Verification Gates Plan
1. Inspect failed PR check names.
2. Inspect Trivy failure log.
3. Identify direct vulnerable packages and fixed versions.
4. Confirm dependency paths from root and `mcp-server` lockfiles.
5. Apply minimal dependency override/package metadata changes.
6. Regenerate lockfiles using npm.
7. Verify lockfile versions are at or above fixed versions.
8. Run `npm run security:audit`.
9. Run `git diff --check`.
10. Commit and push to PR branch.
11. Wait for refreshed CI security gates.

### Verification
- `package-lock.json`: `sharp=0.35.5`, `source-map-js=1.2.2`, `@modelcontextprotocol/sdk=1.32.1`, `proxy-addr=2.0.8`.
- `mcp-server/package-lock.json`: `@modelcontextprotocol/sdk=1.32.1`, `proxy-addr=2.0.8`.
- `apps/mobile/package-lock.json`: `compression=1.8.2`, `shell-quote=1.12.0`, `source-map-js=1.2.2`.
- `npm run security:audit` -> PASS.
- `git diff --check` -> PASS.

### Conclusion
`PASS`

---

## 2026-10-06 Runtime CSS Scan Gate

### 1. Bella OS/Product Development Process Gate
- **Constitution:** `docs/governance/BELLA_AI_CODING_CONSTITUTION.md` read before source modification.
- **Problem:** Local Next.js dev server loads slowly, hangs, and crashes during Tailwind/PostCSS compilation.
- **Truth / Evidence:** Fresh `.next` rebuild failed with `src/app/globals.css` generated CSS parse error from a corrupted arbitrary utility token `.p-[...]`; repository binary scan evidence showed matching `p-[...]` byte sequences inside tracked binary artifacts such as PNG/APK assets.
- **Source of Truth:** Tailwind v4 source detection contract and observed dev-server compiler output.
- **Canonical Contract:** Tailwind should scan application source files for utility classes, not root-level binary assets, APKs, logs, or generated artifacts.
- **Gate Result:** `PASS`.

### 2. Product Manifest
- **Product:** Bella ERP web app.
- **Capability:** Global CSS / Tailwind utility generation.
- **Scope:** Tooling/presentation build configuration only.
- **Non-goals:** No Product identity change, no UI redesign, no domain/API/schema/auth change.

### 3. Ownership Map
- **Owner:** Shared Web UI / frontend build surface.
- **Runtime Owner:** Next.js + Tailwind CSS build pipeline.

### 4. Contract Dependency Map
`src/app/globals.css` -> Tailwind CSS v4 source detection -> generated utility CSS -> Next.js app layout.

### 5. Change Authority
- Authorized layers: frontend build/style source detection.
- Not authorized and not modified: Platform Core, Product Registry, Beauty OS, Healthcare H1-H12, Logistics E7, database migrations, API contracts.

### 6. UI -> Contract Reconciliation
- No data-bound or action-bound UI element is changed.
- Visual semantics are unchanged; only scanner input scope is corrected.

### 7. Additive Migration Plan
No migration.

### 8. 11 Automated Verification Gates Plan
1. Confirm root cause via dev-server compiler output.
2. Confirm offending class-like tokens appear in non-source binary/tracked artifacts.
3. Apply minimal Tailwind source scope correction.
4. Rebuild local `.next` from clean cache.
5. Verify `/`, `/login`, `/dashboard`, and `/api/tenant/context` respond.
6. Verify dev server remains running after route requests.
7. Verify no Healthcare/Logistics frozen files touched.
8. Verify `git diff --check`.
9. Verify targeted lint where available.
10. Report remaining auth/session warnings separately from CSS compile status.
11. Verify final PR checks after push.

### Conclusion
`PASS`

---

## 2026-10-06 HQ Local Load Gate

### 1. Bella OS/Product Development Process Gate
- **Constitution:** `docs/governance/BELLA_AI_CODING_CONSTITUTION.md` read before source modification.
- **Problem:** `/hq` did not load reliably in local dev. Server log showed `/hq` requests taking 74-76s in application code, with many `hq-actions` per-tenant customer/staff/revenue warnings and Supabase/Cloudflare 522 timeouts.
- **Truth / Evidence:** `src/app/hq/page.tsx` called `checkHqAuth()`, `getHqDashboardStats()`, and `getAllTenants()` sequentially. `getHqDashboardStats()` and `getAllTenants()` each called `checkHqAuth()` again. `getAllTenants()` performed three aggregate queries per tenant.
- **Source of Truth:** HQ server action code and observed dev-server request timings.
- **Canonical Contract:** `/hq` must return HQ dashboard stats plus tenant rows shaped as `HqDashboardStats` and `HqTenantRecord[]`; the UI contract does not require one remote query per tenant.
- **Gate Result:** `PASS`.

### 2. Product Manifest
- **Product:** Bella HQ Portal.
- **Capability:** Read-only HQ dashboard load.
- **Scope:** Server-side read aggregation performance and duplicate-auth removal.
- **Non-goals:** No HQ permissions change, no tenant status mutation change, no schema/API/RLS change, no financial semantics change.

### 3. Ownership Map
- **Owner:** Platform/HQ portal server actions.
- **Data Owners:** Existing `tenants`, `users`, `customers`, `revenue`, `session_logs`, and `bookings` tables.
- **Consumer:** `src/app/hq/page.tsx` and `HqDashboardClient`.

### 4. Contract Dependency Map
`/hq` -> `checkHqAuth()` -> `getHqDashboardPayload()` -> existing Supabase tables -> `HqDashboardClient`.

### 5. Change Authority
- Authorized layers: HQ read action orchestration and route data loading.
- Not authorized and not modified: database schema, Product Registry, Healthcare H1-H12, Logistics E7, write actions, tenant authorization rules.

### 6. UI -> Contract Reconciliation
| UI Element | UI Expectation | Canonical Contract | Backend Reality | Conclusion |
|---|---|---|---|---|
| HQ KPI cards | `HqDashboardStats` | Existing stats shape | Same fields preserved | `MATCH` |
| Branch table counts | `staffCount`, `customerCount`, `revenueSum` | `HqTenantRecord[]` | Same fields populated via bulk read | `MATCH` |

### 7. Additive Migration Plan
No migration.

### 8. 11 Automated Verification Gates Plan
1. Verify `/hq` no longer performs duplicate page-level auth.
2. Verify tenant rows preserve `staffCount/customerCount/revenueSum`.
3. Verify dashboard stats preserve existing fields.
4. Verify unauthenticated behavior remains redirect to `/hq/login`.
5. Verify no write action semantics changed.
6. Verify no Healthcare/Logistics frozen files touched.
7. Verify local `/hq` response timing improves.
8. Verify `/login` and `/dashboard` still respond.
9. Verify targeted HQ action tests.
10. Verify dev server remains running after `/hq`.
11. Classify external Supabase timeout as environment dependency if it recurs.

### Conclusion
`PASS`
# Architecture Gate - BabyCare/Beauty V2 Today Appointment Tabs

> **Status:** PASS - dashboard day query and tab classification only
> **Scope:** Fix the red-marked "Lịch hẹn hôm nay" widget used by BabyCare and Beauty V2 so completed sessions from today's `session_logs` are available to the "Hoàn thành" tab, and scheduled/confirmed sessions are counted consistently as waiting.

## 1. Bella OS/Product Development Process Gate

- Truth: The widget is a read model over tenant-scoped `session_logs` for the selected local day.
- Source of Truth: `session_logs.assigned_date`, `session_logs.status`, nested `bookings`, and the existing `getDashboardPrimaryData -> getUpcomingSessions -> BeautySpaV2DashboardView` consumer chain.
- Canonical Contract: Product dashboard consumes `DashboardSessionViewModel[]` from `getUpcomingSessions(todayDate)`; UI tabs may filter this read model but must not rewrite session lifecycle semantics.
- Gate decision: `PASS` for a narrow read-query/UI classification correction. No Kernel, Platform, Healthcare, Education, Logistics, migration, RLS, or Finance change is authorized.

## 2. Product Manifest

- Products: `bella_babycare` legacy BabyCare dashboard and `bella_spa` Beauty V2 dashboard.
- Capability: Today appointment visibility by status tabs: all, serving, waiting, completed.
- Out of scope: booking completion engine changes, package progress changes, production data mutation, tenant onboarding, branch/chain logic, and any new product table.

## 3. Ownership Map

| Data / Behavior | Owner | Action |
| --- | --- | --- |
| `session_logs.assigned_date` | Booking/session workflow | consume |
| `session_logs.status` | Booking/session workflow | consume |
| Dashboard tab counts and list filtering | Product dashboard UI | correct stale consumer |
| Session completion mutation | Shared order/session completion service | no change |

## 4. Contract Dependency Map

```text
BabyCare / Beauty V2 Dashboard
  -> getDashboardPrimaryData(...)
  -> getUpcomingSessions(todayDate)
  -> tenant-scoped session_logs + nested bookings
  -> UI tab classification
```

## 5. Change Authority

- Authorized: `src/core/services/analytics/dashboard-actions.ts`, `src/app/dashboard/components/BeautySpaV2DashboardView.tsx`, focused regression tests.
- Not authorized: Core session completion behavior, Healthcare/Education kernels, Logistics frozen artifacts, database migrations, or product identity rules.

## 6. UI -> Contract Reconciliation

- UI currently shows a "Hoàn thành" tab, but the data query removed `status = completed` before the UI could filter it.
- UI also labels fallback statuses as waiting but did not count/filter `scheduled` and `confirmed` as waiting.
- Correct reconciliation: keep today's completed rows in the dashboard read model and use a single UI classifier for tab counts, list filtering, and badges.

## 7. Additive Migration Plan

- No migration. No schema change.

## 8. 11 Automated Verification Gates Plan

1. Architecture Compliance: no frozen Healthcare/Education/Logistics files touched.
2. Contract Boundary: dashboard continues to consume existing server action/read model.
3. Tenant Isolation: keep `tenant_id` filter in `getUpcomingSessions`.
4. RLS/Auth: no policy change.
5. Migration Safety: no migration.
6. Event-After-Persistence: no mutation/event path change.
7. Product UI Contract: completed rows can reach completed tab.
8. Status Semantics: scheduled/confirmed/null/pending/waiting count as waiting.
9. Regression Test: focused Jest for dashboard read query.
10. Type/Lint: targeted changed-file checks where feasible.
11. Diff Hygiene: `git diff --check`.

# Architecture Gate Addendum - PR252 Real DB Haircut/Nail Harness Repair

> **Status:** PASS - test harness alignment only
> **Scope:** Repair the required Real Database Business E2E proof for Haircut/Nail branch access after PR252 CI exposed that the fixture did not seed `public.users` or request JWT claims required by the current `user_org_unit_access` RLS contract.

## Ownership / Contract

- Owner: Platform authorization projection `public.user_org_unit_access`.
- Product consumers: Haircut and Nail Real DB proof suite.
- Authorized change: test fixture only in `src/__tests__/haircut-nail-chain-seal-real-db.test.ts`.
- Runtime change: none.
- Migration change: none.
- Frozen Healthcare/Education/Logistics change: none.

## Verification Plan

1. Run focused Real DB suite for `haircut-nail-chain-seal-real-db.test.ts`.
2. Run targeted lint on changed files.
3. Run `npm run typecheck:changed`.
4. Run `git diff --check`.
5. Push PR252 and re-check required GitHub gates.

### Conclusion
`PASS`
# Architecture Gate - Unified Dashboard Dark Theme Viewport Repair (2026-10-08)

> **Status:** PASS - presentation-only dark theme repair for dashboard shell and Beauty Spa V2 dashboard viewport/background consistency.
> **Scope:** Shared dashboard UI theme surface plus Beauty Spa V2 dashboard root class. No schema, DB, RPC, RLS, service, analytics, Healthcare H1-H12, Education Kernel, Logistics Kernel, or Product contract changes.

## 1. Bella OS/Product Development Process Gate

- Problem: dark mode viewport is visually split into two background colors; product cards/sidebar are dark while the page viewport can remain light or mismatched.
- Truth / Source of Truth: UI presentation is owned by `src/components/layout/DashboardLoadingShell.tsx`, `src/app/globals.css`, and product view root classes such as `src/app/dashboard/components/BeautySpaV2DashboardView.tsx`. Product identity and accent colors remain resolved by tenant brand/theme code, not by this repair.
- Canonical Contract: shared UI must use semantic theme tokens; product/tenant may vary accent/sidebar/preset colors, but dark viewport background should be common and continuous.
- Non-goals: no new KPIs, statuses, actions, filters, business workflows, APIs, persistence changes, or tenant authorization changes.

## 2. Product Manifest

| Product / Surface | Capability | Scope |
| --- | --- | --- |
| Shared dashboard shell | Dark viewport background | Use one semantic dark viewport background across dashboard surfaces |
| Beauty Spa V2 dashboard | Dashboard presentation | Consume the shared viewport token while retaining existing data/action bindings |
| Tenant/Product theme | Accent/brand variance | Continue using current tenant brand tokens for primary/accent/sidebar |

## 3. Ownership Map

| Data / UI Element | Owner | Change Authority |
| --- | --- | --- |
| Dashboard viewport background | Shared UI | Authorized |
| Product/tenant accent colors | Tenant brand resolver / Product identity | Consume only, no contract change |
| Dashboard cards and panels | Product UI presentation | Authorized only for visual dark styling |
| KPI/session/inventory/alert data | Existing analytics/services | Not authorized |
| Healthcare/Education kernels | Frozen Kernel owners | Not authorized |

## 4. Contract Dependency Map

```text
Dashboard UI
  -> Shared CSS semantic dark viewport tokens
  -> Tenant brand runtime tokens for accent/sidebar
  -> Existing dashboard data props and actions unchanged
```

No Product -> Contract -> Kernel dependency changes are required.

## 5. Change Authority

Authorized layers: shared dashboard presentation CSS, dashboard shell class names, and Beauty Spa V2 dashboard root presentation class.

Not authorized: database migrations, generated types, ProductRegistry/ProductResolver behavior, analytics service contracts, server actions, Healthcare/Education/Logistics Kernel files.

## 6. UI -> Contract Reconciliation

| UI Element | Contract Trace | Result |
| --- | --- | --- |
| Viewport background | CSS semantic theme token only | MATCH |
| Cards/panels dark surfaces | CSS presentation only | MATCH |
| Tenant/product accent | Existing tenant brand runtime CSS variables | MATCH |
| KPI/session/inventory/alert data | Existing view props | UNCHANGED |
| Buttons/actions | Existing links/callbacks | UNCHANGED |

## 7. Additive Migration Plan

None. This repair must not create or alter database tables, indexes, RPCs, RLS, or generated types.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: confirm only UI/theme files changed.
2. Contract boundary: no Product/Kernel/service contract edits.
3. Tenant isolation: unchanged, no data queries touched.
4. RLS/AuthZ: unchanged.
5. Migration safety: no migrations.
6. Event-after-persistence: unchanged.
7. UI data/action reconciliation: no new data/action-bound UI elements.
8. Type safety: no `any`, casts, or suppressions.
9. Static check: `npm run lint -- --file ...` if supported, otherwise targeted TypeScript/static review.
10. Visual check: inspect dark mode viewport continuity via browser screenshot when local app can run.
11. Regression scope: run relevant focused checks; broader Healthcare/Education/Logistics guards are not required because frozen kernels are untouched.

# Architecture Gate - Beauty Spa Today Appointment Row Redesign (2026-10-08)

> **Status:** PASS - presentation-only redesign for the Today Appointments row layout in the Beauty Spa/BabyCare dashboard card.
> **Scope:** `src/app/dashboard/components/BeautySpaV2DashboardView.tsx` appointment-list markup only. No schema, data fetching, server action, analytics read model, workflow, Healthcare H1-H12, Education Kernel, Logistics Kernel, or Product contract changes.

## 1. Bella OS/Product Development Process Gate

- Problem: the customer/assignee text in the Today Appointments list is visually compressed in light Spa/BabyCare dashboard, making the customer row look broken.
- Truth / Source of Truth: the list already consumes `DashboardSessionViewModel` props from existing dashboard analytics. The defect is presentation layout, not data semantics.
- Canonical Contract: appointment rows may render existing fields (`assigned_time`, customer name, package name, assigned KTV, status) but must not create new fields, statuses, actions, or server behavior.
- Non-goals: no changes to session lifecycle, booking completion, filters, counts, KTV assignment, persistence, or authorization.

## 2. Product Manifest

| Product / Surface | Capability | Scope |
| --- | --- | --- |
| Beauty Spa/BabyCare dashboard | Today appointment card | Redesign row layout for readable customer text |
| Existing dashboard data | Read-only display | Reuse existing `DashboardSessionViewModel` props |

## 3. Ownership Map

| Data / UI Element | Owner | Change Authority |
| --- | --- | --- |
| Appointment row layout | Product UI presentation | Authorized |
| Customer name/package/KTV/status values | Existing dashboard read model | Consume only |
| Row actions and links | Existing UI behavior | Unchanged |
| Session/booking lifecycle | Beauty service/domain layer | Not authorized |

## 4. Contract Dependency Map

```text
BeautySpaV2DashboardView
  -> existing DashboardSessionViewModel props
  -> presentation-only row layout
```

No Product -> Contract -> Kernel dependency changes are required.

## 5. Change Authority

Authorized layers: appointment-list JSX/classes in the product dashboard view.

Not authorized: server actions, analytics services, database schema, ProductRegistry/ProductResolver, tenant/auth/RLS, Healthcare/Education/Logistics Kernel files.

## 6. UI -> Contract Reconciliation

| UI Element | Contract Trace | Result |
| --- | --- | --- |
| Time | `session.assigned_time` | MATCH |
| Customer display name | `session.bookings?.customers?.name_mother` fallback | MATCH |
| Service/package line | `session.bookings?.package_name` fallback | MATCH |
| Assigned KTV line | `session.bookings?.assigned_ktv?.full_name` fallback | MATCH |
| Status badge | existing status helper functions | MATCH |
| More button | existing visual affordance | UNCHANGED |

## 7. Additive Migration Plan

None.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: only product UI presentation file changes.
2. Contract boundary: no read model/service changes.
3. Tenant isolation: unchanged.
4. RLS/AuthZ: unchanged.
5. Migration safety: no migrations.
6. Event-after-persistence: unchanged.
7. UI data/action reconciliation: existing fields/actions only.
8. Type safety: no `any`, casts, or suppressions.
9. Static check: targeted ESLint.
10. Visual check: row layout prevents customer text compression in the highlighted card.
11. Regression scope: no kernel verification required because frozen kernels are untouched.

# Architecture Gate - Bella Premium Dark Theme Color Standardization (2026-10-08)

> **Status:** PASS - presentation-only dark theme color standardization using the requested Premium Navy / Deep Teal / Champagne Gold palette.
> **Scope:** shared dashboard dark tokens, dark-mode dashboard surfaces, sidebar dark-mode hardcoded color cleanup, module-scoped dark presentation overrides, payroll/salary dark contrast surfaces, and Beauty Spa V2 AI Copilot dark colors. No Light Theme preset changes, no schema, DB, RPC, RLS, API, service, analytics, payroll formula/workflow, Healthcare H1-H12, Education Kernel, Logistics Kernel, or Product contract changes.

## 1. Bella OS/Product Development Process Gate

- Problem: current dark theme is inconsistent with the requested color reference; the AI Copilot card still uses a large light lavender surface in dark mode and some global dark colors are older burgundy/gold values.
- Truth / Source of Truth: `src/app/globals.css` owns shared CSS theme tokens and dark overrides; `src/app/dashboard/components/BeautySpaV2DashboardView.tsx` owns the Beauty Spa V2 dashboard presentation markup.
- Canonical Contract: Light Mode remains preset-specific. Dark Mode should consume one shared Bella Premium Dark palette for application background, sidebar, surface, border, foreground, accent, and semantic visual states.
- Non-goals: no new UI structure from the reference image, no new KPIs/statuses/actions, no backend/service/database changes, no ProductRegistry/ProductResolver changes, no tenant/auth/RLS changes.

## 2. Product Manifest

| Product / Surface | Capability | Scope |
| --- | --- | --- |
| Shared dashboard shell | Premium dark palette | Use shared dark tokens for viewport, cards, borders, text, and primary action |
| Sidebar | Premium dark palette | Normalize dark-mode sidebar color independent from light preset identity |
| Module-scoped dark presentation overrides | Premium dark palette | Replace legacy burgundy/espresso dark surfaces with shared dark palette while preserving product/light preset rules |
| Salary/payroll UI surfaces | Premium dark palette | Keep existing data/actions; normalize alert cards, status pills, modals, and salary tables for dark contrast |
| Beauty Spa V2 AI Copilot | Dark-mode card readability | Keep component structure; replace dark-mode light lavender surface with dark premium surface |

## 3. Ownership Map

| Data / UI Element | Owner | Change Authority |
| --- | --- | --- |
| Dark theme color tokens | Shared UI theme CSS | Authorized |
| Beauty dashboard AI card presentation | Product UI presentation | Authorized |
| Sidebar and legacy dark presentation overrides | Shared/Product UI presentation | Authorized |
| Payroll health/modal/table presentation | Product UI presentation | Authorized |
| Light Theme preset colors | Existing tenant brand/theme resolver | Not authorized |
| Dashboard/payroll data, formulas, and actions | Existing analytics/services/actions | Not authorized |
| Healthcare/Education/Logistics kernels | Frozen Kernel owners | Not authorized |

## 4. Contract Dependency Map

```text
Dark Mode Dashboard UI
  -> shared CSS variables in globals.css
  -> existing tenant brand/light preset data attributes remain unchanged
  -> product dashboard JSX consumes dark-mode classes only
```

No Product -> Contract -> Kernel dependency changes are required.

## 5. Change Authority

Authorized layers: shared CSS tokens/dark presentation overrides, sidebar presentation classes, and Beauty Spa V2 dashboard dark-mode classes.

Not authorized: data contracts, APIs, server actions, database schema, migrations, production data, auth/RLS, payroll formulas/workflows, accounting, booking/inventory workflows, Healthcare/Education/Logistics Kernel files, and Light Theme preset values.

## 6. UI -> Contract Reconciliation

| UI Element | Contract Trace | Result |
| --- | --- | --- |
| Dashboard background/surface | CSS semantic dark tokens only | MATCH |
| Sidebar dark mode | CSS semantic dark tokens only | MATCH |
| AI Copilot dark surface | Existing component, presentation classes only | MATCH |
| Payroll health/status panels | Existing payroll props and anomaly data, presentation classes only | MATCH |
| AI alert counts/inventory values | Existing props | UNCHANGED |
| Buttons/actions/links | Existing links/callbacks | UNCHANGED |

## 7. Additive Migration Plan

None. This task must not add or modify database migrations.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: only theme CSS/product presentation file changes.
2. Contract boundary: no service/API/read-model edits.
3. Tenant isolation: unchanged.
4. RLS/AuthZ: unchanged.
5. Migration safety: no migrations.
6. Event-after-persistence: unchanged.
7. UI data/action reconciliation: no new data/action-bound elements.
8. Type safety: no `any`, casts, or suppressions.
9. Contrast check: verify key Premium Dark foreground/background pairs reach WCAG AA where applicable.
10. Static check: targeted ESLint and `git diff --check`.
11. Regression scope: broad kernel/database gates are not required because frozen kernels and persistence are untouched.
---

# Architecture Gate - Beauty Spa Branch Selector PremiumSelect Alignment (2026-10-09)

> **Status:** PASS - product UI consumer alignment with the shared PremiumSelect component.
> **Scope:** `src/components/layout/BeautyRuntimeBranchSelector.tsx` and a backward-compatible `PremiumSelect` accessibility/customization prop. No service, data, schema, RLS, migration, Healthcare H1-H12, Education Kernel, or Logistics Kernel change.

## 1. Bella OS/Product Development Process Gate

- Truth: The current Beauty Spa runtime branch selector renders a native HTML `select`, which produces browser-default dropdown styling.
- Source of truth: `src/components/layout/BeautyRuntimeBranchSelector.tsx` for the branch selector consumer; `src/components/ui/PremiumSelect.tsx` for the system premium select UI contract.
- Canonical contract: Product UI should consume the shared PremiumSelect component for premium select dropdown behavior and styling.
- Ownership: Beauty Spa product shell owns the branch selector consumer; shared UI owns PremiumSelect rendering.
- Boundary: Product UI consumer only. No Platform/Core/Kernel/database changes.
- Minimum change: Replace the native `select` in the branch selector with `PremiumSelect` using the same branch data and selection handler.

## 2. Product Manifest

- Product: Bella Beauty Spa v2 shell.
- Capability: Runtime branch selection for non-customer staff/admin users.
- Scope: Sidebar UI presentation and interaction only.
- Out of scope: Branch authorization, tenant resolution, persistence semantics, DB schema, migrations, server actions, Kernel contracts.

## 3. Ownership Map

- Branch list and active branch data: `beauty-runtime-branch-actions` service contract.
- Runtime branch UI consumer: `BeautyRuntimeBranchSelector`.
- Dropdown visual contract: shared `PremiumSelect`.
- Local storage key: UI carrier only; server actions remain authority for access.

## 4. Contract Dependency Map

`Beauty Spa Product UI -> beauty-runtime-branch-actions public service contract -> existing tenant/branch persistence`

This change does not access lower-layer tables directly and does not introduce a new contract.

## 5. Change Authority

Authorized:
- Beauty Spa sidebar UI consumer.
- Backward-compatible shared PremiumSelect customization/accessibility props.

Not authorized:
- Platform/Core contracts.
- Healthcare H1-H12 Kernel.
- Logistics E7.1/E7.2/E7.3 Kernel.
- Database schema or RLS.
- Server action semantics.

## 6. UI -> Contract Reconciliation

| UI Element | Existing Contract | Decision |
|---|---|---|
| Active branch value | `activeBranchId` from `getBeautyRuntimeBranchContext` | UNCHANGED |
| Branch options | `branches: BeautyRuntimeBranch[]` | UNCHANGED |
| Branch switch action | `selectBeautyRuntimeBranch(branchId)` | UNCHANGED |
| Dropdown presentation | Shared `PremiumSelect` visual contract | ALIGN |

## 7. Additive Migration Plan

None.

## 8. 11 Automated Verification Gates Plan

1. Architecture scope check: verify no Kernel or migration files are modified.
2. Type check target: run TypeScript or lint/type verification available for the touched files if feasible.
3. Unit tests: not required for visual-only component consumption unless existing tests cover it.
4. UI smoke: verify dropdown renders with PremiumSelect classes.
5. Branch action contract: unchanged, no new API.
6. Tenant isolation: unchanged, server action remains authority.
7. RLS/Real DB: not applicable to visual-only UI change.
8. Browser E2E: optional visual verification if local runtime credentials/server are available.
9. Accessibility sanity: keep selectable text and disabled state.
10. Diff guard: confirm only intended files changed.
11. Regression guard: confirm no Healthcare/Logistics frozen artifacts touched.

---

# Architecture Gate - Beauty Spa Branch Selector Header Color (2026-10-09)

> **Status:** PASS - presentation-only color alignment for the Beauty Spa branch selector label.
> **Scope:** `src/components/layout/BeautyRuntimeBranchSelector.tsx` label class only. No data, service, schema, RLS, migration, Healthcare H1-H12, Education Kernel, or Logistics Kernel change.

## 1. Bella OS/Product Development Process Gate

- Truth: The branch selector label currently uses `text-primary/65`, which renders darker than the Beauty Spa sidebar section headers in the active shell.
- Source of truth: `BeautyRuntimeBranchSelector` label markup and existing `.beauty-erp-nav-header` theme token in `src/app/globals.css`.
- Canonical contract: Sidebar section labels should consume the same Beauty ERP nav-header presentation token.
- Boundary: Product UI presentation only.
- Minimum change: Apply the existing `beauty-erp-nav-header` class to the branch selector label and use the same gold fallback color.

## 2. Product Manifest

- Product: Bella Beauty Spa v2 shell.
- Capability: Runtime branch selector label readability/visual consistency.
- Scope: Static label/icon color only.
- Out of scope: Branch selection behavior, authorization, persistence, server actions, DB schema, migrations.

## 3. Ownership Map

- Branch selector label: Beauty Spa sidebar UI consumer.
- Gold menu header token: shared Beauty ERP sidebar theme CSS.

## 4. Contract Dependency Map

`Beauty Spa Product UI -> shared Beauty ERP sidebar presentation token`

No Product -> Public Contract -> Kernel dependency changes are required.

## 5. Change Authority

Authorized:
- Branch selector label class.

Not authorized:
- Server actions, service contracts, database schema, RLS, migrations, Platform/Core, Healthcare/Education/Logistics kernels.

## 6. UI -> Contract Reconciliation

| UI Element | Existing Contract | Decision |
|---|---|---|
| Branch selector label | Sidebar section label presentation | ALIGN with `.beauty-erp-nav-header` |
| Branch selector dropdown | Existing `PremiumSelect` consumer | UNCHANGED |
| Branch switch action | `selectBeautyRuntimeBranch(branchId)` | UNCHANGED |

## 7. Additive Migration Plan

None.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: UI class-only change.
2. Contract boundary: no service/API/read-model edits.
3. Tenant isolation: unchanged.
4. RLS/AuthZ: unchanged.
5. Migration safety: no migrations.
6. Event-after-persistence: unchanged.
7. UI reconciliation: label uses existing sidebar header token.
8. Type safety: no `any`, casts, or suppressions.
9. Static check: targeted ESLint.
10. Diff check: `git diff --check`.
11. Regression scope: kernel/database gates not required because frozen kernels and persistence are untouched.

---

# Architecture Gate - Dashboard Notification Bell Interaction Repair (2026-10-09)

> **Status:** PASS - interaction-only repair for the shared admin notification bell.
> **Scope:** `src/components/common/AdminNotificationBell.tsx` click/open behavior and `src/app/dashboard/components/BeautySpaV2DashboardView.tsx` consumer wiring only. No notification service contract, database schema, RLS, migration, Healthcare H1-H12, Education Kernel, or Logistics Kernel change.

## 1. Bella OS/Product Development Process Gate

- Truth: The dashboard header uses `AdminNotificationBell`; the reported defect is that the visible bell button does not open/operate reliably.
- Source of truth: `src/app/dashboard/page.tsx` consumes `AdminNotificationBell`; `src/app/dashboard/components/BeautySpaV2DashboardView.tsx` rendered a static bell icon; `src/components/common/AdminNotificationBell.tsx` owns the bell button, portal popover, and read/unread UI state.
- Canonical contract: Bell click should open a visible notification popover anchored to the button; notification data and read actions remain owned by existing dashboard/notification actions.
- Boundary: Shared UI interaction only.
- Minimum change: Stabilize the shared button toggle/portal positioning and replace the Beauty Spa v2 static bell icon with `AdminNotificationBell` without changing alert generation, tenant filtering, or persistence.

## 2. Product Manifest

- Product: Bella Beauty Spa dashboard shell consuming the shared admin notification bell.
- Capability: Open notification popover and all-notifications modal from the header bell.
- Scope: Button accessibility, click target reliability, popover viewport placement.
- Out of scope: Notification business rules, alert counts, app notification schema, mark-read semantics, realtime subscription contracts.

## 3. Ownership Map

- Bell button/popover UI: `AdminNotificationBell`.
- Beauty Spa v2 header bell consumer: `BeautySpaV2DashboardView`.
- Alert data: `getImportantAlerts`.
- Read/unread persistence: `notification-actions`.

## 4. Contract Dependency Map

`Dashboard UI / BeautySpaV2DashboardView -> AdminNotificationBell -> getImportantAlerts / notification-actions`

No Product -> Public Contract -> Kernel dependency changes are required.

## 5. Change Authority

Authorized:
- Shared notification bell UI interaction and accessibility attributes.
- Beauty Spa v2 header consumer wiring from static icon to shared bell component.

Not authorized:
- Database schema, RLS, migrations, alert semantics, server action contracts, Platform/Core, Healthcare/Education/Logistics kernels.

## 6. UI -> Contract Reconciliation

| UI Element | Existing Contract | Decision |
|---|---|---|
| Header bell button | Toggle notification popover | REPAIR shared component and wire Beauty Spa v2 consumer |
| Unread badge | Derived from active alert count | UNCHANGED |
| Popover/list content | Existing `DashboardAlert[]` | UNCHANGED |
| Mark read actions | Existing server actions | UNCHANGED |

## 7. Additive Migration Plan

None.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: UI interaction-only change.
2. Contract boundary: no server action/read-model edits.
3. Tenant isolation: unchanged.
4. RLS/AuthZ: unchanged.
5. Migration safety: no migrations.
6. Event-after-persistence: unchanged.
7. UI reconciliation: bell opens anchored popover without changing notification data.
8. Type safety: no `any`, casts, or suppressions.
9. Static check: targeted ESLint.
10. Diff check: `git diff --check`.
11. Regression scope: kernel/database gates not required because frozen kernels and persistence are untouched.
---

# Architecture Gate - Beauty Spa Branch Selector PremiumSelect Alignment (2026-10-09)

> **Status:** PASS - product UI consumer alignment with the shared PremiumSelect component.
> **Scope:** `src/components/layout/BeautyRuntimeBranchSelector.tsx` and a backward-compatible `PremiumSelect` accessibility/customization prop. No service, data, schema, RLS, migration, Healthcare H1-H12, Education Kernel, or Logistics Kernel change.

## 1. Bella OS/Product Development Process Gate

- Truth: The current Beauty Spa runtime branch selector renders a native HTML `select`, which produces browser-default dropdown styling.
- Source of truth: `src/components/layout/BeautyRuntimeBranchSelector.tsx` for the branch selector consumer; `src/components/ui/PremiumSelect.tsx` for the system premium select UI contract.
- Canonical contract: Product UI should consume the shared PremiumSelect component for premium select dropdown behavior and styling.
- Ownership: Beauty Spa product shell owns the branch selector consumer; shared UI owns PremiumSelect rendering.
- Boundary: Product UI consumer only. No Platform/Core/Kernel/database changes.
- Minimum change: Replace the native `select` in the branch selector with `PremiumSelect` using the same branch data and selection handler.

## 2. Product Manifest

- Product: Bella Beauty Spa v2 shell.
- Capability: Runtime branch selection for non-customer staff/admin users.
- Scope: Sidebar UI presentation and interaction only.
- Out of scope: Branch authorization, tenant resolution, persistence semantics, DB schema, migrations, server actions, Kernel contracts.

## 3. Ownership Map

- Branch list and active branch data: `beauty-runtime-branch-actions` service contract.
- Runtime branch UI consumer: `BeautyRuntimeBranchSelector`.
- Dropdown visual contract: shared `PremiumSelect`.
- Local storage key: UI carrier only; server actions remain authority for access.

## 4. Contract Dependency Map

`Beauty Spa Product UI -> beauty-runtime-branch-actions public service contract -> existing tenant/branch persistence`

This change does not access lower-layer tables directly and does not introduce a new contract.

## 5. Change Authority

Authorized:
- Beauty Spa sidebar UI consumer.
- Backward-compatible shared PremiumSelect customization/accessibility props.

Not authorized:
- Platform/Core contracts.
- Healthcare H1-H12 Kernel.
- Logistics E7.1/E7.2/E7.3 Kernel.
- Database schema or RLS.
- Server action semantics.

## 6. UI -> Contract Reconciliation

| UI Element | Existing Contract | Decision |
|---|---|---|
| Active branch value | `activeBranchId` from `getBeautyRuntimeBranchContext` | UNCHANGED |
| Branch options | `branches: BeautyRuntimeBranch[]` | UNCHANGED |
| Branch switch action | `selectBeautyRuntimeBranch(branchId)` | UNCHANGED |
| Dropdown presentation | Shared `PremiumSelect` visual contract | ALIGN |

## 7. Additive Migration Plan

None.

## 8. 11 Automated Verification Gates Plan

1. Architecture scope check: verify no Kernel or migration files are modified.
2. Type check target: run TypeScript or lint/type verification available for the touched files if feasible.
3. Unit tests: not required for visual-only component consumption unless existing tests cover it.
4. UI smoke: verify dropdown renders with PremiumSelect classes.
5. Branch action contract: unchanged, no new API.
6. Tenant isolation: unchanged, server action remains authority.
7. RLS/Real DB: not applicable to visual-only UI change.
8. Browser E2E: optional visual verification if local runtime credentials/server are available.
9. Accessibility sanity: keep selectable text and disabled state.
10. Diff guard: confirm only intended files changed.
11. Regression guard: confirm no Healthcare/Logistics frozen artifacts touched.

---

# Architecture Gate - Beauty Spa Branch Selector Header Color (2026-10-09)

> **Status:** PASS - presentation-only color alignment for the Beauty Spa branch selector label.
> **Scope:** `src/components/layout/BeautyRuntimeBranchSelector.tsx` label class only. No data, service, schema, RLS, migration, Healthcare H1-H12, Education Kernel, or Logistics Kernel change.

## 1. Bella OS/Product Development Process Gate

- Truth: The branch selector label currently uses `text-primary/65`, which renders darker than the Beauty Spa sidebar section headers in the active shell.
- Source of truth: `BeautyRuntimeBranchSelector` label markup and existing `.beauty-erp-nav-header` theme token in `src/app/globals.css`.
- Canonical contract: Sidebar section labels should consume the same Beauty ERP nav-header presentation token.
- Boundary: Product UI presentation only.
- Minimum change: Apply the existing `beauty-erp-nav-header` class to the branch selector label and use the same gold fallback color.

## 2. Product Manifest

- Product: Bella Beauty Spa v2 shell.
- Capability: Runtime branch selector label readability/visual consistency.
- Scope: Static label/icon color only.
- Out of scope: Branch selection behavior, authorization, persistence, server actions, DB schema, migrations.

## 3. Ownership Map

- Branch selector label: Beauty Spa sidebar UI consumer.
- Gold menu header token: shared Beauty ERP sidebar theme CSS.

## 4. Contract Dependency Map

`Beauty Spa Product UI -> shared Beauty ERP sidebar presentation token`

No Product -> Public Contract -> Kernel dependency changes are required.

## 5. Change Authority

Authorized:
- Branch selector label class.

Not authorized:
- Server actions, service contracts, database schema, RLS, migrations, Platform/Core, Healthcare/Education/Logistics kernels.

## 6. UI -> Contract Reconciliation

| UI Element | Existing Contract | Decision |
|---|---|---|
| Branch selector label | Sidebar section label presentation | ALIGN with `.beauty-erp-nav-header` |
| Branch selector dropdown | Existing `PremiumSelect` consumer | UNCHANGED |
| Branch switch action | `selectBeautyRuntimeBranch(branchId)` | UNCHANGED |

## 7. Additive Migration Plan

None.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: UI class-only change.
2. Contract boundary: no service/API/read-model edits.
3. Tenant isolation: unchanged.
4. RLS/AuthZ: unchanged.
5. Migration safety: no migrations.
6. Event-after-persistence: unchanged.
7. UI reconciliation: label uses existing sidebar header token.
8. Type safety: no `any`, casts, or suppressions.
9. Static check: targeted ESLint.
10. Diff check: `git diff --check`.
11. Regression scope: kernel/database gates not required because frozen kernels and persistence are untouched.

---

# ARCHITECTURE GATE RESULT - BEAUTY SPA DARK THEME SIDEBAR PAGE AUDIT

> **Status:** PASS - presentation-only dark theme contrast repair authorized
> **Date:** 2026-10-08
> **Scope:** Audit and repair dark theme color/contrast regressions across the Bella Beauty Spa sidebar menu pages, starting with the salary/payroll health-check panel shown in the regression screenshot.

## Bella OS/Product Development Process Gate

- Truth: The reported defect is visual only: dark mode surfaces render light-mode panels, weak text contrast, or split background colors on Beauty Spa dashboard routes.
- Source of Truth: User screenshots, `src/components/layout/sidebar.tsx` Beauty Spa menu route list, existing tenant/product CSS tokens in `src/app/globals.css`, and current page/component Tailwind classes.
- Canonical Contract: Shared UI and product presentation must use semantic dark-mode tokens and must not let product/tenant color overrides reintroduce light-mode backgrounds in `html.dark`.
- Gate result: `PASS` for presentation-layer CSS and component class changes only.

## Product Manifest

- Product: Bella Beauty Spa V2 (`bella_spa`), current implementation route family under `/dashboard`.
- Sidebar pages in scope: Dashboard, AI Copilot, Customers & CRM, Bookings & POS, Sessions, Waitlist, Inventory, Product Sales, Salary, Chain Management, Accounting, Finance Reconciliation, Executive, Analytics, Guides, Services, Settings.
- Concrete regression in scope: `/dashboard/salary` payroll health-check, salary tabs, salary tables, attendance modal, HR profile modal, and legacy light utility classes used by sidebar-linked pages.
- Non-goals: no domain behavior change, no API or RPC change, no schema/RLS/migration, no payroll formula change, no menu IA or label change.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Beauty Spa product identity and tenant theme | Product Registry / Tenant theme | consume only |
| Sidebar route list | Shared dashboard shell | read only for audit scope |
| Dark theme tokens and legacy utility safety net | Shared UI/theme CSS | may extend |
| Salary/payroll visual panels | Product UI presentation | may modify classes only |
| Payroll data, formulas, publish/finalize actions | HR Salary domain/services | do not change |

## Contract Dependency Map

```text
Beauty Spa sidebar page
  -> dashboard shell tenant/theme attributes
  -> shared dark theme CSS tokens
  -> route and component presentation classes
  -> rendered dark-mode surfaces and readable text
```

No Product -> Public Contract -> Kernel dependency changes are required.

## Change Authority

Authorized:
- Extend `src/app/globals.css` dark-mode presentation overrides.
- Adjust Beauty Spa salary/payroll page and component classes when needed for contrast/readability.
- Add focused UI/static verification only.

Not authorized:
- Database schema, migrations, RLS, RPCs, API routes, payroll formulas, booking/inventory/accounting workflows, tenant identity logic, ProductRegistry/ProductResolver changes, sidebar IA changes, or frozen Healthcare/Education/Logistics kernel files.

## UI -> Contract Reconciliation

| UI element / route family | Existing contract | Decision |
|---|---|---|
| Sidebar-linked Beauty Spa pages | Existing routes and data/actions | Preserve behavior; audit presentation only |
| Salary health-check panel | Existing payroll validation data | Preserve data; fix dark surface and text contrast |
| Salary tabs/tables/modals | Existing payroll/attendance/HR UI contracts | Preserve fields/actions; fix dark classes/tokens |
| Shared legacy light utility classes | Tailwind presentation utilities | Final dark-mode overrides may remap colors after tenant light overrides |
| Light theme tenant/product colors | Tenant brand presets | Do not change |

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, seed, or production data change.

## 11 Automated Verification Gates Plan

1. Architecture boundary: confirm only theme/presentation files are touched.
2. Contract boundary: no service/API/read-model edits.
3. Tenant isolation: unchanged.
4. RLS/AuthZ: unchanged.
5. Database migration safety: no migrations.
6. Event-after-persistence: unchanged.
7. UI data/action reconciliation: no new data fields, statuses, actions, or KPIs.
8. Type safety: no `any`, casts, or suppressions.
9. Contrast check: audit dark foreground/background pairs on sidebar-linked pages, starting with salary/payroll regression.
10. Static check: targeted lint/build checks and `git diff --check`.
11. Regression scope: broad kernel/database gates are not required because frozen kernels and persistence are untouched.

---

# Architecture Gate - Beauty Spa Soft Input Border Repair (2026-10-09)

> **Status:** PASS - presentation-only repair for Beauty Spa input and filter controls.
> **Scope:** Beauty Spa tenant-level input/select/textarea/PremiumSelect trigger styling plus Dashboard quick search, Customer toolbar search/dropdowns, Booking timeline search/dropdowns, and Booking specialty mobile filter button. No data contract, action, schema, RLS, migration, Healthcare H1-H12, Education Kernel, or Logistics Kernel change.

## Bella OS/Product Development Process Gate

- Truth: User screenshots show several Beauty Spa input/filter controls rendering with visually heavy dark borders.
- Source of truth: Attached screenshots, Beauty Spa tenant style rules in `src/app/globals.css`, and current component classes in `BeautySpaV2DashboardView`, `customers/page`, `TimelineKtvView`, and `BookingsSpecialtyFilter`.
- Canonical contract: Input/filter controls must remain the same fields and actions while using softer presentation: no hard black outline, subtle inset shadow for field affordance, and gentle focus ring.
- Gate result: `PASS` for UI presentation class changes only.

## Product Manifest

- Product: Bella Beauty Spa V2.
- Capability in scope: visual treatment of search fields and filter controls in Dashboard, Customers, and Bookings.
- Runtime behavior in scope: none beyond existing input/select interactions.
- Non-goals: no search/filter semantics change, no API/service change, no data persistence change, no shared kernel or product contract change.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Search query state | Product UI components | preserve |
| Filter select state | Product UI components | preserve |
| PremiumSelect trigger accessibility/presentation | Shared UI component | add semantic combobox role; preserve API and behavior |
| Beauty Spa visual treatment | Product presentation | may adjust classes |

## Contract Dependency Map

```text
Beauty Spa UI controls
  -> existing local state setters
  -> existing filtering/search display logic
  -> presentation-only class update
```

No Product -> Public Contract -> Kernel dependency changes are required.

## Change Authority

Authorized:
- Tenant-level Beauty Spa control styling in `src/app/globals.css`.
- Component-level Tailwind class changes for the affected UI controls.
- Shared `PremiumSelect` trigger ARIA semantics so tenant-level control styling reaches system select triggers.
- `PremiumSelect` consumer `buttonClassName` overrides on the customer toolbar.

Not authorized:
- Database schema, migrations, RLS, server actions, search/filter logic, ProductRegistry, Platform/Core, Healthcare/Education/Logistics kernels.

## UI -> Contract Reconciliation

| UI element | Existing contract | Decision |
|---|---|---|
| Dashboard quick search | `searchQuery` local state | Preserve behavior; soften border |
| Customer toolbar search | `searchQuery` local state | Preserve behavior; soften border |
| Customer filters/sort | Existing `PremiumSelect` values | Preserve behavior; soften trigger style |
| Booking timeline KTV/status filters | Native select state | Preserve behavior; soften border |
| Booking timeline search | `searchQuery` local state | Preserve behavior; soften border |
| Booking specialty mobile filter | Existing specialty selector | Preserve behavior; soften border |
| Beauty Spa menu input/select/textarea controls | Tenant-level presentation style | Preserve behavior; remove heavy border globally |
| PremiumSelect trigger | Existing custom select button | Preserve behavior; expose combobox role for accessibility and tenant styling |

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, seed, or production data change.

## 11 Automated Verification Gates Plan

1. Architecture boundary: presentation-only component class updates.
2. Contract boundary: no service/API/read-model edits.
3. Tenant isolation: unchanged.
4. RLS/AuthZ: unchanged.
5. Database migration safety: no migrations.
6. Event-after-persistence: unchanged.
7. UI data/action reconciliation: all inputs/selects keep existing state handlers.
8. Type safety: no `any`, casts, or suppressions.
9. Visual intent: black/dark borders removed; soft inset shadow retained for affordance.
10. Static check: targeted ESLint and `git diff --check`.
11. Regression scope: kernel/database gates not required because frozen kernels and persistence are untouched.

---

# ARCHITECTURE GATE RESULT - BELLA HOSPITALITY OPERATIONS UI

> **Status:** PASS - presentation-only Hospitality UI upgrade authorized.
> **Date:** 2026-10-09
> **Scope:** Upgrade the existing `/hospitality/hotel-core-chain` browser proof page into an operations console for Dashboard and Room/Reservation workflows while preserving sealed Product services and E2E proof selectors.

## 1. Bella OS/Product Development Process Gate

- Truth: Bella Hospitality already owns sealed product services for property/room, guest/reservation, stay, folio/payment, housekeeping, and maintenance under `src/products/bella-hospitality`.
- Source of Truth: product types/services in `src/products/bella-hospitality`, browser proof entry `src/app/hospitality/hotel-core-chain/page.tsx`, action `src/services/hospitality-hotel-core-chain-actions.ts`, and E2E proof `e2e/tests/38-hospitality-hotel-core-chain-browser-e2e.spec.ts`.
- Canonical Contract: Product UI consumes the existing Hotel Core chain action and its returned value. No new schema, RPC, OS kernel, Platform contract, or Finance contract is authorized.
- Gate result: `PASS` for presentation-layer UI implementation only.

## 2. Product Manifest

- Product: Bella Hospitality (`bella_hospitality`).
- Capabilities in scope: hotel dashboard, room/reservation overview, front-office/folio evidence display, and unproven housekeeping/maintenance lanes.
- Non-goals: no new backend query API, no migration, no new housekeeping or maintenance workflow action, no Go-Live claim.

## 3. Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Hospitality UI page | Bella Hospitality Product UI | may modify |
| Hotel Core chain action | Bella Hospitality Product service | consume existing contract; minimal returned-value display only |
| `hospitality_*` tables | Bella Hospitality Product persistence | no schema change |
| Finance invoice/allocation/cash movement | Finance Platform public contract | consume only through existing service |
| Product identity | Platform Product Registry | consume only |

## 4. Contract Dependency Map

```text
/hospitality/hotel-core-chain UI
  -> executeHospitalityHotelCoreChainAction
  -> Hospitality product services/repositories
  -> hospitality_* product tables with RLS context
  -> Finance public service contract for folio charge/payment
  -> Product Registry identity proof
```

## 5. Change Authority

Authorized:
- Presentation/layout changes in `src/app/hospitality/hotel-core-chain/page.tsx`.
- Display-only derivations from already returned action values.
- Preserving and surfacing proof IDs/statuses for Dashboard and Room/Reservation UI.

Not authorized:
- Healthcare H1-H12 changes.
- Education kernel changes.
- Logistics E7.1/E7.2/E7.3 changes.
- Platform/Core/Frozen kernel changes.
- New database tables, columns, RPCs, or invented statuses.

## 6. UI -> Contract Reconciliation

| UI Element | Contract Trace | Result |
|---|---|---|
| Dashboard KPIs | Existing redirect params from Hotel Core action | MATCH; empty state is `NOT_PROVEN` |
| Room list row | `roomId`, reservation proof, occupancy status from existing action result | MATCH after returned proof params are surfaced |
| Front-office lane | stay, occupancy, folio, payment result values | MATCH |
| Housekeeping lane | No current completion action in Hotel Core proof | `NOT_PROVEN`; no ready-for-sale claim |
| Maintenance lane | No current maintenance request in Hotel Core proof | `NOT_PROVEN`; cannot mark room sellable |

## 7. Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, seed, or production data change.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: inspect changed files only.
2. Contract boundary: verify UI consumes existing action/result values only.
3. Tenant isolation: preserve existing action auth/RLS context.
4. RLS/AuthZ: existing E2E Real DB proof remains the authority when env is available.
5. Migration safety: no migrations.
6. Event-after-persistence: no write/event semantics changed.
7. Product identity: preserve `hotel-core-product` evidence.
8. Finance chain: preserve folio/payment evidence.
9. Type safety: no `any`, casts, or suppressions.
10. Static check: targeted ESLint/typecheck where dependencies are installed.
11. Browser E2E: run `e2e/tests/38-hospitality-hotel-core-chain-browser-e2e.spec.ts` when DB/env/server are available.

---

## Additional Architecture Gate - Beauty Spa Dashboard Sidebar UI Repair

> **Status:** PASS - focused Beauty Spa Product UI repair for dashboard month/year filtering, CRM/Zalo tab layout, customer-rating detail routing, and typography alignment with the Beauty dashboard baseline.

> **Scope:** `src/app/dashboard/components/BeautySpaV2DashboardView.tsx`, `src/app/dashboard/crm/*`, and a shared dashboard notification widget server-action wrapper outside `src/core`. No database schema, RLS, accounting, Platform/Core, Healthcare H1-H12, Education kernel, or Logistics E7.1-E7.3 changes.

### 1. Bella OS/Product Development Process Gate

Truth: the reported defects are browser-facing Product UI defects on Beauty Spa dashboard/sidebar pages. Source of truth is the existing Product Registry identity (`bella_spa` / Beauty Spa current implementation), dashboard parent state (`selectedMonth`, `selectedYear`), and existing sidebar route map. Canonical contract is Product UI consuming existing dashboard data/actions without changing persistence or kernel contracts.

Gate decision: `PASS` for a boundary-local UI fix.

### 2. Product Manifest

- Product: Bella Beauty Spa V2 (`bella_spa`).
- Capabilities in scope: dashboard finance period selector, customer-rating detail navigation, CRM/Zalo tabs/header presentation.
- Out of scope: new CRM analytics module, session review schema, customer review workflow semantics, Product Registry changes, Platform/Core changes, Healthcare/Education/Logistics kernels.

### 3. Ownership Map

| Surface/Data | Owner | Change Authority |
| --- | --- | --- |
| Beauty dashboard view composition | Beauty Spa Product UI | may change visual controls and links |
| Dashboard period state | Dashboard page/UI state | may consume existing setters |
| CRM/Zalo page tabs | Beauty Spa Product UI | may change presentation and client tab routing |
| Dashboard notification widget | Shared dashboard UI/read-model | may fail-soft through a UI-owned wrapper for non-critical alert reads |
| Session reviews / rating persistence | Beauty/Spa customer feedback workflow | read-only for this task |

### 4. Contract Dependency Map

```text
Beauty dashboard UI
  -> selectedMonth / selectedYear setters from dashboard page
  -> existing getDashboardPrimaryData refresh path
  -> CRM/customers routes via sidebar contract
```

No Product UI code may bypass server actions or directly mutate product data. Shared dashboard widgets may consume a UI-owned fail-soft wrapper while the underlying service contract remains unchanged.

### 5. Change Authority

Authorized: localized TSX UI edits, query/anchor routing for existing pages, typography/control class alignment with the dashboard baseline, and a UI-owned fail-soft wrapper for non-critical notification reads.

Not authorized: database migrations, server action semantics, Product Registry identity changes, Platform/Core refactors, kernel changes, broad sidebar permission changes.

### 6. UI -> Contract Reconciliation

- Month selector: UI must call the existing `setSelectedMonth` / `setSelectedYear` props so the parent dashboard data reloads through its existing effect.
- Rating detail link: UI must route to an existing customer/CRM surface instead of an unrelated generic CRM default.
- CRM tabs: UI must preserve existing `CrmTabId` values and only repair layout/typography.

### 7. Additive Migration Plan

No migration. `NOT_APPLICABLE`.

### 8. 11 Automated Verification Gates Plan

1. `git diff --check`
2. Targeted lint for changed files
3. TypeScript changed-file gate if available
4. Static scan for forbidden `any` in changed files
5. Static scan for Healthcare H1-H12 kernel changes
6. Static scan for Logistics frozen artifacts changes
7. Route sanity for `/dashboard`
8. Route sanity for `/dashboard/crm`
9. Route sanity for customer/CRM detail target
10. Browser or Playwright smoke if local auth/runtime is available
11. Final git diff review for scope containment

## Additional Architecture Gate - Beauty Spa Premium Select and Data Tabs Repair

> **Status:** PASS - focused Beauty Spa Product UI repair for dropdown consistency and dashboard data-tab behavior.

> **Scope:** Beauty/Spa dashboard, booking timeline filters, CRM voucher modal target selector, customer table page-size selector, and Beauty/Spa finance report dropdowns. No persistence, schema, RLS, Product Registry, Platform/Core, Healthcare H1-H12, Education, or Logistics E7.1-E7.3 changes.

### 1. Bella OS/Product Development Process Gate

Truth: the reported defects are Product UI defects. Existing state values and filters are the source of truth; the change must keep the same values while replacing native browser dropdown chrome with the shared `PremiumSelect` component and making tab buttons drive visible filtered data.

Gate decision: `PASS` for a boundary-local Product UI/state fix.

### 2. Product Manifest

- Product: Bella Beauty Spa V2 / Spa sidebar experience.
- Capabilities in scope: dashboard finance period dropdowns, finance report period/month/forecast dropdowns, booking timeline filters, CRM voucher audience selector, customer pagination selector, dashboard performance and urgent-action tabs.
- Out of scope: new product capabilities, database migrations, RLS, server actions, kernel contracts.

### 3. Ownership Map

| Surface/Data | Owner | Change Authority |
| --- | --- | --- |
| Dashboard period state | Beauty dashboard UI | may keep existing setters and change presentation |
| Timeline KTV/status filters | Booking/Sessions Product UI | may keep existing filter state and change presentation |
| CRM voucher target | CRM Product UI | may keep existing campaign target values and change presentation |
| Customer pagination size | Customer Product UI | may keep existing page-size state and change presentation |
| Dashboard tab filtering | Beauty dashboard UI | may add local active-tab state and filtered rendering |

### 4. Contract Dependency Map

```text
Beauty/Spa Product UI controls
  -> existing local state setters
  -> existing in-memory filtering/rendering
  -> shared PremiumSelect presentation component
```

No Product UI code may bypass existing server actions or mutate data outside existing handlers.

### 5. Change Authority

Authorized: localized TSX imports, local state types, `PremiumSelect` consumers, and data-tab render filtering.

Not authorized: schema changes, generated DB types, RLS/policy changes, server action semantics, Platform/Core abstractions, or frozen kernel edits.

### 6. UI -> Contract Reconciliation

- Dropdowns: preserve exact existing values (`month`, `year`, `ktv`, `status`, `target`, `pageSize`) and handlers.
- Performance tabs: active tab must visibly switch chart metric and empty-state copy.
- Urgent-action tabs: active tab must filter displayed alert cards by alert type.

### 7. Additive Migration Plan

No migration. `NOT_APPLICABLE`.

### 8. 11 Automated Verification Gates Plan

1. `git diff --check`
2. Targeted ESLint on changed TSX/TS files
3. `npm run typecheck:changed`
4. Static scan for remaining native selects in the touched Beauty/Spa surfaces
5. Static scan for forbidden `any` in changed files
6. Confirm no Healthcare H1-H12 files changed
7. Confirm no Logistics frozen artifacts changed
8. Dashboard route smoke if local auth/runtime is available
9. Booking timeline route smoke if local auth/runtime is available
10. CRM/customers route smoke if local auth/runtime is available
11. Final diff review for scope containment

---

## Additional Architecture Gate - Beauty OS Typography Consistency

> **Status:** PASS - presentation-only typography normalization for Beauty OS dashboard pages.

> **Scope:** Shared dashboard shell typography class and `beauty_spa` module CSS rules so Beauty OS products that reuse the Beauty module presentation inherit the same font family, heading scale, body text scale, control text scale, table text scale, and letter-spacing baseline as the Beauty dashboard. Includes CI routing correction so presentation-only CSS does not trigger Real DB E2E. No data contract, route, menu, API, schema, RLS, Product Registry, Platform/Core, Healthcare H1-H12, Education, or Logistics E7.1-E7.3 change.

### 1. Bella OS/Product Development Process Gate

Truth: the requested issue is browser-facing text inconsistency across Beauty OS sidebar pages. Source of truth is the Beauty dashboard baseline, the shared dashboard shell, existing tenant runtime attributes, and current sidebar-linked dashboard routes. Canonical contract is Product UI presentation only; no product data/action behavior is changed.

Gate decision: `PASS` for a shared presentation-layer typography fix.

### 2. Product Manifest

- Product family: Beauty OS products using the `beauty_spa` module presentation, including Spa/Haircut/Nail surfaces where the tenant runtime resolves to `beauty_spa`.
- Capabilities in scope: visual font family, font size, line height, letter spacing, text weight normalization for dashboard content and controls, and CI scope classification for presentation-only CSS.
- Out of scope: page IA, sidebar labels, KPI values, field/action semantics, persistence, tests that invent business semantics, migrations, RLS, server actions, and frozen kernel code.

### 3. Ownership Map

| Surface/Data | Owner | Change Authority |
| --- | --- | --- |
| Dashboard content wrapper | Shared dashboard shell | may add presentation class |
| Beauty module typography | Shared UI/theme CSS | may normalize presentation tokens |
| Beauty sidebar route pages | Beauty Product UI | consume shared typography |
| Business data/actions | Product services/contracts | read-only, not modified |
| CI scope router | CI governance | may prevent CSS-only presentation files from being treated as DB runtime surfaces |

### 4. Contract Dependency Map

```text
Beauty OS dashboard route
  -> DashboardAuthorizedShell main wrapper
  -> html[data-tenant-module="beauty_spa"]
  -> shared typography CSS
  -> existing page content with unchanged data/actions
```

### 5. Change Authority

Authorized: shared dashboard wrapper class, CSS typography rules scoped to `beauty_spa`, and CI scope router classification for presentation-only CSS.

Not authorized: database schema, migrations, RLS, API/server-action behavior, ProductRegistry/ProductResolver changes, menu IA, Healthcare/Education/Logistics kernel files, or business calculations.

### 6. UI -> Contract Reconciliation

- Dashboard baseline: keep sans font, compact headings, 13px body/control text, 12px table/support text, and zero letter spacing across route content.
- KPI numbers and visual icons: preserve existing component-specific emphasis where possible; CSS targets text hierarchy and controls, not data semantics.
- Sidebar branding script remains outside the dashboard content wrapper and is not normalized by this change.
- Real DB E2E routing: presentation CSS and wrapper class do not create or modify DB runtime surfaces; router must keep Real DB proof reserved for migrations, DB runtime code, real-db tests, and explicit Real DB configs.

### 7. Additive Migration Plan

No migration. `NOT_APPLICABLE`.

### 8. 11 Automated Verification Gates Plan

1. `git diff --check`
2. Targeted ESLint on changed TSX/CSS-owned files where applicable
3. `npm run typecheck:changed`
4. `node scripts/test-ci-scope-router.mjs`
5. Static scan confirms no Healthcare H1-H12 files changed
6. Static scan confirms no Education kernel files changed
7. Static scan confirms no Logistics frozen artifacts changed
8. Verify typography CSS is scoped to `html[data-tenant-module="beauty_spa"]`
9. Verify router classifies this typography diff with `needs_real_db_e2e=false`
10. Browser/route smoke if local auth/runtime is available
11. Final diff review for scope containment

---

# ARCHITECTURE GATE RESULT - BELLA HOSPITALITY OPERATIONS BROWSER E2E

> **Status:** PASS - verification-only CI wiring authorized.
> **Date:** 2026-10-09
> **Scope:** Verify the merged Hospitality Operations Console with Browser E2E and Real DB evidence in CI. No backend, schema, RPC, migration, or canonical contract change is authorized.

## 1. Bella OS/Product Development Process Gate

- Truth: PR #270 merged the first-pass Hospitality Operations Console into `main`; UI operational seal still requires browser/runtime evidence.
- Source of Truth: `/hospitality/hotel-core-chain` UI, existing Hotel Core chain action, Playwright spec `e2e/tests/38-hospitality-hotel-core-chain-browser-e2e.spec.ts`, and CI scope router/workflows.
- Canonical Contract: Product UI must consume the existing Hotel Core action and keep unproven housekeeping/maintenance states as `NOT_PROVEN` or blocked statuses.
- Gate result: `PASS` for test selectors, Browser E2E assertions, and existing CI pipeline wiring only.

## 2. Product Manifest

- Product: Bella Hospitality (`bella_hospitality`).
- Capabilities in scope for verification: Room/Reservation, Front Office/Folio, Housekeeping state boundary, Maintenance state boundary.
- Non-goals: no new operational module, no new backend action, no new DB object, no Go-Live claim.

## 3. Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Hospitality operations UI selectors | Bella Hospitality Product UI | may add stable test ids |
| Browser E2E assertions | QA / E2E surface | may extend existing spec |
| CI scope routing | CI governance | may mark the existing Real DB browser proof as requiring Real DB evidence |
| Hospitality product persistence | Bella Hospitality Product persistence | no change |
| Finance/RLS runtime behavior | Existing public contracts and DB policies | verify only |

## 4. Contract Dependency Map

```text
Playwright Hotel Core browser E2E
  -> /hospitality/hotel-core-chain UI
  -> executeHospitalityHotelCoreChainAction
  -> Hospitality product services and RLS-scoped tables
  -> Finance public contract evidence
  -> Real DB readback and cross-tenant negative assertions
```

## 5. Change Authority

Authorized:
- Add stable UI test selectors to the existing Hospitality route.
- Extend the existing Hotel Core browser E2E to assert the operational UI lanes.
- Wire the existing CI workflow to run that spec with isolated E2E Supabase credentials.
- Mark that spec as Real DB-relevant in the existing CI scope router.

Not authorized:
- Backend service changes.
- Schema, migration, RPC, generated type, RLS policy, or seed changes.
- Healthcare, Education, Logistics, Platform/Core, or ProductRegistry changes.
- Seal or Go-Live claims without CI evidence.

## 6. UI -> Contract Reconciliation

| UI Area | Existing Contract / Evidence | Verification Decision |
|---|---|---|
| Dashboard | Existing Hotel Core result params | Browser E2E asserts loaded empty state and proof state |
| Room/Reservation | `roomId`, `reservationId`, occupancy from Hotel Core action | Browser E2E asserts `PROVEN` only after action success |
| Front Office/Folio | stay, folio, payment result values | Browser E2E asserts completed/closed/payment evidence |
| Housekeeping | no completion action in Hotel Core proof | Browser E2E asserts `DIRTY_CANDIDATE` and `NOT_PROVEN`, not ready-for-sale |
| Maintenance | no maintenance request in Hotel Core proof | Browser E2E asserts `NOT_PROVEN` and `BLOCKED_BY_HOUSEKEEPING_PROOF` |

## 7. Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, seed, or production data change.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: changed files remain UI/test/CI only.
2. Contract boundary: no new backend contract or DB field.
3. Tenant isolation: existing Real DB browser proof keeps cross-tenant negative read/update checks.
4. RLS/AuthZ: Real DB E2E must use isolated E2E credentials.
5. Migration safety: no migrations; migration gates may skip.
6. Event-after-persistence: unchanged.
7. UI data/action reconciliation: Browser E2E asserts UI states from existing action result only.
8. Type safety: no `any`, casts, or suppressions.
9. CI scope: route #38 changes require Browser E2E and Real DB evidence.
10. Static check: run lint/typecheck/router unit check where dependencies are available.
11. Closure: seal UI only after CI Browser E2E and Real DB jobs produce PASS evidence.
---

## Additional Architecture Gate - Admin Notification Popover Viewport Fit

> **Status:** PASS - presentation-only notification popover sizing fix.
> **Date:** 2026-10-09
> **Scope:** Shared admin notification bell popover layout only. No notification data semantics, persistence, schema, RLS, server action, routing, Product Registry, Platform/Core, Healthcare H1-H12, Education, or Logistics E7.1-E7.3 change.

### 1. Bella OS/Product Development Process Gate

Truth: the reported issue is a browser-facing overlay layout defect where the notification dropdown can exceed the visible viewport and be clipped by the lower screen edge. Source of truth is the existing notification bell UI and current alert rendering contract. Canonical contract remains the existing `DashboardAlert` list and read/navigation handlers.

Gate decision: `PASS` for a boundary-local Shared UI presentation fix.

### 2. Product Manifest

- Surface: Admin notification bell used by Beauty/Spa dashboard shell and other dashboard products.
- Capabilities in scope: popover viewport-aware max height, internal list scrolling, compact card spacing, and preserved read/open behavior.
- Out of scope: alert generation, unread count semantics, mark-as-read server actions, realtime subscriptions, database migrations, RLS, and product routing rules.

### 3. Ownership Map

| Surface/Data | Owner | Change Authority |
| --- | --- | --- |
| Notification popover positioning | Shared dashboard UI | may adjust presentation sizing |
| Alert rows and unread count | Existing notification/analytics services | read-only, not modified |
| Mark read / mark all read | Notification server actions | consume unchanged handlers |
| Product navigation target | Existing alert link contract | consume unchanged links |

### 4. Contract Dependency Map

```text
AdminNotificationBell
  -> existing DashboardAlert data
  -> existing read/navigation handlers
  -> viewport-aware popover presentation
```

### 5. Change Authority

Authorized: local CSS class changes and inline viewport sizing calculation in `AdminNotificationBell`.

Not authorized: schema, RLS, server actions, alert queries, routing semantics, Product Registry, frozen kernel files, or new notification capabilities.

### 6. UI -> Contract Reconciliation

- The dropdown still renders the same active alerts and existing "Đọc tất cả" / "Xem tất cả thông báo" actions.
- The list scrolls inside the popover when alert count is high instead of letting the whole overlay extend beyond the viewport.
- Alert click behavior and backend read marking remain unchanged.

### 7. Additive Migration Plan

No migration. `NOT_APPLICABLE`.

### 8. 11 Automated Verification Gates Plan

1. `git diff --check`
2. Targeted ESLint on the changed TSX component
3. `npm run typecheck:changed`
4. Static scan confirms no schema/migration/RLS files changed
5. Static scan confirms no Healthcare H1-H12 files changed
6. Static scan confirms no Education kernel files changed
7. Static scan confirms no Logistics frozen artifacts changed
8. Verify popover sizing uses viewport-derived max height
9. Verify notification read/navigation handlers remain unchanged
10. Browser/visual smoke if local auth/runtime is available
11. Final diff review for scope containment

---

# Architecture Gate - Beauty V2 Real DB Cleanup Gate Repair (2026-10-09)

> **Status:** PASS - fixture-only repair for Beauty V2 Real DB cleanup failures blocking the aggregate Real Database Business E2E gate.
> **Scope:** `src/__tests__/beauty-v2-commission-branch-real-db.test.ts` and `src/__tests__/beauty-v2-finance-branch-real-db.test.ts` cleanup paths, the Beauty Spa V2 Real DB worker assertion that was proven sensitive to stale shared outbox rows, plus the minimum CI scope-router update required to run Real DB evidence for those files. No Hospitality backend/UI change, no schema migration, no RLS policy change, no accounting business-rule change, no Healthcare/Education/Logistics kernel change.

## Bella OS/Product Development Process Gate

- Truth: Post-merge `main` CI run `37906928475` attempt 2 failed the aggregate Real Database Business E2E gate on two Beauty V2 cleanup suites, while Hospitality Real DB suites passed in the same run.
- Source of Truth: GitHub Actions job `113746606127` logs, `jest.real-db.config.ts`, `.github/workflows/ci-tests.yml`, and the two failing test files.
- Canonical Contract: Real DB proof fixtures may use service-role Supabase cleanup for marker-scoped test rows; production RLS policies and business runtime contracts must not be weakened to make cleanup pass.
- Gate result: `PASS` for a minimal test-fixture cleanup repair only.

## Product Manifest

- Product: Bella Beauty Spa V2 (`bella_spa`).
- Capability in scope: Real DB proof cleanup for Beauty V2 branch commission and SALARY_PAID finance branch tests, plus current-event-focused Beauty Spa V2 worker assertion under a shared Real DB queue.
- Existing capabilities reused: service-role Supabase test client, existing Real DB Jest lane, existing fixture markers.
- Non-goals: no Hospitality change, no Finance accounting policy change, no RLS/migration/schema/generated type change, no Product Registry change, no UI change.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Beauty V2 commission proof fixture | Beauty V2 test harness | may repair cleanup |
| Beauty V2 SALARY_PAID finance proof fixture | Beauty V2 / Finance proof test harness | may repair cleanup |
| Beauty Spa V2 SESSION_DONE worker proof fixture | Beauty V2 / Finance proof test harness | may focus assertions on the current proof event |
| `salary_records` production semantics | Beauty payroll / HR salary domain | do not change |
| `accounting_worker_runs` observability table | Finance/accounting worker observability | do not change schema or RLS |
| CI scope router | Engineering CI harness | may add the two Real DB test paths so evidence is not skipped |
| Hospitality 7 phases and UI | Hospitality product | not modified |

## Contract Dependency Map

```text
Real Database Business E2E
  -> jest.real-db.config.ts
  -> Beauty V2 commission / finance branch proof fixtures
  -> Beauty Spa V2 SESSION_DONE proof fixture
  -> fixture setup and cleanup
  -> service-role Supabase cleanup for marker-scoped rows
  -> no production contract mutation
```

## Change Authority

Authorized:
- Modify the two failing Beauty V2 Real DB test cleanup paths.
- Modify the Beauty Spa V2 Real DB worker assertion so stale shared queue rows do not invalidate the current proof event.
- Modify `scripts/ci-scope-router.mjs` and its focused router test only to ensure these Real DB test files trigger the Real DB gate.
- Add investigation evidence for the CI failure.
- Update this architecture gate record.

Not authorized:
- Modify Hospitality backend/UI/Real DB suites.
- Modify database schema, RLS policies, migrations, generated types, Product Registry, or accounting legal/business mappings.
- Skip tests or remove business assertions.

## UI -> Contract Reconciliation

- No UI change.
- No UI data/action/state/workflow contract changed.

## Additive Migration Plan

- No migration.
- No schema, table, index, trigger, RLS, generated type, or production data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: verify changed files remain test/investigation/gate scoped.
2. Contract Boundary: preserve production Beauty payroll/finance contracts.
3. Tenant Isolation: cleanup remains marker/id scoped to test rows.
4. RLS & Authorization: do not weaken production RLS; use existing service-role test cleanup contract.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no production event path changed.
7. Domain Safety Routing: no Healthcare/Education/Logistics/Hospitality runtime change.
8. Temporal Provenance: no historical migration or production data rewrite.
9. Rule Governance: no accounting policy or posting rule change.
10. Audit & Evidence Integrity: distinguish targeted fixture PASS from aggregate gate PASS until CI reruns.
11. Regression: run targeted static/lint checks and Real DB CI when credentials are available.

---

## Additional Architecture Gate - Beauty Customer Detail Theme Cards

> **Status:** PASS - presentation-only Beauty customer detail card theme alignment.
> **Date:** 2026-10-09
> **Scope:** Customer detail service cards and active package card should consume the current dashboard theme preset tokens instead of fixed slate/navy backgrounds. No customer, booking, payment, KTV assignment, persistence, schema, RLS, API, Product Registry, Platform/Core, Healthcare H1-H12, Education, or Logistics E7.1-E7.3 change.

### 1. Bella OS/Product Development Process Gate

Truth: the reported defect is visual/theme inconsistency on the Beauty customer detail page. Source of truth is the existing dashboard runtime theme contract: `html[data-tenant-module="beauty_spa"]` plus CSS variables `--primary`, `--primary-hover`, `--primary-foreground`, `--accent`, and contrast-safe fallback values applied by the dashboard layout.

Gate decision: `PASS` for a boundary-local Product UI presentation fix.

### 2. Product Manifest

- Product: Bella Beauty Spa customer detail experience.
- Capabilities in scope: active service selector card, active package hero card, progress track, muted text, and card contrast using theme preset tokens.
- Out of scope: customer data, booking state, session count logic, payment state, KTV assignment, actions, routing, migrations, and server behavior.

### 3. Ownership Map

| Surface/Data | Owner | Change Authority |
| --- | --- | --- |
| Active customer detail cards | Beauty Product UI | may change presentation classes |
| Runtime theme preset tokens | Dashboard theme contract | consume existing variables with safe fallbacks |
| Booking/customer/payment data | Existing Product services/actions | read-only, unchanged |
| Frozen kernels | Healthcare/Education/Logistics | no access |

### 4. Contract Dependency Map

```text
Customer detail page
  -> existing booking/customer state
  -> existing dashboard theme CSS variables and fallback card styles
  -> theme-aware card presentation
```

### 5. Change Authority

Authorized: TSX class updates in the customer detail card components plus semantic CSS rules that use dashboard theme tokens and provide safe fallback rendering before the `beauty_spa` runtime attribute is applied.

Not authorized: schema, RLS, API/server action semantics, ProductRegistry/ProductResolver, payment/booking calculations, or frozen kernel files.

### 6. UI -> Contract Reconciliation

- Active selector card and hero card must preserve the same data and click/action handlers.
- Background color/gradient must derive from the current preset primary token, not fixed `slate`/`indigo` values.
- Text and progress metadata must use foreground/tint tokens or contrast-safe fallbacks with high contrast against the active card background.
- Status badges keep semantic status colors where they already provide readable contrast.

### 7. Additive Migration Plan

No migration. `NOT_APPLICABLE`.

### 8. 11 Automated Verification Gates Plan

1. `git diff --check`
2. Targeted ESLint on changed TSX files
3. `npm run typecheck:changed`
4. Static scan confirms changed card backgrounds consume `var(--primary)` / theme tokens
5. Static scan confirms no customer/booking/payment handlers changed
6. Static scan confirms no schema/migration/RLS files changed
7. Static scan confirms no Healthcare H1-H12 files changed
8. Static scan confirms no Education kernel files changed
9. Static scan confirms no Logistics frozen artifacts changed
10. Browser/visual smoke if local auth/runtime is available
11. Final diff review for scope containment

---

## Additional Architecture Gate - Beauty Customer Detail Edit Modal Field Alignment

> **Status:** PASS - focused customer detail UI form alignment.
> **Date:** 2026-10-09
> **Scope:** Customer detail edit modal should expose the editable customer fields represented by the customer information card, while showing unsupported/static card values as read-only reference. No schema, RLS, API, Product Registry, Platform/Core, Healthcare H1-H12, Education, or Logistics E7.1-E7.3 change.

### 1. Bella OS/Product Development Process Gate

Truth: the edit modal currently omits persisted customer fields already shown on the detail surface. Source of truth is `Database['public']['Tables']['customers']['Update']`, `updateCustomer`, and the existing customer detail card. Canonical contract is tenant-scoped `updateCustomer(id, CustomerUpdate)`.

Gate decision: `PASS` for Product UI form mapping only.

### 2. Product Manifest

- Product: Bella Beauty Spa customer detail experience.
- Capabilities in scope: edit modal inputs for customer notes and loyalty points; read-only reference rows for card values without a proven customer-table write contract.
- Out of scope: customer grouping/source schema, loyalty business rules, referral workflows, migrations, server action semantics, and frozen kernel code.

### 3. Ownership Map

| Surface/Data | Owner | Change Authority |
| --- | --- | --- |
| Customer edit modal | Beauty Product UI | may add form controls for existing customer update fields |
| `customers.notes` / `customers.loyalty_points` | Customer persistence contract | consume existing update contract only |
| Customer group/source semantics | Unproven customer capability | display only; do not invent write contract |
| `customers.created_at` | Customer persistence contract | read-only display |

### 4. Contract Dependency Map

```text
Customer detail card
  -> EditCustomerModal
  -> EditCustomerData
  -> updateCustomer(id, CustomerUpdate)
  -> tenant-scoped customers row
```

### 5. Change Authority

Authorized: TSX/type/state edits needed for modal parity with existing persisted customer fields.

Not authorized: schema fields for group/source, new metadata semantics, generated type edits, RLS/policy changes, API/server-action behavior changes, or kernel files.

### 6. UI -> Contract Reconciliation

- Editable: name, phone, secondary profile fields, gender, address, notes, loyalty points, and location coordinates.
- Read-only until a write contract exists: customer group, customer source, loyalty membership, and created date.
- Loyalty points remain the persisted editable field; loyalty membership remains a display-only value matching the existing card until a canonical write contract exists.

### 7. Additive Migration Plan

No migration. `NOT_APPLICABLE`.

### 8. 11 Automated Verification Gates Plan

1. `git diff --check`
2. Targeted ESLint on changed TSX/TS files
3. `npm run typecheck:changed`
4. Static scan confirms no generated DB type edits
5. Static scan confirms no migration/RLS files changed
6. Static scan confirms no service/API semantics changed
7. Static scan confirms no Healthcare H1-H12 files changed
8. Static scan confirms no Education kernel files changed
9. Static scan confirms no Logistics frozen artifacts changed
10. UI review confirms modal contains editable persisted card fields and read-only unproven values
11. Final diff review for scope containment
---

# Architecture Gate - Hospitality Production Authenticated UI Smoke Workflow (2026-10-09)

> **Status:** PASS - read-only CI verification workflow authorized.
> **Scope:** Add a manually dispatched GitHub Actions workflow and focused Playwright smoke that logs into production with production-specific E2E admin credentials from secrets and verifies `/hospitality/hotel-core-chain` renders the merged Operations Console. No deploy, promote, schema, backend, RLS, auth-bypass, or product runtime change is authorized.

## 1. Bella OS/Product Development Process Gate

- Truth: Hospitality phases 0-7 and the Operations UI are already merged and separately proven by CI, but authenticated production UI smoke remains `NOT_PROVEN`.
- Source of Truth: production route `/hospitality/hotel-core-chain`, existing Playwright real-auth fixture `e2e/fixtures/auth.ts`, existing Hospitality Operations selectors, and GitHub Actions repository secrets.
- Canonical Contract: production UI verification must use the real app authentication path with production E2E admin credentials, prove unauthenticated access is challenged, and remain read-only.
- Gate result: `PASS` for CI/test verification-only implementation.

## 2. Product Manifest

- Product: Bella Hospitality (`bella_hospitality`).
- Capability in scope: authenticated production smoke evidence for the Hotel Operations Console.
- Existing capabilities reused: real-auth Playwright fixture, production route, existing Operations UI selectors, and pinned GitHub artifact upload action.
- Non-goals: no Hospitality backend change, no data mutation, no new operational module, no deploy/promote workflow, no Go-Live claim.
- Evidence boundary: because this is a new manual workflow, the PR can only prove static wiring; `AUTHENTICATED_PRODUCTION_SMOKE` can move to `PASS` only after the workflow exists on `main`, is dispatched against production, and passes.

## 3. Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Production credentials | GitHub Actions Production environment secrets / Platform auth operations | consume only; never log values |
| Hospitality Operations UI selectors | Bella Hospitality Product UI | consume unchanged |
| Production route access | App auth middleware and product route | verify only |
| CI workflow dispatch | Engineering CI harness | may add read-only workflow |
| Hospitality backend, RLS, schema | Bella Hospitality Product persistence | not modified |

## 4. Contract Dependency Map

```text
Manual workflow_dispatch
  -> Production E2E admin credentials from GitHub Secrets
  -> e2e/fixtures/auth.ts real login
  -> /hospitality/hotel-core-chain
  -> existing Operations UI test ids
  -> Playwright JSON result and sanitized evidence
```

## 5. Change Authority

Authorized:
- Add a focused Playwright spec for authenticated production Hospitality UI smoke.
- Add a package script and production-smoke Playwright config pointing only to that spec.
- Add a manually dispatched, read-only CI workflow that runs the spec and uploads sanitized Playwright JSON evidence only.
- Update this architecture gate record.

Not authorized:
- Modify Hospitality product/backend/service code.
- Modify schema, migrations, generated types, RLS policies, seed data, ProductRegistry, or auth middleware.
- Submit the Hotel Core form or mutate production data.
- Use deployment workflows, promote deployments, generic E2E credentials, or bypass app authentication.
- Seal UI operational readiness or Go-Live without the workflow actually passing.

## 6. UI -> Contract Reconciliation

| UI Area | Existing Contract / Evidence | Verification Decision |
|---|---|---|
| Authenticated access | `e2e/fixtures/auth.ts` uses E2E admin credentials and refuses dev mock auth outside localhost | workflow provides production secrets, verifies unauthenticated route redirects to `/login`, and verifies authenticated route is not `/login` |
| Dashboard | existing `hotel-operations-dashboard` selector | assert rendered and still labels unproven data as `NOT_PROVEN` |
| Rooms / Reservations | existing `hotel-operations-room-reservation` selector | assert lane renders, no action submitted and no same-origin mutation occurs |
| Front Office / Folio | existing `hotel-operations-front-office-folio` selector | assert lane renders, no action submitted and no same-origin mutation occurs |
| Housekeeping | existing `hotel-operations-housekeeping` selector | assert lane renders without declaring production proof |
| Maintenance | existing `hotel-operations-maintenance` selector | assert lane renders without marking rooms ready for sale |

## 7. Additive Migration Plan

- No migration.
- No schema, table, index, trigger, RLS, generated type, or production data change.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: changed files remain CI/test/gate/package-script/config scoped.
2. Contract boundary: smoke consumes existing route and selectors only.
3. Tenant isolation: production app auth/RLS remain enforced; no service-role or fixture bypass.
4. RLS & Authorization: require production-specific E2E admin login, fail if unauthenticated access is not challenged, and fail if authenticated access redirects to `/login`.
5. Database Migration Safety: no migration.
6. Event-after-persistence: no mutation or event path touched.
7. Domain Safety Routing: no Healthcare, Education, Logistics, Beauty, or Hospitality runtime code changed.
8. Type safety: no `any`, suppressions, or generated type edits.
9. CI safety: workflow is manual, uses the protected Production environment, and has no deploy/promote/schema steps.
10. Audit & Evidence Integrity: disable trace/screenshot/video and upload only sanitized JSON/result artifacts without credentials or tokens.
11. Closure: `AUTHENTICATED_PRODUCTION_SMOKE` remains `NOT_PROVEN` until the workflow runs and passes on production.

---

# Architecture Gate - Hospitality Production Route Auth Guard (2026-10-09)

> **Status:** PASS - minimal route admission fix authorized by production smoke evidence.
> **Scope:** Protect `/hospitality/hotel-core-chain` with the existing current-user authentication path after workflow run `37934133847` proved unauthenticated production HTML rendered the Operations Console instead of being challenged. No backend, schema, RLS, service, ProductRegistry, deployment, or Hospitality Phase 0-7 change is authorized.

## 1. Bella OS/Product Development Process Gate

- Truth: Manual production smoke run `37934133847` reached the new workflow on `main` with Production secrets, then failed because unauthenticated access stayed on `/hospitality/hotel-core-chain`.
- Source of Truth: production HTTP response and Playwright JSON evidence showing `Bella Hospitality`, `Hotel Operations Console`, and `hotel-core-chain-form` in unauthenticated HTML.
- Canonical Contract: the production Operations Console is an authenticated operational surface; unauthenticated requests must be challenged before any console UI or proof form renders.
- Gate result: `PASS` for a route-only auth guard; `AUTHENTICATED_PRODUCTION_SMOKE` remains `NOT_PROVEN` until the fixed workflow passes on production.

## 2. Product Manifest

- Product: Bella Hospitality (`bella_hospitality`).
- Capability in scope: authenticated admission for the existing Hotel Operations Console page.
- Existing capabilities reused: `src/services/user-actions.ts` current-user resolver, existing `/login` route, existing Hospitality page and server action.
- Non-goals: no new Hospitality module, no Hotel Core chain behavior change, no data write path change, no operational seal or Go-Live claim.

## 3. Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Current user session | Platform auth runtime | read only through existing current-user resolver |
| Hospitality Operations page admission | Bella Hospitality route UI | add minimal guard before rendering |
| Hotel Core chain server action | Bella Hospitality service/action | unchanged |
| Hospitality schema/RLS/Phase 0-7 services | Bella Hospitality backend/contracts | not modified |

## 4. Contract Dependency Map

```text
/hospitality/hotel-core-chain request
  -> src/services/user-actions.ts getCurrentUser()
  -> unauthenticated: redirect('/login?redirect=/hospitality/hotel-core-chain')
  -> authenticated: render existing Operations Console
```

## 5. Change Authority

Authorized:
- Add `force-dynamic` to the route so authentication is evaluated per request.
- Add a server-side current-user check before rendering the Operations Console.
- Redirect unauthenticated users to the existing login route with the Hospitality route as the redirect target.
- Keep the production smoke workflow/spec unchanged so the auth challenge remains enforced.

Not authorized:
- Modify Hospitality backend services, schema, RLS, migrations, generated types, ProductRegistry, auth middleware, secrets, or deployment workflows.
- Submit the Hotel Core proof form or mutate production data.
- Weaken the production smoke test to accept public console rendering.
- Declare UI operational seal or Go-Live from this fix alone.

## 6. UI -> Contract Reconciliation

| UI Area | Existing Contract / Evidence | Verification Decision |
|---|---|---|
| Unauthenticated Hospitality route | production smoke run `37934133847` showed public console HTML | must redirect to `/login` before rendering console |
| Authenticated Hospitality route | existing production smoke logs in through `e2e/fixtures/auth.ts` | must render `Hotel Operations Console` and all operational sections |
| Hotel Core proof form | existing server action already resolves authenticated user and tenant | unchanged; smoke remains read-only and does not submit |

## 7. Additive Migration Plan

- No migration.
- No schema, table, index, trigger, RLS, generated type, or production data change.

## 8. 11 Automated Verification Gates Plan

1. Static scope confirms only route auth guard plus gate/spec documentation changed.
2. Type safety: no `any`, generated type, or suppression added.
3. Auth boundary: unauthenticated request redirects to `/login`.
4. Authenticated boundary: production E2E admin can still render the Operations Console.
5. Read-only production smoke still rejects same-origin mutations.
6. Tenant isolation: page admission uses the existing current-user session; action tenant resolution remains unchanged.
7. Backend contract: no Hospitality product service or repository files changed.
8. Migration safety: no migration files changed.
9. CI safety: regular PR checks must pass before merge.
10. Production evidence: dispatch Hospitality Production UI Smoke on `main` after merge.
11. Closure: keep `HOSPITALITY_UI_OPERATIONAL_SEAL` and `HOSPITALITY_GO_LIVE` as `NOT_PROVEN` unless separately evaluated.

---

# Architecture Gate - Hospitality Production Smoke RSC Redirect Assertion (2026-10-09)

> **Status:** PASS - smoke assertion correction authorized by production evidence.
> **Scope:** Update only the read-only production smoke assertion after run `37938715903` proved the guarded production route no longer renders the Operations Console unauthenticated, but Next returns an RSC redirect digest in the document while the Playwright URL remains `/hospitality/hotel-core-chain`. No Hospitality runtime, backend, schema, RLS, deployment workflow, or sealed Phase 0-7 change is authorized.

## 1. Bella OS/Product Development Process Gate

- Truth: PR #278 is merged on `main`, Vercel deployment for `483e1adb484da38ca922c9b1def6e67034f89e3e` succeeded, and direct production HTTP evidence shows `NEXT_REDIRECT;replace;/login?redirect=%2Fhospitality%2Fhotel-core-chain;307;` instead of the public Operations Console.
- Source of Truth: workflow run `37938715903`, downloaded Playwright JSON artifact, and direct production unauthenticated HTML response.
- Canonical Contract: unauthenticated users must be challenged by app auth before console rendering. The challenge may be browser navigation to `/login` or a Next server redirect digest to `/login`.
- Gate result: `PASS` for smoke-test-only correction; `AUTHENTICATED_PRODUCTION_SMOKE` remains `NOT_PROVEN` until a new run passes on `main`.

## 2. Product Manifest

- Product: Bella Hospitality (`bella_hospitality`).
- Capability in scope: CI evidence collection for authenticated production rendering.
- Existing capabilities reused: production smoke workflow, Playwright spec, existing route guard, and existing Operations UI selectors.
- Non-goals: no UI redesign, no backend/service/action change, no production data mutation, no operational seal, no Go-Live claim.

## 3. Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Unauthenticated route challenge evidence | Read-only production smoke spec | accept `/login` URL or Next redirect digest |
| Operations Console rendering | Bella Hospitality UI | must remain absent for unauthenticated HTML |
| Production authentication/session | Platform auth runtime | unchanged |
| Hospitality backend/RLS/schema | Bella Hospitality contracts | unchanged |

## 4. Contract Dependency Map

```text
workflow_dispatch on main
  -> e2e/tests/40-hospitality-production-auth-smoke.spec.ts
  -> unauthenticated route probe
  -> accept /login URL OR NEXT_REDIRECT digest to /login
  -> require no "Hotel Operations Console" in unauthenticated HTML
  -> authenticated real-admin render checks remain unchanged
```

## 5. Change Authority

Authorized:
- Update the unauthenticated challenge assertion in the production smoke spec.
- Keep the explicit guard that unauthenticated HTML must not contain `Hotel Operations Console`.
- Update evidence documentation.

Not authorized:
- Modify Hospitality runtime route/page code, backend services, schema, migrations, RLS, ProductRegistry, auth middleware, secrets, or deployment workflows.
- Accept public console rendering as a valid auth challenge.
- Declare UI operational seal or Go-Live from this assertion fix alone.

## 6. UI -> Contract Reconciliation

| UI Area | Evidence | Verification Decision |
|---|---|---|
| Unauthenticated route | run `37938715903` failed only on URL expectation; direct HTML has Next redirect digest and no Operations Console | accept valid auth challenge shapes, still fail on console HTML |
| Authenticated route | existing smoke path logs in with production E2E admin | keep existing route, section, runtime, network, and read-only assertions |

## 7. Additive Migration Plan

- No migration.
- No schema, table, index, trigger, RLS, generated type, or production data change.

## 8. 11 Automated Verification Gates Plan

1. Static scope confirms only E2E smoke assertion plus evidence docs changed.
2. Type safety: no `any`, generated type, or suppression added.
3. Auth boundary: unauthenticated response must be a `/login` navigation or Next redirect digest.
4. Privacy boundary: unauthenticated HTML must not render `Hotel Operations Console`.
5. Authenticated boundary: production E2E admin must render the existing Operations Console.
6. Read-only boundary: same-origin mutations remain rejected.
7. Backend contract: no Hospitality runtime, service, repository, schema, or RLS files changed.
8. Artifact safety: no traces, screenshots, videos, HTML reports, credentials, or tokens.
9. CI safety: regular PR checks must pass before merge.
10. Production evidence: dispatch Hospitality Production UI Smoke on `main` after merge.
11. Closure: only `AUTHENTICATED_PRODUCTION_SMOKE` may become `PASS` after a passing run; UI seal and Go-Live require separate evaluation.

---

# ARCHITECTURE GATE RESULT - ANY-TYPE CLEANUP NON-MANUFACTURING

> **Status:** DEFER for full zero-any cleanup; PASS for authorized non-Manufacturing, non-frozen local cleanup subset
> **Date:** 2026-10-11
> **Scope:** Remove scanner-reported `any` usage where the fix is local, proven, and does not touch Manufacturing, Logistics sealed artifacts, or Education Kernel frozen artifacts.

## Bella OS/Product Development Process Gate

- Truth: `npm run check:any-types` reported 91 `any` violations in 21 files before this cleanup.
- Source of Truth: local scanner output from `scripts/check-any-types.js` on this worktree.
- Canonical Contract: Bella Constitution Law 11 forbids `any`; cleanup rules require frozen/sealed residuals to stop at boundary.
- Gate result: `PASS` for local non-Manufacturing cleanup; `DEFER` for remaining frozen/sealed residuals.

## Product Manifest

- Product: none.
- Capability in scope: technical-debt cleanup for scanner findings.
- Non-goals: no Manufacturing changes, no schema/migration, no ProductRegistry, no Logistics E7.1-E7.3 sealed changes, no Education Kernel changes.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Manufacturing API/Auth/E2E | Manufacturing workstream | not modified |
| Logistics E7.1/E7.2/E7.3 residuals | Logistics OS sealed layers | DEFER without ACR/ADR |
| `src/platform/education` residuals | Education Kernel frozen scope | DEFER without architecture authority |
| Real Estate reservation `cancelled` vs `released` | Real Estate contract gap | DEFER; do not alter semantics to satisfy scanner |
| Core pricing-actions test residual | Platform Core freeze scope | DEFER without APPROVED_CORE_CHANGE_V1 metadata |
| Finance/Real Estate generated-contract consumers, Education Product bridge, Customer Intelligence tests | Local owners | type-local cleanup authorized |

## Contract Dependency Map

```text
scanner finding
  -> ownership classification
  -> local typed boundary cleanup when proven
  -> residual DEFER when frozen/sealed or semantic contract gap
```

## Change Authority

Authorized:
- Remove `any` in non-Manufacturing files when contract-preserving and local.

Not authorized:
- Touch Manufacturing.
- Modify Logistics sealed artifacts.
- Modify Education Kernel frozen artifacts.
- Resolve Real Estate reservation lifecycle semantics by guessing.
- Invent schema/RPC/API/generated type contracts.

## UI -> Contract Reconciliation

- No UI redesign.
- No user-facing workflow or action contract change.

## Additive Migration Plan

- No migration.
- No schema, RLS, generated type, or production data change.

## 11 Automated Verification Gates Plan

1. `npm run check:any-types`
2. `npx tsc --noEmit --pretty false --incremental false`
3. `npm run arch:guard`
4. Targeted Jest for changed test/runtime-adjacent areas
5. `git diff --check`

## Residual Any Classification

After the scoped cleanup, `npm run check:any-types` reports 77 residual scanner findings in 17 files. These are not treated as an authorization to continue mechanical edits:

| Residual scope | Count | Classification | Decision |
|---|---:|---|---|
| `src/core/services/order/pricing-actions.test.ts` | 1 | Platform Core freeze scope | DEFER without APPROVED_CORE_CHANGE_V1 metadata |
| `src/platform/education/__tests__/*` | 6 | Education Kernel frozen test scope | DEFER without explicit Education Kernel authority |
| `src/platform/logistics/**` | 69 | Logistics E7.1/E7.2/E7.3 sealed artifacts and regression tests | BLOCKED/DEFER without ACR, ADR, unlock, and full Logistics re-seal |
| `src/platform/real-estate/engines/reservation.service.ts` | 1 | Real Estate reservation lifecycle contract gap: generated status type lacks `cancelled` while code requests cancellation semantics | DEFER pending business/architecture contract decision |

No residual `any` finding is in Manufacturing. No remaining scanner finding belongs to the changed file set.

## Scope Verification

Changed files in this cleanup:

- `ARCHITECTURE_GATE_RESULT.md`
- `src/platform/finance/__tests__/finance-f1-ledger-verification.test.ts`
- `src/platform/real-estate/repositories/property-unit.repository.ts`
- `src/products/bella-education/facilities/bridges/facilities-projection.bridge.ts`
- `src/products/bella-education/parent-engagement/domain/communication.types.ts`
- `src/products/bella-education/parent-engagement/services/communication-exception.service.ts`
- `src/services/intelligence/customer/__tests__/integration.test.ts`

Explicitly not modified:

- Manufacturing files, including the Manufacturing operational readiness E2E/auth workstream.
- `src/platform/education/**` frozen Education Kernel files.
- `src/platform/logistics/**` sealed Logistics E7.1/E7.2/E7.3 files.
- `src/platform/real-estate/engines/reservation.service.ts`; the `cancelled` status residual remains unchanged.

## Local Evidence Snapshot

The scope can be sealed only as a local cleanup subset, not as full Architecture Gate closure:

| Gate | Result | Evidence boundary |
|---|---|---|
| `npm run check:any-types` | FAIL expected | reduced from 91 findings / 21 files to 77 findings / 17 files; residuals classified above |
| `npx tsc --noEmit --pretty false --incremental false` | PASS | compile-only proof, no runtime proof |
| `npm run arch:guard` | PASS | repository architecture guard only |
| `npm run education:architecture:ci` | PASS | Education baseline policy allows the product-layer direct database access reduction and blocks no new signatures |
| `npm run realestate:architecture` | PASS | Real Estate architecture suite only |
| `npm run education:extensions:architecture` | PASS | Education product extension architecture only; does not unfreeze Kernel |
| `npm test -- src/services/intelligence/customer/__tests__/integration.test.ts --runInBand` | SKIP | 36 skipped because the suite is pre-existing `describe.skip`; not counted as PASS |
| `git diff --check` | PASS | whitespace/conflict-marker check only |

GitHub PR #294 was opened against `main`. The first CI run correctly blocked a Core test hunk without approved Core metadata and a new Education direct database access signature; the Core hunk was removed and the Education projection now reuses the existing service/repository path. Therefore the final claim remains: `PASS` for the scoped non-Manufacturing, non-frozen cleanup subset; `NOT_SEALED` for complete Architecture Gate closure and zero-`any` compliance until the updated PR CI run completes.

---

# Architecture Gate - Hospitality Production Smoke Unauthenticated Request Probe (2026-10-09)

> **Status:** PASS - smoke probe isolation fix authorized by production evidence.
> **Scope:** Update only the unauthenticated challenge probe in the read-only production smoke. Run `37942136475` showed the browser-context probe could see authenticated RSC payload even though direct unauthenticated production HTTP still returned the expected Next redirect digest without `Hotel Operations Console`. No Hospitality runtime, backend, schema, RLS, deployment workflow, or sealed Phase 0-7 change is authorized.

## 1. Bella OS/Product Development Process Gate

- Truth: production route guard code is present on `origin/main`; direct unauthenticated HTTP to `/hospitality/hotel-core-chain` returns `NEXT_REDIRECT` to `/login?redirect=%2Fhospitality%2Fhotel-core-chain` and does not contain `Hotel Operations Console`.
- Source of Truth: workflow run `37942136475`, direct production HTTP probe after Vercel success for `fa165e40b18dde4a4163f5b9eed81f684d689b9c`, and the existing Playwright auth fixture behavior.
- Canonical Contract: unauthenticated proof must be isolated from authenticated browser state; authenticated rendering must still be proven in a real browser session.
- Gate result: `PASS` for smoke-test-only probe isolation; `AUTHENTICATED_PRODUCTION_SMOKE` remains `NOT_PROVEN` until a new run passes on `main`.

## 2. Product Manifest

- Product: Bella Hospitality (`bella_hospitality`).
- Capability in scope: CI evidence collection for production auth challenge plus authenticated UI rendering.
- Existing capabilities reused: production smoke workflow, Playwright API request context, existing auth fixture, route guard, and Operations UI selectors.
- Non-goals: no product code change, no backend/service/action change, no production data mutation, no operational seal, no Go-Live claim.

## 3. Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Unauthenticated route challenge evidence | Read-only production smoke spec | use fresh empty-storage HTTP request context |
| Authenticated UI rendering | Playwright real-auth browser fixture | keep browser assertions unchanged |
| Production authentication/session | Platform auth runtime | unchanged |
| Hospitality backend/RLS/schema | Bella Hospitality contracts | unchanged |

## 4. Contract Dependency Map

```text
workflow_dispatch on main
  -> empty-storage APIRequestContext GET /hospitality/hotel-core-chain
  -> require /login challenge and no "Hotel Operations Console"
  -> authenticated adminPage browser render
  -> section, runtime, network, and read-only assertions
```

## 5. Change Authority

Authorized:
- Replace the browser-context unauthenticated probe with a fresh Playwright request context using empty storage/cookies.
- Keep the Operations Console absence check and login challenge check.
- Include sanitized unauthenticated status/location evidence in the JSON artifact.

Not authorized:
- Modify Hospitality route/page code, backend services, schema, migrations, RLS, ProductRegistry, auth middleware, secrets, or deployment workflows.
- Bypass app authentication or use authenticated cookies for the unauthenticated probe.
- Declare UI operational seal or Go-Live from this smoke harness fix alone.

## 6. UI -> Contract Reconciliation

| UI Area | Evidence | Verification Decision |
|---|---|---|
| Unauthenticated route | direct production HTTP is challenged; browser probe was contaminated by authenticated worker context | use isolated HTTP request context with empty storage/cookies |
| Authenticated route | production E2E admin login remains the required browser proof | keep existing render, section, runtime, network, and read-only assertions |

## 7. Additive Migration Plan

- No migration.
- No schema, table, index, trigger, RLS, generated type, or production data change.

## 8. 11 Automated Verification Gates Plan

1. Static scope confirms only E2E smoke assertion plus evidence docs changed.
2. Type safety: no `any`, generated type, or suppression added.
3. Auth boundary: unauthenticated request uses empty storage/cookies.
4. Privacy boundary: unauthenticated HTML must not render `Hotel Operations Console`.
5. Challenge boundary: unauthenticated response must be `/login` navigation/location or Next redirect digest.
6. Authenticated boundary: production E2E admin must render the existing Operations Console.
7. Read-only boundary: same-origin mutations remain rejected.
8. Backend contract: no Hospitality runtime, service, repository, schema, or RLS files changed.
9. CI safety: regular PR checks must pass before merge.
10. Production evidence: dispatch Hospitality Production UI Smoke on `main` after merge.
11. Closure: only `AUTHENTICATED_PRODUCTION_SMOKE` may become `PASS` after a passing run; UI seal and Go-Live require separate evaluation.
# ARCHITECTURE GATE RESULT - BDGF OWNER HASH CI GUARD FIX

> **Status:** PASS - minimal test-only repair for the owner-operated approval guard after the protected Production workflow failed before secrets, approval creation, migration execution, or post-deploy probes.
> **Date:** 2026-10-13
> **Scope:** Make the BDGF owner-approval hash fixture test derive the expected hash from the checked-out fixture content so the guard is not platform line-ending dependent. No migration content change, no workflow scope expansion, no database execution, no Mobility OS, no ProductRegistry, and no kernel changes.

## Bella OS/Product Development Process Gate

- Truth: Production run `38351566779` failed closed in `npm run test:bdgf-owner-authority`; later steps for secrets, BDGF approval, wrapper execution, and Real DB probe were skipped.
- Source of Truth: `scripts/bdgf/test-create-migration-approval.mjs`, `scripts/bdgf/create-migration-approval.mjs`, and the failed GitHub Actions log for run `38351566779`.
- Canonical Contract: owner-operated approval remains verified by BDGF authority evidence; migration execution remains wrapper-only and deferred until the protected workflow passes all guards.
- Gate result: `PASS` for a test-only guard repair. `MIGRATION = NOT_APPLIED` and `POST_DEPLOY_RLS = NOT_PROVEN` remain unchanged.

## Product Manifest

- Product: Bella Auto / Automove workshop security boundary.
- Capability in scope: BDGF owner-operated approval guard reliability in GitHub Actions.
- Non-goals: no migration rewrite, no production SQL path, no Mobility OS, no ProductRegistry, no kernel change, no Bella Auto Go-Live claim.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Owner approval guard tests | BDGF governance | remove platform-specific fixture hash constant |
| Approved workshop RLS migration | Bella Auto workshop persistence | unchanged |
| Production execution | BDGF wrapper / operator | still blocked until workflow passes and probes production DB |

## Contract Dependency Map

```text
test-create-migration-approval.mjs
  -> computeHash(checked-out fixture content)
  -> buildRequestFromArgs()
  -> validate approval request contract
```

## Change Authority

Authorized:
- Modify the focused BDGF owner approval test guard only.

Not authorized:
- Modify approved migration content or hash.
- Execute production migration outside the protected workflow.
- Modify ProductRegistry, kernels, Mobility OS, Logistics/Warehouse/Healthcare/Education, or unrelated Bella Auto features.

## UI -> Contract Reconciliation

- No UI change.

## Additive Migration Plan

- No database migration change.
- No production database mutation in this fix.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to BDGF test and gate record.
2. Contract Boundary: no BDGF runtime approval or wrapper contract change.
3. Tenant Isolation: no database behavior changed.
4. RLS & Authorization: unchanged; production proof remains pending.
5. Database Migration Safety: approved migration hash remains unchanged.
6. Event-After-Persistence: no event path changed.
7. Domain Safety Routing: no unrelated OS/Product files changed.
8. Temporal Provenance: fix responds to failed protected workflow run `38351566779`.
9. Rule Governance: no business rule changed.
10. Audit & Evidence Integrity: failed production workflow remains fail-closed until rerun after this fix.
11. Regression: run `npm run test:bdgf-owner-authority`, `npm run test:bdgf-production-workflow`, `npm run security:secrets`, and `git diff --check`.

---
# ARCHITECTURE GATE RESULT - BASELINE PATH NORMALIZATION FOR MOVED REPOSITORY

> **Status:** PASS - minimal CI baseline identity fix for PR #303 failure.
> **Date:** 2026-10-13
> **Scope:** Fix baseline fingerprint path normalization after the GitHub repository move to `bella-ai-platform`. No baseline ratchet, no lint debt changes, no Product or database change.

## Bella OS/Product Development Process Gate

- Truth: PR #303 failed only on `Baseline Comparison`; required architecture checks and CI aggregate passed. The baseline log reported 73 new ESLint findings using absolute paths under `/home/runner/work/bella-ai-platform/bella-ai-platform/...`.
- Source of Truth: live PR #303 check logs, `.github/workflows/baseline-no-new-debt.yml`, `scripts/ci/baseline/fingerprint.ts`, and `.github/ci/baselines/main.json`.
- Canonical Contract: baseline identities must normalize runner-specific absolute workspace paths to stable repository-relative paths before computing fingerprints.
- Gate result: `PASS` for adding the moved repository path marker and a regression test. `BASELINE_RATCHET = NOT_DONE`.

## Product Manifest

- Product: none.
- Capability in scope: CI baseline fingerprint stability.
- Existing capabilities reused: baseline `completeFinding()` and no-new-debt comparator.
- Non-goals: no baseline file update, no ESLint rule change, no product code, no DB, no migration execution.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Baseline fingerprint identity | CI governance | normalize `bella-ai-platform/` absolute runner paths |
| Historical lint debt | Baseline governance | leave untouched |
| BDGF Production workflow fix | PR #303 branch | keep existing secret-source fix |

## Contract Dependency Map

```text
ESLint JSON absolute filePath
  -> completeFinding()
  -> normalizeFilePath()
  -> stable repo-relative fingerprint
  -> compareBaseline()
```

## Change Authority

Authorized:
- Fix CI baseline path normalization for the moved repository name.
- Add targeted regression test.

Not authorized:
- Update `.github/ci/baselines/main.json`.
- Fix unrelated ESLint debt.
- Change BDGF migration execution, approval authority, or Production secrets beyond PR #303's existing scope.

## UI -> Contract Reconciliation

- No UI change.

## Additive Migration Plan

- No migration.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: CI-only script/test change.
2. Contract Boundary: preserve baseline fingerprint contract.
3. Tenant Isolation: not applicable.
4. RLS & Authorization: not applicable.
5. Database Migration Safety: no migration change.
6. Event-After-Persistence: no app event path changed.
7. Domain Safety Routing: no ProductRegistry, Healthcare, Education, Logistics, Warehouse, Mobility OS, or kernel change.
8. Temporal Provenance: PR #303 remains the delivery vehicle.
9. Rule Governance: no domain rule changed.
10. Audit & Evidence Integrity: no baseline ratchet; only identity normalization.
11. Regression: run targeted baseline Jest test, focused BDGF workflow tests, secret scan, and diff check.

---

# ARCHITECTURE GATE RESULT - BDGF PRODUCTION DB URL SECRET FIX

> **Status:** PASS - minimal workflow secret-source correction for the Bella Auto workshop RLS Production workflow.
> **Date:** 2026-10-13
> **Scope:** Replace the generic `secrets.DATABASE_URL` source with the confirmed canonical `secrets.PRODUCTION_SUPABASE_DB_URL` for read-only BDGF approval creation and post-deploy RLS probing. No SQL change, no executor bypass, no Production mutation from this local session.

## Bella OS/Product Development Process Gate

- Truth: Admin-triggered Production runs reached the approval step but failed before BDGF approval creation with `ENETUNREACH` while the workflow sourced the read-only PostgreSQL URL from `secrets.DATABASE_URL`.
- Source of Truth: workflow run logs, GitHub Actions workflow file, BDGF approval/probe scripts, and the operator-confirmed canonical secret name `PRODUCTION_SUPABASE_DB_URL`.
- Canonical Contract: the protected Production workflow must use the approved Production database URL secret for approval creation and read-only verification, while mutation still goes only through `DATABASE_EXECUTOR_URL` and the BDGF wrapper.
- Gate result: `PASS` for correcting the workflow secret source and adding a static guard. `MIGRATION_EXECUTION = NOT_RUN` for this code change.

## Product Manifest

- Product: Bella Auto / Automove workshop security boundary.
- Capability in scope: Production workflow connection-secret mapping for BDGF approval and post-deploy RLS probe.
- Existing capabilities reused: BDGF owner-operated approval, BDGF wrapper, approved migration artifact, Production environment protection.
- Non-goals: no migration content change, no `db push`, no direct executor invocation, no bulk migration sync, no ProductRegistry, no kernel change.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Production read-only DB URL secret | Production operations / GitHub Actions secrets | use `PRODUCTION_SUPABASE_DB_URL` |
| Approval record creation | BDGF governance | keep `create-migration-approval.mjs` path |
| Production mutation | BDGF wrapper / executor | keep `DATABASE_EXECUTOR_URL` only for execution |
| Workshop RLS proof | Bella Auto workshop persistence | keep post-deploy probe after migration |

## Contract Dependency Map

```text
workflow_dispatch on main
  -> Production environment secrets
  -> PRODUCTION_SUPABASE_DB_URL for approval/probe read connection
  -> DATABASE_EXECUTOR_URL for wrapper execution only
  -> approved migration SHA-256 check
  -> owner_operated approval
  -> execute-migration-wrapper.mjs
  -> post-deploy RLS probe
```

## Change Authority

Authorized:
- Update the Production workflow secret source for approval/probe DB connections.
- Add focused static workflow guard coverage for the canonical secret.
- Update this gate record.

Not authorized:
- Modify migration SQL or approved hash.
- Run Production mutation locally.
- Add a fallback to E2E credentials or a generic DB URL secret.
- Bypass BDGF, weaken owner authority, or change executor behavior.

## UI -> Contract Reconciliation

- No UI change.
- No product user-facing contract change.

## Additive Migration Plan

- No new migration.
- The workflow remains bound to `supabase/migrations/20261013090000_reenable_bella_auto_workshop_rls.sql` and SHA-256 `1FEDCE34702106E86A38D650AAF43FEC52A763F54E66A11187EEF6D3A37C2425`.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to workflow, focused BDGF workflow test, and gate record.
2. Contract Boundary: approval and execution remain on existing BDGF scripts.
3. Tenant Isolation: unchanged; post-deploy probe remains required.
4. RLS & Authorization: unchanged; workflow still requires post-deploy probe before proven status.
5. Database Migration Safety: approved migration hash remains fixed.
6. Event-After-Persistence: no app event path changed.
7. Domain Safety Routing: no Healthcare, Education, Logistics, Warehouse, ProductRegistry, Mobility OS, or kernel files changed.
8. Temporal Provenance: workflow remains manual-only on `main` in Production environment.
9. Rule Governance: no accounting/legal/domain rule changed.
10. Audit & Evidence Integrity: static guard blocks `secrets.DATABASE_URL` from re-entering this workflow.
11. Regression: run focused BDGF workflow tests, owner authority tests, diff check, secret scan, and final diff review.

---

# ARCHITECTURE GATE RESULT - BDGF APPROVAL OUTPUT PARSER HOTFIX

> **Status:** PASS - minimal workflow parser hardening after Production attempt 3 created BDGF approval but failed to extract the approval id from noisy command output.
> **Date:** 2026-10-13
> **Scope:** Parse the approval JSON object from `approval-output.log` without being confused by dotenv tip text. No SQL change, no migration content change, no executor bypass, no Production mutation from this local session.

## Bella OS/Product Development Process Gate

- Truth: Production run `38361647192` attempt `3` created an approved BDGF record, then failed because the inline parser read the first brace in dotenv output (`{ override: true }`) instead of the approval JSON.
- Source of Truth: GitHub Actions failed log, Production read-only approval lookup, workflow parser code, and focused BDGF workflow guard.
- Canonical Contract: the workflow must pass the created `approval_id` to `execute-migration-wrapper.mjs` only after validating that the parsed JSON contains the approved migration hash.
- Gate result: `PASS` for parser hardening. `MIGRATION_EXECUTION = NOT_RUN` for this code change.

## Product Manifest

- Product: Bella Auto / Automove workshop security boundary.
- Capability in scope: Production BDGF workflow approval id extraction.
- Existing capabilities reused: owner-operated approval, fixed migration hash gate, BDGF wrapper execution, and post-deploy RLS probe.
- Non-goals: no migration SQL change, no `db push`, no direct executor invocation, no bulk migration sync, no owner authority relaxation.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Approval output parsing | BDGF workflow | harden parser against non-JSON braces |
| Approval record | BDGF governance | preserve existing create approval script |
| Production mutation | BDGF wrapper / executor | unchanged |
| Workshop RLS proof | Bella Auto workshop persistence | unchanged post-deploy probe |

## Contract Dependency Map

```text
create-migration-approval.mjs stdout
  -> approval-output.log
  -> parse JSON object with approval_id + migration_hash
  -> validate approved SHA-256
  -> expose steps.approval.outputs.approval_id
  -> execute-migration-wrapper.mjs
```

## Change Authority

Authorized:
- Harden approval JSON extraction in the protected Production workflow.
- Add focused static guard coverage for noisy output.
- Update this gate record.

Not authorized:
- Modify migration SQL or approved hash.
- Run Production mutation locally.
- Bypass BDGF, weaken owner authority, or change executor behavior.

## UI -> Contract Reconciliation

- No UI change.
- No product user-facing contract change.

## Additive Migration Plan

- No new migration.
- Existing migration binding and SHA-256 are unchanged.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to workflow, focused workflow test, and gate record.
2. Contract Boundary: approval and execution remain on existing BDGF scripts.
3. Tenant Isolation: unchanged; post-deploy probe remains required.
4. RLS & Authorization: unchanged; workflow still requires post-deploy probe before proven status.
5. Database Migration Safety: approved migration hash remains fixed.
6. Event-After-Persistence: no app event path changed.
7. Domain Safety Routing: no Healthcare, Education, Logistics, Warehouse, ProductRegistry, Mobility OS, or kernel files changed.
8. Temporal Provenance: workflow remains manual-only on `main` in Production environment.
9. Rule Governance: no accounting/legal/domain rule changed.
10. Audit & Evidence Integrity: parser validates approval hash before outputting the id.
11. Regression: run focused BDGF workflow tests, owner authority tests, diff check, and secret scan.

---
# ARCHITECTURE GATE RESULT - MOBILITY OS FOUNDATION MVP

> **Status:** PASS - approved for minimal Mobility OS Foundation MVP implementation.
> **Date:** 2026-10-13
> **Scope:** Create a reusable Mobility OS public contract and runtime foundation for vehicle identity, tenant ownership, lifecycle trace, service-history trace, idempotency, and audit. Reuse existing `auto_*` schema where it already fits. Add only the minimal `mobility_*` OS control tables needed for command idempotency and domain events. Integrate AutoMove through one approved public-contract consumer in this batch. No ProductRegistry entry, no bulk schema rename, no Logistics/Warehouse/Finance change, and no Production mutation.

## Bella OS/Product Development Process Gate

- Truth: Bella Auto already has `auto_*` tables for vehicle identity, owners, lifecycle logs, appointments, repair orders, and service history. It does not yet have a Platform-owned Mobility OS public contract or OS-level command idempotency/audit tables.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, the approved user scope for Mobility OS Foundation MVP, existing Bella Auto migrations `20260803200800`, `20260803210000`, `20260803220000`, `20260803260000`, and the sealed Bella Auto workshop RLS closure evidence.
- Canonical Contract: Product code consumes Mobility through `src/platform/mobility` public exports. Mobility repository adapters own persistence mapping to existing `auto_*` tables and new minimal `mobility_*` control tables. ProductRegistry remains unchanged.
- Gate result: `PASS` for this minimal foundation implementation. `MOBILITY_OS_FOUNDATION_MVP = NOT_PROVEN` remains true until local/static/Real DB/RLS/idempotency/audit checks are run and reported.

## Product Manifest

- Product registry: unchanged and not authorized.
- OS capability: Mobility Foundation, not a standalone product.
- First consumer: Bella AutoMove / Bella Auto vehicle availability route, migrated through a Mobility public contract in this batch.
- Reused persistence: `auto_vehicles`, `auto_vehicle_status_logs`, `auto_vehicle_owners`, and `auto_service_history`.
- New additive persistence: `mobility_domain_events` and `mobility_command_idempotency` only.
- Non-goals: no Bella Auto rewrite, no ProductRegistry registration, no Production execution, no Logistics/Warehouse/Finance overlap, no bulk `auto_*` rename, and no full AutoMove Go-Live claim.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Vehicle identity and VIN lifecycle contract | Mobility OS | Public types/service define reusable contract; existing `auto_vehicles` remains the adapter schema for this MVP |
| Vehicle ownership/user relationship | Mobility OS contract with Auto persistence | Reuse `auto_vehicle_owners`; relationship semantics exposed through Mobility types |
| Workshop appointment / repair workflow | AutoMove Product | Not moved into OS in this batch |
| Service history trace by VIN | Mobility OS contract | Read/trace existing `auto_service_history`; do not rewrite workshop flow |
| Command idempotency | Mobility OS | Add `mobility_command_idempotency` because no shared `auto_*` command log exists |
| Domain audit events | Mobility OS | Add `mobility_domain_events` because no shared `auto_*` domain event log exists |
| Tenant isolation | Platform DB/RLS + Mobility authorization port | Tests must prove same-tenant access and cross-tenant denial for target tables |

## Contract Dependency Map

```text
AutoMove Product Consumer
  -> src/platform/mobility public contract
  -> MobilityFoundationService / Supabase contract adapter
  -> MobilityRepository port
  -> existing auto_* persistence for vehicle/ownership/service trace
  -> mobility_* control tables for idempotency and audit
  -> Platform tenant/RLS helpers
```

## Change Authority

Authorized:
- Add `src/platform/mobility` public contract, service, repository ports, in-memory adapter, Postgres adapter, and Supabase read adapter.
- Add one additive migration for Mobility OS command idempotency, domain events, hardened adapter policies, and minimal adapter grants on existing `auto_*` tables used by the Mobility contract.
- Add tests for architecture scope, service behavior, migration/RLS shape, Real DB/RLS where E2E DB credentials are available, and AutoMove route contract usage.
- Update one AutoMove consumer in the approved batch to call the Mobility public contract.

Not authorized:
- Modify ProductRegistry or create `bella_mobility`.
- Bulk rename or replace `auto_*` schema.
- Modify Logistics, Warehouse, Finance, Healthcare, Education, Manufacturing, frozen kernels, or unrelated Bella products.
- Execute Production mutation from this local session.

## UI -> Contract Reconciliation

- No UI redesign.
- Data/action consumer in scope: `GET /api/bella-auto/vehicles/available` must fetch available VINs via Mobility public contract instead of directly querying `auto_vehicles`.
- Existing workshop UI and full AutoMove product flows remain outside this batch unless tests reveal a direct break caused by the scoped change.

## Additive Migration Plan

- Add `20261013120000_create_mobility_os_foundation_contract.sql`.
- Reuse existing `auto_*` tables for vehicle, owner, lifecycle, and service trace persistence.
- Create only `mobility_domain_events` and `mobility_command_idempotency`, with tenant/org-unit scope, RLS enabled, anon revoked, authenticated SELECT/INSERT only, and service_role maintenance grants.
- Use `public.get_auth_tenant_id()` and `auth.uid()` as the trusted tenant/user source; do not accept caller-supplied tenant context through `app.current_tenant_id` or `app.current_user_id`.
- Replace the historical null-tenant adapter policies on the four Mobility-owned `auto_*` adapter tables before granting runtime privileges.
- Grant only the adapter privileges needed by the contract on existing `auto_*` tables after policy hardening: vehicle read/write without delete, status-log read/insert, ownership read/write without delete, and service-history read-only.
- Do not change Production; migration application is limited to local/E2E verification unless a later Production approval explicitly authorizes it.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to Mobility OS foundation, one AutoMove consumer, additive migration, tests, and this gate record.
2. Contract Boundary: Product consumer imports from `src/platform/mobility`; no ProductRegistry or other OS changes.
3. Tenant Isolation: Real DB test verifies same-tenant trace and cross-tenant denial on target Mobility tables when E2E DB credentials are present.
4. RLS & Authorization: migration-shape test verifies RLS enabled and anon revoked for Mobility control tables.
5. Database Migration Safety: migration is additive and avoids `DROP`, `ALTER TYPE`, table rewrites, and bulk `auto_*` changes.
6. Event-After-Persistence: domain events are recorded after successful persistence inside the service transaction.
7. Idempotency: service tests cover duplicate replay and conflict detection by tenant/operation/business key.
8. Domain Safety Routing: tests assert no Logistics/Warehouse/Finance/ProductRegistry mutation surface appears in the Mobility migration.
9. Regression: targeted Mobility and AutoMove route tests must pass; broader regression reported separately if run.
10. Audit & Evidence Integrity: trace output includes lifecycle, ownership/service history, and Mobility domain events without secrets.
11. Stop Condition: report `PROVEN`, `NOT_PROVEN`, `NOT_READY`, or `HELD` by gate, then stop without expanding product scope.
# ARCHITECTURE GATE RESULT - AUTOMOVE INVENTORY DASHBOARD MOBILITY READ BATCH

> **Status:** PASS - minimal AutoMove inventory dashboard read-side migration is authorized.
> **Date:** 2026-10-13
> **Scope:** Move `src/components/bella-auto/VehicleInventoryDashboard.tsx` vehicle list and summary reads behind the Mobility OS public Supabase contract. Preserve existing dashboard UI behavior, pagination, status filters, VIN/location search, and tenant-scoped access. No write path change, no migration, no ProductRegistry change, no Production mutation, and no other OS changes.

## Bella OS/Product Development Process Gate

- Truth: Mobility OS Foundation and the first AutoMove consumer batch are merged on `main`. `VehicleInventoryDashboard` still directly queries `auto_vehicles` for read-side list pagination and summary counts even though Mobility now owns vehicle identity/lifecycle read mapping.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, PR #307 Mobility Foundation, PR #308 AutoInventoryProvider read-side migration, existing `src/platform/mobility/supabase-vehicle-contract.ts`, and the current dashboard consumer behavior.
- Canonical Contract: AutoMove product UI/read consumers should call Mobility public contract functions for vehicle inventory reads; the Mobility adapter owns persistence mapping to reused `auto_*` tables.
- Gate result: `PASS` for this dashboard read-side consumer only. `AUTOMOVE_WRITE_CONSUMERS_MIGRATED = NOT_PROVEN` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product: Bella AutoMove / Bella Auto dashboard inventory surface.
- OS capability consumed: Mobility vehicle inventory list and status summary read contract.
- Consumer in scope: `src/components/bella-auto/VehicleInventoryDashboard.tsx`.
- Non-goals: no vehicle creation, no lifecycle transition, no booking/workshop/service repair flows, no ProductRegistry entry, no schema migration, no Production deployment.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Vehicle inventory read mapping | Mobility OS | expose paginated dashboard read contract and reuse existing `auto_vehicles` adapter mapping |
| Dashboard table/card presentation | AutoMove Product UI | preserve current UI fields, filters, and pagination behavior |
| Tenant isolation | Supabase RLS plus tenant-scoped query input | preserve tenant filter from authenticated server-provided `tenantId`; do not add service-role bypass |
| Vehicle writes/transitions | AutoMove Product / future Mobility write contract | unchanged in this batch |

## Contract Dependency Map

```text
VehicleInventoryDashboard
  -> src/platform/mobility/supabase-vehicle-contract
  -> Supabase client with authenticated RLS context
  -> reused auto_vehicles persistence
  -> existing AutoMove dashboard row/card response shape
```

## Change Authority

Authorized:
- Extend Mobility public Supabase contract with a paginated inventory list read function that preserves dashboard search/filter semantics.
- Refactor `VehicleInventoryDashboard` list and summary reads to call Mobility public contract functions.
- Add focused static tests proving this dashboard consumer no longer directly reads `auto_vehicles`.

Not authorized:
- Modify write-side vehicle creation or lifecycle transition semantics.
- Add migrations, change RLS, change ProductRegistry, mutate Production, or touch unrelated OS/product scopes.

## UI -> Contract Reconciliation

- No UI redesign.
- Existing dashboard fields, filters, page size, pagination, and status cards must remain compatible.
- This batch moves the data-access boundary only; it does not introduce new UI states, KPIs, actions, or workflows.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to Mobility contract, one AutoMove dashboard consumer, focused tests, and this gate record.
2. Contract Boundary: dashboard imports Mobility public contract instead of direct `auto_vehicles` queries.
3. Tenant Isolation: existing server-provided `tenantId` filter and authenticated Supabase RLS context are preserved.
4. RLS & Authorization: no grants or policies changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no ProductRegistry or other OS/product scope touched.
8. Type Safety: no `any`, suppressions, or generated type edits.
9. Regression: focused Mobility/AutoMove contract tests plus changed typecheck/build.
10. Evidence Integrity: report local/CI proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after this dashboard read-side batch without broad AutoMove rewrite.

---
# ARCHITECTURE GATE RESULT - AUTOMOVE NEXT BEST ACTION SERVICE HISTORY MOBILITY READ BATCH

> **Status:** PASS - minimal AutoMove next-best-action service-history vehicle read migration is authorized.
> **Date:** 2026-10-13
> **Scope:** Move `NextBestActionEngine.analyzeServiceHistory` customer-owned vehicle reads behind the Mobility OS public Supabase contract. Preserve current recommendation timing thresholds, action types, priority/confidence, service appointment lookup, and persistence behavior. No write-side lifecycle, allocation/deallocation, booking, workshop workflow, rollback, schema migration, ProductRegistry, Production mutation, or other OS changes.

## Bella OS/Product Development Process Gate

- Truth: Mobility OS owns reusable vehicle identity and ownership read mapping; AutoMove next-best-action service-history logic only needs customer-owned vehicle identity, display metadata, and creation date to evaluate maintenance reminders.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, merged Mobility public contract in `src/platform/mobility/supabase-vehicle-contract.ts`, current `NextBestActionEngine.analyzeServiceHistory` behavior, and post-#312 direct `auto_vehicles` inventory.
- Canonical Contract: Product read consumers should obtain customer-owned vehicle identity through Mobility public contract functions; the Mobility adapter owns persistence mapping to reused `auto_vehicle_owners`, `auto_vehicles`, and catalog tables.
- Gate result: `PASS` for this read-side service-history signal only. `AUTOMOVE_WRITE_CONSUMERS_MIGRATED = NOT_PROVEN` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product: Bella AutoMove / AI Next Best Action service-history signal.
- OS capability consumed: Mobility customer-owned vehicle read contract.
- Consumer in scope: `src/modules/bella-auto/services/NextBestActionEngine.ts` inside `analyzeServiceHistory`.
- Non-goals: no quotation/test-drive/touchpoint/satisfaction/life-event behavior changes, no service appointment query refactor, no booking/workshop flows, no vehicle lifecycle write migration, no schema migration, no Production deployment.

## Direct Reference Inventory After PR #312

| Category | Files | Decision |
|---|---|---|
| Mobility-owned persistence mapping | `src/platform/mobility/**` | allowed owner of `auto_vehicles` mapping |
| Read-side independent candidate | `NextBestActionEngine.analyzeServiceHistory` | migrate in this batch |
| Read-side candidate but separate scope | `FinancialReportingService`, `WarrantyService` | defer; each needs its own semantic contract |
| Booking/workshop joins | booking table, service appointment/order/history joins | defer by explicit scope boundary |
| Write lifecycle/allocation/rollback | status machine, allocation, rollback, booking POST vehicle update, provider add vehicle | out of scope |
| Tests/generated/scripts/docs | `src/__tests__/**`, generated DB types, scripts, docs | not product consumer migration targets |

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Customer-owned vehicle identity and display metadata | Mobility OS | extend existing customer-owned vehicle read DTO with `createdAt` |
| Maintenance recommendation thresholds and saved next-best-action records | AutoMove Product | preserve existing behavior |
| Last completed service appointment lookup | AutoMove Workshop/Product service path | unchanged in this batch |
| Tenant isolation | Mobility contract plus existing tenant-scoped service appointment query | preserve explicit `tenantId` filters; no service-role bypass |

## Contract Dependency Map

```text
NextBestActionEngine.analyzeServiceHistory
  -> src/platform/mobility/supabase-vehicle-contract
  -> listMobilityCustomerOwnedVehicles
  -> Supabase client with authenticated RLS context
  -> reused auto_vehicle_owners / auto_vehicles / variant-model-brand persistence
  -> existing auto_service_appointments read for last completed service
  -> existing next-best-action recommendation persistence
```

## Change Authority

Authorized:
- Extend the existing Mobility customer-owned vehicle read DTO with `createdAt` from the existing `auto_vehicles.created_at` field.
- Refactor only the scoped `analyzeServiceHistory` vehicle ownership read to call Mobility public contract.
- Add focused tests proving contract mapping and preventing direct `auto_vehicles` access in this service-history signal.
- Update this gate record.

Not authorized:
- Modify vehicle status transition, allocation/deallocation, booking POST allocation, rollback, workshop creation/update flows, financial reporting, warranty workflows, ProductRegistry, generated DB types, migrations, grants/RLS, or Production.

## UI -> Contract Reconciliation

- No UI change.
- Recommendation text still uses a vehicle display name; the display value now comes from canonical Mobility-owned brand/model/variant metadata and falls back to VIN/vehicle ID.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to Mobility read contract, `NextBestActionEngine`, focused Mobility tests, and this gate record.
2. Contract Boundary: `analyzeServiceHistory` imports Mobility public contract instead of direct `auto_vehicles` query.
3. Tenant Isolation: Mobility reads are tenant-scoped and service appointment lookup keeps explicit `tenant_id`.
4. RLS & Authorization: no policies or grants changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: recommendation save path unchanged; no new event path.
7. Domain Safety Routing: no ProductRegistry, other OS, booking/workshop, or lifecycle write path touched.
8. Type Safety: no `any`, suppressions, generated type edits, or compatibility aliases.
9. Regression: focused Mobility static/unit tests, changed typecheck, lint, architecture guard, and security guard.
10. Evidence Integrity: report local/CI proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after this read-side signal batch without broad AutoMove rewrite.

---

# ARCHITECTURE GATE RESULT - AUTOMOVE BOOKING LIST MOBILITY READ BATCH

> **Status:** PASS - minimal AutoMove booking-list vehicle display read migration is authorized.
> **Date:** 2026-10-14
> **Scope:** Move `BookingListTable` vehicle display enrichment behind the Mobility OS public Supabase contract. Preserve the current booking/deposit list behavior and keep booking writes, deposit confirmation, vehicle allocation, status lifecycle, workshop joins, schema, ProductRegistry, Production, and other OS scopes unchanged.

## Bella OS/Product Development Process Gate

- Truth: Mobility OS owns reusable tenant-scoped vehicle display/identity reads; AutoMove booking UI owns booking/deposit presentation and actions.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, current Mobility public contract, sealed read-side batches through #314, and fresh post-#314 direct `auto_vehicles` inventory on `platform/main`.
- Canonical Contract: AutoMove consumers should not join/read `auto_vehicles` directly for vehicle display; they should call Mobility public contract functions and keep product-owned booking data in product queries.
- Gate result: `PASS` for the booking list read-side display enrichment only. `AUTOMOVE_WRITE_CONSUMERS_MIGRATED = NOT_PROVEN` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product: Bella AutoMove / booking deposit list.
- OS capability consumed: Mobility tenant-scoped vehicle display read contract.
- Consumer in scope: `src/components/bella-auto/BookingListTable.tsx` load path.
- Non-goals: no booking creation API, deposit confirmation API, allocation/deallocation, vehicle status update, workshop appointment/order/history joins, financial reporting, rollback, schema migration, ProductRegistry entry, or Production deployment.

## Direct Reference Inventory After PR #314

| Category | Files | Decision |
|---|---|---|
| Mobility-owned persistence mapping | `src/platform/mobility/**` | allowed owner of `auto_vehicles` mapping |
| Read-side independent candidate | `BookingListTable` vehicle display join | migrate in this batch |
| Read-side candidate needing separate semantic proof | `FinancialReportingService` | defer; profit/cost semantics need contract proof |
| Booking write/allocation | booking POST route and vehicle status update | out of scope |
| Workshop joins | service appointment/order/history joins | defer by explicit scope boundary |
| Write lifecycle/allocation/rollback | status machine, allocation service, rollback flows, inventory add vehicle | out of scope |
| Tests/generated types | `src/__tests__/**`, generated DB types | not product consumer migration targets |

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Booking/deposit rows and filters | AutoMove Product | keep `auto_bookings` query in component |
| Vehicle display by assigned vehicle IDs | Mobility OS | expose minimal tenant-scoped display DTO/function |
| Deposit confirmation action | AutoMove Product/API | unchanged |
| Tenant isolation | Supabase RLS plus explicit tenant-scoped contract input | preserve `tenantId` filters; no service-role bypass |

## Contract Dependency Map

```text
BookingListTable
  -> createClient authenticated Supabase context
  -> auto_bookings product query for booking/deposit/customer data
  -> src/platform/mobility/supabase-vehicle-contract
  -> listMobilityVehicleDisplayByIds(tenantId, vehicleIds)
  -> reused auto_vehicles / variant-model persistence
  -> existing booking table rendering and deposit action
```

## Change Authority

Authorized:
- Add a minimal Mobility vehicle display read function by tenant and vehicle IDs.
- Refactor only `BookingListTable` vehicle display enrichment to call Mobility public contract.
- Preserve booking/deposit filters, search, counts, and confirm-deposit action.
- Add focused tests proving tenant-scoped display mapping and no direct booking-list `auto_vehicles` join.
- Update this gate record.

Not authorized:
- Modify booking creation/allocation, deposit confirmation, vehicle status transitions, warranty, financial reporting, workshop flows, rollback flows, generated DB types, migrations, grants/RLS, ProductRegistry, other OS/product scopes, or Production.

## UI -> Contract Reconciliation

- No UI redesign.
- Existing booking table fields remain product-owned.
- Existing assigned-vehicle display values are mapped from Mobility DTO fields: VIN, exterior color, model name, and variant name.
- Current behavior remains assigned-vehicle oriented; unassigned/write allocation behavior is not changed.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to Mobility read contract, booking list consumer, focused Mobility tests, and this gate record.
2. Contract Boundary: booking list imports Mobility public contract and no longer contains a direct `auto_vehicles!inner` join.
3. Tenant Isolation: Mobility display read applies explicit `tenant_id` filtering and ID filtering.
4. RLS & Authorization: no policies or grants changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no ProductRegistry, other OS, workshop, financial, or lifecycle write path touched.
8. Type Safety: no `any`, suppressions, generated type edits, or compatibility aliases.
9. Regression: focused static/unit tests, changed typecheck, lint, architecture guard, and build/security checks as applicable.
10. Evidence Integrity: report local/CI proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after this read-side booking display batch without broad AutoMove rewrite.

---

# ARCHITECTURE GATE RESULT - AUTOMOVE WARRANTY CLAIMS MOBILITY READ BATCH

> **Status:** PASS - minimal AutoMove warranty-claims vehicle display read migration is authorized.
> **Date:** 2026-10-14
> **Scope:** Move only `WarrantyService.getClaimsByStatus` vehicle display enrichment behind the existing Mobility OS public Supabase contract. Preserve warranty/customer claim query semantics, claim statuses, wrapper methods, coverage validation already sealed in PR #314, write workflow, schema, ProductRegistry, Production, and all other OS/Product scopes unchanged.

## Bella OS/Product Development Process Gate

- Truth: Mobility OS owns reusable tenant-scoped vehicle display/identity reads; AutoMove warranty claims own warranty/customer rows, claim status filtering, and review workflow semantics.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, current Mobility public contract, sealed read-side batches through #315, user-approved `AUTO_WARRANTY_CLAIMS_MOBILITY_READ` scope, and fresh direct `auto_vehicles` inventory after PR #315.
- Canonical Contract: AutoMove claim consumers should not join/read `auto_vehicles` directly for vehicle display; they should call Mobility public contract functions and keep product-owned warranty/customer data in product queries.
- Gate result: `PASS` for `WarrantyService.getClaimsByStatus` read-side display enrichment only. `AUTOMOVE_WRITE_CONSUMERS_MIGRATED = NOT_PROVEN` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product: Bella AutoMove / warranty claims read-side service.
- OS capability consumed: Mobility tenant-scoped vehicle display read contract.
- Consumer in scope: `WarrantyService.getClaimsByStatus`.
- Non-goals: no `validateWarrantyCoverage` change, claim creation/update/review workflow change, warranty policy change, booking/allocation/status lifecycle change, workshop join change, schema migration, ProductRegistry entry, Production deployment, or other OS change.

## Direct Reference Inventory After PR #315

| Category | Files | Decision |
|---|---|---|
| Mobility-owned persistence mapping | `src/platform/mobility/**` | allowed owner of `auto_vehicles` mapping |
| Read-side independent candidate | `WarrantyService.getClaimsByStatus` vehicle display join | migrate in this batch |
| Already sealed warranty coverage identity read | `WarrantyService.validateWarrantyCoverage` | unchanged; PR #314 scope remains sealed |
| Read-side candidate needing separate semantic proof | `FinancialReportingService` | defer; profit/cost semantics need contract proof |
| Workshop joins | service appointment/order/history joins | defer by explicit scope boundary |
| Write lifecycle/allocation/rollback | status machine, allocation service, rollback flows, inventory add vehicle | out of scope |
| Tests/generated types | `src/__tests__/**`, generated DB types | not product consumer migration targets |

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Warranty claim rows, status filters, customers relation | AutoMove Product | keep `auto_warranty_claims` query and wrapper semantics |
| Vehicle display by claim vehicle IDs | Mobility OS | call existing tenant-scoped display DTO/function |
| Coverage validation | AutoMove Product using Mobility identity contract | unchanged from sealed PR #314 |
| Tenant isolation | Supabase RLS plus explicit tenant-scoped contract input | preserve `tenantId` filters; no service-role bypass |

## Contract Dependency Map

```text
WarrantyService.getClaimsByStatus
  -> getPrimaryClient authenticated Supabase context
  -> auto_warranty_claims product query for claim/customer/status data
  -> src/platform/mobility/supabase-vehicle-contract
  -> listMobilityVehicleDisplayByIds(tenantId, vehicleIds)
  -> reused auto_vehicles / variant-model persistence
  -> legacy claim DTO shape with optional auto_vehicles display object
```

## Change Authority

Authorized:
- Remove the direct `auto_vehicles(*)` join from `getClaimsByStatus`.
- Reuse `listMobilityVehicleDisplayByIds` to enrich claim rows with display-only vehicle information.
- Preserve claim status filters, customers relation, limit ordering, and wrapper method behavior.
- Add focused regression and static contract tests.
- Update this gate record.

Not authorized:
- Modify coverage validation, claim write/review workflows, warranty policy semantics, booking/allocation, vehicle status lifecycle, workshop flows, rollback flows, financial reporting, generated DB types, migrations, grants/RLS, ProductRegistry, other OS/product scopes, or Production.

## UI -> Contract Reconciliation

- No UI redesign.
- Existing claim display shape is preserved by mapping Mobility DTO fields back into the legacy `auto_vehicles` display object expected by claim consumers.
- Missing vehicle display data remains non-destructive: the claim row is retained and `auto_vehicles` is `null`.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to the warranty read consumer, focused tests, and this gate record.
2. Contract Boundary: `getClaimsByStatus` imports Mobility public contract and no longer contains a direct `auto_vehicles(*)` join.
3. Tenant Isolation: Mobility display read applies explicit `tenant_id` filtering and vehicle ID filtering.
4. RLS & Authorization: no policies or grants changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no ProductRegistry, other OS, workshop, financial, or lifecycle write path touched.
8. Type Safety: no `any`, suppressions, generated type edits, or compatibility aliases.
9. Regression: focused warranty service tests, static contract tests, changed typecheck, lint, architecture guard, and build/security checks as applicable.
10. Evidence Integrity: report local/CI proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after this read-side warranty claims batch without broad AutoMove rewrite.

# ARCHITECTURE GATE RESULT - AUTOMOVE RUNTIME VEHICLE SALE RECOGNITION COMMAND

> **Status:** PASS - runtime command implementation and non-Production ledger posting are authorized under the user-approved scope.
> **Date:** 2026-10-14
> **Scope:** Implement the minimal `recognize_vehicle_sale_revenue` command that validates actor authority and tenant ownership, resolves the approved global accounting policy from `policy_registry`, stores immutable sale-time snapshots in `auto_vehicle_sale_recognitions`, and proves idempotency/RLS behavior on non-Production DB. No Production mutation, no Finance journal posting, no `FinancialReportingService` migration, no Warranty migration, no ProductRegistry change.

## Bella OS/Product Development Process Gate

- Truth: PR #319 already proved the additive ledger schema on `main`; runtime recognition remains missing.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, `docs/architecture/AUTOMOVE_VEHICLE_SALE_REVENUE_CONTRACT_2026_10_14.md`, `docs/architecture/AUTOMOVE_ADDITIVE_SCHEMA_AUTHORIZATION_REVIEW_2026_10_14.md`, and the merged ledger migration `20261014010000_create_automove_vehicle_sale_recognition_ledgers.sql`.
- Canonical Contract: revenue recognition must be an explicit, auditable command. Booking creation, deposit receipt, payment receipt, handover, invoice timing, `PACKAGE_SALE`, and mutable vehicle cost are not accepted substitutes for `sale_revenue_recognized`.
- Gate result: `PASS` for runtime command and non-Production ledger insert verification only.

## Product Manifest

- Product/Domain: Bella AutoMove vehicle sale recognition.
- Capability in scope: runtime initial recognition command for a vehicle sale.
- Persistence artifact in scope: `public.auto_vehicle_sale_recognitions`.
- Explicitly out of scope: adjustment command, Finance journal/TK posting, Financial Reporting migration, Warranty entitlement migration, Production mutation, ProductRegistry, and other OS/Product domains.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Vehicle sale recognition command | AutoMove financial source-of-truth contract | implement minimal command |
| Trusted accounting policy version | Finance/Platform governance via global `policy_registry` | resolve from DB; do not trust caller payload |
| Recognition snapshot | AutoMove ledger schema from PR #319 | insert immutable snapshot only |
| Actor authority | AutoMove command boundary | validate tenant profile and accounting-capable role before service-role insert |
| Journal posting / account mapping | Finance/accounting owner | out of scope |
| Tenant isolation | Platform auth/RLS + command prechecks + DB trigger | fail closed on cross-tenant data |

## Contract Dependency Map

```text
POST /api/bella-auto/vehicle-sale-recognitions
  -> authenticated actor profile from users
  -> AutoMove command service
  -> trusted global policy_registry resolver
  -> tenant-scoped booking / vehicle / customer prechecks
  -> service-role insert into auto_vehicle_sale_recognitions
  -> DB trigger tenant validation + append-only ledger
```

## Change Authority

Authorized:

- Implement a service and API route for initial vehicle sale recognition.
- Use a service-role insert only after explicit actor authority and tenant-boundary validation.
- Reject caller-supplied `accounting_policy_id` / `accounting_policy_version`.
- Add unit tests and non-Production Real DB verification for policy resolution, idempotency, RLS/tenant isolation, and snapshot immutability.
- Update scoped Real DB runner so this command verifier runs for relevant changes.

Not authorized:

- Create or modify schema/migrations in this batch.
- Implement adjustment/reversal runtime command.
- Post Finance journal entries or map Vietnamese accounting accounts.
- Modify `FinancialReportingService`, `WarrantyService`, `AutoSalesProvider`, ProductRegistry, or Production workflows.
- Use `auto_sales` or create compatibility tables for stale consumers.

## UI -> Contract Reconciliation

- No UI change.
- No dashboard/report semantics change.
- This batch exposes a command boundary only; future UI/report consumers require separate authorization.

## Additive Migration Plan

- No new migration.
- Reuse the PR #319 ledger schema already on `main`.
- Verification may apply the existing PR #319 migration transactionally in non-Production test setup if the target E2E DB is behind; transaction must roll back.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to gate, command service/adapter/route, focused tests, and scoped verifier wiring.
2. Contract Boundary: command creates only initial recognition rows; no Finance journal posting or stale `auto_sales`.
3. Tenant Isolation: actor, booking, vehicle, customer, and DB trigger enforce one tenant.
4. RLS & Authorization: authenticated users do not get table INSERT; service role is used only after command prechecks.
5. Database Migration Safety: no new schema mutation; non-Production verifier rolls back fixture data.
6. Event-After-Persistence: no outbox or domain event is emitted before persistence.
7. Domain Safety Routing: Financial Reporting, Warranty, ProductRegistry, and other OS domains remain untouched.
8. Type Safety: no `any` or generated type edits.
9. Regression: unit tests, typecheck, lint, static architecture guard, and scoped Real DB verification.
10. Evidence Integrity: report unit/local/Real DB/non-Production separately from Production; no Go-Live claim.
11. Stop Condition: stop after command proof; do not proceed to reporting/warranty/Production without new authorization.

# ARCHITECTURE GATE RESULT - POLICY REGISTRY USER IDENTITY FORWARD MIGRATION

> **Status:** PASS - user approved `POLICY_REGISTRY_USER_IDENTITY_FORWARD_MIGRATION` for additive non-Production schema implementation.
> **Date:** 2026-10-14
> **Scope:** Create forward migrations that align `policy_registry` with current `public.users` actor identity, remove legacy profile-based policy registry RLS, and seed the active global AutoMove vehicle-sale accounting policy needed by trusted recognition resolution. No `public.profiles` compatibility table, no `policy_history` lifecycle, no Finance posting, no Warranty/commission, no ProductRegistry, no Production mutation.

## Bella OS/Product Development Process Gate

- Truth: `public.profiles` is a legacy reference and is not the current identity contract; `public.users` is the current actor identity used by AutoMove recognition ledgers and platform RLS helpers.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, `20260511000000_initial_schema.sql`, `20260515000000_standardization_phase_1.sql`, `20260521000004_harden_rls_and_tenant.sql`, `20261014010000_create_automove_vehicle_sale_recognition_ledgers.sql`, and user approval for this batch.
- Canonical Contract: AutoMove recognition resolves `AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY` from a trusted active global `policy_registry` row. Caller payload must not provide trusted policy version.
- Gate result: `PASS` for forward migration and non-Production verifier. `AUTOMOVE_FULL_PRODUCT_READINESS` remains `NOT_READY`.

## Product Manifest

- Product/Domain: Bella AutoMove vehicle sale recognition readiness.
- Capability in scope:
  - `public.policy_registry` compatibility with `public.users` actor identity.
  - Active global AutoMove accounting policy v1 row for trusted resolver proof.
  - RLS and minimum grants for active global policy read and service-role governance writes, with legacy profile-based policies removed.
  - Read-only non-Production verifier.
- Explicitly out of scope: `public.profiles`, `policy_history`, tenant-specific policy assignment, Decision Engine lifecycle, Warranty, commission, Finance ledger posting, ProductRegistry, Logistics, Production mutation, and Go-Live declaration.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Actor identity for policy audit fields | Platform identity | use `public.users(id)` |
| Active AutoMove accounting policy identity | AutoMove/Finance governance boundary | create global v1 policy row only |
| Tenant-specific policy behavior | Future Finance/Platform policy scope | not authorized |
| Decision Engine lifecycle/audit history | Platform Decision Engine | not pulled into this batch |
| Production state | Operations/BDGF | no access or mutation authorized |

## Contract Dependency Map

```text
recognize_vehicle_sale_revenue
  -> trusted policy resolver
  -> public.policy_registry
  -> public.users actor identity
  -> auto_vehicle_sale_recognitions immutable snapshot
```

## Change Authority

Authorized:

- Add forward migrations `20261014020000_create_policy_registry_user_identity_forward.sql` and `20261014020100_harden_policy_registry_rls_profile_references.sql`.
- Create/update `public.policy_registry` in non-Production with `public.users` actor FKs.
- Seed exactly the active global `AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY` v1 row.
- Enable RLS and strict grants.
- Add verifier and scoped Real DB runner wiring.

Not authorized:

- Create `public.profiles` or any compatibility alias.
- Pull `policy_history` or full Decision Engine lifecycle into this batch.
- Change runtime recognition semantics beyond trusted policy availability.
- Implement Finance ledger posting, Warranty migration, commission, ProductRegistry, Logistics, or Production deployment.

## UI -> Contract Reconciliation

- No UI change.
- No reporting semantic change.
- This batch only provides trusted policy state required by the existing recognition command.

## Additive Migration Plan

- Additive forward migrations only.
- Preserve historical migration files.
- Fail closed if an existing `policy_registry` still has legacy `public.profiles` foreign keys.
- Remove known legacy `policy_registry_*` RLS policies and fail closed if any policy still references `profiles`.
- Do not silently alter tenant-specific policy semantics; v1 is global only.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to gate, migration, verifiers, and scoped runner wiring.
2. Contract Boundary: `policy_registry` supports active global policy read only; no broader Decision Engine lifecycle.
3. Tenant Isolation: no tenant-specific policy is introduced; global row is explicit and bounded.
4. RLS & Authorization: RLS enabled; authenticated gets SELECT only; no anon/PUBLIC grants; service_role gets governance writes.
5. Database Migration Safety: additive migration; no historical migration rewrite; no Production mutation.
6. Event-After-Persistence: no runtime event or ledger posting path changed.
7. Domain Safety Routing: Warranty, commission, Finance posting, ProductRegistry, and Logistics remain untouched.
8. Type Safety: verifier uses typed unknown guards; no generated type edits.
9. Regression: run migration checks, lint for changed verifiers, scoped runner selection, and non-Production Real DB verifier after migration apply.
10. Evidence Integrity: report local/static/non-Production separately from Production and Go-Live.
11. Stop Condition: if tenant-specific policy, profile FK retention, ledger posting, or Decision Engine lifecycle becomes required, stop for separate approval.

---

# ARCHITECTURE GATE RESULT - AUTOMOVE SALES CHAIN RLS HARDENING

> **Status:** PASS - forward RLS/grants hardening is authorized under the user-approved `AUTOMOVE_SALES_CHAIN_RLS_HARDENING` scope.
> **Date:** 2026-10-14
> **Scope:** Harden `auto_leads`, `auto_bookings`, and `auto_deposits` tenant RLS and authenticated grants for the AutoMove sales chain. Forward migration only; no historical migration rewrite, no Warranty, no Finance ledger posting, no commission, no ProductRegistry, no Logistics, and no Production mutation.

## Bella OS/Product Development Process Gate

- Truth: Non-Production runtime probes showed the sales-chain tables exist, but legacy policies allowed null-tenant fallback; `auto_bookings` lacked authenticated insert permission, while `auto_deposits` granted dangerous authenticated privileges including delete.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, historical migrations `20260803240000_create_auto_leads_bookings.sql` and `20260804310000_create_auto_deposits_tracking.sql`, PR #319-#322 recognition/policy registry proof, and user approval for this hardening batch.
- Canonical Contract: authenticated sales-chain access must be tenant-bound through `public.get_auth_tenant_id()` with no null-tenant bypass; ordinary authenticated users may read/insert/update only within their tenant and must not delete/truncate/reference/trigger these tables.
- Gate result: `PASS` for forward migration plus non-Production Real DB verifier only. `PRODUCTION_MUTATION = NOT_AUTHORIZED` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product/Domain: Bella AutoMove sales chain.
- Tables in scope: `public.auto_leads`, `public.auto_bookings`, `public.auto_deposits`.
- Capability in scope: RLS/grant alignment required before proving booking -> deposit -> handover -> revenue recognition on real non-Production DB.
- Explicitly out of scope: `auto_sales`, Warranty, commission, Finance posting, ProductRegistry, Logistics, service/runtime command changes, and Production.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Lead, booking, deposit rows | AutoMove sales chain | tenant-scoped authenticated read/insert/update only |
| Tenant identity | Platform auth helper `public.get_auth_tenant_id()` | no null fallback; invalid identity fails closed |
| Recognition ledgers and policy registry | AutoMove recognition/policy contracts from PR #319-#322 | keep existing verifiers passing |
| Booking rollback delete behavior | Separate runtime/business decision | not granted in this security batch |
| Production state | Operations/BDGF | not authorized |

## Contract Dependency Map

```text
AutoMove sales-chain routes/services
  -> authenticated Supabase runtime context
  -> public.users actor identity
  -> public.get_auth_tenant_id()
  -> auto_leads / auto_bookings / auto_deposits tenant RLS
  -> later handover -> vehicle sale recognition command
```

## Change Authority

Authorized:

- Add one forward migration that drops legacy null-tenant RLS policies for the three sales-chain tables.
- Grant authenticated only `SELECT`, `INSERT`, and `UPDATE` on the three tables.
- Revoke anon/PUBLIC and authenticated dangerous privileges.
- Add rollback Real DB verifier proving allowed same-tenant behavior and denied delete/cross-tenant/unknown-user behavior.
- Wire the scoped Real DB runner to this verifier and keep PR #319-#322 verifiers in the scoped proof set.

Not authorized:

- Change runtime services, Financial Reporting, Warranty, Finance journal posting, commission, ProductRegistry, Logistics, generated types, or Production state.
- Create `auto_sales` or compatibility schemas.
- Weaken RLS, bypass tenant identity, or grant authenticated delete/truncate/reference/trigger.

## UI -> Contract Reconciliation

- No UI change.
- No API response shape change.
- This batch only aligns database permissions and verifies runtime-like authenticated behavior.

## Additive Migration Plan

- Create `supabase/migrations/20261014020200_harden_automove_sales_chain_rls_grants.sql`.
- Preserve historical migrations unchanged.
- Apply only to isolated non-Production E2E DB for verification.
- Fail closed if required tables are missing, legacy null-tenant policies remain, or authenticated dangerous grants remain.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to gate, one migration, verifiers, and scoped runner wiring.
2. Contract Boundary: no service/runtime or UI mutation.
3. Tenant Isolation: strict `tenant_id = public.get_auth_tenant_id()` policies, no null fallback.
4. RLS & Authorization: authenticated same-tenant read/insert/update works; delete, cross-tenant, and unknown-user access fail.
5. Database Migration Safety: forward migration only; no history rewrite; zero-downtime migration check required.
6. Event-After-Persistence: no event, ledger posting, or recognition command change.
7. Domain Safety Routing: Warranty, Finance, commission, ProductRegistry, Logistics remain untouched.
8. Type Safety: verifier uses typed unknown guards; no generated type edits.
9. Regression: migration check, scoped Real DB verifier, PR #319-#322 verifiers, lint, and diff check.
10. Evidence Integrity: report non-Production proof separately from Production and Go-Live.
11. Stop Condition: if business-role permissions beyond tenant scope are required, report `NOT_PROVEN` and stop for separate authorization.

---

# Architecture Gate - Spa Session Theme and Copy (2026-10-15)

## Waitlist Consumer Addendum (2026-10-15)

Status: PASS for the user-reported waitlist tenant mismatch repair.
Truth: WaitlistContent uses TenantContextProvider. In development that provider
can return the presentation fallback tenantId `dev-tenant` after a timeout or
401. The waitlist API authorizes against getCurrentUser().tenant_id; the
dashboard UserProvider exposes this same authenticated profile.
Manifest: existing waitlist list/detail/filter/stats/add form, no new capability.
Ownership: authenticated user profile owns request tenant; presentation fallback
does not own data access. API/service owns authorization and persistence.
Dependency: waitlist UI -> UserProvider.user.tenant_id -> unchanged waitlist API
tenant checks -> unchanged tenant-scoped waitlist service.
Authority: change only waitlist UI tenant selection/readiness and tests.
Reconciliation: list/stats/filters/add form receive the same authenticated tenant;
detail waits for that profile. Never use fallback/demo tenant for requests.
Migration: none. No auth, API, RLS, Core/Platform or service modification.
Verification gates: (1) scope diff, (2) profile tenant contract, (3) loading/absent
profile, (4) stale/fallback context, (5) list/stats/filter/form propagation,
(6) detail readiness, (7) unchanged 401/403 tenant checks, (8) no persistence
change, (9) focused regression, (10) type/lint/architecture, (11) local runtime
read-only proof distinguished from Production/authenticated Real DB E2E.

Status: PASS for presentation-only repair, expanded by the user's sidebar sweep request.

Expanded authority: audit all 17 active admin menu routes in sidebar.tsx (dashboard,
ai-copilot, customers, bookings, sessions, waitlist, inventory, product-sales, salary,
beauty-spa-v2/chain, accounting, finance/reconciliation, executive, analytics, guides,
services, settings), their rendered UI components and shared brand CSS. Convert
brand backgrounds/foregrounds/hover/shadows to existing semantic theme tokens.
Do not change operational status colors, fixed palette swatches, chart categories,
non-spa product implementations, identity rules or service/backend behavior.
CSS module defaults must not override configured presets or custom inline tokens.

## 1. Development Process Gate

User evidence: BabyCare calendar renders Beauty Spa coordinator copy, fixed blue
appointment cards, and the term "buoi tap" in session details. User authorizes
tenant-preset colors for shared spa surfaces, BabyCare-only identity copy, and
"buoi lieu trinh" terminology for both spa products.
Canonical theme: sidebar applyTenantBrandRuntime -> resolveDynamicThemeTokens ->
primary/primary-hover/primary-foreground CSS tokens. Canonical identity:
useUser().product.productKey from ProductResolver. No new business semantics.

## 2. Product Manifest

Existing Bella BabyCare and Beauty Spa calendar, month view, session cards,
booking/session detail dialogs and spa vocabulary. No product registration.

## 3. Ownership Map

Tenant theme resolver owns palette/contrast tokens; consume unchanged.
Product Identity owns coordinator text; BabyCare opt-in is bella_babycare.
Shared Product UI owns brand classes and labels; customer/order services own
schedule/progress/actions and remain unchanged.

## 4. Contract Dependency Map

Calendar/session UI -> existing timeline/session props and order actions.
UI identity -> existing UserProvider product; theme -> existing runtime tokens.
No Kernel dependency or direct DB access is added.

## 5. Change Authority

Only UI color classes, coordinator identity text, spa terminology and tests/docs.
No loader changes, schema, migration, auth/RLS, services, payment, Finance,
ProductRegistry or frozen Healthcare/Education/Logistics changes.

## 6. UI -> Contract Reconciliation

| UI | Source / decision |
|---|---|
| Active/scheduled calendar card and primary action | tenant primary + paired foreground/hover tokens |
| Selected day/tab, coordinator accent, KTV brand accent | same tenant tokens |
| Coordinator text | BabyCare identity changes copy; Beauty keeps its label |
| Completed/cancelled/overdue state | retain semantic status colors and state logic |
| Session note/title/toasts | user-approved buoi lieu trinh terminology |
| Appointment data and actions | existing contracts; unchanged |

## 7. Additive Migration Plan

No migration required.

## 8. Eleven Verification Gates Plan

1. Scope: presentation, vocabulary and tests/docs only.
2. Contract: no changed DTO/action signature or state calculation.
3. Identity: BabyCare/Beauty/unknown coordinator tests.
4. Theme: rose/jade/custom/dark token browser checks.
5. Semantic status: completed/cancelled/warning remain distinct.
6. Terminology: no buoi tap in affected spa runtime sources.
7. Interaction: date/tab selection and booking callback preserved.
8. Tenant/security: no DB/RLS/auth/service change.
9. Mobile/desktop: screenshots, overflow and text contrast.
10. Type/lint/architecture: run relevant gates.
11. Evidence: scoped regression; synthetic browser proof distinguished from Real DB.

---

# Architecture Gate - BabyCare Customer Card/Form Reconciliation (2026-10-14)

Status: PASS for BabyCare presentation consumer repair.

## 1. Development Process Gate

Truth: user confirms BabyCare has no rooms. Screenshots and source show demo room,
AI scores, photos, CRM labels and dates without matching editable capabilities.
Canonical identity: ProductRegistry `bella_babycare`, resolved by `useUser().product`.
Canonical profile: customer-actions getCustomerById/updateCustomer plus generated
customers Row/Update; booking/session/revenue: getBookingsByCustomerId public action.
Scope is reconciliation of these consumers, not a new business capability.

## 2. Product Manifest

Existing Bella BabyCare, home-care customer detail page: mother/baby profile,
packages, scheduled/completed sessions, confirmed payments, notes and KTV assignment.
Beauty and all other products retain their existing rendering branches.

## 3. Ownership Map

Customer actions own persisted profile fields and audited tenant-scoped updates.
Order actions own booking/session reads and KTV assignment writes. Payment rule
owns confirmed paid totals. BabyCare UI owns labels, empty states and visibility.
No kernel data owner is involved.

## 4. Contract Dependency Map

Product UI -> existing customer/order actions -> existing repositories / public DB.
Product Identity -> existing UserProvider/ProductResolver -> ProductRegistry.
No Healthcare, Education, Logistics or Finance contract dependency is added.

## 5. Change Authority

User authorizes BabyCare-only UI and profile edit reconciliation. Do not alter
customer write actions, payment rules, identity registry, schema, auth/RLS or kernels.
Separate persisted dob_baby/dob_expected inputs reuse the existing write contract.

## 6. UI -> Contract Reconciliation

| UI | Proven source / decision |
|---|---|
| Mother/baby names, gender, dates, address, points, notes | customers fields; editable via existing form |
| Creation date | created_at; automatic/read-only |
| Group / source / loyalty flag / VIP | no proven editable contract; hide on BabyCare |
| Room | not applicable per user; omit |
| Scheduled/completed sessions | session_logs status/date/time/address/duration and KTV relation |
| AI recommendation scores / stock before-after photos / fake activity | no proven producer; omit on BabyCare |
| Money, booking status, end date, empty states | existing booking/revenue contract; preserve zero/null |
| KTV selection | existing ktvs list and updateBooking action; no demo candidates |

## 7. Additive Migration Plan

No migration or schema change needed.

## 8. Eleven Verification Gates Plan

1. Architecture: touched files stay in Product UI/tests/docs.
2. Public contract: reuse existing reads/writes, no direct kernel access.
3. Product isolation: only bella_babycare opts into new rendering.
4. Tenant/RLS: existing actions unchanged; customer action regression.
5. Migration safety: no migration.
6. Persistence/events: existing audited update path unchanged.
7. Profile semantics: mother vs baby, independent dates, no invented CRM data.
8. Null/zero: fixture tests cover missing dates, no bookings/revenues/sessions.
9. Operational semantics: scheduled vs completed, actual staff/location, no room.
10. UX evidence: desktop/mobile render and supported interactions.
11. Regression: scoped Jest/lint/typecheck/architecture; report unrun Real DB separately.

---

# Architecture Gate - Beauty/BabyCare Customer Package Payment UI Repair (2026-10-14)

> **Status:** PASS - scoped Product UI consumer repair for shared Beauty/BabyCare customer detail payment display and edit-package discount preview.
> **Scope:** Fix customer detail presentation so "Da thanh toan" reads confirmed revenue through the existing payment rule engine, clarify that `deposit_amount` is the deposit target in the edit modal, and add a realtime after-discount amount preview. No payment engine, Finance OS, schema, migration, RLS, ProductRegistry, Healthcare, Education, or Logistics change is authorized.

## 1. Bella OS/Product Development Process Gate

- Truth: customer detail bookings already load related `revenue` rows, and `calculateBookingPaymentState()` defines `totalPaid` from confirmed revenue records while `deposit_amount` is only the deposit target.
- Source of Truth: `src/core/services/order/query-actions.ts` customer booking query and `src/lib/business-rules/payment.ts`.
- Canonical Contract: UI must consume `calculateBookingPaymentState()` for price-after-discount, paid amount, deposit due, and remaining debt.
- Gate result: `PASS` for presentation-level consumer correction.

## 2. Product Manifest

- Products: Bella Beauty Spa current implementation and legacy Bella BabyCare customer detail surface.
- Capability in scope: active package card metrics and edit-package admin preview.
- Existing capabilities reused: customer detail booking query, revenue relation, shared payment rule engine, existing money/percent input helpers.
- Non-goals: no new payment semantics, no accounting treatment, no database mutation, no production data fix, no Go-Live claim.

## 3. Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Confirmed paid amount | Shared payment business rule engine | consume only |
| Deposit target | Booking package contract | relabel in UI; do not reinterpret as paid |
| Active package customer card | Product UI consumer | remove hardcoded fallback |
| Discount amount preview | Product UI consumer | derive from full price and discount percent |

## 4. Contract Dependency Map

```text
Customer detail UI
  -> getBookingsByCustomerId()
  -> booking.revenue[]
  -> calculateBookingPaymentState()
  -> render priceAfterDiscount / totalPaid / remainingDebt
```

## 5. Change Authority

Authorized:
- Modify customer detail UI components and focused tests.
- Clarify labels/help text for deposit target.
- Add realtime display of discount percent, discount amount, and after-discount price.

Not authorized:
- Change payment recording actions, Finance OS, accounting outbox, migrations, RLS, auth, ProductRegistry, kernel code, or production data.

## 6. UI -> Contract Reconciliation

| UI Area | Current Issue | Contract Match After Fix |
|---|---|---|
| "Da thanh toan" card metric | hardcoded money fallback can show 4.290.000d when paid is 0 | confirmed revenue total |
| "Con lai" card metric | already uses payment state remaining debt | keep shared rule engine |
| Edit package deposit input | label implies paid amount and deposit are the same | label as deposit target |
| Discount preview | admin cannot see amount impact while editing percent | display computed discount amount and price after discount |

## 7. Additive Migration Plan

- No migration.
- No schema, table, index, trigger, RLS, generated type, or production data change.

## 8. 11 Automated Verification Gates Plan

1. Static scope confirms only customer UI/tests and this gate change.
2. Type safety: no `any`, type suppression, generated type edit, or schema invention.
3. Payment contract: paid amount remains confirmed revenue.
4. Deposit contract: deposit field remains deposit target.
5. Discount contract: after-discount amount uses shared payment rule.
6. UI copy: no label presents deposit target as confirmed payment.
7. Hardcode guard: active card does not fallback to demo paid amount.
8. Tenant/product boundary: no Beauty/BabyCare branching or ProductRegistry change.
9. Security boundary: no auth/RLS/service-role behavior change.
10. Focused unit/static audit tests cover the regression.
11. Closure: report only targeted proof; browser/Real DB/production remain `NOT_RUN` unless separately executed.

---

# ARCHITECTURE GATE RESULT - AUTOMOVE SALES CHAIN REAL DB ALIGNMENT

> **Status:** PASS - non-Production Real DB alignment verification is authorized under the user-approved `AUTOMOVE_SALES_CHAIN_REAL_DB_ALIGNMENT` scope.
> **Date:** 2026-10-14
> **Scope:** Prove the existing AutoMove sales-chain capabilities operate on the same non-Production database data: booking, deposit, vehicle handover through Mobility lifecycle, vehicle-sale revenue recognition, and recognized-sales reporting. No schema migration, no new runtime API, no `auto_sales`, no Warranty migration, no commission, no Finance journal posting, no ProductRegistry change, and no Production mutation.

## Bella OS/Product Development Process Gate

- Truth: PR #319-#323 already proved the additive ledger schema, recognition command, reporting reads, policy registry identity, and sales-chain RLS hardening on `main`.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, the merged AutoMove recognition/policy/RLS migrations, the Mobility public lifecycle contract, and the non-Production E2E database.
- Canonical Contract: vehicle sale recognition remains an explicit command after booking/deposit and handover evidence exist. Deposit receipt and handover persistence are separate facts and do not themselves post Finance journals.
- Gate result: `PASS` for rollback Real DB verification only. `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product/Domain: Bella AutoMove sales chain.
- Capability in scope: Real DB proof of `Booking -> Deposit -> Vehicle Handover -> Revenue Recognition -> Financial Reporting`.
- Explicitly out of scope: new schema/migration, `auto_sales`, Warranty, commission, Finance ledger posting, ProductRegistry, Logistics, browser UI, Production deployment, and Go-Live declaration.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Booking and deposit rows | AutoMove sales chain | prove tenant-scoped authenticated persistence |
| Vehicle handover lifecycle | Mobility OS public lifecycle contract | prove `allocated -> delivered` persists vehicle fields, status log, and domain event |
| Revenue recognition snapshot | AutoMove recognition command | prove trusted policy, idempotency, and immutable snapshot |
| Reporting sales/profit read | AutoMove reporting read-side | prove recognized sale rows feed reporting math |
| Finance journal posting | Finance/accounting owner | out of scope |
| Production state | Operations/BDGF | not authorized |

## Contract Dependency Map

- Authenticated AutoMove actor
- `auto_bookings` / `auto_deposits` tenant RLS
- `MobilityFoundationService.transitionVehicleStatus`
- `auto_vehicles` + `auto_vehicle_status_logs`
- `recognizeVehicleSaleRevenue`
- `auto_vehicle_sale_recognitions`
- recognized-sales reporting query

## Change Authority

Authorized:

- Add one fail-closed rollback verifier for the existing non-Production Real DB chain.
- Wire scoped Real DB CI to run this verifier for AutoMove sales-chain alignment changes.
- Update this gate record.

Not authorized:

- Add or alter schema/migrations.
- Add new product runtime behavior or browser UI.
- Post Finance journals, infer commission, migrate Warranty, create `auto_sales`, modify ProductRegistry, change Logistics, or mutate Production.

## UI -> Contract Reconciliation

- No UI change.
- This batch proves DB/service capability only; browser/user workflow proof remains a later Go-Live evidence item.

## Additive Migration Plan

- No migration.
- No schema, RLS, grant, generated type, or data change.
- Verification runs inside a rollback transaction and refuses the Production project ref.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to gate, verifier, and scoped Real DB runner wiring.
2. Contract Boundary: use existing AutoMove sales-chain, Mobility lifecycle, recognition, and reporting contracts.
3. Tenant Isolation: exercise authenticated tenant context and cross-tenant denial.
4. RLS & Authorization: same-tenant booking/deposit/handover works; invalid/cross-tenant reads remain denied.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: lifecycle status log/domain event occurs after vehicle update in the same transaction.
7. Domain Safety Routing: Warranty, commission, Finance posting, ProductRegistry, and Logistics remain untouched.
8. Type Safety: verifier uses typed guards; no `any`, suppressions, or generated type edits.
9. Regression: run existing #319-#323 verifiers plus the new chain verifier and scoped runner list.
10. Evidence Integrity: report non-Production Real DB proof separately from Production and Go-Live.
11. Stop Condition: if a missing handover contract, schema change, or Finance posting is required, stop for separate approval.
# AUTOMOVE HANDOVER TO RECOGNITION E2E - 2026-10-14

Result: PASS for the user-approved non-Production implementation batch.

## Process, Manifest, Ownership And Authority

Evidence: PR #319-#324; user approval for financial snapshots, explicit
approval by active tenant accountants/finance managers, same actor allowed.
AutoMove owns booking, approved financial source snapshots and recognition.
Mobility owns vehicle transitions and their persisted status-log evidence.
Platform owns authenticated identity and Storage document access.
No ProductRegistry, Logistics, Warranty, commission, Finance journal or
Production change is authorized. Existing sealed batches remain intact.

## Contract And UI Reconciliation

Booking UI -> dedicated sale-chain API -> authenticated AutoMove service ->
Mobility public transition/trace contract -> persisted handover status log.
Approval UI -> separate approval request -> authenticated Storage downloads
and SHA-256 checks -> server approval actor/time. This is a human document
verification action, not automated legal/accounting document interpretation.
Recognition UI -> only snapshotId/handoverEvidenceId -> persisted approved
snapshot, tenant-bound evidence -> existing recognition command -> ledger.
These UI actions are approved contract additions, not implicit revenue from
handover, booking status or deposit. Source amounts are not taken from mutable
booking total_price or vehicle cost_price. Snapshot idempotency/transaction
identity is preserved across retries.

## Additive Migration Plan

One AutoMove financial-source snapshot table with tenant RLS, business-reference
validation, draft-only authenticated inserts, server-only approval updates,
immutable approved rows, document references/checksums, unique business keys
and minimal grants. No historical migration changes. Apply only for authorized
non-Production verification; use rollback tests and clean up API/browser fixtures.

## Business Test Contract And 11 Verification Gates

1. Architecture: Product consumes Mobility public exports; frozen files unchanged.
2. Authorization: trusted active accountant/finance_manager required for approval.
3. Tenant: snapshot/booking/customer/vehicle/evidence must share tenant.
4. Persistence: handover creates status log before returning its evidence ID.
5. Revenue: handover and approval alone create no recognition.
6. Documents: inaccessible, missing, empty, or checksum-mismatched files rejected.
7. Immutability: approval data/amounts cannot be changed or deleted afterward.
8. Idempotency: same snapshot/transaction retry yields one recognition.
9. Financial truth: ledger matches approved snapshot despite mutable vehicle costs.
10. Quality: focused tests, scoped typecheck/lint, migration/architecture guards.
11. Real DB/browser: allowed chain, wrong role/inactive/tenant, draft, missing
evidence, retry and ledger read-back; report each executed layer separately.

## Execution Checkpoint

Implementation remains local on codex/automove-handover-recognition-e2e.
Migration 20261014030000 was applied only to the authorized E2E project using
the existing explicit-file migration runner; Production was not accessed.
The migration also provisions the private AutoMove evidence bucket and two
tenant/accounting-role policies on the existing Platform Storage contract.

Runtime typecheck, focused unit tests and lint passed. The accountant path
previously passed Real DB plus browser component/HTTP dispatcher verification
with actual Supabase Auth/Storage and rollback business fixtures. The browser
proof is component/dispatcher evidence, not a full Next.js dashboard journey.
The complete current verifier fails closed at finance_manager fixture creation:
the existing public.users users_role_check does not permit finance_manager.
No Platform identity constraint was changed and no simulated role was used.
Approved actor authority cannot be fully proved from the current identity source.

SNAPSHOT_APPROVAL_AUTHORITY_SOURCE = NOT_PROVEN_FOR_FINANCE_MANAGER
AUTOMOVE_HANDOVER_TO_RECOGNITION_E2E = NOT_PROVEN
PRODUCTION_MUTATION = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY

Temporary Auth profiles/documents were removed. Tagged tenant test fixtures
were archived using canonical terminated status because an existing timeline
soft-delete/FK contract prevents cascading physical tenant deletion.
No commit, PR or seal is claimed at this execution boundary.

## Accountant-Only Authority Revision

Architecture/process result: PASS for the explicit owner-approved revision.
The owner limits this batch to active `accountant` actors from Supabase Auth ->
`public.users`, with a tenant matching the snapshot. No `finance_manager`
support or admin alias is authorized. Platform identity and users_role_check
remain unchanged. The existing public.users role/status/tenant source is reused;
no user_roles fallback or parallel permission mechanism is introduced.

Minimal implementation: restrict the AutoMove service and add forward migration
20261014030100 to restrict snapshot trigger, snapshot RLS and private document
policies. Preserve applied migration 20261014030000. Approval remains a separate
server request that records approved_by/approved_at; approved data is immutable.
The same accountant may explicitly recognize afterward. Mobility handover alone
must not recognize revenue. All other ownership and UI contract boundaries above
remain unchanged. Production mutation is not authorized.

Business verification contract: an active tenant accountant may persist a draft,
verify documents, approve, hand over and explicitly recognize once. Admin and
other roles, inactive/missing identity, wrong tenant, unapproved snapshot and
missing/invalid evidence must fail closed. Snapshot and recognition retries retain
the persisted transaction/idempotency identity. Run Real DB chain, authenticated
Storage and browser component/HTTP tests, existing recognition/reporting tests,
fresh typecheck, lint, architecture guard and migration/diff checks. Evidence is
pending; this authority approval is not a passing test or a main/Production seal.

## Accountant-Only Verification Result

Executed on the authorized non-Production E2E database:

- Explicit-file runner applied forward migration 20261014030100; read-only
  inspection confirms both snapshot migrations recorded and users_role_check
  unchanged. Historical migration 20261014030000 was not rewritten.
- `verify-automove-handover-recognition-e2e.ts --browser`: PASS, including real
  Supabase Auth, private Storage, draft/approval, persisted Mobility handover,
  explicit recognition and ledger read-back in a rollback business transaction.
- Admin/admin_staff, inactive actor, missing identity and wrong tenant rejected
  by the service and relevant DB policies/trigger; finance_manager is excluded
  by runtime unit test and absent from snapshot/document policy predicates.
- Draft snapshot, client-supplied approval/financial fields, missing documents,
  checksum mismatch and missing handover evidence rejected. Approval retry
  preserves actor/time; handover and recognition retries preserve their IDs.
- Ledger contains one recognition: approved net sale 1,400,000,000 VND, frozen
  cost 1,000,000,000 VND, confirmed receipts 100,000,000 VND and receivable
  1,300,000,000 VND. Mutable booking/vehicle amounts do not replace snapshots.
- Existing schema, recognition command, reporting, policy identity, sales-chain
  RLS and Real DB alignment verifiers: all six PASS.
- Focused Jest: 3 suites, 15 tests PASS. Full TypeScript, targeted ESLint,
  Architecture Guard, CI scope-router regression, zero-downtime checks for both
  migrations and git diff --check: PASS.
- Browser desktop/mobile component + authenticated HTTP dispatcher evidence:
  PASS with no page errors or mobile horizontal overflow. This harness does
  not prove the full Next.js dashboard route. Screenshots are local cache only.
- Temporary Auth/profile/document fixtures removed; tagged empty E2E tenants
  archived using the existing terminated status. Business rows rolled back.

Non-blocking diagnostics: existing ESLint ignore-file deprecation; pg concurrent
query deprecation during the chain verifier. Neither was treated as a passing
test substitute or fixed through an unrelated Platform/Mobility change.

SNAPSHOT_APPROVAL_AUTHORITY = PROVEN_ACCOUNTANT_ONLY_ON_E2E
FINANCE_MANAGER_ROLE_SOURCE = NOT_PROVEN_EXCLUDED
AUTOMOVE_HANDOVER_TO_RECOGNITION_E2E = PROVEN_FOR_SCOPED_NON_PRODUCTION_HARNESS
IMPLEMENTATION = LOCAL_VERIFIED_PENDING_FINAL_REVIEW
MAIN_CI_SEAL = NOT_PERFORMED
PRODUCTION_MUTATION = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY

No commit, push, PR, Production deployment or PROVEN_ON_MAIN claim in this batch.

## Final Review - Changes Required (Historical Checkpoint)

Review performed against all 13 tracked/new scoped files, excluding screenshot
cache, at base 61777e1ea (current platform/main). BMAD Blind Hunter, Edge Case
Hunter and Acceptance Auditor ran read-only; the Lead validated and triaged
their findings. No implementation, migration, role or Production change was
made during this review.

The previously executed E2E/quality checks remain valid for their tested cases;
they do not prove the untested boundaries below or override blocking findings.

| Priority | Finding | Evidence / Minimum Follow-up |
|---|---|---|
| P1 | Handover lacks booking allocation binding | AutoMoveSaleChainService.handover passes booking.vehicle_id to Mobility but does not verify vehicle.allocatedToContractId equals booking.id. Mobility verifies the lifecycle transition, not the AutoMove booking binding. Add a Product-side public-trace check and a different-booking allocation denial test. |
| P1 | Connection target guard inspects a different representation than pg | AutoMoveSaleChainHttp and verifier validate URL.hostname/username. pg honors host/user query overrides. A local no-network probe confirmed a whitelisted URL hostname with host=example.invalid yields effective pg host example.invalid. Validate effective driver configuration or reject endpoint/user overrides before connecting; retain Production refusal. |
| P1 | Runtime SQL disables TLS peer verification | AutoMoveSaleChainHttp explicitly uses rejectUnauthorized:false for Supabase. The application connection needs a verified server certificate/trusted CA, not only a matching URI. Do not silently relax TLS as a credential/network workaround. |
| Decision | Invalid persisted drafts have no correction path | createSnapshot rejects changed drafts, trigger permits only draft->approved, and unique booking/vehicle prevents replacement. Bad amounts or documents permanently block this sale. Owner must approve a narrow draft-only correction/replacement rule before schema/API changes; approved snapshots must remain immutable. |
| P2 | Recognition retry re-reads mutable inputs | Existing matching recognition is loaded but current deposits and active policy are still checked. Later changes can make a retry fail despite a persisted recognition. Return the tenant-authorized, snapshot/evidence-bound existing record without recomputing historical inputs; test changed deposits and expired policy. |
| P2 | Real DB CI lacks the public Auth/Storage key | ci-tests.yml real-db-e2e passes URL/service key/DB URL but no public key. Verifier requires NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or ANON_KEY. The repository already has E2E_SUPABASE_PUBLISHABLE_KEY; wire it into this scoped verification path, never substitute service-role authentication. |
| P2 | Bearer Auth is not forwarded to Storage | Existing createClient.auth.getUser handles a Bearer header by updating PostgREST headers, not Storage headers. New approval downloads use Storage. Verify and propagate the actual user session for Bearer-only approval, or explicitly document/enforce the approved cookie-only interface without changing Platform auth. |
| P2 | Mismatched existing evidence is not tested | Verifier rejects random missing IDs but does not exercise a persisted delivery log from another booking/customer/vehicle/tenant. Add negative DB evidence fixtures and assert no recognition inserted. |
| P2 | Failure cleanup can leave live fixtures | Initial profile/tenant transaction is not tracked for rollback; one Storage cleanup failure short-circuits later Auth/profile cleanup; unexpected cross-tenant upload is not tracked for removal. Make cleanup independent and always rollback open fixture transactions, including failing setup/negative tests. |

Reviewed non-blocking boundary: Production refusal in the new handler is
intentional under the non-Production authorization. No claim is made that a
Production recognition caller is proven operational. Do not restore the legacy
client-money/policy path as a workaround. Production endpoint/deployment
readiness remains separate and unauthorized.

Additional read-only evidence: migration check with platform/main baseline PASS,
both new migration versions recorded, no new drift beyond the 426 historical
baseline migrations; no attempt to bulk apply those migrations. Temporary
automove-proof Auth/profile residue counts are both zero. Scoped secret-pattern
scan found no credential literals in the proposed files.

FINAL_REVIEW = CHANGES_REQUIRED
COMMIT_PUSH_PR = NOT_PERFORMED
MAIN_SEAL = NOT_PERFORMED
PRODUCTION_MUTATION = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY

Stop before commit/PR. Resolve the draft-correction owner decision and apply
only approved boundary-local fixes, then rerun affected Real DB/quality checks.
Browser evidence remains component + authenticated HTTP dispatcher; full
Next.js dashboard journey is NOT_PROVEN.

## Approved Final-Review Remediation

Owner approval: draft-only correction through a separate server API, preserving
snapshot/transaction/idempotency IDs; active tenant accountant only. Approved
snapshots remain immutable. Forward migration 20261014030200 replaces only the
AutoMove snapshot trigger, without changing historical migrations or grants.
Only financial values and document references can change on a draft; approval
must verify the current values/documents again. Booking, tenant and identity
links cannot be edited. Repeated identical correction requests are deterministic.

Also authorized in this batch: Product-side booking allocation binding through
Mobility public trace; effective-driver connection validation and authenticated
TLS; original-record recognition retry; CI public key; Bearer Storage session;
failure-safe verifier cleanup and genuine mismatched evidence tests. No Platform
identity, Finance posting, Warranty, commission or Production change is allowed.
Architecture/process result: PASS for this explicit scope, with all verification
results still pending. No additional architecture gate is created.

## Remediation Verification And Final Review

The historical findings above are resolved within the approved batch:

- Separate draft-update API restricts financial/document fields, retains snapshot,
  sale transaction and idempotency IDs, and rejects approved records. Migration
  20261014030200 changes only the Product snapshot trigger; authenticated UPDATE
  remains revoked. Historical migrations are unchanged.
- Approval verifies a server-computed content reviewHash plus current financial
  values and real Storage documents. A changed draft rejects stale approval; UI
  verification is bound to the displayed hash and cleared on changed refresh.
  This hash is a concurrency guard, never a source of money/policy/authority.
- Handover checks allocatedToContractId via Mobility public trace. Serializable
  API transactions protect the checked allocation from concurrent change. No
  Mobility/Logistics kernel modification or automatic revenue recognition.
- Recognition retries authenticate the active tenant accountant and immutable
  snapshot/evidence/key binding, then return the original record without current
  deposit/policy/booking/vehicle eligibility changing historical amounts.
  First recognition still checks current eligibility and active trusted policy.
- Runtime and new verifier use explicit parsed driver configuration, reject host,
  user/port/TLS query overrides, and authenticate certificate AND hostname with
  the public Supabase Root 2021 CA. Verified TLS connection to E2E passed.
  Sources: https://node-postgres.com/features/ssl and
  https://supabase.com/docs/guides/platform/ssl-enforcement.
- Bearer Auth and Storage share the real user client/session; no privileged
  Storage fallback. Existing E2E publishable key is wired into Real DB CI.
- Cleanup rolls back failed setup, independently attempts each fixture cleanup,
  tracks cross-tenant upload paths, and closes browser/listener even on launch
  failure. No Platform identity/constraint, ProductRegistry, Finance posting,
  Warranty, commission or Production change.

Executed final evidence:

- New Real DB + --browser verifier PASS with actual Auth/Storage, serializable
  rollback business chain, draft correction/retry, stale review denial, separate
  approval, allocation denial, persisted mismatched evidence for booking/customer/
  vehicle/tenant, explicit recognition, immutable snapshots and historical retry.
- Ledger read-back: exactly one recognition, net sale 1.4 billion VND, cost
  1 billion, receipts 100 million and receivable 1.3 billion, all snapshot-bound.
- Browser refresh/correction regression PASS, including X -> Y -> X content;
  prior human verification never resumes automatically. Desktop/mobile render
  without page errors or horizontal overflow. This is component + authenticated
  HTTP dispatcher proof, NOT the entire Next.js dashboard route.
- 4 focused unit suites / 30 tests PASS; fresh full TypeScript and targeted
  ESLint PASS; Architecture Guard, scope-router regression and diff-check PASS.
- All 6 existing AutoMove schema/command/reporting/policy/RLS/alignment verifiers
  PASS. Zero-downtime checks PASS for the 3 new migration files; E2E migration
  check PASS with no new drift beyond the historical platform/main baseline.
- Injected setup-transaction, setup, cleanup and browser-launch failures exited
  fail-closed as expected. Independent DB read-back found zero test Auth actors,
  public profiles and documents. Business fixtures were rolled back; tagged empty
  tenants were archived under the existing terminated/soft-delete contract.
- Final Blind Hunter, Edge Case Hunter and Acceptance Auditor findings were
  independently re-reviewed and resolved. No unresolved blocker remains.

FINAL_REVIEW = PASS_FOR_APPROVED_SCOPE
NON_PRODUCTION_REAL_DB_E2E = PASS_EXECUTED
LOCAL_VERIFICATION = PASS_EXECUTED
COMMIT_PUSH_PR = AUTHORIZED_NEXT
MAIN_SEAL = NOT_PERFORMED
PRODUCTION_MUTATION = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY

Only this batch is eligible for commit/PR. CI/main verification remains pending;
the local proof does not authorize merge, Production rollout or Go-Live.

---

## AutoMove Next.js Dashboard Sales Chain Verification - 2026-10-15

Process gate: PASS for scoped browser verification, not a new capability gate.
Baseline: PR #327, main 83ff2e357f49e17fc9b9d5a390f00e75e2ac29df.
Single-agent execution. Do not reopen the sealed service/DB batch.

Product manifest: existing AutoMove booking dashboard and sale-chain dialog.
Problem: component/HTTP dispatcher proof does not prove the Next.js route.
Owner-approved business test contract: real login and tenant-scoped booking and
deposit must precede a separately approved immutable financial snapshot,
Mobility handover evidence, and explicit idempotent recognition. Neither deposit
nor handover automatically recognizes revenue. An active same-tenant accountant
uses the existing contracts; client financial/policy input is not recognition
truth. Ledger amounts must match the approved snapshot, not current vehicle cost.

Ownership map: Platform owns Auth/public.users and tenant context; Mobility owns
vehicle display, allocation and handover contracts; AutoMove owns booking,
snapshot approval, recognition and their UI consumers. Test fixtures belong only
to the authorized bmnbqbcdbuklhopfbopv E2E project.
Dependency map: actual Next.js login/dashboard -> existing APIs/public contracts
-> Auth/Storage and tenant-scoped DB. No mock login, request interception,
dispatcher substitute, new identity mechanism or internal kernel access.

Change authority: browser tests and proven local UI consumer defects only.
Missing/contradictory lower-layer contracts require a separate user decision.
No schema/migration, ProductRegistry, frozen OS, Warranty, commission, Finance
posting, Production access or deployment.
UI reconciliation: booking modal and deposit action consume the existing APIs;
sale dialog consumes the PR #327 API. Read-only E2E schema inspection found that
the catalog APIs request absent auto_models.year and auto_variants.base_price /
features fields. Booking API also does not persist allocated_to_contract_id.
These findings are not permission to invent replacement values or change the
allocation write contract. Confirm the first executable blocker in the browser.
Additive migration plan: NONE.

Verification plan (11 scoped checks): baseline provenance; actual Next.js route;
real Auth without mock cookies; tenant context; catalog/booking boundary;
deposit persistence; separate approved snapshot; Mobility handover; explicit
recognition/read-back and retry; negative authorization/error UI; teardown and
diff/lint/type checks. Stop at the first proven contract boundary, report all
unexecuted downstream checks NOT_PROVEN, and retain the failing regression.
Use random temporary test identities; never persist passwords or auth traces.
Keep immutable financial test history if created; archive only the tagged test
tenant and remove the temporary Auth identity. Do not disable guards for cleanup.

FULL_DASHBOARD_BROWSER_E2E = NOT_PROVEN
PRODUCTION_MUTATION = NOT_AUTHORIZED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY

Executed checkpoint:

- Actual Next.js 16.3.8 (package-lock version), localhost:3217, Chromium; real
  Supabase Auth login, automatic AutoMove dashboard redirect, visible sidebar
  Booking navigation, booking modal and tenant customer search executed.
  No mock_user_email, injected browser session, API mock or HTTP dispatcher.
- The full-chain test fails at the brand catalog step: GET
  /api/bella-auto/vehicles/brands returns 500, PostgreSQL 42703:
  column auto_brands.logo_url does not exist (brands/route.ts:28).
  Screenshot shows an empty brand selector, with no useful visible error.
  This is PRE_EXISTING / STALE_CONSUMER against verified E2E schema, not a
  regression in the sealed recognition implementation and not a Production claim.
- Read-only E2E schema evidence: brands have id/name/country_of_origin;
  models have id/name/segment, not year; variants have id/name/year/fuel_type/
  transmission/specs_json, not description/base_price/features.
  The latter two API mismatches are schema/source findings, NOT successful
  execution of those UI steps. No substitute pricing source was selected.
- Source trace additionally shows booking POST changes vehicle.status without
  allocated_to_contract_id. Handover explicitly checks that binding. This remains
  a source-level downstream concern, NOT an executed handover failure in this run.
- Booking creation, deposit, snapshot, handover, recognition, historical retry
  and wrong-role/cross-tenant browser paths are NOT_RUN behind the catalog blocker.
  PR #327 service/DB proof remains sealed and unchanged.
- Local runtime dependency junction caused the initial startup failures, before
  fixture setup. Preserved the junction under ignored scratch ownership and used
  npm ci without lockfile changes to run the real Next.js server. Initial runs
  are ENVIRONMENT / NOT_RUN, not Product PASS.
- The latest browser fixture uses only the existing bella_auto module manifest,
  no invented ProductRegistry identity. A cold automatic dashboard redirect was
  fixed in the TEST by awaiting its actual navigation, not increasing global
  timeouts or changing application routing.
- Independent read-only teardown check found zero matching Auth actors, active
  public profiles, active fixture tenants, documents and recognitions. Fixture
  profiles are inactive and tenants archived under the existing lifecycle; no
  financial guard, RLS or migration history was disabled/changed.
- Full typecheck, targeted ESLint, Architecture Guard and diff check passed.
  These quality checks do not convert the failed browser chain into PASS.

RUNTIME_CODE_MUTATION = NOT_PERFORMED
SCHEMA_MIGRATION = NOT_PERFORMED
FULL_DASHBOARD_BROWSER_E2E = NOT_PROVEN
CATALOG_SCHEMA_COMPATIBILITY = FAIL_PROVEN_ON_E2E
NEXT_ACTION = OWNER_DECISION_FOR_MINIMAL_CATALOG_API_UI_ALIGNMENT
COMMIT_PUSH_PR = NOT_PERFORMED
PRODUCTION_MUTATION = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY

Approved catalog delta - 2026-10-15:

The owner explicitly approved canonical catalog UI/API alignment in this batch.
Only the brands, models and variants GET routes and CreateBookingModal may change.
Keep existing Auth and tenant filters. Brands/models expose id/name; variant year
belongs to auto_variants, not auto_models. Remove logo_url, description, features
and base_price consumption. Booking price stays explicitly entered per agreement;
neither current inventory price nor any fabricated catalog value substitutes it.
Catalog HTTP failures must be visible, not silently presented as empty results.
No new public abstraction, schema/migration, allocation write, recognition,
policy, ProductRegistry, other OS or Production change is authorized.

Acceptance: canonical catalog responses load through the actual authenticated
dashboard; the pricing input is blank before explicit entry; focused route tests
retain auth/tenant/error boundaries; fresh typecheck, lint, guard and diff-check.
Re-run the full dashboard regression and stop at the next proven scope boundary.
Unexecuted downstream business-chain checks remain NOT_PROVEN, even if catalog
passes. Existing PR #327 service/DB proof stays sealed.

CATALOG_ALIGNMENT_AUTHORITY = APPROVED_FOR_SCOPED_IMPLEMENTATION
SCHEMA_MIGRATION = NOT_AUTHORIZED
PRODUCTION_MUTATION = NOT_AUTHORIZED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY

Catalog alignment execution and owner stop decision - 2026-10-15:

- Changed exactly the three catalog GET routes and CreateBookingModal. Auth and
  tenant filters are unchanged. Variant year is canonical in selection/review;
  agreed booking price is explicitly entered, without inferred catalog pricing.
  Catalog HTTP failures now have a visible alert. No other runtime file changed.
- Two focused route/component suites: 21 tests PASS, including canonical fields,
  auth/tenant boundaries, absent parent IDs, empty catalog, database/HTTP errors,
  blank agreed-price input, explicit price entry and the final review display.
- Actual Next.js dashboard + real Auth rerun: FAIL at brand catalog, HTTP 500,
  PostgreSQL 42501, permission denied for auto_brands. The prior 42703 nonexistent
  column error is no longer reported. Screenshot confirms the new visible alert.
  No booking/deposit/snapshot/handover/recognition step ran in this execution.
- Independent READ ONLY E2E inspection: RLS is enabled on auto_brands, auto_models
  and auto_variants, but authenticated SELECT is false on all three. Their current
  ALL policies contain get_auth_tenant_id() IS NULL fallback. Merely granting
  SELECT would not establish a fail-closed identity/tenant contract.
- Historical grants migrations 20260804120000 and 20260804400000 grant broad CRUD
  across multiple tables; neither was applied or modified. No policy/grant change.
- Teardown read-back: zero tagged Auth actors, active profiles, active tenants,
  Storage documents, bookings or recognitions. Fixture profiles were deactivated
  and tenants archived; immutable-history protections were not bypassed.
- Architecture Guard PASS. ESLint has zero errors and one pre-existing
  handleSelectVehicle effect dependency warning. Next-generated AGENTS.md text
  was removed from this batch's diff after the test server stopped.
- Owner explicitly selected: keep the DB unchanged and stop at this blocker.
  No forward migration or additional implementation is authorized by this run.

CATALOG_ALIGNMENT = IMPLEMENTED_LOCAL_UNIT_VERIFIED
CATALOG_REAL_DB_BROWSER_READ = BLOCKED_BY_EXISTING_GRANTS
FULL_DASHBOARD_BROWSER_E2E = NOT_PROVEN
TYPECHECK = PASS_EXECUTED
DIFF_CHECK = PASS_EXECUTED
DB_GRANTS_RLS_MUTATION = NOT_PERFORMED
SCHEMA_MIGRATION = NOT_PERFORMED
COMMIT_PUSH_PR = NOT_PERFORMED
PRODUCTION_MUTATION = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY
NEXT_ACTION = STOP_AT_CATALOG_DB_AUTHORIZATION_BOUNDARY

## AutoMove Catalog Read Authorization - 2026-10-15

Process gate: PASS for the explicitly owner-approved three-table forward change.
This supersedes the earlier stop decision only for catalog read authorization.
Single-agent execution; no additional architecture gate or review document.

Manifest: existing AutoMove booking catalog, not a new product/capability.
Business invariant: an authenticated active identity may read catalog records
only for its active tenant. Missing identity/profile/tenant, inactive tenant and
cross-tenant reads must not expose records. No implicit HQ/global exception.
Source: owner approval in this conversation; inspected E2E catalog/schema/RLS;
existing Auth -> public.users identity contract and tenant-owned catalog schema.
Ownership: Platform retains identity/helpers; Mobility owns catalog persistence
mapping; AutoMove remains the existing UI/API consumer. No ownership transfer.
Dependency: actual dashboard -> existing catalog routes / Mobility reads ->
authenticated Supabase RLS -> public.users / tenants identity and status checks.

Authority: one forward migration limited to auto_brands, auto_models and
auto_variants, plus scoped tests/verifier and Non-Production application.
Do not change shared helpers, historical migrations, ProductRegistry, write
grants/policies, Logistics, recognition, Finance, Warranty or Production.
UI reconciliation: no further UI/runtime correction in this authorization delta;
reuse the canonical catalog alignment and actual dashboard regression already
implemented locally. Stop at the next unrelated contract boundary.

Migration plan: add 20261015010000_authorize_automove_catalog_tenant_reads.sql.
Keep existing permissive ALL/write policies intact; add restrictive SELECT guards
so legacy NULL fallback cannot bypass the read predicate. Grant SELECT only to
authenticated and revoke SELECT from anon/PUBLIC. A no-authenticated-writers
precondition fails closed rather than silently changing an existing write path
whose row selection may also require SELECT policy approval. Do not alter a
Platform helper or add a SECURITY DEFINER function. Missing tables/dependencies,
unexpected anonymous column grants or absent permissive read policies fail closed.

Verification plan (11 checks): exact three-table scope; canonical Auth/tenant
source; same-tenant data read-back; cross-tenant denial; missing identity/profile/
tenant; inactive actor and suspended/terminated tenant; HQ no cross-tenant bypass;
anon privilege denial versus RLS-filtered empty rows; pre/post write ACL and
policy/helper fingerprints; idempotent migration and rollback fixture teardown;
actual Next.js Browser E2E plus focused tests/typecheck/lint/guard/diff checks.
Non-Production migration persistence must use the existing explicit-file E2E
applier with verified TLS; no manual history repair or bulk migration apply.

ARCHITECTURE_DECISION = APPROVED
MIGRATION_IMPLEMENTATION = AUTHORIZED_FOR_THREE_CATALOG_TABLES
NON_PRODUCTION_VERIFICATION = AUTHORIZED
DASHBOARD_BROWSER_E2E = NOT_PROVEN
PRODUCTION_MUTATION = NOT_AUTHORIZED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY

Catalog authorization executed checkpoint - 2026-10-15:

- Migration 20261015010000 was applied durably to the explicitly authorized E2E
  project bmnbqbcdbuklhopfbopv using the existing explicit-file E2E applier.
  Exactly one new history entry was added; no bulk apply or manual history repair.
  PostgreSQL TLS certificate and hostname verification remained enabled.
- The three tables retain RLS and gain authenticated SELECT only. Restrictive
  SELECT guards require auth.uid(), an active public.users profile and its matching
  active tenant. Existing ALL/write policies are preserved, including their old
  text: the NULL-tenant fallback is blocked for reads, not rewritten globally.
  Before/after fingerprints confirm non-SELECT ACLs, column ACLs, non-SELECT
  policies and shared helper definitions are unchanged. Migration fails closed
  if authenticated catalog writers exist and require a separate impact review.
- Migration rehearsal executed twice in a rollback transaction. Durable-state
  verifier also passed: exact same-tenant rows, cross-tenant denial, missing
  identity/profile/tenant, inactive actor, suspended/terminated tenant, no HQ
  cross-tenant bypass, forged tenant claims, anon denial (42501), unchanged write
  authorization and complete rollback of verifier identities/catalog fixtures.
- Actual Next.js 16.3.8 + Chromium + real Supabase Auth browser execution now
  receives HTTP 200 and the exact fixture records from all three catalog APIs.
  Variant year 2026 displays, VIN selection works, the agreed-price input starts
  blank, and no invented listing price is shown. Explicit booking price and
  deposit requirement persist as 1,500,000,000 and 100,000,000 VND respectively.
  A scoped cold-compilation response wait and exact placeholder selector corrected
  test execution issues; no global timeout, runtime, auth or RLS bypass was added.
- The full dashboard regression fails at booking allocation read-back, not
  catalog: POST /api/bella-auto/bookings returns 200 and creates one booking, but
  auto_vehicles.status = allocated while allocated_to_contract_id = NULL.
  bookings/route.ts updates status without that binding or the canonical allocation
  command. The sealed handover service requires allocatedToContractId = booking.id
  and has ALLOCATION_MISMATCH protection. This is an executed booking persistence
  defect; handover rejection itself was NOT_RUN, not claimed as an HTTP result.
- Deposit confirmation, snapshot approval, handover, explicit recognition and
  retry remain NOT_RUN in this browser execution. Keep the failing regression;
  do not patch fixture allocation, skip the assertion or reopen PR #327 proof.
  Allocation write correction is outside the current catalog change authority.
- Independent READ ONLY read-back confirms persisted migration/grants and the
  allocation defect. Teardown has zero tagged Auth identities, active profiles,
  active test tenants, Storage documents and recognitions. One test booking is
  preserved in its terminated tenant; no financial/RLS guard was disabled.
- Focused Jest: 3 suites / 24 tests PASS. Fresh full strict typecheck PASS.
  Scoped ESLint: zero errors, one pre-existing handleSelectVehicle dependency
  warning. Architecture Guard, one-file zero-downtime check and diff-check PASS.
  Next-generated AGENTS.md delta was removed after the test server stopped.
- The older broad grants versions were not applied by this batch and have no
  entries in inspected E2E history; this does not prove they were never run by
  another path. No historical migration or other OS/runtime file was changed.

CATALOG_MIGRATION = APPLIED_AND_RECORDED_ON_E2E
CATALOG_REAL_DB_RLS = PROVEN_ON_NON_PRODUCTION
CATALOG_BROWSER_READ = PROVEN_FOR_THREE_CATALOG_ROUTES
CATALOG_WRITE_CONTRACTS = UNCHANGED_VERIFIED
BOOKING_ALLOCATION_BINDING = FAIL_PROVEN_ON_E2E
FULL_DASHBOARD_BROWSER_E2E = NOT_PROVEN_BLOCKED_BY_BOOKING_ALLOCATION
COMMIT_PUSH_PR = NOT_PERFORMED
MAIN_SEAL = NOT_PERFORMED
PRODUCTION_MUTATION = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY
NEXT_ACTION = OWNER_AUTHORIZATION_FOR_SCOPED_BOOKING_ALLOCATION_FIX

## Booking Allocation Correction - 2026-10-15

Process gate: PASS for the owner's explicit E2E-only booking/allocation approval.
Reuse the current batch/worktree and this gate; do not introduce another gate doc.
Manifest: existing AutoMove booking with a selected VIN, not a new capability.
Approved business invariant: a successful VIN booking must have exactly its own
Mobility allocation binding. Retrying one submission must not create another
booking/allocation; different payloads/tenants must not steal the binding.
Evidence: owner decision; actual dashboard POST 200 followed by READ ONLY E2E
read-back of allocated status with NULL contract ID; sealed PR #327 handover
checks that allocatedToContractId equals booking.id. Existing Mobility transition
owns lifecycle persistence, command idempotency, status audit and domain events.
Ownership: AutoMove owns booking/customer orchestration; Mobility owns vehicle
lifecycle/allocation. Identity and tenant authority remain Platform-owned.
Dependency: booking UI -> existing POST route -> Product transaction -> public
MobilityFoundationService / PostgresMobilityRepository -> tenant RLS persistence.
No Product SQL vehicle read/write or legacy VehicleAllocationService shortcut.
Authority: scoped VIN booking orchestration, stable submission retry key, tests
and non-Production verifier. No status graph, helper, RLS, schema, historical
migration, Logistics, Finance, Warranty, ProductRegistry or Production changes.
UI reconciliation: retain the existing form/response and no-VIN branch; add only
a stable Idempotency-Key for retries of the same submission, reset on form close.
Additive migration plan: NONE. Use existing booking PK/metadata and Mobility
command ledger. Booking+allocation share a serializable authenticated transaction;
failure rolls back both without deletion/compensation or service-role escalation.
Server verifies active profile/active tenant, the customer/vehicle tenant, variant
and color binding. Booking UUID is the retry key; metadata binds actor/payload.
Reusing the UUID for changed inputs is a conflict, not an update or new booking.
Preserve historical allocation on a valid retry; do not re-run a transition after
later delivery. Contention/serialization failures require retry, not partial PASS.
11 verification checks: route/public-contract boundary; real Auth/active tenant;
booking ID equals allocation ID; actor/time/status persistence; valid retry;
changed-payload conflict; second-booking denial; tenant/customer/variant mismatch;
transaction rollback and lifecycle/command/event counts; actual dashboard read-back
and teardown; focused regressions/typecheck/lint/Architecture Guard/diff check.
Stop at an unrelated downstream browser failure rather than weakening its test.

BOOKING_ALLOCATION_FIX = AUTHORIZED_FOR_E2E_IMPLEMENTATION
SCHEMA_MIGRATION = NOT_REQUIRED_BY_THIS_DELTA
DASHBOARD_BROWSER_E2E = NOT_PROVEN
PRODUCTION_MUTATION = NOT_AUTHORIZED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY

Booking allocation executed checkpoint - 2026-10-15:

- VIN booking POST now delegates to Product-owned authenticated serializable
  orchestration and the existing public Mobility transition. No direct Product
  auto_vehicles query, legacy allocation shortcut or service-role escalation.
  Booking, customer creation when needed, allocation, command log, status audit
  and domain-event persistence commit together or roll back. No-VIN path retained.
- Dashboard submission retains a UUID Idempotency-Key across failed requests;
  server uses the existing booking PK and actor/payload metadata, without schema
  changes. A valid retry reads the existing binding, not another transition.
  Changed input and second booking keys conflict. Transient serialization/deadlock
  errors require retry; persistent unique-data conflicts are not mislabeled as
  transient. Existing canonical status graph was not extended for warehouse VINs.
- Real DB rollback verifier PASS: exact booking/allocation binding, actor/time,
  unchanged valid retry, one booking/command/status log/domain event; changed
  payload, wrong tenant/customer/variant/color and inactive actor denied.
  Injected event-write failure rolled back booking, newly-created customer and
  allocation together. Injection is a rollback test, not a natural DB failure.
  Initial fixture phone collision and incorrect command-table lookup were
  corrected; failed executions were not counted as PASS. No migration/RLS changes.
- Actual Next.js dashboard with real Supabase Auth PASS for catalog -> agreed
  price -> booking/allocation -> two authenticated HTTP retries. Durable READ ONLY
  read-back shows booking 961653f9-a153-4b49-9bf1-ebd82f3ed6ae equals its vehicle's
  allocated_to_contract_id, with allocated status, actor/time and one record in
  each Mobility audit/event/idempotency source. No current price substituted the
  explicitly-entered 1,500,000,000 VND booking agreement.
- Full browser regression then FAILS at confirm-deposit: HTTP 404. Next.js runtime
  reports synchronous params.id access in bookings/[id]/confirm-deposit/route.ts:33;
  params is a Promise. Booking exists in DB; deposit count is zero. This pre-existing
  downstream route was not modified. Snapshot/handover/recognition browser steps
  remain NOT_RUN. No assertion, Auth/RLS rule or business contract was bypassed.
- Independent READ ONLY cleanup: zero tagged Auth actors, active profiles/tenants,
  rollback fixture tenants, Storage documents and recognitions. Preserve the
  immutable proof booking and its allocation in a terminated test tenant; do not
  repair the earlier legacy unbound booking or disable guards for teardown.
- Seven focused Jest suites / 52 tests PASS; fresh full strict typecheck PASS;
  Architecture Guard and diff-check PASS. ESLint has zero errors and the existing
  handleSelectVehicle dependency warning. Existing Mobility trace query scheduling
  emits a pg deprecation warning; no unrelated repository refactor was performed.
  Next test server stopped and its generated AGENTS.md delta was removed.
- No Platform/Mobility implementation, Logistics, Finance, Warranty, registry,
  environment file or Production change; no staging, commit, push or PR.

BOOKING_TO_ALLOCATION = PROVEN_ON_E2E_AND_ACTUAL_DASHBOARD
BOOKING_ALLOCATION_RETRY = PROVEN_FOR_TESTED_RETRIES
BOOKING_ALLOCATION_LOCAL_VERIFICATION = PASS
FULL_DASHBOARD_BROWSER_E2E = NOT_PROVEN_BLOCKED_AT_CONFIRM_DEPOSIT
MAIN_SEAL = NOT_PERFORMED
SCHEMA_MIGRATION = NOT_PERFORMED_BY_ALLOCATION_DELTA
PRODUCTION_MUTATION = NOT_PERFORMED
COMMIT_PUSH_PR = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY
NEXT_ACTION = APPROVAL_FOR_SCOPED_CONFIRM_DEPOSIT_ROUTE_COMPATIBILITY

## Deposit Confirmation API Correction - 2026-10-15

Process gate: PASS for the owner's explicitly approved E2E-only API correction.
Manifest: existing booking deposit confirmation; no new payment/Finance feature.
Truth: the actual Next.js request reports synchronous params.id access and HTTP
404 despite a persisted booking. Installed Next route.md requires Promise params
and await. E2E auto_deposits matches its existing migration/generated types.
Ownership: AutoMove owns the booking/deposit consumer; Platform retains Auth,
identity, tenant RLS and helpers. Mobility allocation/recognition remain sealed.
Dependency: Booking Hub -> existing confirm-deposit POST -> verified Supabase
Auth -> tenant RLS -> existing auto_bookings / auto_deposits persistence.
Authority: await route params, focused route/API tests and non-Production proof.
Preserve response, amounts, status meanings and current storage/consumer contract.
UI reconciliation: no UI change required for the Promise correction. Payment
status here denotes the deposit requirement, not revenue or full vehicle payment.
Additive migration plan: NONE. No grants, schema, helper or Mobility changes.
Retry acceptance: verify the same request does not add a second receipt/amount;
do not call a rejected retry an idempotent replay. Current route has no durable
request key and updates booking before inserting deposit. If retry/atomicity is
not proven, report the gap rather than inventing a payment contract or rewriting
the flow without scope approval. No deletion or guard bypass for cleanup.
11 checks: awaited exact booking ID; real Auth; active tenant access; confirmed
deposit booking/tenant/actor links; partial/full deposit payment status; no
unrelated booking lifecycle transition; full retry read-back; partial retry
read-back; unchanged response/no new Finance event; tagged fixture cleanup;
focused tests/typecheck/Architecture Guard/diff-check and actual dashboard run.

DEPOSIT_CONFIRMATION_API_FIX = APPROVED_NOT_YET_VERIFIED
DEPOSIT_RETRY_IDEMPOTENCY = NOT_PROVEN
SCHEMA_MIGRATION = NOT_AUTHORIZED
DASHBOARD_FULL_E2E = NOT_PROVEN
PRODUCTION_MUTATION = NOT_AUTHORIZED
COMMIT_PUSH_PR = NOT_AUTHORIZED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY

Deposit confirmation executed checkpoint - 2026-10-15:

- Runtime correction is limited to Promise params plus one awaited bookingId used
  by the existing read, booking update and deposit insert. No payment workflow,
  amount/status semantics, response, Auth/RLS rule or Mobility contract changed.
  The prior synchronous-param warning/404 is absent in the executed rerun.
- Actual authenticated Next.js deposit confirmation now returns 200. READ ONLY
  DB read-back proves the exact booking ID, tenant, confirmed receipt, created/
  confirmed actor and time. Full deposit sets deposit_paid=100,000,000 VND and
  payment_status=fully_paid; partial deposit initially sets 30,000,000 VND and
  partially_paid. Existing booking.status=pending_deposit is retained, not treated
  as vehicle delivery or revenue recognition.
- Actual desktop dashboard happy-path test 42 PASS: Login -> Booking/Allocation
  (two safe booking retries) -> Deposit -> Approved Financial Snapshot -> Handover
  -> Explicit Recognition -> Ledger read-back and idempotent recognition retry.
  Handover alone created no recognition. One canonical ledger contains recognized
  sale 1,400,000,000 VND, historical cost 1,000,000,000, received deposit 100,000,000,
  receivable 1,300,000,000, policy v1.0.0 and snapshot/handover evidence IDs.
  This proves the tested happy path, not all roles/tenants/mobile or Go-Live.
- Deposit full retry returns 400 via the existing overpayment guard; receipt and
  booking state are unchanged. That is safe rejection, NOT idempotent replay.
- Real authenticated API test 43 FAILS its required retry invariant: two identical
  30,000,000 VND requests with the same transaction_ref both return 200, create two
  confirmed receipts and set deposit_paid=60,000,000. Independent READ ONLY DB
  inspection confirms both receipts belong to the exact booking/tenant/actor.
  Classification: PRE_EXISTING_RETRY_GAP_EXPOSED_BY_PARAMS_FIX, not a new amount
  calculation in this patch. Keep the failing test; do not replace its expectation
  with two receipts or declare deposit idempotency PASS.
- Source shows no durable operation-key check and two separate booking-update /
  deposit-insert operations. Atomic failure/concurrency behavior is NOT_PROVEN,
  not claimed as tested. A transaction/idempotency implementation or caller-key
  contract needs explicit further scope approval; no payment engine was added.
- Eight focused Jest suites / 59 tests, strict typecheck, scoped lint (zero errors),
  Architecture Guard and diff-check PASS. Real E2E run: one happy-chain PASS and
  one partial-deposit retry FAIL. No aggregate E2E PASS or main seal.
- Teardown independently verified: zero tagged Auth actors, active profiles /
  tenants and Storage documents. Retain immutable recognition proof and receipts
  (including the duplicate negative-case evidence) in terminated test tenants.
  No financial guard/RLS disable or manual financial-history repair. Next server
  stopped and its generated AGENTS.md delta was removed.
- No migration added/applied by this delta; no Mobility/Platform/Logistics, Finance,
  Warranty, registry or Production change. No staging/commit/push/PR/merge.

ROUTE_PARAMS_FIX = PROVEN_ON_E2E
DEPOSIT_CONFIRMATION_HAPPY_PATH = PROVEN_ON_E2E
DEPOSIT_CONFIRMATION_API_FIX = PARTIAL_VERIFIED_RETRY_BLOCKED
PARTIAL_DEPOSIT_RETRY = FAIL_PROVEN_ON_E2E
DEPOSIT_FULL_RETRY = REJECTED_WITHOUT_MUTATION_NOT_IDEMPOTENT_REPLAY
DASHBOARD_SALES_CHAIN_HAPPY_PATH = PROVEN_ON_DESKTOP_E2E
DASHBOARD_FULL_E2E = NOT_PROVEN_WITH_RETRY_FAILURE
MAIN_SEAL = NOT_PERFORMED
SCHEMA_MIGRATION = NOT_PERFORMED_BY_DEPOSIT_DELTA
PRODUCTION_MUTATION = NOT_PERFORMED
COMMIT_PUSH_PR = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY
NEXT_ACTION = OWNER_APPROVAL_FOR_SCOPED_DEPOSIT_TRANSACTION_AND_IDEMPOTENCY_FIX

## Deposit Transaction and Idempotency Correction - 2026-10-15

Process gate: PASS for the owner's explicit E2E-only implementation approval.
Manifest: correct the existing confirmation command, not a new payment feature.
Business invariant (owner-approved): one retried payment intent creates one
receipt and adds its amount once; independent intents remain independently payable.
Truth/source: actual test 43 and READ ONLY DB inspection show identical partial
requests generated two receipts/60M from one 30M intent. Existing route has no key
lookup and two separate writes. Verified schema has UUID auto_deposits.id PK and
all required receipt/audit fields; no additive migration is necessary.
Ownership: AutoMove owns booking/deposit orchestration. Platform keeps identity,
Auth/RLS and connection configuration; Mobility/Logistics contracts do not change.
Dependency: Booking Hub -> awaited confirm-deposit route -> trusted Supabase Auth
-> Product transaction service -> existing authenticated booking/deposit tables.
Authority: scoped transaction/idempotency service, caller key retention and tests.
UI reconciliation: retain the prompt and request body/response fields. Introduce
required UUID Idempotency-Key per payment intent, retained across failed requests
and cleared after acknowledged success. New intentional payments use new UUIDs.
No amount/booking/reference-based inferred deduplication. Clients omitting the key
must fail closed; the one repository UI caller is updated in this same delta.
Canonical persistence: receipt PK equals operation key; booking row FOR UPDATE
serializes balance changes in one READ COMMITTED transaction. Receipt insert and
booking update commit together; failure rolls back both. Look up an existing
receipt before overpayment checks, bind booking/tenant/actor/amount/method/ref/notes,
reject changed payloads, and never edit the existing receipt on retry. Replay
returns the same receipt ID and current persisted booking balance, not an old
balance that could overwrite a later independent payment. Auth/active tenant must
be server-verified; no service-role escalation or client tenant/actor authority.
Migration plan: NONE; reuse existing PK/FKs and existing RLS/grants. Preserve old
proof/duplicate fixture history, booking lifecycle, accounting and Mobility.
11 verification checks: required stable key; trusted active identity/tenant;
one receipt/amount on sequential retry; overlapping same-key requests; independent
keys (including equal amounts); concurrent independent payments/overpayment cap;
changed payload/booking/tenant denial; transaction fault rollback; immutable replay
read-back; actual dashboard and Auth API teardown; unit/regression/type/lint/guard/
diff checks. Stop at any unrelated boundary, with no Production or remote action.

DEPOSIT_IDEMPOTENCY_FIX = APPROVED_NOT_YET_VERIFIED
PARTIAL_DEPOSIT_RETRY = FAIL_PROVEN_ON_E2E_PENDING_NEW_EVIDENCE
PRODUCTION_MUTATION = NOT_AUTHORIZED
COMMIT_PUSH_PR = NOT_AUTHORIZED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY

Deposit transaction/idempotency executed checkpoint - 2026-10-15:

- Root cause confirmed: the previous endpoint had no durable payment-intent key
  and changed the booking balance separately from receipt persistence. The Product
  service now uses the existing receipt UUID PK, an authenticated READ COMMITTED
  transaction and a booking row lock. Receipt insert and balance update commit
  together. No migration, grants, RLS or shared contract change was needed.
- The route awaits params, verifies real Supabase Auth and requires an explicit
  UUID Idempotency-Key. It never invents a key for an unkeyed request. The server
  verifies active canonical user/tenant, and binds the receipt to tenant, booking,
  actor and normalized payment payload. Changed bindings return 409. Unknown
  client authority fields are rejected; existing TLS/project checks stay intact.
- A valid replay reads the existing immutable receipt before the overpayment
  check, returns its ID and the current booking balance, and performs no writes.
  The UI retains the operation key after network/server failure and clears it only
  after acknowledged success. This proves retries reusing the same intent key,
  not arbitrary browser reloads, newly generated keys or bank-reference dedup.
- Actual Next.js/Auth API test 43 PASS: sequential partial/full replay; changed
  amount and different-booking key reuse denied; concurrent same-key requests both
  return 200 with one receipt/one credit; independent equal-amount intents work
  sequentially and concurrently; concurrent overpayment has one success and one
  denial with no partial receipt. Missing key returns 400 without persistence.
- Independent READ ONLY E2E read-back for tenant marker 21a66cd5 confirms:
  full=100,000,000 VND/1 receipt; partial plus independent payment=60,000,000/2;
  concurrent same-key=20,000,000/1; concurrent independent=40,000,000/2;
  concurrent capped=70,000,000/1. Each balance equals confirmed receipts, all
  receipt tenant/booking/actor/time links match, booking lifecycle is unchanged.
- scripts/verify-automove-deposit-idempotency.ts PASS_ROLLBACK on authorized E2E:
  retry and independent intents, immutable receipt replay, tenant/actor/payload
  denial, cap and cross-tenant key collision. An injected booking-write failure
  after receipt insert rolls back both receipt and balance; retry then succeeds.
  This is fault-injected rollback evidence, not a natural database failure.
- Actual desktop Next.js dashboard test 42 also PASS: real Login -> Booking/
  Allocation -> Deposit -> Approved Snapshot -> Handover -> Explicit Recognition
  -> Ledger read-back/retry. UI request key equals persisted deposit receipt ID.
  Independent read-back for booking e3c67383-b279-4242-8768-7d06bf779850 confirms
  one recognition, 1,400,000,000 VND revenue, 1,000,000,000 historical cost,
  100,000,000 cash, 1,300,000,000 receivable, policy v1.0.0, approved snapshot and
  persisted matching handover. This is the tested desktop chain, not all product
  flows, roles, mobile views or Production readiness.
- Verification: 12 Jest suites/97 tests PASS (including 34 focused deposit tests);
  both Chromium E2E tests PASS; fresh full strict typecheck, scoped ESLint,
  Architecture Guard and diff-check PASS. Unit UI retry mocks are unit proof only;
  the browser/API and rollback verifier use the real non-Production database.
- Independent cleanup read-back: zero tagged Auth actors, active profiles/tenants,
  rollback fixture tenants and Storage documents. Historical proof stays in
  terminated test tenants; the earlier duplicate negative-case evidence remains
  unchanged. No financial-history deletion or guard bypass. Playwright server
  stopped; only its generated AGENTS.md block was removed.
- Existing approved catalog/allocation edits remain intact. No new migration or
  schema application in this delta, no Mobility/Platform helper/Logistics, Finance,
  Warranty, commission, registry, environment file or Production change.
  No staging, commit, push, PR or merge. Stop at this approved checkpoint.

DEPOSIT_IDEMPOTENCY_FIX = PROVEN_ON_E2E
PARTIAL_DEPOSIT_RETRY = PASS_PROVEN_ON_E2E
DEPOSIT_FULL_RETRY = PASS_IDEMPOTENT_REPLAY
DEPOSIT_CONCURRENT_SAME_KEY = PASS_ONE_RECEIPT_ONE_CREDIT
DEPOSIT_INDEPENDENT_INTENTS = PASS_SEQUENTIAL_AND_CONCURRENT
DEPOSIT_TRANSACTION_ROLLBACK = PROVEN_BY_REAL_DB_FAULT_INJECTION
DEPOSIT_LOCAL_REGRESSION = PASS_97_TESTS
DASHBOARD_SALES_CHAIN_HAPPY_PATH = PROVEN_ON_DESKTOP_E2E
FULL_DASHBOARD_ALL_FLOW_COVERAGE = NOT_PROVEN
MAIN_SEAL = NOT_PERFORMED
SCHEMA_MIGRATION = NOT_PERFORMED_BY_IDEMPOTENCY_DELTA
PRODUCTION_MUTATION = NOT_PERFORMED
COMMIT_PUSH_PR = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY
NEXT_ACTION = STOP_AT_APPROVED_LOCAL_E2E_CHECKPOINT

## Dashboard Batch Final Review And PR Integration - 2026-10-15

Authority: owner's final diff review, scoped commit/push/PR preparation and
verification approval. No merge, Production mutation or feature expansion.
Review remains single-agent. Reuse the approved catalog/allocation/deposit
changes above as one actual-dashboard business-chain batch; exclude existing
.cache/automove-handover artifacts and all unrelated primary-worktree changes.
The only migration in the proposed batch is the already-authorized catalog
forward migration 20261015010000; idempotency adds no migration.

Review finding: the Real DB selector currently treats that catalog migration as
unmapped and requests the full cross-product suite. It also does not directly
select the new catalog/allocation/deposit verifiers. Repair only the existing
selector registration and its command environment, with a focused regression
test. Preserve full-suite fallback for every other unknown migration and all
existing suite selections. Keep exact E2E project and explicit verifier guards.
No new workflow gate, business capability or Platform authority is introduced.

Before PR: review transaction/key/error paths; run scoped selector regression,
the registered rollback verifiers, full typecheck and affected quality checks;
retain actual Next.js browser evidence, verify integration with fetched main,
stage only the explicit batch manifest and inspect the cached diff.

FINAL_DIFF_REVIEW = IN_PROGRESS_CI_SELECTION_FIX_REQUIRED
MAIN_SEAL = NOT_PERFORMED
PRODUCTION_MUTATION = NOT_AUTHORIZED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY

Final review result: PASS_FOR_APPROVED_SCOPE (single-agent review).

- Transaction ownership, booking row lock, existing receipt UUID uniqueness,
  immutable replay binding, required caller key and error rollback reviewed.
  Current booking balance on replay preserves later independent payments.
  No unresolved implementation blocker found in the approved payment-intent scope.
- One CI integration finding was corrected: register only the approved catalog
  migration and its catalog/allocation/deposit rollback verifiers, supply explicit
  E2E verifier flags per command, and accept the existing CI SUPABASE_DB_URL name.
  Unknown migrations still require the full suite; no assertions or E2E project
  restrictions were weakened. No workflow, credential or Production change.
- Fresh evidence: 13 Jest suites/104 tests PASS, including seven selector cases;
  full strict TypeScript, scoped ESLint, Architecture Guard, secret/log guard,
  scope-router regression and zero-downtime check against platform/main PASS.
  Exactly one proposed migration: the earlier-approved catalog read boundary.
- Executing the actual CI selector with only SUPABASE_DB_URL selected and passed
  all ten commands: catalog reads, booking allocation, deposit idempotency,
  snapshot/handover recognition, policy identity, recognition schema, sales-chain
  RLS, recognition command, financial read-side and sales-chain alignment.
  New business fixtures roll back; real Auth/Storage proof uses verified cleanup.
- Two actual Next.js/Chromium tests from the preceding executed checkpoint PASS;
  Browser evidence is local non-Production desktop scope, not a remote CI/main
  browser run or full-product readiness claim. Shared-UI main integration remains
  to be verified before PR delivery.
- Explicit commit manifest: 30 approved batch files. Exclude .cache image artifacts,
  environment/dependency files and all unrelated primary-checkout changes.

FINAL_DIFF_REVIEW = PASS_FOR_APPROVED_SCOPE
DEPOSIT_IDEMPOTENCY_FIX = PROVEN_ON_E2E
COMMIT_PUSH_PR = AUTHORIZED_FOR_SCOPED_DELIVERY
REMOTE_CI = NOT_STARTED
MAIN_SEAL = NOT_PERFORMED
PRODUCTION_MUTATION = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY

Integration verification addendum: platform/main b7a49ee33 was merged into this
branch without conflicts; the PR diff still contains only the reviewed 30 files.
Fresh 104 tests, strict typecheck and architecture/API checks passed. The first
post-integration browser run was NOT PASS: the observer PostgreSQL connection
terminated during document upload. Deposit API test 43 still passed. Independent
read-back confirmed no snapshot/recognition, no Auth user or Storage objects,
but one active fixture profile/tenant remained because teardown reused the failed
connection. Do not infer a runtime recognition regression or ignore this failure.
Review remediation is test-only: collect observer connection errors as failures
and use a fresh verified E2E connection for atomic fixture-authority cleanup.
No query/assertion retry, business runtime change or lower TLS/Auth/RLS standard.
Revoke the failed fixture's existing authority through the same approved teardown
actions, preserve its financial/allocation history, then rerun the browser tests.
FINAL_DIFF_REVIEW = CHANGES_REQUIRED_TEST_TEARDOWN_VERIFICATION

Integration rerun executed: both actual Next.js/Chromium tests PASS (2.8 minutes).
The earlier observer-connection failure remains recorded as FAIL, not counted
as successful business evidence. No runtime semantics or test assertions changed.
Fresh strict typecheck and teardown-test ESLint PASS. The failed fixture's profile
was deactivated and tenant terminated; no business/allocation/financial history
was deleted. Independent READ ONLY proof after rerun confirms zero tagged Auth
users, active profiles/tenants and Storage documents, including the failed run.
Deposit fixture bfae1cfd has the expected full/partial/concurrent/independent/cap
receipt counts and exact balance sums. Booking d9b76b50-1abe-4138-8113-b5669b8a33bf
has one canonical recognition with 1.4B revenue, 1B cost, 100M cash, 1.3B receivable,
policy 1.0.0 and snapshot/handover bindings. Playwright listener is stopped and
its generated AGENTS.md delta removed. Diff versus fetched platform/main retains
only the approved batch files; primary-checkout work and cache images untouched.

FINAL_DIFF_REVIEW = PASS_FOR_APPROVED_SCOPE
LOCAL_INTEGRATION_WITH_MAIN = PASS
DEPOSIT_IDEMPOTENCY_FIX = PROVEN_ON_E2E
ACTUAL_NEXT_DESKTOP_BROWSER_AND_DEPOSIT_API = PASS_EXECUTED
REMOTE_CI = PENDING_PR_CREATION
MAIN_SEAL = NOT_PERFORMED
PRODUCTION_MUTATION = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY

## PR 329 Gitleaks Fixture Remediation - 2026-10-15

Root evidence: Gitleaks job 116218490617 on head 3660dea07 flags seven generic-api-key
findings in six unit-test locations, all from commit 870d6edd0. Each is a static
UUID payment/booking idempotency fixture passed to mocked Product/HTTP boundaries,
not an API credential, password or real Auth identity. Gitleaks 8.24.3 reproduces
the same seven findings locally using the exact CI commit range. The earlier
repository secret/log guard did not detect this generic-rule fixture pattern.

Repair boundary: test fixture representation and exact historical
false-positive disposition only. Use unmistakable synthetic valid UUID values
for current fixtures. Since CI scans original commit additions, changing HEAD
alone cannot remove the earlier findings. Add only six exact historical
commit/file/rule/line fingerprints (one covers two fake UUIDs on the same line)
to .gitleaksignore with the review reason. No path, rule, commit-wide allowlist,
workflow bypass, history rewrite or exclusion of future test additions.
Gitleaks documents this exact-finding mechanism in its v8.24.3 README.

Verification required: reproduce seven findings before; zero unexpected findings
on the same historical range after; scan the correction commit; prove a generated
non-credential canary still fails the generic rule; rerun affected tests/lint and
diff checks. No runtime, DB, migration, environment or Production mutation.

GITLEAKS_FAILURE = PROVEN_TEST_UUID_FALSE_POSITIVES
GITLEAKS_REMEDIATION = IMPLEMENTATION_PENDING
MAIN_SEAL = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY

Executed remediation evidence: checksum-verified official Gitleaks 8.24.3 binary
reproduced seven findings before the correction; the exact historical CI range
has zero findings after six reviewed fingerprints. Scanning all six current
fixture files passes without additional exceptions. A generated in-memory
non-credential canary still fails generic-api-key detection as expected; it was
not printed or saved. All 13 scoped Jest suites/104 tests, targeted ESLint,
Architecture Guard and diff-check pass. Runtime behavior is unchanged; no DB
or Browser E2E rerun is claimed for this fixture-only delta.
Reference: https://github.com/gitleaks/gitleaks/blob/v8.24.3/README.md#gitleaksignore

GITLEAKS_REMEDIATION = LOCAL_VERIFIED_PENDING_CI
REMOTE_CI = PENDING_CORRECTION_PUSH
PRODUCTION_MUTATION = NOT_PERFORMED
MAIN_SEAL = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY


---

# Architecture Gate — Nail booking branch correction

Date: 2026-10-16. Result: **PASS for scoped implementation**, not Go-Live.

## Process / truth / business test contract

Follow Bella OS/Product process: verified runtime failure -> approved invariant -> ownership -> reuse -> contract -> minimal fix -> verification. Baseline `platform/main` at `3356a04d15b021c5098512739bc5b3676922ce3b`; the four booking-path files are unchanged since failed restored-app proof at `5f939791eddaac5eff45d0b089c0ec74042f6dba`.

Independent semantic authority: user-approved scope in this conversation: Nail booking must explicitly select a valid branch of its tenant that the authenticated actor may access. Missing/invalid/foreign/unavailable branch must reject before customer/booking/session/revenue mutation. Haircut behavior must remain unchanged, including single-accessible-branch inference. Expected behavior comes from that approved rule, not current implementation or fixtures.

Runtime evidence: `C:/Users/DELL/.codex/nail-app-restore/20261016-32dd4bfbb26698c668c7/attempt-08/REPORT.md`, failure JSON, screenshot and assertion source. Original FAIL evidence is immutable.

## Product manifest / capability / ownership

Existing product `bella_nail`; no registration, feature expansion or OS capability. Platform owns `org_units`, IAM/user access and runtime branch selection. Core order owns booking validation/persistence and branch propagation. Shared modal owns user-input transport only. Reuse `getBeautyRuntimeBranchContext` / `selectBeautyRuntimeBranch`, which validate active tenant org units and existing role/membership access. Reuse booking metadata and `buildBookingPayload`; no second permission model.

## Contract dependency and UI reconciliation

Nail UI -> existing createBooking input `metadata.branch_id` -> Core branch resolver -> existing Beauty runtime branch action / authenticated identity -> existing org-unit/access data -> existing booking insert. No Healthcare/Education/Logistics kernel access.

Sidebar branch carrier: `bella.beauty.active_branch.v1`; untrusted input, never authority. Modal consults existing cached tenant settings, adds branch metadata only for Nail, and reads selection at submit time. Server resolves authoritative tenant product, requires an actor bound to that tenant, and accepts only the exact requested branch returned by the existing permission action. Missing branch is not inferred for Nail. Haircut path remains intact. Classification: **MAPPING BUG** at UI and missing Nail adoption at Core boundary; no schema gap.

## Change authority / file plan

User approved UI + server Nail booking fix and regression for Haircut, development only. Core: `src/core/services/order/haircut-branch-context.ts` (retain name/API for callers). UI: `src/components/features/BookingModal.tsx`. Tests: existing `src/__tests__/haircut-branch-chain.test.ts`, new `src/__tests__/booking-modal-branch.test.tsx`, action-boundary tests if needed. Governance: this gate and scoped ACR. No auth policy, branch service, DB/RLS, Finance, generated-type or kernel edits.

## Additive migration plan

None. Existing metadata, branch columns, access contracts and propagation suffice. No migration, backfill or historic evidence rewrite.

## Eleven verification gates

1. Architecture/frozen boundaries: architecture guard; exact file allowlist.
2. Contract: existing branch action and booking metadata reused; Haircut compatibility.
3. Tenant: reject foreign branch, bind actor/tenant before permission lookup.
4. Authorization: reject absent actor, denied/inactive/non-branch selection; existing role policy unchanged.
5. Migration: assert no schema/migration change.
6. Persistence ordering: reject before mutation; successful booking and sessions retain branch.
7. Business safety: RED then GREEN, MAIN booking DB read-back.
8. Temporal/provenance: baseline/diff/hash; preserve failed proof and prior seals.
9. Governance: approved exact Core change binding; lint/typecheck, no new any/suppressions.
10. Evidence: external report/manifest, redact credentials, cleanup, honest failures/skips.
11. Regression: Haircut and related booking/auth/payment tests; restored browser workflow. Payment only after valid branch booking. RTO/RPO approval pending; Production untouched.

No commit, push, PR, merge, deploy or Production authorization. Single-agent execution. No independent-review claim without an actual reviewer.

## Review correction — P1/P2 (2026-10-16)

Result: **PASS for bounded correction**, not closure. User's latest scope requires preventing cross-branch draft reuse and sharing the sidebar/modal branch state, including blocked browser storage. Original 65-artifact package remains immutable at `C:/Users/DELL/.codex/nail-booking-branch-fix/20261016`; new evidence goes to sibling `nail-booking-review-fix/20261016`.

Business test contract: Nail may reuse a draft only if tenant, customer, branch and existing session/revenue scope agree. Any mismatch, missing legacy branch, query failure or concurrent branch change rejects without changing that draft or its children. No auto-transfer, repair or backfill. Existing Haircut reuse/inference remains unchanged. UI must use the same selected state as the sidebar; browser storage is optional persistence, never the only carrier. Missing/pending/unresolved context produces a visible error and no create request.

Minimal implementation: add UI branch state to the existing `UserProvider` (no new provider); selector publishes validated selection and pending state; modal consumes that state and existing product/tenant identity instead of storage. For Nail only, mark branch context as requiring scoped draft reuse, validate existing draft plus children before upsert, and condition update on unchanged tenant/customer/branch. Reuse current permission actions and schema, do not change policy.

Authorized layers/files: previous UI/Core files plus `src/lib/user-context.tsx`, `src/components/layout/BeautyRuntimeBranchSelector.tsx`, `src/core/services/order/create-booking-action.ts`, `src/core/services/order/create-booking-helpers.ts`, targeted tests and this gate/ACR. This is the owning boundary of the two review findings, not a new feature or architecture. The original conversation's UI/server booking authorization and current explicit P1/P2 corrective scope are the authority; Core ACR file list is updated to reflect the actual bounded change.

Verification additions to eleven-gate plan: RED/GREEN A->B draft and inconsistent child scope; compare draft/session/revenue bytes before/after rejected browser request; same-branch MAIN success and DB readback; storage getter/setter throwing with shared state, missing state no request; Haircut regression; full typecheck, lint, guards and exact diff; independent code re-review. No migration/Production/commit/PR. Existing 2 timeout + 1 skip remain classified separately and are not counted as PASS.
