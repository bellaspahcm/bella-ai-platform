# Preschool — phân loại theo nguyên tắc bảo toàn hiện trạng

Ngày 01-11-2026. Baseline `main`: `f1299e3138f3700062a1ed84271db315737b0071`. Nhánh local `codex/preschool-main-technical-20261101` dùng worktree audit riêng. Audit 31-10 và live catalog 01-11 là đầu vào; kết quả source/local không thay thế kiểm thử caller hoặc runtime Production.

WIP remediation trong `D:/Antigravity/Projects/BELLA SPA ERP` được bảo toàn. Không tự port các thay đổi unavailable/fail-closed từ WIP đó vào main. Đặc biệt F08/F11 giữ nguyên theo phạm vi mới. Không deploy, apply migration, mở grants, thêm role hoặc sửa dữ liệu.

## Phân loại và điều kiện trước/sau

| Mã | Phân loại hiện tại | Sửa tối thiểu / giới hạn |
| --- | --- | --- |
| F01 | Technical error/integrity work có thể thiết kế; semantics Finance còn thiếu | Không đổi phí, kỳ thu, điều kiện activation hoặc admission mode. Source có fallback/fixed fee và nhiều lần ghi; chưa có canonical atomic fee/activation command được xác lập. Không coi thay endpoint bằng 503 là giữ nguyên workflow. Giữ implementation dependent held khi chưa chứng minh được success path tương đương. |
| F02 | Error/persistence là technical; assessment/award semantics cần contract | Không mặc định thiếu dữ liệu là achievement, nhưng không tự đặt rule học tập mới. Award hiện chỉ tạo object; không tự tạo persistence model hoặc quyết định award eligibility. Không port WIP unavailable/unknown/month behavior thành một gói tự động. |
| F03 | Đợt 2 — quyền đọc | Owner contract hiện có giữ private chat unavailable; đó là căn cứ cụ thể để đối chiếu, không phải quyền chat mới. Chưa triển khai thay đổi read scope trong đợt kỹ thuật này. |
| F04 | Đợt 2 — identity và quyền gửi | Reuse Party self-resolve; identity không cấp guardian/thread permission. Không tạo mapping Auth UUID thành Party hoặc bật capability chat. |
| F05 | Đợt 2 — quyền chưa chốt | Matrix mới vẫn là đề xuất. Reuse canonical assignment, không đổi literal role DB, không mở Curriculum/Menu ACL hoặc thêm Learning predicates theo suy đoán. |
| F06 | Đợt 2 — contract có căn cứ rõ | Authorization Contract mục 10 đã duyệt admin/all-active-branch và same-ID/content retry, changed-content conflict. Có thể thiết kế theo quyết định đó mà không xin duyệt lại cùng rule; apply Production, ACL/migration execution và runtime proof vẫn là authority riêng. Candidate WIP chưa được áp dụng. |
| F07 | Đợt 2 — Finance access boundary | Đối chiếu canonical branch RPC và hành vi fallback/ALL; không tự coi bỏ fallback là tương đương cho mọi caller. Chưa port thay đổi phạm vi Finance trong lượt này. |
| F08 | Đợt 3 — giữ nguyên main | Không chạy seed hoặc xóa dữ liệu. Chưa xác định seed/hardcode là prototype hay operational workflow; không thay handler trong đợt này. |
| F09 | Đợt 1 — thiết kế persistence giữ nguyên behavior | Code hiện upsert các ngày được gửi và giữ ngày bị lược; status/approved_by theo payload hiện hành. Đó là preservation target, không phải đề xuất replace/archive mới. Transaction cần adapter DB và proof rollback; compensation không được báo là atomic. Không áp migration vào target Production vừa đọc catalog. |
| F10 | Đợt 1 — đủ căn cứ để kiểm tra response compatibility | Giữ input, success body/message và HTTP error envelope hiện có. Xác nhận affected row tại service; zero-row đi existing failure envelope, không tự đổi sang 404/409 hoặc tạo status API mới. Tests phải giữ success path và denial/error paths. |
| F11 | Đợt 3 — giữ nguyên main | Không nối persistence, đổi local-state handlers hoặc redesign UI. WIP unavailable trước đây không nằm trong scope port tự động. |
| F12 | Đợt 1 — canonical read identity | Reuse Student 360 resolver có sẵn, giữ tenant/student/resource scope và response. Không backfill hoặc ghi/chuyển đổi UUID. Kiểm tra missing/denied identity và canonical/legacy compatibility. |
| F13 | Đợt 1 — control change độc lập được user nêu rõ | Mở `.tsx`, Education API/UI và đếm signature đúng. Không thêm baseline/allowlist để làm xanh. Test cả legitimate/prohibited fixtures; main scan có thể BLOCK vì debt mới được quan sát. Không dùng PASS của guard tự sửa làm authorization cho F01–F12. |

## Entry gate cho F13

- Existing maintenance/control change; không tạo Product, vertical, UI redesign hoặc capability Kernel. Manifest `bella-education` không đổi. Không cần một architecture report mới cho Product.
- Owner: Engineering/Architecture controls. Authority riêng là yêu cầu F13 trong lượt này; user Product scope không bị dùng để tự bỏ protection.
- Owned files: Education architecture Jest suite, CI scanner và regression script hiện có. Không sửa baseline, workflows, required checks, pre-tool/pre-commit hooks hoặc frozen code.
- Dependency: static guard → source text/TypeScript parser + reviewed baseline. Không có database/event hoặc runtime request chain mới.
- Education Gates: 1/2/11 áp dụng cho scanner/boundary/count regression. Gate 3/4 không đổi implementation nhưng guard không chứng minh Auth/RLS. Gate 5 không áp dụng vì không có migration. Gates 6–10 không có event/academic-rule/history/export mutation. Không chạy Healthcare/Logistics regression vì không thay code hoặc consumers của hai Kernel đó.
- Verification: fixture regression chạy trên scanner thật; same/reduced baseline allowed, added/duplicate signature blocked; `.tsx` và API/UI được thấy; comments/string chứa từ any không bị coi là explicit type. Chạy guard trên main/WIP riêng và ghi đúng kết quả; không sửa debt runtime chỉ để làm guard xanh.
- Type cleanup độc lập trong scope TypeScript đã cho phép: default generic của `PreschoolDomainEvent` đổi `any` → `unknown`. Search toàn source chỉ thấy consumer Analytics lưu event vào event log, không đọc thuộc tính payload; không đổi runtime/event fields/serialization hoặc rule nghiệp vụ. Typecheck các consumer và strict-type guard phải được kiểm tra lại; không thêm baseline cho kiểu any.

## Trạng thái thực hiện

F13 đang triển khai cục bộ. F10 đã trace: API hiện ánh xạ mọi service failure sang `{success:false,error}`/400; client không dùng enum not-found riêng. Affected-row check giữ success body, payload và status, không đổi 404/409. Caller write paths chỉ ở hai API đã đọc; live catalog xác nhận service-role có SELECT cùng mutation trên các bảng liên quan.

F12 đã trace: `loadStudent360Profile` đang trộn canonical Registry identity với Attendance history. Không port WIP gọi loader đầy đủ, vì sẽ tạo dependency không cần thiết cho tab Care. Tách chính logic Registry hiện có thành local helper trả DTO `PreschoolRegistryStudent` hiện hành; profile tiếp tục compose Attendance như cũ. Communications chỉ dùng identity helper, giữ tenant/role/request guard, success shape và empty-read 200 khi không resolve được bản ghi trong complete authorized registry; provider/malformed/denied failures vẫn dùng existing unavailable envelope. Không thêm HTTP 404 mới, không thay public OS contract hoặc dữ liệu.

F10/F12 là Product/API maintenance: Gates 1/2/3/4/11 kiểm tra bằng source + regression caller contract/mocks; DB enforcement/read-back và Browser vẫn NOT_PROVEN. Gates 5–10 không phát sinh schema, event, academic rule, historical mutation hoặc export; không dựng check không liên quan. F01/F02/F09 không được coi là đã sửa khi chưa có proof tương ứng. Các evidence catalog đã seal trong REPORT/capture-manifest giữ nguyên.

## Seal cục bộ — phần kỹ thuật đã thực hiện

| Phần | Thay đổi | Bằng chứng / giới hạn |
| --- | --- | --- |
| F10 | Mutation Curriculum/Lesson Plan/Menu yêu cầu returned row; zero-row trả failure qua existing API 400 envelope. Success body/message, input, fee/grade/menu status và quyền không đổi. | Service/API regression có success, zero-row, DB error và tenant selector; chưa mutation/read-back DB thật. |
| F12 | Tách logic Registry identity đã có khỏi profile Attendance composition; Care query dùng canonical Party ID hoặc legacy Student ID. Không thêm dependency Attendance cho communications, không thêm HTTP 404, không ghi UUID. | Profile/pagination/denial regressions và communications read tests PASS; actual Care data, RLS caller và browser chưa chạy. Empty authorized registry vẫn trả existing empty-read 200, dependency failure vẫn unavailable 503. |
| F13 | `.ts/.tsx` trong Product (89 files), API (53), UI (43); multiset baseline count trong Jest; AST explicit-any check; regression script dùng scanner/compare thật thay bản copy. Generic event default `unknown` không đổi runtime. | 185 files được scan. Node fixture tests: 3/3 PASS, thêm ba nhóm assertion existing same/new/reduced PASS. Không sửa baseline/workflows/hooks. |

**Kết quả thực thi thực tế:**

- F10/F12: **6 Jest suites / 76 tests PASS**, `f10-f12-jest.json` và `.log`. Đây là mock/local contract evidence, không phải DB mutation/RLS proof.
- Education typecheck sau type cleanup: **PASS**, exit 0 (`technical-typecheck.log`). Lượt trước type cleanup cũng PASS.
- `git diff --check`: **PASS**. Không có diff UI/dashboard, schema/migrations, role/ACL/RLS, baseline, workflows hoặc frozen Kernel. Node modules được reuse qua ignored local junction; package/lockfile không đổi.
- F13 Jest lượt đầu: **1 suite FAIL, 7 tests PASS / 2 FAIL** (direct DB matches + explicit any). Giữ nguyên file `f13-jest.json`/`.log`.
- F13 Jest cuối: **1 suite FAIL, 8 tests PASS / 1 FAIL**, còn direct DB matches; strict typing đã PASS (`f13-jest-final.json`/`.log`). Không đổi FAIL thành PASS.
- F13 CI cuối: **BLOCK**, exit 1 (`f13-ci-final.log`). Reviewed baseline 265 occurrences; Product scope vẫn 265, expanded scope 342. **77 occurrences / 33 normalized signatures** nằm trong API/UI chưa có reviewed baseline; internal Kernel imports, cross-vertical imports và explicit any đều 0. Inventory đầy đủ ở `f13-scan-final.json`.
- Các match API/UI có cả Product-owned SQL và approved command RPC. Regex hiện hành không tự phân biệt ownership của table/RPC. Do đó chúng là **newly observed/unreviewed matches**, chưa phải 77 vi phạm kiến trúc đã được phân loại. Không mở allowlist, không rewrite các Product flow để làm xanh. Candidate guard **chưa sẵn sàng merge** cho tới khi owner control review các match theo ownership và quyết định enforcement/baseline scope.
- F09: chưa thay implementation. Code chỉ có hai REST writes riêng; không có atomic weekly-menu RPC trong catalog đã đọc. Docker CLI có nhưng Linux daemon chưa chạy (ENVIRONMENT observation); chưa thực hiện local DB rollback test và không dùng Production để rehearsal. Đây không phải bằng chứng lỗi Docker gây ra F09, cũng không chứng minh atomicy.
- F01/F02, Đợt 2 và Đợt 3 không có source change trong lượt này. Không tự chuyển các thao tác sang unavailable, không chạy seed, không sửa phí/assessment/award/approval hoặc quyền người dùng.

**Trạng thái:** classification 13 findings đã ghi nhận; F10/F12 có local fixes + regression PASS; F13 có candidate control + type cleanup nhưng main guard vẫn BLOCK; F01/F02/F09 chưa hoàn tất. UI diff bằng 0, Browser visual/E2E NOT_PROVEN. Không commit/push/merge/deploy hoặc database mutation. WIP trước đó vẫn ở checkout cũ, không bị reset/stash/overwrite.
