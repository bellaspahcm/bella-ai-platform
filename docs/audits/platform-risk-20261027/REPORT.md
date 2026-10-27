# Batch xác minh rủi ro Bella — 27/10/2026

Đây là báo cáo của batch xác minh ban đầu và phần containment follow-up ngày 27/10/2026. Trạng thái hiện tại được chốt theo bằng chứng trong [quyết định và kết quả containment](CONTAINMENT_DECISION_REQUIRED.md):

- P0 API/tenant containment trên primary: **`CONFIRMED / CONTAINED` trong phạm vi đã kiểm thử**.
- Auto `auto_customer_journeys` production UPDATE role: **`NOT_PROVEN`**.
- Healthcare verification: **`BLOCKED_BY_TEST_ENVIRONMENT`**; fixture host `mock.supabase.co` hiện không phân giải DNS.
- PostgreSQL credential committed to Git: **`ROTATED / INVALIDATED`**; repository secret and three current source copies updated; connection verified. `bella_migration_executor` no longer has EXECUTE on `public.exec_sql(text)`, but still has `BYPASSRLS` and broad DML; that role redesign remains open.
- Production deployment: **`NOT_DEPLOYED`**. Enterprise/Go-Live toàn hệ thống: **`NOT_PROVEN`**.

Không kết luận toàn hệ thống an toàn hoặc Healthcare/H1-H12 PASS.

## Phạm vi và nguồn

- Worktree: `D:\CodexWorktrees\bella-audit-risk-20261027`.
- Nhánh: `codex/audit-risk-20261027`.
- Base: `a69bab6c3244d34723b5600b646f48d0e48400ee`, đã đối chiếu `platform/main` và remote main.
- **Attribution:** source, catalog, deployment và verification observations trong packet do batch executor thu thập qua worktree/CLI; không tuyên bố người dùng đã trực tiếp kiểm tra worktree hoặc production.
- Đầu vào: bản phản biện kiểm toán được đính kèm; báo cáo Antigravity gốc và log của lần chạy 3.388/40 chưa được cung cấp.
- Workflow: trực tiếp theo Constitution tại base; Factory tùy chọn, không dispatch và không tuyên bố bằng chứng native Factory.
- Lead thực thi discovery/patch/verification; một reviewer độc lập chỉ đọc qua `bella-qa-testing`, theo yêu cầu review thay đổi bảo mật của Constitution. Không có nhiều writer hoặc code-changing worktree song song. Packet và kết quả: [INDEPENDENT_REVIEW.md](INDEPENDENT_REVIEW.md).

## Change Map trước sửa

| Hạng mục | Chủ sở hữu / nguồn chuẩn | Phạm vi được sửa | Nghiệm thu |
| --- | --- | --- | --- |
| Dependency | Maintainer advisory, npm registry, package.json + lockfile | package.json và package-lock.json cho next, @sentry/nextjs, zod, follow-redirects và dependency bắt buộc của chúng | Bản vá tối thiểu cùng major; audit trước/sau; build và regression liên quan |
| Migration / RLS / RPC | Supabase migration history và live catalogs từng project, đối chiếu Git | Chỉ đọc; SQL SELECT trong transaction READ ONLY, kết thúc ROLLBACK | Danh sách chính xác hai chiều, schema/policy/RPC inventory; không suy ra schema từ history |
| Test / tenant claims | Output runner gốc gắn revision, selector và môi trường | Chỉ evidence / báo cáo | Tách pass/fail/skipped/pending/runtime error; nguồn thiếu giữ NOT_PROVEN |

Không thay đổi Product, Kernel, contract, migration, auth, ACL/RLS hay chính sách/guard/allowlist. Không đồng bộ/reset/push database. Không commit/push/PR/deploy. Đây không phải OS/Product/UI mới nên entry gate riêng cho các loại đó không áp dụng. Không sửa code Healthcare/Education/Logistics; không dùng regression dependency để chứng nhận các Product đó.

## Kế hoạch xác minh

1. Audit lockfile production và toàn bộ dependency; lưu JSON, exit code, SHA nguồn và hash lockfile.
2. Xác minh advisory và phiên bản vá; truy vết đường sử dụng; cập nhật tối thiểu bốn dependency đã nêu.
3. Cài theo lockfile riêng tại worktree; build và test auth/tenant/payment/validation/instrumentation liên quan; giữ nguyên lỗi baseline hoặc môi trường.
4. Đọc catalog primary và E2E riêng biệt; so sánh history với tên/version trong Git, policy và RPC hiện tại; không ghi database.
5. Kiểm tra nguồn số liệu, đếm đúng phạm vi và phân loại chỗ thiếu bằng chứng; không chạy lại toàn hệ sinh thái để tái tạo một số điểm kiểm toán.
6. Review diff, secret safety và diff --check; chốt kết quả theo từng tiêu chí.

## 1. P0 được xác nhận trước containment trên primary

Bảng và catalog bên dưới ghi nhận trạng thái **trước** migration containment. Trạng thái sau thay đổi và bằng chứng kiểm tra lại được ghi ở mục “Review độc lập sau containment”.

Catalog hiện tại xác nhận RLS tắt và role `anon`/`authenticated` có SELECT trên các bảng dưới đây. HTTP dùng public/anon key, không có phiên người dùng, chấp nhận HEAD và trả số đếm; SQL `SET LOCAL ROLE anon` trong transaction READ ONLY xác nhận phạm vi tenant:

| Bảng | HEAD | Số dòng anon thấy | Số tenant khác nhau dưới role anon |
| --- | --- | --- | --- |
| auto_bookings_history | 200 | 60 | 1 |
| auto_customer_journeys_history | 200 | 4 | **2** |
| hc_temporal_events | 206 | 2.111 | 1 |

Đây là bằng chứng truy cập dữ liệu lịch sử của nhiều tenant khi chưa đăng nhập. Không cần tải bản ghi hoặc PII để xác nhận rủi ro. Không kết luận đã có kẻ tấn công hoặc dữ liệu đã bị lấy trước batch này.

Nguồn: [anonymous-head-probes.json](anonymous-head-probes.json), [exposure-anon-aggregates.json](exposure-anon-aggregates.json), [containment-preflight.json](containment-preflight.json). Query chỉ đếm, không giữ tenant IDs, payload hay bản ghi nghiệp vụ. `auto_vehicles_history` HEAD 200 nhưng 0 dòng; `platform_metric_events_2026_10` HEAD 404 nên **không** được gọi là HTTP-exposed dù catalog ghi quyền SELECT.

Preflight 5 bảng (`auto_bookings_history`, `auto_customer_journeys_history`, `auto_vehicles_history`, `hc_temporal_events`, `hc_temporal_snapshots`) cho thấy `anon` và `authenticated` còn có INSERT/UPDATE/DELETE/TRUNCATE, không có column ACL riêng. **Các quyền ghi chỉ được kiểm tra qua catalog; không thử ghi/xóa/truncate.**

### Consumer trace và preflight mới — 27/10, khoảng 04:22–04:25 UTC

Đã chạy riêng ba catalog query tới primary trong transaction `REPEATABLE READ READ ONLY`, mỗi query kết thúc `ROLLBACK`; cả ba lần chạy đã sửa đều exit 0. Output và execution record: [table preflight](containment-table-preflight.json), [function preflight](containment-function-preflight.json), [trigger preflight](containment-trigger-preflight.json). Đây là snapshot trước containment; fingerprint ACL năm bảng khi đó khớp preflight ban đầu.

Function catalog tìm thấy năm Auto history RPC là `SECURITY DEFINER` và vẫn có EXECUTE qua PUBLIC/anon/authenticated: `get_booking_as_of`, `get_journey_as_of`, `get_temporal_vehicle_inventory`, `get_vehicle_as_of`, `get_vehicle_status_history`. H9 `reconstruct_temporal_state_at` là `SECURITY INVOKER`, cũng có EXECUTE qua các role này. Vì vậy revoke quyền bảng đơn lẻ không chặn năm RPC `SECURITY DEFINER`; còn revoking ACL của H9 invoker sẽ chặn truy vấn history qua RPC đối với browser roles.

Đối chiếu consumer trong repo:

- `src/components/bella-auto/TemporalQueryBuilder.tsx` dùng browser `createClient()` gọi `get_temporal_vehicle_inventory`; source search không tìm thấy import/use component ở nơi khác, nên route thực tế đang reachable là **NOT_PROVEN**. Có hai script test/diagnostic gọi Auto history RPC.
- Ba trigger live đang bật trên `auto_bookings`, `auto_customer_journeys`, `auto_vehicles`; trước sửa, trigger function là invoker nên kế thừa role của câu lệnh parent. Source các route AutoMove đặt role `authenticated` cho booking/vehicle. `pg_stat_statements` ghi nhận hoạt động `authenticated` trên các parent đó, nhưng không có UPDATE được phân loại trong cửa sổ đã lưu.
- Với `auto_customer_journeys`, `pg_policies` không có policy cho role `authenticated`; source `CustomerJourneyService` nhận client được tiêm nhưng không tìm thấy construction production cụ thể. Thống kê primary không chứng minh được role của UPDATE journey; do đó role runtime journey giữ `NOT_PROVEN`. Không mở rộng policy parent. Luồng kiểm tra an toàn dùng `service_role`.
- H9 service/event-handler nhận Supabase client và ghi trực tiếp `hc_temporal_events`, nhưng không có non-test construction H9 trong repo. `pg_stat_statements` ghi nhận `service_role` cho 27 thao tác bảng H9 và 17 lần gọi reconstruction trước thay đổi. Đây là bằng chứng role thực tế được quan sát, nhưng không xác định constructor ở repo.

Proposal table-only ban đầu vẫn **superseded, không chạy**: xem [PRELIMINARY_CONTAINMENT_SUPERSEDED.sql](PRELIMINARY_CONTAINMENT_SUPERSEDED.sql). Chủ sở hữu sau đó đã chọn phương án sửa tenant contract trước, containment ngay sau xác minh, với authority giới hạn đúng năm bảng history, sáu RPC và ba trigger. Chi tiết quyền đã cấp, thay đổi và bằng chứng nằm trong [quyết định và kết quả containment](CONTAINMENT_DECISION_REQUIRED.md).

**Trạng thái primary: `P0 = CONFIRMED / CONTAINED`.** Đây là kết luận chỉ cho đường truy cập lịch sử đã xác định; không chứng nhận Healthcare/H1-H12, Enterprise, Go-Live hoặc toàn bộ schema an toàn.

Role catalog sau sửa ghi nhận `bella_migration_executor` là login role có `BYPASSRLS` và ACL `SELECT` hiện hữu; nó là danh tính database đặc quyền, không phải tenant-scoped API role, và không thuộc phạm vi ACL đã chốt. `bella_developer` và `verification_executor` không có `BYPASSRLS`/membership phù hợp và không có RLS policy trên năm bảng. Không kết luận đã cô lập các database-admin credentials.

## 2. Bản vá dependency đã kiểm chứng cục bộ

| Dependency | Lockfile trước | Lockfile/installed sau | Thay đổi tối thiểu |
| --- | --- | --- | --- |
| next | 16.3.8 | 16.4.1 | Nâng minimum trong manifest; @next/env/SWC cùng version |
| @sentry/nextjs | 10.67.0 | 10.75.2 | Nâng minimum; các package Sentry/OTel bắt buộc đi cùng |
| follow-redirects | 1.16.0 | 1.16.1 | Override chính xác bản vá nhỏ nhất, không thêm direct dependency |
| zod chính | 4.4.3 | 4.6.6 | Nâng minimum cùng major 4 |

Nguồn advisory maintainer/registry: [Sentry tunnel bypass](https://github.com/getsentry/sentry-javascript/security/advisories/GHSA-mchm-gjx6-7h55), Next [SVG](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), [Server Actions](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r), [use cache](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr), follow-redirects [array headers](https://github.com/follow-redirects/follow-redirects/security/advisories/GHSA-q3jh-wrc6-jgq8), [sensitiveHeaders](https://github.com/follow-redirects/follow-redirects/security/advisories/GHSA-8r9p-f939-6h3c), [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

Đường dùng: `next.config.ts` có Sentry `tunnelRoute: /monitoring`; ứng dụng dùng App Router/Server Actions. Không tìm thấy cấu hình dangerouslyAllowSVG hoặc directive use cache trong scoped search, nên không tuyên bố mọi RCE có thể khai thác trên deployment Bella. follow-redirects đi qua SendGrid → axios; khả năng khai thác array-form/custom header trên đường gọi cụ thể chưa được chứng minh. Bản vá giữ các contract đang dùng, không sửa logic Product/Kernel.

Audit production trước: **7 package**, gồm 2 critical / 3 high / 2 moderate, exit 1. Sau: **3 package**, 0 critical / 1 high / 2 moderate, exit 1. Bốn package production được yêu cầu đã hết finding trong output sau vá.

Residual còn nguyên:

- `xlsx`: high, hai advisory được allowlist từ trước, npm không có bản vá sẵn trong audit. Chưa đổi nguồn distribution/thư viện vì đó là thay đổi tương thích cần scope riêng.
- `nodemailer`, `fast-uri`: moderate, không được che bằng gate PASS; chưa sửa trong batch bốn dependency này.
- Audit toàn bộ dependency còn **19 package**: 0 critical / 10 high / 9 moderate. Hai Zod **3.25.76** trong `chromium-bidi` và `shadcn` còn bị advisory đánh dấu. Không ép override major 3→4 cho consumer chưa chứng minh tương thích.

`security:audit` exit 0 là kết quả **policy hiện hành** (cho phép hai advisory xlsx và chỉ chặn high/critical ngoài allowlist), không phải zero-CVE. Không sửa guard, allowlist, test selector, baseline hay chính sách để đạt PASS.

Raw audit trước/sau, dependency tree và hash candidate nằm trong thư mục này. [candidate.json](candidate.json) chứa base SHA, branch, hash đầu vào, package/lockfile và toàn bộ 39 lock entries thay đổi; bao gồm metadata/dependency đi cùng Next/Sentry, không cập nhật hàng loạt phần còn lại.

## 3. Migration và live schema/policy/RPC

Catalog được đọc riêng cho primary `lvnvkpyxtuilhrabtlwv` và E2E `bmnbqbcdbuklhopfbopv`, trong transaction REPEATABLE READ READ ONLY rồi ROLLBACK. Mỗi execution JSON lưu command, timestamp, exit, source revision và query hash. Lần gọi CLI đầu thiếu `--linked` bị reject trước query; đã sửa đúng cú pháp và giữ thông tin attempt trong execution primary.

Git base có **594 file SQL / 584 ID migration nguyên bản**. So sánh ID nguyên bản:

| Môi trường | Dòng history remote | Chỉ ở Git: file / ID nguyên bản | Chỉ ở remote |
| --- | --- | --- | --- |
| Primary | 443 | **150 / 143** | **2** |
| E2E | 163 | **430 / 421** | **0** |

Checker hiện hữu pad version 8 chữ số bằng `000000`. Theo quy ước đó, Git có 582 version chuẩn hóa; primary pending 143 file / 141 version, E2E 430 file / 419 version. Đây là thống kê riêng, không được dùng thay ID nguyên bản. Có 7 nhóm ID nguyên bản trùng file; không tự đổi tên/đánh dấu applied để làm history xanh.

Hai ID primary-only:

| ID primary | Tên | File counterpart trong Git |
| --- | --- | --- |
| 20261024073425 | platform_current_actor_read_contract | 20261019060000_platform_current_actor_read_contract.sql |
| 20261024073501 | platform_trusted_actor_org_unit_access | 20261019045000_platform_trusted_actor_org_unit_access.sql |

Đã kiểm tra sâu 3 function liên quan. Body normalized newline/boundary whitespace khớp **1/3 ở primary, 3/3 ở E2E**. Kiểm tra tiếp để phân biệt formatting/comment cho thấy **3/3 ở cả hai môi trường khớp token với Git**, sau khi loại SQL comments/whitespace, fold bare identifiers và giữ nguyên quoted literals. Quyền anon execute của cả 3 đều false. Nguồn: [actor-contract-primary.json](actor-contract-primary.json), [actor-contract-e2e.json](actor-contract-e2e.json), [actor-contract-token-comparison.json](actor-contract-token-comparison.json).

Kết quả này thu hẹp hai remote-only ID về cùng family contract đã có source và body token phù hợp; **không** chứng minh toàn bộ statements, schema hoặc migration history tương đương. Chưa repair history, chưa replay các pending migrations. Các migration khác có thể đã được đưa vào remote qua lịch sử/squash khác; thiếu ID không tự chứng minh thiếu schema.

Inventory hiện tại:

| Môi trường | Bảng public r/p | RLS bật / tắt | Policy | Function/procedure public | SECURITY DEFINER / anon-executable SECURITY DEFINER | Tenant rows |
| --- | --- | --- | --- | --- | --- | --- |
| Primary | 500 | 465 / 35 | 564 | 631 | 220 / 178 | 5.271 |
| E2E | 275 | 268 / 7 | 425 | 420 | 159 / 80 | 8.154 |

Live columns/types/nullability, policy expressions, function signatures/definition hashes và quyền execute đã được giữ trong hai catalog. So sánh hai môi trường: 276 bảng chỉ primary, 51 chỉ E2E, 125 bảng cùng tên khác cấu trúc/quyền; 35 policy cùng key khác nội dung; 47 function cùng signature khác fingerprint/quyền. Đây là **khác biệt môi trường được quan sát**, không tự động là defect hoặc lý do áp dụng E2E lên primary. Inventory chưa bao gồm mọi view/trigger/index/sequence/dependency, nên full-schema replay equivalence giữ **NOT_PROVEN**.

Danh sách migration chính xác cả hai chiều và raw/normalized: [migration-primary-reconciliation.json](migration-primary-reconciliation.json), [migration-e2e-reconciliation.json](migration-e2e-reconciliation.json). Catalog delta: [catalog-environment-differences.json](catalog-environment-differences.json). Không tái tạo con số 9/173 từ một snapshot khác khi thiếu nguồn revision/environment của báo cáo gốc.

## 4. Đối chiếu các tuyên bố định lượng

[quantitative-claims.json](quantitative-claims.json) giữ phương pháp đếm, danh sách file và các summary lịch sử đã tìm thấy.

- 3.388 pass + 40 fail = 3.428; còn **203 trường hợp chưa phân loại** so với 3.631. Pass/(pass+fail) = **98,8331%**, làm tròn một chữ số là **98,8%**. Pass/tổng 3.631 = 93,3076%; không thay mẫu số mà không nêu rõ. Không giả định 203 là skipped.
- `git ls-files` tại base, tên `.test`/`.spec` JS/TS variants: **953 file** (812 src, 55 tests, 53 e2e, 20 scripts, 13 archive). Jest discovery theo config hiện hành chọn **848 file**, exit 0; listTests không chạy test cases.
- `test-results.txt` ghi 2.721 pass / 187 fail / 189 skipped; `test-results-after-fix1.txt` ghi 2.689 pass / 245 fail / 101 skipped; archive JSON ghi 445 pass / 41 suites. Không có đủ binding revision/selector/environment để dùng các file này xác nhận claim 3.388/40.
- **5.271** được chứng minh là số dòng `public.tenants` tại primary, không phải số tenant đã được kiểm thử chống truy cập chéo. Bằng chứng anon của batch này còn bác bỏ kết luận cách ly tuyệt đối.
- Số lệnh ENABLE RLS trong migration không chứng minh policy hiệu lực. Live catalog hiện tại được báo riêng ở trên, không gán lại ý nghĩa cho 559/510 của báo cáo cũ.
- Claim 8/11 TypeScript sạch, English Center Level 5/Go-Live Ready, toàn hệ sinh thái Enterprise hoặc không rò rỉ mọi tenant: **NOT_PROVEN** trong batch này. Không chọn Product mới để sửa khi người dùng chưa chỉ định workflow/acceptance cụ thể; P0 dữ liệu được ưu tiên trước.

## 5. Verification thực thi và giới hạn

| Check | Kết quả | Evidence / phạm vi |
| --- | --- | --- |
| npm ci --ignore-scripts --no-audit --no-fund | PASS, exit 0 | Cài riêng 1.398 package từ lockfile; không junction node_modules cũ |
| npm run test:critical + instrumentation/validation suites | **PASS: 20 suites, 256 tests**, exit 0 | Không fail/pending/todo/runtime-error; regression-results.json và execution |
| npm run build | **PASS, exit 0**, có warnings | Production build với E2E env chỉ trong process; Next 16.4.1, webpack |
| TypeScript đầy đủ / 11 cấu hình | **NOT_RUN / NOT_PROVEN** | Build ghi `Skipping validation of types` theo config sẵn có; không gọi đó là TypeScript PASS |
| Smoke HTTP production server | **PASS 4/4** | Login 200, dashboard 307→login, care/classes và finance API 401 khi chưa đăng nhập; server cục bộ đã dừng, port 3127 đã trả |
| npm run security:audit | PASS theo policy, exit 0 | xlsx vẫn allowlisted; raw production audit exit 1 |
| npm run arch:guard | PASS, exit 0 | Guard thực sự chạy; không chứng minh mọi tầng kiểm soát hoặc full Kernel regression |
| Read-only catalogs / role aggregates | PASS execution, exit 0 | Chỉ đọc metadata/aggregate; không phải PASS isolation |
| Baseline trước containment: anonymous isolation trên bảng history | **FAIL** | Anon thấy 4 dòng / 2 tenant; đây là bằng chứng trước sửa, không phải kết quả sau sửa |
| Review độc lập | Đã thực hiện; P2 được sửa | INDEPENDENT_REVIEW.md; candidate package hashes giữ nguyên |
| Kiểm tra bàn giao | PASS trong phạm vi quét | final-checks.json: package hashes khớp, JSON/link hợp lệ, diff --check exit 0, không khớp secret cấu hình/JWT/private key/DB URL có password |
| Browser nghiệp vụ được phép / Real DB write / Product Go-Live | **NOT_RUN / NOT_PROVEN** | HTTP denial và unit tests không thay thế các gate này |

Warnings build gồm Sentry root config import deprecation hướng tới v11, thiếu global error handler và dynamic dependency trong script business-invariants. Chúng được giữ trong log, không tắt/sửa ngoài scope. Batch dependency không chứng nhận Healthcare/Education/Logistics feature. Healthcare verification được chạy riêng sau containment; kết quả bị chặn bởi DNS fixture và được giữ riêng ở mục follow-up bên dưới. Không tuyên bố các Product/kernel đạt regression/Go-Live từ build shared dependency này.

### Review đối chiếu sau containment — 27/10/2026, 05:21–05:27 UTC

- SHA-256 của migration hiện tại khớp với execution record áp dụng primary. Phần DDL chỉ bật RLS, đổi ACL và tạo tenant-read policies trên đúng năm history tables; thay thân ba Auto trigger functions và sáu RPC; không tạo bảng/cột, không đổi parent-table policy hoặc trigger definition, không chạm Kernel khác. `CREATE OR REPLACE` áp dụng thành công; catalog trước/sau giữ identity arguments, và live result types hiện tại khớp các contract trong migration.
- Tám truy vấn primary `REPEATABLE READ READ ONLY` đều exit 0; command, SQL hash, thời điểm và output được lưu tại [containment-post-review-execution.json](containment-post-review-execution.json). Catalog sau sửa: cả năm bảng bật RLS; anon không có SELECT; authenticated có SELECT nhưng không có quyền ghi; `service_role` giữ SELECT/INSERT/UPDATE/DELETE/TRUNCATE. Năm policy chỉ cho SELECT theo `platform_current_actor_profile()` tenant.
- Cả sáu RPC hiện từ chối anon và `PUBLIC`, giữ EXECUTE cho authenticated/service_role; các chữ ký/kiểu trả về giữ nguyên. Năm RPC Auto là `SECURITY DEFINER`; H9 vẫn `SECURITY INVOKER`. Cả ba Auto trigger vẫn enabled, dùng `SECURITY DEFINER SET search_path = ''`.
- Bằng chứng behavior sau sửa còn nguyên: REST anon 5/5 bảng và 6/6 RPC trả HTTP 401; rollback probe từ chối tenant chéo trên năm bảng và sáu RPC, vẫn cho đọc tenant đúng, kiểm tra ba Auto trigger và H9 server flow, không để fixture tồn tại. Đây là bằng chứng theo những role/đường đã chạy, không phải chứng nhận toàn hệ thống.
- Auto production UPDATE trace đã được đào sâu và lưu tại [auto-journey-production-trace.json](auto-journey-production-trace.json). Route rollback có trong production commit `bb7007e7632c3bf7d88f760fc8239a0720d2d327`, nhưng caller duy nhất trong source là `/bella-auto/rollback-demo`, dùng `demo-user-id` và gửi `userId`/`userEmail` trong body; route chỉ kiểm tra hai giá trị có mặt, không xác thực Supabase Auth user hoặc chuyển session request vào client. `getPrimaryClient()` dùng publishable/anon key và `persistSession: false`, nên role **anon là suy luận từ source, chưa quan sát runtime**. Vercel log query 30 ngày trả 0 event; invocation metrics bị chặn với `payment_required`; `pg_stat_statements` có 0 parent UPDATE kể từ lần reset 19/10/2026. Các tín hiệu rỗng này không chứng minh route chưa được dùng và không cho biết role của một lần ghi thành công.
- Contract nghiệp vụ cụ thể vẫn chưa rõ: API docs nói mọi API cần Supabase session và tenant RLS nhưng ví dụ lại nói `getPrimaryClient()` tự dùng session; hai báo cáo lịch sử về Phase 11 cũng mâu thuẫn nhau về production readiness và RPC availability. Không có contract rollback cụ thể đủ chuẩn để chọn một principal/đường thực thi. Do đó `Auto production UPDATE = NOT_PROVEN`; không mở parent ACL/RLS và không thay route theo suy đoán.
- DNS hiện trả `mock.supabase.co : DNS name does not exist`; vì vậy không chạy lại `npm run healthcare:verify`. Kết quả gần nhất vẫn là guard PASS, architecture 9/9 và conformance 7/7, nhưng healthcare tests 39/61 suites và 374/530 tests PASS; 18 suite/151 test fail do fixture setup `ENOTFOUND`, nên gate tổng thể **`BLOCKED_BY_TEST_ENVIRONMENT`**, không phải PASS. Kết quả DNS follow-up: [healthcare-fixture-dns-followup.json](healthcare-fixture-dns-followup.json).

Ngoại lệ đặc quyền database vẫn tồn tại: `bella_migration_executor` có `BYPASSRLS` và ACL SELECT hiện hữu; không thuộc containment qua API/tenant này và chưa được xử lý.

## 6. Bàn giao và trạng thái còn lại

Đã xử lý: bốn dependency production được chỉ định, xác minh cài/build/regression/runtime, đối chiếu history và catalog hai môi trường, sửa cách diễn giải số liệu và giữ nguồn raw. Source runtime chỉ thay `package.json` và `package-lock.json`; evidence ở thư mục này. Candidate đã qua independent read-only review nhưng chưa chạy repository CI, chưa commit, push, mở PR, merge hoặc deploy; giữ riêng khỏi containment.

Quyết định authority đã được nhận và migration containment tối thiểu đã áp dụng trên primary theo phạm vi cho phép. Bước review hiện xác nhận trạng thái ACL/RLS/function grants/trigger sau sửa bằng truy vấn read-only. Không chạy migration sync, DB reset, dependency repair, commit/push/PR/merge hoặc deployment.

Các việc còn mở là: (1) có contract rollback chuẩn và bằng chứng runtime cho caller/role Auto; (2) chạy lại cùng `npm run healthcare:verify` khi `mock.supabase.co` phân giải được; (3) đưa dependency candidate riêng qua repository CI phù hợp trước mọi quyết định phát hành; (4) owner xử lý credential và privilege theo read-only evidence tại [privileged-role-review.json](privileged-role-review.json). Không mở parent quyền Auto, không sửa fixture/test, không đồng bộ migration history và không gộp candidate vào containment. P0 API/tenant containment đã đạt phạm vi kiểm thử; tổng thể Enterprise/Go-Live vẫn **`NOT_PROVEN`**.

## 7. Privileged database role — read-only pre-change review

- Ngày 27/10/2026, bốn truy vấn `REPEATABLE READ READ ONLY` trên primary đều exit 0; SQL, hash, output và execution record nằm trong các file `privileged-role-*-readonly.*`. Không đọc hàng dữ liệu tenant; chỉ đọc catalogs, grants, function definitions và aggregate connection/query statistics.
- `bella_migration_executor` xác nhận là `LOGIN`, `BYPASSRLS`, `INHERIT`, không `SUPERUSER`, không `CREATEDB/CREATEROLE`; `validUntil` không đặt, connection limit không giới hạn. Role có `CREATE` trên `public` và `migration_governance`. `postgres` là member của executor với `ADMIN OPTION`; executor không là member của role khác.
- Có 461 base relation chứa tenant/org/branch key; ACL hiệu lực cho executor `SELECT/INSERT/UPDATE/DELETE/TRUNCATE` trên cả 461. RLS bật trên 438, không bật trên 23, và không bảng tenant-key nào bật `FORCE ROW LEVEL SECURITY`. Executor sở hữu 12 relation và default privileges của `postgres` cấp full DML cho executor trên bảng mới trong `public` và `migration_governance`.
- Snapshot trước follow-up: `public.exec_sql(text)` là `SECURITY DEFINER`, owner `postgres`, có EXECUTE cho executor; thân hàm thực thi `sql_query` trực tiếp. BDGF wrapper xác minh approval/token rồi gọi `db.query(migration_content)`, không gọi RPC này. Mục 8 ghi nhận việc phân loại caller và thu hồi riêng executor grant.
- `public.set_tenant_context(uuid)` là `SECURITY DEFINER`, owner executor và `PUBLIC`/anon/authenticated đều có EXECUTE. Hàm đặt `app.current_tenant_id` từ tham số không kiểm tra membership; 100 policy hiện hành tham chiếu GUC này. Không gọi function hay chạy API probe trong batch này, nên impact cross-request/tenant vẫn `NOT_PROVEN`.
- Credential `postgres` cùng primary được hard-code trong commit `39d70165aec43927228a639fbdcc461c470b356d` (22/08/2026), gồm `origin/main` và `platform/main`; snapshot ref tại checkout có 559 refs chứa commit, trong đó có hai tag. Literal từng nằm trong ba script và một helper doc; follow-up đã xóa khỏi working tree, nhưng không rewrite lịch sử. Mật khẩu đã bị rotate, nên bản lịch sử bị lộ không còn hợp lệ. Giá trị không được lưu trong evidence. `DATABASE_EXECUTOR_URL` là credential riêng; không đọc secret value.
- Không có session executor đang hoạt động và `pg_stat_statements` không có câu lệnh nào của role kể từ reset `2026-10-19T13:28:49+07:00`; điều này không chứng minh role chưa/không được dùng ngoài cửa sổ thống kê.

**Residual privileged-role work:** `BYPASSRLS`, ownership, default privileges và broad table DML vẫn còn. Không đổi role, ownership, default ACL, `set_tenant_context`, hay schema trong follow-up này; executor redesign vẫn cần rehearsal migration/backfill trong môi trường isolated.
## 8. Credential rotation and scoped exec_sql grant removal

### Credential

- Owner confirmed the production secret targets primary `lvnvkpyxtuilhrabtlwv` and the three consumers are `deploy-production.yml`, `bdgf-bella-auto-workshop-rls-production.yml`, and `bdgf-bella-auto-workshop-security-closure.yml`. Secret values were never read.
- Supabase Management API password reset returned HTTP 200; the final new password was written to repository secret `PRODUCTION_SUPABASE_DB_URL` (metadata updated 27/10/2026 13:11 +07). A fresh PostgreSQL connection then passed a read-only identity query (`current_user=postgres`, `current_database=postgres`) with TLS CA and hostname verification.
- One initial reset was superseded after the local driver lacked the database CA; the final reset/secret update/connection check succeeded. No generated password was saved to files, logs, or chat. The originally committed password is invalidated.
- Replaced the hard-coded URL in `grant-bypassrls.mjs`, `apply-rls-protection.mjs`, and `fix-rls.mjs` with fail-closed `DATABASE_ADMIN_URL` requirements; replaced the same literal in `r3-step2-update-env-helper.md`. A value-comparison scan against the historical source found zero copies of that credential in the current working tree. Git history was not rewritten.

### `public.exec_sql(text)`

- Repository callsites use Supabase/PostgREST RPC with service-role inputs; no direct PostgreSQL callsite invokes `exec_sql`. BDGF wrapper runs approved migration content with `db.query` and does not depend on this RPC.
- Before: explicit EXECUTE ACL was `{postgres, service_role, bella_migration_executor}`; PUBLIC had none. Applied only `REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM bella_migration_executor` through `supabase db query --linked` as `postgres`.
- After: executor effective EXECUTE is false; `postgres` and `service_role` remain true; PUBLIC remains false. Executor remains `LOGIN` and `BYPASSRLS`; no table, role, ownership, or default ACL was changed.
- BDGF owner approval tests: 19/19 PASS; Production migration workflow tests: 12/12 PASS. No Production migration was executed, so executor-role live migration execution remains NOT_PROVEN.

### Dependency candidate local CI-equivalent

- Router for `package.json` and `package-lock.json`: `ALLOW`, platform; full typecheck, build, dependency audit, and lightweight security are selected; unit tests and Real DB E2E are not selected.
- `npm ci --prefer-offline --no-audit --no-fund`: PASS, 1398 packages, Node 24.22.1. Full typecheck: PASS, zero diagnostics. `npm run security:audit`: PASS under the existing advisory allowlist; `xlsx` advisories remain allowlisted. `npm run security:secrets`: PASS. Production build: exit 0 with Sentry configuration and dynamic-dependency warnings.
- BDGF security-closure guard was 11/12 on this Windows worktree because its hash check read CRLF bytes; LF-normalized hash matched the workflow-bound expected hash. At this report's initial checkpoint the candidate was uncommitted; see §9 for the subsequent dependency-only commit/push and GitHub CI results. No PR, merge, migration sync, or deployment occurred.

### Unchanged boundaries

P0 API/tenant containment remains confirmed only for the tested scope. Auto journey production UPDATE remains `NOT_PROVEN`; Healthcare remains `BLOCKED_BY_TEST_ENVIRONMENT` while fixture DNS is unresolved; `bella_migration_executor` `BYPASSRLS` redesign remains open; deployment remains `NOT_DEPLOYED`; Enterprise/Go-Live remains `NOT_PROVEN`.

## 9. Privileged-role rehearsal and dependency candidate CI

### Disposable PostgreSQL role-mechanics rehearsal

- Ran a disposable Supabase PostgreSQL 17.6 container with `--network none`, synthetic two-tenant tables, and a synthetic `bella_migration_executor`; the container was stopped and auto-removed. The existing Preschool local stack was not used.
- With `BYPASSRLS`, the synthetic executor read both tenant rows. After `NOBYPASSRLS`, RLS limited it to the tenant context, while a table with no RLS still exposed and updated both tenants.
- The role could create and alter a table it owned, but could not alter a postgres-owned table or transfer its table to `postgres`. Its newly created table was owned by the executor and bypassed RLS until `FORCE ROW LEVEL SECURITY`; afterward the tenant policy limited rows. PostgreSQL default ACLs granted executor privileges on a postgres-created table.
- This proves PostgreSQL mechanics only. It did not use Bella's schema/data, the E2E database, or the BDGF migration workflow. Actual executor DDL/backfill/ownership/default-privilege compatibility remains **`NOT_PROVEN`**; no Production role, grant, ownership, schema, or migration changed.

### Bella source-schema replay attempt

- Started a fresh Supabase local project from clean source revision `a69bab6c3244d34723b5600b646f48d0e48400ee` (`supabase/config.toml` targets PostgreSQL major 17); no Production or Preschool database was used.
- `supabase start --yes` exited `1` on the ninth attempted migration, `20260515010000_the_great_purge.sql`, with PostgreSQL `42703`: `bookings.package_name` does not exist. The clean source migration set therefore did not produce a consistent Bella schema from this baseline.
- Stopped the temporary project with `supabase stop --project-id BELLA_SPA_ERP --no-backup` (exit `0`); its local data volume was removed. The unrelated Preschool stack remained untouched.
- Per the stop condition, no migration was edited, skipped, reordered, or marked applied. No executor-role test against a Bella schema was run; privilege-option comparison remains **`NOT_PROVEN`**.

### Dependency candidate GitHub CI

- Candidate commit `dd0aa0fd000937ac2762fecc53ed17fedf3f118f` on `codex/audit-risk-20261027` contains only `package.json` and `package-lock.json`; it was pushed without opening a PR or deploying.
- [CI Quality Gates run 40463934237](https://github.com/bellaspahcm/bella-ai-platform/actions/runs/40463934237) completed `success` on that exact SHA. Changed-file lint, secret/log guard, dependency audit, build, and `All Required Gates Passed` were **PASS**.
- [Type Check run 40463958452](https://github.com/bellaspahcm/bella-ai-platform/actions/runs/40463958452) completed `success` on the same SHA; full typecheck was **PASS**.
- Unit/integration, Real DB E2E, and migration jobs were **skipped by the dependency scope router**. The local selected regression remains 20 suites / 256 tests **PASS**; skipped GitHub jobs are not counted as CI test passes.
- The candidate CI scope is complete for the selected gates. PR, merge, and Production deployment remain unperformed.
