# Fee Program Publish Runtime — Production preflight

Status: **PREFLIGHT PARTIAL; IMPLEMENTATION AND RELEASE NOT PROVEN**

Scope: Product-owned fee type and program publication only. Resolver, enrollment
binding, period snapshots, Finance, F01 and Weekly Menu are outside this change.

## Observed on 2026-11-03

- Supabase project `lvnvkpyxtuilhrabtlwv`, database `postgres`, PostgreSQL 17.6.
- Auth users, `auth.uid()`, `auth.role()`, `public.tenants`, `public.users`, the
  canonical actor profile and tenant presentation functions exist.
- None of the seven candidate Publish Runtime tables or associated candidate
  functions, policies or triggers were found in `public`. There are existing
  Education finance and other product tuition tables; they are not migration
  targets for this scope.
- Production has four tenants with `product_key = 'bella_preschool'` and seven
  active admin/super-admin profiles joined to Auth; these counts are not proof
  that any particular session can use the new capability.
- The owner-provided tenant `ed100000-0000-0000-0000-000000000001` is active and
  is a Bella Preschool tenant. The owner-provided Admin email resolves to a
  non-deleted, unbanned Auth user and one active `admin` profile in that tenant.
  This confirms directory identity only; it does not verify an interactive
  session or permission through the new API/RPC.
- Read-only inspection found three active legacy fee-structure rows for that
  tenant: monthly TUITION entries at 4,500,000 VND and 6,000,000 VND, and a
  1,200,000 VND monthly meal entry. The table has no published Fee Program
  version/provenance contract; these values are evidence of existing records,
  not authorization to copy or publish them. The latest ACTIVE billing period
  ends 2026-10-31 with due date 2026-10-05; no current-period policy was found.
- The owner selected the existing `TUITION-LA` item, 6,000,000 VND/month, for
  the first Fee Program setup. This records the selected intended data; it has
  not been copied, created or published.
- Production has two distinct class-like data models. A read-only query of
  `public.preschool_classrooms` for this tenant returned zero rows, while the
  admission UI source reads active `public.edu_courses`; the UI's eight options
  therefore do not contradict that zero-row result. Those IDs are not proven
  `preschool_classrooms.id` values. See the investigation below before using
  any identifier for exact-class Fee Program mapping.
- The Product Owner approved exact mapping by canonical Admission `course_id`
  (the selected `edu_courses.id` persisted by the Education Enrollment
  contract). A child's age must not override the Admin/parent/school placement.
  The Program Version resolver is not implemented; when added it must return
  exactly one matching published version for the exact tenant/course context.
- GET-only check of the public app returned the sign-in page for
  `/dashboard/education/fee-program` and HTTP 404 for
  `/api/education/fee-program`. Production does not yet contain the authorized
  API/UI change, so no deployed user path can publish and read back a program.
- The migration ledger contains 449 versions. None of the five local Fee Program
  migration versions are recorded. Compared with the current worktree, five
  production versions have no corresponding local filename and 169 local
  versions are absent from the production ledger. No ledger repair or blanket
  migration-up was performed. Catalog presence and ledger history are distinct:
  the tenant presentation function exists although its local version is absent.
- The backups listing did not return a backup and reported PITR disabled. The
  owner explicitly removed backup as a prerequisite. This does not itself
  establish a recovery or forward-fix procedure.

## Investigation — UI shows 8 classes vs `preschool_classrooms` shows 0

Read-only investigation date: 2026-11-03. No Production data or schema was
changed.

### UI source and filters

- The Preschool admission form in
  `src/app/dashboard/education/enrollments/page.tsx:740` calls
  `GET /api/education/courses?admissionBranchId=<selected branch UUID>` after
  the user selects a branch.
- `src/app/api/education/courses/route.ts:181-224` resolves the authenticated
  actor's tenant, requires role `admin`, checks branch access, reads
  `public.edu_courses` filtered by that tenant, reads
  `public.preschool_chain_course_branch_assignments` for that tenant, and
  returns `{ id: course.id, name: course.title }` for active courses with no
  branch mapping or a mapping to the selected branch. The handler sets
  `Cache-Control: private, no-store` via
  `src/app/api/education/courses/request-context.ts:5`.
- That query has no pagination and does not filter a `deleted_at` or archived
  field; its selected row shape includes `status`, and the admission response
  explicitly keeps `status = 'active'`. The eight rows below are active and
  have a mapping to the selected branch.
- The source path is an authenticated database query, not an inline/mock list.
  `scripts/seed-preschool-complete.mjs:70-77` contains the same eight IDs and
  names, and `docs/audits/preschool-full-audit-20261020/registry-production-20261024/REGISTRY_PRODUCTION.sql:17,138`
  expects those IDs and maps them to the branch. These files are provenance
  clues; they do not prove which earlier operation originally created the
  Production `edu_courses` rows. The live read confirms the rows and mappings
  exist now.

### Production target and the eight displayed records

Production read target: Supabase project `lvnvkpyxtuilhrabtlwv`, database
`postgres`; tenant `ed100000-0000-0000-0000-000000000001`; selected branch
`341b519a-6206-4b50-94c5-9fe9ef71a1fc` (`AD-CS01`, Cơ sở chính Ánh Dương).
Each row below was returned from `public.edu_courses` for that tenant with
`status = 'active'` and is mapped to that branch:

This identifies the database read target, not the currently open browser
process. The route selects its Supabase client from server environment
configuration; an authenticated response from the live browser session was not
captured, so that process-to-project binding is not independently proven.

| `edu_courses.id` | Code | UI name |
| --- | --- | --- |
| `ed100000-c001-0000-0000-000000000001` | `MAM-NON-1` | Lớp Mầm non 1 — Họa Mi |
| `ed100000-c002-0000-0000-000000000002` | `MAM-NON-2` | Lớp Mầm non 2 — Sơn Ca |
| `ed100000-c003-0000-0000-000000000003` | `NHA-TRE-1` | Lớp Nhà trẻ 1 — Gấu Misa |
| `ed100000-c004-0000-0000-000000000004` | `NHA-TRE-2` | Lớp Nhà trẻ 2 — Thỏ Trắng |
| `ed100000-c005-0000-0000-000000000005` | `LA-1` | Lớp Lá 1 — Vàng Anh |
| `ed100000-c006-0000-0000-000000000006` | `LA-2` | Lớp Lá 2 — Bồ Câu |
| `ed100000-c007-0000-0000-000000000007` | `CHOI-1` | Lớp Chồi 1 — Sóc Nhí |
| `ed100000-c008-0000-0000-000000000008` | `CHOI-2` | Lớp Chồi 2 — Thỏ Ngọc |

### Reconciliation and mapping conclusion

- The earlier zero was specifically a count of
  `public.preschool_classrooms` rows for this tenant; it was not a count of
  `public.edu_courses`. A read-only Production check found zero
  `preschool_classrooms` rows and zero `preschool_enrollments` rows for the
  tenant. The eight active rows exist in `edu_courses` instead.
- The schema relationships are different: `edu_enrollments.course_id` points
  to `public.edu_courses.id`, while
  `preschool_enrollments.classroom_id` points to
  `public.preschool_classrooms.id`. None of the eight UI IDs is a
  `preschool_classrooms.id` in the observed target.
- Root cause: the preflight compared two different tables/identifier domains;
  the UI's course records are presented as class options, but they are not
  interchangeable with the legacy Preschool classroom foreign key. This is
  not explained by stale API caching or an inline UI mock. The API is
  tenant-scoped and returns no-store responses. The seed and registry package
  explain why the IDs recur in repository artifacts, but their exact original
  Production creation provenance remains unproven.
- Fee Program mapping decision: the Product Owner approved `course_id` as the
  exact class-placement key because the current Admission contract persists
  `edu_enrollments.course_id -> edu_courses.id`. The eight displayed IDs are
  therefore in the correct identifier domain for a future resolver. They must
  never be written into `preschool_enrollments.classroom_id`, which references
  the separate legacy `preschool_classrooms.id` domain. Mapping semantics are
  decided; resolver implementation and runtime verification remain
  NOT_IMPLEMENTED / NOT_VERIFIED, so no enrollment fee is linked yet.

## Proposed bounded change

Prepare one separately versioned, transactional, additive migration for the
seven Product-owned tables and their required constraints, policies, triggers,
functions and narrowly scoped grants. Verify preconditions on the target again
immediately before execution; abort on unexpected existing objects, dependency
or target identity. Do not apply the local standalone candidate blindly or mark
the five original versions as applied. Reconcile how the new migration is
recorded with the actual release mechanism without rewriting historical rows.

After commit, verify catalog and effective privileges, then authenticated and
denied paths, tenant isolation, idempotent publish, immutability and readback.
Production business-flow verification must use an owner-specified real school,
authorized identities and real fee configuration; no sample fee or payment.
Keep `POLICY_PENDING` visible and resolution fail-closed.

The migration can roll back atomically before its transaction commits. After
commit, preserve any published fee data: disable the affected application entry
point or narrowly revoke the new capability if needed, investigate, and apply a
reviewed forward fix. Never drop populated tables or alter unrelated grants as a
cleanup shortcut. Exact commands and release/ledger execution remain to be
verified before use; this paragraph is a recovery approach, not tested recovery.

## Outstanding

- Finalize and independently review the production migration and its release and
  ledger recording path against the observed target; do not run migration-up.
- API/UI source for Fee Type and Fee Program management exists in the current
  worktree, with a sidebar entry restricted to Admin/Super Admin. Its
  authenticated browser flow is not proven and Production still returns 404
  for `/api/education/fee-program`. The focused Jest and
  ESLint commands were attempted; they could not initialize because the
  worktree/shared dependency tree cannot resolve `next` and
  `eslint-config-next`. The standalone Auth/PostgREST SQL E2E remains the
  previously recorded Local/Test PASS; it does not prove API/UI behavior.
- Verify the selected item and create a Program through the deployed API/UI;
  the UI/API is not yet present in Production. Also identify a permitted Staff
  identity for the negative authorization check; none has been supplied.
- Verify production ACL/RLS and behavior after any authorized change. Local tests
  and the existing standalone candidate are not production evidence.
