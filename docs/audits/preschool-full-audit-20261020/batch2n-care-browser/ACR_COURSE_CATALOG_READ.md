# ACR — Canonical Course catalog read for Preschool Care

ACR ID: ACR-20261021-PRESCHOOL-COURSE-READ. Status: **DRAFT — NOT APPROVED**. Submitted by: implementation agent for Human Architect Review. No frozen implementation or database change is authorized by this draft.

## Summary and root evidence

**ARCHITECTURAL GAP DETECTED.** Care cannot list classes through the current canonical public contract without depending on a conflicting legacy Course model. Actual real-Auth diagnostics in `browser-results-2026-10-21T03-24-49-085Z.json` show canonical `edu_courses` HTTP200 with the fixture course visible; the additional `courses` projection fails HTTP400/42703 and `teacher_assignments` HTTP404/PGRST205. `course-prerequisite-catalog.json` confirms E2E `courses` is Training's `id/module_key/title` table, not the legacy `course_id/course_name/metadata` shape. The teacher table is absent.

`IEducationCourseContract.listCourses()` currently delegates to `CourseService`/`CourseRepository` and reads that incompatible legacy `courses` model; it also turns failed queries into an empty list. Using it would hide this failure. Replaying `20260810231500_create_courses_and_enrollments.sql` is rejected: it starts with DROP CASCADE against shared tables. No historical migration is proposed.

## Business proof and ownership

Owner-approved `docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md` sections2–4 govern actor/tenant/branch and Care access. Education owns Course identity; Platform owns Auth and branch access. Preschool owns its class selector and Care workflow. The proposed capability only reads Course identity; it creates no new role, enrollment or health semantics.

Affected layer: frozen Education public-contract surface, plus a separately reviewed Product consumer. Healthcare, Training catalog, legacy Course contract, teacher assignment and DB schema remain outside the proposal.

## Exact proposal for review

1. Add only `src/platform/education/contracts/canonical-course-catalog.contract.ts` and `canonical-course-catalog.contract.impl.ts`: a typed read-only public contract with caller-supplied authenticated Supabase client, required tenant, and minimal `id/tenantId/courseCode/title/status` DTO sourced from `edu_courses`. No create/update/delete, metadata shadow model, service-role fallback or swallowed lookup errors. Keep the existing legacy contract unchanged.
2. Add Product API `src/app/api/education/care/classes/route.ts` and focused tests. Reuse existing real-Auth/active Preschool context. Intersect active canonical Course IDs with `preschool_chain_course_branch_assignments`, active branch and current actor's `user_org_unit_access`; reject ambiguous bindings/dependency errors. Preserve the existing hold on `admin_staff` mapping; do not enable teacher authorization by inventing a mapping.
3. Change only Care's selector to this endpoint, preserving its existing option shape. Leave `/api/education/courses` and its other consumers held for their own reconciliation.
4. No new relation, column, policy, grant, helper, role membership, data backfill or production operation. The retained exact6 E2E fingerprint remains mandatory before/after. Do not provision `teacher_assignments` just to make this test pass.

## Alternatives and impact

- Altering shared Training `courses` to imitate the legacy Education model would mix ownership and identity. Rejected.
- Removing projection errors from the shared Courses API would hide a broken dependency and change other consumers. Rejected.
- Direct querying `edu_courses` from new Product code would bypass the public-contract rule. Rejected.
- Keeping the existing UI explicit-error state is the current safe behavior while this ACR is held.

Direct consumer: Preschool Care only. Existing `CourseContractImpl`, Training and other Product callers are untouched. Risk: medium, because the new read capability and Product authorization must be reviewed together. No data migration.

## Approval and implementation conditions

**Human Architect decision, ADR, exact artifact unlock and reseal are required before these frozen files are written.** This document is a proposal, not approval. If the repository has no applicable unlock mechanism or the reviewed canonical binding remains uncertain, hold that dependent work and report it; do not weaken guards.

Requested authority: execute this exact additive contract and Product consumer after the owning approval/ADR/unlock sequence. No general Kernel unlock. Scope growth requires another decision.

## Verification and recovery

Exercise real Auth allowed/denied roles, anonymous, active/inactive profile/tenant/branch, foreign/duplicate tenant selectors, missing/ambiguous course binding, cross-tenant and inaccessible branch, empty valid catalog versus failed dependency. Failures return stable503 rather than DB messages; denied access403; anonymous401. No side effects. Real browser selects an actual allowed class, saves non-health Care, independently reads back DB, reloads and proves denied-save editor retention. Validate exact private/no-store on the new endpoint if the independently scoped proxy proposal is extended to cover it by its owner.

Run relevant Education/Healthcare guards and mandated suites; keep unavailable DB conformance explicitly blocked rather than enabling out-of-scope fixtures. Record actual test counts. Recovery is an exact code revert to the visible held/error state; no database recovery or production rollback is involved. Reseal only after applicable gates and owning review pass.

Architecture review: **PENDING**. ADR: **NOT_CREATED**. Unlock: **NOT_RUN**. Implementation: **NOT_STARTED**.
