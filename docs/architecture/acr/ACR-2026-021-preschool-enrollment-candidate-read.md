# Architecture Change Request — Preschool Enrollment Candidate Read

**ACR ID:** ACR-2026-021
**Date Prepared:** 2026-10-22
**Submitted By:** Bella Preschool workstream
**Status:** `APPROVED — PASS_BOUNDED_SOURCE; integrated acceptance / owning reseal HELD`
**Owner direction:** Owner confirmed Route A is insufficient and explicitly approved Route B and the exact three-artifact Education Kernel unlock in this chat on 2026-10-22.

## Summary

Request a bounded additive read capability on Education's public Student contract so an authenticated Preschool Admin can search eligible existing Students and their current canonical guardians for one authorized active Course. The saved source check found no suitable existing public contract. Human Architect may identify one exact A-path contract in a final, narrow check; if none is identified, review this ACR as the B fallback. This ACR does not approve implementation, change the Education Kernel freeze, or authorize schema, ACL/RLS, or Production changes until Human Architect approval and an explicit unlock are recorded.

## Affected layer

- [ ] E7.1 Domain Kernel
- [ ] E7.2 Operational Kernel
- [ ] E7.3 Rules & Traceability
- [x] Other: Education Kernel public Student contract (frozen after E1; conditional scope only)

## Affected artifacts proposed for review

```text
src/platform/education/contracts/student.contract.ts
src/platform/education/contracts/student.contract.impl.ts
src/platform/education/contracts/__tests__/student-candidate-search.contract.test.ts (new)
```

No other Kernel files are included. If the capability cannot be implemented within these artifacts without widening dependencies or changing semantics, stop and return for a revised ACR. No Product runtime files are covered by this Kernel ACR; the existing owner-approved Product workflow scope remains separate.

## Reason for change

### Business context

Preschool Enrollment v1 has a bounded POST contract, but the Admin cannot complete an Enrollment through the UI because the system lacks an approved read contract to select an eligible Student and canonical guardian.

### Technical context

The existing `IEducationStudentContract` supports registration and lookup by a known Party ID. The saved source check found no suitable existing Product-facing Education contract for bounded candidate enumeration and current guardian relationships. This request prepares the Kernel-owned alternative only; it does not authorize a Product-side direct-table read or an unapproved generic-engine integration.

### Priority

- [x] P1 — Preschool Enrollment workflow remains unavailable through the UI

## Proposed change

Add one read-only, paginated candidate-search operation to the Education public Student contract. The exact method and DTO names remain for Human Architect review; the operation must satisfy the following fixed behavior:

- Receive tenant and branch context only from trusted authenticated server context; never trust a client-selected tenant.
- Require an active Course that has passed the existing server-side branch-access check.
- Return only existing active Student Parties in the authorized tenant that are not already enrolled in the selected Course.
- Return only canonical `guardian_of` relationships effective on the current Vietnam date, with minimal display labels and IDs.
- Bound search input, cursor, and page size; do not expose tenant-wide enumeration.
- Require the Admin to explicitly choose one valid guardian. Do not infer a guardian or create identities.
- Use only a caller-scoped client and existing RLS. A denial, unresolved canonical source, or incomplete relationship result returns unavailable and stops; there is no privileged fallback.

Canonical source mappings for Student active state, Course enrollment exclusion, and guardian relationship validity must be documented in the implementation design before coding. This ACR does not treat field names or current database shape as business authority.

### API impact

- [x] Yes — additive Education public contract operation; existing methods and Enrollment POST v1 remain unchanged.
- [ ] Breaking change
- [ ] Schema or migration change

## Explicit exclusions

- No changes to Education entities, services, repositories, generic Platform engines, Healthcare, or other Products.
- No direct Product table access, unapproved `partyEngine.search` wiring, Healthcare bootstrap, service-role access, or cross-vertical dependency.
- No identity creation, Enrollment writes/updates, or change to Enrollment POST v1.
- No schema, migration, grant, policy, RLS, or Production changes. Migration applicability: `NOT_APPLICABLE`.
- If existing RLS cannot support the read, implementation stops and returns for a separate access decision; this ACR grants no ACL/RLS authority.

## Impact analysis

### Blast radius

- **Direct Kernel consumer:** Bella Preschool Enrollment API, after separate Product integration within its existing owner-approved scope.
- **Other Education consumers:** No behavior change to existing contract methods. The additive method is opt-in.
- **Data:** Read-only; no persisted data changes.
- **Security:** Sensitive Student/guardian identity data. Tenant, Course, and branch boundaries, Admin-only access, current relationship validity, and caller-scoped RLS are mandatory.

### Migration path

No database migration or data backfill is proposed. The additive method must not require new grants or policies. If it does, stop and request separate authority.

### Risk assessment

**Risk level:** `HIGH` until real Auth/RLS and tenant/branch isolation are proven; bounded by read-only behavior, existing RLS, minimal response fields, pagination, and explicit stop conditions.

## Alternatives considered

### A. Existing public Education contract

Preferred if it supplies both eligible Student candidates and current canonical guardians under the required authorization. The saved source check found no suitable contract; Human Architect may still identify one and choose A instead.

### B. Bounded Education public contract extension

Proposed by this ACR, limited to the three artifacts listed above and only after explicit approval and unlock.

### Product direct table query or generic engine fallback

Rejected: these bypass the approved Education public-contract boundary, or depend on wiring not approved for this Product path.

### Do nothing

Enrollment POST remains available at source level, but Admin candidate selection and the Enrollment UI remain blocked.

## Verification plan after approval

- Add focused contract tests for bounded pagination, active Student eligibility, exclusion of an existing Course enrollment, current guardian validity, and safe empty/unavailable outcomes.
- Verify tenant, Course, and branch isolation with authenticated caller context; verify an unauthorized request is denied.
- Verify RLS denial does not trigger a service-role or other-source fallback.
- Run applicable Education contract and architecture gates, preserve all unrelated existing aggregate failures, and report exact outcomes.
- For the integrated Preschool batch, run one Non-Production real-Auth browser journey, independent `edu_enrollments` readback, tenant/branch denial, and same-request-ID idempotency check.
- Do not claim Auth/RLS or Go-Live PASS from unit tests alone.

## Rollback plan

Before Product integration, remove the additive contract method, DTO, and focused tests; no data cleanup is needed. After Product integration, remove the caller first, then remove the contract capability. No database rollback is required. Re-seal the Education Kernel after approved verification. If authorization proves insufficient, stop without widening grants or policies.

## Dependencies and approval gates

1. Human Architect performs one narrow A/B decision: name a qualifying existing contract and owner for A, or approve/reject this bounded B fallback. No general source audit is requested.
2. For route B, record the exact approved artifacts, contract owner, verification requirements, rollback conditions, and explicit Education Kernel unlock.
3. Record the ADR decision and unlock before any Kernel implementation.
4. Keep Product integration, Non-Production acceptance, and Go-Live statuses separate from Kernel ACR approval.

## Architecture review — approved 2026-10-22

**Reviewed by:** Owner, acting as the Human Architect decision authority in the current chat.
**Date:** 2026-10-22
**Decision:** APPROVED Route B; Route A does not meet the requirement.
**Contract owner:** Education OS — Student public contract.
**Approved artifact scope and conditions:** Exactly the three artifacts above. Local implementation, testing and reseal only; no database permission or Production authority. Existing Product GET/UI integration approval remains separate. No global guard, freeze or baseline change.

### Canonical mapping and minimal implementation

- Academic active is `students.academic_status = enrolled`, matching `StudentAggregate.isActive()` and the existing Student public DTO mapping. Duplicate Party-to-Student mappings fail closed.
- `party_parties.id` is canonical identity; `display_name` supplies the minimal label. Student identities are person Parties with `deleted_at IS NULL`, following existing StudentService validation. Guardian identity must be canonical and not deleted; no additional guardian Party-type rule is introduced. No legacy Person ID or contact data is used.
- Any `edu_enrollments` row for the selected Course excludes the Student; v1 does not update existing enrollments.
- `party_relationships` uses guardian→student `guardian_of`, inclusive nullable `active_from`/`active_to` bounds evaluated with shared Vietnam-date utility. Current `parent_of` rows are read only to exclude ambiguous pairs rejected by unchanged POST v1; no parent-only choice is returned. Self-relationships are rejected consistently with `PartyEngine.linkParties`.
- Product authorizes active Course/branch using the existing Attendance request context before calling the contract. The contract independently verifies provider identity, active Admin profile/tenant and active canonical Course through its injected caller client. No default or privileged client is used for candidate reads.
- Literal name search is bounded to 2–80 characters, pages to 1–20 scanned Parties and a UUID keyset cursor. Every dependency read checks complete response counts; errors, ambiguous mappings or incomplete guardian identity reads return unavailable.
- Read-only candidate discovery neither performs academic prerequisite approval nor publishes events; those existing Enrollment POST responsibilities remain unchanged. No migration is applicable.

## Implementation tracking

- ADR: [ADR-026 draft](../adr/ADR-026-preschool-enrollment-candidate-read.md)
- Kernel unlock: `GRANTED_LOCAL_EXACT_THREE_ARTIFACTS`; implementation window now closed. No further Kernel edits under this execution window.
- Implementation: `PASS_BOUNDED_SOURCE`; integrated Auth/RLS/DB/browser acceptance `HELD / NOT_PROVEN`.
- Owning reseal: `HELD`; source hashes are pinned below, but required runtime acceptance has not passed. No global manifest, guard or baseline was changed.
- Production/remote migration: `NOT_AUTHORIZED`

### Local source closeout — 2026-10-22

Source epoch: `54e599048ebc315416e7a82e85f0af33dc25583d` plus the working-tree hashes below. Focused contract/GET/UI tests: 4 suites / 65 tests PASS, exit 0. Education architecture groups: 3 suites / 7 tests PASS, exit 0. TypeScript, scoped ESLint and diff check: exit 0. Three independent read-only review layers completed; wildcard alias and unchanged-POST compatibility findings were fixed and verified. POST v1 body is byte-identical; source recovery roundtrip ran in an isolated directory without rewriting active source.

| Approved Kernel artifact | SHA-256 |
| --- | --- |
| `student.contract.ts` | `7a133954ff57ce412505c7b61fa5c0920d89c713d61d4c58c345882697ce2cd3` |
| `student.contract.impl.ts` | `89019efa232098df4a23de6916c9c0142575d69a648f075443df6df4be5048b2` |
| `__tests__/student-candidate-search.contract.test.ts` | `8ee42ce076d3cf9b00318b155a448a38e0d8579cdc68d1b8419c3e7d1ab50305` |

Runtime stop: the owned R1b local stack/volume was previously disposed; no owned database is currently running. The pinned approved roster SQL grants Party only `tenant_id,id,display_name,gender,dob` and restricts Student/Party visibility to existing enrollments. It does not authorize candidate identity/guardian reads. This is source evidence of a prerequisite gap, not a fresh live `42501` observation. No database/schema/grant/policy changes or new fixture setup were executed. Auth/RLS, browser, persistence and idempotency therefore remain NOT_PROVEN; source is HELD and not release-ready.

### Follow-up execution — 2026-10-23

Owner requested restoration of the approved local baseline, necessary narrow source repairs, and actual acceptance or a concrete access blocker. The exact old baseline was reconstructed, real caller Auth identity/profile/Course/branch verified, and dependency failures confirmed as actual SQLSTATE `42501`/RLS-hidden rows. Restored catalog before/after probes matched `49a9f0aeaac239d41c808309bf71ad45605f64e426c88d9d7e9c623d5ff8561d`. The owned stack/volume/fixtures were disposed and four foreign containers preserved. No new candidate ACL/RLS or mutation authority was applied.

Within the same approved `student.contract.impl.ts` artifact, the explicitly requested Student lookup projection was narrowed to its four DTO fields with existing ordering/semantics. Only that artifact and the already-approved test artifact changed. Final hashes are `c6b7a518efd8a9530b7635f2858ee08edbcfaeae07de252662e9aee84b1ee3f4` (implementation) and `2e006482cefc29ba668df9194b50ad1e586ba1ad3766174de38a93d2bd36eddd` (test). The original contract interface hash is unchanged. Current focused tests: 70/70; architecture: 7/7; type/lint/review/isolated source recovery passed. POST v1 remains byte-identical. The projection revision has no new real-DB proof; full owning reseal remains HELD. See the latest execution in the existing batch3e RESULT.md for exact blocker and evidence references. No further execution or privilege expansion is implied.

## Approved local execution amendment — two capabilities, 2026-10-23

**Status: APPROVED / IMPLEMENTATION_IN_PROGRESS.** Owner explicitly approved this exact amendment on 2026-10-23 in the current chat: “Duyệt đúng amendment local”. Education OS owns both capabilities; the five Kernel paths below are unlocked for this bounded local execution. Route B and the existing candidate public contract remain approved; no A/B decision is pending. This section uses the existing ACR instead of starting another dossier.

### Exact database execution proposal

Add exactly these two local functions; do not modify `edu_enroll_student_v3`:

```sql
public.edu_preschool_enrollment_candidates(
  p_course_id uuid, p_query text, p_limit integer DEFAULT 20,
  p_cursor uuid DEFAULT NULL
) RETURNS jsonb

public.edu_preschool_enroll_student(
  p_course_id uuid, p_student_party_id uuid,
  p_guardian_party_id uuid, p_request_id uuid
) RETURNS jsonb
```

The proposed security model is **two new SECURITY DEFINER functions**, explicitly subject to owner authorization. This is a narrow privileged database capability, not evidence that the old table RLS suddenly permits these reads. Its purpose is to leave existing table/column ACLs and restrictive RLS byte-identical while returning only authorized bounded results. Revoke function execution from PUBLIC/anon, grant EXECUTE only to authenticated, use fixed search_path and fully qualified static SQL, and reject missing caller subject, inactive/non-Admin/non-Preschool profiles and tenant/resource mismatch. No service-role application client, client-selected tenant/actor/role, dynamic SQL, role membership change or broad table grant is included.

- **Candidate read:** derive tenant from persisted caller profile; recheck active Course, exactly one active branch binding and canonical branch access. Keep the existing literal-search, page/cursor limits, DTO and explicit guardian selection. Read full canonical enrollment existence privately (all relevant statuses) and current canonical guardian relationships; return no contact data, hidden enrollment rows or tenant-wide Student list. Policy/rule completeness must not be inferred from a caller-visible row count.
- **Mutation:** derive identity and business time server-side; recheck Course/branch, active Student and selected current canonical guardian inside the transaction. Preserve credit/prerequisite/workflow rules, with complete scoped checks rather than RLS-truncated inputs. Lock Student/Course resources in a consistent order to serialize credit and capacity decisions. Bind Request ID to tenant, Student and Course; reject reuse for a different target. Validate current authorization and guardian even for retry; same valid request returns the same active Enrollment without a second insert, capacity increment or success event. Only `edu_enrollments` and `edu_courses.current_enrollment/updated_at` may be mutated. If canonical policy/eligibility cannot be reproduced securely within this scope, stop that path rather than accepting caller-provided thresholds or inventing a fallback.
- **Direct access:** all existing table/column grants, restrictive policies, default ACLs and memberships stay unchanged. No new direct SELECT/INSERT/UPDATE grant, policy weakening, Student data dump or new business table is authorized by this proposal. Direct writes must remain denied in real Auth tests. The old invoker RPC retains its definition and ACL.

### Exact source scope requested

Five Education Kernel artifacts require an explicit bounded unlock for this amendment:

```text
src/platform/education/contracts/student.contract.impl.ts
src/platform/education/contracts/__tests__/student-candidate-search.contract.test.ts
src/platform/education/contracts/enrollment.contract.ts
src/platform/education/contracts/enrollment.contract.impl.ts
src/platform/education/contracts/__tests__/preschool-enrollment.contract.test.ts (new)
```

Student candidate method/DTO remain unchanged; its adapter calls the new read RPC through the injected caller client. Enrollment gains an additive, explicit Preschool capability accepting Course, Student, guardian and Request ID; existing generic methods/consumers remain unchanged. The new capability owns RPC validation and event-after-persistence, with no false success event on denial or duplicate. Product POST keeps its HTTP request/response contract, but its implementation may delegate to this new public Enrollment capability instead of performing unreadable direct relationship queries. **Byte-identical POST source is not promised for this amendment; HTTP v1 compatibility is mandatory.** No engines, repositories, other Kernel artifacts or Healthcare code are opened.

Approved necessary supporting paths:

```text
src/app/api/education/enrollments/route.ts
src/app/api/education/enrollments/__tests__/route.test.ts
src/types/database.types.ts (only the two new RPC signatures)
src/proxy.ts (only exact /api/education/enrollments private/no-store handling)
src/__tests__/proxy-course-catalog-cache.test.ts (matching Enrollment cases)
docs/audits/preschool-full-audit-20261020/batch3e-enrollment-v1/LOCAL_ENROLLMENT_CAPABILITIES.sql (new, local-only execution/recovery artifact)
```

Current UI, shared auth/branch helpers, existing RPC, global guards/freeze manifests/baselines, schema tables, migrations history and other products remain outside the change scope. Existing ACR/ADR/RESULT may record actual approval, hashes and results. Disposable harness/receipts stay under the existing task-local cache; no new framework or CI workflow is included.

### Execution and acceptance after explicit approval

Reconstruct the same pinned local baseline and synthetic Auth fixtures, bind target/config/source epoch, rehearse exact two-function create/revoke/grant and rollback, then retain local changes only for the authorized acceptance run. Verify full catalog delta is limited to the two new function definitions/ACLs/dependencies and that the old RPC, table ACLs and restrictive policies are identical. Do not deploy a remote migration.

Use real Auth and production-mode browser to select Course → Student → explicit guardian → POST → independent Enrollment/capacity readback. Retry the same Request ID and prove one Enrollment/one capacity increment; reject altered target, foreign tenant/branch/guardian, forbidden role and direct table/RPC bypass. Prove capacity/concurrent-credit bounds and rollback when the second write fails. Keep schema/security and source epochs separate and do not use expected-denial checks as positive business PASS. Regressions are the affected contracts, route, proxy, UI and applicable owning gates; preserve unrelated historical aggregate failures.

Recovery removes only the two new functions and owned local fixtures/stack after fingerprint/source readback; no existing ACL/policy restoration should be necessary because these must never change. Source recovery/review and owning reseal need their actual required evidence. If an additional table, policy, helper, Kernel artifact or business-rule authority is needed, stop at that exact boundary. No Production, remote change, commit, push, merge or deployment is included.

### Owner-approved exact Enrollment bootstrap addition — 2026-10-23

Actual epoch 03 built successfully and passed RPC/Auth checks, but Browser observed `/api/tenant/context` HTTP 500 before the Enrollment form mounted. Owner directly approved exactly three supporting files in chat (“Duyệt đúng 3 file, kiểm chứng Browser và recovery”): `src/components/providers/TenantContextWrapper.tsx`, `src/app/dashboard/layout.tsx`, `src/__tests__/catalog-bootstrap-boundary.test.tsx`. Add only the exact `/dashboard/education/enrollments` route to the existing fresh authenticated identity/presentation path. Operational TenantContext, Enrollment detail/subpaths, auth/branch logic, DB scope and all other boundaries remain unchanged. Real browser/recovery and review remain mandatory; no new Kernel/DB/Production authority.

### Final bounded local closeout — 2026-10-23

`PASS_BOUNDED_LOCAL_ENROLLMENT_TWO_CAPABILITIES`: final epoch04 source/Auth/Browser/DB/readback/retry/denial/concurrency/atomicity and exact recovery PASS. Focused checks 141/10 suites, zero failed/skipped; TypeScript/lint/build/diff native0. Three independent final source review layers have no remaining scoped findings. The five-artifact amendment unlock is CLOSED; source retained uncommitted at the hashes below. Full Education Kernel reseal remains HELD because its wider required gates have not passed; no global guard/manifest/baseline was changed. Prerequisite Courses remain fail-closed, durable Host event delivery remains NOT_PROVEN, and Production/commit/push/merge/deploy NOT_RUN. Exact receipts, old failure provenance, catalog fingerprints and gate limits are in the latest batch3e RESULT.

| Kernel artifact | Final SHA-256 |
| --- | --- |
| `src/platform/education/contracts/student.contract.impl.ts` | `8ff7289a51bf7c08ba70e368591b7f413f23c2139cd5e108f0613195eeac99f8` |
| `src/platform/education/contracts/__tests__/student-candidate-search.contract.test.ts` | `bf2dffdbf63ec386dfdc826014b263d7d8e681e6b7c0bfc5ed838c798909cc4b` |
| `src/platform/education/contracts/enrollment.contract.ts` | `a3a00d390cec54a8088d66d294e98266780a78b3dd35d0700f70f7d95b10223e` |
| `src/platform/education/contracts/enrollment.contract.impl.ts` | `2f6c2aa6dcbc252dec8a82c96410c27557e5cc067328ef1226be22a3c51063f0` |
| `src/platform/education/contracts/__tests__/preschool-enrollment.contract.test.ts` | `6682ca44847a890745d97d189ca6d2c5597670328b177be27ec9a9bd6d835e6f` |
## Approved local roster identity amendment — 2026-10-23

Owner directly approved “Duyệt đúng RPC roster và unlock local” in the current chat against `BROWSER_RELEASE_CONTINUATION_20261023.md`. Education owns the read capability. `ARCHITECTURE_GATE_RESULT=PASS` for implementation authority only; this is not acceptance or reseal.

- One new read-only `edu_preschool_roster_identity(uuid,date)` SECURITY DEFINER, fixed search_path, authenticated EXECUTE only; derive active actor/tenant, validate Preschool admin, Course, explicit branch relationship, Vietnam current day and effective active Enrollment. Return only existing roster identity fields; no contact, health, metadata, tenant-wide list or service-role consumer.
- Exactly one existing Kernel artifact unlocked: `src/platform/education/contracts/attendance.contract.impl.ts`, only the Preschool path of existing `getCourseDailyAttendance` and unchanged DTO/interface. Existing non-Preschool query path stays intact.
- Product supporting runtime: `src/products/bella-education/care-wellbeing/daily-care/daily-care.service.ts` reuses that public Attendance contract. Focused contract/Care tests and scoped local SQL/receipts are authorized supporting paths.
- Student/Party table and column ACLs/policies remain byte/semantically unchanged. Enrollment/daily-state read prerequisites and approved Care nonhealth INVOKER save remain within the existing15-relation section4 scope. No existing Attendance mutation RPC replacement in this amendment.
- Migration applicability: local additive function only; no remote migration/table provisioning. No global guard, freeze manifest or baseline changes. Before hashes are in `.audit-local-cache/preschool-roster-rpc-20261023/source-before.json`.
- Verify contract compatibility, real Auth/Browser/DB, role/tenant/branch/day denials, sensitive direct-read denial, Care second-write rollback, independent review and exact recovery before source retention. Preserve all11 gate applicability: architecture/boundary/security/persistence exercised; unchanged academic governance/audit semantics retain their existing owning gates. T2/full Education/Healthcare/release gates cannot be waived by this bounded acceptance.
- Window OPEN for exact implementation; full reseal remains HELD until required owning gates actually pass. No Production, commit, push, merge or deploy.

### Roster amendment bounded closeout — 2026-10-23

Exact implementation window CLOSED. `PASS_BOUNDED_LOCAL_ROSTER_CARE`: 203 focused tests / 10 suites, ESLint and TypeScript native0; real Auth/Browser/readback/retry/role-tenant-branch-day denial, Care second-write rollback and historical-health preservation PASS. Independent edge finding for NULL-product legacy visibility was fixed and rechecked; final edge/acceptance reviews have no remaining introduced findings. Blind review deployment/current-day concerns remain explicit constraints, not permission for fallback. Browser is development-mode; current epoch proves Attendance read, not its mutation.

Exact DB recovery/reapply and isolated-copy source recovery PASS; Student/Party ACL-policy fingerprint unchanged, synthetic tenant/Auth fixtures zero. Final Attendance SHA-256 `6b87f3da604580d4dcbb060793a8069f0f69008ee4b6c487fcea955c982aef27`; Product Care `4154ed854256df469fe38f9b0a3e62fe79bf30a67cb9b1f467d3ccfa94b4681a`; roster SQL `0932f0814b30411b4e54ce4f00fe96c8ee5647ee381aa1d2a498d6da542cfdb6`. Full results, retained failure provenance, final schema/source hashes and recovery receipts are linked from `docs/audits/preschool-full-audit-20261020/BROWSER_RELEASE_CONTINUATION_20261023.md`.

This closes the one-artifact local implementation unlock, not the full Education Kernel reseal. Mandatory wider gates/T2 remain HELD, without guard, global freeze-manifest or baseline edits. Production/remote migration and commit/push/merge/deploy NOT_RUN.

## Approved shared Attendance adapter amendment — 2026-10-23

Owner directly approved “Duyệt đúng adapter local và atomic history/projection” after the exact proposal in the Browser continuation report. Education owns canonical Attendance. **Implementation authority PASS; exact local window OPEN**, acceptance/reseal pending.

- Unlock only `recordAttendance()` in `src/platform/education/contracts/attendance.contract.impl.ts` and new `src/platform/education/contracts/__tests__/attendance-record-rpc.contract.test.ts`. Before runtime hash `6b87f3da604580d4dcbb060793a8069f0f69008ee4b6c487fcea955c982aef27`.
- Owner confirms this existing method follows section8's atomic append-history + daily-projection rule, including non-Preschool consumers. Use existing `setDailyAttendance()`/RPC, return the persisted history event ID/time in the unchanged `EducationAttendanceDTO`, fail closed on missing/mismatched response, no direct-write fallback. Preserve existing non-Preschool actor/tenant/time semantics; no new role/branch restrictions there.
- Local C only, existing fixture/relation allowlist and approved RPC/history-containment rehearsal. No new RPC, schema, policy, grant expansion, English Product modification, other Kernel change, global manifest/guard/baseline, remote or Git publication.
- Supporting ignored harness may exercise actual caller-authenticated contract calls for Preschool/non-Preschool, two same-day writes, independent event/projection readback, historical non-Preschool time, denials and second-write rollback. Run new contract tests, existing English regression, owning applicable gates, independent review and exact source/DB recovery. Retain only when bounded acceptance/compatibility/review/recovery PASS. If an existing helper cannot preserve authorized semantics, hold that case without expanding scope.
- Migration applicability: NOT_APPLICABLE for source adapter; existing approved local SQL candidates only. All11 owning gates retain applicability; academic governance/audit/T2 and wider aggregate/reseal failures remain explicit, not waived by this amendment. Close only this implementation window with final hashes and actual receipts.

### Shared adapter bounded closeout — 2026-10-23

Exact implementation window **CLOSED / PASS_BOUNDED_LOCAL**. Final runtime SHA-256 `f8554b2ac7d0adf0f013f9ee81b7ac9998ac558fe366c4aa6c6b02c7f97b5cb1`; new test `dc13152d834822bfa7f6bf7b136f3321f44eb826f1d35ee70b2418942dda433a`; unchanged public interface `1411e492095dee5a37f648f16b2484aca78a18eb168d4b0cb144fc3e46a47872`. Three suites/42 tests, ESLint/TypeScript and pinned production build08 native0. Build ID `CMV-pU2X9B6Hm8_gSsdr7`; production-mode Browser NOT_RUN.

Real caller Auth/public contract PASS for Preschool and synthetic English-product admin/staff historical timestamps, two same-day calls, independent persisted event/projection mapping, denial, forced second-write23514 atomic rollback and PostgreSQL legacy/compact/braced UUID forms. Earlier targeted development Browser Attendance/Enrollment epoch remains separately identified. Full English UI/session workflow is not claimed. Final blind/edge/acceptance reviews have no remaining scoped finding. Actual exact catalog recovery/reapply, isolated final-source recovery and fresh post-acceptance fixture/ACL readback PASS; retained local catalog `d21e04139bf3927fb501fb9d25d8a07e`, synthetic tenant/Auth rows and probe constraints0. Shared Student/Party visibility unchanged. History authenticated direct INSERT/UPDATE/DELETE remains revoked in the accepted local candidate, SELECT/service grants preserved.

Source and local SQL retained uncommitted; this closes only the approved adapter amendment. Full Education/Healthcare aggregate, T2 producer and full Kernel reseal stay HELD; Production authenticated regression, remote migration, backup/restore and Go-Live stay unproven. No global guard/manifest/baseline or Production/Git publication changes. Exact logs/hashes/provenance and final source recovery are in the existing Browser continuation report/integration cache.

### Same-scope adapter compatibility repair — 2026-10-23

Full local owning regression now executes with the approved prerequisites and exposed one missed consumer expectation: cross-tenant/missing Enrollment previously throws `Enrollment <id> not found`, while the atomic adapter propagated the RPC's internal sentinel. Reuse the existing explicit `recordAttendance()` plus its test authority for this related compatibility repair; no new business/DB permission or other Kernel path is opened. Exact local method window reopened only to translate that one known sentinel to the unchanged legacy error. All other errors, one-RPC/no-fallback behavior and atomic persistence remain unchanged. Before source/test bytes preserved in the ignored integration cache. Run the unchanged Real DB consumer assertion, adapter negatives, independent review and isolated recovery; broader reseal remains HELD.

Compatibility closeout: exact method window CLOSED. Unchanged Real DB Attendance4/4 and adapter21/21 PASS; final TypeScript/ESLint native0, independent sentinel-only review and isolated recovery/reapply PASS. Runtime SHA256 `7878ba60728d98328673459bb39271a468261318ced37a51377574716b00f776`; test `0be5eeb2e0cfefdedd3662ee76d0da389e446c99d2d557b08f057b03d7e00a7b`. Build08 and earlier Browser receipts belong to earlier hashes; no new build/Browser PASS claimed for this delta. Broader owning reseal and Production remain HELD/NOT_RUN.

## Approved pending-inclusive Student registry amendment — 2026-10-24

Direct Owner approval: “Duyệt đúng gói registry và unlock Non-Production”, against `release-production-20261024/ROSTER_CONNECTION.md`. Education owns this read capability. Exact new artifact window OPEN: `src/platform/education/contracts/preschool-registry.contract.ts`, `src/platform/education/contracts/preschool-registry.contract.impl.ts`, `src/platform/education/contracts/__tests__/preschool-registry.contract.impl.test.ts`. No other existing frozen artifact is unlocked.

Add only the branch-authorized, caller-authenticated active/pending registry and its supporting API/UI/tests, one new read-only RPC and canonical Course-binding prerequisite in the already-owned local sandbox. No privileged application client, direct Product table access, shared ACL/RLS change, new Student/guardian/Enrollment or identity mutation. Synthetic fixtures only. Pin source/schema, verify real allowed/denied Auth/Browser/readback, review and exact recovery before acceptance/reseal. Production and Git publication remain outside this approval. The closed Attendance/Student lifecycle windows stay closed. Exact scope and eleven-gate/release exception applicability are retained in the linked existing work record; no old aggregate FAIL becomes PASS.

Registry closeout: exact three-artifact implementation window CLOSED with `PASS_BOUNDED_LOCAL_REGISTRY`. Local run `de69e91d-006a-4c76-b9df-46c51428444b` passed real Auth/API/Browser, 187 synthetic children (157 active/30 pending), denials, unchanged full Student/Party/Enrollment fingerprints, zero fixture residuals and exact ACL/function recovery/reapply. Focused55/55, architecture7/7, TypeScript/lint native0, independent source/acceptance review clear, ten-path epoch binding and isolated raw-byte source recovery PASS. Production-mode build, remote acceptance, full owning reseal and Go-Live remain unproven/HELD. No global guard/freeze/baseline, Production or Git publication change. Details: `release-production-20261024/REGISTRY_RESULT.md`.

| Protected artifact | Final SHA256 |
| --- | --- |
| `preschool-registry.contract.ts` | `8fddfb9db94f7e38b518060a15fd6eccf5d97076e043b26d68220be75de1ae8d` |
| `preschool-registry.contract.impl.ts` | `b2a6f7c91904e6eca5ae5c8ecca5041c888a0e4bc3ace044d060881b54784b80` |
| `__tests__/preschool-registry.contract.impl.test.ts` | `db8033e7b1568e80269142db0e052bd06b96350b8306065869636cdaf58389df` |

