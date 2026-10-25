# Preschool MVP — E2E acceptance, 2026-10-24

**Runtime: PASS_BOUNDED_E2E. Independent read-only verification: PASS. Final acceptance review: PASS_BOUNDED_ACCEPTANCE_REVIEW. Production Go-Live: NOT_READY.**

Approved target: Supabase `bmnbqbcdbuklhopfbopv` (`bella-spa-erp-e2e`), release-plan sections9/9.1/9.2/9.3. The app ran locally in Next production mode against that remote test backend. This is not a Production deployment. Production `lvnvkpyxtuilhrabtlwv` was not mutated.

Source: branch `codex/preschool-release-20261023`, HEAD `80e13ea92ee70742d26cd890a45aaa94d8fc7494` plus the retained selected uncommitted MVP changes. Actual tested E2E build: `fUdaRHs7DypX3PUAjLJK2`, built with the E2E configuration, build native exit0. Final independent verification checked all3,324 pinned source/control paths with zero drift. The older source-pin build `U935iOhDLBp_SouA622oM` is not the tested E2E build.

## Completed acceptance

Final run: `3dc2a571-5216-481b-b206-c6ca4119613d`, 2026-10-24 01:14:55–01:18:08 UTC. Native exit0, **114 named harness checks PASS**. This is not a claim of114 Browser tests or114 unit tests. The single Browser workflow covers:

- Real login; canonical Course list → detail → reload.
- Candidate Student and explicit guardian selection; Enrollment POST; roster refresh; profile navigation with Course context.
- Dashboard/Reports real values, missing-evidence handling, Q&A boundary and branch denial.
- Tenant school bulletin publication, retry, reload and Portal feed; no private chat/delivery/email/push.
- Profile → explicit guardian → signed Portal; read-only anonymous Browser, reload, wrong-signature/expiry/cross-tenant denial.
- Attendance roster, two writes, reload, analytics readback and private/no-store response.
- Nonhealth Care save, reload and persisted note; health UI remains held.

The same final epoch additionally proves independent DB readback, Enrollment request-ID retry and capacity rejection; Attendance and Care second-write `23514` with complete pre/post fingerprints unchanged; two-record Care meal/nap/hygiene persistence; wrong tenant/branch/staff/inactive denial; sensitive health-write denial with zero side effects; canonical-roster failure denial; and direct operational-data isolation when a Course is unbound, its branch inactive or explicit access expired. Academic catalog metadata stays readable under its separately approved contract. Bounded non-Preschool regression preserves the two tested historical Attendance caller roles and their previous Care denial; this is not all-consumer certification.

## Repairs and retained changes

The six reviewed target-specific stages and reverse recovery order are in [EXECUTION_ORDER.md](EXECUTION_ORDER.md). Every apply has a successful rollback/exact-recovery rehearsal and a fresh committed-state read-only postcondition. SQL execution artifacts default to ROLLBACK. No whole migration-history push was used.

The last blocker was Care performance. The original per-record write path returned actual PostgreSQL `57014`. An ordered bulk UPSERT preserved INVOKER mode, all input validation, conflict key, tenant filter, timestamp, mutable fields and response. Bulk-only focused tests passed, but Browser still returned `503 CARE_WRITE_UNAVAILABLE`; those failures remain retained. Exactly three existing permissive Care-record policies were then aligned with the canonical roster already required by the approved Care workflow. Their actor/tenant/day gate uses CASE. This intentionally tightens direct access to the existing workflow contract; it is not predicate equivalence. Grants, restrictive policies, helpers, function security modes and timeouts did not change in that policy repair.

After reconciliation, the focused full-payload Care RPCs completed in684ms/880ms. In the final full epoch, the two-record positive RPC completed in597ms and the forced second-target error returned23514 in1,949ms with identical fingerprints. These are measured request times for synthetic one/two-student fixtures, not a load or full-school performance certification.

Existing anonymous paths and authenticated TRUNCATE were contained only in the approved MVP scope. Fifteen named anonymous direct-relation probes were denied. This does not certify every view/RPC or replace the earlier separate32-relation Production snapshot.

## Independent verification and recovery

The separate process `node .audit-local-cache/preschool-release-integration-20261023/e2e-final-verification.cjs final` exited0 at01:18:48 UTC. It verified the actual completed production-mode E2E receipt/build binding, all3,324 source hashes, full current MVP/Timeline catalog and unchanged dependency definitions.

It checked all13 run manifests, including failed/interrupted attempts: all26 exact owned tenant IDs have zero remaining rows across the18 inspected owned-table selectors; all65 synthetic Auth subjects independently return404; zero owned fault-probe constraints remain. These are cumulative disposed identities across sequential runs, not simultaneous fixture authority. Existing business-row contents were not read or copied. No external replay/worker evidence was deleted. DDL recovery and fixture disposal are not Production backup/restore proof.

Independent verified catalog SHA256: `d99a60ff8944304b0b47d3b0bd81398c5e081ae69e136256fcd59dfef1e77634`.

Machine evidence is retained in the ignored `.audit-local-cache/preschool-release-integration-20261023/`; preserve this directory with the source candidate:

- `E2E_ACCEPTANCE_3dc2a571-5216-481b-b206-c6ca4119613d_RESULT.json`, `E2E_BROWSER_3dc2a571-5216-481b-b206-c6ca4119613d.log` and final command logs.
- `E2E_FINAL_VERIFICATION_RESULT.json`, `E2E_FINAL_VERIFIED_CATALOG.json` and `E2E_FINAL_HARNESS_REVIEW.json`.
- Each stage's exact reviewed hashes, native rehearsal/apply receipts, baseline/retained catalogs and recovery SQL.
- `E2E_EXECUTION_PROVENANCE_INVENTORY.json`, original failed/interrupted receipts and later exact disposal receipts. A later PASS does not rewrite an earlier FAIL.

## Remaining release boundary

| Status | Result |
| --- | --- |
| E2E MVP runtime | PASS_BOUNDED_E2E |
| E2E anonymous containment | PASS_BOUNDED_15_NAMED_DIRECT_RELATIONS |
| E2E authenticated regression | PASS_BOUNDED_TESTED_MVP_AND_NAMED_OTHER_CONSUMER_CASES |
| Source integrity / scoped DDL recovery / fixture disposal | PASS |
| Final independent acceptance review | PASS_BOUNDED_ACCEPTANCE_REVIEW |
| PRODUCTION_CHANGE, this batch | NOT_RUN |
| Production authenticated access regression | NOT_PROVEN |
| New Production-wide anonymous verification | NOT_PROVEN; earlier32-relation snapshot remains separately bounded |
| BATCH2B_RBAC_RLS | IN_PROGRESS |
| Education/Healthcare aggregate / full Kernel reseal | Existing FAIL/HELD retained; not rerun or relabelled by this batch |
| T2 / grading/transcript / wider Healthcare | Existing release-specific disposition retained; not certified |
| PRESCHOOL_GO_LIVE | NOT_READY |
| Commit / push / merge / deploy | NOT_RUN |

The next sensitive boundary is the Production rollout in release-plan section5: fresh exact target/catalog/source reconciliation and a target-specific SQL package; verified backup/restore and compatible rollback; Owner-confirmed real Course–branch mapping and operating identities; approved publication/traffic change; then deployed Auth/Browser/readback and monitoring. The reviewed E2E SQL is not a Production migration. Do not deploy the entire dirty branch or include Auto/Lab/T2. No further MVP redesign, broad aggregate rerun or permission expansion is authorized by this report.
