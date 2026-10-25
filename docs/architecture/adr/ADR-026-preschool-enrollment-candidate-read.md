# ADR-026 — Preschool Enrollment Candidate Read

**Status:** `ACCEPTED — PASS_BOUNDED_SOURCE; integrated acceptance / owning reseal HELD`
**Date:** 2026-10-22
**Decision owner:** Owner, acting as Human Architect decision authority in the current chat.
**Owner direction:** Route A confirmed insufficient; Route B and the exact three-artifact local unlock explicitly approved on 2026-10-22.
**Related ACR:** [ACR-2026-021](../acr/ACR-2026-021-preschool-enrollment-candidate-read.md)

> Owner approval in the current chat grants local implementation, testing and reseal for exactly the three artifacts below. Every other Education Kernel artifact remains frozen; database permissions and Production are excluded.

## Context

Preschool Enrollment v1 has a bounded POST contract, but the user-facing workflow cannot select a Student and canonical guardian. The current public Student contract supports registration and lookup by a known Party ID, not bounded candidate enumeration. The saved source check found no existing Product-facing Education contract that supplies both eligible Students and current canonical guardian relationships.

The product boundary requires Preschool to consume Education public contracts. Product direct-table reads, unapproved generic-engine wiring, Healthcare bootstrap, and service-role fallback are out of scope. The existing Enrollment POST v1 contract and its evidence must remain unchanged.

## Proposed decision for Human Architect review

Human Architect performs one final, narrow A-path check: name an exact existing Product-facing Education contract and owner if it meets the complete requirement. The saved source check found no suitable contract; no general audit is requested. If none is identified, approve or reject a single additive, read-only candidate-search operation on the Education public Student contract under ACR-2026-021. The operation will return only eligible existing Students and current canonical guardians for one active, branch-authorized Course, using caller-scoped authorization and existing RLS.

If Human Architect identifies a suitable existing public contract, select route A instead and do not modify the Education Kernel. Route B has no effect until the ACR, exact artifact scope, ADR, and explicit unlock are approved and recorded.

## Proposed contract behavior

- Caller is an authenticated Preschool Admin; Product API derives trusted tenant and branch context and checks active Course and branch authorization server-side.
- Search returns active existing Student Parties in the authorized tenant who are not enrolled in the selected Course.
- Each result includes only current canonical `guardian_of` relationships effective on the current Vietnam date and the minimum display information needed for explicit selection.
- Search and pagination are bounded. The Admin chooses a guardian explicitly; the system does not infer one.
- Use a caller-scoped client with existing RLS. Any denial or inability to establish canonical eligibility returns unavailable and stops.
- Do not create identities, mutate Enrollment, change the POST v1 contract, or add grants, policies, schema, migrations, or privileged fallbacks.

## Consequences if approved

- Education Kernel gains one additive public read capability with opt-in use by Preschool Enrollment.
- Existing contract methods and consumers remain behaviorally unchanged.
- Candidate lookup remains blocked if RLS denies any required read; access changes require a separate decision.
- The integrated Preschool workflow still requires Non-Production real-Auth browser evidence, independent Enrollment readback, isolation denial, and idempotent retry evidence.
- Kernel approval does not prove Product acceptance, Auth/RLS persistence, or Preschool Go-Live.

## Alternatives considered

1. **Use an existing public Education contract.** Preferred and must be selected if it meets the full capability without Kernel changes. The current saved check found none; Human Architect may identify one.
2. **Add a bounded Student public contract operation.** Proposed fallback under ACR-2026-021, subject to explicit approval and unlock.
3. **Read tables directly from Product or use unapproved `partyEngine.search` wiring.** Rejected because it bypasses established contract ownership or relies on unapproved wiring.
4. **Use Healthcare bootstrap or service-role access.** Rejected because it crosses product boundaries or bypasses caller-scoped RLS.
5. **Do nothing.** Keeps the current safe block; Enrollment UI remains unavailable.

## Scope and verification conditions

The proposed Kernel scope is limited to:

```text
src/platform/education/contracts/student.contract.ts
src/platform/education/contracts/student.contract.impl.ts
src/platform/education/contracts/__tests__/student-candidate-search.contract.test.ts (new)
```

Any need to modify another Kernel artifact, database schema, ACL/RLS policy, Platform Core, or Healthcare requires stopping and submitting a separate scope decision. No migration is proposed (`NOT_APPLICABLE`).

Before implementation, the contract owner must document the canonical source and semantics for active Student status, Course enrollment exclusion, guardian relationship validity, and Vietnam-date evaluation. Verification must include focused contract tests, authenticated caller/RLS isolation, safe denial behavior, applicable Education architecture gates, and the integrated Non-Production browser/readback/idempotency checks. Preserve existing aggregate failures and report them separately.

## Rollback

Remove the Product consumer first, then the additive contract method, DTO, implementation, and tests. No database rollback is needed. Re-run the approved contract checks and reseal the Kernel. If required data access is denied, stop; do not widen permissions under this ADR.

## Approval record — 2026-10-22

- Human Architect decision authority: Owner in current chat.
- Decision: APPROVED Route B; Route A confirmed insufficient.
- Date: 2026-10-22.
- ACR approval reference: Explicit user approval of ACR-2026-021/ADR-026 and the three-artifact unlock in this chat.
- Contract owner and exact unlock scope: Education OS Student public contract; the exact three paths above.
- Conditions: Local implementation, verification and reseal; no schema, migration, ACL/RLS, Production or other Kernel changes. Canonical mappings are recorded in ACR-2026-021; existing Enrollment POST v1 is preserved.

Implementation window closed after bounded source checks and independent review; exact hashes and runtime prerequisite stop are recorded in ACR-2026-021. Owning reseal and release acceptance remain HELD pending real Auth/RLS, browser and persistence evidence. This ADR does not grant the missing database access or authorize re-provisioning a new security baseline.

## Approved local amendment — 2026-10-23

Owner approved the exact two new SECURITY DEFINER capabilities and five-artifact Kernel unlock in ACR-2026-021 (current-chat reply: “Duyệt đúng amendment local”). Supporting paths, minimal function EXECUTE ACL, rehearsal, real Auth/browser/readback/retry/denial, recovery and reseal are authorized exactly as recorded there. Existing table ACLs, restrictive RLS, old RPC and generic Enrollment consumers remain unchanged. HTTP Enrollment v1 is preserved; POST implementation may delegate to the new public capability. No Production, remote migration, commit/push/merge/deploy authority. Implementation is in progress; runtime acceptance and reseal remain unproven.

Owner-approved follow-up on 2026-10-23 opens exactly the three bootstrap files named in ACR-2026-021, only for the exact Enrollment list page identity/presentation classification. Operational context and detail behavior remain unchanged. This resolves an observed Browser prerequisite rather than expanding database authority.

### Bounded local execution closed — 2026-10-23

Final epoch04 passed real Auth/Browser/Enrollment persistence/retry/tenant-branch denial and recovery with unchanged table ACL/RLS/old RPC. Exact scope hashes and limitations are pinned in ACR-2026-021 and batch3e RESULT.md. Local implementation/source-retention acceptance PASS; full Kernel reseal and Preschool Go-Live remain HELD/NOT_READY. No Production or Git publication occurred.
## Approved local roster identity amendment — 2026-10-23

Owner approved the exact roster RPC/one-artifact Attendance unlock recorded in ACR-2026-021 and `BROWSER_RELEASE_CONTINUATION_20261023.md`. Use the existing public Attendance method for Preschool identity and Product Care reuse; preserve Student/Party shared ACLs and non-Preschool implementation. Supporting local SQL/tests/review/recovery are included; no Production or Git publication. Implementation window OPEN, acceptance and full reseal unproven.

Roster amendment implementation window subsequently CLOSED with `PASS_BOUNDED_LOCAL_ROSTER_CARE`: 203 focused tests / 10 suites; real Auth/Browser/DB and denial/atomicity checks; exact DB recovery/reapply and isolated source recovery. Final hashes and corrected NULL-product compatibility review are pinned in ACR-2026-021 and the Browser continuation report. Student/Party ACLs/policies unchanged. Browser used development mode; Attendance mutation on this baseline and full owning reseal remain HELD/NOT_PROVEN. No global guard/baseline, remote or publication change.

## Approved shared Attendance adapter amendment — 2026-10-23

Owner explicitly approved the exact `recordAttendance()` adapter/test unlock in ACR-2026-021: use the existing authorized atomic Attendance RPC for Preschool and existing non-Preschool consumers, preserve DTO/history-event identity and their existing actor/tenant/time semantics. This resolves the scoped conflict between direct-write containment and the legacy public method's direct INSERT implementation. Only the named method/new test and existing local rehearsal/evidence are authorized. No new database access, Product rewrite, shared-policy expansion, remote or publication authority. Exact implementation window OPEN; acceptance, recovery and full owning reseal remain pending.

The exact adapter window is now **CLOSED / PASS_BOUNDED_LOCAL** at the hashes in ACR-2026-021: 42 focused tests/three suites, caller Auth/public contract/DB/denial/atomicity/UUID compatibility, source+catalog recovery/reapply and final three review layers PASS. ESLint, TypeScript and pinned build08 native0. Scoped history-write containment is retained on local C after bounded public-adapter compatibility passes. This does not prove full English UI/session, production-mode Browser, wider owning aggregate, T2, full Kernel reseal or remote release. No Production/Git publication changes.

## Pending-inclusive registry decision — 2026-10-24

Owner approved “Duyệt đúng gói registry và unlock Non-Production”. Add the Education registry contract/adapter/test exactly listed in ACR-2026-021 and the linked `ROSTER_CONNECTION.md`: caller-derived active Preschool Admin, explicit canonical branch access, existing active/pending Enrollments, bounded literal search/pagination, minimal identity/class fields and no application service role or shared-table ACL/RLS change. Daily Attendance remains active-only. Synthetic owned local execution, review/recovery and scoped reseal are required. Existing children, guardians and Enrollments are not recreated. Production and publication are not authorized. This is an additive local capability decision, not full Kernel reseal or a change to the prior E2E epoch.

This exact three-artifact window is now CLOSED with `PASS_BOUNDED_LOCAL_REGISTRY`: focused55/55, architecture7/7, real local Auth/Browser/readback/denials, zero Student/Party/Enrollment row changes, independent review and exact DB/isolated source recovery. Final hashes and failure provenance are in ACR-2026-021 and `REGISTRY_RESULT.md`. Only bounded local source retention is accepted; full owning reseal remains HELD, Production and Git publication NOT_RUN.

