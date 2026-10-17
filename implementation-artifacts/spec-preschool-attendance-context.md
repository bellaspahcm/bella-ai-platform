---
title: Roster điểm danh luôn khớp lớp và ngày đang chọn
type: bugfix
created: 2026-10-17
status: done
baseline_commit: 0bc9bba1b888ca121dd4ae56eb9ff7ebb1c9831f
context:
  - docs/governance/BELLA_AI_CODING_CONSTITUTION.md
  - docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md
---
<frozen-after-approval reason="Product-first user authority permits bounded UI state/validation fixes without permission expansion">
## Intent
**Problem:** Attendance refreshRoster commits every response into shared roster, no cancellation/version/context guard. A slower old course/day response can overwrite the current roster; table loading hides some rows but pickup cards still use it, and post-save refresh may use stale closure.
**Approach:** Reproduce response ordering with synthetic transport, then bind displayed roster/actions to exact selected course/day and ignore superseded requests. Clear/hide stale data and messages while a new context loads. Preserve the actual API payload and ownership.
## Boundaries & Constraints
**Always:** shown/actionable roster belongs to latest selected course/day. No old response/error/loading/finally may override newer selection. Guard before a command if current row/context is not ready; prevent context switch while a command is in flight if needed. Honest error/readback messages, no false success based on old roster.
**Ask First:** API/domain/guardian/staff authority, date policy, FK, schema/load/DB mutations; Parent/Course implementation.
**Never:** change who may read/pick up a child, choose new guardian, service-role fallback, new DB query/contract/entity, remote/Auth test or real data trial. Do not add validation rules for date beyond existing API requirements.
</frozen-after-approval>
## Code Map
- src/app/dashboard/education/attendance/page.tsx: scoped async UI/context handling only.
- src/app/dashboard/education/attendance/__tests__/page.test.tsx: deterministic component integration with synthetic deferred GET/POST.
- src/app/api/education/attendance/route.ts and handover/route.ts: read-only existing payload semantics.
## Tasks & Acceptance
- [x] Capture pre-fix failing reproduction of A request -> switch B -> B returns -> A returns (course and date), then fix.
- [x] Context changes empty/hide roster and pickup cards until matching current response; old error/finally cannot unset loading or replace state.
- [x] Commands only act on current loaded roster/context; late refresh/save cannot overwrite new context; no backend payload changes.
- [x] Focused tests cover racing success/failure/date change/empty selection or invalid context, and in-flight command behavior.
- [x] Education/test-source typecheck, targeted lint, standalone synthetic browser if feasible, new-message contrast; honest scoped evidence.
Given a late A response after current B loads, then only B remains displayed/actionable.
Given a context load/failure or no selection, then stale rows and pickup controls cannot be used.
Given a command initiated on loaded context, then its request IDs/date remain that context and no stale response changes a later context.
## Verification
Offline nextJest without env/project setup; HTTP synthetic only; no DB/Auth/RLS/E2E proof. Evidence includes source hashes and failing-before/passing-after test result, not implementation-derived permission truth.

## Builder verification

Before changing the page, 3/3 synthetic timing tests failed on the baseline source: old course/day data replaced the current roster and old pickup actions stayed visible during loading. After the bounded state fix, 13/13 focused tests pass. Source is frozen for the three mandatory read-only review lenses.

Evidence: [verification](../docs/audits/preschool-attendance-context/verification.json), [failing-before](../docs/audits/preschool-attendance-context/failing-before.json), [focused tests](../docs/audits/preschool-attendance-context/focused-tests.json), [standalone browser](../docs/audits/preschool-attendance-context/browser-proof.json).

Standalone browser coverage is synthetic component-only in light/dark desktop/mobile, with compiled application CSS. It does not prove authenticated UI, persistence, guardian authority, tenant/RLS or Pre-Go-Live safety. No schema, API payload, pickup eligibility or date-policy change is made.

## Review closure

Three independent read-only lenses completed. One gate-vocabulary metadata correction was verified closed; no actionable implementation findings remain. Lead independently recomputed all 12 contrast ratios with zero mismatch and inspected the dark mobile screenshot. No source/test change after the frozen verification. No story_key is set, so sprint sync does not apply.

## Suggested Review Order

**Current context and commands**

- Display and act only on the selected class/day roster.
  [page.tsx:122](../src/app/dashboard/education/attendance/page.tsx#L122)
- Ignore superseded response, error and loading completion.
  [page.tsx:189](../src/app/dashboard/education/attendance/page.tsx#L189)
- Lock context through commands and report failed readback honestly.
  [page.tsx:227](../src/app/dashboard/education/attendance/page.tsx#L227)

**Supporting verification**

- Reproduce original races and verify command boundaries using synthetic transport.
  [page.test.tsx:1](../src/app/dashboard/education/attendance/__tests__/page.test.tsx#L1)
- Keep UI proof separate from DB, Auth and readiness gates.
  [verification.json:1](../docs/audits/preschool-attendance-context/verification.json#L1)
