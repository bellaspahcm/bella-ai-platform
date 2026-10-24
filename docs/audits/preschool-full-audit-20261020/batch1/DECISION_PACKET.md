# Batch 1 — Evidence complete, chờ phê duyệt remediation

Ngày **20-10-2026**, Asia/Saigon. Branch `codex/preschool-full-audit-20261020`, source `339c89250d87964ba8d58860a5ecdbc0bdde4956`. Đây là phần tiếp nối read-only của audit, không thay thế hoặc sửa evidence audit trước.

**Kết luận:** đã xác định được production relationship và nguyên nhân deployed policy/grants, bao gồm nguyên nhân cụ thể của `students`. Trở ngại đọc catalog `28P01` được vượt qua bằng kênh Supabase CLI/Management API đang được ủy quyền, không đổi mật khẩu. **Batch 1: EVIDENCE_COMPLETE_AWAITING_REMEDIATION_APPROVAL. Batch 2: chưa được thực hiện.**

## 1. Endpoint bị ảnh hưởng liên quan production thế nào?

| Mắt xích | Bằng chứng live |
| --- | --- |
| Endpoint audit đã probe | `https://lvnvkpyxtuilhrabtlwv.supabase.co`; public JWT claim `role=anon`, `ref=lvnvkpyxtuilhrabtlwv` |
| Production alias | `https://bella-spa-erp.vercel.app` |
| Project Vercel | `prj_Rgncynqz8ptznREGggMxPfjwoikW`, project `bella-spa-erp` |
| Deployment production READY | `dpl_9FQrTej4gajN95v6MwLJ31f3pUTQ`, `main@f973dd7e56542aa7847b98c2a4236da86f1eabc3` |
| Public Supabase URL target `production` trên Vercel | **`https://lvnvkpyxtuilhrabtlwv.supabase.co`**, đọc đúng một public URL env qua authorized CLI GET; không export toàn bộ env |
| Runtime production | GET `/api/health` → 200, `environment=production`, database=ok |
| Courses production, không cookie/JWT | GET có tenant query → **200, success=true, 8 classrooms** |
| Supabase E2E riêng | `bmnbqbcdbuklhopfbopv`, project `bella-spa-erp-e2e`, đang được CLI link; không dùng nó thay cho production |

Evidence: `production-deployment.json`, `production-public-env-current.json`, `production-runtime-get.json`, `configuration-origins.json`, `supabase-projects.json`.

`.env`, `.env.local`, `.env.test` đều trỏ tới `lvnv…`; `.env.e2e` trỏ tới `bmnb…`; `.env.production` lại trỏ hostname `bella-erp-prod.supabase.co`. Vì vậy `.env.production` tại máy **không phải nguồn có thẩm quyền cho production đang hoạt động**. Tên file không xác định được môi trường.

Liên hệ production đã được chứng minh bằng current production configuration + deployment metadata + live runtime. Không suy ra mọi integration/worker đều dùng cùng DB. Public login HTML/15 scripts trả200 nhưng không tìm thấy literal Supabase origin; `production-public-bundle.json` chỉ là ca kiểm tra không đủ bằng chứng, không dùng nó để khẳng định endpoint. Một REST attempt bằng token đọc trực tiếp trả403; authorized Vercel CLI GET thành công, được dùng làm nguồn chính.

## 2. Catalog đọc được bằng kênh nào?

Commands đã chạy, thay `PROJECT_REF` bằng production/E2E đã ghi:

```powershell
supabase projects list --output json
supabase db query --linked --project-ref PROJECT_REF --file docs/audits/preschool-full-audit-20261020/batch1/catalog-readonly.sql --output json
```

CLI help xác nhận linked query đi qua Management API. **Execution role là `postgres`, transaction_read_only=`on`**. Đây là administrative read channel hiện có với SQL bị giới hạn bằng `BEGIN READ ONLY`/`ROLLBACK`, **không phải một credential DB least-privilege mới được cấp**. Không đổi password, tạo account, sửa policy hay chạy migration. Các truy vấn chỉ đọc catalog, definitions, roles và grants; không đọc hồ sơ nghiệp vụ qua admin query.

Production: **86 relations trong allowlist, 110 policies**. E2E: **17 relations, 32 policies**. Đây là số trong phạm vi query, không phải tổng toàn DB.

Đã lấy `relrowsecurity`, `relforcerowsecurity`, owner/ACL, expanded table/column grants, roles/memberships, schema privileges, default ACL, relevant helper/view definitions. Snapshots: `catalog-production.json`, `catalog-e2e.json`; raw CLI envelopes giữ riêng để đối chiếu.

Đã đọc lại production catalog sau các probe. **10 nhóm catalog đã so sánh đều không đổi**: tables, policies, table ACL, column ACL, roles, memberships, schema grants, default ACL, helpers, views (`read-only-verification.json`). Xác nhận này chỉ áp dụng các objects đã chọn, không phải checksum toàn DB hoặc kiểm chứng không có actor khác ghi dữ liệu.

## 3. Root cause đã xác định

### `students`: nguyên nhân không còn là suy đoán

Production `students` có RLS enabled=true, forced=false; role `anon` không phải superuser và không có BYPASSRLS. Tuy nhiên:

- `anon` có direct table privileges SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN.
- `tenant_isolation_students`: **PERMISSIVE, ALL, TO PUBLIC, USING(true)**, WITH CHECK null.
- Cùng bảng còn có `students_tenant_isolation` kiểm JWT tenant và `students_service_role` chỉ dành cho service role.

Các permissive policy áp dụng được kết hợp theo OR. Policy PUBLIC true cho phép hàng dù predicate tenant còn lại không cho phép. WITH CHECK không khai báo riêng cho ALL không biến USING(true) thành kiểm tenant. Vì vậy không thể sửa bằng cách chỉ thêm một permissive tenant policy mới hoặc chỉ bật RLS thêm lần nữa.

**Root mechanism: direct anonymous ACL + applicable permissive PUBLIC true policy.** Không quy cho service_role token hoặc RLS bị tắt. Lịch sử ai/command nào tạo policy generic này vẫn chưa được truy nguyên; không cần bịa migration provenance để chứng minh cơ chế đang chạy.

### Finance / Facilities / Scheduling

| Bảng mẫu | Deployed policy | Anonymous ACL | Kết luận |
| --- | --- | --- | --- |
| `edu_fin_invoices` | `tenant_isolation_edu_fin_invoices`, ALL PUBLIC, qual=true | Có quyền trực tiếp | SELECT leak được runtime xác nhận |
| `edu_fac_assets` | `edu_fac_assets_policy`, ALL PUBLIC, qual=true | Có quyền trực tiếp | SELECT leak được runtime xác nhận |
| `edu_sched_shift_assignments` | ALL PUBLIC, qual=`tenant_id IS NOT NULL` | Có quyền trực tiếp | Predicate không so caller tenant; empty rows không chứng minh an toàn |

Nguồn migration Finance/Facilities mở rộng grants và tạo true policies phù hợp với catalog hiện tại; catalog là nguồn chính cho live state. Default ACL hiện tại chỉ grant service/migration/developer/verification roles, không có anon mặc định. Vì vậy **không sửa default grants toàn schema theo suy đoán** để xử lý các existing direct ACL này.

## 4. Phạm vi ảnh hưởng được chứng minh tới đâu?

**32 bảng** trong allowlist có anon SELECT cùng policy PUBLIC permissive qual=true hoặc tenant-not-null: **9 Communication + 7 Facilities + 8 Finance + 7 Scheduling + shared `students`**. Danh sách chính xác và snapshots từng bảng nằm trong `reviewed-scope.json`; tiêu chí và delta E2E tại `impact-and-e2e-delta.json`.

Đây là **catalog-proven permissive configuration** cho 32 bảng; không nói rằng đã tải dữ liệu, đã thử ghi hoặc mọi bảng đều có record. Fresh direct GET dùng role anon, không user JWT/cookie, chỉ select một `tenant_id` và lưu status/count/boolean:

| Bảng | Fresh production DB GET | Count target tenant |
| --- | --- | --- |
| `students` | 206, có sample row đúng tenant | 186 |
| `edu_fin_invoices` | 206, có sample row đúng tenant | 28 |
| `edu_fac_assets` | 206, có sample row đúng tenant | 7 |
| `edu_courses` | 401 / 42501 | Bị chặn ở scoped negative control |

Evidence: `anonymous-runtime-readback.json`. Cross-tenant sample của audit gốc được giữ nguyên, không tải lại hàng loạt. Không thử INSERT/UPDATE/DELETE/TRUNCATE.

Ngoài 32 bảng này, catalog còn cho thấy **75 relations trong scope có anon TRUNCATE privilege**. RLS không tự bảo vệ TRUNCATE. Chưa kiểm chứng direct SQL/RPC transport nào expose thao tác đó, nên không biến privilege thành một cuộc tấn công đã thực hiện. **Không tự mở scope sửa sang toàn schema.** Các ACL residual phải được owner review riêng; containment32 không chứng nhận toàn DB an toàn.

## 5. Đề xuất cần duyệt

Chi tiết: `MINIMAL_REMEDIATION_PLAN.md`. Draft cụ thể: **`PROPOSED_ANON_CONTAINMENT.sql`**, ngoài thư mục migrations, có nhãn **PROPOSAL ONLY / NOT EXECUTED** và kết thúc bằng **ROLLBACK**.

Đề xuất Batch2A: revoke direct privileges của **anon trên đúng32 bảng** đã chứng minh, trong một transaction có lock/statement timeout và postcondition ACL. Không thay authenticated/service-role ACL, không sửa policies/helper/role/schema, không tạo bảng mới hoặc thay business semantics. Shared `students` cần Platform/Identity owner; 31 bảng còn lại cần Preschool/Security owners. Đây là containment anonymous, **không phải** complete tenant/RBAC remediation.

Batch2B phải giải quyết authenticated cross-tenant/role/branch policies và các API privileged entrypoints; không được để PUBLIC true policies thành trạng thái hoàn tất chỉ vì anon bị revoke. Cần reconcile approved role/branch contracts trước khi viết policy, không copy E2E policy hoặc dùng `getUserAccessibleUnits` như authorization đã chứng minh.

**Chưa có approval cho Batch2A/2B, chưa chuẩn bị artifact COMMIT chạy production.** Draft không được chạy kể cả như rehearsal trong Batch1. Muốn thực hiện cần owner approval cho scope, exact execution target và verification/recovery plan; các execution preconditions trong plan vẫn phải đạt.

## 6. Closure và các trạng thái giữ nguyên

| Trạng thái | Kết quả sau Batch1 |
| --- | --- |
| Audit ban đầu | Hoàn tất trong phạm vi đã công bố, evidence giữ nguyên |
| Endpoint ↔ production relationship | **PROVEN** cho current production config/deployment/runtime đã ghi |
| Catalog read | **PASS_READ_ONLY_INSPECTION** qua authorized admin channel; password path28P01 không được sửa hoặc giả định đã hết lỗi |
| Root policy của students | **PROVEN**: `tenant_isolation_students` PUBLIC true + anonymous ACL |
| Anonymous DB access | **FAIL**, fresh GET tái xác nhận |
| Production Courses anonymous query | **FAIL**: no-session GET200/8 classrooms |
| Remediation | **NOT_EXECUTED / AWAITING_APPROVAL** |
| Authenticated browser → mutation → independent DB read-back | **BLOCKED** |
| Canonical business semantics | Một phần **NOT_PROVEN** |
| Full E2E / Go-Live | **NOT_PROVEN** |

E2E project hiện thiếu **31/32 bảng** thuộc containment allowlist trong catalog đã query, nên không thể lấy một run trên E2E hiện tại làm rehearsal đầy đủ cho production. Việc chuẩn bị isolated schema/fixtures là execution prerequisite cần scope rõ, không tự apply toàn bộ migration history để làm xanh.

Không mở lại toàn bộ11 gates trong Batch1; không ghi business rows; không chạy draft DDL; không thay endpoint503; không commit/push/deploy. Các bước xác minh/negative/positive tests để duyệt nằm trong plan, chưa được ghi là PASS.
