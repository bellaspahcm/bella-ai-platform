# ACR / ADR — Education Attendance caller reconciliation

Status: APPROVED_SCOPED_NON_PRODUCTION; verification and reseal pending. This records the human's “làm tiếp đi” after the two concrete A/B scope questions and `NEXT_SCOPED_DECISION.md`. The announced scope is E2E implementation and the separate handover draft delivery only; no Production or merge permission. AI reviewers have no authority to widen it.

## Context and decision

The other approved MVP release workstream applied `E2E_MVP_DELTA.sql` to E2E `bmnbqbcdbuklhopfbopv`. Exact two Attendance bodies/ACLs and the target receipt match; direct human approval was corroborated from chat **Tạo branch và audit Preschool**. The source baseline still declares a service-only daily command and a direct-INSERT `recordAttendance()` adapter used by English Center. Neither restoring those SQL bytes nor importing the whole MVP worktree is an authorized compatible repair.

Reconcile only `edu_can_access_attendance_enrollment(uuid,uuid,date)`, `edu_set_daily_attendance(uuid,uuid,text,timestamptz,date)` and `AttendanceContractImpl.recordAttendance()`. Preserve both existing caller contracts: authenticated consumers keep the demonstrated E2E permission/tenant semantics; Preschool's server command keeps its current role/branch/canonical checks. Do not infer new action rights from membership. Authenticated Preschool remains admin/current-school-day/active-course-and-enrollment/one-explicit-branch only; the separately scoped server caller retains admin/super_admin/admin_staff. Non-Preschool action policy stays owned by its Product. No new public method/signature or business side effect.

The daily command serializes enrollment/day and acquires known table/row/FK waits before its final VOLATILE access predicate. Read Committed is required; higher isolation raises40001. The predicate checks current Auth deleted/ban state and active user/tenant. History and daily projection remain one transaction; corrections add history. The adapter uses this existing RPC, reconciles canonical event ID/tenant/enrollment/status/time and has no direct-write fallback. No UI, roster or other method is imported.

## Scoped unlock and ownership

Education owns the command/adapter. Platform identity/access is consumed unchanged. Product owns Preschool action/assignment orchestration. Only these artifacts are open:

- `supabase/migrations/20261024020000_reconcile_education_attendance_callers.sql` — the two named functions and their proven E2E execution roles only.
- `src/platform/education/contracts/attendance.contract.impl.ts` — only `recordAttendance()`.
- `src/platform/education/contracts/__tests__/attendance-record-rpc.contract.test.ts`.
- `src/products/bella-education/__tests__/preschool-chain-real-db.test.ts` — related permission, atomicity and caller tests; retain prior assertions.
- This ACR/ADR, exact scoped unlock/reseal record and separate evidence in `implementation-artifacts/preschool-release-20261024/`.

`ATTENDANCE_SCOPED_UNLOCK_20261024.json` records this exact window. The common inspected Architecture Guard enforces its configured Logistics artifacts; an authored unlock record does not prove a global machine guard. All unrelated Education, Healthcare, Logistics, Finance, Platform and protection files remain frozen. No old migration, table/column grant, policy, default ACL, membership or business history may change.

## Verification and recovery

Independent review before target apply; pin exact current functions/ACL/catalog; rehearse DDL with ROLLBACK and verify unchanged state before approved forward apply. Use run-owned synthetic E2E identities, retain committed academic/event history, retire actors and leave existing schools untouched. A catalog mismatch outside the two functions stops apply. Preserve failure evidence and never turn SKIP into PASS.

Verify actual signed-in English Center public adapter, direct/scoped Preschool allowed and denied paths, foreign tenant/branch, anonymous, banned/deleted/revoked Auth and revocation after real lock waits. Verify atomic failure at each write by DB readback. Keep unit, actual DB, HTTP/browser, CI and Production statuses separate. Applicable Education gates and any wider failures remain explicit; no exemption is created here.

Rollback rehearsal restores both functions and ACLs by transaction rollback. After a committed failure, stop affected writes and obtain bounded forward repair; never delete history, restore an unsafe direct INSERT path or reopen revoked authority. Production parity, credential rotation, backup/restore and release require their own authority/evidence. Reseal only after owning tests and independent review; no claim of `SEALED_ON_MAIN` or Go-Live follows from this record.


## Verified candidate and separately approved delivery —24 October2026

The human has now explicitly approved Attendance commit/push/draft PR/CI Non-Production, and separately approved restoring only the two absent E2E history entries. Source/migration allowlist is unchanged. No merge or Production authority is added.

The exact four-file candidate and normalized Git hashes are pinned in `implementation-artifacts/preschool-attendance-delivery-20261024/DELIVERY_MANIFEST.json`. Final local Attendance selection:16Real DB PASS/0FAIL/11intentional SKIP; unit24PASS. The earlier unsupported stored-super_admin fixture23514 and independent-review limits remain disclosed. Current canonical Auth-backed admin/admin_staff paths and caller-claimed-role denial are tested without widening the identity contract.

E2E reconciliation inserted only history versions20261024010000 and20261024020000 from retained exact SQL/hash receipts. No migration SQL/function/ACL/policy/default was executed or changed. Independent readback confirms both rows and all existing history/catalog unchanged. Scoped E2E parity now25/25 selected histories,36/36 function bodies,28/28 RLS tables and0selected unsafe TRUNCATE grants. The missing-history cause remains NOT_PROVEN. Reconciliation records its actual current time rather than claiming the original entries survived.

The local implementation window is closed for this candidate. Remote CI and release decisions are still separate; this record does not create a machine-enforced manifest unlock or `SEALED_ON_MAIN`. Production remains HOLD and Full Chain Go-Live NOT_PROVEN.
