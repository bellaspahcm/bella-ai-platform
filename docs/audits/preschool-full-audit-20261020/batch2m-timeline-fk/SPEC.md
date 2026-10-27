---
title: 'E2E Timeline FK recovery and Care real Auth completion'
status: done
baseline_commit: 223e71777b40ccfe7cbecb77022e5a04b5d03fe1
context: []
---

Owner decision: “Duyệt đúng FK E2E, giữ sửa đổi nếu PASS”. Exact target `bmnbqbcdbuklhopfbopv`. Original exact6 Care authority remains valid. No production authority.

Problem: Timeline primary Party CASCADE FK conflicts with immutable no-delete rule, causing XX000 even for unused synthetic Party cleanup. At entry, Care GET503 remained unresolved and required real Auth error-code diagnosis.

Change Map: Platform owns `timeline_events` and Party lifecycle; Education owns Course/Enrollment/attendance; Product owns Care. Only the named Timeline FK may change CASCADE→RESTRICT, preserving every rule/ACL/RLS/helper/membership and business/event data. The approved six-relation Care package remains separate. No frozen Kernel or Product runtime change is proposed.

Architecture gate: PASS for this explicitly approved E2E-only FK and previously approved exact6 package. This is not a new OS/Product/capability, production migration or Go-Live decision. Migration applicability: one bounded constraint replacement with exact baseline/post-state guards and reverse recovery; no historical migration replay.

Execution: extend existing guarded executor, reuse TLS/config/catalog/Auth/cleanup patterns. Rehearse unused Party deletion, event-linked deletion23503, unchanged immutable event UPDATE/DELETE, compensating reverse DDL, full transaction rollback and fixture absence before commit. Clean only four prior synthetic Parties after exact scope/event/authority checks. Run original real Auth acceptance with sanitized PostgREST error-code receipts. Keep both packages only if functional, denial, cleanup and outside-scope checks PASS; otherwise recover with drift guards.

Given wrong target/source or unapproved flag, execution aborts before mutation. Given any FK/rule drift, execution aborts without rewriting it. Given a Party linked to a Timeline event, DELETE returns23503 and the event stays unchanged. Given an unused Party, DELETE succeeds. Given failed Care acceptance, six-relation and FK recovery execute independently without CASCADE or protection bypass. Given success, only approved changes remain, with zero owned business/Auth/profile residues and terminated audit shells reported honestly.

Verification: syntax/offline rejection, independent security/recovery review, real SQL rehearsal, real Auth cookie HTTP/PostgREST, independent DB readback, exact cleanup and recovery/retention fingerprints. All raw prior FAIL evidence remains immutable. Browser E2E, broad regression, production access and Go-Live remain separate gates; no success inferred from catalog changes alone.

Execution completed: [final report](FINAL_REPORT.md). Scoped functional/denial/cleanup PASS (165 PASS,0 FAIL);31 known local literal-private observations stay NOT_PROVEN. Owner-approved E2E changes retained; separate-process post-state proof and12 ACL requests PASS. All prior failed evidence remains unchanged. Production, Browser E2E and Go-Live are not established.

## Suggested Review Order

**Outcome and authority**

- Start with actual results, retained scope and remaining independent gates.
  [FINAL_REPORT.md:1](FINAL_REPORT.md#L1)
- Bind the exact additional FK to the trusted owner decision.
  [owner-authorization.json:1](owner-authorization.json#L1)

**Scoped DB changes**

- Preserve immutable events while permitting deletion of unused Parties.
  [E2E_TIMELINE_FK_EXECUTE.sql:3](E2E_TIMELINE_FK_EXECUTE.sql#L3)
- Evaluate equivalent actor predicates once per statement.
  [E2E_PREPARE_V3.sql:73](E2E_PREPARE_V3.sql#L73)
- Reuse live Platform access without a correlated permission copy.
  [E2E_PREPARE_V3.sql:289](E2E_PREPARE_V3.sql#L289)

**Execution and evidence**

- Enforce transaction bounds and preserve unknown commit outcomes.
  [verify-preschool-care-rls-e2e.cjs:198](../../../../scripts/verify-preschool-care-rls-e2e.cjs#L198)
- Exercise real Auth allowed paths, denials and independent readback.
  [verify-preschool-care-rls-e2e.cjs:646](../../../../scripts/verify-preschool-care-rls-e2e.cjs#L646)
- Coordinate both packages after exact cleanup and drift checks.
  [verify-preschool-care-rls-e2e.cjs:866](../../../../scripts/verify-preschool-care-rls-e2e.cjs#L866)
- Independently recheck retained catalog, residues and least-privilege ACL requests.
  [VERIFY_RETAINED_STATE.cjs:1](VERIFY_RETAINED_STATE.cjs#L1)

**Fault verification**

- Prove lost acknowledgements cannot permit unsafe subsequent statements.
  [verify-preschool-care-rls-e2e.test.cjs:116](../../../../scripts/verify-preschool-care-rls-e2e.test.cjs#L116)
