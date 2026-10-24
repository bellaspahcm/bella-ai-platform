---
title: Contain parent-token issuance and harden existing token access
type: bugfix
created: 2026-10-21
status: done
baseline_commit: 30134055d1ff5b846584e57833816f076034cdea
context: []
---

<frozen-after-approval reason="Owner approved the Preschool authorization matrix and requested implementation per group on2026-10-21">

## Intent

Portal issuance currently lacks issuer authorization and substitutes default identities; token signing falls back to a hardcoded value; consumption relies on an incorrect guardian query/fallback, while parent Copilot checks only signature. Apply the approved Parent access contract without inventing missing issuer resource composition.

Issuer must verify Auth before active matching profile; require live active Preschool tenant and exact admin role; reject foreign tenant/actor selectors. Then return503 PORTAL_ISSUANCE_NOT_READY before parsing/signing/privileged client because the complete request-scoped Party/enrollment/authorized-branch composition is not proven. No new token is issued until that dependent composition is established. Do not call a missing adapter a globally missing Platform capability.

Token generation uses existing configured secret precedence only (SUPABASE_SERVICE_ROLE_KEY then NEXTAUTH_SECRET), no hardcoded fallback. Missing configuration returns stable unavailable. Newly generated tokens default to1 day and must have finite positive duration at most1 day. Verification must retain correctly signed unexpired legacy60-day token compatibility; do not retrospectively cap legacy TTL or rotate secrets. Validate required claim types/finite times and fail malformed tokens safely.

Every current token consumer must validate signature/expiry and live active Preschool tenant, both existing nondeleted Parties, correctly directed guardian_of/parent_of relationship and current active_from/active_to before payload/chat/AI side effects. Query correct source_party_id/target_party_id fields; lookup error/no match never falls back to arbitrary relationship. Validate dates against current access time, not caller's requested historical payload date.

Preserve the existing server-side signed-token capability adapter for payload/chat; it is not a client-RLS proof. Never add a privileged fallback after an authorization/RLS failure or widen grants. Parent Copilot must use the same live-binding guard before processing and only its existing guardian question action ask_copilot; staff/executive actions belong to separate approved Copilot authority. No direct production-token payload/chat/model calls.

Never change Platform/Kernel/schema/ACL/RLS, secret precedence/values or existing token expiry; no provider/bootstrap/Party mapping invention, new tables or health/AI rules. Existing valid payload/thread behavior is preserved after stronger guards, not redesigned. Announcements is the next group.

</frozen-after-approval>

## Code Map

- `src/app/api/education/portal/token/route.ts`: replace unsafe minting/defaults with verified admin Product gate and explicit issuer dependency hold.
- `src/products/bella-education/parent-portal/services/preschool-parent-portal.service.ts`: configured signing, new-token TTL validation, legacy verify compatibility and reusable live token/resource authorization.
- `src/products/bella-education/parent-portal/repositories/parent-portal.repository.ts`: strict tenant/Parties/current guardian predicate, no fallback; scoped metadata reads only.
- `src/app/api/education/portal/[token]/route.ts`, `chat/route.ts`, `copilot/route.ts`: guard all consumers and no-store; sanitized stable401/503 errors. Existing configured server capability adapter remains; no RLS claim.
- `src/products/bella-education/__tests__/preschool-parent-portal.service.test.ts`: canonical relationship/tenant/Party fixtures, synthetic secret, existing payload/chat assertions preserved.
- `src/app/api/education/portal/token/__tests__/access.test.ts`: issuer no-token/no-side-effect gates.
- `src/app/api/education/portal/__tests__/access.test.ts`: consumer guard ordering/no-side-effect and unsupported executive-action negatives.
- `src/products/bella-education/__tests__/preschool-parent-portal-security.test.ts`: secret absence/precedence, strict TTL/claims, independently signed legacy token and guardian dates/errors/foreign or deleted targets.

## Tasks & Acceptance

- [x] Remove unsafe issuer factory/defaults; verified Auth/profile/admin/Product context, no new token before503 hold.
- [x] Signing/verify hardening and strict repository live binding reused by payload/chat/parent Copilot.
- [x] Consumer no-store and stable errors, guard before parsing/domain/model side effects; parent Copilot rejects staff/executive actions.
- [x] Existing tests use canonical fields/configuration; add independent security and route negatives/positive preservation. Do not alter Product domain results merely to make guards pass.
- [x] Lead verification: native focused Jest/lint/scoped TS/secret checks and actual HTTP PASS; all three independent source reviews completed. Real-user/RLS/atomicity/production limits remain recorded.

Given anonymous, spoofed, inactive, foreign Product or nonadmin issuance, when POST executes, then no signing/client/domain side effect occurs.

Given a verified active Preschool admin, when issuer prerequisites remain unproven, then503 PORTAL_ISSUANCE_NOT_READY returns without a token or placeholder guardian.

Given a valid token with revoked/expired/foreign/deleted live binding or lookup error, when any consumer is invoked, then no payload aggregation, thread creation, chat insert or AI call occurs.

Given configured secret and legitimate existing token/binding, when existing payload/chat behavior executes, then its Product semantics remain and legacy TTL is not changed.

## Design Notes

Canonical authority is owner-approved AUTHORIZATION_CONTRACT.md sections2/5/6; Phase3 Copilot architecture gate establishes parent question capability and Phase4 reserves executive actions for staff leadership. Existing repository fields are proven by generated schema. Party public engine exists but this issuer lacks a proven request-scoped repository; existing enrollment contract cannot discover by student. Keep dependent issuance closed instead of creating a mapper/bootstrap or raw privileged route.

Migration NOT_APPLICABLE. Configured existing bearer-token server adapter is not anonymous direct DB access and is never used to paper over a failed user RLS check; its source authorization and actual RLS must be reported separately. Full authenticated and Portal production flow remain NOT_PROVEN until real isolated Auth/guardian/DB evidence.

## Verification

Four focused suites listed above, existing domain assertions preserved. Loopback/offline Supabase and synthetic signing keys; no real model/network/business fixture calls. ESLint/scoped Education TypeScript/secret scan. Three independent bounded reviews before source seal. Valid production token GET is not a read-only probe because existing payload can create a thread; do not perform it.


## Current Verification and Delivery State

Focused Jest: 104/104, 4 suites, zero pending; all four native commands exit0. Actual local HTTP results are retained in local-http.json; exact dev-header literal failures in Copilot/Medication remain raw FAIL and are assessed separately.

Bounded source implementation, local checks and three independent source reviews are complete. Initial agent quota failures remain historical records under review/. No actionable introduced defect remained; source review does not prove runtime/RLS or release readiness.

Full authenticated DB/RLS, Browser E2E, transaction/TOCTOU behavior and this source deployment remain NOT_PROVEN. Applicable wider offline verification failures are preserved; no Go-Live PASS. No production business mutation was used for this source check.

## Suggested Review Order

- Trace identity/resource checks before existing execution or explicit dependency holds.
  [route.ts:12](../../../../src/app/api/education/portal/token/route.ts#L12)

- Trace identity/resource checks before existing execution or explicit dependency holds.
  [preschool-parent-portal.service.ts:206](../../../../src/products/bella-education/parent-portal/services/preschool-parent-portal.service.ts#L206)

- Trace identity/resource checks before existing execution or explicit dependency holds.
  [parent-portal.repository.ts:148](../../../../src/products/bella-education/parent-portal/repositories/parent-portal.repository.ts#L148)

- Trace identity/resource checks before existing execution or explicit dependency holds.
  [route.ts:26](../../../../src/app/api/education/portal/[token]/route.ts#L26)

- Trace identity/resource checks before existing execution or explicit dependency holds.
  [route.ts:26](../../../../src/app/api/education/portal/[token]/chat/route.ts#L26)

- Trace identity/resource checks before existing execution or explicit dependency holds.
  [route.ts:32](../../../../src/app/api/education/portal/[token]/copilot/route.ts#L32)

- Check denied resources, authorized behavior and side-effect exclusion.
  [preschool-parent-portal.service.test.ts:181](../../../../src/products/bella-education/__tests__/preschool-parent-portal.service.test.ts#L181)

- Check denied resources, authorized behavior and side-effect exclusion.
  [access.test.ts:43](../../../../src/app/api/education/portal/token/__tests__/access.test.ts#L43)

- Check denied resources, authorized behavior and side-effect exclusion.
  [access.test.ts:53](../../../../src/app/api/education/portal/__tests__/access.test.ts#L53)

- Check denied resources, authorized behavior and side-effect exclusion.
  [preschool-parent-portal-security.test.ts:50](../../../../src/products/bella-education/__tests__/preschool-parent-portal-security.test.ts#L50)
