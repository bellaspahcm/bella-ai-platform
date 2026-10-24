# Audit Preschool từ UI tới DB, canonical truth, Platform reuse, RBAC và RLS

Ngày audit: **20-10-2026, Asia/Saigon**. Branch: **`codex/preschool-full-audit-20261020`**. Source: **`339c89250d87964ba8d58860a5ecdbc0bdde4956`**.

**Kết luận: `NOT_READY`. Kiểm soát truy cập DB: `FAIL`. Browser có phiên Auth thật → ghi nghiệp vụ → DB read-back: `BLOCKED`.** Audit đã hoàn tất phần kiểm kê/source trace, test hiện có, browser render và các probe an toàn có thể thực hiện trong môi trường hiện tại. Đây không phải chứng nhận full E2E PASS.

Đã kiểm kê **118 source files: 19 dashboard pages, 1 parent portal page, 20 API route files, 3 API persistence adapters và 75 Product files**. Source inventory có imports, DB/RPC/fetch calls và các default đáng chú ý tại `inventory.json`. Không sửa runtime, policy, migration, credential hoặc business data; không tạo fixture; không commit/push/merge. Chỉ tạo thư mục audit này. `ARCHITECTURE_GATE_RESULT.md` cho phép audit, không cho phép implementation.

Sau `git fetch origin main`, main là `f973dd7e56542aa7847b98c2a4236da86f1eabc3`, khác source audit: **2 commit chỉ trên main / 3 commit chỉ trên branch**. Kết luận dưới đây gắn với source branch đã ghi, không tự chuyển thành kết luận trên main hoặc production.

Đối chiếu content sau fetch không có diff trong các đường Preschool UI/portal/API/Product, Education Kernel và migrations đã so sánh (`provenance.json`). Đây là bằng chứng content tại thời điểm đó, không phải bằng chứng chạy lại trên main. Final check: runtime tracked diff rỗng, `git diff --check` exit0; không phát hiện configured credential values trong các file evidence.

## 1. Phát hiện cần ưu tiên

### F01 — P0: Anonymous đọc được dữ liệu Preschool và nhiều tenant (`CONFIRMED_RUNTIME`)

Dùng public key có claim **`role=anon`**, khác admin key `role=service_role`; **không user JWT, không cookie**. GET chỉ lấy `tenant_id`, không lấy nội dung hồ sơ:

| Bảng | Anonymous GET có filter tenant Preschool | Anonymous GET không filter tenant |
| --- | --- | --- |
| `students` | HTTP 206, 1 hàng mẫu, tổng 186 | 1.098 hàng khả kiến; chỉ lấy mẫu 100 tenant IDs |
| `edu_fin_invoices` | HTTP 206, tổng 28 | 626 hàng khả kiến; mẫu 100 hàng thuộc **61 tenant** |
| `edu_fac_assets` | HTTP 206, tổng 7 | 122 hàng khả kiến; mẫu 100 hàng thuộc **100 tenant** |
| `edu_courses` | HTTP 401 / `42501` | Không thử mở rộng |
| `edu_attendance_daily_state` | HTTP 401 / `42501` | Không thử mở rộng |

Evidence: `anonymous-rls-readback.json`; runner tái chạy được: `verify-rls-readonly.cjs`. Các tenant IDs chỉ được tổng hợp, không lưu giá trị hàng trong evidence.

Đây là **FAIL của invariant anonymous/tenant isolation trên endpoint remote cấu hình trong `.env.local`**. Endpoint đang phục vụ production khách hàng hay không: **NOT_PROVEN**. Không suy ra quyền ghi từ GET. Chưa đọc được `pg_policies`/`relrowsecurity` thật, nên chưa kết luận chính xác policy nào gây ra từng bảng.

Source có cơ chế phù hợp với triệu chứng:

- `supabase/migrations/20260909000059_p73_finance_rls_grant.sql:4`: grant toàn schema public cho `anon`, `authenticated`, `service_role`; dòng 16–23 tạo các policy Finance `FOR ALL USING (true)`.
- `supabase/migrations/20260909000064_p93_facilities_rls_grant.sql:4`: grant toàn schema; dòng 15–21 tạo policy Facilities `FOR ALL USING (true)`.
- `supabase/migrations/20260909000060_p8_staff_scheduling_schema.sql:121`: policies chỉ kiểm `tenant_id IS NOT NULL`; dòng 143 trở đi grant cho cả `anon`.

Migration có `ENABLE ROW LEVEL SECURITY` vẫn không đủ khi predicate cho phép mọi hàng. Source policy là bằng chứng source; kết quả GET bên trên là bằng chứng deployed behavior. Root policy cụ thể của `students` vẫn cần catalog thật.

### F02 — P0: Medication nhận tenant/actor do client cung cấp, dùng privileged client (`CONFIRMED_SOURCE`)

`src/app/api/education/care/medication/route.ts:16` tạo client từ service-role key; dòng 31–45 lấy `tenantId`, `studentId`, `doseOccurrenceId`, `actorId` từ body rồi gọi `MedicationSafetyService.administerDose`. Không có session/role resolver trước lệnh. Service có kiểm trạng thái dose/window/double-dose, nhưng các kiểm tra này không thay thế xác thực người thực hiện.

Mutation trái phép thật: **NOT_RUN** để giữ audit không ghi dữ liệu. Không thể coi các kiểm tra nghiệp vụ dose là RBAC PASS. Owning boundary: Preschool care API/security; không chuyển logic này sang Healthcare frozen Kernel.

### F03 — P1: Courses và Care bulk tin query tenant trước session (`CONFIRMED_SOURCE`, Courses có `CONFIRMED_RUNTIME`)

- `src/app/api/education/courses/route.ts:89`: trả query `tenantId` ngay; GET dòng 123 chọn admin client trước khi resolve tenant. Request local development không cookie/JWT, có tenant query, trả **200 / 8 classrooms** (`anonymous-api.json`).
- `src/app/api/education/care/bulk/route.ts:87`: query tenant cũng được chấp nhận trước session. POST dùng cùng tenant resolver và operation client; payload chứa kết quả sức khỏe do client tính. Write/cross-tenant exploit không được chạy.
- `src/app/api/education/courses/[id]/route.ts:29`: detail cũng có explicit-tenant priority; privileged client của detail có điều kiện dev riêng, không được gộp thành cùng một exploit production đã chứng minh.

Auth/tenant phải được resolve từ nguồn tin cậy trước privileged access. Header dev fallback và user-supplied tenant không chứng minh quyền. Production execution của các đường này: **NOT_PROVEN**, mặc dù source priority ở Courses/Care không bị giới hạn chỉ trong development.

### F04 — P1: AI Copilot dùng client role header không có environment gate (`CONFIRMED_SOURCE_AND_LOCAL_PROBE`)

`src/app/api/education/ai/copilot/route.ts:70`: `x-mock-role` ghi đè role từ `getCurrentUser`; dòng 90 lấy tenant từ query trước user. Header này không nằm trong nhánh `NODE_ENV === development/test`.

Probe **body rỗng**, dừng trước AI execution: anonymous không header trả **403 FORBIDDEN**; thêm role header hợp lệ và tenant query thì đi qua guard, trả **400 INVALID_ACTION**. Evidence: `rbac-invalid-payload-probes.json`. Đây là bằng chứng guard local tin client role; chưa gọi AI, chưa chứng minh production exploit hoặc đọc dữ liệu sản xuất.

### F05 — P1: Phát hành portal token và announcement chưa fail-closed (`CONFIRMED_SOURCE`)

- `src/app/api/education/portal/token/route.ts:25`: user thiếu vẫn dùng tenant mặc định; không có check role; nhận `studentPartyId`/`guardianPartyId` từ body. Có guardian mặc định khi không tìm relationship, rồi ký token. Không phát hành token trong audit.
- `src/products/bella-education/parent-portal/services/preschool-parent-portal.service.ts:206`: signing secret có fallback hardcoded khi env thiếu. Giá trị secret không được chép vào report/evidence. Guard relationship khi **đọc** portal vẫn tồn tại; không vì vậy coi **token issuance** đã được authorize.
- `src/app/api/education/announcements/route.ts:25`: thiếu user vẫn dùng tenant/actor mặc định, sau đó operation client ưu tiên admin; broadcast thread ID cố định, lookup thread chỉ theo ID. Probe body rỗng trả **400 TITLE_REQUIRED**, không trả 401 trước validation; không gửi nội dung thật và không insert.
- `getParentPortalPayload` gọi `fetchChatThreadAndMessages` → `ensureCommunicationThread` (`...service.ts:814`, `849`, `860`), có thể tạo thread trong **GET payload**. Vì vậy chỉ test token sai, không gọi valid-token payload trong audit read-only.

Portal token sai được service từ chối **401 TOKEN_MALFORMED**, UI hiện thông báo không hợp lệ (`browser-portal.json`). Đây là PASS có giới hạn của ca token sai, không chứng minh issuance/session binding hoặc valid-token data scope.

### F06 — P1: Scheduling/Facilities chạy domain mutation ngay trong browser (`CONFIRMED_SOURCE`)

`scheduling/page.tsx:36–62` và `facilities/page.tsx:68–92` là client components tự tạo Supabase client, repository và service; tenant/manager/inspector là constants. Không đi qua API xác thực actor trước các thao tác.

- Scheduling `:162–243`: nút seed xóa bảng theo tenant cố định, ghi ratio policy `5`, lead teacher `1`, số trẻ `10`, phân công staff ID cố định. `:265` duyệt nghỉ bằng manager cố định.
- Facilities `:270–273`: seed xóa maintenance/inspection/out-of-service/exceptions theo tenant cố định. `:415–438`: thao tác tái kiểm định tự gửi **`resultStatus: 'PASS'`**, checklist `passed: true` và inspector cố định.
- `SafetyInspectionService` và `LeaveSubstitutionService` nhận actor/tenant qua input; không có authenticated-role binding ở các entrypoint đang được UI gọi. Guard class có method tương ứng nhưng tồn tại method không chứng minh nó được gọi trên luồng này.

Các nút này không được click. Source xác nhận boundary và dữ liệu do UI quyết định; khả năng ghi deployed và toàn bộ role matrix chưa được kiểm thử.

### F07 — P1: Business truth về sức khỏe được UI tự quyết rồi backend lưu lại (`CONFIRMED_SOURCE`)

`care/page.tsx:220–239` phân loại mức cảnh báo từ nhiệt độ bằng các ngưỡng 37.5/38.2; `:743–784` và `:883–909` tự đặt status/label/isAlert, default nhiệt độ và lý do. POST `:820`, `:927` gửi các kết quả này.

`care/bulk/route.ts:246–257` nhận `health.status`, `health.isAlert`, `health.alertReason`; `:310–347` đưa chúng vào persisted care records, còn có fallback nhiệt độ/nhãn. Không có bước derive lại health severity từ một governed care policy tại boundary này.

`my-class/page.tsx:1510` dùng ngưỡng khác; câu trả lời tư vấn sốt còn nằm ở UI `:917` và Product AI service `:352`. **Không có semantic authority độc lập được xác lập cho các giá trị đó trong audit này: `BUSINESS_SEMANTICS = NOT_PROVEN`.** Đây là quan sát code, không phải hướng dẫn y tế hay đề xuất đổi ngưỡng. Cần owner của Preschool care xác nhận policy; không được tự suy diễn từ code/tests hoặc import Healthcare để sửa.

### F08 — P1: Branch authorization có nguồn riêng, thực hiện sau persistence (`CONFIRMED_SOURCE`)

`PreschoolChainService` reuse `IOrgUnitContract` cho hierarchy, nhưng tự resolve quyền qua `users`/`people_directory`/`org_relationships` (`...preschool-chain.service.ts:191–265`). Không consume canonical runtime access view `user_org_unit_access` như `src/services/beauty-branch-context.ts:110`.

Public `getUserAccessibleUnits` **không phải replacement đã được chứng minh**: `src/platform/org-unit/org-unit.engine.ts:230–249` ghi rõ implementation hiện trả tất cả active units và để IAM thực hiện permission. Chỉ đổi sang method này sẽ không tự giải quyết scope.

Admission `enrollments/route.ts:403–438` đã tạo Party/guardian/Student/enrollment trước `assignEnrollmentToBranch` ở `:439`; `branchId` optional, không có encompassing transaction/compensation trong handler. Thứ tự này khác invariant **resolve context → authorize → mutate**. Không chạy ca ghi/rollback thật.

Migration Chain `20261006010000_preschool_chain_assignments.sql:50–62` chỉ check tenant, chưa check branch/role. Hai relation Chain hiện trả **404 PGRST205** qua admin REST (`anonymous-rls-readback.json`): chính xác là không có trong schema cache endpoint đã kiểm tra; chưa có catalog để khẳng định physical table chắc chắn không tồn tại.

### F09 — P1: UI giữ dữ liệu mẫu như hồ sơ/lớp thật (`CONFIRMED_SOURCE`, một ca có browser proof)

- Course detail khởi tạo `DEFAULT_WORKSPACE` ở `courses/[id]/page.tsx:107`; `:122–130` chỉ đổi khi success, giữ default khi lỗi. Browser UUID không tồn tại nhận API **404** nhưng h1 vẫn là **“Lớp Mầm A1 — Họa Mi — Workspace 360°”** (`browser-routes.json`).
- Teachers list `teachers/page.tsx:101`: `TEACHERS_LIST`, workload/chứng chỉ/status cố định; không gọi workforce API.
- Student detail `enrollments/[id]/page.tsx:676` dùng `CANONICAL_STUDENT_360_MAP` cục bộ; tên biến không làm nó thành canonical DB. `:777` lưu state/localStorage, không ghi contract DB. Với ID lạ browser giữ ID trong nhãn, đây là cải thiện identity so với thay bằng bé khác, nhưng vẫn chưa là hồ sơ canonical.
- Grades `grades/page.tsx:169`, `:1646–1658`: roster/development statuses và KPI tính từ fixtures; không gọi assessment/observation API. Learning `learning/page.tsx:55–90` là dữ liệu minh họa và action chưa kết nối, có thông báo trung thực.
- `my-class/page.tsx:215`, `:590`, `:716`: roster mẫu, điểm danh/bàn giao chỉ đổi local state; luồng handover có backend thật ở Attendance không được UI này consume.

Không gộp tất cả dashboard thành static: overview/report hiện **có** analytics API và Finance/Attendance có canonical reads. Các số liệu mẫu cần phân loại từng field.

### F10 — P2: Architecture PASS có phạm vi hẹp và baseline debt (`CONFIRMED_SOURCE_AND_TEST`)

`bella-education-architecture.test.ts:15–44` chỉ quét `.ts` trong Product root, không quét dashboard `.tsx` và API adapter ngoài root. `:69–95` loại approved baseline signatures. Do đó suite PASS không chứng minh tất cả UI/API tuân thủ boundary, hoặc mọi direct DB access đã bị loại bỏ.

Không sửa guard/baseline để phục vụ audit. Các Product-owned table/repository hợp lệ phải được phân biệt với direct Kernel table access.

## 2. Canonical truth/contract nằm ở đâu, dữ liệu nào chưa reuse?

| Dữ liệu/capability | Owner / nguồn chuẩn cần dùng | Hiện trạng đã quan sát | Kết luận audit |
| --- | --- | --- | --- |
| Party student identity | Platform Party; Education Student public contract | Admission gọi StudentContract nhưng `enrollments/route.ts:196–225` trực tiếp insert `party_parties`; Student360 lại giữ map UI | Canonical ID có reuse một phần; write identity bypass Party public boundary và hồ sơ UI chưa consume nguồn đó |
| Course/enrollment | Education public contracts (`services/enrollment.service.ts:11`, `:55`) | Enrollment gọi Enrollment contract; list/detail API có direct reads; detail UI có default giả | Reuse thật ở enrollment, cần phân biệt sanctioned read models; lỗi fallback/auth tại consumer |
| Attendance/guardian/pickup | Attendance contract + Preschool guardian/handover services | Attendance API/UI có read/write path; My Class tự set local handed-over | Hai luồng không đồng nhất; reuse có sẵn nhưng My Class chưa dùng |
| Tenant/actor/role | Auth + live `users`/tenant status; backend authorization | Work Queue/Finance resolve actor; nhiều API khác dùng query/body/header/default actor | Inconsistent consumption; không lấy sidebar visibility làm RBAC truth |
| Branch scope | Platform Org hierarchy + authorized access source/IAM | Hierarchy contract reused; Product tự traverse quyền; platform accessible-units method chưa enforce branch | PARTIAL reuse; cần owner contract reconciliation, không thay method mù |
| Teacher/workload/certifications | Platform Party/people/workforce và Education assignment contracts | Assignment contract tồn tại; list/detail teacher dùng fixtures/local state | Không reuse canonical teacher read path tại UI; chưa chứng minh generic workforce contract đủ mọi field |
| Care severity/ratio/safety | Approved Preschool-specific policy, server-derived outcomes | UI quyết định health fields, seed ratio, PASS checklist; Product ratio service cũng tự tạo policy fallback | Business semantics chưa proven; logic cần ở owning Product boundary, không phải thêm logic vào Healthcare Kernel |
| Learning/evidence/portfolio | Product Observation/Framework/Milestone services; Assessment contract khi phù hợp | Services đã tồn tại (`learning-development/*`), grades/learning UI chưa wire | Đây là thiếu reuse capability Product/OS, không tự kết luận phải tạo schema/Platform mới |
| Fee/billing/payment/recognition | Preschool fee semantics + Finance public contracts | `tuition-recognition.service.ts:1` reuse `@/platform/finance/contracts`; Finance UI gọi API; RLS underlying invoices vẫn hở | Reuse domain đúng không bù cho DB authorization FAIL |
| Facilities/scheduling/exception projection | Product-specific repositories/bridges; generic Platform capability chỉ khi có approved contract | Product tables và bridges có thật, nhưng chạy trong browser với defaults | Sai trusted execution boundary; chưa tìm đủ bằng chứng để yêu cầu thay toàn bộ bằng generic Platform asset/queue subsystem |
| Dashboard/report | API analytics + canonical aggregates; mẫu phải disclosed | overview/report có analytics; reports công khai WHO/CSAT/month-series chưa có nguồn chuẩn | PARTIAL canonical projection; tên KPI hoặc UI disclosure không chứng minh DB end-to-end |
| Parent access | Verified guardian binding + token policy + session/tenant rules | Portal read có signature/expiry/relationship checks; issuance/fallback secret có gap; parent-daily cố ý 503 | Các guard rời rạc chưa tạo full end-to-end authorization PASS |

**Trả lời trực tiếp:** Có canonical-looking data và business rules nằm trong UI; có dữ liệu/capability không reuse nguồn chuẩn dù capability đã tồn tại. Cũng có Product-local data hợp lệ: không phải bảng `edu_*` nào cũng là duplication Platform. Audit không cấp quyền chuyển ownership hoặc tạo abstraction mới.

## 3. Ma trận phủ UI → API → persistence

Browser desktop development có mock cookie từ existing tenant, không phải Auth thật; chỉ cho phép GET/HEAD/OPTIONS và hai Next actions đọc đã inspect (`getCurrentUser`, `getTenantSettings`). Chặn business writes/theme upgrade/unknown actions; không click seed. 19/19 dashboard route render có h1, 0 uncaught page errors, không phát hiện horizontal overflow ở viewport đã dùng. **Không phải 19/19 business journeys PASS.** API responses có thể hoàn tất sau navigation nên không dùng response timing để chứng minh ownership/data readiness từng route.

| Trang | Đường dữ liệu/action chính | Persistence / hạn chế |
| --- | --- | --- |
| overview | analytics GET, AI POST | Analytics repository có reads; AI client context không tự là canonical truth; write không chạy |
| courses | courses GET/POST | GET có DB; POST intentionally 503; lỗi auth tenant ở GET |
| courses/[id] | detail + teacher assignment API | Invalid ID bị che bởi default workspace; write chưa chạy |
| enrollments | enrollment API + courses/branches | Party → Student → Enrollment + optional Chain; thiếu atomic branch authorization proof |
| enrollments/[id] | UI map + localStorage | Không có canonical profile API call |
| attendance | Attendance API + handover API | Reuse Education/guardian contracts; write/read-back thật chưa chạy |
| care | courses/attendance + care bulk | Có read/write code, severity do UI gửi; RBAC/tenant gap |
| communication | local conversations + AI + portal token | Local UI không chứng minh persisted chat; token issuance gap |
| finance | finance GET/POST | Actor guard có test; DB invoices anonymous exposure FAIL |
| grades | static roster/drafts | Không có persisted Assessment/Observation journey |
| learning | static work queue/forms | Save/publish nói rõ chưa kết nối |
| my-class | static roster/local attendance/handover + AI | Không consume handover contract dù capability tồn tại |
| parent-inbox | parent-daily GET | 503 containment `PARENT_ACCESS_NOT_READY` |
| reports | analytics GET + sample series | Attendance/Finance subset canonical; WHO/CSAT/sample series unproven/disclosed |
| scheduling | browser Product repository/services → `edu_sched_*` | Fixed tenant/staff + broad policy; không thực hiện mutation |
| facilities | browser Product repository/services → `edu_fac_*` | Fixed tenant/inspector/PASS checklist; anonymous data exposure |
| teachers | static list/workload | Không workforce read-back |
| teachers/[id] | static resolver/local edit | ID lạ render generic teacher label; không canonical teacher profile |
| work-queue | guarded GET/POST → Product persistence adapters | Session/admin/product checks có source và 52 API tests; browser response 403 trong selected fixture, không ghi nhận là data PASS |
| portal/education/[token] | signed token → portal API/service/repository | Chỉ test token sai: API 401, UI error visible; valid GET có thể tạo thread nên không chạy |

Role/endpoint detail: `RBAC_RLS_MATRIX.md`. Source calls: `inventory.json`. UI/backend keyword scans là discovery aids, không phải proof độc lập.

## 4. Verification đã chạy

| Kiểm tra | Kết quả thực tế | Ý nghĩa |
| --- | --- | --- |
| `node .../run-checks.cjs education` | Exit 1; **55 suites: 45 pass / 10 fail; 534 tests: 450 pass / 84 fail** | Supabase URLs/keys đã force mock, DB URL loopback port 1; không đưa production credentials vào Jest. Không phải Real DB PASS |
| Education architecture/customization/sandbox trong run trên | **3 suites / 7 tests PASS** | Phạm vi/baseline như F10 |
| Education conformance/customization/extensions trong run trên | **3 suites / 23 tests PASS** | Contract/mock evidence, không authenticated DB |
| `npm run healthcare:verify` qua runner | Exit 1; guard PASS; architecture **2 suites / 9 tests PASS**; conformance **1 suite / 7 tests PASS** | Gate 11 chưa PASS |
| Healthcare Kernel stage | **61 suites: 39 pass / 18 fail / 4 skipped; 530 tests: 374 pass / 151 fail / 5 skipped** | DB-dependent tests thiếu real environment; fetch errors/hook timeouts và cleanup cascades. Không quy thành Product regression |
| `node .../preflight.cjs` | Postgres catalog BLOCKED: **28P01** | Không có quyền catalog/RLS policy read-back thật qua URL hiện có |
| Docker inventory | Docker daemon pipe unavailable | Chưa có local isolated DB đang hoạt động |
| `node .../runtime-read.cjs` | 19 dashboard routes + anonymous GET API probes thực chạy | UI render/read only, dev mock session |
| `node .../browser-portal-read.cjs` | Token sai: API401 + visible UI error | Negative token case only |
| `node .../verify-rls-readonly.cjs` | Anonymous GET lộ rows/cross-tenant | Security FAIL thật trên configured remote |

Test failure classification: các DB-dependent Education suites có `ENVIRONMENT`/timeout/seed-failure cascades do offline target; `p32-classroom-field-e2e.integration.test.ts` còn kỳ vọng Course POST200 trong khi handler đã containment503 (`CONTRACT_DRIFT` của expectation, không mở containment để làm test xanh). `preschool-enrollment-operational.integration.test.ts` expected201 nhận500 trong offline fixture. Raw outcomes vẫn là FAIL; không biến timeout, skip hoặc mock thành PASS.

File-level counts tại `test-matrix.json`; raw logs và Jest JSON giữ actual assertions. Không rerun để thay kỳ vọng hoặc làm xanh. Typecheck/build/lint toàn Product không chạy; đây là audit/docs-only, không có implementation diff cần kiểm kiểu. Các gate sản phẩm thiếu proof vẫn giữ NOT_PROVEN.

## 5. 11 Education gates

| Gate | Trạng thái audit | Evidence / thiếu gì |
| --- | --- | --- |
| 1 Architecture compliance | PARTIAL: scoped suite PASS | UI/API trust-boundary findings ngoài guard root; không global PASS |
| 2 Contract boundary | PARTIAL / NOT_PROVEN end-to-end | Enrollment/Attendance public contracts có source/mock tests; trực tiếp identity/Kernel reads và browser domain services cần owner reconciliation |
| 3 Tenant isolation | **FAIL** | Anonymous cross-tenant Finance/Facilities; role/branch authenticated matrix chưa đủ |
| 4 RLS & authorization | **FAIL**, catalog BLOCKED | Runtime anonymous leak, source auth gaps; pg catalog28P01; không có real Auth sessions đủ roles |
| 5 Migration safety | NOT_APPLICABLE cho audit change; deployed safety NOT_PROVEN | Không migration mới; broad grants/policies trong lịch sử có finding; không apply/restore migration |
| 6 Event-after-persistence | NOT_PROVEN runtime | Không chạy mutation/rollback/outbox workflow thật |
| 7 Academic safety routing | PARTIAL | Mock prerequisite contract tests; UI grades/learning và governed policy chưa end-to-end |
| 8 Temporal provenance | NOT_PROVEN | DB-dependent suites fail environment; không historical read-back |
| 9 Rule governance | NOT_PROVEN | Không live rule/checksum proof; UI health/ratio defaults chưa có semantic authority |
| 10 Audit integrity | PARTIAL / NOT_PROVEN real DB | Scoped mock/conformance assertions không chứng minh persisted signed evidence xuyên suốt |
| 11 Platform regression | **FAIL raw / environment-obstructed** | Healthcare stage counts ở trên; skips/timeouts không PASS |

## 6. Enforcement và giới hạn kết luận

- Healthcare guard đã chạy PASS. Education static guard đã chạy trong 3 suites scoped nói trên; approved baselines vẫn có debt.
- `.claude/settings.json` hiện chỉ bật project MCP servers, không có PreToolUse hook trong file này. Không kết luận mọi tool/host khác không có hook, cũng không coi hook Claude đang enforce Codex.
- `git config --show-origin --get core.hooksPath` trả `.husky/_`; `.husky/pre-commit` gọi `scripts/architecture/git-pre-commit-guard.js`. Không commit nên không có bằng chứng hook đã chạy cho patch này.
- CI workflow có Education compliance theo scope và Real DB job yêu cầu isolated E2E credentials; audit branch chưa push, không có fresh CI run. Required-check/branch-protection live state không được xác minh.
- DB credentials/URL hiện có không đủ PostgreSQL login. Target API `.env.local` khác `.env.production` cấu hình đã đọc; điều này **không chứng minh** production đang dùng endpoint nào hoặc target này đủ điều kiện fixture writes.
- Source branch khác main đã fetch; production artifact revision, valid Auth browser, complete role×tenant×branch matrix, DB write/read-back/cleanup, backup/restore, production integrity và Go-Live đều **NOT_PROVEN/BLOCKED theo lý do cụ thể**.
- Browser attempt 1 chặn mọi POST nên chặn cả read-only server actions; được phân loại `INVALID_HARNESS`. Lệnh dừng process không match process bên dưới; attempt1 kết thúc muộn và ghi đè file final chung sau attempt2. Đã giữ riêng output không hợp lệ tại `browser-invalid-harness-routes.json`, khôi phục final từ incremental snapshot của attempt2 (đủ 19 route, terminal completion corroborates) mà không sửa các per-route records. Cả hai run đã kết thúc. Không dùng blank shells attempt1 làm Product defect.

## 7. Handoff cho remediation riêng

1. **P0 security owner:** xác định deployed environment đang bị ảnh hưởng; lấy read-only catalog/grants/policy truth; sửa anonymous/tenant/role access ở đúng ownership bằng migration đã được approve và deny/allow real-session proof. Không chỉ vá UI/API trong khi DB vẫn hở.
2. **P0/P1 Product API owner:** session/actor/tenant fail-closed cho medication, token issuance, announcements, Courses/Care; bỏ client role override ngoài test adapter; bind guardian/branch ownership trước mọi mutation. Giữ Course POST và Parent Daily 503 cho đến khi owning capability được chứng minh.
3. **Product semantics owner:** chốt nguồn chuẩn health severity/ratio/inspection policy. Chưa có semantic evidence thì giữ `BUSINESS_SEMANTICS = NOT_PROVEN`, không phát minh ngưỡng hoặc đổi frozen kernels.
4. **Platform/Product identity & branch owners:** thống nhất Party write boundary và access source; giải quyết atomic admission/branch assignment. `getUserAccessibleUnits` hiện không đủ để tự chứng minh quyền.
5. **Product UI owner:** wire read models/handovers/observations/workforce đã có, loại fallback hồ sơ mẫu/false persistence; giữ label chưa hỗ trợ ở capability gap.
6. **QA:** khi có isolated DB + real Auth roles + schema đúng, chạy browser business mutation → independent DB read-back → negative role/tenant/branch → cleanup, rồi các gate đầy đủ. Chưa có điều kiện này không thể seal full E2E.

Không có remediation nào trong danh sách này đã được implement bởi audit.
