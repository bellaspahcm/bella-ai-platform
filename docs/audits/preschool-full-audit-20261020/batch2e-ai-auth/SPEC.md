---
title: Bind Preschool Copilot authorization to verified identity
type: bugfix
created: 2026-10-21
status: done
baseline_commit: 30134055d1ff5b846584e57833816f076034cdea
context: []
---

<frozen-after-approval reason="Owner requested continuing the remaining audited security fixes; existing authorization invariants and approved Phase1/Phase4 contract determine this bounded repair">

## Intent

The Preschool Copilot API lets caller headers replace the profile role, accepts a tenant selector before binding it to a verified session, and permits general Copilot roles to invoke leadership-only actions. Repair that request boundary before payload execution; retain the existing Product AI implementation and its permission helper.

## Boundaries & Constraints

Always validate Supabase Auth before the profile resolver, whose development path can consume mock context. Require an active canonical profile with the same Auth subject and a nonempty tenant. Use the existing `canUseEducationAiCopilotRole` for general access. Restrict `executive_briefing` and `executive_safety_audit` to the five roles explicitly listed by the approved Phase4 architecture gate: SUPER_ADMIN, CAMPUS_ADMIN, PROGRAM_DIRECTOR, EDUCATION_HEAD, ACADEMIC_ADMIN. Normalize role spelling as the existing helper does; do not invent aliases or map other Product roles.

Every supplied tenantId selector, including duplicate parameters, must equal the profile tenant. Header/cookie/body assertions never establish role or tenant authority. Deny before calling the AI service. Responses must be private/no-store. Keep existing authorized output mapping and invalid-action behavior.

Never change AI capability/service rules, fever/dosage/ratio thresholds, UI, shared permission helper, Platform/Core/Kernel, Supabase schemas/ACL/RLS, credentials or CI controls. No production mutation or model call for verification. Medication/Care/Portal/Announcements, shared management delegation and full authenticated RBAC/RLS are separate residuals. Any new role entitlement or domain semantic needs independent owner evidence.

## I/O & Edge-Case Matrix

| Input / state | Required behavior |
| --- | --- |
| No verified Auth, including forged role/email/cookie and test/development environment |401 before profile/payload/service |
| Auth error, missing/mismatched/inactive profile or tenant missing |401 or403 as applicable; no AI execution |
| Existing eligible general role with bound tenant |Existing general action behavior |
| Disallowed live role plus forged admin header |403; header has no authority |
| Foreign, empty or conflicting duplicate tenant selector |403; no AI execution |
| Matching/omitted tenant selector |Use profile tenant only |
| General teacher/staff/principal/admin aliases invoking executive action |403 unless the exact normalized role is in the Phase4 list |
| Each of the five approved executive roles |Both executive actions retain existing execution |
| Identity/provider failure |Fail closed without AI execution or cacheable response |

</frozen-after-approval>

## Code Map

- `src/app/api/education/ai/copilot/route.ts`: owns request identity, tenant, role/action checks and response caching.
- `src/products/bella-education/__tests__/preschool-ai-copilot.test.ts`: existing general behavior; update route fixtures to verified Auth/live-profile shape only.
- `src/products/bella-education/__tests__/preschool-admin-ai-copilot.test.ts`: preserve executive output tests; replace header-based route fixture authority with live-profile role.
- `src/app/api/education/ai/copilot/__tests__/access.test.ts`: negative execution-boundary and explicit executive matrix coverage using a mocked Product AI executor.
- `src/services/user-actions.ts`, `src/lib/supabase-server.ts`, `src/lib/business-rules/permissions.ts`: existing dependencies, read only.

## Tasks & Acceptance

- [x] Route: remove mock/default identity and tenant selection; validate Auth/profile/session tenant before role and payload/service; enforce exact executive role contract and no-store.
- [x] Existing two test files: add explicit Auth subject and active `tenant_id` profile; remove header authority from successful cases; preserve all existing Product-domain assertions.
- [x] New access suite: cover spoofing, Auth errors, profile binding/status, duplicate tenant selectors, general role denial, both executive actions across approved and denied roles, and no executor on denial.
- [x] Lead: run focused suites/lint/scoped TypeScript, applicable Education/Healthcare commands with safe offline configuration, independent review and actual local HTTP anonymous/spoof probes; retain actual counters and failures.

Given a request rejected by any identity/tenant/action gate, when POST handles it, then no AI executor is invoked and no business write or outbound model request occurs.

Given an eligible verified actor, when an existing general or explicitly permitted executive action is submitted, then the same Product executor/output remains available and the response tenant comes from the live profile.

Given source CI or local HTTP success, when reporting status, then distinguish source-only proof from authenticated real-user workflow, production deployment and complete Preschool RBAC/RLS.

## Design Notes

Independent authority: common Constitution tenant isolation/backend authorization; approved `docs/audits/preschool-ai-copilot/ARCHITECTURE_GATE_RESULT.md` assigns API authorization and preserves the helper; `ARCHITECTURE_GATE_RESULT_PHASE_4.md` section1 item3 supplies the exact executive role list. Current code/tests are behavior evidence, not authority to widen those roles. Profile resolver independently reads live user and tenant status; Auth-first binding prevents its mock path from creating access. Small local route code is sufficient; no new shared auth abstraction or cross-feature rename is needed.

Migration NOT_APPLICABLE: no persistence shape, grant, policy or business data changes. AI rules and health-related test values remain historical behavior checks, not clinical policy certification.

## Verification

- Focused Jest: both existing Product suites plus new access suite, native exit/counters.
- ESLint touched TypeScript; scoped Education TypeScript: zero introduced diagnostics.
- Education/Healthcare verification: execute under explicit loopback/offline credentials; preserve DB-dependent failures and do not seed production.
- Local Next anonymous POST with invalid action and spoofed selectors:401 before model execution; no real Auth fixture or clinical payload.
- Three independent reviewers inspect only this source diff and approved contract references; close actionable introduced defects before seal.


## Current Verification and Delivery State

Focused Jest: 78/78, 3 suites, zero pending; all four native commands exit0. Actual local HTTP results are retained in local-http.json; exact dev-header literal failures in Copilot/Medication remain raw FAIL and are assessed separately.

Three independent source reviewers completed before this record; no actionable introduced defect remained. This does not replace real Auth/RLS or complete Platform regression. Bounded implementation is done; release readiness is not claimed.

Full authenticated DB/RLS, Browser E2E, transaction/TOCTOU behavior and this source deployment remain NOT_PROVEN. Applicable wider offline verification failures are preserved; no Go-Live PASS. No production business mutation was used for this source check.

## Suggested Review Order

- Inspect request authorization before execution and response handling.
  [route.ts:69](../../../../src/app/api/education/ai/copilot/route.ts#L69)

- Verify denial boundaries and preservation of existing behavior.
  [access.test.ts:1](../../../../src/app/api/education/ai/copilot/__tests__/access.test.ts#L1)

- Verify denial boundaries and preservation of existing behavior.
  [preschool-ai-copilot.test.ts:1](../../../../src/products/bella-education/__tests__/preschool-ai-copilot.test.ts#L1)

- Verify denial boundaries and preservation of existing behavior.
  [preschool-admin-ai-copilot.test.ts:1](../../../../src/products/bella-education/__tests__/preschool-admin-ai-copilot.test.ts#L1)
