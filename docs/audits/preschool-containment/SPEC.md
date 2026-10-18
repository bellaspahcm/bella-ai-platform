---
title: 'Temporary Preschool containment on private C10'
type: bugfix
created: '2026-10-17'
status: done
baseline_commit: 0bc9bba1b888ca121dd4ae56eb9ff7ebb1c9831f
context:
  - docs/audits/preschool-containment/ARCHITECTURE_GATE_RESULT.md
---

<frozen-after-approval reason="Owner explicitly authorized the exact three reviewed containment diffs in the current instruction">

## Intent

Temporarily hold Parent Daily reads and Course creation while their trusted authorization is unresolved; limit direct anonymous student reads on the isolated synthetic C10. Containment is not a functional authorization repair and does not make Preschool ready.

## Boundaries & Constraints

Always: verify final patch hashes, exact C10 target and decryptable post-load snapshot before DB writes; prove runtime and catalog behavior; retain isolation and original snapshot. Use synthetic data only. Keep UI PR358–360 draft. Preserve D01–D05 and functional Course eight-file allowlist.

Ask first: any functional Parent/Course repair, extra runtime file, role/ACL mutation, migration, other DB/remote target, merge or release.

Never: infer Production equivalence, use service-role tests as RLS proof, add guardian/user authority mechanisms, retarget teacher FK, dual-write/backfill, change authenticated-parent policies, modify frozen kernels or run remote probes.

## I/O & Edge-Case Matrix

| Scenario | Input/state | Expected behavior | Error handling |
|---|---|---|---|
| Parent read | Any actor/query | 503, success=false, PARENT_ACCESS_NOT_READY | Static safe warning, no request/PII logging |
| Course create | Empty, malformed, legitimate or unauthorized body | 503, success=false, COURSE_AUTHORIZATION_NOT_READY | No body parse, DB call, assignment or event |
| Existing Course GET | Unchanged handler | Same code as baseline | No scope expansion |
| Anonymous student read | Nonempty two-tenant C10 fixtures | Visible before guard; zero after | Run as actual non-bypass anon role |
| Authenticated student read | Same claims before/after | Identical rows/ACL, no added privileges | Known unauthorized visibility remains FAIL |
| Preflight mismatch | Target, snapshot, checksum or membership drift | Stop before mutation | No remote fallback |
| Later failure | Verification fails | Stop, recover scoped target, keep stopped | Preserve failure evidence |

</frozen-after-approval>

## Code Map

- `src/app/api/education/parent-daily/route.ts`: replace with exact reviewed 503 handler.
- `src/app/api/education/courses/route.ts`: replace POST only; preserve all other code.
- `src/__tests__/preschool-containment.test.ts`: focused real NextResponse handler tests with dependency tripwires.
- Local E01 operational harness: exact named volume, peer verifier, role test sessions, snapshot recovery and cleanup. No host port.

## Tasks & Acceptance

Execution:
- [x] Apply the two immutable HTTP patches in this clean worktree; retain review hashes.
- [x] Add focused tests for status/body/safe log, malformed requests and zero dependency/body side effects; verify GET unchanged.
- [x] Verify snapshot/target and apply only the reviewed restrictive policy, with synthetic before/after RLS readback and cleanup.
- [x] Record focused tests, static checks, reviews and actual limits in the current mission evidence index.

Acceptance Criteria:
- Given valid or invalid requests, when either held handler runs, then the stable 503 response is returned without touching downstream capabilities.
- Given the private C10 baseline and nonempty fixtures, when the guard commits, then anonymous reads return zero while authenticated result sets, grants, memberships and existing policies remain equal.
- Given completion, when target/container/listener checks run, then fixtures are removed, target is cleanly stopped, no container/port remains and the original volume is unchanged.
- Given missing proof, when reporting readiness, then report NOT_PROVEN/BLOCKED rather than inferring UI→DB, Auth/JWT, full Parent RLS, Course authorization or Go-Live PASS.

## Spec Change Log

Owner authorization recorded from current exact execution recommendation; previous design-only restrictions are superseded solely for these temporary diffs. No new approval checkpoint is introduced for already approved work.

## Verification

Focused Jest; lint changed files; Education typecheck/no-new-debt; exact diff review; real NextResponse handler/HTTP smoke; private PostgreSQL role tests, pre/post catalog and fixture readback; existing UI proofs preserved. Full app/browser/Auth and remote Healthcare integration are separate evidence gates.

## Suggested Review Order

- Check the approved temporary hold and retained readiness limits.
  [ARCHITECTURE_GATE_RESULT.md:1](ARCHITECTURE_GATE_RESULT.md#L1)
- Parent read stops before identity resolution or data access.
  [parent-daily/route.ts:4](../../../src/app/api/education/parent-daily/route.ts#L4)
- Course creation stops before request parsing or writes; GET stays unchanged.
  [courses/route.ts:227](../../../src/app/api/education/courses/route.ts#L227)
- Nonempty role probes prove anonymous denial while preserving authenticated outcomes.
  [c10-containment-proof.json:1](c10-containment-proof.json#L1)
- Tripwires and loopback transport substantiate the bounded handler behavior.
  [preschool-containment.test.ts:1](../../../src/__tests__/preschool-containment.test.ts#L1)
- Review remaining safety gates and evidence limits.
  [REVIEW_AND_VERIFICATION.md:1](REVIEW_AND_VERIFICATION.md#L1)
