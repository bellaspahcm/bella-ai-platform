# Preschool classroom create/open — scoped architecture gate

Date: 2026-10-25

Source: `origin/main` / `6fea160b344a18da369015d38d30fa3699d5c90f`
Decision: **PASS for this approved, bounded implementation**

## Process and Product boundary

This is an existing Education Product vertical feature, not a new Product or Kernel. Factory admission does not route arbitrary Product paths; the owner previously authorized this direct scoped workflow. No Factory run or multi-agent work is claimed.

Product presentation is Preschool classroom catalog/detail. `edu_courses` is the canonical Education course identity. Platform owns authenticated actor, tenant, active user, branch activity, and branch access. Preschool Product owns the course-to-branch mapping and create-operation receipt. The browser never supplies actor or tenant identity.

## Contract dependency map

`Catalog UI → authenticated Education API → Preschool Product service → Education canonical command contract → Course aggregate / Education repository → edu_create_preschool_course RPC → edu_courses + preschool_chain_course_branch_assignments + preschool_course_create_receipts`.

The RPC commits course, branch mapping, and retry receipt atomically. Existing course detail and `edu_preschool_student_registry` public APIs supply the exact selected class and its branch-authorized roster. No Product code reads Kernel tables directly.

## Authority and business semantics

The approved ACR/ADR and subsequent owner approvals authorize the scoped writer, the exact additive SQL, the Platform branch assertion prerequisite, and the two migration-history records. This implementation adds the narrow Product capability `preschool_classroom_create`; runtime authorization remains active Auth user + active Preschool tenant + `admin` role + explicit branch authority, independently rechecked by the RPC. It does not grant access to `super_admin`, `admin_staff`, or other roles through this operation.

The create form accepts only branch, class code, and title. It does not invent capacity, academic year, grade, room, teacher, health, or attendance values. Open-class reads resolve the exact canonical course ID and request roster rows only through the current registry contract. Branch options now come from the existing trusted Platform actor-access contract and retain only active branches with an explicit `belongs_to`, `manages`, or `participates_in` relationship; `tenant_admin` provenance alone is excluded to match the create RPC's authorization rule.

## UI-to-contract reconciliation

At the source baseline, “Mở Lớp Học Mới” was disabled and `POST /api/education/courses` returned 503. “Vào lớp học” was disabled even though canonical course detail and registry reads already existed. The bounded change wires the create form to the approved command and each open link to the selected course ID; filters and reload remain intact. Unsupported Products keep their existing legacy page.

## Migration and verification plan

Migration applicability is **APPLICABLE**. Include the exact approved SQL/checkpoint bytes recorded in `SCOPED_CHANGE_MANIFEST.json`; do not reapply them to E2E or Production from this implementation task. The prerequisite helper is present in `20261023040000_attendance_authorization_wait_repair.sql`. No other schema, RLS, grant, or data change is in scope.

## Executed verification evidence

- Focused Jest suites after the branch-option correction: **6 suites / 141 tests passed**, covering the create API, Product capability, canonical command, catalog/open behavior, exact detail roster, and branch-scope read filtering/denial.
- `npm run typecheck:changed`: **PASS**, TypeScript reported zero diagnostics.
- Targeted ESLint on the changed branch service, its tests, and the courses API: **PASS** (only the repository's `.eslintignore` deprecation warning).
- `git diff --check`: **PASS**.
- Both migration files match the owner-approved SHA-256 values in `SCOPED_CHANGE_MANIFEST.json`. Preserve those exact bytes: the create migration contains old draft-status comments, retained because the approved and previously deployed artifact was hash-specific.
- `npm run education:verify`: **NOT PASS** at `education:conformance` (14 suites: 5 passed, 8 failed, 1 skipped; 143 tests: 83 passed, 47 failed, 13 skipped). Blockers included missing `BELLA_FIXTURE_MANIFEST` / `BELLA_FIXTURE_RECEIPT_DIR`, `COURSE_REAL_LOCAL_CREDENTIALS_REQUIRED`, and `COURSE_REAL_PROVIDER_PUBLIC_KEY_REQUIRED`; DB-backed cases also timed out or failed to fetch. Earlier architecture, customization architecture, and extension architecture subcommands passed (1/4, 1/2, and 1/1 tests). This full gate was not rerun after the final branch-option adjustment.
- Current checkout's exact implementation has **NOT_PROVEN** Real DB/E2E and browser acceptance: no current run exercised the new UI through Auth/API and read the created class back. Prior candidate-worktree E2E evidence is not substituted for this branch's runtime evidence.

Do not create synthetic Production classes. Preserve `NOT_PROVEN` for browser acceptance or any gate without executed evidence; a mock is not database proof. The Education 11-gate matrix remains applicable, with academic safety, temporal provenance, rule governance, and audit-fingerprint gates not applicable to this scoped identity command and the remaining data/runtime gates reported from actual runs.
