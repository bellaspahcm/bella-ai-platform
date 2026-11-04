# Care E2E — execution result, 21-10-2026

**BLOCKED. Không giữ thay đổi 6 relation trên E2E. Không thay production.** Rehearsal/recovery và real Auth thành công, nhưng positive Care GET503 và cleanup4 Party chưa đạt acceptance.

## Target and provenance

- Exact E2E project: `bmnbqbcdbuklhopfbopv`; verified API/key role/ref and DB host/user before connection.
- Branch: `codex/preschool-care-rls-prerequisites-20261021`; executed source HEAD `4a7a855e3472dcfd86649b18f27671ccbe7188a1`, runtime unchanged. Next used development + public key/cookie Auth; no privileged runtime fallback.
- SQL SHA256: `612277fd1d8aa49bd868e07652b10d89fce79fb5e6d567f1de9f18e70feac37e`. Pinned in executor; source drift rejected before network.
- DB TLS verifies vendor CA and hostname using the existing repository helper; no endpoint-derived trust or production environment merge.
- Exact executed harness snapshots are preserved as `harness-executed-<sha256>.cjs.txt`. Later addition records sanitized PostgREST error codes only; it has not cleared the functional failure.

## Actual runs

| Raw report start UTC | Native exit | Outcome |
|---|---:|---|
| `00:11:53.929` | 1 | TLS SELF_SIGNED_CERT_IN_CHAIN; no SQL or fixture mutation |
| `00:13:49.996` | 1 | Catalog fingerprint query42725 before preparation; fixed explicit text cast |
| `00:14:48.530` | 1 | Full Auth run:14 PASS /2 FAIL /2 NOT_PROVEN; cleanup FAIL; exact schema recovery PASS |
| `00:20:57.940` | 0 | Metadata-only:4 PASS /0 FAIL /1 NOT_PROVEN; no fixtures; exact schema recovery PASS |

Native exits are preserved separately in `execution-exit*.json`; raw result files retain original errors. Diagnostic exit0 is not functional acceptance.

## Proven and failed gates

- **PASS — preparation/recovery:** exactly6 relation scope; original shared policies preserved; effective anonymous denial and service privileges asserted; schema/default ACL/helper/roles/membership/outside6 catalog fingerprints unchanged. Rehearsal exercises both compensating reverse DDL and transaction rollback. Actual failed-run recovery dropped only3 newly created empty tables, no CASCADE, and reversed the exact three SELECT grants/six shared policies.
- **PASS — identity setup:**6 real provider Auth subjects across2 tenant/branch fixtures; actual SDK login/getUser and cookie sessions; attendance PostgREST positive readiness control; owned Next listener verified and closed.
- **FAIL — functional Care:** `CARE_GET_ACTIVE_0` returned503 `CARE_DATA_UNAVAILABLE`. The expected roster/attendance response was not established. Later mixed/write/readback/direct-RLS cases were not reached; they are not PASS.
- **NOT_PROVEN — local literal-private:** actual no-store present and public absent, but Next development adapter does not retain literal private. This known independent gate did not cause the functional failure.
- **PASS, schema diagnostic only:** service-role `SELECT LIMIT0` attendance→Enrollment embed metadata succeeds. This checks relationship/cache shape with zero rows, bypasses user RLS and does not prove the failing Auth query. Root cause of Auth GET503 remains unproven; no speculative policy optimization was executed.
- **FAIL — fixture cleanup:** Auth/profile, org membership/Person/branch, course/assignment/enrollment, attendance/session/record rows all read back0. Four synthetic Party rows remain in2 terminated tenant shells, active tenant authority0. Live readback found0 Timeline events referencing them. Do not classify this as complete cleanup.

## Cleanup blocker and authority boundary

Actual SQL error: `XX000`, routine `ri_PerformCheck`, constraint `timeline_events_primary_party_id_fkey`. Live catalog confirms `ON DELETE CASCADE` while Timeline's no-delete rule uses `DO INSTEAD NOTHING`. A fresh bounded delete attempt rolled back with the same error; no guard/trigger/rule was disabled.

The separate owning-scope proposal is [TIMELINE_E2E_SCOPE_REQUEST.md](TIMELINE_E2E_SCOPE_REQUEST.md), with review-only [SQL](PROPOSED_TIMELINE_FK_E2E.sql). It proposes exactly one FK CASCADE→RESTRICT on E2E, preserving event immutability. **PENDING OWNER DECISION; NOT EXECUTED.** Timeline is outside the approved6 and the Constitution requires independent authority for protection changes.

## Final state and required labels

Final schema/ACL/policy fingerprint: `072823be74a756264d9c175a9d3caf8d6a9092f28f7e4e97da624c58b2472959`, equal to the pre-change baseline after both committed trials. All6 preparation changes recovered; retention did not occur. Synthetic4 Party residues are reported separately from metadata restoration.

| Status | Value |
|---|---|
| PRODUCTION_CHANGE | NOT_RUN |
| ANONYMOUS_CONTAINMENT | NOT_PROVEN in this batch; prior32-relation evidence preserved, not rerun here |
| AUTHENTICATED_ACCESS_REGRESSION | NOT_PROVEN for production |
| CARE_E2E_AUTH_ACCEPTANCE | FAIL |
| E2E_FIXTURE_CLEANUP | FAIL —4 Party residuals, authority revoked |
| E2E_SCHEMA_RECOVERY | PASS |
| E2E_CHANGE_RETAINED | NO |
| BATCH2B_RBAC_RLS | IN_PROGRESS |
| PRESCHOOL_GO_LIVE | NOT_READY |

Browser E2E, broad Platform/Education regression and production positive access were not executed. This batch changes no Product runtime, frozen Kernel, helper, schema/default ACL, role membership, CI or production object.

Next execution must first resolve the pending Timeline boundary, then capture the actual Auth PostgREST error code behind Care GET503, fix only the proven cause, and rerun all functional/denial/cleanup gates. No new Party fixtures should be created while their cleanup path is known to fail.
