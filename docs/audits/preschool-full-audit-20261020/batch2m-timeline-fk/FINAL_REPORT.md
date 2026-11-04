# Preschool Care and Timeline — E2E result, 21-10-2026

**Scoped functional acceptance PASS; approved E2E changes retained. Production unchanged.** Final full run: **165 PASS /0 FAIL /31 NOT_PROVEN**, native exit0. All31 unproven checks concern the known literal-private header behavior of Next development. The raw aggregate remains `PARTIAL_NOT_PROVEN`; this is not full Preschool or Go-Live PASS.

Retention follows the approved [six-relation decision](../batch2l-care-rls/E2E_SCOPE_REQUEST.md#recovery-và-giữ-bản-sửa): functional/denial/cleanup gates must pass, while known local literal-private proof is reported separately. The owner separately approved the exact Timeline FK. No additional Product semantics or authority was inferred.

## Target and retained change

- Exact E2E project `bmnbqbcdbuklhopfbopv`; branch `codex/preschool-care-rls-prerequisites-20261021`; execution HEAD `223e71777b40ccfe7cbecb77022e5a04b5d03fe1`. Product/runtime and frozen Kernel source remained unchanged from the guarded baseline.
- Exactly six approved Care relations: shared Course/Enrollment/Party SELECT ACL and intersecting policies; three canonical attendance/session/record tables and narrowly scoped ACL/RLS. [V3 SQL](E2E_PREPARE_V3.sql) SHA256 `19816c681c67358445e4039c8ebe54e8b4824c556fa01cb394a95072b432eeb1`.
- Exactly one additional approved constraint: `timeline_events_primary_party_id_fkey`, CASCADE→RESTRICT. Immutable Timeline rules remain unchanged. No other Timeline grant/policy/schema change.
- Retained full catalog fingerprint: `9afc1e07426e3c7c27bf697c3e4f1877c5affe876cc96505e471f6a08d31d5d2`. Outside-seven objects and shared helpers, roles, memberships, schema/default ACL fingerprints unchanged. Both packages were retained under the same validation/lock transaction.

## Actual root causes and repairs

1. Timeline CASCADE conflicted with its immutable no-delete rule, blocking unused Party cleanup. Exact FK RESTRICT rehearsal proved unused Party deletion, linked Party rejection23503, unchanged event UPDATE/DELETE protections, reverse DDL and rollback with zero probe residue. The four old Party residues were cleaned in the first batch2m execution; subsequent runs verified their pinned identities absent.
2. Redundant correlated policy evaluation caused real Auth attendance read and record UPDATE timeouts57014. V2 cleared GET; the preserved V2 diagnostic isolated UPDATE57014. V3 keeps the same effective predicates while evaluating actor/access sets per statement, still using live Platform `user_org_unit_access`. Independent reviews verified equivalence; [live helper metadata](live-helper-stability.json) confirmed both helpers STABLE. [Rationale](SQL_V3_RATIONALE.md).
3. Supavisor ignored pg startup timeout options (actual2min/0). The harness now sets and verifies transaction-local30s statement/5s lock bounds. Unknown COMMIT/ROLLBACK acknowledgements block ordinary SQL and cannot become retention PASS. Atomic partial checkpoints preserve sanitized recovery identities. [Evidence and review](TRANSACTION_TIMEOUT_RATIONALE.md).

## Executed verification

- [Full real Auth result](care-rls-results-2026-10-21T02-26-08-047Z.json): six provider-authenticated actors across two tenant/branch fixtures; actual cookie HTTP and direct PostgREST. Active roster/attendance, fresh arrival and independent DB readback, save preserving historical health, mixed pending/foreign bulk403 with zero writes, forbidden roles/resources/columns, all-six anonymous denial and direct role/tenant isolation passed. Same-token branch/profile/tenant deactivation denied SELECT and allowed-column UPDATE; independent values stayed unchanged and restored authority read positively.
- Cleanup PASS: all owned business, Auth and profile counts0; three new relation totals0; two terminated immutable audit tenant shells retained and disclosed. Owned Next listener closed; child had no privileged key. Recovery was rehearsed before commit and succeeded on all prior failed V1/V2 runs. No CASCADE cleanup or protection bypass.
- [Independent post-state process](independent-poststate.json), native exit0: exact retained catalog/source fingerprint, independent zero-residue readback, six anonymous requests401/42501 and six service-role `LIMIT0` requests200. Service requests prove ACL/schema availability with no business rows; they do not replace user Auth acceptance.
- [Five local fault tests](local-fault-tests.log):5 PASS/0 FAIL/0 skipped, native exit0. Syntax passed. These are control-flow evidence, separate from Real DB proof.
- Raw failed/diagnostic runs, partial checkpoints, sanitized command logs, actual native exits and exact executed harness snapshots are preserved. Interrupted execution is separately labeled [NOT_PROVEN with recovery-only proof](INTERRUPTED_RUN.md). No secrets or business-row payloads are included.

Executed full command: `pwsh -NoProfile -NonInteractive -File docs/audits/preschool-full-audit-20261020/batch2m-timeline-fk/RUN_E2E.ps1 -Mode full -Sql E2E_PREPARE_V3.sql -RetainOnPass`. Native [receipt](execution-exit-20261021T022607973Z.json) is0. Executed harness SHA256 `cf6668792ab9779d5019aa01039e259baffd681dbba7248d96f7d7e84275cbb9` matches its preserved snapshot. The independent verifier ran separately with the exact full report as input; its [native receipt](independent-poststate-exit.json) is0.

## Required status labels and remaining gates

| Status | Result |
|---|---|
| PRODUCTION_CHANGE | NOT_RUN |
| ANONYMOUS_CONTAINMENT | NOT_PROVEN for production in this batch; prior32-relation evidence preserved, not rerun |
| AUTHENTICATED_ACCESS_REGRESSION | NOT_PROVEN for production |
| CARE_E2E_AUTH_ACCEPTANCE | PASS for the declared functional scope |
| E2E_FIXTURE_CLEANUP | PASS |
| E2E_CHANGE_RETAINED | YES — approved six relations and exact Timeline FK |
| LOCAL_LITERAL_PRIVATE_HEADER | NOT_PROVEN —31 observations; no-store present, public absent |
| BATCH2B_RBAC_RLS | IN_PROGRESS |
| PRESCHOOL_GO_LIVE | NOT_READY |

Browser E2E, literal-private verification on a production build, broad applicable regression and production positive Auth/RLS acceptance remain independent gates. Teacher identity/effective assignment, governed health, Portal composition and Announcements producer holds remain in force. Medication stays disabled. No frozen Kernel, Product runtime, helper, CI, role membership, schema/default ACL or production object was changed by this batch.
