# Preschool confirmed-teacher design

Date: 2026-10-25. Decision: **DESIGN_READY; SQL_REVIEW_REQUIRED; NOT_APPLIED**.

Human business decision supplied to this bounded design: an administrator confirms that an existing real person is a teacher of the school/branch; reuse the existing Party; enter academic year and effective dates explicitly; an administrator within the granted scope assigns and terminates. This resolves the missing teacher-role producer for this Product workflow without inventing an Auth-to-Party mapping. The previous ACR approves this proposal, not execution of these new SQL files.

## Truth, authority and ownership

| Truth | Authoritative representation | Owner |
| --- | --- | --- |
| Existing real-person identity | Existing `party_parties.id`, tenant, `party_type='person'`, nondeleted identity and current display name | Platform Party |
| Person is a teacher of this Preschool branch for the entered dates | Administrator attestation in `preschool_teacher_branch_confirmations` | Preschool Product |
| Caller is currently allowed to manage that branch | Live Auth/user/tenant plus existing Platform explicit branch assertion | Platform authorization + Preschool action rule |
| Teacher/class binding and lifecycle | Existing `TeacherClassroomAssignment` and `teacher_assignments`, with one explicit course namespace | Education |
| Canonical Preschool class and branch | `edu_courses` and `preschool_chain_course_branch_assignments` | Education course + Preschool branch ownership |

The confirmation relation is evidence of an administrator decision, not another Person/Teacher identity, employment record, qualification certificate, Auth entitlement, Party role, classroom assignment, or permission projection. It stores Party FK and attestation provenance, never a copied name or invented employee/Auth ID. `party_roles`, People Directory and Platform tables receive no writes.

`PartyRegistrationContract` remains the existing neutral identity registration/recovery capability. Its only current method can create an identity; it is **not** a get-by-Party-ID method and does not prove a teaching role (`src/platform/party/registration.contract.ts:1-24`). Existing Party selection/confirmation must not call it to create a duplicate. If a person has not yet been registered, the separate authorized identity workflow may reuse that contract and then select its returned Party ID. This design adds no Platform contract/engine and imports no Healthcare repository.

Evidence: Education Constitution Student context resolves Party to Instructor/Faculty (`docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md:56-59`); ownership/identity boundaries and unresolved mapping are explicit in `docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md:11-25,34,53,76`. The new human decision supplies the Product-local teacher confirmation source, not an operational-login identity.

## Workflow and explicit data

1. Active Preschool `admin`, already authenticated by the API, chooses a branch with explicit Platform access. `tenant_admin` fallback alone is insufficient.
2. Search existing same-tenant nondeleted Party persons by name or inspect an exact Party ID. Return only Party ID/display name for this workflow. Before confirmation, such a candidate is **not** labelled an eligible teacher.
3. Admin checks the real person's record and explicitly confirms the attestation statement. Save Party ID, branch ID, entered valid-from/date and optional valid-to, confirmation note/reference, confirming actor/time and stable request UUID. No default year, dates, degree or employment status.
4. Assignment chooses a nonrevoked confirmation whose date interval covers the entered assignment dates and whose Party/tenant/branch exactly match the canonical class. User enters academic-year label, role and effective-start date; optional end date is explicit `null` when open-ended. No dates are inferred from the academic-year string.
5. Termination binds assignment ID, canonical class ID, branch and tenant; admin explicitly enters end date. Existing `terminated` lifecycle takes effect immediately; dates describe the retained record and do not schedule a new future transition. End cannot precede start. There is no delete/rewrite of the assignment or confirmation history.
6. Revoking a confirmation immediately prevents new assignments based on it. It does not silently terminate/delete existing assignments. Read-back retains such assignments with `eligibility='confirmation_revoked'` rather than showing an empty roster. Admin can explicitly terminate them. Reconfirmation creates a new immutable confirmation; a revoked row cannot be restored.

Academic year is a bounded nonempty label, not a guessed calendar or school-year policy. The existing role set remains `lead_teacher`, `co_teacher`, `assistant`, `substitute`. This proposal preserves the existing active lead-per-class/year and active lead-per-teacher/year conflict behavior; active status reserves the academic-year slot even when dates do not overlap. No new timetabling, qualification, staffing ratio or date-overlap policy is introduced.

## Public contract and source edits proposed after SQL approval

Use the existing Education public contract file, aggregate and owning implementation. Add explicit canonical methods; leave existing legacy method signatures and course namespace intact:

- `listPreschoolTeacherCandidates(context, query, offset, limit)` returns minimal existing Party candidates after admin/branch authorization.
- `confirmPreschoolTeacher(context, operationKey, partyId, validFrom, validTo, attestation)` and `revokePreschoolTeacherConfirmation(context, confirmationId, reason)` manage only the Product attestation relation.
- `assignCanonicalCourseTeacher(context, operationKey, canonicalCourseId, confirmationId, teacherPartyId, role, academicYear, effectiveStartDate, effectiveEndDate)` reuses `TeacherClassroomAssignment.create({id: operationKey,...})` in the owning Education implementation; DB repeats all integrity checks.
- `getCanonicalCourseTeachers(context, canonicalCourseId, onDate)` returns assignment lifecycle plus confirmation validity, current Party name and effective-at-date status. Missing schema/identity is an error, never `[]`.
- `terminateCanonicalCourseTeacher(context, canonicalCourseId, assignmentId, endDate)` requires the same resource binding. Termination remains possible after confirmation revocation.

`context` contains tenant/actor/branch derived or reconciled with the authenticated request; browser fields and operation UUIDs never grant authority. The existing neutral Party registration response can supply a Party ID only in its separately authorized registration workflow.

Proposed owning artifacts: `src/platform/education/contracts/teacher-assignment.contract.ts`, its existing implementation and integrity tests; Product/API request context and `src/app/api/education/courses/[id]/teachers/route.ts`; the existing Preschool class-detail selector. Confirmation is a Preschool workflow exposed through this scoped public boundary; no Product direct table access or import of the Education domain entity is added. The SQL command is the transaction adapter behind the owning public contract, consistent with the approved canonical-course command; this does not introduce another assignment subsystem.

Legacy read compatibility requires `course_id IS NOT NULL` filters and explicit namespace mapping in the existing legacy methods before canonical rows are enabled. In particular, current `getTeacherAssignments()` reads every teacher row and maps `course_id` as string (`teacher-assignment.contract.impl.ts:242-269`); it must not return canonical rows with NULL legacy identity. The legacy workload check must compare the existing row's effective course namespace and exclude itself when idempotent. The DB guard serializes active lead checks across both namespaces.

## Target profiles and exact draft files

Production OpenAPI **does** advertise `teacher_assignments.course_id NOT NULL -> courses.course_id`; the earlier missing-table observation applies to E2E, not Production (`investigations/preschool-classroom-audit-20261025-evidence/production-openapi-readonly.json`). OpenAPI is not proof of actual policy, ACL, constraint validity, indexes or row integrity.

Choose exactly one bootstrap file for the reviewed target, followed by `020-confirmation-and-canonical-assignment.sql` in the same release window:

| File | Target and effect |
| --- | --- |
| `010-existing-legacy-expand.sql` | Existing compatible table/FK. Retains legacy FK, indexes, rows and ACL; adds nullable canonical course FK, relaxes legacy NOT NULL, enforces exactly one namespace. Fails if metadata differs. |
| `011-empty-e2e-bootstrap.sql` | Explicit empty E2E profile only: table absent; legacy `courses.id` exists and `courses.course_id` does not. Creates the same existing assignment aggregate's storage with canonical identity. Adds `CHECK(course_id IS NULL)` so unsupported legacy writes fail. **Does not invent a legacy FK to courses.id.** This profile proves canonical Preschool only; historical legacy test suites cannot be represented as proven here. |
| `020-confirmation-and-canonical-assignment.sql` | Adds Product confirmation relation and canonical proof FK, canonical indexes, immutable integrity guards, internal authorization helpers and scoped service-only commands. No direct caller table grants or Party writes. |

Relaxing legacy `NOT NULL` is an explicit compatible schema expansion, not CREATE-only SQL. It requires review under the approved scoped ACR/ADR. No old migration is edited or applied verbatim; no dynamic FK retargeting, backfill, shadow legacy course or migration-history rewriting occurs.

## Authorization, isolation, transaction and revocation

- New RPCs accept only the trusted service dispatch used after the API authenticates its caller. Each independently checks live Auth/user/tenant/Product and exact `admin` role, plus current explicit branch access via the existing Platform public assertion. Service credentials are not a fallback for caller RLS failures; new functions are a separately approved scoped command capability.
- `search_path=''`, READ COMMITTED only, bounded statement/lock timeouts; full object qualification. New function `EXECUTE` is service-only; helpers are private by ACL. Existing table ACL is retained in Production. New confirmation/E2E table has RLS and zero direct caller ACL.
- A restrictive policy excludes canonical rows from legacy direct Data API policies without reducing access to legacy rows. Existing bypass roles remain privileged; no new table grants are added. Canonical reads/writes use only the scoped commands.
- Actor/profile/tenant/branch, Party, class branch mapping and confirmation are checked after lock waits; row locks preserve relevant identity and resource state. Final authority/confirmation checks occur after the last potentially blocking write. Tests must prove committed revocation during a wait denies/rolls back.
- Confirmation and assignment operations use stable request UUIDs; repeated exact payload returns the same row/current state, payload or actor mismatch conflicts. A terminated assignment key cannot create a replacement assignment.
- Advisory locks serialize identical operation keys. A unique index enforces the existing global teacher/year active-lead rule across both course namespaces; canonical class/duplicate indexes protect concurrent writers. Confirmation rows are locked against revocation while assigning. Existing nonconflicting legacy behavior and FK remain intact. Duplicate historical leads cause preflight failure, never automatic repair. Multiple explicit attestations of the same person/branch remain separate facts; this design invents no overlap policy for them.
- One DB transaction persists each operation. No event contract is invented; any future existing event publication must happen after successful commit. Revoke/terminate preserve previous facts and actors.

The confirmation does **not** map a teacher Party to an Auth account and does not enable teacher-login Care/Attendance privileges. That separate mapping remains unproven and is not needed for admin assignment management.

## Verification and recovery

No SQL was executed during design. Before apply, retain exact target identity and catalog/ACL/policy/index/constraint fingerprints, row counts and backup/recovery receipt. Rehearse the correct target profile on isolated data first; verify Production metadata matches its specific profile before a separate Production decision.

Required controlled checks: permitted admin; all denied roles; inactive/banned/deleted actor; foreign tenant Party/course/branch; unconfirmed Party; expired/future/revoked confirmation; interval mismatch; operation replay/mismatch; concurrent duplicate/lead conflicts including legacy versus canonical; wrong-class termination; revocation committed during waits; constraint/trigger failures roll back all rows; read-back and browser create/select/assign/reload/terminate. Direct anon/authenticated table/API calls must deny canonical access; legacy allowed/denied behavior must remain unchanged. Retain applicable 11 Education gates and real Auth/RLS/DB evidence separately.

Recovery is forward and data-preserving: disable/revoke the new RPC EXECUTE paths and keep read-only UI; retain confirmation and assignment rows, added nullable columns and legacy FK. Do not drop columns/tables, delete history, set legacy NOT NULL while canonical rows exist, or convert canonical rows into legacy identities. Restore full exact previous ACL from the retained fingerprint only under separately approved recovery. E2E-only fixtures are cleaned by exact recorded IDs after evidence, never broad tenant deletion. Any post-write DDL rollback requires a reviewed data-preserving plan.

There is no remaining business-choice question for the basic admin-confirmed model. Exact SQL/application approval and target metadata verification remain required. A request to allow overlapping active lead classes, scheduled lifecycle transitions, teacher-login authorization, automatic termination on confirmation revocation, or identity provisioning would expand this design.

Production metadata read-back obtained by the Lead after this proposal additionally confirms the legacy FK and identifies the existing branch assertion as missing on Production. The shared teacher draft intentionally requires that exact Platform helper and fails preflight when absent. Its separately authorized provisioning is a Lead-owned prerequisite; the teacher package contains no replacement Platform helper or altered access derivation. See `investigations/preschool-classroom-audit-20261025-evidence/production-catalog-metadata-readonly.json` and `WIRE.md`.
