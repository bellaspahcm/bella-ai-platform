---
title: Disable the Preschool medication API
type: bugfix
created: 2026-10-21
status: done
baseline_commit: 30134055d1ff5b846584e57833816f076034cdea
context: []
---

<frozen-after-approval reason="Owner explicitly selected Khóa API thuốc, đưa khỏi phạm vi hoạt động Preschool on 2026-10-21">

## Intent

Disable the existing Preschool medication HTTP mutation endpoint. Medication administration is outside the active Preschool Product scope by the owner's direct decision, rather than an inferred role policy.

Always return HTTP410 and stable `PRESCHOOL_MEDICATION_DISABLED`, with private/no-store caching, for every POST caller before Auth, JSON parsing, DB client construction or Product service execution. No role, mock header, payload field or configured service key reopens the operation.

Never delete or rewrite medication data, schemas, historical migrations, safety service/contracts, or tests for their historical behavior. Do not modify Healthcare/Education Kernel or import Healthcare capabilities. No production mutation or feature rollout is performed by source verification. Restoring this capability requires an explicit Product scope decision and a proven authorization contract.

</frozen-after-approval>

## Code Map

- `src/app/api/education/care/medication/route.ts`: replace the unsafe service-role/body-authority execution path with a disabled endpoint response.
- `src/app/api/education/care/medication/__tests__/route.test.ts`: caller-independent closure and absence of payload/Auth/DB/service side effects.

## Tasks & Acceptance

- [x] Replace only the route entrypoint with410 disabled response and no runtime identity/DB/domain imports.
- [x] Verify valid-looking, empty, malformed and spoofed requests all receive the same disabled result; no body read, client creation or service call.
- [x] Lead checks: native Jest/lint/scoped TypeScript/secret guard, actual local HTTP, bounded independent review and evidence. No new migrations or business-data writes.

Given any POST caller, when the medication route handles the request, then it returns410 with the stable disabled code before any side effect or parsing.

Given existing historical records and Product safety-service tests, when the route is disabled, then their files and DB state remain unchanged.

## Verification

Targeted route tests plus existing MedicationSafetyService regression preserve domain logic without asserting a new clinical entitlement. Use offline loopback configuration and synthetic inputs only; local HTTP must not include real patient/student data. This source patch is not proof the production endpoint is disabled until its exact deployed source is verified.


## Current Verification and Delivery State

Focused Jest: 5/5, 1 suites, zero pending; all four native commands exit0. Actual local HTTP results are retained in local-http.json; exact dev-header literal failures in Copilot/Medication remain raw FAIL and are assessed separately.

Three independent source reviewers completed before this record; no actionable introduced defect remained. This does not replace real Auth/RLS or complete Platform regression. Bounded implementation is done; release readiness is not claimed.

Full authenticated DB/RLS, Browser E2E, transaction/TOCTOU behavior and this source deployment remain NOT_PROVEN. Applicable wider offline verification failures are preserved; no Go-Live PASS. No production business mutation was used for this source check.

## Suggested Review Order

- Inspect request authorization before execution and response handling.
  [route.ts:4](../../../../src/app/api/education/care/medication/route.ts#L4)

- Verify denial boundaries and preservation of existing behavior.
  [route.test.ts:1](../../../../src/app/api/education/care/medication/__tests__/route.test.ts#L1)
