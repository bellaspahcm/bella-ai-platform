---
title: 'Bella Interior Phase 6 — Real RBAC and Scoped Staff Access'
type: 'feature'
created: '2026-11-09'
status: 'in-progress'
baseline_commit: '083d90e0175ba842387078301126115a7c7be04c'
context:
  - '../../governance/BELLA_AI_CODING_CONSTITUTION.md'
  - '../architecture/ARCHITECTURE_GATE_RESULT_BELLA_INTERIOR_RBAC_PHASE6_2026_11_09.md'
---

<frozen-after-approval reason="user-authorized Phase 6 RBAC implementation and additive Production migration">

## Intent

**Problem:** Bella Interior currently has no Product-local role catalog or Interior role assignments. Existing action identifiers and shared direct-user grants do not represent the approved company roles, delegation boundaries, project scopes, or role audit history.

**Approach:** Implement the official 12-role Interior matrix with explicit action permissions and deny-by-default `TENANT`, `BRANCH`, `PROJECT`, and `SELF` scope. Store role mappings and assignments in Interior-owned tables; resolve identity and tenant from Supabase Auth and the canonical actor profile; provide secured APIs and a real user-role management screen. Prepare and apply only additive Product-local Production DDL under the existing release controls.

## Boundaries & Constraints

**Always:** Preserve tenant isolation as a non-overridable condition. Separate READ, CREATE, UPDATE, APPROVE, EXECUTE, EXPORT, user/role administration, and audit permissions. Do not infer APPROVE/EXECUTE from UPDATE. OWNER alone may grant OWNER; ADMIN can assign only roles explicitly delegated by an OWNER. A user may hold multiple roles. Revoke/disable must take effect immediately. Keep audit history append-only. Do not grant direct `anon`/`authenticated` CRUD on Interior tables. Keep project/branch scope enforced at the database/API boundary. No assignment from email domain or shared legacy user role. The user explicitly authorized exactly one bootstrap OWNER: the sole active Auth-backed account in the verified Production tenant.

**Ask First:** A business rule or data-ownership decision beyond the supplied matrix; any destructive migration; any change to shared Platform, Healthcare, Education, Logistics, or Finance contracts; any production action beyond the user-authorized additive RBAC migration.

**Never:** Create fake users or role grants; bootstrap an OWNER by guessing from `admin`, a contact field, or `@bellainterior.vn`; use service role to bypass a user's business permission; delete contracts, financial history, or audit records; use a direct permission grant to bypass tenant or resource scope; enable a business action whose persistence/prerequisites do not exist.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Existing active staff member | Active same-tenant Auth user; OWNER assigns one or more roles and scope | Persist assignment, show effective permissions, append audit event | Reject inactive, missing, or cross-tenant account |
| Project-scoped role | Role assignment references one project in the canonical tenant | Only assigned project and its linked Interior records resolve | Out-of-scope project is denied even when the action exists on another role |
| Branch scope | Active same-tenant branch and project with matching `branch_id` | Access only matching branch projects | Null, inactive, or foreign-tenant branch denies |
| Self scope | Active project membership for authenticated user | Access only explicitly assigned projects | No implicit self ownership from display text or email |
| ADMIN role assignment | ADMIN assigns role key explicitly delegated by OWNER | Allow that role within ADMIN's own Interior scope | OWNER and undelegated role assignment denied |
| Sensitive action | User has UPDATE but lacks the dedicated approve/execute permission | Deny action | Log denial without exposing other tenants' data |
| Revoked/disabled user | Role revoked or canonical user disabled | Effective access is denied on next request | Fail closed if actor/profile resolver unavailable |

</frozen-after-approval>

## Code Map

- `src/products/bella-interior/lib/server-context.ts` — route action mapping and canonical request context.
- `src/platform/security/current-actor.contract.ts` — canonical actor/tenant source; reuse without modifying.
- `supabase/migrations/20261108224216_bella_interior_production_security_hardening.sql` — current Interior tenant-only RLS and RPC ACL baseline.
- `supabase/migrations/20261104135713_platform_action_authorization_direct_grants.sql` — shared direct-grant model; do not repurpose for Interior roles.
- `src/app/dashboard/interior/roles/page.tsx` — Product-local role, scope, delegation, and audit management UI.
- `src/app/api/interior/` — authenticated API surface; protect each action and resource scope.
- `src/products/bella-interior/__tests__/` — targeted role and authorization tests.

## Tasks & Acceptance

**Execution:**
- [x] Add additive migration for catalog, role-action mappings, scoped role assignments, explicit project membership, optional owner-issued direct grants, ADMIN role delegation, audit history, branch linkage, fail-closed resolvers, and scoped RLS policies; preserve zero broad table grants.
- [x] Implement Product-local authorization adapter and update supported Interior route actions to distinguish CREATE/UPDATE and sensitive actions; workflows without a persistence contract remain unavailable.
- [x] Add authenticated user listing, role/scope assignment, delegation, revocation, effective-permission and audit APIs; enforce actor/tenant from canonical Auth profile.
- [x] Replace the Interior roles redirect with a real management UI backed exclusively by those APIs.
- [x] Prepare the single real OWNER bootstrap explicitly selected by the user in the additive Production migration; create no sample account. Invite and assign additional real staff only through the authenticated Owner/Admin flow.

**Acceptance Criteria:**
- Given each official role, when its permission set is resolved, then it matches the supplied baseline and grants no unlisted permission.
- Given UPDATE without a sensitive action grant, when an approve/refund/release/close action is attempted, then it is denied.
- Given a user, tenant, or project identifier forged in request input, when authorization runs, then canonical actor and database scope decide access and foreign scope is denied.
- Given an ADMIN, when assigning roles, then only OWNER-delegated role keys are allowed and OWNER assignment remains impossible.
- Given role revoke or user disable, when the next request resolves, then access is denied and the change is auditable.
- Given the Production migration, when applied, then it adds no sample accounts, creates only the explicitly selected real OWNER assignment, preserves the current 21-table RLS boundary, and grants no direct `anon`/`authenticated` CRUD.
- Given an action whose persistence contract is absent, when requested, then it remains unavailable even if its permission identifier exists.

## Spec Change Log

## Design Notes

`SELF` means explicit project membership for the authenticated user because current Interior records do not consistently store a canonical creator UUID. `BRANCH` uses the shared active `org_units` branch record plus a nullable Interior project branch link. No role or account assignment is seeded in the schema migration.

## Verification

- Source implementation: `PASS` for the Product-local schema/RPC/API/UI contract; targeted source checks are recorded below.
- Production migration: `NOT_APPLIED` until the current Production release gate authorizes it. The migration bootstraps exactly the selected active account after its transactional roster preflight.
- Real staff pilot: `NOT_PROVEN`; no additional real employee accounts or assignments have been provided or created.

**Commands:**
- `npm run typecheck:changed` — expected: no diagnostics in RBAC/API/UI changes.
- Targeted Interior unit tests — expected: role-map and positive/negative authorization assertions pass.
- `git diff --check` and repository migration validation — expected: clean formatting and additive migration accepted.

**Manual checks:**
- Immediately before Production DDL, confirm project identity, latest migration ledger, exact schema/ACL preconditions, and forward-recovery conditions. User has waived backup and non-Production DB rehearsal; do not create non-Production fixtures or write test users into Production.
- After Production DDL, use read-only catalog and ledger queries only. Real authenticated positive/negative RLS proof remains not proven until an actual account roster and released app candidate are available.
