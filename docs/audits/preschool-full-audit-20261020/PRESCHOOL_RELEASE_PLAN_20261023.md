# Preschool — một kế hoạch đưa MVP đã nghiệm thu đến release

**Cập nhật thực thi 24/10/2026:** gói E2E mục9 và các amendment đã nghiệm thu `PASS_BOUNDED_E2E` (native0,114 kiểm tra), review cuối và kiểm tra độc lập PASS. Care đã xử lý timeout trong đúng capability/policy được duyệt. Toàn bộ fixture của13 lần chạy đã thu hồi; Production và commit/push/merge/deploy vẫn NOT_RUN, Go-Live NOT_READY. Xem [báo cáo hiện tại](release-e2e-20261024/FINAL_REPORT.md). Các trạng thái theo epoch cũ bên dưới được giữ làm provenance; không phải kết quả thực thi mới.

**Chuẩn bị Production 24/10/2026:** đã đọc lại đúng catalog Production và stable deployment alias; source đang phục vụ là `bb7007e7632c3bf7d88f760fc8239a0720d2d327`,56 path mới không giao119 path Preschool được chọn. Đã tạo bản nháp riêng cho target và baseline assertion chỉ đọc; chưa thực hiện DDL, tích hợp/build epoch mới hoặc backup/restore. Backup inventory hiện chưa chứng minh restore point/PITR. [Gói chuẩn bị rollout](release-production-20261024/ROLLOUT_READINESS.md) ghi rõ module security còn thiếu, hai dependency branch absent và các điều kiện còn HELD; đây chưa phải migration được phép chạy.

Ngày 23/10/2026. **LOCAL REHEARSAL APPROVED / PARTIAL EXECUTION; REMOTE HELD.** Owner đã duyệt mục4 và các prerequisite/amendment local ghi trong Browser continuation; đây không phải quyền Production hoặc quyết định Go-Live.

MVP giữ nguyên: catalog, Enrollment v1, hồ sơ, Attendance, nonhealth Care, Portal, bảng tin chung, Tổng quan/Báo cáo. Facilities/Giáo viên/Học tập/Tài chính tiếp tục khóa theo quyết định Owner; Medication không mở. Không làm lại các luồng local đã PASS.

## 1. Candidate và baseline đã xác minh

- Candidate: `codex/preschool-r1b-catalog-20261022`, HEAD `54e599048ebc315416e7a82e85f0af33dc25583d` cộng source chưa commit. Build local `cJLOpzNE6fD18S9lN7RYL`, runtime 27: 286 checks PASS, native 0. Đây là bằng chứng local, không phải deployment artifact Production.
- Đã ghim lại 72 đường dẫn runtime và toàn bộ 103 đường dẫn software đang dirty, không có hash drift. Giữ mọi receipt cũ; không ghi lại FAIL thành PASS.
- Production được xác minh read-only: Supabase `lvnvkpyxtuilhrabtlwv`; Vercel deployment `dpl_6h2WQRc7RMpCrCw2Ld1TiJxPPhDh`, source `80e13ea92ee70742d26cd890a45aaa94d8fc7494`, READY. Hai giao dịch catalog đều READ ONLY, kết thúc ROLLBACK, native 0; không đọc business rows.
- Source hai phía đã rẽ nhánh: Production có 7 commit riêng, candidate có 6 commit riêng; merge-base `ecfaf23ab06d043c5f2caec38ea67856705b6c26`. HEAD so với source đang deploy khác 442 đường dẫn, trong đó 19 đường dẫn software; còn source dirty nói trên. **Không phát hành nguyên branch.**
- Hai delta `src/components/bella-auto/BellaAutoAnalyticsDashboard.tsx` và test recognition tương ứng nằm ngoài Preschool; giữ phiên bản baseline đích khi tích hợp. Bốn artifact Lab dirty tiếp tục được bảo toàn trong worktree nhưng loại khỏi delivery Preschool. Các thay đổi governance/CI ngoài phạm vi không đi kèm release này.

Evidence máy đọc được: `.audit-local-cache/preschool-release-20261023/CANDIDATE_PIN.json`, `ROLLOUT_INVENTORY.json`, `REMOTE_CATALOG.json`, `REMOTE_SECURITY_DETAILS.json`. Mỗi receipt có thời điểm, native exit và hash; không chứa key/password/token hoặc nội dung business row.

## 2. Delta DB thực tế — không chạy nguyên SQL local

| Nhóm | Production quan sát được | Hành động cần thiết trước rollout |
| --- | --- | --- |
| Branch binding | Thiếu `preschool_chain_course_branch_assignments` | Additive table/constraint/RLS theo contract hiện có; Owner phải xác nhận mapping Course–branch thực tế, không suy diễn từ tên lớp hoặc tạo shadow legacy row |
| Bulletin | Thiếu `preschool_school_announcements`; migration version `20261023190000` chưa có | Additive bảng/index và 3 RPC theo capability đã nghiệm thu; không tạo delivery/thread/chat |
| Enrollment | Thiếu `edu_preschool_enrollment_candidates(uuid,text,integer,uuid)` và `edu_preschool_enroll_student(uuid,uuid,uuid,uuid)` | Hai capability đã duyệt local, SECURITY DEFINER, fixed search path, EXECUTE chỉ authenticated; server rechecks identity/tenant/branch/guardian, khóa capacity, atomic/idempotent; không cấp direct writes |
| Portal | Thiếu `preschool_portal_issuer_context(uuid,uuid,uuid)` và `preschool_portal_daily_read(uuid,uuid,uuid,uuid)` | Issuer authenticated, consumer service_role qua adapter token đã ký; không cấp direct table read hoặc biến service-role thành bằng chứng caller RLS |
| Care | Hai bảng đã tồn tại; đã có hai index canonical Party. Thiếu `preschool_save_care_records(uuid,uuid,date,jsonb)` | Reconcile bảng hiện hữu và index definition; giữ dữ liệu. RPC SECURITY INVOKER với RLS/quyền nonhealth đúng phạm vi. Không dùng CREATE/DROP hai bảng của script local |
| Attendance | Có `edu_set_daily_attendance`, thiếu hai helper `edu_attendance_can_read_course` / `edu_can_access_attendance_enrollment` | Prosrc fingerprint live `f85f16fcc93edf7b89c48a16619799e8` khác precondition local `68221d875d5a3ee06d8a5a5e7b095b5f`; dừng copy/replace. Cần artifact dành cho baseline live và quyền sửa function riêng |
| Catalog/profile/roster | Có các relation; policy/ACL khác profile tối thiểu local | Chuyển đúng contract đọc/CREATE-only đã duyệt thành delta có kiểm soát tương thích các consumer khác; không replay sáu-table REVOKE/GRANT local lên shared Production |

Tổng cộng tám business RPC ở ba gói Enrollment/Care/Portal/Bulletin đều chưa có trên target. Bảng Branch và Bulletin là hai relation thiếu trong 15 relation đã đọc metadata. Helper catalog `edu_course_catalog_actor_allowed` chưa nằm trong truy vấn metadata này: phải đối chiếu chính xác trước khi lập DDL, không coi là đã chứng minh tồn tại/vắng mặt.

Các file `LOCAL_ENROLLMENT_CAPABILITIES.sql`, `LOCAL_PORTAL_READ.sql`, `PROPOSED_LOCAL_CARE_ATOMIC.sql`, `EXECUTION_A_APPROVED_ATTENDANCE.sql`, `EXECUTION_B_APPROVED_LOCAL_PREREQUISITES.sql`, `COURSE_CATALOG_LOCAL.reviewed.sql` và migration Bulletin là **nguồn tham chiếu đã nghiệm thu local**, không phải bundle sẵn chạy remote. Không `db push` toàn migration history; migration Lab và mọi schema Healthcare không thuộc rollout Preschool.

## 3. Blocker bảo mật phải xử lý trước release

Catalog live chứng minh `students` có policy `tenant_isolation_students`, PERMISSIVE, ALL, TO public, `USING (true)`, không có restrictive policy tại snapshot. Role authenticated có SELECT/INSERT/UPDATE/TRUNCATE trên bảng này. Đây là lỗi tenant guard ở cấp catalog; chưa thực hiện authenticated business-row probe và không tuyên bố đã chứng minh một vụ đọc dữ liệu thực tế.

Authenticated có effective TRUNCATE trên đúng 10 bảng trong snapshot này: `edu_attendance`, `edu_courses`, `edu_daily_care_records`, `edu_daily_care_sessions`, `edu_enrollments`, `org_units`, `party_parties`, `party_relationships`, `students`, `tenants`. RLS không phải cơ chế bảo vệ TRUNCATE; tuyệt đối không thử thao tác này trên Production.

Chín relation MVP còn anon table/column privileges: `edu_attendance`, `edu_courses`, hai bảng Care, `edu_enrollments`, hai bảng Party, `tenants`, `users`. Cả chín nằm ngoài allowlist 32 relation trước. Trong 15 relation vừa kiểm tra, chỉ `students` thuộc allowlist cũ và bảng này hiện không còn anon grant. Có grant không tự chứng minh có dữ liệu trả về qua RLS; cũng không được suy ra đã an toàn từ việc Courses HTTP bị API chặn.

Do đó phải giữ `ANONYMOUS_CONTAINMENT = PASS_BOUNDED_32_DIRECT_RELATIONS_READ_ONLY`, broader surface `NOT_PROVEN`; `AUTHENTICATED_ACCESS_REGRESSION = NOT_PROVEN` trên Production. Không sửa Production trong bước này.

## 4. Thực thi tiếp — một batch local cho delta release, rồi remote riêng

**Approval local đã nhận:** Owner duyệt đúng rehearsal mục4, bổ sung canonical `persons`/`audit_logs` local và RPC roster/Attendance unlock giới hạn. Không hỏi lại Route B hoặc matrix. C đã được tái dựng và có Auth/Browser/DB/recovery cho Enrollment, roster đọc, Care, Portal và bulletin; xem `BROWSER_RELEASE_CONTINUATION_20261023.md`. Source integration trên baseline đích, Attendance mutation và các owning gate rộng chưa hoàn tất. Quyền remote vẫn chưa được cấp.

Đề xuất scope local để quyết định một lần:

1. Dùng lại hai target C/T1 đã được duyệt, tuần tự, đúng project/port/owned-container; tạo execution epoch/manifest còn hạn đúng container thật. Không sửa guard, fixture assertion, selector hoặc global baseline. Baseline metadata Production chỉ được tái dựng bằng schema/security và fixture tổng hợp; không sao chép business data.
2. DB write allowlist chỉ 15 relation ở inventory: 13 hiện hữu và hai bảng Branch/Bulletin mới; các read-only dependency `people_directory`, `org_relationships`, `user_org_unit_access`, `get_auth_tenant_id()` giữ nguyên contract. Không tự sửa dependency ngoài allowlist.
3. Local rehearsal: bỏ anon privileges trên chín relation nêu trên; bỏ authenticated TRUNCATE trên mười bảng nêu trên; đóng permissive bypass Student, ràng tenant/branch/role theo matrix đã duyệt. Reconcile ACL/policy profile/catalog/roster/Care/Attendance với khả năng hoạt động hợp lệ của consumer ngoài Preschool. Không dùng blanket self-only policy/REVOKE để gây hồi quy consumer khác rồi coi PASS. Quyền cột nhạy cảm và direct writes chỉ mở khi contract hiện hữu đòi hỏi; nếu không thể đáp ứng trong allowlist thì giữ HELD tại delta cụ thể.
4. Chuẩn bị đúng tám business RPC, hai helper Attendance và catalog predicate nói trên; re-read existence/signature/ACL trước tạo. Bản sửa function Attendance hiện hữu phải có before fingerprint, diff và postconditions riêng. Giữ definer/invoker và EXECUTE roles đúng bảng mục 2, không nâng quyền RPC cũ ngoài scope. DDL trong local phải có bounded timeout, drift abort, transaction và recovery đã chạy được.
5. Tích hợp source Preschool vào baseline đích trong checkout/candidate tách biệt, bảo toàn active worktree. Chỉ lấy các delta cần cho MVP, không lấy Auto/Lab/governance ngoài phạm vi; không commit/push. Pin toàn bộ source của artifact tích hợp và build mới; build local đã PASS không tự trở thành bằng chứng cho source tích hợp.
6. Chạy một vòng acceptance có Auth thật: admin/foreign tenant/foreign branch/inactive/teacher/anon; direct RPC và direct table denial; Enrollment retry/capacity rollback; Attendance/Care DB readback và second-write rollback; Portal token isolation/expiry; bulletin/Analytics. Mọi fixture thuộc sandbox, log không có business rows hoặc secrets.
7. Chạy mandatory `education:verify` trên epoch/manifest C hoặc T1 hợp lệ; giữ count/exit từng stage. Healthcare chỉ chạy applicable regression với đúng prerequisite đã được duyệt, không sửa runtime/schema Healthcare hoặc nâng fixture authority để lấy màu xanh. Nếu prerequisites bắt buộc vượt scope, giữ gate BLOCKED với tên dependency, không chạy sai target.
8. Recovery và independent review trên delta thực tế. Chỉ giữ thay đổi local khi acceptance/review/recovery PASS. Không sửa source đã nghiệm thu chỉ để cộng thêm test. T2 temporal producer vẫn HELD; không manual event hoặc tự miễn gate.

Scope local trên đã được duyệt; kết quả phải đọc riêng từng mục, không coi approval là PASS. Rehearsal local không cho phép remote mutation, migration Production, commit/push/merge/deploy hoặc thay required gates. Full reseal vẫn phải giữ trạng thái theo kết quả owning gates thực tế.

## 5. Remote rollout sau khi có approval riêng

1. Pin target/schema/source ngay trước chạy. Sinh migration additive dành đúng catalog live, re-read grants/column ACL/policies/helpers/dependencies. Bất kỳ drift nào ngoài delta được duyệt phải abort; không tự rộng allowlist hoặc drop/recreate bảng hiện hữu.
2. Chạy rehearsal trên Non-Production đích được Owner chỉ định; không mặc định project E2E cũ được cấp quyền cho gói mới. Auth positive/negative và độc lập DB readback phải PASS trên artifact tích hợp.
3. Trước Production: có backup phù hợp, restore proof, vị trí bảo vệ, thời điểm và receipt; không đặt dump/secrets trong repo. Local rollback/disposal không thay thế backup Production. Xác nhận mapping Course–branch, Student Party/guardian đầu vào và tài khoản vận hành; không provision qua Healthcare bootstrap.
4. Human GO cuối chỉ sau khi đã có artifact SQL/source exact, review/rehearsal/recovery, owning-gate disposition, backup/monitoring và phạm vi. Chưa có quyền này trong chỉ thị hiện tại.
5. Rollout DB additive trước, app sau; chạy postconditions SQL và Auth/Browser/DB trên đúng deployed source/schema. Không gọi SQL exit 0 là Go-Live. Lặp named anonymous probes và kiểm tra legitimate caller; không tạo fixture phá hủy trên Production.
6. Monitoring đề nghị: người vận hành Owner; checkpoint trước chuyển traffic, ngay sau, +15 phút và +60 phút. Kiểm tra 5xx, Auth/denial bất thường, duplicate Enrollment/capacity mismatch, Attendance/Care write/readback, Portal/bulletin tenant isolation. Bất kỳ cross-tenant access/ghi sai dữ liệu là stop-traffic ngay; lỗi chức năng quan trọng giữ trạng thái chưa phát hành.

**Rollback:** trước commit, transaction rollback và fingerprint phải khớp. Sau có traffic/write, đóng workflow chịu ảnh hưởng và chuyển app về artifact rollback tương thích đã rehearsal; không mặc định deployment cũ tương thích quyền mới. Giữ bảng mới/dữ liệu nghiệp vụ, không DROP, không rollback bằng cách phục hồi anonymous grants hoặc public-true policies. Có thể thu EXECUTE đúng capability mới nếu đã được duyệt; restore database chỉ theo kế hoạch incident/backup được cấp quyền.

## 6. Các gate còn mở — giữ nguyên bằng chứng

| Gate | Trạng thái |
| --- | --- |
| MVP local hiện tại | Bounded accepted workflows retained; final-source adapter/review/build epochs in Browser continuation report |
| Candidate tích hợp trên baseline đích | IMPLEMENTED_LOCAL, branch `codex/preschool-release-20261023`, HEAD `80e13ea92ee70742d26cd890a45aaa94d8fc7494` plus pinned uncommitted changes; no branch merge/publication |
| Education aggregate trên baseline tích hợp | FAIL native1: architecture7/7, conformance13 PASS/43 FAIL; two later stages NOT_RUN. Earlier R1b35 PASS/21 FAIL receipt is a different preserved epoch. Out-of-scope legacy prerequisites/fixture authority unresolved; no aggregate PASS claimed |
| Healthcare aggregate mới nhất đã lưu | FAIL native 1; fixture FK/cleanup; không suy ra regression từ tổng failure cascade |
| Course legacy | 2 suites: aggregate 38 PASS, integration 15 FAIL trên epoch C cũ; source suite dùng CourseService/courses và fixed synthetic tenant/user. Current MVP đi canonical Course contract/edu_courses; không có import CourseService trong ba cây Product/API/UI Education đã kiểm. Không waiver owning gate, không khẳng định raw exception đầu tiên khi receipt chỉ giữ tên test |
| Frozen reseal / T2 | HELD; chưa có accepted academic temporal producer; không dùng Gate8 [] làm chứng cứ producer |
| Attendance mutation / shared adapter | Real Auth/Browser/DB and bounded public-adapter compatibility PASS on explicit local epochs; atomic history/projection, direct-write denial and exact recovery proved. Source hashes/final build disposition in Browser continuation report; not a full English or remote certification |
| Production authenticated / backup-restore | NOT_PROVEN |
| BATCH2B_RBAC_RLS | IN_PROGRESS |
| Remote mutation / commit / push / merge / deploy | NOT_RUN |
| PRESCHOOL_GO_LIVE | NOT_READY |

Không thêm framework, guard hay một vòng audit tổng thể. Delta source integration và Attendance local đã thực thi theo các quyết định Owner; xem báo cáo continuation để đọc đúng từng epoch. Các blocker còn lại là owning aggregate prerequisites/fixture authority, T2 producer contract và full reseal, rồi target-specific remote rehearsal/authenticated regression, backup/restore và quyết định phát hành. Quyền local không tự mở các scope đó; không gọi SQL local là migration sẵn sàng Production.

## 7. Full local release-gate completion — proposed owner amendment

**PROPOSED / NOT_APPROVED / NOT_IMPLEMENTED.** User requests full Preschool completion. Existing MVP/Route B/Attendance approvals remain valid and are not requested again. This decision covers only the previously excluded dependencies and T2; Production, remote, commit/push/merge/deploy remain excluded.

**Subsequent owner decision:** “Duyệt A+B full local đúng mục7”. Scope A+B and the separately authorized Preschool execution route are now APPROVED. Implementation/acceptance have not been inferred from approval; exact ACR/ADR window and local execution evidence follow below.

### Proven blocker and execution route

One read-only C catalog probe found exactly ten named missing relations: `courses`, `enrollments`, `attendances`, `assessments`, `assessment_results`, `teacher_assignments`, `edu_assessments`, `platform_business_rules`, `platform_rule_evaluation_log`, `timeline_events`. Canonical Timeline DDL additionally requires `journey_journeys` as an FK prerequisite; no other Journey capability is proposed. The two owned fixture suites hardcode source revision `54e599048ebc315416e7a82e85f0af33dc25583d`; integrated candidate HEAD is `80e13ea92ee70742d26cd890a45aaa94d8fc7494`. Do not attest the old revision as the current one.

The configured Factory admission in `scripts/agent-flow/role-pipeline.mjs:11` accepts only bounded `scripts/agent-flow/*.mjs` tooling. Product/Kernel/SQL paths would be `INVALID_TASK_SCOPE`; do not alter that admission or represent this work as a Factory run. Proposed authority explicitly continues the separately authorized Preschool implementation workflow for the exact local amendment below.

### A — canonical regression prerequisites and exact fixture authority

- Reuse the approved owned T1 target (API24631/DB24632), with real container/marker/source attestations. Preserve accepted C MVP schema/evidence. Reconstruct only canonical prerequisite metadata with synthetic data; no Production business-row copy, full migration-history replay or invented shadow schema.
- Provision only the eleven relations named above, existing indexes/constraints/triggers/policies/helpers required by their pinned canonical definitions, and already approved shared prerequisites. Apply no automatic dependency expansion. If the canonical FK closure is wider, hold and identify that exact dependency. These tables do not enable Facilities, Teachers, Learning or Finance in the MVP.
- Amend only fixture authority/lifecycle in `src/platform/education/__tests__/verification-gates.test.ts` and `src/platform/education/__tests__/course-contract-real-db.integration.test.ts` to the approved integrated revision, source-file hashes, fresh expiry and actual T1 identity. Keep protection strength, caller isolation, quarantine receipts and owned-stack disposal; do not change global guards, manifests, baselines or selectors. Do not call quarantine deletion or use C's accepted schema as disposable T1 evidence.
- Run actual `education:verify` and applicable `healthcare:verify` stages with native exits/counts. Healthcare runtime/schema remains outside this amendment; unresolved Healthcare prerequisites remain a named blocker, not permission to provision them or modify assertions.

### B — T2 Student academic provenance contract and narrow unlock

**Proposed business contract for owner approval:** existing Student create/status-change workflows produce real immutable academic events. Event identity uses canonical Student Party and Student aggregate, verified actor/current tenant, before/after academic status and authoritative occurrence/order. No health/contact/financial fields in the event. Capture actual workflow persistence; do not manually append events in the test, backfill invented history, alter existing Student lifecycle transitions, or expose a new Product API. Historical reconstruction is bounded by actual recorded history; earlier unknown history stays unknown.

- Education owns the producer. Reuse the generic Timeline public types/hash/replay semantics; no new engine, Healthcare wiring or Timeline Kernel-code change. A narrow local persistence capability may atomically commit Student persistence plus Timeline append, with drift/concurrency/idempotency guards. At most two explicitly reviewed RPC candidates: `edu_create_student_with_timeline` and `edu_update_student_with_timeline`; caller authority must be checked server-side. No broad Student/Party grants, role expansion, permissive RLS, service-role fallback, immutability bypass or shared-FK alteration.
- Exact existing Kernel unlock: `src/platform/education/student/student.repository.ts`, `src/platform/education/student/student.service.ts`; new supporting Kernel files `src/platform/education/student/student-timeline.persistence.ts` and `src/platform/education/student/__tests__/student-timeline.persistence.test.ts`. Student/Enrollment public DTOs remain unchanged; other consumers retain existing authorized role/tenant/lifecycle semantics. If the generic Timeline contract cannot support the required persistence semantics without a Platform change, hold that specific capability instead of editing Platform code.
- Unlock `src/platform/education/__tests__/verification-gates.test.ts` only to strengthen the real academic producer/replay proof and correct misleading evidence paths: assert nonempty events, exact identity/before-after/order/time-T, explicit RLS failure, real contract/governance/audit evidence where applicable. Preserve negative expectations. Gates based on swallowed errors, local toy calculations or `expect(true)` must not be counted as actual security/governance/regression proof. No deletion, skipping, relaxed threshold or fabricated success.
- Add only scoped SQL/rehearsal/fixture harness in this existing audit workstream, plus ACR/ADR approval/unlock/closeout records required by the freeze process. No global control changes, other Kernel work or Product redesign.
- Keep only after real caller positive/negative tests, persistence/readback, concurrent/retry and failure rollback, Timeline integrity/replay, relevant consumer regression, independent review and exact recovery PASS. Run owning gates on the same pinned source/schema; retain every genuine FAIL/SKIP/NOT_RUN. Full reseal remains HELD until its mandatory gates truly pass.

### Remote boundary retained

This amendment does not select a remote test project, authorize migration/ACL changes on remote, or authorize publication/Production release. After local gates, prepare one target-specific reviewed artifact/rehearsal and backup/restore/rollback/monitoring package for a separate final release decision. Owner may approve A+B together; that is not an unconditional Go-Live decision.

### A+B execution closeout — 2026-10-23

`A_LOCAL_PREREQUISITES=PASS_BOUNDED`; `T2_WORKER_TECHNICAL_REPAIR=PASS_BOUNDED`; `FULL_ACCEPTANCE_AND_RESEAL=HELD`. These are executed local results, superseding the earlier NOT_IMPLEMENTED annotation only within the explicit bounds below.

The actual T1 container was pinned to `de795515a091b5885b798ad9276052eefbe2342d4955b59b999609074085b549`, API24631/DB24632. Its public baseline was empty. Metadata reconstruction created exactly30 approved relations: the eleven named prerequisites plus nineteen already approved shared relations/view. No business-row copy or blind migration-history replay occurred. Rehearsal rollback, two-RPC recovery/reapply and post-runtime exact RPC recovery passed. The owned T1 containers and data volumes were then disposed with explicit project targeting; four containers outside T1 retained their identities. Accepted C catalog remains `d21e04139bf3927fb501fb9d25d8a07e`.

| Executed evidence | Actual result and applicability |
| --- | --- |
| Full MVP Browser/Auth/DB final02 on C, before T2 changes | Native0; actual list→detail, Enrollment→profile, guardian selection/Portal link, Attendance, Care, bulletin and Dashboard/Reports. Development Browser only. Does not attest the later T2 source. |
| T2 runtime final, on T1 | Native0,32 checks including fresh quarantine. Real worker Student service create/status producer, public Timeline replay/time-T, two valid concurrent changes (one winner/40001 loser), retry, non-status event suppression and second-write23514 rollback. |
| T2 real provider Auth | Identity verified. Create denied at canonical Party precheck; update denied with40001, specific cause NOT_PROVEN. Provider token lacks top-level tenant claim. No fallback/grants/policies added; legitimate provider-positive Student persistence stays HELD. |
| Unit/regression | Student persistence12/12; Attendance adapter21/21; unchanged Real DB Attendance4/4. Final TypeScript/ESLint native0. |
| Education aggregate latest | Native1. Three architecture stages7 tests PASS; conformance8 suites/56 tests PASS,1 suite/1 test FAIL at actual Healthcare-result gate. Last two conformance stages NOT_RUN after command short-circuit. |
| Healthcare aggregate | Guard native0, architecture2 suites/9 tests PASS, conformance1 suite/7 tests PASS; Kernel test stage39 suites/378 tests PASS,21 suites/151 tests FAIL,1 suite/1 test skipped. Native1. Missing canonical Healthcare fixture tenants/schema cause failures and cleanup cascades; these were not repaired outside authority. |
| Independent review and recovery | Static SQL/source review and bounded worker acceptance review PASS after corrections; eight-path isolated source restoration/reapply PASS, exact DB recovery/disposal PASS. Full owning reseal is not established. |

Mandatory semantic gaps remain separate from the numerical suite result: Gate7's persisted GPA/Assessment safety proof does not prove calculation routing through governed rules; Gate10's real immutable-event fingerprint does not prove transcript-export fingerprinting. No canonical transcript-export contract was found in Education. Both mandatory requirements remain NOT_PROVEN; they are not waived or reclassified as fulfilled.

Evidence is in the existing ignored integration cache: `T1_EXECUTION_RESULT.json`, `T2_EXECUTION_RESULT.json`, `T2_RUNTIME_RESULT.json`, `RUNTIME_T1_1792772409581.log`, `EDUCATION_T1_1792772290462.log`, `HEALTHCARE_T1_1792769503060.log`, `T2_FINAL_SOURCE_RECOVERY.json`, `T1_DISPOSAL_RESULT.json`. Source/SQL hashes are pinned there. The reviewed two-RPC candidate is also retained as `T2_STUDENT_PERSISTENCE.local.sql`, default ROLLBACK, expressly not a remote migration.

Failure provenance remains intact: initial metadata rehearsal syntax failure; initial focused command quoting produced only skips and is excluded from PASS; the first immutable-update expectation failed and was corrected to the observed0A000 denial; the initial race used an invalid contender and is excluded from concurrency acceptance. Final acceptance uses two canonical-valid states. No old PASS receipt was substituted for a changed source/schema epoch.

**Next genuine authority boundaries:** (1) canonical caller identity/Student–Party visibility for provider-positive persistence, without broad reads or forged tenant claims; (2) owning Assessment Rule-routing and transcript-export contract decisions beyond this Student-only unlock; (3) separately scoped Healthcare regression fixture/schema authority. Existing Preschool MVP scope and Route B are already approved and need no repeat approval. Remote rehearsal/Production release remain separate and unapproved here. Preserve this T2 source as an unaccepted local candidate; do not release it or declare full reseal while these gates are held.

`PRODUCTION_CHANGE=NOT_RUN`; `AUTHENTICATED_ACCESS_REGRESSION=NOT_PROVEN` on Production; `BATCH2B_RBAC_RLS=IN_PROGRESS`; `PRESCHOOL_GO_LIVE=NOT_READY`; commit/push/merge/deploy NOT_RUN. No fresh remote anonymous verification was performed in A+B.

## 8. One proposed release-applicability decision — NOT_APPROVED

**Subsequent direct Owner decision,2026-10-23:** “Duyệt ngoại lệ release MVP đúng mục8; chỉ thực hiện local”. The proposal below is retained as history; the exact local source-selection and release exception are APPROVED in ACR-2026-023/ADR-028. Six-path source selection/recovery and independent static review have executed PASS. Final selected-source runtime/build acceptance remains pending; no remote authority or Go-Live approval is inferred.

**Subsequent execution:** selected-source local MVP acceptance PASS_BOUNDED. Four files restored byte-identically, two active T2 files excluded and all six draft versions preserved. Independent selection review PASS. Production build10 native0, build ID `U935iOhDLBp_SouA622oM`, source3,324 paths stable before/after. Focused regression52 suites/1,142 tests PASS,0 skipped; separate two tail conformance suites16/16 PASS (does not change aggregate native1). Selected-source TypeScript/ESLint/diff check native0. Development Browser/Auth/DB full MVP native0 on the same source pin, including allowed/denied caller, tenant/branch, Enrollment retry/capacity, Attendance/Care atomic rollback, Portal/guardian/expiry and bulletin/Dashboard/Reports. Production-mode Browser NOT_RUN.

Fresh independent C readback: catalog `d21e04139bf3927fb501fb9d25d8a07e`; current synthetic tenant/Auth rows0 and test constraints0. Existing synthetic-tenant delete audit-FK warning remains in raw log; it is not rewritten as a clean global audit result. Local evidence: `MVP_RELEASE_SOURCE_SELECTION.json`, `BUILD10_MVP_SELECTED_RESULT.json`, `REGRESSION_MVP_SELECTED_RESULT.json`, `EDUCATION_TAIL_CURRENT_CANDIDATE_RESULT.json`, `MVP_SELECTED_AUTH_BROWSER_DB_FINAL_RESULT.json`, `MVP_SELECTED_FINAL_READBACK.json` and source-only `MVP_RELEASE_DELIVERY_MANIFEST.json` (119 selected integration paths). Historical T2/aggregate failure receipts remain unchanged. Full Kernel reseal is not claimed; remote/Production acceptance is still NOT_PROVEN.

**Purpose:** finish the already-approved operational MVP without adding new grading/transcript or Student-lifecycle features. This is a proposed limited exception to mandatory owning-gate applicability, requiring the Owner acting as the Human Architect; it is not an implementation permission inferred from “continue”. No exception has been applied.

Source evidence: the accepted Student profile uses the public Attendance roster read; Enrollment v1 enrolls an existing Student through its already-reviewed Enrollment RPC. No live Product/API/UI Education caller of Student create/status services was found. AssessmentProductService exists as a generic service, but no runtime application caller was found; Preschool Grades is held and the existing held-workspace test verifies zero requests/actions. There is no Education transcript-export contract to complete inside the current Student unlock. Worker-only T2 is an unaccepted draft, not a prerequisite that the accepted Enrollment/Attendance/Care workflows call.

### Recommended narrow decision

1. Continue toward a **Preschool MVP release candidate**, preserving the previously approved locked features. Do not implement a grading/transcript product merely to satisfy a generic gate name.
2. Keep T2 isolated from the release source: preserve its candidate/evidence, restore only Student repository/service to their exact pre-T2 approved bytes and exclude the two new Student persistence files/RPCs from the release artifact. Restore the pre-T2 two fixture files in the release artifact rather than presenting their draft gate changes as sealed. No deletion of historical evidence, fallback direct writes, business-data rollback or Production mutation. Exact source selection/recovery and the affected MVP verification must prove this separation before candidate acceptance.
3. Record a **release-specific architecture exception**, with all raw failures retained: Gate7 grading Rule-routing, Gate10 transcript-export fingerprint and T2 provider-positive lifecycle remain deferred from this MVP's release acceptance, not PASS and not certified Kernel capabilities. Healthcare aggregate native1 remains FAIL; it is not a passing regression receipt. The exception would accept this unresolved wider owning gate only for this bounded release candidate after proving no Healthcare source/contract change, no Healthcare dependency in active MVP workflows and the affected shared-contract regressions. No edit to constitutions, guards, global freeze manifests, baselines, suite assertions or CI required-check configuration is proposed.
4. Security and operations remain hard release gates: no exception for anonymous access, legitimate Auth/tenant/branch/role behavior, capacity/idempotency/atomicity, Portal isolation/expiry, accurate UI data, deployed source/schema compatibility, target-specific rehearsal, backup/restore, rollback or monitoring. Any relevant failed path keeps the release held.
5. If approved, record the exact exception and source selection in a narrow ACR/ADR; implement/verify the source separation locally and prepare the target-specific remote package. No remote project is selected or mutated; no commit/push/merge/deploy is authorized by this decision.

**Alternative:** require full shared Education/Healthcare Kernel reseal before even preparing the MVP release candidate. That retains the current hold and needs separately approved caller identity/Student–Party capability, governed Assessment/transcript contract and Healthcare fixture/schema work. Those are changes outside the current Student-only approval, not routine UI fixes.

This proposal does not silently reclassify a mandatory gate as NOT_APPLICABLE. Until the explicit architecture decision exists, all prior HELD/FAIL/NOT_PROVEN statuses remain binding and `PRESCHOOL_GO_LIVE=NOT_READY`.

## 9. Next Non-Production rehearsal scope — PROPOSED / NOT_AUTHORIZED

**Subsequent direct Owner approval,2026-10-24:** “Duyệt project E2E này và đúng scope mục9”. Exact approved target is `bmnbqbcdbuklhopfbopv`; the bounded scope below is now AUTHORIZED for target verification, reviewed target-specific artifact, rehearsal/recovery and acceptance. Original proposal text is retained. Approval is not an execution PASS. Production `lvnvkpyxtuilhrabtlwv`, T2/Healthcare and commit/push/merge/deploy remain excluded.

No target is assumed. Existing project `bmnbqbcdbuklhopfbopv` was previously identified as E2E, but its old six-relation approval does not authorize this release delta. Owner must confirm that project for this rehearsal, or name a different isolated Non-Production project. `lvnvkpyxtuilhrabtlwv` Production is explicitly excluded.

Proposed bounded authority: re-read exact target identity/source/catalog and prepare one target-specific artifact from the selected MVP source. Reconcile only these fifteen named relations/view: `users`, `tenants`, `students`, `party_parties`, `party_relationships`, `edu_courses`, `edu_enrollments`, `org_units`, `user_org_unit_access`, `edu_attendance`, `edu_attendance_daily_state`, `edu_daily_care_sessions`, `edu_daily_care_records`, `preschool_chain_course_branch_assignments`, `preschool_school_announcements`. `user_org_unit_access` and existing Platform dependency definitions remain read-only. Canonical dependencies `people_directory`, `org_relationships`, `get_auth_tenant_id()` may be inspected but not modified. Stop at a missing/unaccounted dependency; do not expand automatically.

Only the accepted MVP capabilities: the eight business RPC signatures listed in section2/inventory; roster `edu_preschool_roster_identity(uuid,date)`; existing `edu_set_daily_attendance(uuid,uuid,text,timestamptz,date)` and its two approved access predicates; catalog CREATE/read predicate. Preserve security modes and EXECUTE roles already accepted. No Student T2, Lab, Medication, grading/transcript or other Product capability.

Security delta only within that allowlist: remove previously identified anonymous table/column paths, remove authenticated TRUNCATE, close Student public-true bypass, apply the least required accepted catalog/profile/Attendance/Care permissions. No broad Student/Party read policy or direct-write fallback; preserve legitimate other-consumer permissions and fail the rehearsal on unaccounted impact. No role memberships, default ACL, global auth configuration or Platform policy redesign.

Before mutation: source/catalog pins, reviewed exact SQL diff/postconditions, scoped recovery snapshot and an isolated rehearsal with bounded timeouts, full transaction rollback on errors/drift. Existing business rows must be preserved; only explicit synthetic fixture identities may be provisioned for acceptance. Execute only after review/rehearsal/recovery supports the exact target; otherwise hold with the specific blocker, without applying local bootstrap scripts or all migration history.

Acceptance: real caller Auth with allowed/denied tenant/branch/role/inactive/anonymous paths; Enrollment capacity/idempotency; Attendance/Care atomic write/readback and second-write failure; Portal expiry/tenant/guardian; bulletin and Dashboard/Reports truth. Use a local app pointed at the approved remote test backend unless a preview is separately authorized. Record that environment accurately. Run cleanup/recovery and independent verification. Production backup/restore, traffic, commit/push/merge/deploy remain outside this scope; this rehearsal is not a Go-Live authorization.

### 9.1 E2E preflight findings — 2026-10-24 / REMOTE MUTATION NOT_RUN

Management metadata confirms target `bmnbqbcdbuklhopfbopv`, name `bella-spa-erp-e2e`, status `ACTIVE_HEALTHY`. The three read-only metadata commands exited 0 with `transaction_read_only=on`; no business rows were read, no Auth fixtures created and no remote DDL/DML executed. Fourteen approved relations/view exist; `preschool_school_announcements` is absent. Accepted local C is a comparison source, not a substitute for the E2E baseline. No unrelated missing column or global Auth helper is proposed for provisioning.

Pinned evidence under ignored `.audit-local-cache/preschool-release-integration-20261023/`:

- `E2E_BASELINE_CATALOG.json`: SHA256 `f86b79c0062663b205a42e91641122d8c9f33337d29a8d8053e05c5f58681cf2`.
- `E2E_DEPENDENCIES_CATALOG.json`: SHA256 `fcfd5a27ab67adfb3fe7fbfc0142368f4577ce8d4d8364456f776683032d47b1`.
- `E2E_BOUNDARY_CATALOG.json`, `E2E_C_DELTA_INVENTORY.json`, `E2E_TARGET_IDENTITY.json`, and the exact read-only SQL/command scripts retain definitions and provenance; they contain no credentials or business-row contents.

Two concrete boundaries prevent fixture-based acceptance under the fifteen-relation scope:

1. The accepted candidate/enroll/roster/Portal and Attendance access functions require a canonical branch access row with **non-null `relationship_id`**. The unchanged Platform view's tenant-admin fallback has `relationship_id=NULL`, so it cannot substitute for this evidence. Synthetic authenticated subjects need synthetic `people_directory` and `org_relationships` rows. Section9 currently makes these dependencies read-only. Removing the relationship requirement or fabricating a view row is not proposed.
2. Existing E2E trigger `edu_capture_enrollment_created_event` runs after every Enrollment INSERT and writes `edu_enrollment_event_records`. That table is outside the fifteen relations; its Enrollment/tenant FKs use `ON DELETE RESTRICT`, and `edu_enrollment_event_replays` references it with `RESTRICT`. Existing tenant/user audit triggers also write `audit_logs`. Disabling triggers, dropping FKs, using an existing business identity or silently leaving fixtures is not proposed.

**Minimum proposed fixture-only amendment — NOT_APPROVED / NOT_EXECUTED:**

**Subsequent direct Owner approval,2026-10-24:** “Duyệt fixture E2E đúng mục9.1”. The bounded fixture authority below is now approved; original proposal wording is preserved. No execution or recovery PASS is implied.

- Keep the original fifteen-relation schema/ACL/RPC scope. Add no schema, policy, grant, function, worker, lease or replay changes on any dependency.
- Permit provision/readback/cleanup of at most eight synthetic `people_directory` rows and eight synthetic `org_relationships` rows, each with explicit run-owned UUID and synthetic tenant/subject/branch IDs recorded before use. No change to existing identities, role definitions or access relationships.
- Permit only existing canonical triggers to create synthetic `audit_logs` and `edu_enrollment_event_records` rows for the run-owned subjects/tenants/enrollments. Read back counts/identity selectors only, and delete only those exact synthetic rows during recovery. Do not insert event records manually, invoke T2 or claim temporal producer acceptance.
- Permit read-only inspection of `edu_enrollment_event_replays` **only for the run-owned event IDs**. If any replay exists, or a worker/other unaccounted dependency has acted on a fixture, stop dependent cleanup and record recovery HELD; do not delete replay evidence or widen authority.
- Fixture ceiling: twelve Auth subjects, five synthetic tenants, twenty synthetic enrollment event records and two hundred synthetic audit records. A limit breach aborts further writes. Provisioning/cleanup must verify exact UUID+tenant ownership and expected counts; prefixes alone are insufficient. Never read or delete existing business rows.
- Rehearse with rollback first. Keep metadata, ACL/RLS, trigger/helper/view definitions and all existing rows unchanged on the extra dependencies. Verify fixture disposal and original catalog fingerprints independently before claiming recovery PASS.

This is a new fixture-write decision, not a repeat request for section9 or RouteB. Until authorized, dependent fixture creation, remote mutation and real Auth/Browser/DB acceptance remain HELD. Independent target-specific artifact preparation may continue; no execution PASS is implied.

### 9.2 Concrete E2E recovery prerequisite — PROPOSED / NOT_AUTHORIZED

**Subsequent direct Owner approval,2026-10-24:** “Duyệt đúng một index E2E và recovery”. Only the canonical tenant index below is now authorized with rehearsal, review, exact recovery and independent verification; retain only when PASS. The original proposal/evidence is preserved. No Production or other dependency schema authority is added.

The initial exact delta passed rollback/recovery rehearsal and committed-state read-only postconditions. The first Auth/Browser run proved the MVP Browser paths and fifteen anonymous direct denials, but its process was interrupted before a terminal acceptance/recovery receipt. It is **not** a complete E2E PASS. Its run-owned manifest is `E2E_FIXTURE_5c7b151d-7a1a-426f-aea9-17a15b69c881.json`. Only two synthetic tenants and two synthetic Enrollment events remain; the events were independently confirmed pristine pending with no replay/worker activity. The interrupted Care fault-probe constraint was verified by exact definition and removed. Existing failure/interruption evidence is retained.

Two accepted local restrictive guards are being reconciled within the already-approved fifteen-relation scope: `roster_rpc_enrollment_guard` and `release_care_edu_daily_care_sessions_guard`. They prevent the separately approved academic catalog read from opening dependent direct Enrollment/Care paths on unbound/inactive-branch Courses. No new helper/grant or Product semantics is required.

**Specific recovery obstacle:** cleanup hits native PostgreSQL `57014` at the audit fixture-ceiling check. Read-only inspection of the owned cleanup session identifies phase `ps_e2e_cleanup_limits`, active CPU and no blocking session. `EXPLAIN` shows a full sequential scan on `audit_logs(tenant_id)`; E2E has only the primary-key index. Metadata estimates180,827 audit rows and the actual heap size is254,091,264bytes. A separately bounded read-only scan returned exactly seven run-owned audit identity records; no business-row contents were read. Prior timed-out cleanup transactions did not complete; recovery remains HELD.

**Minimum proposed amendment:** provision exactly the existing canonical index `idx_audit_logs_tenant_id ON public.audit_logs(tenant_id)` from `supabase/migrations/20260514000001_audit_logs.sql:16`, on approved E2E only. Do not apply that whole migration or create its other indexes. Preserve all rows, table/column ACLs, policies, triggers, functions and defaults. Pin before metadata, use bounded lock/statement timeouts, rehearse with ROLLBACK, then verify valid exact index and unchanged other metadata through an independent connection. Demonstrate exact index removal recovery before keeping it. Retain the index only when its checks and fixture disposal pass.

Reviewable SQL: `release-e2e-20261024/PROPOSED_AUDIT_TENANT_INDEX.sql`, default ROLLBACK and explicitly NOT_AUTHORIZED. Section9.1 currently prohibits schema changes on this dependency, so Owner authority is required for this one index. No Production, replay/worker, Kernel, additional relation, privilege or deployment authority is requested.

The non-concurrent index build takes a SHARE lock and may briefly block E2E audit writes for up to the bounded50-second statement window (lock acquisition limited to3seconds). Its client request budget must exceed the SQL timeout plus network overhead; it must not repeat a mutation on an uncertain response. Exact guarded recovery is in `PROPOSED_AUDIT_TENANT_INDEX_RECOVERY.sql`; rehearse create/verify/drop/verify under rollback before a committed creation. No index has been created by this proposal.

Execution update2026-10-24: approved index review/rehearsal/exact removal recovery and committed independent metadata verification all PASS; audit fixture count now uses `Index Only Scan`. No further index is proposed. Multi-profile DELETE exceeded30seconds at the users FK phase; reviewed cleanup now commits only owned child disposal/profile deactivation, then removes each exact owned profile under its own bounded transaction. Those five profile deletions passed. Subsequent tenant cleanup exposed the separate existing Timeline FK/rule conflict below; the index execution is not a claim that fixture recovery is complete.

### 9.3 Exact Timeline recovery boundary — PROPOSED / NOT_AUTHORIZED

**Subsequent direct Owner approval,2026-10-24:** “Duyệt đúng FK E2E và recovery”. This authorizes only the one FK amendment below on the exact E2E project, with review/rehearsal/independent verification/recovery; keep only when bounded PASS. It does not authorize Timeline event mutation, T2, other FKs or Production.

PostgreSQL returns `XX000`: `referential integrity query on "tenants" from constraint "timeline_events_tenant_id_fkey" on "timeline_events" gave unexpected result`. Read-only metadata proves this validated, non-deferrable FK is `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE`, while canonical rule `timeline_events_no_delete` is `ON DELETE ... DO INSTEAD NOTHING`. Tenant DELETE invokes the conflicting cascade even when no owned event was created. No Timeline row has been read or written by this batch; no T2 producer/replay was run.

Current interrupted fixture recovery is bounded and **HELD**, not PASS: zero run-owned Enrollment event records and public profiles remain; all five Auth subjects were deleted and independently return404. Exactly two empty synthetic tenants remain and were set `suspended` by exact UUID/name selectors. Their audit records are synthetic; no existing business rows were touched. Evidence: `E2E_TIMELINE_RECOVERY_BOUNDARY.json`, `E2E_INTERRUPTED_FIXTURE_QUARANTINE.json`. Source MVP is unchanged; Production remains NOT_RUN.

**Minimum proposed owning-scope amendment:** on E2E `bmnbqbcdbuklhopfbopv` only, change exactly `timeline_events_tenant_id_fkey` from `ON DELETE CASCADE` to `ON DELETE RESTRICT`. Preserve columns, referenced key, validation/deferrability, all other FKs, immutable rules, triggers, indexes, table/column ACLs, RLS and every existing row. This prevents deleting a tenant that has Timeline history, instead of attempting to delete that immutable history. It does not implement or certify T2.

Reviewable rollback-default artifacts: `release-e2e-20261024/PROPOSED_TIMELINE_TENANT_FK.sql` and `PROPOSED_TIMELINE_TENANT_FK_RECOVERY.sql`. If authorized, pin full Timeline metadata, independently review exact runner/artifacts, rehearse change/owned empty-tenant deletion under rollback/exact FK recovery, then apply and independently verify before disposing the two owned tenants and final acceptance. Bound lock3seconds and statement30seconds. No constraint/rule disabling, Production, Kernel runtime, broader Timeline capability, commit/push/deploy authority is requested. Keep changed FK only when bounded tests/review/recovery PASS.

Alternative if this FK amendment is declined: preserve the original schema and retain only the two suspended empty tenant fixtures with no Auth/profile authority; record recovery HELD and do not claim full E2E completion. Do not silently reinterpret quarantine as physical disposal.

Independent proposal review: PASS_BOUNDED_PROPOSAL_REVIEW; no execution authority or runtime PASS implied. “Empty” above means no remaining owned MVP rows/public profiles/Enrollment event records, not a claim that Timeline has zero history. No Timeline business rows have been inspected. RESTRICT must refuse deletion if any history exists; do not remove that history to complete cleanup. The FK DDL takes a strong Timeline table lock and validates within the30-second statement/3-second lock limits; timeout/drift holds execution, without disabling rules or using NOT VALID to force success.
