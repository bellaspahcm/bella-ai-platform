# Batch2B — RPC production đã sửa; Courses source đã sửa; identity còn giới hạn phạm vi

Ngày **2026-10-21, Asia/Saigon**. Source `codex/preschool-full-audit-20261020@339c89250d87964ba8d58860a5ecdbc0bdde4956` cộng working diff đúng Courses và một migration RPC. Target Supabase `lvnvkpyxtuilhrabtlwv`; Vercel production vẫn `main@f973dd7e56542aa7847b98c2a4236da86f1eabc3`, deployment `dpl_9FQrTej4gajN95v6MwLJ31f3pUTQ`.

**Chưa hoàn tất full RBAC/RLS.** RPC client execution đã đóng trên production và xác minh lại. Courses bỏ bypass trong source, qua tests/typecheck/lint và local HTTP; code chưa commit/push/deploy. Shared identity ngoài allowlist32 cần scope riêng đã được chuẩn bị cụ thể.

| Field | Trạng thái | Giới hạn |
| --- | --- | --- |
| `PRODUCTION_CHANGE` | **PASS** | Chỉ RPC EXECUTE delta; exit0, exact live postconditions và role probes |
| `ANONYMOUS_CONTAINMENT` | **PASS** | Đúng32 bảng + RPC: 96/96 REST requests bị chặn; không phải toàn bộ API production |
| `AUTHENTICATED_ACCESS_REGRESSION` | **NOT_PROVEN** | Authenticated RPC cố ý bị thu quyền; real-user browser/business workflow chưa chạy |
| `BATCH2B_RBAC_RLS` | **IN_PROGRESS** | API source và RPC hoàn thành phạm vi nhỏ; mutable identity/read-role matrix còn mở |
| `PRESCHOOL_GO_LIVE` | **NOT_READY** | Không được suy từ unit tests, ACL hay migration |

## Thay đổi production đã thực thi

Owner yêu cầu `fix chuẩn đi` sau Batch2A; RPC EXECUTE boundary có authority riêng từ trước. Fresh target/source/catalog kiểm tra trước execution vẫn khớp. Không mở rộng bảng.

Transaction commit lúc `2026-10-21T03:20:26.842+07:00`, artifact `EXECUTE_RPC_MAINTENANCE_ONLY.sql`, SHA256 **`68ab41b7fc4088914012d5781f982f07aeefe7296ead54ea6a5ded3f155a7d7e`**. Chỉ revoke29 explicit grants đã chuyển từ PUBLIC ở Batch2A; giữ grant gốc `postgres`, `service_role`, `bella_migration_executor` và inherent superuser. Không đổi body, role flags/membership, table ACL, policies, helpers, schema/default ACL hay business rows.

Source canonical: live function comment xác định helper chỉ cho service-role migration scripts; original `supabase/migrations/archive/RUN_THIS_IN_SUPABASE_DASHBOARD.sql:29` grant service-role và comment không expose client. Giữ client/authenticated grants ở Batch2A là bảo toàn compatibility theo authority cũ; Batch2B chủ ý đóng chúng.

- Isolated rehearsal **9/9 PASS**, gồm fail-before/partial/full revoke, exact COMMIT, actual denial30 roles, positive4 principals, recovery exact prestate,32 tables unchanged.
- Production command exit **0**; exact expected combined catalog được đọc lại và so sánh độc lập.
- Actual SQL role probes: authenticated và anon gọi constant `SELECT 1` qua RPC nhận `42501`; service-role vẫn chạy. Không real user JWT, không business DML.
- Independent HTTP: anonymous RPC **401/42501**, service RPC **204**; **96/96** anonymous reads trên32 bảng denied; service reads32/32 vẫn200.
- Outside catalog hash không đổi:2,642 relations ngoài allowlist, all policies, other functions, roles (trừ expiry CLI tạm thời không dùng hash), full memberships, schema/default ACL.

Evidence: `execution-preconditions.json`, `production-execution*.json`, `production-execution-stderr.log`, `post-verification.json`, `post-catalog-cli.json`, `role-probes-cli.json`, `outside-{pre,post}-cli.json`, `http-after.json`.

Repo migration `supabase/migrations/20261021030000_restrict_exec_sql_client_execution.sql` giữ sửa qua future replay; không grant quyền mới, xử lý function/role thiếu. Đã replay2 lần trên poststate và một lần từ exact approved prestate; kiểm tra unknown direct grant và inherited maintenance path đều abort/rollback. Exact catalog sau test không đổi. Không chạy migration history production hay toàn bộ migrations; production dùng artifact precondition đã rehearse. Migration version chưa được đăng ký vào production history bởi task này.

## Courses source đã sửa

List và detail dùng `request-context.ts`: validate Auth trước profile; profile phải active và cùng Auth subject; tenant selector (kể cả duplicate) không được chuyển tenant; query đi qua session client/RLS. Đã bỏ admin factory, mock-email/default tenant fallback; teacher Party lookup có tenant filter; API dynamic và no-store. Classroom mapping và POST503 giữ nguyên.

**Verification:**

| Kiểm tra | Actual result |
| --- | --- |
| Focused Jest list/detail/context | **2 suites /24 tests PASS**, exit0; projection tests cũ giữ |
| ESLint5 API/test files | exit0; chỉ warning `.eslintignore` cũ |
| Education TypeScript scope | **0 diagnostics**, exit0; TS2339 status mới được sửa bằng narrowing ở adapter, không đổi shared types/baseline |
| Actual Next HTTP local | **4/4 PASS**: list/detail plain và spoof tenant/mock headers đều401, không payload business |
| `education:verify` | exit1: architecture3 suites/7 tests PASS; conformance2 passed/6 failed suites,14 passed/32 failed tests; DB-dependent failures ở offline localhost. Hai customization/extension conformance stages sau đó không chạy vì chain dừng |
| `healthcare:verify` | guardPASS; architecture2 suites/9 tests PASS; conformance1 suite/7 tests PASS; kernel39 passed/21 failed/1 skipped suites,375 passed/154 failed/1 skipped tests; exit1, DB-dependent/cascade failures trong offline setup |
| Independent reviewers | **COMPLETED** sau retry: Blind không tìm introduced defect; Edge và Acceptance tìm2 migration defects, đã patch và re-review xác nhận đóng. Initial quota errors giữ nguyên lịch sử |

Các broad tests dùng process-scoped endpoint offline và synthetic keys để không seed/write production. Không đổi tests/guard/baseline để đạt green. Raw logs/result files giữ actual counters và exits. Gate rộng chưa PASS, không có full regression/merge/Go-Live seal.

**Production Courses vẫn200/8 classrooms** do patch chưa deploy; HTTP đã xác minh lại trong `http-after.json`. Không được trình bày source/local fix như production API fix.

## Blocker của full RLS đã được chứng minh

Live `identity-boundary-cli.json`: users có authenticated UPDATE các authority fields và self ALL policy; không column protection. Trigger chỉ audit, updated_at và copy role/tenant sang Auth metadata. `get_auth_tenant_id()` đọc live users nhưng không bảo vệ nguồn đó.

Local synthetic reproduction (`identity-local-proof.json`, exit0): tự sửa role/tenant/email/status được self-policy cho phép; helper chuyển tenant và claims-sync cập nhật Auth metadata. Rollback các probe; không thử exploit/ghi production. Full deployed constraints/policies khác không được clone, nên đây là proof cơ chế cô lập + live metadata, không phải real-user production exploit.

Vì nguồn authority còn mutable, không thể gọi một tenant-fence dựa trên nó là RLS an toàn. Chưa tìm được canonical read-role/guardian/branch matrix Courses; không tự dùng Finance role matrix hoặc UI roles.

## Việc tiếp theo đã chuẩn bị, chưa thực thi

`SHARED_IDENTITY_NEXT_CHANGE.md` và `PROPOSED_USERS_DIRECT_WRITE_CONTAINMENT.sql` trình bày scope đúng **một bảng bổ sung `public.users`** và shared privileged user-writers liên quan. Proposal SQL ROLLBACK-only; không được chạy như migration. Cần khóa authority mutation kể cả INSERT/DELETE/TRUNCATE và chặn service-role writer thiếu guard, giữ ordinary edits chỉ khi writable-field contract đã rõ.

Đây vượt giới hạn32 bảng Owner đặt nên chưa sửa production/shared code. Cần authority riêng cho identity scope và rollout Courses code; không yêu cầu duyệt lại RPC/32 bảng đã hoàn thành. Giữ nguyên anonymous containment; không cấp lại quyền để Scheduling/Facilities hoạt động.

No commit/push/deploy/merge. Local Next và PostgreSQL do task tạo đã dừng; dữ liệu local chỉ metadata/synthetic fixtures. Original audit/Batch1/Batch2A evidence được giữ nguyên. Secrets và business-row contents không nằm trong evidence.
