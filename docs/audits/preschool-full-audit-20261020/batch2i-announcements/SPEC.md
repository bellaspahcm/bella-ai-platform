---
title: Contain ungoverned Preschool broadcast publication
type: bugfix
created: 2026-10-21
status: done
baseline_commit: 30134055d1ff5b846584e57833816f076034cdea
context: []
---

<frozen-after-approval reason="Owner approved AUTHORIZATION_CONTRACT.md matrix and implementation per group on2026-10-21">

## Intent and boundaries

The existing Announcements endpoint derives identity from a development-capable profile resolver without first verifying Auth, falls back to sample actor/tenant IDs, and writes a global thread with fabricated student/guardian identities through a privileged client. Replace that unsafe publication path with verified identity and an explicit dependency hold under the approved Product contract.

Auth provider must validate the session before live profile resolution. Profile subject must equal Auth subject, user active, tenant present. Only the exact normalized Product-local admin role may reach the broadcast dependency check. Tenant must be active and product_key bella_preschool. Query/header selectors cannot override actor/tenant; inspect all duplicate supported selectors. Identity or lookup failures fail closed, stable sanitized responses with private/no-store; no raw DB detail.

School-wide delivery requires server-resolved current guardian/student/enrollment recipients, admin access to every recipient branch and an idempotent per-recipient communication lifecycle. These producers have not been proven. Therefore even an eligible admin receives503 ANNOUNCEMENT_BROADCAST_NOT_READY before body parsing, operation-client creation, recipient lookup, thread/notice writes or external delivery. Do not pretend this hold is a working broadcast implementation. Classroom broadcast remains unavailable under v1. No route caller receives success while required producers are absent.

Remove fixed global thread, fabricated resource identities, demo tenant/actor defaults and service-role client from this staff endpoint. No schema/grant/policy/default ACL/role membership changes, no Platform/shared/Kernel edits, no UI changes, no business data mutation or production requests. Existing historical notices/threads remain intact. No new shared authorization framework. This patch contains one unsafe endpoint and leaves the approved dependency explicit.

</frozen-after-approval>

## Code Map

- src/app/api/education/announcements/route.ts: verified Auth/profile, admin/Product gate, selector checks, stable no-store dependency response; remove publication side effects.
- src/app/api/education/announcements/__tests__/access.test.ts: independent contract-based denial and no-side-effect tests.
- docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md: owner-approved canonical matrix, copy unchanged for review.

## Tasks & Acceptance

- [x] Route: enforce Auth-first active subject binding and exact admin role; check active Preschool tenant through session client; reject foreign duplicate selectors.
- [x] Replace all publication with explicit503 dependency hold before request JSON or any business/privileged client operation.
- [x] Tests: unauthenticated/spoof, provider error, missing/inactive/mismatched profile, denied roles, tenant state/Product, query/header override, lookup error, valid admin hold including invalid body; no writes/signing/side effects.
- [x] Lead: focused Jest, ESLint, scoped Education TypeScript, secret scan, diff check and bounded local anonymous HTTP evidence; retain native outcomes and full DB/RLS/production limitations.

Given no verified session or a denied profile/role/resource context, when POST handles even a forged admin request, then it rejects before body parsing or any business mutation.

Given an eligible active Preschool admin, when publication is requested with any school/class scope or payload, then the unavailable recipient lifecycle causes503 and zero writes; no fake success, global thread or sample resource identity is created.

Given a dependency or RLS lookup error, when POST handles the request, then it emits sanitized503/no-store and never retries through a privileged client.

## Design Notes

Independent authority is the owner-approved authorization contract sections2–7, not the existing unsafe route or its UI. The Product owns publication authorization; Platform owns session/user/tenant and branch projection; Education owns enrollment; existing communication lifecycle owns per-student/guardian threads. Missing producer composition is a dependency gap, not permission to add a Kernel capability or schema. No lower contract is changed.

Migration NOT_APPLICABLE. UI may display unavailable after containment; do not restore unsafe publication to satisfy it. No outbound message is authorized or required for verification.

## Verification

Local unit/HTTP denial proof is separate from deployed behavior, legitimate broadcast usability and authenticated DB/RLS. Applicable broad Education/Healthcare commands already ran on unchanged lower layers in sibling batch2e; native offline DB-dependent failures remain FAIL/ENVIRONMENT. No broad regression PASS is inferred. Independent three-role source review remains required before source delivery; unavailable reviewers must be recorded, never simulated as independent proof.


## Current Verification and Delivery State

Focused Jest: 32/32, 1 suites, zero pending; all four native commands exit0. Actual local HTTP results are retained in local-http.json; exact dev-header literal failures in Copilot/Medication remain raw FAIL and are assessed separately.

Bounded source implementation, local checks and three independent source reviews are complete. Initial agent quota failures remain historical records under review/. No actionable introduced defect remained; source review does not prove runtime/RLS or release readiness.

Full authenticated DB/RLS, Browser E2E, transaction/TOCTOU behavior and this source deployment remain NOT_PROVEN. Applicable wider offline verification failures are preserved; no Go-Live PASS. No production business mutation was used for this source check.

## Suggested Review Order

- Trace identity/resource checks before existing execution or explicit dependency holds.
  [route.ts:12](../../../../src/app/api/education/announcements/route.ts#L12)

- Check denied resources, authorized behavior and side-effect exclusion.
  [access.test.ts:41](../../../../src/app/api/education/announcements/__tests__/access.test.ts#L41)
