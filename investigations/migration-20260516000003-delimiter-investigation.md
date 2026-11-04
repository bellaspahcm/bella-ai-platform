# Điều tra: Migration 20260516000003 lỗi cú pháp

## Tóm tắt bàn giao

1. **Sự việc:** replay sạch cô lập dừng tại `20260516000003_fix_chat_rpc_ambiguous.sql` với PostgreSQL `42601`; hai delimiter dollar trong file bị escape thành `\$\$`.
2. **Kết quả:** Production ledger ghi nhận version này; E2E ledger không ghi nhận version này nhưng hai môi trường đều có các overload `get_chat_customers` với cùng thân hàm. Stack local đang chạy không có bảng ledger chuẩn.
3. **Bước kế tiếp:** giữ nguyên migration lịch sử; cần giải quyết lệch baseline/schema-history theo quy trình Phase 3 trong `docs/platform/MIGRATION_REPRODUCIBILITY_P0.md` trước khi replay sạch.

## Thông tin vụ việc

| Trường | Giá trị |
| --- | --- |
| Ngày | 2026-10-27 |
| Trạng thái | Chẩn đoán đạt; đường replay còn chặn |
| Worktree | `codex/preschool-teacher-schema-20261027` |
| Nguồn | SQL migration, Git history, migration census, ledger Supabase đọc chỉ, catalog hàm, log replay cô lập trước đó |

## Phạm vi

Xác định lỗi delimiter, provenance/checksum và trạng thái version trong local, E2E, Production. Không sửa migration lịch sử, không ghi DB, không thay đổi Production.

## Bằng chứng đã xác nhận

### 1. Lỗi cú pháp

**Nguồn:** `supabase/migrations/20260516000003_fix_chat_rpc_ambiguous.sql:1`.

File có `AS \$\$` và đóng bằng `\$\$;`; có hai cặp `\$\$`, không có cặp `$$` nguyên dạng. PostgreSQL hiểu dấu gạch chéo ngược ở ngoài dollar-quoted string; replay cô lập trước đó dừng đúng file này với SQLSTATE `42601`.

### 2. Lịch sử và checksum file

**Nguồn:** commit `e543d86d9a921db31305d9e83bb537b8e5cdd641`, commit `7106fa75de24d564ffdf06c8866683c10ee2a73c`, `HEAD`, `origin/main`.

- File ban đầu là UTF-16LE, 2.370 byte, SHA-256 thô `e0a932212f2a68f180f943f1a939787b765724ca8ce1e678359d847b3296c3fb`.
- Bản hiện hành ở Git là UTF-8, 1.185 byte, SHA-256 `602cab8c68bd3a4b71002775244aca22b4301bd7391d861a663d139daaeb2ccf`; Git blob SHA-1 `50243a2877a3d149b70477cc352b292cead731aa`.
- Sau giải mã và chuẩn hóa xuống dòng, nội dung Unicode của bản ban đầu và hiện hành giống hệt nhau; cả hai đều có delimiter bị escape. Commit `7106fa75d` chỉ đổi biểu diễn mã hóa, không sửa lỗi SQL.
- `HEAD` khớp `origin/main`. Bản trên đĩa Windows có CRLF nên SHA-256 vật lý khác checksum Git blob.
- Constitution tại `docs/governance/BELLA_AI_CODING_CONSTITUTION.md:714-717` cấm viết lại migration lịch sử. Migration census tại `docs/platform/P0_M1_MIGRATION_CENSUS.csv:31` phân loại migration là `Legacy/Unknown`.

### 3. Trạng thái migration theo môi trường

Các truy vấn dưới đây chỉ dùng `SELECT` qua Supabase CLI Management API, không đọc dữ liệu nghiệp vụ và không ghi DB.

| Môi trường | Bằng chứng ledger | Bằng chứng catalog | Kết luận |
| --- | --- | --- | --- |
| Production `lvnvkpyxtuilhrabtlwv` | Ledger có các version `20260515224956`, `20260516000002`, `20260516000003`, `20260606124500`. Version cần kiểm tra có tên `fix_chat_rpc_ambiguous`. | Có `get_chat_customers()` và `get_chat_customers(p_tenant_id uuid)`. | **Ledger ghi nhận version 20260516000003.** |
| E2E `bmnbqbcdbuklhopfbopv` | Không có bốn version trên; ledger có 163 dòng, từ `20260803200800` tới `20261026183000`. | Có cùng hai overload và cùng hash thân hàm như Production. | **Version không được ghi trong ledger; hàm hiện diện từ một nguồn khác hoặc baseline khác.** |
| Stack local `bella-preschool-course-20261022` | `supabase_migrations.schema_migrations` không tồn tại. | Chưa truy vấn catalog hàm local. | **Không xác định được trạng thái áp dụng từ stack này.** |
| DB replay dùng một lần | Replay dừng ở lỗi `42601`; không có status readback thành công. | Không có bằng chứng tạo xong hàm qua migration này. | **Replay thất bại; không phải trạng thái applied.** |

Ánh xạ Production/E2E đối chiếu theo `docs/audits/preschool-full-audit-20261020/batch2a-rpc-20261021/FINAL_REPORT.md:3` và `docs/architecture/PRODUCT_IDENTITY_CHECKPOINT_2026_09_19.md:307`.

### 4. Provenance trong Production ledger và lệch với catalog

Production `schema_migrations` lưu `statements` dạng mảng, không có cột SHA-256 của file. Dòng version này có 5 statement, tổng 1.179 byte và MD5 `3de22c045fe67f83b2808c77bc8f28c8`. MD5 này khớp với nội dung migration hiện tại sau khi tách theo dấu chấm phẩy, trim từng phần và nối bằng LF. Đây là bằng chứng nội dung statement được lưu trong ledger tương ứng với file hiện tại sau chuẩn hóa; nó không thay thế SHA-256 của file hay bằng chứng đường thực thi.

Catalog Production và E2E đều có hai overload với hash `prosrc` giống nhau:

- `get_chat_customers()`: 1.051 ký tự, MD5 `175ff10b58a9f2c8fbd11ac4894e0701`.
- `get_chat_customers(p_tenant_id uuid)`: 875 ký tự, MD5 `f26a439bdb8a37a8971214e3999472b3`.

Thân hàm zero-argument trích từ migration hiện tại dài 904 ký tự (MD5 sau trim `dc231d11b9b36dfc2f1b62086c471f25`), nên không khớp với thân hàm đang có ở hai DB. Repo chỉ tìm thấy định nghĩa no-argument trong migration lỗi này; các migration muộn hơn chỉ cấp quyền thực thi. **Vì vậy, version được ghi trong Production ledger không chứng minh thân hàm đang chạy được tạo bởi SQL hiện tại; nguồn chính xác của thân hàm đang chạy còn chưa rõ.**

## Kết luận

**Độ tin cậy:** cao về lỗi cú pháp và trạng thái version trong hai ledger từ xa; chưa đủ bằng chứng về lịch sử thực thi/function provenance.

- Lỗi gốc đã xác nhận: delimiter `\$\$` trong migration lịch sử.
- Production ledger ghi version là đã áp dụng; E2E ledger không ghi version nhưng catalog có cùng hàm như Production; stack local không có migration ledger.
- Production ledger statement digest khớp nội dung file sau chuẩn hóa, nhưng runtime function body khác nội dung migration. Không thể suy ra bằng chứng nào trong số này là sai; cần một nguồn deployment/provenance hoặc quyết định baseline có thẩm quyền để giải thích lệch trạng thái.
- Không sửa lịch sử và không thêm migration về sau để giả vờ khắc phục: trên replay tuyến tính sạch, parser dừng trước khi migration sau có thể chạy.

## Việc tiếp theo

`docs/platform/MIGRATION_REPRODUCIBILITY_P0.md` ghi Phase 1 là thu thập bằng chứng không sửa đổi; Phase 3 (chiến lược sửa) chưa thực thi và liệt kê baseline, squash hoặc sửa tuần tự như các lựa chọn. Do đó, bước đúng là thiết kế/chốt đường baseline hoặc reconciliation cho DB dùng một lần, đối chiếu Production schema với baseline E2E, rồi mới tạo DB thử nghiệm mới. Không reset stack local đang chạy, không áp migration lên DB dùng chung/Production.

## Những gì đã thay đổi

Chỉ thêm hồ sơ điều tra này vì thư mục artifact chuẩn chưa được cấu hình. Không sửa SQL/migration, không commit/push, không ghi DB. Các thay đổi Preschool khác đã có sẵn trong worktree được giữ nguyên.


## Follow-up: 2026-10-27 #2

### Kết quả đọc Phase 3 và B0

`docs/platform/MIGRATION_REPRODUCIBILITY_P0.md:235-250` phân loại lỗi này thuộc **Category E — Schema Drift** và cho bốn hướng: sửa tuần tự, baseline Production, squash, hoặc cấu hình môi trường. Cấu hình môi trường không xử lý được delimiter sai; sửa tuần tự sẽ đòi viết lại file lịch sử đang bị Constitution cấm; squash/archival quá rộng và trái yêu cầu giữ lịch sử. Hướng phù hợp nhất cho mục tiêu thử nghiệm là **Baseline reset từ Production, chỉ trên DB dùng một lần**.

B0 yêu cầu đối chiếu schema Production/E2E trước khi tạo canonical baseline (`docs/platform/P0_BASELINE_RECONCILIATION_B0.md:328-360`, `362-400`). Tình trạng “không có Production access” trong tài liệu tháng 9 đã cũ một phần: hiện có thể đọc ledger và catalog qua CLI Management API, nhưng chưa có schema-only dump hoặc reconciliation toàn bộ public schema. Vì vậy chưa được sinh baseline.

B0 có các đoạn ledger cũ nói `_prisma_migrations` (`:72-98`), nhưng phần sau đã sửa rõ migration runner và ledger thực tế là Supabase CLI / `supabase_migrations.schema_migrations` (`:438-478`); truy vấn trực tiếp Production/E2E xác nhận phần sau. Dùng ledger Supabase, không dùng `_prisma_migrations`.

B0 B2 đề xuất archive chuỗi migration cũ (`:305-317`). Không áp dụng bước đó trong worktree này: phạm vi đã chốt yêu cầu giữ nguyên lịch sử và không sửa migration.

### Bằng chứng bổ sung

- `bookings.package_name` có mặt ở cả Production và E2E.
- `get_my_tenant_id()` có mặt ở cả hai: không tham số, trả `uuid`, SQL, `SECURITY INVOKER`; thân hàm dài 63 ký tự và MD5 `1db6de333d2c72135bd6b3d29332bbd8` ở cả hai.
- Do đó Production-based disposable baseline đã có sẵn hai tiền đề này. Không áp lại hai migration tiền đề sau khi import baseline; giữ nguyên chúng trong nhánh cho đường replay từ historical chain.
- Nguồn thân hàm `get_chat_customers()` vẫn chưa được xác định: Production và E2E có thân hàm giống nhau, nhưng khác thân hàm trong migration Git. Tìm trong SQL/docs/scripts không thấy định nghĩa no-argument khác trong repo.

### Phương án Phase 3 đề xuất

1. **Đóng băng nguồn:** giữ nguyên file lịch sử, migration ledger, hồ sơ điều tra và các thay đổi Preschool trong worktree.
2. **Lấy schema-only theo B0 Option D/C:** so sánh Production với E2E trên các thành phần B0 liệt kê: tables/columns, constraints, indexes, types, routines, views, RLS policies, extensions và ledger. Chỉ metadata/schema, không dump dữ liệu nghiệp vụ. Production là chuẩn đích cho baseline; E2E chỉ là nguồn đối chiếu.
3. **Chốt các khác biệt có provenance thiếu:** với `get_chat_customers()`, lưu định nghĩa catalog hiện tại từ hai DB và đối chiếu trực tiếp với Git. Nếu Production/E2E cùng một định nghĩa nhưng không có migration nguồn, ghi nó là trạng thái baseline quan sát được, không tuyên bố migration lịch sử đã tạo ra nó.
4. **Dựng một DB local dùng một lần từ schema-only Production:** baseline phải chứa đúng schema hiện thời, ACL/RLS và hàm runtime đã đối chiếu; không nhập dữ liệu. Sau đó áp các migration Preschool cần kiểm chứng và tạo fixture Auth/tenant/teacher tổng hợp.
5. **Giới hạn bằng chứng:** cách này kiểm chứng baseline + delta Preschool, không tự chứng minh toàn bộ 459-file lịch sử có thể chạy từ rỗng. Không pre-seed ledger trên E2E/Production, không archive/squash lịch sử, không ghi DB dùng chung/Production.
6. **Chỉ sau schema diff đạt:** chạy replay trên DB dùng một lần, kiểm tra object/ACL/RLS, rồi JWT và Browser E2E như kế hoạch Preschool.

### Trạng thái sau follow-up

- `PHASE3_STRATEGY`: `PROPOSED_BASELINE_RESET_FROM_PRODUCTION / DISPOSABLE_DB_ONLY`.
- `FULL_PRODUCTION_E2E_SCHEMA_DIFF`: `NOT_DONE`.
- `GET_CHAT_CUSTOMERS_RUNTIME_PROVENANCE`: `NOT_PROVEN`.
- `BASELINE_GENERATION / REPLAY`: `NOT_STARTED`.
- Shared DB/Production: không ghi dữ liệu trong lượt này.
- Source code, SQL migration và governance docs: không sửa trong lượt này; chỉ cập nhật hồ sơ điều tra.

## Follow-up: 2026-10-27 #3 — B0 schema-only diff Production/E2E

### Phạm vi và cách thu thập

Đã truy vấn chỉ đọc qua Supabase CLI Management API vào đúng hai project:

- Production: `lvnvkpyxtuilhrabtlwv`
- E2E: `bmnbqbcdbuklhopfbopv`

Truy vấn chỉ đọc catalog và `supabase_migrations.schema_migrations`; không chọn hàng nghiệp vụ, không chạy DDL/DML, không export DB data. Inventory bao gồm object trong schema `public`, extension đã cài, ACL/default ACL/role membership liên quan và migration ledger. Hash dùng để so định nghĩa routine/policy hoặc thuộc tính schema; không lưu thân SQL trong ma trận.

Các nhóm đã so: relation, column, constraint, index, type, function/aggregate, view, extension, RLS policy, trigger, ACL, default ACL, role membership, sequence và ledger. Đã tách thêm facet relation (owner/RLS/ACL/...) và function (signature/definition/owner/EXECUTE/security attributes). Các lỗi truy vấn ban đầu được sửa ở câu SELECT thuần đọc rồi chạy lại; snapshot cuối không còn nhóm truy vấn nào lỗi.

B0 hiện đối chiếu schema `public`; các schema Supabase quản lý như `auth`, `storage`, `realtime`, `vault` chưa nằm trong phạm vi này và vẫn là `NOT_PROVEN`. Không dùng kết quả này để kết luận toàn bộ Supabase đã khớp.

### Ma trận tổng hợp

`MATCH` = cùng object và fingerprint khớp; `DIFFERENT` = object có ở cả hai nhưng fingerprint khác; `MISSING` = chỉ có ở một phía (hướng được ghi cụ thể); `NOT_PROVEN` = không thu được bằng chứng cho nhóm đó.

| Nhóm | Object | MATCH | DIFFERENT | MISSING | MISSING ở E2E | MISSING ở Production |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Relations | 576 | 0 | 229 | 347 | 295 | 52 |
| Columns | 7,870 | 2,992 | 81 | 4,797 | 4,145 | 652 |
| Constraints | 3,091 | 1,300 | 15 | 1,776 | 1,316 | 460 |
| Indexes | 2,223 | 804 | 5 | 1,414 | 1,221 | 193 |
| Types | 43 | 17 | 0 | 26 | 26 | 0 |
| Functions | 692 | 223 | 136 | 333 | 272 | 61 |
| Aggregates | 4 | 0 | 0 | 4 | 4 | 0 |
| Views | 23 | 5 | 0 | 18 | 18 | 0 |
| Extensions | 8 | 6 | 0 | 2 | 2 | 0 |
| RLS policies | 718 | 236 | 35 | 447 | 293 | 154 |
| Triggers | 273 | 133 | 0 | 140 | 118 | 22 |
| ACL entries | 23,317 | 5,235 | 0 | 18,082 | 16,931 | 1,151 |
| Default ACLs | 3 | 1 | 2 | 0 | 0 | 0 |
| Role memberships | 25 | 22 | 0 | 3 | 3 | 0 |
| Sequences | 2 | 0 | 0 | 2 | 1 | 1 |
| Migration ledger | 555 | 26 | 25 | 504 | 392 | 112 |
| Function facets | 2,768 | 1,259 | 177 | 1,332 | 1,088 | 244 |
| Relation facets | 4,032 | 1,372 | 231 | 2,429 | 2,065 | 364 |

Mỗi nhóm tổng hợp có ít nhất một sai khác, nên trạng thái nhóm là `DIFFERENT`; từng object bên trong được phân loại theo bốn trạng thái trên. Với ACL, `MISSING` là một grant tuple có ở một phía nhưng không phía kia; một phần các tuple đó thuộc object vốn chỉ tồn tại ở một môi trường.

### Sai khác Preschool cần giải thích trước khi baseline

- `teacher_assignments` có ở hai DB và RLS bật ở cả hai; `FORCE RLS` tắt ở cả hai. Production có policy `teacher_assignments_tenant_isolation`, E2E không có policy này và thay vào đó có CHECK `teacher_assignments_e2e_legacy_unavailable` buộc `course_id IS NULL`. Production có FK `course_id → courses(course_id) ON DELETE CASCADE`; E2E không có FK đó. FK tenant là `ON DELETE CASCADE` tại Production nhưng `ON DELETE RESTRICT` ở E2E. Các cột được đặt theo thứ tự khác nhau; `effective_start_date` có default `CURRENT_DATE` tại Production nhưng không có default ở E2E.
- Bốn bảng `edu_attendance`, `edu_courses`, `edu_enrollments`, `teacher_assignments` có ACL khác nhau. Ví dụ, catalog Production ghi grant relation-level rộng cho `anon`/`authenticated` trên `edu_attendance` và `teacher_assignments`; E2E chỉ ghi owner/service-role cho `edu_attendance` và owner cho `teacher_assignments`. RLS đang bật nhưng không bị FORCE ở hai DB. Đây là khác biệt ACL/RLS cần đối chiếu theo JWT và policy; inventory này **không** chứng minh đã khai thác được hay đã an toàn.
- E2E có các policy kiểm thử `e2e_care_*` và `roster_rpc_*` trên `edu_courses`, `edu_enrollments`, `edu_attendance_daily_state`; Production không có cùng bộ policy. Production có một số policy tenant-isolation không hiện diện hoặc khác định nghĩa ở E2E. E2E có policy chọn branch-assignment; Production ledger/catalog không cho thấy cùng policy đó.
- `edu_set_daily_attendance(...)` tồn tại hai nơi nhưng definition khác (hash MD5 của `pg_get_functiondef`: Production `0bd77a772ef098df2f09ba02bd58ec5e`, E2E `a1fa9a135f3a76a9c8433ee227ec2db6`). Cả hai là `SECURITY DEFINER`, cùng owner `postgres` và cùng nhóm EXECUTE chính; `search_path` Production là `public`, E2E là chuỗi rỗng. Cần giải thích body/thuộc tính trước khi xem E2E là đại diện cho Production.
- `edu_can_access_attendance_enrollment(...)`, `edu_attendance_can_read_course(...)` và `edu_preschool_roster_identity(...)` có ở E2E nhưng thiếu ở Production. Các hàm E2E này là `SECURITY DEFINER`; chúng không thể được coi là đã có trên Production hoặc tự được kế thừa từ baseline Production.
- `platform_assert_active_branch_for_actor(...)` có ở cả hai nhưng definition khác (1179 ký tự tại Production, 1164 tại E2E); cả hai là `SECURITY DEFINER`, `search_path` rỗng, quyền EXECUTE catalog khớp.
- `preschool_classrooms`, `preschool_enrollments`, `preschool_students` có trong Production nhưng thiếu ở E2E. `preschool_teacher_branch_confirmations`, hai bảng chain assignment và `preschool_course_create_receipts` có ở cả hai nhưng ACL khác. Chưa chốt các object này là phụ thuộc cần thiết hay khác biệt môi trường được bỏ qua.
- `pg_cron` và `vector` có tại Production, không có ở E2E. Default ACL cho bảng và sequence trong schema `public` khác; ba role membership `bella_developer`, `bella_migration_executor`, `verification_executor` của `postgres` chỉ có tại Production.

### Ngoại lệ `get_chat_customers()`

Đối chiếu catalog lần này xác nhận cả hai overload tồn tại ở hai DB, cùng owner, cùng thuộc tính `SECURITY DEFINER`, và hash definition giống nhau giữa Production/E2E. Production có thêm grant EXECUTE cho `bella_migration_executor`; E2E không có grant này.

Ledger Production có `20260516000003 / fix_chat_rpc_ambiguous` với 5 statement; E2E không có version đó. File Git tương ứng vẫn có delimiter escape `\$\$`, và thân hàm runtime không khớp thân hàm trong file Git như đã ghi ở phần điều tra trước. Kết luận giữ nguyên: ledger, Git và runtime không chứng minh được provenance của thân hàm; không suy ra nguồn tạo runtime function.

### Phân loại sử dụng cho DB thử nghiệm dùng một lần

1. Có thể xem là **ứng viên khác biệt môi trường**: object/extension/role thuộc miền sản phẩm khác hoặc artifact test-only, nhưng chỉ sau khi chứng minh chúng không nằm trong dependency closure của Preschool và không làm thay đổi kết quả quyền.
2. Cần giải thích trước baseline: mọi khác biệt trên `teacher_assignments`, attendance RPC, RLS policy, ACL/default ACL và các helper branch/roster; các version ledger cùng số nhưng khác digest; function runtime `get_chat_customers()` chưa có provenance.
3. Không tự động chấp nhận chỉ vì DB là dùng một lần: RPC/policy chỉ có ở E2E nhưng cần cho Preschool phải được truy nguyên tới migration/contract canonical. Object chỉ có ở Production có thể nằm trong schema baseline từ Production, nhưng việc bỏ chúng khỏi bài E2E cần dependency closure được xác nhận.

### Trạng thái

- `B0_PUBLIC_SCHEMA_DIFF`: `COMPLETE_WITH_DIFFERENCES`.
- `SUPABASE_MANAGED_SCHEMAS`: `NOT_PROVEN`.
- `GET_CHAT_CUSTOMERS_RUNTIME_PROVENANCE`: `NOT_PROVEN`.
- `BASELINE_GENERATION`: `NOT_STARTED`.
- `REPLAY`: `NOT_STARTED`.
- Shared DB/Production: chỉ đọc catalog/ledger; không ghi.
- Hai migration tiền đề trong worktree và mọi thay đổi trước đó: giữ nguyên; không sửa migration lịch sử, không commit/push.

## Follow-up #4 — Dependency closure và hợp đồng DB mục tiêu cho Preschool

Phần này thay thế đề xuất baseline Production toàn schema ở Follow-up #2 cho mục tiêu hiện tại. Kết quả B0 toàn `public` chỉ là dữ liệu tham chiếu; quyết định hiện tại là thu hẹp theo dependency closure Preschool, chưa tạo baseline và chưa chọn Production hoặc E2E làm chuẩn mặc định.

### Phạm vi và nguồn chuẩn

Ngày 2026-10-27, tiếp tục truy vấn catalog/ledger chỉ đọc trên Production `lvnvkpyxtuilhrabtlwv` và E2E `bmnbqbcdbuklhopfbopv`, thu hẹp vào các bảng, hàm, policy, ACL và version migration trong đường lớp → ghi danh → giáo viên → điểm danh. Không đọc hàng nghiệp vụ, không chạy DDL/DML, không tạo baseline hay replay.

Hợp đồng mục tiêu lấy từ nguồn sở hữu và migration/contract trong repository, không lấy một runtime snapshot làm chuẩn mặc định:

- Party/Platform giữ danh tính người và Auth link; Education sở hữu `edu_courses`, `edu_enrollments`, `teacher_assignments` và attendance contract; Preschool sở hữu xác nhận giáo viên theo chi nhánh cùng các bảng ánh xạ course/enrollment → branch. Nguồn: `ARCHITECTURE_GATE_RESULT_TEACHER.md` và Education Attendance caller ACR.
- Luồng Auth giáo viên dùng `party_resolve_current_auth_link()`; không suy Auth subject từ Party. Migration `20261026170000_party_auth_identity_links.sql` định nghĩa relation/grant và public RPC; migration `20261026183000_integrate_preschool_teacher_attendance.sql` tiêu thụ contract đó.
- Hồ sơ teacher clean-provisioning đã được chủ sản phẩm chọn theo profile tương thích legacy: migration chain tạo `teacher_assignments.course_id → courses.course_id`; candidate chuẩn là `20261027010000` + `20261027010100` + `20261027010200`. Bootstrap rỗng E2E `011-empty-e2e-bootstrap.sql` không thuộc chuỗi chuẩn.

### Dependency closure và target contract

| Chặng | Nguồn dữ liệu/quan hệ cần có | Hợp đồng DB cần kiểm chứng khi dựng DB cô lập |
| --- | --- | --- |
| Người gọi, tenant, chi nhánh | `auth.users` (Supabase-managed), `users`, `tenants`, `org_units`, `user_org_unit_access`, `party_parties` | JWT là nguồn actor; tenant phải được suy từ actor hiện hành; branch phải active, thuộc đúng tenant và có quyền truy cập. Helper branch phải đối chiếu theo migration Platform được chọn. Public-schema B0 không so sánh định nghĩa bên trong schema `auth`. |
| Lớp và branch mapping | `edu_courses`, `preschool_chain_course_branch_assignments`, `preschool_course_create_receipts`, `platform_assert_active_branch_for_actor()` | Course là canonical Education course; một course có mapping branch xác định; tạo course đi qua `edu_create_preschool_course()` với quyền gọi `service_role`, không ghi trực tiếp từ UI. Branch-map đọc qua SELECT đã cấp và policy `preschool_course_assignment_visible`; ghi qua command server-side. |
| Enrollment/roster | `edu_enrollments`, `students`, `party_parties`, `preschool_chain_enrollment_branch_assignments`, `edu_preschool_roster_identity()`, `edu_can_access_attendance_enrollment()` | Enrollment phải nối đúng tenant/course/Party học sinh; enrollment branch map phải khớp course map. Roster chỉ trả phạm vi được xác thực theo ngày, actor, tenant và branch; thiếu/đa mapping phải fail closed. |
| Teacher | `party_auth_links`, `party_identity_link_managers`, `preschool_teacher_branch_confirmations`, `teacher_assignments`; RPC Party và các RPC teacher | Auth ↔ Party được resolve qua public contract; admin xác nhận Party người thật theo branch/ngày; assignment trỏ canonical `edu_courses` và confirmation cùng teacher Party. Candidate chuẩn giữ legacy `course_id` FK, thêm đúng một canonical course identity, lưu lịch sử, chặn assignment canonical trực tiếp qua restrictive policy và gọi command theo quyền `service_role`. Chấm dứt assignment canonical phải có `effective_end_date`. |
| Attendance | `edu_attendance`, `edu_attendance_daily_state`, hai branch-map, `preschool_teacher_can_attend_course()`, `preschool_teacher_attendance_courses()`, `edu_set_daily_attendance()` và các predicate/roster RPC | Teacher chỉ thấy/ghi lớp đang được xác nhận và phân công, trong tenant/branch hiện hành và ngày học cho phép. Ghi attendance qua RPC nguyên tử; authenticated/anon không có đường ghi trực tiếp vào bảng attendance/state; state read dùng SELECT + RLS branch-scoped. `SECURITY DEFINER` phải tự kiểm tra actor/quyền, không dựa riêng vào RLS. |

Đây là dependency closure cho hành trình Preschool đang nghiệm thu, không phải danh mục toàn bộ schema Bella. Các cột còn lại của 7.870 cột chỉ cần đưa vào nếu FK, function, policy hoặc public caller trong closure tham chiếu tới chúng.

### Ma trận sai khác B0 trong closure

| Nhóm | Bằng chứng Production / E2E | Phân loại và quyết định cho target |
| --- | --- | --- |
| Auth ↔ Party | `party_auth_links`, `party_identity_link_managers` và ba RPC `party_confirm_auth_link`, `party_revoke_auth_link`, `party_resolve_current_auth_link` có ở E2E; Production không có relation/RPC/version `20261026170000`. E2E bật RLS, không cấp ACL bảng cho app role; RPC cho `authenticated`. | **Thiếu trong Production; có trong E2E.** Đây là dependency thật của luồng giáo viên theo migration `20261026183000`, không phải phần mở rộng suy đoán. Target lấy từ migration/contract Party đã duyệt; chưa kết luận Production đã sẵn sàng. |
| Course create | `edu_create_preschool_course(...)` có cả hai nơi, cùng definition hash `d5b484ac1dafc41dbb93d532a66c788a`, `SECURITY DEFINER`, `search_path=''`, EXECUTE cho `service_role`. | **MATCH runtime giữa hai DB** cho command này; tiếp tục lấy source migration `20261025070000` làm contract. |
| Course tenant RLS | Cả hai bật RLS. Production policy `edu_courses_tenant_isolation` dùng `get_auth_tenant_id()`; E2E dùng `current_setting('app.current_tenant_id', true)`. Git migration `20260927020000_fix_course_rls_auth_tenant_helper.sql` định nghĩa policy dùng `get_auth_tenant_id()`. E2E còn có `e2e_care_course_*` không có migration source trong chain chuẩn. | Policy target được xác định bởi migration sửa RLS trong Git; vì vậy Production khớp biểu thức đó, E2E chưa khớp. `e2e_care_course_*` là overlay của môi trường E2E, không đưa vào baseline chuẩn. ACL trực tiếp của `edu_courses` khác đáng kể và chưa được chọn từ một trong hai DB; cần đối chiếu quyền caller khi dựng target sạch. |
| Course/enrollment branch maps | Hai relation có ở cả hai DB. E2E có `preschool_chain_course_branch_select` và `preschool_chain_enrollment_branch_select`, cùng authenticated SELECT; Production thiếu hai policy/grant authenticated này. Git migration `20261019030000_preschool_chain_branch_security.sql` tạo đúng hai policy và giới hạn authenticated thành SELECT. | **Production thiếu phần contract hiện có trong migration; E2E gần target hơn ở nhánh này.** Baseline phải theo migration, không theo ACL Production. Không cấp quyền ghi trực tiếp cho authenticated. |
| Enrollment RLS | `edu_enrollments` bật RLS và tenant policy `current_setting(...)` hiện có ở cả hai. E2E thêm `e2e_care_enrollment_*` và `roster_rpc_enrollment_guard`; không tìm thấy migration Git tạo hai nhóm policy này trên `edu_enrollments`. | Giữ tenant policy theo migration tạo Education schema. `roster_rpc_enrollment_guard` và `e2e_care_*` hiện là E2E-only/provenance chưa rõ, nên không đưa vào target migration baseline nếu chưa tìm được nguồn canonical. ACL `edu_enrollments` hai nơi khác nhau; chưa suy rộng quyền ghi từ snapshot nào. |
| Daily attendance state RLS/ACL | Production có `edu_attendance_daily_state_tenant_isolation` nhưng thiếu `roster_rpc_state_allow/guard`; E2E có cặp `roster_rpc_*` nhưng thiếu tenant policy gốc, đồng thời có `e2e_care_attendance_select`. Production không có authenticated SELECT; E2E có SELECT. Migration `20260926003000` tạo tenant policy; `20261026152000` giữ policy đó, thêm cặp branch-roster policy và authenticated SELECT, đồng thời preflight cấm authenticated direct write. | **Không DB nào đại diện đầy đủ target.** Target là tổ hợp do migration chain định nghĩa: tenant policy + roster allow/guard + authenticated SELECT; không có anon read hoặc authenticated direct write. `e2e_care_attendance_select` bị loại khỏi target. |
| Attendance command và helpers | `edu_set_daily_attendance(...)` có ở cả hai, cùng EXECUTE `authenticated`/`service_role`, nhưng hash body khác: Production `0bd77a772ef098df2f09ba02bd58ec5e`, `search_path=public`; E2E `a1fa9a135f3a76a9c8433ee227ec2db6`, `search_path=''`. E2E có thêm `edu_can_access_attendance_enrollment`, `edu_preschool_roster_identity`, `preschool_teacher_attendance_courses`, `preschool_teacher_can_attend_course`; Production thiếu. Các hàm được định nghĩa trong migration `20261026152000`/`20261026183000`. | **Khác biệt trực tiếp, target theo migration/ACR, chưa xác minh hash nào khớp source.** Không dùng body Production hay E2E làm chuẩn. Runtime E2E có đủ helpers theo migration nhưng vẫn phải kiểm tra các policy/ACL đi cùng. |
| Function `edu_attendance_can_read_course` | Có ở E2E, thiếu ở Production; không tìm thấy caller trong code Preschool/Education hiện tại hoặc nguồn tạo trong migration chuẩn. | `NOT_IN_CURRENT_CALL_GRAPH / PROVENANCE_NOT_PROVEN`; không đưa vào baseline trừ khi tìm được consumer/migration canonical. |
| Teacher confirmation/assignment | Cả hai có relation confirmations, canonical columns/FKs và các RPC quản lý teacher hiện diện với cùng hash giữa hai DB. Production có legacy FK `course_id → courses(course_id)` và tenant isolation policy; E2E có check E2E-only `course_id IS NULL`, thiếu FK legacy và policy tenant. `effective_start_date` có default `CURRENT_DATE` ở Production, không có ở E2E. | **Profile được chốt bằng nguồn migration, không chọn theo số lượng cột.** Chuỗi chuẩn bắt đầu từ `20260813000050` rồi mở rộng tương thích bằng `20261027010000`/`10100`/`10200`; bỏ check chỉ dành cho profile `011`. Production gần legacy base hơn nhưng ACL/policy/default còn phải so với kết quả replay sạch. Hai snapshot đều chưa ghi ledger các version chuẩn `20261027010000–10200`; việc relation/function có sẵn không chứng minh nguồn provisioning. |
| Branch-authority helper và tenant helpers | `platform_assert_active_branch_for_actor(...)` khác definition hash Production `3e06c959c27966bb354874a817c7c2d1` / E2E `44e49ce7bb3cb4d3ae72c8db8741bbeb`; owner, `SECURITY DEFINER`, `search_path=''`, EXECUTE `postgres/service_role` giống nhau. `get_auth_tenant_id()` và `get_my_tenant_id()` có cùng body hash giữa hai DB; Production có thêm EXECUTE cho role vận hành `bella_migration_executor`. | Branch helper: **body chưa được chứng minh khớp source canonical**, đối chiếu migration Platform đã chọn trước khi baseline. Tenant helper: **body MATCH**, grant cho role vận hành là môi trường-specific; không chép grant runner vào Product ACL. |
| Attendance direct-table privileges | Production catalog ghi authenticated có table privileges rộng trên `edu_attendance`; E2E không có grant bảng đó. Trên daily state Production thiếu authenticated SELECT, E2E có SELECT. RLS bật nhưng `FORCE RLS` tắt ở các relation được kiểm tra. | Catalog ACL không chứng minh khai thác hoặc quyền hiệu lực cuối cùng, nhưng là sai khác cần giữ trong acceptance. Target của migration `20261026152000` cấm direct authenticated/anon writes và giữ quyền đọc/worker đã preflight; phải xác minh bằng JWT sau khi dựng sạch. |

### Cách thu hẹp baseline

1. Không copy toàn bộ schema Production hoặc E2E. Dùng dependency closure ở trên và chuỗi migration chuẩn làm input; object ngoài closure giữ `NOT_ASSESSED` tới khi phát hiện tham chiếu thật.
2. Giữ policy E2E-only, role vận hành và extension ngoài closure ở nhóm environment-only; không mang chúng vào target chỉ vì tồn tại trong một snapshot.
3. Giữ các sai khác attendance RPC, branch helper, teacher legacy profile và Auth link như các acceptance check rõ ràng. Production/E2E đều không được dùng làm canonical thay cho migration/contract.
4. Baseline/replay vẫn **chưa thực hiện**. Clean migration-chain replay trước đây dừng ở migration lịch sử `20260516000003` với `42601`; không sửa migration lịch sử, không thêm cách bỏ qua migration. Đây là blocker của việc tạo DB sạch, tách biệt với việc B0 đã hoàn tất phân loại dependency Preschool.

### Trạng thái follow-up

- `PRESCHOOL_DEPENDENCY_CLOSURE`: `MAPPED_FROM_CURRENT_CALLERS_AND_MIGRATIONS`.
- `PRESCHOOL_TARGET_DB_CONTRACT`: `DERIVED_FROM_APPROVED_OWNERSHIP_AND_MIGRATION_SOURCES`; không tạo contract mới.
- `B0_PRESCHOOL_SCOPE`: `COMPLETE_WITH_DIFFERENCES`; cả Production và E2E có phần lệch target khác nhau.
- `BASELINE_GENERATION`: `NOT_STARTED`.
- `CLEAN_REPLAY`: `BLOCKED_AT_HISTORICAL_20260516000003_42601`.
- `JWT/RLS_AND_BROWSER_E2E`: `NOT_PROVEN`.

## Follow-up #5 — Cơ chế bootstrap DB dùng một lần trong repository

### Cơ chế đã kiểm tra

- `supabase/config.toml` bật migration và seed theo mặc định (`schema_paths=[]`, seed `./seed.sql`). `supabase db reset` vì vậy không phải cách dựng riêng Preschool: nó chạy chuỗi lịch sử đầy đủ cùng seed demo Bella Spa; replay hiện đã dừng ở `20260516000003` với `42601`.
- Workflow CI hiện có gọi `scripts/ci/preschool-t1-fixture.sh`; `ci-tests.yml` còn có `workflow_dispatch` riêng cho T1. Script tạo Supabase project riêng trong `RUNNER_TEMP`, đổi cổng, tắt migrations/seed tự động, áp một schema T1 trong transaction có rollback kiểm chứng, ghi receipt và chỉ dọn container/volume có ownership marker. Đây là cơ chế cô lập có thể tái sử dụng.
- Nội dung T1 không phải baseline Browser E2E Preschool: nó giới hạn 30 quan hệ và ba suite allowlist; schema ghi rõ chưa có nguồn chuẩn Auth → teacher Party và giữ `admin_staff` ở trạng thái từ chối. Nó không chứa Auth–Party/teacher contract đầy đủ cần kiểm chứng theo Follow-up #4.
- Tài liệu B0 có ví dụ baseline toàn schema từ `db dump` và ghi version baseline vào `supabase_migrations.schema_migrations`. Đây là phương án lịch sử ở cấp toàn nền tảng, phụ thuộc chọn Production/E2E làm nguồn và thay đổi ledger; không phải cơ chế được chọn cho Preschool closure hiện tại. Không dùng cách này để đánh dấu migration lịch sử là đã chạy.
- Source trace cũng cho thấy không thể replay máy móc mọi migration liên quan: `20260613100000_create_student_training_foundation.sql` định nghĩa `courses.id`, trong khi `20260810231500_create_courses_and_enrollments.sql` định nghĩa legacy Education `courses.course_id`; cả hai cùng dùng tên `public.courses`. Migration `20260810224417_create_students_table.sql` có `DROP TABLE ... CASCADE`, còn migration R3 `20260912000000_r3_education_identity_cutover.sql` yêu cầu đúng 848 identity mappings đã seal. Vì target Preschool dùng `courses.course_id` và roster đọc `students.party_id`, profile phải mô tả schema đích Education sau các chuyển đổi đó; không chạy profile Student Training cạnh tranh, không giả tạo 848 mapping để vượt preflight, và không tuyên bố đã replay R3.

### Phương án được chọn cho DB nghiệm thu Preschool

Tái sử dụng **vòng đời runner/stack cô lập** của T1, nhưng tạo profile riêng cho Preschool Browser acceptance thay vì tái sử dụng schema T1 hoặc chạy `db reset` toàn repository. Profile cần có manifest và hash cho từng migration nguồn; bootstrap chỉ dựng dependency closure trước các migration đang nghiệm thu từ nguồn migration/contract đã xác định. Các migration Preschool cần nghiệm thu phải được áp như migration thật, theo thứ tự, trên stack sạch của profile. Không nhập dữ liệu Production/E2E, không chạy `seed.sql`, không chép nguyên schema của một môi trường, không giả ghi ledger cho migration ngoài profile, không sửa/bỏ migration lịch sử. Runner phải dùng project/volume mới, xác minh endpoint/ownership trước thao tác, lưu receipt không chứa credential và dọn đúng tài nguyên do run sở hữu kể cả khi lỗi.

Đây là **test-only scoped bootstrap**, không phải bằng chứng `empty database → toàn bộ lịch sử migrations` đã được sửa. Repository hiện chưa có profile/schema bootstrap đầy đủ cho Browser E2E giáo viên; do đó chưa thể chạy JWT/RLS hoặc browser acceptance bằng fixture T1 hiện có. Việc tạo profile mới phải giữ nguyên ranh giới này, ghi rõ trạng thái post-migration nào được dựng làm baseline, rồi áp các migration Preschool đang nghiệm thu như migration thật; DDL dependency nào chưa có nguồn migration phải được truy nguyên trước khi chốt schema. Không tự sao chép từ Production/E2E để lấp khoảng trống và không đánh dấu các migration lịch sử là đã chạy.

### Kết luận và trạng thái

- `REPOSITORY_SUPPORTED_FULL_PRESCHOOL_BOOTSTRAP`: `NOT_FOUND`.
- `REUSABLE_ISOLATION_LIFECYCLE`: `AVAILABLE_T1_ONLY`.
- `SELECTED_DISPOSABLE_APPROACH`: `DEDICATED_PRESCHOOL_CLOSURE_PROFILE_REQUIRED`; chưa tạo profile hoặc stack.
- `CLEAN_REPLAY`: `BLOCKED_AT_HISTORICAL_20260516000003_42601`; không có đường hợp lệ hiện tại để gọi full reset là thành công.
- `JWT/RLS_AND_BROWSER_E2E`: `NOT_PROVEN`.
- Shared DB/Production: không kết nối ghi; không thay đổi ledger hay dữ liệu.
