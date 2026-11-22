# Bella Interior: khắc phục bảo mật và bằng chứng cô lập — 2026-11-21

**Security sign-off: NOT READY. Production runtime: NOT PROVEN.** Tài liệu này ghi lại bằng chứng của lượt khắc phục CRM và O4; không xác nhận an toàn toàn bộ Bella Interior hay trạng thái đang triển khai Production.

## Phạm vi và thay đổi

- CRM: tách action read/create/update/delete cho customer, contact, address; thêm kiểm tra action trong RLS và bảo vệ các RPC tạo mã/gộp khách hàng. Tenant vẫn được xác định từ actor hiện hành.
- O4: tách action campaign/session/note/evidence/approval; loại quyền client ghi trực tiếp các cột quyết định phê duyệt; bổ sung RPC quyết định có kiểm tra actor, tenant, permission và trạng thái, cùng audit trail trong cùng transaction.
- Evidence: giới hạn request và file 10 MiB, kiểm tra chữ ký loại file, server xác định bucket private và đường dẫn, kiểm tra quyền và quan hệ session/note. Metadata chỉ ghi qua RPC dành cho service role.
- `proxyClientMaxBodySize` trong `next.config.ts` áp dụng cho cấu hình Next.js chung để đủ chỗ cho JSON base64 của file 10 MiB. Đây là thay đổi có phạm vi ngoài Interior; chưa kiểm thử ảnh hưởng lên các route/product khác và cần rà trước rollout.
- Các thay đổi thuộc Product Interior, các API Interior và migration liên quan; không sửa kernel được bảo vệ. Migration additive `20261121000050_bella_interior_crm_o4_action_hardening.sql` đã áp dụng cho project cô lập `bella-spa-erp-e2e` (`bmnbqbcdbuklhopfbopv`). Version source đã căn theo ledger của project này. Chưa áp dụng cho Production.

## Phát hiện và trạng thái

| Phát hiện | Trước khắc phục, trong phạm vi đã kiểm tra | Sau khắc phục |
| --- | --- | --- |
| P1 — CRM action authorization | Trên DB E2E, contact/address có quyền CRUD rộng và policy cho phép theo tenant mà chưa kiểm tra action. Tenant isolation đơn thuần không chứng minh role authorization. | Source và DB E2E đã gia cố. SQL mô phỏng và PostgREST trực tiếp đã kiểm tra customer với các actor khác quyền và hai tenant; contact/address chưa được kiểm thử riêng qua REST. |
| P1 — O4 approval integrity | Trên DB E2E, authenticated có quyền cập nhật session và một số cột approval nhạy cảm. | SQL mô phỏng và PostgREST từ chối ghi trực tiếp trạng thái và actor phê duyệt; actor được cấp quyền duyệt thành công qua RPC và tạo một dòng audit. REST trả 400 cho actor không có quyền; probe lần chạy chỉ kiểm tra mã 4xx, còn SQL mô phỏng xác nhận lý do permission. |
| P2 — permission mapping | Thiếu action riêng cho các API CRM và O4 trong scope. | Đã bổ sung mapping và regression test; việc gán quyền và hành vi với mọi role thực tế chưa được kiểm thử qua HTTP. |
| P2 — evidence upload | Cần giới hạn body và ngăn client chọn vị trí lưu trữ. | Route và DB đã gia cố; test route dùng mock và SQL mô phỏng đã chạy. Chưa xác minh upload thực qua HTTP và Storage E2E. |
| Cần quyết định — link duyệt công khai | Các hàm đọc customer approval, handover và addendum tra theo ID/token nhưng không lọc `expires_at`; hạn chỉ ảnh hưởng `canRespond`. Một người còn giữ token có thể tiếp tục đọc dữ liệu sau hạn theo logic source. | Chưa thay đổi: cần xác nhận chính sách thời hạn đọc và kiểm thử luồng khách hàng trước khi thay đổi hợp đồng. Không suy ra đã xảy ra lộ dữ liệu. |

Các hàm đọc link công khai được định nghĩa tại `20261113165251_interior_commercial_transaction_engine.sql`, `20261114120000_interior_customer_evidenced_handover.sql`, và `20261114120200_interior_contract_addendum_customer_approval.sql`. Các hàm dùng capability token; kiểm tra source không chứng minh toàn bộ vòng đời token hoặc cấu hình runtime.

## Bằng chứng kiểm tra

- Trên DB E2E riêng biệt, kiểm tra catalog sau migration xác nhận policy tenant dạng restrictive cho O4, chặn quyền authenticated ghi trực tiếp evidence và các cột approval, bucket `interior-site-evidence` private với giới hạn 10 MiB. Contact/address vẫn có một số GRANT ở cấp bảng và dựa vào action RLS; không được mô tả là đã loại toàn bộ GRANT ghi.
- SQL chạy bằng danh tính tổng hợp và `SET LOCAL ROLE authenticated`, với JWT claims mô phỏng, trong transaction được rollback. Đã quan sát: admin cùng tenant đọc CRM; PM không có CRM action không đọc/tạo/sửa/xóa; tenant B không đọc customer tenant A; claim tenant giả không đổi tenant của actor; actor có quyền phê duyệt thành công và audit ghi đúng actor; actor không có quyền bị RPC từ chối; ghi trực tiếp approval/evidence và Storage object bị từ chối. Đây là kiểm chứng Postgres/RLS với role mô phỏng, không phải HTTP PostgREST hoặc JWT được Auth phát hành.
- Sau đó, năm tài khoản tổng hợp đã đăng nhập Auth E2E và chạy 12 tình huống HTTP trong `interior-security-e2e-http-probe.cjs`: admin và actor chỉ đọc xem customer; actor thiếu quyền không đọc/tạo; actor chỉ đọc không sửa/xóa; owner tenant B không đọc tenant A dù gửi header giả; chặn ghi trực tiếp hai cột approval; RPC từ chối admin không có quyền và chấp nhận PM có quyền; Storage từ chối PDF được upload trực tiếp vào đường dẫn tenant khác. Với UPDATE/DELETE bị RLS lọc, HTTP 200 và mảng rỗng được xác nhận bằng truy vấn DB rằng customer gốc vẫn nguyên vẹn. Sau RPC, DB xác nhận trạng thái APPROVED và một dòng audit đúng actor. Lần chạy trả 12 PASS theo điều kiện probe lúc đó; phép RPC bị từ chối mới chỉ xác định 4xx qua HTTP, chưa xác nhận nội dung lỗi. Probe đã được siết để yêu cầu đúng mã lỗi ở lần chạy sau.
- Fixture HTTP gồm hai tenant và năm tài khoản tạm đã được xóa. Truy vấn sau dọn dẹp xác nhận không còn auth user, profile, tenant, customer, session, approval audit hoặc object của fixture. Không dùng account hay dữ liệu Production.
- Test route dùng mock kiểm tra từ chối header giả danh, từ chối upload khi thiếu permission hoặc Content-Length quá lớn, và bỏ qua actor/tenant/bucket/path do client cung cấp. Test mock không chứng minh upload hoặc Auth thật.
- Regression: `npx jest src/products/bella-interior --runInBand --testPathIgnorePatterns='real-production-runtime-verification.test.ts|commercial-customer-real-db.test.ts'`: **63/63 suite, 718/718 test PASS**. Các biến URL Supabase được ghim vào loopback và key placeholder. Hai suite trên bị loại: một suite nhắm runtime Production; suite real DB yêu cầu cấu hình credential E2E riêng. Không xem kết quả này là full integration.
- `npx tsc --noEmit --pretty false`: PASS. ESLint cho các file TypeScript/config đã sửa: PASS, có cảnh báo cấu hình `.eslintignore` cũ. `git diff --check`: PASS.
- Script HTTP được lưu cùng báo cáo, nhận key và fixture qua stdin, không chứa credential. Tạo và dọn fixture hiện thực hiện bằng SQL trong phiên; chưa có harness độc lập dựng lại toàn bộ fixture.

## Điều kiện còn thiếu để đánh giá sign-off

1. Tạo harness fixture E2E có thể chạy lại, kiểm tra nội dung lỗi RPC không có quyền; mở rộng **Application API và Supabase REST/Data API trực tiếp** cho contact/address, các action O4 còn lại, giả actor và tenant, cùng scope project/branch.
2. Kiểm thử upload thực qua HTTP và Storage với file quá giới hạn, nội dung không hợp lệ, đường dẫn/bucket giả và các actor khác quyền; xác nhận cleanup khi metadata thất bại.
3. Kiểm thử tích hợp và regression thực cho CRM, O4 và các luồng Interior liên quan bằng dữ liệu giả trên DB cô lập; đối soát các RPC/Storage policy khác trong phạm vi sản phẩm và quyết định chính sách link hết hạn.
4. Đối soát migration và trạng thái Production theo quy trình riêng khi được cấp quyền. Không được suy từ kết quả E2E rằng Production đã được sửa, đang bị khai thác hoặc sẵn sàng triển khai.

Không có commit, push, triển khai hay thay đổi Production trong lượt này.

## Tiếp tục audit — 2026-11-21 (READ ONLY)

Không sửa source, migration, cấu hình hoặc fixture trong lượt audit tiếp nối. Không chạy probe có thao tác ghi.

### Trạng thái hiện tại

- Checkout đang ở `codex/interior-theme-contrast-20261120`, HEAD `09d40bc18`; nhóm security remediation vẫn là thay đổi local chưa commit.
- Project Supabase cô lập `bella-spa-erp-e2e` hiện `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.127. Ledger hiện có `20261121000050` và `20261121062202`; đây không phải bằng chứng về Production.
- Catalog hiện tại xác nhận CRM/O4 tables đã bật RLS. `anon` không có quyền bảng trên các bảng được kiểm tra. Các quyền `authenticated` cho approval status/actor, evidence metadata và timestamp cập nhật bị thu hẹp; acceptance approval và metadata evidence đi qua RPC kiểm tra quyền.
- E2E bucket `interior-site-evidence` là private, giới hạn 10 MiB và MIME allowlist khớp migration. FK ghép trên contact/address `(tenant_id, customer_id) -> interior_customers(tenant_id,id)` ngăn liên kết customer khác tenant.
- Role-permission matrix trong DB đã có action CRM/O4 cho OWNER, ADMIN, SALES, PM, QC và các role đọc. Matrix xác nhận cấu hình hiện tại, chưa thay thế kiểm thử HTTP theo từng role và scope.

### Phát hiện bổ sung

| Phát hiện | Bằng chứng và phân loại |
| --- | --- |
| P2 — Có thể giả mạo thời điểm tạo qua direct Data API | E2E catalog cho thấy `authenticated` có INSERT privilege trên toàn bộ cột contact/address và acceptance campaign; `created_at`/`updated_at` có default nhưng caller vẫn có privilege INSERT trên các cột đó. Contact/address chỉ có trigger `BEFORE UPDATE`; campaign không có trigger thời gian. Vì vậy role có action tạo phù hợp có khả năng gửi timestamp tùy ý qua direct REST. Chưa thực hiện POST để chứng minh hành vi runtime trong audit-only. |
| P2 — Cờ primary/default chưa được DB bảo vệ | `is_primary` và `is_default` có INSERT privilege cho `authenticated`; hiện không có unique partial index cho mỗi customer. Repository tự bỏ cờ cũ khi tạo contact/address, nhưng direct Data API không chạy logic repository. Việc tạo nhiều primary/default qua REST là suy luận mạnh từ quyền và schema; chưa gửi request ghi để chứng minh. |
| Cần rà quyền — trigger function SECURITY DEFINER có EXECUTE qua PUBLIC | Supabase Security Advisor cảnh báo `interior_prevent_customer_hard_delete()`. Catalog cho ACL `{=X/postgres,...}`; hàm `RETURNS trigger`, được tạo ở migration CRM persistence cũ và không được migration hardening mới thu hồi. Chưa gọi RPC; chưa chứng minh PostgREST cho phép gọi trực tiếp trigger function hay có ảnh hưởng dữ liệu. |
| Advisor INFO — audit table không có policy | `interior_acceptance_approval_audit` bật RLS nhưng không có policy; catalog cho thấy anon/authenticated không có quyền bảng. Đây phù hợp với đường ghi/đọc service-only trong migration, không phải bằng chứng rò rỉ. |

### Phạm vi toàn ứng dụng và phần chưa chứng minh

- `proxyClientMaxBodySize=14112088` cho phép request JSON base64 chứa file 10 MiB. Next.js 16.4.3 guide xác nhận Proxy buffer body tới giới hạn theo từng request; `src/proxy.ts` matcher bao phủ gần như mọi route ứng dụng. Tác động cấu hình vì vậy rộng hơn Interior và cần xem xét tải bộ nhớ đồng thời trước rollout; chưa đo trên các product khác.
- Ba luồng customer approval, addendum và handover vẫn trả nội dung khi capability ID/token còn khớp sau thời hạn; `canRespond` trở thành false. Đây là hành vi source đã xác nhận, nhưng chính sách thời hạn đọc chưa được chủ nghiệp vụ quyết định nên chưa phân loại thành lỗi đã chứng minh.
- Direct HTTP/PostgREST matrix cho contact/address và các action O4, upload thật qua Storage, fixture harness chạy lại được, và trạng thái schema Production vẫn `NOT_PROVEN`. Probe mở rộng có thao tác ghi fixture nên không chạy trong phạm vi audit-only.

**Kết luận tiếp nối:** security sign-off vẫn `NOT READY`; Production runtime vẫn `NOT PROVEN`. Phát hiện về timestamp và primary/default cần implementation/DB verification riêng theo đúng quyền; không có Production hoặc E2E mutation trong lượt audit này.

## Production Read-only Preflight — 2026-11-21 (READ ONLY)

Thực hiện bằng Supabase MCP trên DB ref `lvnvkpyxtuilhrabtlwv`, chỉ chạy các truy vấn `SELECT` và advisory read. Không áp dụng migration, gọi RPC, gửi request REST/Storage, sửa dữ liệu hay chạy test.

### Nhận diện đích và đối chiếu ledger

- Supabase trả project `bellaspahcm's Project`, ref `lvnvkpyxtuilhrabtlwv`, trạng thái `ACTIVE_HEALTHY`, region `ap-southeast-1`, PostgreSQL `17.6.1.121`. Migration headers/scripts Production và tên hai bản snapshot trong repo cũng ghi ref này. Đây là Production DB được tài liệu repo corroborate mạnh; chưa xác minh runtime Vercel đang trỏ đúng ref.
- Cấu hình local có lệch: `.env.production` dùng host `bella-erp-prod.supabase.co`, không ánh xạ tới ref này qua dữ liệu Supabase đang kết nối; `.env.production.local` URL trống; `.env.local` và `.env.test` lại trỏ `lvnvkpyxtuilhrabtlwv`; `.env.e2e` trỏ riêng `bmnbqbcdbuklhopfbopv`. Không chạy test dùng `.env.test` trước khi sửa/đặt guard an toàn.
- Ledger Production có **491 migrations**, mới nhất `20261120130000_interior_crm_security_invoker_and_actor_grants`. Không có `20261121000050` hoặc `20261121062202`; hai version này hiện chỉ được thấy trong ledger E2E. Không suy đồng nhất ledger hai project.

### Schema, RLS, grants và quyền theo action

- Các bảng `interior_customers`, contacts, addresses và O4 campaign/session/note/evidence đều bật RLS. RLS không bị `FORCE`.
- CRM customer có policy permissive `true` cho SELECT/INSERT/UPDATE; contact/address có policy permissive `true` cho CRUD. Cả nhóm cộng restrictive guard theo `interior_actor_tenant()`, nhưng catalog hiện không bắt action permission cho actor cùng tenant. `authenticated` có table grants CRUD trên contact/address và SELECT/INSERT/UPDATE trên customer.
- O4 campaign/session/note/evidence chỉ có policy permissive tenant isolation. `authenticated` có SELECT/INSERT/UPDATE cho campaign, session, note; evidence metadata có SELECT/INSERT. Không có policy riêng kiểm tra action/role trong các policy đang áp dụng. `interior_acceptance_sessions.approval_status` tồn tại; quyền UPDATE cấp toàn bảng nên vẫn ghi được cột đó qua Data API nếu RLS tenant cho phép. Đây là bypass role/action ở tầng DB đã được catalog xác nhận; chưa gửi HTTP request Production để xác nhận mã phản hồi.
- Các bảng permission/delegation/audit được Security Advisor nêu là RLS-without-policy đều không có SELECT hoặc write grant cho `anon`/`authenticated` trong kiểm tra trực tiếp. Advisor INFO này tự nó không chứng minh lộ dữ liệu.
- FK ghép contact/address `(tenant_id, customer_id) -> interior_customers(tenant_id,id)` đang tồn tại, giữ liên kết customer trong cùng tenant.

### Dữ liệu và integrity

- Production CRM/O4 hiện có 0 customers, contacts, addresses, campaigns, sessions, notes và evidence metadata; có 0 nhóm primary/default bị trùng và 0 timestamp null trong các bảng được đếm.
- Tuy nhiên các bảng Interior khác có **6 projects, 3 BOQs, 2 quotations, 2 contracts, 2 customer approvals và 1 handover request**. Cả 6 projects có trường tên khách hàng, điện thoại và địa chỉ site. Không đọc giá trị từng dòng.
- `created_at`/`updated_at` có default `statement_timestamp()`, nhưng authenticated có INSERT privilege trên các cột timestamp của contact/address/campaign; không thấy trigger INSERT/UPDATE trên contact/address/campaign/session/note/evidence. Các bảng contact/address chỉ có index PK và index tra cứu tenant/customer; chưa có unique partial index cho `is_primary` hoặc `is_default`. Với dữ liệu hiện tại, kiểm tra trước tạo index đếm được 0 duplicate; không có ghi dữ liệu để chứng minh direct REST.

### RPC, Storage và advisors

- Bucket `interior-site-evidence` **chưa tồn tại**; bảng `interior_acceptance_approval_audit` cũng chưa có. Bucket Interior hiện có là `interior-customer-signatures`, private, giới hạn 5 MiB, MIME PDF/JPEG/PNG. Migration `20261121000050` có preflight ném lỗi nếu evidence bucket thiếu, nên nguyên migration hiện **không tương thích trạng thái Production** và sẽ abort trước các thay đổi trong transaction. Chưa tạo bucket hoặc thay Storage policy.
- Ba RPC đọc approval/addendum/handover nhận ID và capability token, nhưng đọc record không lọc hạn `expires_at`; hạn chỉ đặt `canRespond=false`, vì vậy nội dung vẫn được trả nếu token khớp sau hạn. RPC transition approval có kiểm tra `status='pending'` và `expires_at > now`. Chính sách đọc sau hạn vẫn cần chủ nghiệp vụ quyết định.
- `interior_prevent_customer_hard_delete()` là SECURITY DEFINER, có EXECUTE qua PUBLIC và Security Advisor cảnh báo; đồng thời nó là trigger function `RETURNS trigger` đang gắn `BEFORE DELETE` cho customer. Chưa chứng minh endpoint RPC gọi trực tiếp hàm trigger được hay gây ảnh hưởng; không gọi thử trên Production.
- Security Advisor nêu 9 Interior table RLS-without-policy (đã xác minh không có quyền anon/auth), 5 anon SECURITY DEFINER RPC (gồm 3 capability reads, 1 token-gated transition và trigger function trên), và 67 authenticated SECURITY DEFINER function. Không revoke đại trà các RPC ứng dụng chỉ theo cảnh báo generic. Performance advisor có cảnh báo index/FK/RLS-initplan; không có health lint.

### Backup, recovery, impact và rollback

- Có local artifacts `backups/production_interior_snapshot_2026-11-09T22-53-01-432Z.json` và `backups/production_restore_pre_170000.sql` (last write 2026-11-10), nhưng chưa xác minh chúng chứa trạng thái mới nhất, restore được, hoặc dùng để phục hồi project hiện tại. Supabase tool được kết nối trong lượt này không cung cấp trạng thái backup/PITR project-specific; không chạy restore drill.
- **Production backup/recovery: NOT PROVEN.** Với các thay đổi RLS/GRANT/RPC/Storage có thể ảnh hưởng mọi actor trong tenant, và 6 hồ sơ project hiện có thông tin khách hàng, chưa có bằng chứng recovery đủ mới để nói batch Production an toàn.
- Migration `20261121000050` gộp policy, grant, role mapping, function/table O4 và cấu hình Storage trong một transaction; vì evidence bucket thiếu nên không áp dụng nguyên file. Cần tách/đối chiếu batch theo catalog Production. Migration timestamp `20261121062202` cũng chưa có trong Production ledger. Rollback SQL của policy/grant/function có thể chuẩn bị từ catalog hiện tại, nhưng việc khôi phục bucket và xác nhận khôi phục data cần kiểm soát Storage/backup riêng.

**Kết luận Production preflight:** `WRITE STATUS = HOLD` cho tới khi có bằng chứng backup/recovery hiện hành và batch được đối chiếu đúng schema. Security sign-off `NOT READY`. Có bằng chứng DB Production candidate đang dùng tenant-only direct RLS cho các bảng CRM/O4, nhưng chưa kiểm thử HTTP Production; không dùng kết quả E2E làm bằng chứng Production. Không có thay đổi Production hoặc E2E trong lượt preflight này.

## Production Runtime Preflight and Batch Drafts — 2026-11-21 (READ ONLY)

### P0 — Vercel runtime → DB ref

- Đọc `.github/workflows/deploy-production.yml`: `PRODUCTION_BASE_URL` có fallback tới `E2E_BASE_URL`; các bước build Production cho phép `NEXT_PUBLIC_SUPABASE_URL` fallback tới generic `vars.NEXT_PUBLIC_SUPABASE_URL`. Giá trị thực của GitHub/Vercel variables/secrets không đọc được từ checkout/tool hiện có.
- `.env.production` local chứa host `bella-erp-prod.supabase.co`, không map được tới ref Production đã đối soát qua danh sách project Supabase. Env local không đại diện cho Vercel deployment.
- Đọc `src/app/api/health/route.ts`: health payload chỉ báo `environment` và `checks.database`; không trả Supabase project ref nên một HTTP 200 cũng chưa tự chứng minh đúng DB.
- GET `https://bella-spa-erp.vercel.app/api/health` thử một lần trong chế độ chỉ đọc; client lỗi DNS `No such host is known` trước khi có HTTP response.
- **P0 result: NOT PROVEN.** Production DB ref `lvnvkpyxtuilhrabtlwv` vẫn được xác nhận trực tiếp riêng qua Supabase catalog/metadata; Vercel runtime mapping chưa được xác minh. Workflow fallback là cấu hình rủi ro cần đóng trước khi coi runtime đúng.
- Không sửa workflow, Vercel configuration, env files, Production DB hay Storage.

### P1 — Production-specific batch design

Đã tạo working drafts ngoài `supabase/migrations/` tại `supabase/production-pending/`. Mỗi `.sql.draft` có fail-fast statement và phần body vẫn comment; không được ledger/CLI tự động nhận diện và không có draft nào được thực thi.

- Lượt này đã đọc lại catalog Production bằng các SELECT trên `information_schema`, `pg_policies`, grants, `pg_constraint` và `pg_indexes`; không lấy hoặc xuất giá trị hồ sơ khách hàng. Đã xác nhận action mapping hiện hữu: `customer:read` gồm ADMIN/EXECUTIVE/OWNER/SALES; `handover:approve` gồm OWNER/PM; delivery/QC action sets gồm các role hiện hành của PM/QC và các vai trò vận hành liên quan.
- O4 hiện chỉ có FK đơn cột (một số `ON DELETE CASCADE`), chưa có tenant-qualified parent FK hoặc composite `(tenant_id,id)` index. P3 thêm composite relation mà giữ cascade semantics hiện tại. P5 index primary/default chưa tồn tại; lần đối chiếu trước đếm được 0 duplicate.
- Repository Interior đang dùng `.select('*')`; drafts giữ SELECT table-level để không phá contract đọc, nhưng thu hẹp INSERT/UPDATE/DELETE theo cột và policy.
- Static review xác nhận cả ba `.sql.draft` có một fail-fast guard đang hoạt động và một block SQL được comment đầy đủ; không có thao tác SQL nào được gửi đến Production. Đây không phải cú pháp-check hoặc database test cho phần body.

- **P2 CRM:** action-based RLS cho customer/contact/address và column grants dựa trên Production schema. Khác biệt thiết yếu so với Test source: bỏ table-level `INSERT` ở contact/address, cấp insert theo cột để không cho client ghi timestamp. Draft đã thêm permission check cho `interior_generate_customer_code`; P2 chưa sẵn sàng promotion cho tới khi merge RPC được rebase theo live Production definition. Merge role/action còn phụ thuộc primary/default integrity.
- **P3 O4:** action-based campaign/session/note authorization; authenticated chỉ đọc evidence metadata; session approval chỉ qua actor-derived, audited RPC. Bổ sung tenant-qualified parent links nhưng giữ hành vi cascade của các FK hiện tại. Không phụ thuộc và không thay đổi Storage bucket.
- **P4 Evidence:** giữ HOLD. Bucket chưa có; kích thước/MIME/path/access policy trong Test không được coi là Production decision. Có checklist quyết định và yêu cầu provision/verify qua Storage controls/API; không ghi trực tiếp `storage.buckets`.
- **P5 Integrity:** database-owned `updated_at` và unique partial indexes cho primary/default, với preflight abort nếu tìm thấy duplicate. Merge vẫn held cho tới khi Product Owner quyết định xung đột primary/default phải fail closed hay có quy tắc xử lý khác.

### Trạng thái sau lượt tiếp nối

- Production-first giữ nguyên; không chuyển batch sang Bella Test.
- DB catalog evidence hiện có là Production-only; endpoint/Vercel runtime identity và backup/recovery vẫn `NOT PROVEN`.
- Không có HTTP security probe, SQL DDL, data write, Storage operation, test hoặc migration application trong lượt này.
- `WRITE STATUS = HOLD`; security sign-off `NOT READY`. Để đi tiếp P0 cần bằng chứng cấu hình Vercel Production runtime đã trỏ đúng ref, và cần xác nhận/thiết lập phương án recovery hiện hành trước batch ghi đầu tiên.

## Production remediation review continuation — 2026-11-21

Owner requested complete P2/P3/P5 proposals while explicitly keeping Production write HOLD, P4 separate, and no commit/push/deploy. Current review artifacts and remaining gaps are recorded in `supabase/production-pending/REVIEW-AND-VERIFICATION.md`.

- Live Production merge and project-resolver function definitions were captured by read-only catalog SELECT. P2 candidate derives tenant/actor from authenticated context, checks merge permission and reports primary/default conflicts; it holds the existing service-role merge path pending caller reconciliation. P3 candidate adds acceptance-session project resolution and enforces matching campaign/project/tenant. SQL has not been executed.
- The existing CRM application merge service performs relationship updates and log insertion as separate requests; P2 column ACLs would reject its relationship update, and it does not call the proposed atomic merge RPC. P2 is not ready until caller integration is resolved.
- The existing contact/address repository clears the existing primary/default via a separate request before creating or updating. P5 partial unique indexes and atomic switch RPCs alone do not fix this application behavior. The repository must be reconciled with the owner's new rule and concurrency checked before acceptance.
- GitHub CLI is authenticated but its Production variable listing failed to connect. Vercel CLI listed no environment values; DNS resolution was denied. Runtime ref and recovery remain `NOT PROVEN`.
- P2/P3 complete rollback scripts and all behavioral verification remain outstanding. P5 has an unexecuted proposed schema rollback, not a data backup. No Production, Storage or Test writes, migration execution, commit, push or deploy occurred in this continuation.

## Production remediation continuation — 2026-11-21 (read-only catalog + local source)

- Re-read `pg_policies` directly on Production for CRM and O4. Each CRM table has one restrictive tenant guard and permissive SELECT/INSERT/UPDATE/DELETE policies with `true` action predicates. Campaigns, sessions, notes and evidence metadata each have a single permissive `ALL` policy that checks tenant only. This confirms the authorization gap in Production catalog; it does **not** prove a successful HTTP exploit.
- P2/P3 candidate preflights now compare the current exact policy names, roles, commands and predicates, and abort if any expected policy changes or any extra policy appears. Candidates were regenerated from the guarded drafts. This makes deployment fail closed against policy drift; their SQL has still not been parsed or executed.
- CRM merge now has an authenticated `POST /api/interior/crm/customers/merge` path that derives actor/tenant from server context and delegates to one atomic RPC; the repository no longer splits relationship transfer and audit logging across requests. P2 grants merge only to OWNER/ADMIN; existing SALES CRM CRUD mappings remain. Merge conflict/route and primary/default behavior are covered by the focused local suite.
- Repaired the P5 review rollback to remove all five timestamp triggers introduced by the candidate. It remains unexecuted and does not restore data or prove backup/recovery.
- Candidate generation completed. Recorded local verification from the current source: CRM/customer-360/route/RBAC **6 suites / 75 tests PASS**; O4/security **6 suites / 57 tests PASS**; focused ESLint **PASS**; Production workflow YAML and ref-validator checks **PASS**. These are local source/mock checks only, not Production HTTP, SQL parser or database behavior.
- Production/Vercel runtime identity and recovery remain `NOT PROVEN`; at this checkpoint the P2/P3 rollback scripts were not yet assembled. `WRITE STATUS = HOLD`; no Production/Test write, Storage operation, migration, commit, push or deploy was performed.

## Production remediation continuation — 2026-11-21 (source integration + rollback package)

- P5 caller integration is complete in source: primary/default switches go through the scoped RPC; an index conflict maps to a domain conflict and contact/address PATCH responds HTTP 409. No error path silently clears the old primary/default flag.
- CRM merge caller search found one application route, now using the atomic merge RPC; the split relationship-transfer and separate audit-write repository methods are gone. No source-level service-role merge caller was found; an external integration inventory is still needed before removing that RPC path on Production.
- O4 caller review covered approval RPC, project-scoped inspection update, actor-attributed note creation and evidence upload. Production does not currently contain the evidence metadata RPC used by the app. P3 now proposes that service-role RPC/helper and defines `interior:acceptance_evidence:upload` for observed OWNER/DELIVERY/QC create roles. The real upload path remains dependent on P4 because the Production bucket is absent and its privacy/size/MIME/path/retention decision is open.
- Generated `P2-rollback.review.sql` and `P3-rollback.review.sql` alongside the P5 rollback. They restore the reviewed broad table grants/policies, candidate function/resolver baselines, triggers/constraints/indexes and permission keys. P3 retains non-empty approval audit history. These are schema reversals only, are not parser-validated or executed, and restoring the old policies reopens the confirmed authorization gap.
- Verification: **11 focused suites / 124 tests PASS**, focused ESLint **PASS**, and repository `tsc --noEmit` **PASS**. A local lexical structure check passed for all six candidates/rollbacks. No local PostgreSQL parser/CLI was available, so SQL parse and database behavior remain `NOT PROVEN`.
- Vercel Production env pull/list returned no environment variables; the ephemeral pull file was removed and no secrets were printed or retained. Production runtime → DB ref remains `NOT PROVEN`; backup/recovery remains `NOT PROVEN`.
- `WRITE STATUS = HOLD`; no Production or Bella Test write, Storage operation, migration execution, commit, push or deployment occurred.

## Production catalog compatibility continuation — 2026-11-21 (read-only)

- Captured a new bounded catalog snapshot directly from Production at **2026-11-21 11:40 UTC**: migration ledger remains 491/latest `20261120130000`; CRM/O4 policy sets, baseline RPC hashes, helper owners/ACLs and role mappings match the reviewed snapshot.
- The snapshot exposed explicit operational grants on CRM/O4 tables (`bella_developer` SELECT, `verification_executor` SELECT, `bella_migration_executor` full table access). P2/P3 preconditions now compare exact table owner/ACL and effective authenticated privileges; these grants are preserved.
- Production `interior_customers` has authenticated SELECT/INSERT/UPDATE but no DELETE, unlike contacts/addresses. P2 candidate no longer adds a hard-delete permission or grant. The customer DELETE API maps archive to `customer:update`; `?hard=true` remains separately permission-gated. The existing `interior_prevent_customer_hard_delete` trigger/function hash, owner and ACL are checked and preserved, including the current PUBLIC EXECUTE grant.
- All **16** current O4 foreign keys are validated; P3 preflight fingerprints their definitions and cascade/set-null/restrict actions before adding tenant-qualified FKs. No current O4 triggers were found. P5 fresh counts: **0 duplicate primary contacts**, **0 duplicate default addresses**, and no existing updated-at triggers on contacts/addresses.
- Candidate preflights now check RBAC helper, resolver and current function owner/ACL/search-path/source fingerprints. New SECURITY DEFINER functions and audit table explicitly require a migration role able to assign owner `postgres`; this capability is a deployment prerequisite, not yet exercised.
- PostgreSQL execution remains unavailable locally: no PostgreSQL binaries/parser are installed and Docker has no running engine. Supabase CLI version startup hit a sandbox `EPERM` writing telemetry outside the workspace; it was not retried. Candidate SQL remains unparsed/unexecuted. Production/Vercel identity and recovery remain `NOT PROVEN`; no endpoint was retried.
- `WRITE STATUS = HOLD`; all Production access in this continuation was SELECT-only. No Test writes, Storage changes, migration, commit, push or deployment occurred.
