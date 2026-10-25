# Preschool teacher workspace — scoped change gate

Date: 2026-10-25

Base: `6fea160b344a18da369015d38d30fa3699d5c90f`
Decision: **PASS for bounded Product/UI and approved Education public-contract wiring; runtime acceptance remains NOT_PROVEN**.

## Process, authority, and source of truth

This is completion of the existing Preschool Product page, requested after the accepted MVP publication replaced its earlier mock-only UI with a held page. Factory admission does not cover arbitrary Product paths; the owner already authorized the direct scoped classroom workflow. The owner approved the admin-confirmed Party/branch teacher model, explicit academic year/effective dates, and the exact target-specific Teacher SQL applied and read back on E2E and Production. This gate does not authorize another migration, new ACL, Production test data, release, or legacy course identity rewrite.

The authoritative person is an existing same-tenant `party_parties` person. Preschool owns the branch confirmation. Education owns `teacher_assignments` and canonical `edu_courses`; Preschool owns the canonical course-to-branch map. Platform owns live actor/tenant and explicit active-branch authority. No Auth-to-Party inference, qualification, workload, staff login, or sample teacher is introduced.

## Change map and UI reconciliation

Classification: **data-bound capability gap**. Current `/dashboard/education/teachers` and direct teacher URL show “Chưa mở trong MVP”; the prior visual source contained a static `TEACHERS_LIST` and in-memory create/assign behavior. The supported new flow is branch selection → confirmed teacher list/search → inspect existing Party → explicit confirmation → assign to a mapped canonical class → fresh read → terminate/revoke with retained history. Unknown profile attributes and incomplete assignment data remain unavailable.

`Teacher UI → authenticated Preschool API → Product capability/service → Education public teacher contract → six deployed service-only RPCs → Party read + Product confirmation + Education assignment`. The API derives actor/tenant from live Auth/profile and accepts an explicit branch only as a resource selector; every RPC independently verifies active admin, Preschool tenant, explicit branch and exact canonical course mapping. Legacy teacher methods retain their separate course namespace.

## Migration applicability and verification

No new migration is applicable to this source wiring. The approved E2E `011` / Production `010` profile plus shared `020` were applied manually, independently read back and retained outside `supabase/migrations` because their pre-change targets differ. The no-op checkpoint records that manual event; it is not clean-database provisioning. This code must fail closed when those RPCs are absent.

Verify identity/branch/role denials, exact output shape, input validation, idempotent retry, conflict and error mapping, list/detail reload, and legacy namespace isolation. Run focused tests, typecheck, lint and Education architecture; report the remaining Education 11-gate, real Auth/DB, browser and Production acceptance evidence separately. No fake success or inferred personnel facts count as proof.

## Current source and runtime result

The held Teacher route now opens an authenticated, branch-scoped workspace. It reads confirmed Party candidates and mapped canonical classes, supports explicit search before presenting unconfirmed people, and routes confirm/revoke/assign/terminate through the new Preschool API, Product service and Education contract. The direct legacy profile URL redirects to this workspace. The Preschool sidebar no longer labels the route “Chưa mở”. Five reviewed Teacher SQL/design files were copied intact into `teacher-design/` to keep the active checkout self-contained; their SQL hashes match the approved package.

Focused contract tests: 8/8 PASS. Teacher API boundary tests: 6/6 PASS. Teacher UI tests: 3/3 PASS. Held sibling route tests: 2/2 PASS. TypeScript full scope, scoped ESLint, Education architecture 4/4 and `git diff --check` PASS. The running `next dev` listener on port 3000 belongs to this checkout. Authenticated Chrome observation on the live route showed the new heading, branch selector, mapped class options, no “Chưa mở” sidebar badge, zero confirmed teachers, one searched Party candidate, and zero persisted assignments for a selected class. No live teacher write was performed in that browser session.

The combined classroom/teacher regression run completed with **10 suites / 161 tests PASS**. Final full-scope TypeScript, scoped ESLint and `git diff --check` also passed after the last UI edits. Browser control later became disabled in Work settings, after the read-only observations above; no later browser mutation or claim is inferred.

Status: **PARTIAL** for end-to-end Teacher acceptance. Local browser read is proven against the current Production-configured dev process; a live authorized confirmation/assignment/termination via this new UI and fresh Production read-back remain **NOT_PROVEN**. The target-specific manual SQL package does not yet provide clean-database migration provisioning. No Production data, schema, grant, or migration history was changed during this source task.

## Owner UI correction — original presentation restoration

The owner explicitly requested restoration of the original Teacher list and 360-detail visual layout, connection of already-supported actions, and visual preservation of sections that have no API. The source of the original presentation is the parent of commit `6fea160b3` for `teachers/page.tsx` and `teachers/[id]/page.tsx`. That source used `TEACHERS_LIST`, `TEACHER_DETAILS_MAP`, and in-memory mutations; those values prove layout only, not teachers, qualifications, workload, timetable, contact, evaluations, or a save result.

Change Map: `UI_ONLY` for layout restoration; `EXISTING_CAPABILITY_REUSE` for existing candidate/confirmation/course assignment APIs; `SENSITIVE_BUSINESS_CHANGE` for ensuring unverified data and unsupported forms do not claim persisted success. Preserve header, KPI cards, search/filter surface, cards, profile popup and detail tabs. Populate only confirmed Party names and canonical class assignments with their actual lifecycle where available. Existing candidate, confirm, revoke, assign, list and terminate calls remain behind the approved API and RPC boundary. KPI categories, qualifications, contact, certifications, workload, schedule and evaluations have no approved Preschool source; retain their presentation slots with explicit unavailable values and no synthetic success. The previous create-teacher form has no approved identity/profile command in this scoped workflow; retain its visual form but do not perform its former in-memory creation. No migration, ACL, Platform/Kernel contract or Production operation is included.

The owner's latest correction prohibits a redesigned teacher UI. The restored original list and 360 layout are the only routed surfaces. Existing confirmed roster reads and the old class-assignment action connect to the approved API. Confirmation, revocation and termination APIs retain their tested service boundary but are not exposed through new visual controls in this restoration; the original UI did not contain those controls. A branch selector would also change the original layout, so the list renders only when exactly one authorized branch is returned. Multiple authorized branches are reported as unavailable rather than silently picking one or mixing their records.

Verification must cover old-layout structure, no sample people or invented KPI/qualification claims, actual API read and write routing where fields match the public contract, unauthorized/error behavior, stale requests, typecheck, lint and applicable Education architecture. Browser and real persisted writes are distinct acceptance gates.
