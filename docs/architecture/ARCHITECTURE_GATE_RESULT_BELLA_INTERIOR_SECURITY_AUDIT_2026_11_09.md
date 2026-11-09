# Bella Interior Production Security Audit — Architecture Gate

Date: 2026-11-09
Result: `PASS` for the Production database hardening; `PROPOSED` for the least-privilege role matrix; `DEFER` for role-to-user assignments and direct-table read/write enablement; `BLOCKED` for Production application release until the source fixes below pass the required CI gates.

## Bella OS / Product Process Gate

The request is an audit and repair of Bella Interior, with explicit user authority to operate on Production and its Production database. Scope is limited to Bella Interior APIs, Interior-owned tables/functions, and the minimum extension of the existing Platform Action Authorization permission identifier catalog needed to secure Interior routes and RPCs. No Healthcare/Education behavior, frozen Kernel, Finance ledger, or unrelated product is in scope.

The target Production project is `lvnvkpyxtuilhrabtlwv` in `ap-southeast-1`, active, Postgres 17.6.1.121. Read-only preflight observed 21 `public.interior_*` tables with RLS enabled and tenant policies; `anon` and `authenticated` have no direct table CRUD grants. The old policies trusted `auth.jwt()->>'tenant_id'`. The current project is on the Supabase Free plan, with no managed project backup. Planned DDL changes only function definitions/execute ACLs, an allow-list constraint, and RLS policies; no business rows are changed. No Production write probe or failure injection is allowed.

The existing action grant system supports direct per-user grants only. Production has no Interior action grants and no Interior-specific roles in the shared `users.role` values. The user selected a proposed least-privilege, deny-by-default matrix below. No assignment is inferred from shared roles such as `admin`, `admin_staff`, or `accountant`, and no user grant is created by this gate. Direct table privileges stay revoked; the existing route/repository calls that depend on direct table reads/writes must continue to fail closed until field-scoped read projections and action-aware command RPCs are available.

## Product Manifest and Scope

Product: Bella Interior OS (`bella-interior`, key `bella_interior`). Bounded contexts: Design & Specification; Commercial & Costing; Manufacturing & Installation; Delivery & Aftercare. Surfaces include 23 API route files, the Interior Supabase repository, finance outbox adapter, 21 Interior tables, and the Interior security-definer RPCs.

## Ownership Map — Who Owns This Data?

| Data / capability | Owner | Change boundary |
| --- | --- | --- |
| Interior projects, designs, BOQs, contracts, production, delivery, warranty, idempotency, and finance outbox | Bella Interior Product | Product routes, Product RPCs, tenant RLS, and product-owned service behavior |
| Action authorization contract and grant store | Bella Platform Authorization | Reuse the existing direct-user action contract; extend only named Interior permission identifiers |
| Finance ledger and accounting records | Finance OS | No direct access or write; preserve the outbox contract |
| `hc_*` Healthcare Kernel, Education, and Logistics frozen kernels | Their owning kernels | Not touched |

## Contract Dependency Map

`Bella Interior API → Platform Action Authorization → canonical active actor/tenant → tenant-owned Interior data`
`Bella Interior milestone → Interior finance outbox → Finance OS consumer`

The current Platform Action Authorization contract is reusable but the Production direct-grant catalog accepts only five `construction:*` identifiers. It is per-user direct-action authorization, not role-based inheritance. No grants will be added for Interior until the owner supplies an approved role/user matrix and assignment authority.

## Proposed Interior Role Matrix — Least Privilege, Deny by Default

This is the proposed business-role mapping requested by the user. A role receives only its listed action IDs; unlisted actions are denied. These role names are not present in Production today, and the current Platform contract cannot expand a role into action grants. Enacting this proposal requires an authoritative mapping of named Interior users to these roles and an approved assignment path. Do not map shared `admin`, `admin_staff`, or `accountant` values to these roles implicitly.

Use [BELLA_INTERIOR_ROLE_ASSIGNMENT_TEMPLATE.csv](templates/BELLA_INTERIOR_ROLE_ASSIGNMENT_TEMPLATE.csv) to submit the account → role → tenant roster. Its email addresses are examples only; replace them with verified active Production accounts. Do not apply grants while any `REPLACE_*` placeholder remains or before each account's tenant and approver are confirmed.

| Proposed role | Proposed action IDs |
| --- | --- |
| `interior_project_manager` | `interior:project:read`, `interior:project:write`, `interior:customer:read`, `interior:design:read`, `interior:boq:read`, `interior:contract:read`, `interior:schedule:read`, `interior:schedule:write`, `interior:production:read`, `interior:installation:read`, `interior:qc:read`, `interior:delivery:read`, `interior:delivery:write`, `interior:reports:read`, `interior:warranty:read` |
| `interior_designer` | `interior:project:read`, `interior:design:read`, `interior:design:write`, `interior:boq:read`, `interior:schedule:read`, `interior:design:upload`* |
| `interior_design_approver` | `interior:project:read`, `interior:design:read`, `interior:design:approve` |
| `interior_estimator` | `interior:project:read`, `interior:design:read`, `interior:boq:read`, `interior:boq:write`, `interior:contract:read` |
| `interior_contracts_officer` | `interior:project:read`, `interior:customer:read`, `interior:boq:read`, `interior:contract:read`, `interior:contract:write` |
| `interior_finance` | `interior:project:read`, `interior:boq:read`, `interior:contract:read`, `interior:finance:read`, `interior:finance:write` |
| `interior_workshop_manager` | `interior:project:read`, `interior:design:read`, `interior:boq:read`, `interior:schedule:read`, `interior:production:read`, `interior:production:write` |
| `interior_site_supervisor` | `interior:project:read`, `interior:schedule:read`, `interior:schedule:write`, `interior:production:read`, `interior:installation:read`, `interior:installation:write`, `interior:qc:read`, `interior:qc:write`, `interior:delivery:read`, `interior:delivery:write`, `interior:warranty:read` |
| `interior_qc_inspector` | `interior:project:read`, `interior:qc:read`, `interior:qc:write`, `interior:delivery:read` |
| `interior_warranty_agent` | `interior:project:read`, `interior:delivery:read`, `interior:warranty:read`, `interior:warranty:write` |
| `interior_executive_approver` | `interior:project:read`, `interior:contract:read`, `interior:finance:read`, `interior:reports:read`, `interior:executive:approve` |

`interior:design:upload` remains unusable until private storage, tenant-scoped object paths, and signed download authorization are configured. No proposed role receives both design approval and design write, and executive approval is separate from finance write. There is no wildcard, global-admin inheritance, or implicit owner bypass.

## Change Authority

Authorized by the user: audit and repair Bella Interior directly on Production and the Production database. Bounded changes:

- Require verified auth, canonical active actor/tenant, and a mapped direct action for Interior APIs; unknown routes/actions fail closed.
- Remove shared demo data, false persistence success, and public design-file upload; keep upload unavailable until private storage and signed downloads are configured.
- Validate caller tenant/actor/action and source records in the Interior Finance and BOQ RPCs; revoke anonymous/public execution and restrict cross-tenant cleanup to `service_role`.
- Replace JWT-claim-based tenant policies with restrictive policies that derive tenant from the active canonical actor profile. No direct table grants are added.
- Extend only the permission identifier allow-list for the named Interior actions. Keep assignments unconfigured until named-user membership is authoritative; do not infer access from role/job title.
- Remove the BOQ sequential-write fallback; BOQ writes require the atomic RPC and authenticated audit actor.

No broad authenticated table grants, role assignment, general Platform RBAC redesign, Finance ledger mutation, unrelated product changes, secret rotation, or unverified public file access is included.

## UI → Contract Reconciliation

The legacy Interior dashboard pages expected mock `overview` contracts that the secured APIs do not provide. The data/action-bound UI was reduced to read-only screens that match the existing API shapes; these changes do not add new data ownership, APIs, or write authority. Dashboard and project views use the tenant-scoped project list and render customer/budget values only when the API returns them. The customer view uses the customer-authorized project aggregation. BOQ views select only from projects returned to the current actor and consume the tenant-scoped BOQ API; client prices render only when present, and internal COGS/margins render only when present. Design and materials read saved revisions/specs and room zones through the project-scoped design endpoint; schedule reads saved installation plans. No client-supplied tenant identity is used.

Finance, reports, installation analytics, production analytics, QC/handover analytics, and warranty analytics still return explicit unavailable/denied responses because their production read models are not wired. Their UI shows no fixture or fallback values and clears previously rendered data after a failed refresh. Unsupported commands (including contract creation, production-order creation without selected real BOM inputs, handover, warranty ticket creation, design uploads, and finance decisions without persistence) do not claim success; private file upload remains unavailable. These UI/API contracts do not activate direct authenticated table access: Production direct-table grants remain revoked, and role assignments remain absent.

## Migration Applicability and Recovery

One additive migration is applicable. It is catalog/ACL/policy-only: extend the action-ID constraint, harden RPC definitions/execute grants, and update 21 tenant policies. It does not add a table/index or alter business rows. Before execution, the migration verifies the reviewed Production policy/grant/function preconditions and aborts on drift. Recovery is a forward migration restoring captured function bodies, prior ACLs, and prior policy/constraint definitions. Managed point-in-time/project backup is unavailable on the current Free plan.

## Verification Plan

- Static source checks: all Interior routes resolve a mapped action; client-supplied tenant/actor/role headers are rejected; no mock fallback after auth or DB failure; no sequential BOQ persistence fallback; client refresh failures clear protected data; unsupported commands do not report persistence success.
- Database catalog checks after migration: fixed function search paths, expected security-definer status/owners/execute ACLs, anonymous execution denied, cleanup service-role-only, all 21 RLS policies use canonical active actor tenant and are restrictive, no direct table grants.
- Run read-only authorization/catalog/advisor checks after applying DDL. Do not perform Production write probes or synthetic business events.
- Report local source verification, Production DB verification, and deployed application evidence separately. Production source changes are not considered deployed until the approved release pipeline reports the exact SHA promoted and health verification passes.

## Production Verification Results

Read-only checks after applying migration `20261108224216_bella_interior_production_security_hardening` confirmed:

- 21/21 Interior tables have RLS enabled; zero have RLS disabled; anon/authenticated have zero direct CRUD grants.
- 21/21 Interior policies are `RESTRICTIVE`; each `USING` and `WITH CHECK` references `platform_current_actor_profile()`; none relies on a JWT tenant claim.
- `platform_direct_user_action_grants` currently has zero rows, including zero Interior grants. Production `users.role` contains shared `accountant`, `admin`, `admin_staff`, `ktv`, `ktv_lead`, and `parent` values; no Interior role/membership is present.
- All 27 Interior permission IDs appear in both the Production allow-list constraint and `platform_grant_direct_user_action`.
- `save_interior_boq_atomic` and `enqueue_interior_finance_event` have fixed empty search paths and execute grants for `authenticated` plus `service_role`, with `anon` denied. `cleanup_expired_interior_idempotency` has a fixed empty search path and is executable only by `service_role` (aside from its owner).
- The Security Advisor still reports the two authenticated `SECURITY DEFINER` Interior RPCs above. This is a generic execute warning; these functions were reviewed to enforce canonical active tenant and action checks, and the warning remains because the advisor does not inspect those function-body checks. Other project-wide advisor findings remain outside this Interior-scoped change.
- The project-wide Security Advisor also reports 8 security-definer views, 27 public tables with RLS disabled, 218 functions with mutable search paths, and leaked-password protection disabled. The Interior-specific policy/function checks above do not show these findings on Interior tables/functions; the global findings were not changed by this product-scoped audit.
- At the time of this catalog verification, the application source edits had not been deployed. Local `npm run typecheck:changed` passed with zero diagnostics; `git diff --check` passed after report cleanup. Production app deployment must be evidenced by the exact-SHA release workflow and health verification, separately from this DB result. No Production user grants were added, so authorization remains deny-by-default until approved Interior membership assignments are provided. No managed backup is available on the current Free plan; the applied DDL did not modify business rows.

The production catalog was rechecked read-only on 2026-11-09 during the continuation: migration ledger row `20261108224216` = 1; Interior tables = 21; RLS-enabled = 21; restrictive policies = 21; policies whose `USING` and `WITH CHECK` both reference `platform_current_actor_profile()` = 21; anon/authenticated table CRUD grants = 0; Interior direct-user grants = 0. No Production data or schema was written during this recheck.

A read-only Production log review found one PostgREST `42703` event at `2026-11-08 15:17:11.084 UTC` for `interior_boqs.total_estimated_cost`, before the security migration at `22:42:16 UTC`. The Production table has `total_internal_cost`, `total_client_price`, and `total_gross_margin`, but no `total_estimated_cost`; the current source has no reference to that missing column. The error did not recur in the log window from migration time through `2026-11-09 01:09:31 UTC`. No schema field was added for this stale query.

## Additional Audit Findings and Deferred Work

- Read-only source review found customer and financial fields in list projections that were guarded only by `project:read`, `boq:read`, `delivery:read`, or `warranty:read`. The source patch now applies the field-level permissions above. These fixes are not Production-active until the exact source SHA passes CI and the release workflow.
- The repository references `interior_design_takeoff_runs` in its save/get/list methods, but the Production schema has no such table and no live API route calls those methods. This capability is `DEFER`; no table, policy, grant, or route is being invented as part of the security repair.
- The proposed `interior_estimator` role has `contract:read` but not `finance:read`: it can read client pricing, while internal COGS/margin remain hidden. If Interior wants estimators to see internal cost, the owner must explicitly add the existing `finance:read` action to that assignment or approve a narrower BOQ-cost permission; no grant is inferred.
- No named account roster has been supplied. The CSV's sample accounts use the requested `*@bellainterior.vn` domain pattern; they are examples only. Production still has zero Interior user grants and no role membership. Deny-by-default remains in force.

## Release Gate Status

- PR #521 at source SHA `bae52270f29381cf0ea732cb3fe95c8d9cb68edb` remains open and unmerged. The preview deployment is not Production evidence.
- The associated `CI - Quality Gates` run completed successfully at that SHA, including Affected Unit and Integration Tests, Real Database Business E2E, Migration Gates, and the aggregate required-gates job. The separate Static Analysis Security Suite did not pass because of the Semgrep gate failure below.
- A scoped source scan found that legacy client pages rendered synthetic customer/financial/project fixtures after unavailable reads, and some buttons reported successful operations without persistence. The current continuation removes those fixture datasets from all `dashboard/interior` pages, aligns Dashboard/Projects/Customers/BOQ/Design/Materials/Schedule with the existing secured read responses, and clears stale data when protected refreshes fail. Unsupported write controls now remain disabled or report that no data was saved. This is source-level work only; it is not Production-active until the exact source SHA passes CI and is promoted.
- The Semgrep CE rerun for that SHA failed a second time. Its scan completed (8,552 tracked files; 525 rules; 495 findings reported as blocking), then the gate exited with `SEMGREP_GATE_EXECUTION_OR_EVIDENCE_FAILED`. The available job log does not identify a single triaged source finding as the terminal cause. This gate is unresolved and must not be bypassed or weakened.
- The UI contract-alignment changes were pushed in source commit `38a885152e33d10ca7f2befb374b6988d61a708b` on PR #521. Local `npm run typecheck:changed` passed with zero diagnostics and `git diff --check` passed for that source revision. GitHub Actions reports the earlier `0dd82863e` `CI - Quality Gates` run completed successfully, including real database business E2E; its separate Semgrep suite failed. On `38a885152`, Vercel preview status was pending and the workflow-run listing had not yet returned runs at the time of this observation. No merge or application deployment is claimed.
- PR diagnostics at `083d90e0175ba842387078301126115a7c7be04c` showed CodeQL passing and Semgrep CE exiting 2 after one full scan (8,552 tracked files, 525 rules, 495 whole-repository findings); no diff decision was produced, and the count does not establish that all findings are new Interior issues. The exception handler was first updated to preserve failure details. On `5449ee82d25cb039b8617b7db37de340b18dfb6d`, Semgrep exposed `SCANNER_WARNING_ON_CHANGED_OR_UNKNOWN_FILE`; on `a0ab82098364d6390cd162c0bbf50e51b73598a0`, the diagnostic identified a warning on changed file `src/app/dashboard/interior/projects/[id]/page.tsx`. I added a redacted warning summary to the evidence, without changing the fail-closed decision. Review of that route removed an unused `leadArchitectId` from its response and removed unsupported customer phone/email fields from the page contract. The next SHA's Semgrep result is pending; no finding, baseline, or gate condition is waived.

## Gate Decision

`PASS` for the bounded Production database hardening and the source-level deny-by-default authorization design described above.
`PROPOSED` for the least-privilege Interior role matrix. `DEFER` for role-to-user assignments, the absent takeoff persistence capability, and direct-table access. `BLOCKED` for Production application release until the field-projection fixes pass current required CI and the existing Semgrep failure is resolved without weakening its gate. Until approved memberships and action-aware data contracts exist, direct action decisions deny by default, and direct table access remains closed.
