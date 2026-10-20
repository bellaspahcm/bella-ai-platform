---
title: Enforce the approved Care request and resource boundary
type: bugfix
created: 2026-10-21
status: done
baseline_commit: 30134055d1ff5b846584e57833816f076034cdea
context: []
---

<frozen-after-approval reason="Owner approved AUTHORIZATION_CONTRACT.md matrix and implementation per group on2026-10-21">

## Intent

Care bulk currently accepts a query tenant before Auth, chooses a service-role client, and can persist UI-derived health truth. Enforce the approved Care contract at its API boundary; preserve existing Product care service and domain decisions.

Always verify Auth before live profile; bind active profile subject/tenant; reject every foreign tenant selector including duplicates and reject caller actor/tenant overrides. Only admin or assigned admin_staff are candidate operators, in the Preschool Product. Resolve branch through existing Product course-branch assignment plus the canonical Platform user_org_unit_access projection and active branch metadata, using the session/RLS client. Missing/ambiguous required mapping or DB lookup failure fails closed. No org-unit all-active fallback or direct service client.

Teacher User→Party mapping is not proven by existing capabilities. Therefore admin_staff must receive explicit503 CARE_TEACHER_IDENTITY_UNAVAILABLE until that producer is proven; never compare Auth/Person/Party IDs or infer a mapping from metadata/email. Admin can proceed only after resource scope checks.

Reuse existing DailyCareService read-only roster and EnrollmentContractImpl(session).getEnrollment for enrollment truth; retain only matching active enrollments. Preflight every requested student against that active set before any mutation, rejecting mixed authorized/unauthorized bulk without side effects. Do not add direct Kernel queries or modify Kernel/public contracts. GET preserves existing output mapping but excludes pending/nonactive students.

Requests containing health input for save_care receive503 CARE_HEALTH_POLICY_UNAVAILABLE before writes. Do not derive new fever/status/alert values or defaults. Nonhealth save_care must not overwrite existing health_checks; new rows may use existing DB defaults, without creating a clinical result. Preserve existing care service domain outcomes. Missing transaction guarantees must be reported rather than claimed as full atomic/RLS proof.

Never change schemas/ACL/RLS, approved32 containment, shared identity/Platform/Kernel, domain safety thresholds, UI or CI controls. Do not seed/write production, create Auth identities or run real external AI. Portal/Announcements are later groups under the same approved contract, not part of this patch.

</frozen-after-approval>

## Code Map

- `src/app/api/education/care/bulk/route.ts`: remove admin/mock/default selection; establish identity before payload; call resource authorization before service/mutation; gate health; keep no-store.
- `src/app/api/education/care/bulk/request-context.ts`: small local boundary adapter for identity/product/role/branch and active enrollment checks; no new Platform abstraction.
- `src/app/api/education/care/bulk/__tests__/access.test.ts`: denial/no-side-effect and allowed admin session-client projection tests.
- `docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md`: approved canonical Product rule copied byte-for-byte from the owner-approved draft branch; read only during implementation.
- Existing DailyCareService, EnrollmentContractImpl and Platform access projection: consume existing public boundaries; do not edit.

## Tasks & Acceptance

- [x] Implement local verified identity/product/branch context; handle lookup failures explicitly and exact tenant/actor overrides.
- [x] Wire GET/POST to session/RLS client only; validate every target before mutations; active enrollment checks through existing public contract.
- [x] Reject health input without touching records; preserve existing health_checks during allowed nonhealth saves, no fabricated clinical defaults.
- [x] Tests: anonymous/spoof; inactive/mismatched profile/product; role denial; teacher mapping hold; tenant duplicates; missing/foreign/inactive/ungranted branch; lookup errors; inactive/pending/foreign enrollment; mixed bulk denial; health gate; allowed admin read/action using the same session client.
- [x] Lead verification: native focused Jest/lint/scoped TS/secret checks and actual HTTP PASS; all three independent source reviews completed. Real-user/RLS/atomicity/production limits remain recorded.

Given any rejected identity/resource/bulk target, when Care handles the request, then no care session, record, thread, domain mutation or privileged client is created.

Given a permitted admin and all active matching students, when a supported nonhealth operation is executed, then tenant comes from live context, the existing service uses the same session/RLS client and existing response/domain mapping is preserved.

Given missing teacher mapping, required schema or governed health policy, when an otherwise valid request depends on it, then return explicit503 with no fallback, grant or false success.

## Design Notes

Independent Business Test Contract: owner-approved AUTHORIZATION_CONTRACT.md sections2–6. Canonical branch source is migration20260914_create_user_org_unit_access_projection.sql. Product Chain assignments identify course branch; assignment does not itself confer permission. DailyCareContract provides roster; Education public Enrollment contract provides status/identity. Its getEnrollment accepts explicit session client through existing implementation constructor, so no Kernel mutation or lower-contract expansion is needed. Existing roster includes pending; validate/filter through the public Enrollment contract rather than copying direct Kernel reads.

Migration NOT_APPLICABLE. Full transactional failure behavior and actual authenticated RLS remain separate gates; existing partial Product domain outcomes do not justify any unauthorized target write.

## Verification

Focused access tests with no production DB; lint/scoped Education TypeScript and secret scan. Applicable broad Education/Healthcare offline run already recorded in sibling batch2e on unchanged Kernel; native failures remain failures. Independent reviewers inspect bounded current source diff and approved contract before seal. No unit/mock success is production proof.


## Current Verification and Delivery State

Focused Jest: 67/67, 1 suites, zero pending; all four native commands exit0. Actual local HTTP results are retained in local-http.json; exact dev-header literal failures in Copilot/Medication remain raw FAIL and are assessed separately.

Bounded source implementation, local checks and three independent source reviews are complete. Initial agent quota failures remain historical records under review/. No actionable introduced defect remained; source review does not prove runtime/RLS or release readiness.

Full authenticated DB/RLS, Browser E2E, transaction/TOCTOU behavior and this source deployment remain NOT_PROVEN. Applicable wider offline verification failures are preserved; no Go-Live PASS. No production business mutation was used for this source check.

## Temporal Dependency Hold

The current Enrollment public DTO exposes current status and enrollment timestamp, without an effective-status history producer. Source therefore holds requests outside the current Asia/Ho_Chi_Minh school day with503 CARE_HISTORICAL_SCOPE_UNAVAILABLE before roster/service access. Day-end cutoff uses +07:00. This is a fail-closed dependency limit, not invented historical eligibility or a frozen-contract change.

## Suggested Review Order

- Trace identity/resource checks before existing execution or explicit dependency holds.
  [route.ts:98](../../../../src/app/api/education/care/bulk/route.ts#L98)

- Trace identity/resource checks before existing execution or explicit dependency holds.
  [request-context.ts:9](../../../../src/app/api/education/care/bulk/request-context.ts#L9)

- Check denied resources, authorized behavior and side-effect exclusion.
  [access.test.ts:120](../../../../src/app/api/education/care/bulk/__tests__/access.test.ts#L120)
