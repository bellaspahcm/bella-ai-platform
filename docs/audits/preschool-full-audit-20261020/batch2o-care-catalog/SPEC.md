---
title: 'Approved canonical Care class catalog and private response headers'
type: bugfix
created: '2026-10-21'
status: in-review
baseline_commit: 6b031511fd37e5ee22288676b833cf855d40b43f
context:
  - docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md
  - docs/governance/BELLA_AI_CODING_CONSTITUTION.md
  - docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md
  - docs/audits/preschool-full-audit-20261020/batch2n-care-browser/ACR_COURSE_CATALOG_READ.md
---

<frozen-after-approval reason="Owner directly approved both exact proposals, including ADR/unlock/reseal, in reply to OWNER_DECISION.md on 2026-10-21.">

## Intent

Care's class selector is blocked by the shared Courses API's incompatible legacy projection and absent teacher table. Its private cache contract is overwritten by the shared proxy. Add the approved read-only canonical public contract and Care-only class list; enforce private/no-store on the exact two Care paths. Prove actual browser persistence with existing bounded real-Auth fixtures.

## Boundaries & Constraints

Always: minimal typed Course identity from `edu_courses`, caller's authenticated client and tenant filter, approved active Preschool admin/tenant/branch scope, current Platform access, explicit empty versus unavailable, private/no-store on success and failures. Reuse `resolveCareRequestContext`, Course/branch assignment producer and Platform access rows. Keep `admin_staff` held until its mapping is proven. Existing batch2n truthful-save UI behavior is preserved.

Authority: owner approved both scopes verbatim. Exactly two new Education files are authorized after ADR/manual artifact unlock; no general Kernel unlock. Product consumer, tests, exact proxy correction and bounded verification are included. Source/matrix/target drift or required scope growth stops only the affected work.

Never: DB/schema/ACL/policy/helper/default-role changes, production operations, legacy Course/Training modifications, teacher provisioning, Healthcare changes, migration replay, service-role runtime, mocked successful browser requests, fake class data, or treating generic guard PASS as Go-Live. Preserve batch2n raw evidence and original pending/draft proposal records as historical snapshots; this batch records their owner-approved successor state.

| Scenario | Required outcome |
|---|---|
| Valid admin and active class in granted active branch | Only canonical allowed class identity, no teacher/legacy projection dependency |
| Valid admin with no allowed classes | Successful empty list, no invented options |
| Anonymous / unapproved role / foreign tenant selector |401 /403, no data access beyond authorization requirements |
| Inactive profile/tenant/branch, inaccessible branch | Denied or excluded; no cross-scope data |
| Missing/ambiguous binding or dependency failure | Stable503, no DB detail or partial success |
| admin_staff without proven teacher identity | Existing503 hold, no invented mapping |
| Exact Care class/bulk responses | private, no-store, including session refresh; neighboring/public/webhook behavior unchanged |
| Browser permitted and rejected saves | Actual POST/readback/reload; rejected edit retained, DB unchanged, no held health writes |

</frozen-after-approval>

## Change Map and gate

Ownership: Education owns canonical Course identity; Platform owns Auth/tenant/branch access; Preschool owns the class list authorization and Care feedback. Reconciliation is Product UI → Care classes API → canonical catalog public contract → `edu_courses`; permission intersection remains Product policy using existing producers. Contract change is necessary because the existing public Course contract reads the conflicting legacy model. New DTO is minimal read-only identity; no mutation/event semantics. Migration NOT_APPLICABLE. Architecture entry decision PASS for the exact owner-approved additive boundary, conditional on documented ADR/manual unlock before writing the two files. Unchanged frozen artifacts are fingerprinted before/after; no guard baseline edits.

## Code Map

- `src/platform/education/contracts/canonical-course-catalog.contract.ts` and `.impl.ts`: only newly unlocked Education artifacts, typed read-only caller-scoped producer.
- `src/app/api/education/care/classes/route.ts` and `__tests__`: real-Auth context, authorization intersection, stable responses and contract regression.
- `src/proxy.ts` and focused Product test: exact bulk/classes cache policy and cookie refresh persistence.
- `src/app/dashboard/education/care/page.tsx` / tests: switch only Care's catalog consumer; preserve current draft/error controls.
- Existing browser controller: additive batch2o invocation/evidence, guarded source and exact6 catalog; no DDL path.

## Tasks & Acceptance

- [x] Record direct owner approval, ADR, exact manual unlock and existing frozen-content baseline.
- [x] Implement minimal contract/API and allowed/denied/dependency tests; no additional Kernel file.
- [x] Apply exact proxy correction and update Care selector; test both paths and unrelated paths.
- [x] Run focused regression, lint, Education typecheck and actual local production Browser/API/DB verification with cleanup and recovery checks.
- [x] Run applicable mandatory architecture/conformance/regression gates; separate environment failures and do not enable out-of-scope broad DB fixtures.
- [x] Three independent reviews, correct defects, record exact artifact hashes and qualified reseal/remaining gates; no automatic push.

Given current authorized fixtures, when the browser logs in and selects its actual class, then permitted non-health Care saves persist and reload. Given branch authority is revoked during that real session, then save is denied with no DB delta and editor intact. Given catalog/source drift, no fixture is created; after every run, owned rows/Auth/profile are zero and the exact retained catalog is unchanged.

## Verification gates

Dedicated gates:0 tenant isolation;1 exact ownership/frozen scope;2 public-contract boundary;3 typed canonical DTO;4 no business mutation/legacy dependency;5 allowed/denied live authorization;6 real-session tenant/branch/role changes;7 actual API and independent DB readback;8 real Browser save/reload/errors and private headers;9 cleanup/recovery/catalog integrity;10 mandatory regression and source/evidence integrity. Eleven gates total; failed or blocked mandatory regression is recorded, never waived.

Run focused Jest tests, scoped lint/typecheck, approved actual local `next build --webpack`/`next start`, retained E2E fixture harness and relevant Education/Healthcare verification. Existing broader suites lack safe in-scope DB fixtures; record actual outcomes and reuse only unchanged source-bound evidence with explicit applicability. Production/full Preschool Go-Live stays independent.

## Execution outcome

Owner-approved implementation and scoped reviews are complete. Main real Browser run24 checks PASS/native0; expanded context run26 functional checks PASS but aggregate FAIL/native1 from a cleanup timeout. Exact1-profile recovery native0 and independent three-run poststate/12 ACL requests PASS; all owned residues0 and catalog unchanged. Focused140 tests/6 suites, additional conformance16/2, proxy42 cases, controller11 cases, lint/typecheck/Healthcare guard PASS. Education broad verify remains raw FAIL from DB mock/fixture environment. RESEAL_STATUS.json is HELD; spec stays in-review rather than done and there is no commit/push/merge/readiness claim. Cleanup timeout cause is not proven; its recovery is proven.

## Suggested Review Order

- Owning decision and exact manual exception
  [ADR.md:1](ADR.md#L1)

- Minimal canonical read-only producer
  [canonical-course-catalog.contract.impl.ts:1](../../../../src/platform/education/contracts/canonical-course-catalog.contract.impl.ts#L1)

- Current actor and branch permission intersection
  [route.ts:1](../../../../src/app/api/education/care/classes/route.ts#L1)

- Exact private header paths and cookie refresh
  [proxy.ts:16](../../../../src/proxy.ts#L16)

- Truthful UI consumes the new catalog
  [page.tsx:425](../../../../src/app/dashboard/education/care/page.tsx#L425)

- Allowed, denied and unavailable contract coverage
  [access.test.ts:1](../../../../src/app/api/education/care/classes/__tests__/access.test.ts#L1)

- Actual runtime outcomes and qualified remaining gates
  [FINAL_REPORT.md:1](FINAL_REPORT.md#L1)
