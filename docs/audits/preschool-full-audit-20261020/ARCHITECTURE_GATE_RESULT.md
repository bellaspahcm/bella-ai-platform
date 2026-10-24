# Preschool full UI to DB audit — 2026-10-20

Decision: PASS for audit and verification only. Product implementation is not authorized.

- Branch: `codex/preschool-full-audit-20261020`.
- Source: `339c89250d87964ba8d58860a5ecdbc0bdde4956`, created from clean `feat/preschool-admin-executive-copilot` checkout, three commits ahead of locally recorded `origin/main`. This is branch evidence, not main/production evidence.
- Live provenance refresh: `git fetch origin main` resolved `origin/main` to `f973dd7e56542aa7847b98c2a4236da86f1eabc3`; `origin/main...HEAD` has 2 main-only / 3 branch-only commits. The audit source remains the requested new branch at the original checkout commit. No rebase/merge performed.
- User scope: full Preschool UI → API/action → Product service → public contract → persistence/E2E; locate frontend business rules/canonical truth and missing Platform reuse; include RBAC and RLS.
- Authority: read source, inspect existing enforcement and schema/policies, run existing isolated tests, create audit scripts/reports/evidence. No runtime fixes, schema changes, security changes, commits, push, merge or production mutations.
- Multi-agent: OFF. Single-agent audit.

## Truth, ownership, contracts

Common authority: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md` (Workflow Routing, Scoped Autonomy and Approval, Verification Results and Applicability, Enforcement Evidence); operational audit: `docs/governance/OPERATIONAL_READINESS_SOP.md`; Education/Healthcare constitutions retain frozen boundaries and applicable verification.

Product declaration: `src/products/bella-education/manifest.ts`. Education owns course/enrollment/attendance/assessment semantics via `src/platform/education/contracts/`; generic Party identity, actor/tenant/branch authorization belong to their Platform owners. Preschool-specific care/learning/communication/facilities workflows require their own approved contracts. Finance must use the owning Finance contracts for accounting truth. Existing implementation/tests prove observed behavior, not intended business truth.

Expected invariants from governing sources: resolve context → authorize → mutate → side effects; tenant and branch isolation; role authorization independently enforced by backend and RLS; Product → public contract → frozen Kernel; no invented business semantics; events after persistence; additive temporal/audit evidence where required. Do not promote static/mock evidence into authenticated runtime proof.

## Proportional Change Map

No UI/runtime change. Trace every route's data, actions, thresholds, status calculations, actor/tenant defaults, direct repositories/DB imports and Platform reuse. Reconcile each observation as existing capability reuse, static/demo data, local-only behavior, mapping/authorization defect or unproven capability; proposed repairs are separate owner decisions.

Migration: NOT_APPLICABLE to this documentation/audit change. Read-only schema and deployed RLS inspection remain applicable to the audit. Do not restore schemas or seed shared remote environments implicitly.

## Verification plan

1. Preserve source/branch provenance and inventory all routes, APIs, contracts, direct DB and Platform dependencies.
2. Run existing Education architecture/customization/extension and conformance suites plus relevant Preschool/API/UI tests. Record suite/test counts and mock boundaries. Run Healthcare regression for Education Gate 11.
3. Inspect pre-tool/pre-commit/CI guards and actual Git hook configuration; configured surfaces alone do not prove execution.
4. Classify runtime and DB targets without storing credentials. Read schema/RLS/catalogs in a read-only transaction. Compare targets with configured production before considering fixture writes.
5. Browser route/tab checks in an isolated session, no destructive seed actions. Browser writes and Real DB fixture tests only if an isolated non-production environment is proven. Existing persona tests contain destructive fixed-tenant seed actions and require prior safety review.
6. RBAC: allowed/denied roles, anonymous, foreign-tenant and branch-boundary paths. RLS: enabled/forced state, roles, predicates, grants and actual non-privileged execution when an approved authenticated session exists.
7. Retain all 11 Education gate rows: architecture, contract boundary, tenant isolation, RLS/authorization, migration safety, event-after-persistence, academic safety routing, temporal provenance, rule governance, audit integrity, Platform regression. Report missing executed proof as NOT_PROVEN or an identified execution obstacle as BLOCKED.

Stop at the decision boundary. FAIL, BLOCKED, NOT_PROVEN, skipped and timeout are not PASS. No Go-Live claim follows from this audit.
