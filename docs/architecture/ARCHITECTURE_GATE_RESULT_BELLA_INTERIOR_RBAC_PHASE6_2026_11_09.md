# Bella Interior Phase 6 — RBAC Architecture Gate

Date: 2026-11-09
Result: `PASS` to implement the Product-local role catalog, permission resolver, scoped assignments, management API/UI, and additive Production migration. The user explicitly selected Production's sole active Bella Interior account as the initial OWNER. Other staff assignments remain `DEFER` until real employees are invited and assigned; no role is inferred from an email domain or the shared `users.role` field.

## Problem and Workflow

Bella Interior must support a real interior-design business with multiple staff roles and project-level responsibility. A user may hold multiple roles. Requests resolve the Supabase Auth user, canonical active tenant, role permissions, action, and permitted data scope before reading or changing data. Unlisted actions deny by default.

Non-goals: changing shared Platform/OS authorization semantics; granting broad table CRUD; creating test or fake users; auto-assigning users by email domain; inventing business commands where the persisted transaction model or required server-side gates do not exist (contract creation/signing/amendment, payment recording/approval/refunds, production release, and warranty closure remain unavailable).

## Truth and Source of Truth

- Official roles, baseline module access, and sensitive action separation: user-provided Phase 6 role matrix in this conversation.
- Actor and tenant: `platform_current_actor_profile()` after `auth.getUser()` and identity reconciliation in `src/products/bella-interior/lib/server-context.ts`.
- Production schema: Supabase project `lvnvkpyxtuilhrabtlwv`, Postgres 17.6.1.121. Read-only catalog confirmed 21 Interior tables with RLS and restrictive tenant-isolation policies; `anon`/`authenticated` have no direct table privileges. Supabase `service_role` currently has server-level CRUD grants, but repository source review found no Interior business-data route using it; the invitation endpoint uses it only for Supabase Auth administration. Production has one matching active tenant, one active Auth-backed account, five projects, zero active branches, and no duplicate `interior_permissions`, roles, or role assignments.
- Current generic `public.user_roles` has a global nullable tenant field and self-referential role policies; it does not model the requested Product role/action/scope/delegation/audit contract and will not be reused.
- Current `public.platform_direct_user_action_grants` authorizes direct grants only and its allow-list belongs to the shared Platform. Interior RBAC will not expand or repurpose that shared grant store.
- `public.interior_projects` has no branch key or creator UUID. Project/branch scopes therefore require additive Product-owned fields/assignment data; missing ownership is denied until explicitly assigned.

## Product Manifest and Capability Map

Product: Bella Interior OS (`bella-interior`, key `bella_interior`), bounded contexts Design & Specification, Commercial & Costing, Manufacturing & Installation, Project Delivery & Aftercare. The existing manifest advertises those capabilities. The source candidate provides scoped RPC-backed project/customer/design/schedule/site diary/QC/handover/warranty-ticket reads and commands, plus contract reads. It does not make contract creation/signing/amendment, payment recording/approval/refunds, production release, or warranty closure available; those actions remain fail-closed until their transaction models and server-side gates are implemented.

## Ownership Map

| Capability/data | Owner | Authorized change |
|---|---|---|
| Interior role catalog, assignment, scoped project access, role audit | Bella Interior Product | Product migrations, authorization RPCs, API and management UI |
| Canonical identity and tenant profile | Bella Platform security contract | Reuse only; no modification |
| Branch identity | Foundation `org_units` | Read/validate active same-tenant branch; no Foundation schema change |
| Contracts and financial ledger | Their current Product/Finance ownership contracts | No new transaction behavior or cross-ledger writes |
| Healthcare, Education, Logistics kernels | Protected owners | No changes |

## Contract and Data Flow

`Supabase Auth → canonical current actor/tenant → Bella Interior action permission → TENANT / BRANCH / PROJECT / SELF scope → scoped read/command boundary → immutable Interior permission audit`.

Keep tenant isolation immutable. Direct grants may add an action only inside the actor's canonical tenant and the stored grant scope; they cannot bypass project/branch scope. Role/action resolution is Product-local so shared Construction authorization remains unchanged.

Scope semantics:

- `TENANT`: all Interior projects in the canonical tenant.
- `BRANCH`: projects whose explicit `branch_id` matches an active same-tenant `org_units` branch.
- `PROJECT`: one explicit same-tenant Interior project.
- `SELF`: projects explicitly assigned to the authenticated user through Interior project membership; it does not guess ownership from display-name/text columns.

## Change Authority and UI Reconciliation

The user explicitly authorized implementing the complete 12-role matrix, API/UI, additive Production migration, direct Production execution, and no non-Production database rehearsal. The user explicitly selected the sole active account in the matching Production tenant as initial OWNER and waived backup until a later plan upgrade. Current Deployment Governance still requires a verified backup for Production schema deployment, so the DDL remains unapplied until that prerequisite is available; the authorization remains valid for the exact additive migration and the single OWNER bootstrap. It does not authorize fake staff accounts, role inference, broad CRUD, or bypass of the current Production release controls.

`src/app/dashboard/interior/roles/page.tsx` now shows Product-local user/role/scope management through authenticated APIs. The Interior Settings tabs for staff and permissions route to this screen instead of the legacy `tenants.role_permissions` controls, and the Bella Interior sidebar exposes the management route. This conditional UI change leaves the generic Settings permission model and non-Interior tenants unchanged. The screen shows active tenant accounts, effective roles/scopes, explicit role assignment/revocation, OWNER-controlled ADMIN delegation, and audited changes.

The candidate's other data-bearing Interior routes use authenticated scoped RPCs for project, customer, design, installation schedule, site diary, QC punch list, handover dossier, warranty certificate/ticket, BOQ, and contract reads/commands. Contract GET masks finance/customer fields at the database boundary; handover and warranty create commands derive tenant and actor from the database auth context. Unsupported contract/payment/production/warranty-close writes return unavailable errors, and the contract UI keeps contract creation and production release disabled. This describes source behavior only until the migration and matching app release are deployed.

## Additive Migration Plan

Create Product-local role/permission catalog, fixed baseline role mappings, user-role assignments with lifecycle/audit fields, direct permission grants, explicit project memberships, and per-ADMIN role delegation. Add nullable `interior_projects.branch_id` and a same-tenant scope guard. Add fail-closed permission/scope resolver functions. Keep all 21 Interior table RLS policies and no direct `anon`/`authenticated` table grants; extend row policies with the relevant action and scope predicate. Keep finance outbox service-only. Bootstrap exactly the one real OWNER account explicitly selected by the user; create no other user or assignment.

All changes are additive or policy/function replacement within Interior. Do not drop/rename business data, rewrite existing role rows, alter shared Platform grant constraints, or loosen RLS. If migration preflight or recovery conditions cannot be established on the actual Production target, stop that mutation while continuing independent source work.

## Verification Plan

- Unit tests for all 12 role maps, separation of WRITE from APPROVE/EXECUTE, multi-role union, disabled/revoked assignment denial, scope non-escalation, ADMIN delegation boundaries, and auth/tenant spoof denial.
- Type check, targeted lint, diff check, migration validation, and applicable Architecture/Semgrep gates on the source candidate.
- Exact Production preflight immediately before migration: target identity, current migration ledger, expected tables/columns/policies/ACLs/functions, zero data rewrite, and recovery/forward-recovery plan. User explicitly waived non-Production DB rehearsal; no test fixtures or denial probes will be written into customer Production.
- After applying the additive migration through the authorized Production route, perform read-only catalog/ledger verification only. Runtime role/scope proof for staff roles remains `NOT_PROVEN` until real employees are invited and use the released candidate. No synthetic identities or Production denial probes will be created.

## Entry Gate Decision

`PASS` for source implementation and a bounded additive Product-local Production migration under the current release controls.
`PASS` to bootstrap the one OWNER explicitly chosen from the verified active Production roster. `DEFER` the staff pilot until real employees are invited, assigned, and test actual role workflows. The database catalog by itself grants no staff access.

## Candidate Verification and Current Deployment State

- Current source verification: `npm run typecheck:full` PASS; targeted Interior RBAC Jest run 10 suites / 44 tests PASS; targeted ESLint PASS; `npm run db:migration:zero-downtime` PASS (1 migration); `npm run db:rpc-grants:check` PASS (36/36); `git diff --check` PASS.
- These are source/static/unit checks, not Production runtime or tenant-isolation proof. No non-Production database rehearsal was performed, per the user's instruction.
- Production migration and OWNER bootstrap are NOT_APPLIED. The current Deployment Governance Human GO gate explicitly requires a verified backup, monitoring plan, and scope confirmation before schema deployment. The user waived the backup, but that does not satisfy or amend the repository's mandatory condition. No role assignment or Production schema mutation has been made.
- Real-user pilot remains DEFERRED: the selected existing account can be bootstrapped as OWNER only after the authorized migration is safely deployable; staff accounts and assignments require actual employee identities and explicit role/scope assignment.
