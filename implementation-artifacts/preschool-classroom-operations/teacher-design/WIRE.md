# Exact teacher command wiring proposal

Status: local design and SQL only; no runtime implementation/application proof. All RPCs below return `jsonb`, are `VOLATILE SECURITY DEFINER`, fixed empty search path, service-only EXECUTE and perform live admin/tenant/Product/explicit-branch checks. API authenticates its human caller first; actor and tenant come from that trusted context. No caller role is accepted as authority.

| Existing-contract method to add | RPC | Additional parameters after `p_tenant_id`, `p_actor_id`, `p_branch_id` |
| --- | --- | --- |
| `listPreschoolTeacherCandidates` | `preschool_teacher_candidates` | `p_query text`, `p_confirmed_only boolean`, `p_on_date date`, `p_offset integer=0`, `p_limit integer=20` |
| `confirmPreschoolTeacher` | `preschool_confirm_teacher` | `p_operation_key uuid`, `p_teacher_party_id uuid`, `p_valid_from date`, `p_valid_to date|null`, `p_attestation text` |
| `revokePreschoolTeacherConfirmation` | `preschool_revoke_teacher_confirmation` | `p_confirmation_id uuid`, `p_reason text` |
| `assignCanonicalCourseTeacher` | `edu_assign_preschool_teacher` | `p_operation_key uuid`, `p_course_id uuid`, `p_confirmation_id uuid`, `p_teacher_party_id uuid`, `p_role text`, `p_academic_year text`, `p_effective_start_date date`, `p_effective_end_date date|null` |
| `getCanonicalCourseTeachers` | `edu_get_preschool_course_teachers` | `p_course_id uuid`, `p_on_date date`, `p_offset integer=0`, `p_limit integer=20` |
| `terminateCanonicalCourseTeacher` | `edu_terminate_preschool_teacher` | `p_course_id uuid`, `p_assignment_id uuid`, `p_end_date date` |

Every explicit nullable date is sent as `null`; required dates/year have no server default. Reuse one operation UUID per exact confirmation/assignment submit and retry. `p_operation_key` becomes the confirmation or existing aggregate's `assignment_id`, with exact payload/actor binding. The owning Education implementation reuses `TeacherClassroomAssignment.create({id: operationKey,...})` before the SQL adapter; it does not create another entity. SQL validates the same identity, role/date and conflict invariants independently.

## Response contracts

- Confirmation/revocation returns the stored confirmation row: `id`, `tenant_id`, `branch_id`, `teacher_party_id`, `valid_from`, `valid_to`, `attestation`, `confirmed_by`, `confirmed_at`, `revoked_at`, `revoked_by`, `revocation_reason`.
- Assign/terminate returns the existing stored assignment row plus `canonical_course_id` and `canonical_teacher_confirmation_id`. The canonical DTO maps `courseId=canonical_course_id`; the legacy DTO must never map a canonical row. `course_id` is explicitly null for canonical rows.
- Candidate page: `{tenantId,branchId,onDate,confirmedOnly,offset,limit,filteredTotal,nextOffset,parties:[{partyId,displayName,confirmations:[{confirmationId,validFrom,validTo,confirmedBy,confirmedAt}]}]}`. Only nonrevoked confirmations effective at requested date are listed in each person's `confirmations`; an unconfirmed candidate has an empty list. Confirmation at the selected assignment start day is sufficient for discovery, but the assign command checks the complete entered interval. A Party candidate with no confirmation is never labelled an eligible teacher.
- Course-teacher page: `{tenantId,branchId,courseId,onDate,offset,limit,total,nextOffset,assignments:[storedRow+{branchId,teacherName,effectiveOnDate,eligibility}]}`. `eligibility` is `confirmed`, `confirmation_revoked`, `outside_confirmation_dates` or `identity_unavailable`; lifecycle status and `effectiveOnDate` remain independent. Terminated/revoked/future historical rows remain visible. Missing/deleted/nonperson Party or blank display name yields `teacherName=null` and `eligibility='identity_unavailable'`; no default name. Pagination is explicit, stable by assignment UUID, never a silent partial roster.

The owning contract validates typed shape, tenant/branch/class, role/status/date/null semantics and requested page before returning the DTO. The API maps only that DTO; it does not query `teacher_assignments`, Party or confirmations directly. Never use `[]` after RPC/provider/identity errors.

## Errors

Map SQLSTATE `42501` to denied (`403`) with a stable sanitized code; missing Auth is `401` before trusted command creation. Map `22023` to `400`, `23505` to `409`, missing RPC/schema or `55000` to dependency unavailable (`503`). Other DB/timeout/serialization errors remain sanitized dependency errors with retryability recorded; they are not success. An unknown unique-constraint name is still a conflict, never an invented classroom-specific diagnosis. Return `private, no-store` for all user responses.

An exact confirm retry returns current confirmation lifecycle, including revocation. Exact active assignment replay returns the same assignment even if confirmation was subsequently revoked, Party soft-deleted or course archived. Live administrator/Product/explicit-branch and immutable assignment/course/confirmation/Party/branch binding remain required; the existing operation lookup and payload comparison precede creation-only eligibility checks. Retry after termination or payload mismatch conflicts and cannot create a new assignment. Repeat termination/revocation succeeds only when the recorded actor and entered end date/reason match. Wrong-course/branch assignment IDs deny without writes. Revoked/expired/deleted teacher eligibility does not prevent authorized termination of retained assignment history.

The shared draft also adds BEFORE TRUNCATE statement guards because existing Production TRUNCATE privileges bypass row policies and row DELETE triggers. Teacher-table TRUNCATE is rejected while any canonical assignment exists; legacy-only behavior is retained. Confirmation-table TRUNCATE is rejected while any attestation exists. Existing ACL is untouched. These guards protect ordinary granted operations; they do not claim protection against a malicious database owner who can disable/drop triggers or tables.

## Rollout wire prerequisites

1. Verify the actual target metadata and review the hashes. Production must have the original validated `teacher_assignments.course_id -> courses.course_id` FK; E2E's absent table and `courses.id` require the explicit canonical-only profile. No automatic profile choice or FK retargeting.
2. Production currently lacks `platform_assert_active_branch_for_actor`; Lead owns separately approved provisioning of that exact existing helper. `020` fails when it is missing; it does not modify Platform.
3. Apply only the reviewed target profile plus shared draft under separate exact SQL authority. Deploy no canonical teacher writer between profile expansion and completion of shared constraints/guards. If shared application fails, keep UI/writer unavailable and preserve the compatible schema expansion for forward repair.
4. Extend existing legacy queries with `course_id IS NOT NULL`; adjust legacy lead-workload lookup to exclude canonical rows before mapping. The global DB lead index still rejects cross-namespace conflicts. Canonical methods always use `canonical_course_id` and confirmed-teacher branch scope. No legacy success path is silently switched to canonical.
5. Enable source/UI only after applicable scoped unlock/source authority and the relevant DB prerequisites. Obtain independent allowed/denied and persisted read-back proof before claiming the workflow complete. These drafts alone prove no RLS/runtime/Production readiness.

SQL execution/rehearsal and DB syntax validation were not performed by this design agent. The package is intentionally outside `supabase/migrations`.
