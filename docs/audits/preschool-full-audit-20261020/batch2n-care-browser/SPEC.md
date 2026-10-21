---
title: 'Preschool Care truthful browser persistence and production-build verification'
type: bugfix
status: in-review
created: '2026-10-21'
baseline_commit: 6b031511f
context:
  - docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md
  - docs/governance/BELLA_AI_CODING_CONSTITUTION.md
  - docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md
---

<frozen-after-approval reason="Owner repeatedly authorized continuing Preschool remediation; approved authorization matrix and exact E2E fixture scope remain effective.">

## Intent

Prove the existing allowed Care workflow through a real browser and local production build. Correct Product UI behavior that sends held health writes or claims persistence after rejected requests. Preserve the approved authorization matrix and already-retained E2E schema.

## Boundaries & Constraints

Always: real provider Auth, synthetic isolated fixtures, approved active enrollment/tenant/branch rules, independent DB readback and exact cleanup. Preserve historical health. Record actual build/test/HTTP results; blocked browser paths remain unproven.

Owner boundary: production operations, additional schema/ACL/helper/role changes and new business semantics require independent authority. Existing approval covers Product-boundary fixes and verification; do not ask again for the approved matrix or E2E fixtures.

Never: service-role runtime bypass, forged identities, mocked successful API/browser results, historical migration replay, frozen Kernel/Core changes, production business data, credentials in artifacts, or fake class choices after dependency failures.

| Scenario | Expected behavior |
|---|---|
| Allowed non-health save | Actual server success count equals requested; reload and independent DB readback match |
| Health input | Visible unavailable state; no health mutation or silent omission of an attempted health write |
| Rejected/network save | Keep editor and existing persisted roster; visible error, no saved toast |
| Class/roster unavailable | Explicit error/empty state; no invented classroom or attendance fallback bypass |
| New browser context | Login form creates actual provider session, user/tenant resolution matches fixture |
| Auth/tenant/branch changed | Previously proved backend denials remain effective; no changed ACL/RLS |

</frozen-after-approval>

## Change Map and architecture gate

Product Preschool owns Care presentation and workflow feedback. Platform owns identity/tenant/Party/access; Education owns Course/Enrollment. UI consumes existing `/api/education/courses` and `/api/education/care/bulk`; persistence remains unchanged. AUTHORIZATION_CONTRACT is canonical: health writes held, medication disabled, non-health Care allowed within proven context. Gate PASS for Product-local corrective maintenance and verification. Migration NOT_APPLICABLE: compare exact retained catalog fingerprint before/after and abort on drift. No new capability or OS/Product redesign.

## Code Map

- `src/app/dashboard/education/care/page.tsx`: two save handlers currently send health and ignore rejection; class and roster fallbacks hide dependency errors.
- `scripts/verify-preschool-care-rls-e2e.cjs`: reuse pinned config/TLS/fixture/Auth/cleanup primitives without invoking preparation/recovery SQL.
- `scripts/verify-preschool-care-browser-e2e.cjs`: new bounded verification entrypoint; public-key-only local production build/runtime, actual Chromium form/UI/API/DB observations.
- `docs/audits/preschool-full-audit-20261020/batch2n-care-browser/`: separate immutable outcomes; preserve prior165 PASS evidence.

## Tasks & Acceptance

- [x] Fix existing UI saves: omit held health from allowed payload, show unavailable inputs, await/validate server outcome, refresh canonical roster, preserve editor on failure.
- [x] Remove fabricated class options and fallback to a different authorization workflow; show explicit load errors.
- [x] Prepare bounded production build/browser harness with independent cleanup, sanitized evidence, source and catalog guards; build before provisioning fixtures.
- [ ] Run appropriate UI/API regression and browser acceptance; close actual defects within the authorized boundary.
- [ ] Review, document remaining independent gates and locally commit; no automatic push/deployment.

Given a permitted save, when the user submits, then the API and DB prove the requested non-health values and UI reload persists them. Given a rejected request, when the user submits, then no new success state appears. Given a schema or target mismatch, when verification starts, then no fixture is created. Given verification failure, cleanup still revokes fixture authority and removes exact owned rows/Auth/profile while preserving terminated audit shells.

## Verification

Build is local `NODE_ENV=production` with the exact E2E public configuration and no privileged key. A build passing with repository `ignoreBuildErrors` does not prove typecheck. Verify private/no-store on actual local production API responses, actual browser form login, Care roster/non-health edit/quick save/reload and independent DB readback. Preserve any root failure with native exit; do not widen DB scope for a missing dependency. Run focused UI/API tests plus applicable Education/Healthcare regression separately. Production and Go-Live remain unproven.

## Current held dependencies and bounded maintenance

Real browser form login PASS; browser roster failed at Courses HTTP500. Actual authenticated canonical `edu_courses` read PASS; legacy projection schema42703 and missing teacher tablePGRST205 are independently recorded. Exact6 catalog unchanged and all owned fixtures cleaned. `OWNER_DECISION.md` and `ACR_COURSE_CATALOG_READ.md` hold only the shared proxy/security and frozen Course-contract dependencies. No extra database prerequisites are authorized or proposed.

The UI also removes fabricated recent activities and the now-unused frontend fever classifier, preserves raw historical health, invalidates stale roster responses and keeps save errors visible inside editors. Current focused regression88 tests/4 suites PASS; Education scoped typecheck zero diagnostics and lint zero errors/warnings. Broad mandatory regression outcomes are recorded separately and do not establish merge readiness.

## Review and current verification

Three independent reviews completed; nine deduplicated implementation/control defects were patched without changing intent or matrix (see REVIEW_RESULTS.md). Current Product build native0 with stable before/after hashes,88 focused tests/4 suites PASS,9 offline controller guard cases PASS, lint/typecheck PASS. The proxy proposal remains unit-only30 cases PASS. Frozen intent and owner boundary are unchanged; required Browser/full-regression/owner gates remain incomplete, so no done/merge/production claim or local commit.
