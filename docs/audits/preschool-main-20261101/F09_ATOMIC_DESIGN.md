# F09 — atomic weekly-menu persistence, design only / HELD

Baseline main `f1299e3138f3700062a1ed84271db315737b0071`, plus the separately sealed F10 row-existence check. No F09 runtime code, SQL migration, grant or DB mutation was produced/applied in this turn. This design is not rollback proof.

## Existing behavior that must remain

Owner is Preschool Nutrition, using `WeeklyMenuService`, `weekly-menu.contract.ts`, `/api/education/nutrition/weekly-menu` and the existing `edu_weekly_menus` / `edu_weekly_menu_days` tables. Source DDL is `20261020110000_p43_preschool_weekly_menu.sql`. The live catalog showed service-role CRUD and no authenticated/anon table/column CRUD on these menu tables; this is metadata, not a caller execution test.

| Input / case | Preservation target |
| --- | --- |
| Explicit nonblank menuId | Update only that ID + tenant; zero row fails through existing F10 failure path, never create a replacement. |
| No ID | Find by tenant/year/week/ageGroup, update if found, otherwise insert. Preserve unique-key conflict failure; do not silently add automatic merge/retry semantics. |
| Header | Same trimmed title, dates, notes-null behavior, academicYear default `2026-2027`, ageGroup default `ALL`; created actor/time only on insert, updated time on save. |
| Status / approval | Keep payload DRAFT/PUBLISHED/ARCHIVED exactly; `approved_by = actorId` only for PUBLISHED, otherwise null. No new approver selection or permission. |
| Supplied days | Upsert by tenant/menu/day; retain existing day IDs, use the same meals payload, summary helper and calorie fallback **680**. Do not substitute the DDL's 650 default. |
| Omitted days | Retain unchanged. No delete/archive/replace operation. |
| Duplicate day input | Preserve current bulk-upsert conflict/failure behavior; do not silently choose the first/last duplicate. |
| API | POST/PUT, validation, role/context checks, success DTO/messages and existing HTTP 400 `{success:false,error}` save-failure envelope stay compatible. GET behavior is unchanged. |

Only the existing API calls `saveWeeklyMenu` outside tests. The current SDK uses separate REST transactions for header and day writes. A comment saying “atomically” is not evidence of atomicity; a successful header can currently survive a failed days upsert.

## Smallest proposed adapter

Reuse the Product service and tables. Replace the internal header/day write sequence with **one database function invocation / one PostgreSQL transaction**. Keep input normalization and `deriveSummaryDishes` in the existing service; pass normalized header and day rows plus the existing actor/tenant context to a typed internal adapter. Do not add a new application service framework, new table, rule engine, role or public HTTP contract.

Inside that invocation: resolve the same explicit-ID/natural-key path, perform the scoped header write with returned-row check, then bulk upsert only the supplied days on the existing unique key. Updating the master row serializes concurrent writes to that same menu until the transaction ends. Keep the current natural-key insert race as a unique-constraint failure rather than inventing a retry policy. Do not add version checks or rejection of valid saves without a separate decision.

Any missing row, DB constraint failure or day-write error must raise and roll back **all** header and day writes. Do not catch and return an error after leaving the header committed; do not split nested HTTP/RPC calls or use compensation as proof of atomicity. If a PL/pgSQL exception block is used to preserve stage-specific errors, it must encompass all writes and re-raise. The service maps failure to its compatible result/error envelope; success is returned only after the function transaction completes. No new event is introduced.

`MENU_NOT_FOUND`, UPDATE/INSERT/DAYS failure prefixes and successful messages must retain their existing consumer-visible meaning. Exact DB error-detail strings are not assumed equivalent: adapter mapping must be checked against the existing API/service regressions before implementation can be sealed. A generated menu UUID from a rolled-back insert must never be treated as a persisted success or reused as such.

## Authority and security boundaries

A new DB function is an additive schema/contract change requiring a separate exact implementation/executor decision. No function name/signature or grants are approved by this design. There is no demonstrated existing atomic weekly-menu command to invoke today; adding a transaction-capable server connection would introduce connection/environment changes and is not the minimal proposal.

Preserve the existing operational-client path without using transaction work to widen caller access. Do not grant authenticated/anon access, add SECURITY DEFINER authority, change RLS, use caller-supplied tenant as authority, or add role/assignment/approval rules under F09. Any eventual function privilege/execute configuration must be explicitly reviewed against the existing service-role-only menu path, including default PUBLIC EXECUTE. Merely adding an RPC must not expose a new browser mutation path. No direct DB implementation or migration is authorized/executed here.

F05 remains an independent authorization hold; F09 cannot certify the current menu API safe or deployable. A local transaction test may use disposable synthetic fixtures, but never the Production project or real children as a rehearsal environment. Deployment and mixed-version rollout compatibility remain separate future release work.

## Required executable proof before PASS

| Check on an independently identified disposable DB | Required observation |
| --- | --- |
| Valid new menu / existing menu | Same header, IDs, supplied-day contents, omitted-day contents, status and approved_by on independent read-back. |
| Day constraint failure after new header insert | No persisted header and no days; verify using a new transaction/client. |
| Day failure after existing header update | Header and every prior day byte/semantically unchanged; inject failure after at least one eligible day write. |
| Multiple supplied days, later failure | No earlier day write survives; no catch-and-success result. |
| Duplicate day / natural-key race / missing explicit ID | Compatible failure, no partial writes, no invented deduplication or upsert fallback. |
| Concurrent same-menu saves | Each committed result corresponds to one complete serialized header/day command; no partial request combination. Test disjoint supplied days with omitted-day retention too. |
| Tenant mismatch / failed DB call / malformed result | Existing HTTP failure envelope, no false success; verify scoped selectors and no new execute privilege. This does not replace F05 role/assignment proof. |
| Consumer regression | Current valid success messages and response fields remain; no UI diff, no status/permission changes. |

No adapter or DB rollback test was executed. **F09 remains HELD; atomicity, Real DB and deployment are NOT_PROVEN.**
