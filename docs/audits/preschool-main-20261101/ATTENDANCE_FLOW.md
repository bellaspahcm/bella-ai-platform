# Preschool attendance — flow verification

Scope: teacher attendance, existing UI/API/Product/public-contract/DB/read-back chain. Base `f1299e3138f3700062a1ed84271db315737b0071` plus recorded technical changes. Keep UI, business rules, roles/assignments, contracts, source schemas and all prior sealed remediation unchanged. Existing `preschool-browser-profile` is reused, not a new test framework. No Production write, business RPC, child-row read or migration. Production access is catalog metadata only against explicit ref `lvnvkpyxtuilhrabtlwv`.

Acceptance: real test Auth JWT; assigned class/child only; save attendance with canonical IDs, day/status/actor; independent DB read-back and page reload; cross-branch/tenant denial; errors cannot become success; existing duplicate/concurrency rules and architecture boundary retained. Test-only synthetic data is allowed only in the owned disposable loopback profile, never a remote project. A disposable schema PASS, JWT/Browser PASS and Production parity are separate claims.

Source chain: Attendance page → `/api/education/attendance/courses` and `/api/education/attendance` → `PreschoolTeacherAttendanceService` → Party Auth Link / Preschool Teacher / Attendance public contracts → roster/teacher authorization helpers and daily attendance command → `edu_attendance_daily_state` / attendance events → GET reload. Admin attendance has a distinct trusted scoped-command path and must not be used to bypass the teacher path.

| User action | Current source boundary | Intended persistence/read-back | Current evidence |
| --- | --- | --- | --- |
| Load assigned class | `page.tsx` / `AttendancePageContent` → `GET /attendance/courses` → `PreschoolTeacherAttendanceService.listCourses` → `preschool_teacher_attendance_courses` | Teacher-scoped course list | Production signature absent; `BLOCKED` |
| Load roster / reload | UI → `GET /attendance` → `AttendanceContractImpl.getCourseDailyAttendance` → `edu_preschool_roster_identity` | Roster plus daily-state projection | Production RPC restricts Preschool role to `admin`; teacher parity `FAIL` |
| Save attendance | UI → `POST /attendance` → teacher service → `AttendanceContractImpl.setDailyAttendance` → `edu_set_daily_attendance` | Event plus daily-state upsert, then GET reload | Legacy writer DB boundary `P1_BLOCKED` |
| Admin save | UI/API → `PreschoolAttendanceCommandService` → scoped command RPCs | Scoped writer then shared event/state write | Catalog definition reviewed; actual service env and execution `NOT_PROVEN` |

Verification plan: compare current Production columns, constraints, function definitions/signatures/ACL, effective grants and RLS with the existing isolated profile; exercise its GoTrue/PostgREST/JWT/Browser stage only after schema acceptance and owner/loopback markers pass. Do not silently fill Production gaps or call a source-migration ledger proof of installed schema. Gate 1–4 and 11 apply; no source/schema mutation is proposed, so migration-change/event/grading/export gates are not new implementation work. Real persistence/event/failure assertions remain acceptance criteria, not waived by this applicability note.

Initial environment observations: no local application listener at 3000–3010, no local `.env` file, Docker daemon unavailable. Existing Docker Desktop was asked to start hidden. The installed official Supabase CLI 2.115.0 initially failed writing its telemetry outside the workspace; an escalated `db query --help` succeeded. No update/install/global config or credential change was performed. The existing profile overlays tracked runtime deltas with hashes in a temporary application fixture, rejects untracked runtime additions, targets only loopback and owns its cleanup.

## Current Production catalog finding — BLOCKED

The current metadata-only capture against the explicitly selected target
`lvnvkpyxtuilhrabtlwv` was taken at `2026-11-01T13:38:33.336041+07:00` in a
`READ ONLY` transaction. It confirms that both teacher-scope RPC signatures
are absent:

- `public.preschool_teacher_attendance_courses(date,uuid)`
- `public.preschool_teacher_can_attend_course(uuid,uuid,date,uuid)`

This is now a current interface-parity failure, not merely the historical
warning above. The current `admin_staff` path calls the first function through
`PreschoolTeacherContractImpl.listMyAttendanceCourses` before it can write.
Therefore the teacher flow cannot be called **PROVEN** on the Production
catalog; its actual HTTP/JWT error is still not exercised.

There is a second independent parity failure on the teacher read/read-back
path. The installed `edu_preschool_roster_identity(uuid,date)` and
`edu_attendance_can_read_course(uuid,uuid)` explicitly allow only the
Preschool `admin` role. The current source calls the roster RPC with the
teacher's authenticated client after resolving a teacher course. The local
teacher-integration migration contains a newer roster definition that admits
`admin_staff` only after the teacher assignment check, but that is a local
candidate, not proof of installation. Thus the existing Production catalog
does not establish an authorized teacher roster/read-back path even apart from
the two absent helper functions.

The same capture also establishes a separate P1 database-boundary finding:

- the currently installed `public.edu_set_daily_attendance(uuid,uuid,text,timestamptz,date)` is `SECURITY DEFINER`, owned by `postgres`, and grants
  `EXECUTE` to `authenticated`;
- the function body validates only input/status/date and that the passed
  enrollment belongs to the passed tenant. It has no `auth.uid()`, current
  role, branch, teacher-assignment, or caller-authorization check;
- the catalog records `postgres` as a `BYPASSRLS` owner, `FORCE RLS = false`
  for the attendance relations, and no trigger/rule on the three inspected
  attendance/enrollment relations that would add such an actor check.

The teacher service reaches that legacy writer through
`AttendanceContractImpl.setDailyAttendance`. This disproves the source
comment that its installed writer "rechecks live authority" for the captured
database revision. It is configuration/source evidence of a missing
DB-enforced caller boundary, **not** evidence that an account invoked the RPC,
that data was disclosed/modified, or that PostgREST accepted a particular
live request. No Production business RPC or data row was read or written for this audit.

The admin path is distinct. Its scoped RPCs are installed as
`service_role`-only and contain branch, canonical-ID and active-actor checks
before delegating to the legacy writer. The API attempts to create a service
client only when the admin environment variables are available, otherwise it
falls back to the caller client. The actual deployed environment values and
an end-to-end admin result remain `NOT_PROVEN` and were not inspected.

### Evidence state

| Check | Result | Boundary |
| --- | --- | --- |
| Source/mocked regression | `LOCAL_PASS` — 7 suites / 110 tests | Mocked/static; not DB/RLS proof |
| Attendance UI regression | `LOCAL_PASS` — 2 suites / 50 tests | Mocked fetch/UI; not Browser/Auth proof |
| Current Production catalog interface | `FAIL` — teacher scope RPCs absent | Metadata only; no request executed |
| Current Production writer authorization | `P1_BLOCKED` — legacy writer lacks actor/scope checks | Function/ACL/RLS metadata only |
| Isolated schema/ACL/RLS acceptance | `PASS` | Pinned profile migration closure; synthetic-only |
| Isolated JWT/DB checks | `PASS` — 23 checks | Attempt 3; real local GoTrue/PostgREST callers |
| Isolated Browser/save/read-back/reload | `PASS` — 11 checks | Attempt 3; same owned loopback stack |
| Production JWT/Browser/RPC behavior | `NOT_PROVEN` | No Production business request |

The three independent catalog captures were taken at different times. A final
coherent repeatable-read seal query was prepared but not executed after the
automatic approval reviewer reached its quota; this does not weaken the
per-query evidence above and must not be bypassed.

### Minimal safe next action

Do not revoke `authenticated` from the legacy writer by itself: the current
teacher path still depends on it. Do not apply the local hardening migration
to Production from this audit. An owner-authorized remediation must first
choose the canonical teacher write boundary, then rehearse the installed
function/RPC set with real test JWTs in an isolated environment, including
assigned and unassigned teacher, cross-branch/tenant, save/read-back,
revocation-after-wait and rollback cases. Only after that can a narrowly
scoped DB/application cutover be proposed. UI and stated Preschool business
rules are unchanged by this audit.

## Isolated acceptance follow-up — 2026-11-01

Docker Desktop reports Engine running and the CLI outside the workspace sandbox
confirms server `29.7.2`. The sandbox pipe permission error is not evidence that
the engine is stopped. The existing profile prepared owned project
`bella-preschool-13ebfcd8` on loopback ports `33524/33525` from the recorded base
and pinned migration closure. Schema/ACL/RLS acceptance passed.

Attempt 1 has 20 real JWT/DB assertions PASS and 7 Browser assertions PASS.
Browser acceptance is FAIL: it timed out before clicking an attendance action
because the harness selected `Có mặt — Synthetic Child A`. The current default
page renders `AttendancePageContent` with a row-local `Có Mặt` button; the
imported `PreschoolAttendance` component is not rendered by that default export.
The success message and reload badge also differ between these components.
The failed receipt and logs are retained as `attendance-attempt1-*`.
The owned stack and temporary application worktree were removed by the runner.

Change map for the follow-up is test-only: current attendance route UI →
`teacher-attendance.e2e.mjs` caller → row-scoped exact `Có Mặt` button, current
success status and current reload badge. Authority is the continuing isolated
verification task; canonical API/RPC, schema, assignments and Product source
are unchanged. Failure classification is `CONTRACT_DRIFT` in the test's UI
expectations. Retain save, independent DB read-back, reload and denial
assertions; rerun the existing disposable profile after `node --check` and diff
review. No new migration or runtime implementation is included.

Attempt 2 (`bella-preschool-513f4ec6`) completed with schema PASS, 20 JWT/DB
checks PASS and 10 Browser checks PASS, including save/independent DB read-back,
reload and later identity-link revocation denial. Its stack and temporary app
worktree were removed; evidence is retained as `attendance-attempt2-*`.

The existing harness is extended for the owner's remaining cases with three
bounded synthetic-only probes: a DB input exception must leave event/state
unchanged; two concurrent real-JWT writes must retain both events and one daily
state; terminating only the fixture's exact assignment through the public
command must deny that same teacher's same-branch DB/API access with no
attendance writes. A new public-command assignment restores course eligibility
for the separate identity-revocation case; the terminated row stays immutable.
This does not create schema, RPCs,
roles or grants. The input-error probe does not prove rollback after an error
in the middle of a successful write, nor does the concurrency probe prescribe
which of the two committed statuses wins. These limits remain explicit.

### Final isolated evidence

Attempt 3 (`bella-preschool-6fc50866`, source base `f1299e3`) finished at
`2026-11-01T07:47:12.159Z`: schema PASS, JWT/DB 23 PASS, Browser 11 PASS,
error `null`, `DISPOSABLE_STACK_CLEANED` and `TEMP_APP_WORKTREE_REMOVED`.
Its 7-file application overlay is recorded in the receipt. The overlay
includes earlier authorized local remediation; attendance UI/API/contract
source itself was unchanged. The full run used harness SHA256
`ec6922f1b48ec1a3dc11308cb98014a7073974558410454e350fd50c5b1745c5`.

After that run, only receipt bookkeeping changed: keep the JWT group pending
until all required probes finish and mark unfinished JWT checks FAIL if the
flow throws earlier. The final harness SHA256 is
`7e29b454aa0aa87ebe47788bc81840eb4343a4937a2466229475c9dd7a4b8bd0`.
Five failure scenarios executed the actual current catch code in an isolated
JS context and passed; the first JWT PASS assignment is also asserted to occur
after the extended probes. The full success-path DB/Browser receipt is reused
only for unchanged assertions. This classifier check is not a fresh DB run.
Independent narrow source review reports no remaining introduced issue.

Evidence:

- `attendance-attempt1-*`: original selector failure, not overwritten.
- `attendance-attempt2-*`: 20 JWT/DB + 10 Browser checks PASS after selector fix.
- `attendance-attempt3-*`: 23 JWT/DB + 11 Browser checks PASS after coverage extension.
- `attendance-profile-production-parity.json`: direct read-only profile/catalog
  comparison; profile helpers exist, installed writer/roster definitions differ.
- `attendance-receipt-classifier-regression.json`: final receipt error-path check.

Remaining limits: no injected error after the event insert, no forced lock
contention or assignment revocation while a write is already waiting, no
Production caller/write test, no admin-flow acceptance, and no whole migration
history replay. The input exception rejects before persistence; concurrent RPCs
were dispatched together but their exact lock overlap was not forced. Actor
identity was verified at Auth/Party/assignment boundaries, not as an actor
column read-back from an attendance event. None of those limits is PASS.

### Proposed smallest DB remediation — not applied

The passing profile supports retaining the current public writer signature
and existing application path. No replacement UI, role or assignment model
is needed. A separately authorized DB change can be bounded as follows:

| Boundary | Existing source to reuse | Required review |
| --- | --- | --- |
| Teacher course scope | The two teacher helper definitions in `20261026183000_integrate_preschool_teacher_attendance.sql` | Caller-bound Party identity, active confirmation/assignment and branch intersection; exact EXECUTE ACL |
| Enrollment authority | `edu_can_access_attendance_enrollment` from the same teacher integration source | Preserve other Education product behavior and trusted scoped-command caller semantics |
| Teacher roster/read-back | `edu_preschool_roster_identity` from the same source; two state policies from `20261027010300_scope_attendance_state_with_authorized_helper.sql` | Resource-scoped reads through helper; no new direct tenant-table grant |
| Shared writer | `edu_set_daily_attendance` from `20261026152000_harden_education_attendance_access.sql` | Input/day checks, live authorization before/after waits and atomic event/state write; compatible DTO/signature |

This is a proposal to review 2 missing functions, 3 existing function
definitions and 2 state policies with exact privileges and prerequisite
checks. It is not permission to apply the profile's 44 migrations, change
other admin/general course-read helpers, open grants, or deploy Production.
Installed dependency definitions/constraints and the protected Education
change authority still need their scoped review before a concrete release.
Teacher attendance on Production remains BLOCKED; Preschool remains NOT_READY.
