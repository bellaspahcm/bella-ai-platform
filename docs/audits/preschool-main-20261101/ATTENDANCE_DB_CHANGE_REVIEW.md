# Attendance DB candidate — v2 rehearsed, Production not applied

Current status: `SCOPED_REHEARSAL_PASS — READY_FOR_CUTOVER_REVIEW`.
V2 completed 29 checks. This is a release-review input, not Production apply
authority or a Go-Live result. V1 evidence below remains retained.

Goal: repair the teacher attendance DB boundary using the existing source/profile,
with the current writer signature, API, UI, role vocabulary, assignment lifecycle
and statuses unchanged. Direct single-agent preparation uses the existing task
authority. This is a review artifact outside migration discovery. Schema/ACL
mutation and synthetic writes occurred only in owned disposable loopback DBs;
no commit, push, release or Production business request was executed.

## Evidence and exact scope

The live metadata checkpoint is `2026-11-01T16:15:25.805582+07:00`, explicit
Supabase ref `lvnvkpyxtuilhrabtlwv`, executor `postgres`, `repeatable read`,
`transaction_read_only=on`. The three existing function fingerprints match the
earlier capture; both teacher helper signatures remain absent. Evidence is
`attendance-db-dependencies-live.json`, collected by the accompanying read-only
SQL. It contains only definitions/catalog/ACL/schema metadata, not business rows.

| Candidate operation | Source / reason |
| --- | --- |
| Create 2 teacher functions | Exact definitions from `20261026183000_integrate_preschool_teacher_attendance.sql` |
| Replace enrollment authority and roster identity | Exact definitions from the same source; include caller Party, active assignment/confirmation and canonical enrollment/branch intersection |
| Replace shared daily writer | Base from `20261026152000_harden_education_attendance_access.sql`; v2 limits its READ COMMITTED requirement to Preschool, preserving tested non-Preschool REPEATABLE READ writes; unchanged signature/DTO |
| Alter 2 state SELECT predicates | Retain helper-bound restrictive scope; v2 limits the new permissive path to Preschool through the existing caller-bound tenant presentation contract; no tenant-table grant expansion |
| Revoke event-table direct DML | Current catalog grants anon/authenticated INSERT/UPDATE/DELETE on `edu_attendance`. Containment reuses the narrow revoke from the existing hardening source; no SELECT or service-role grant change |

The candidate is `ATTENDANCE_DB_CANDIDATE.sql`; it ends in `ROLLBACK`. It is
not registered in `supabase/migrations` and does not replay the 44 profile
migrations on Production. It has been rehearsed only on owned loopback DBs.
Four function definitions remain exact source reuse; the writer has the bounded
isolation delta above. Source/final definition fingerprints are in the manifest.

## Dependency and ACL review

The actual dependencies include Party Auth Link resolution, Auth identity
status, teacher confirmation/assignment, course/enrollment branch mappings,
Student/Party roster identity, active branch/access projection, event/state
tables and their canonical IDs. The catalog contains all 73 public column/type
requirements selected for the candidate, the canonical assignment FK columns,
and the daily `(tenant_id,enrollment_id,school_day)` unique constraint. Auth
identity column metadata is an execution precondition, not claimed as newly
queried evidence in this capture.

The candidate rejects changed function body/owner/ACL, pre-existing teacher
helpers, column/type drift, policy drift, disabled attendance RLS, missing daily
key, or newly observed foreign function/policy references. A fresh checkpoint is
still required before rehearsal/cutover. Text scans supplement `pg_depend`
because PL/pgSQL calls in string bodies are not all registered dependencies;
dynamic SQL and external clients are not proven by those scans.

Existing function ACL stays unchanged: enrollment helper and writer execute for
authenticated/service_role; roster for authenticated only. The internal teacher
predicate receives no anon/authenticated/service_role EXECUTE; the self-list RPC
receives authenticated EXECUTE only. Table SELECT and worker DML are checked
against their recorded values. Direct user writes must be absent at both table
and column level after containment; inherited grants cause failure rather than
an automatic role/grant rewrite.

Source snapshots in `preschool-t1-prerequisites.sql` contain Care policies that
use the shared helper. The current live catalog scan finds only the two
attendance-state policies and the known attendance/scoped-command functions.
No live Care authorization expansion is inferred from the snapshot. The package
preflight stops if such foreign policy/function dependencies appear later.

## Other Education impact — initial V1 concerns

This is shared DB code. Source reuse and the Preschool profile PASS do not
establish other Product compatibility:

- English Center POST attendance calls `LearningOperationsService` →
  `AttendanceContractImpl.recordAttendance` → the same writer. The new writer
  adds active caller/tenant authorization, finite timestamp/day consistency,
  and `READ COMMITTED` requirements; errors can therefore differ. The
  non-Preschool helper branch retains its existing same-tenant early return.
- The two proposed helper-only state policies apply to authenticated callers
  of every Education Product. For a non-Preschool user, the new permissive
  predicate can authorize own-tenant SELECT without the legacy
  `app.current_tenant_id` GUC. The old permissive helper policy applies only to
  Preschool. Equality of the non-Preschool result set is therefore not proven.
  Do not describe this change as automatically behavior-preserving.
- The installed service-only scoped commands retain their definitions and
  ACLs, but delegate to the shared writer and inherit its new isolation/input
  requirements. Admin acceptance remains NOT_PROVEN.
- Repository runtime matches for direct `edu_attendance` access are SELECTs
  (contract history and token portal history); no direct event insert/update/
  delete was found in that scan. External, dynamic or older clients remain
  unknown. Closing the event DML grants requires checking those callers.
- Care roster, analytics, Student 360 and portal readers consume attendance
  projections/contracts transitively. This candidate does not change their
  implementations or authorize new Care/Portal operations.

These concerns were reproduced and addressed in the V2 rehearsal below; they
did not authorize role or assignment-rule changes. Release authority remains
separate from the bounded compatibility results.

## Minimum next step before cutover planning

Rehearse this exact package against an isolated schema with the captured prior
definitions/ACLs. The already-hardened profile cannot establish this delta:
candidate preflight deliberately rejects that different starting state. Run only
the affected teacher regression plus other-Education own/cross-tenant reads and
writes (legacy GUC present/absent), nested service-scoped writes and ACL checks.
Verify all-or-nothing package rollback and the expected preflight failures.
No full Preschool/F13 audit or unrelated regression is needed.

Only after that comparison may the policy scope and shared-writer compatibility
be finalized and a separately approved cutover use COMMIT. Do not restore the
known unsafe writer as an automatic post-release rollback; pre-commit failure
rolls back the package, while post-commit incidents require containment or a
reviewed safe roll-forward. Production backup/recovery and execution authority
remain requirements for that later release.

## Rehearsal outcome — 2026-11-01

The existing profile bootstrapped synthetic dependencies, then the rehearsal
restored the captured prior function bodies/ACLs, absence of teacher helpers,
two state-policy expressions, event/state effective grants and tenant SELECT
needed by the original policies. The candidate preflight confirmed the scoped
starting metadata, including all required columns and daily key. This is a
targeted reconstruction of the affected Production-before surfaces, not a full
Production clone. No Production business data was imported.

The fixture setup reuses the source-pinned teacher acceptance setup (hash checked)
and its public identity, teacher-confirmation and assignment commands. English
fixtures were independently created in owned synthetic tenants. GUC probes use
PostgreSQL authenticated sessions with claims from real synthetic GoTrue logins;
they test DB session behavior, not a second JWT-verification layer. Teacher,
English no-GUC and worker writes also use real PostgREST caller/service tokens.

| Evidence | Result |
| --- | --- |
| V1 `f5bdaa32…` PostgreSQL parse/pre/postflight | PASS |
| V1 compatibility | FAIL: no-GUC and foreign-GUC reads expanded; non-Preschool REPEATABLE READ changed to 40001 |
| V2 `af506babfb13da00ae072fcc7802e8c43fa4c0ab1770e73b89d03f2070903922` | 29/29 PASS |
| Teacher assigned/unassigned same branch; other branch/tenant; save and owner/caller read-back | PASS |
| English missing/correct/foreign GUC SELECT result sets and writes, REPEATABLE READ write, real REST write | PASS compared with prior behavior |
| English cross-tenant write | DENIED, 42501 |
| Service-role nested Preschool scoped command; worker DML retained | PASS |
| Authenticated cannot execute trusted command or directly insert event; user table/column DML absent | PASS |
| Default ROLLBACK restores all package metadata | PASS |
| Injected error after all package changes restores function/policy/ACL metadata | PASS |
| Dependency, ACL, column/schema and function drift rejected; drift and candidate both rolled back | PASS |
| Cleanup of the three owned attempt projects | PASS, no containers/volumes remain |

V2 corrects only the observed scope problems. Its permissive policy checks the
current caller's Product using `platform_current_actor_tenant_presentation()`;
non-Preschool callers continue relying on the existing tenant policy for SELECT.
The restrictive enrollment authority still prevents cross-tenant access. The
writer's READ COMMITTED rejection is conditional on Preschool. No role, valid
assignment rule, API, UI or returned DTO was changed to satisfy the tests.

The original candidate and failed receipt are preserved as
`ATTENDANCE_DB_CANDIDATE_V1.sql` and `attendance-db-rehearsal-v1.json`. V2 results
are `attendance-db-rehearsal-v2.json`. One earlier harness attempt stopped before
DB rehearsal on a CRLF/LF hash-comparison bug; the raw fixture hash matched its
seal, the comparison was corrected, and its owned stack was cleaned. It is not
counted as a candidate PASS or a product defect.

The isolated COMMIT check changes only the candidate's final transaction
terminator in memory for that owned DB. The reviewed artifact still ends with
ROLLBACK. Original default-ending and late-fault tests execute that package
first and confirm rollback independently. Its hash is bound to the V2 receipt.

Applicability limits: this rehearsal exercises DB/RPC boundaries, not English
Center UI/service orchestration or Production. Existing Preschool Browser
evidence is reused because application source is unchanged. Admin scoped DB
command passed locally; Admin application/Production remains NOT_PROVEN.
External/dynamic legacy direct event writers remain outside the measured
matrix. No new full Preschool/F13 audit or unrelated regression was run.

Status: `SCOPED_REHEARSAL_PASS`; ready for review of the exact tested candidate,
fresh target preconditions and recovery/release authority. Teacher Production
remains `BLOCKED` until an approved cutover and verification. Preschool Go-Live
remains `NOT_READY`.
