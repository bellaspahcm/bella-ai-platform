# Preschool sidebar visual restoration — 2026-10-25

Result: **DEFER** for full UI and data/API completion; scoped source-level restoration is verified by focused tests, while authenticated browser appearance remains **NOT_PROVEN**. The owner explicitly requires the previous Preschool visual layout without a new design. This does not authorize schema, API, public-contract, RLS, Production DB, or release changes.

## Change Map and source

The source of the prior presentation is the tree before `6fea160b3`, the student 360 layout at `4ee914577`, and surviving components in the current checkout. The local dev listener serves this checkout. The sidebar has eleven routes: overview, child registry, classes, teachers, care, learning, communication, finance, facilities, reports, and shared settings. Source inspection found three routed hold screens: `grades`, `finance`, `facilities`. The child detail route linked from the registry had also lost the older 360 layout.

| Route | Current source | Restoration boundary |
| --- | --- | --- |
| Grades | Original visual component remains but Preschool wrapper holds it | Development-only visual preview, explicitly marked illustrative. No claim of assessment persistence; no Education Kernel change. |
| Finance | Original visual component remains but Preschool wrapper holds it | Restore presentation. Existing `/api/education/finance` remains owner of data/actions and returns `PRESCHOOL_FINANCE_NOT_READY` for Preschool; the UI must show that failure and keep commands disabled. |
| Facilities | Original source was replaced by a hold screen | Restore its header, tabs, KPI cards and section geometry with unavailable values. Do not reintroduce the original browser Supabase client, fixed tenant ID, sample assets, seed action or destructive deletes. |
| Child 360 detail | Current canonical read-only profile uses a newer gradient banner and stacked cards; `4ee914577` had the older white header, quick actions and eight tabs | Restore the old presentation on the current `/api/education/enrollments/[id]` verified response. Keep guardian and Portal contracts, active course selection, stale-response guard and 401/403/404 handling. Keep unsupported edits, health, assessments, private communication and finance unavailable without synthetic values or localStorage. |
| Class 360 detail | Canonical detail response had a newer compact definition list while the legacy path kept the old workspace header and tabs | Restore old white workspace header, KPI positions and tab styling for the canonical response. Continue to show unavailable values for capacity, attendance and staffing; preserve scoped registry pagination and course-specific attendance link. |

Overview, child registry, care, communication and reports retain their earlier structural headings and major layout sections in source. The class catalog uses the existing card geometry with canonical API data; the teacher page was handled in the preceding task. Shared settings was not changed.

## Truth, ownership and contracts

The old Grades roster, assessment, observation, award and KPI data are illustrative only. An approved persisted Preschool assessment read/write contract was not found in this task. Finance data and commands belong to the existing Product API; its Preschool readiness guard is canonical for this scope. Facilities Product data would require authorized tenant/branch scoped service access; the old direct client and demo seeding are not an acceptable source of truth. Presentation slots must not imply that absent evidence is zero or compliant.

## Verification

Verified: TypeScript `npx tsc --noEmit --pretty false` passed; scoped ESLint passed; child and class detail tests 57/57; Finance tests 11/11; held workspace tests 3/3; other focused Finance/Grades/Catalog tests 47/47; Education architecture 4/4. The local 3000 listener resolves to this checkout and unauthenticated HTTP redirects to `/login` with the intended next route. Browser appearance behind login and real persisted Preschool data remain `NOT_PROVEN` until an authenticated browser flow and approved contracts are available. No migration applies.
