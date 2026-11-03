# F13 — gói policy P1/P2/P3 để owner quyết định

**PROPOSED — CHƯA DUYỆT / CHƯA ÁP DỤNG.** Ngày 01-11-2026. Source snapshot `f1299e3138f3700062a1ed84271db315737b0071`, scanner v2 đã seal. Exception thực tế vẫn **0**. Tài liệu và JSON đi kèm không phải cấu hình đang chạy, không được guard import.

## Gói đề xuất

| Quyết định | Policy cụ thể được đề xuất |
| --- | --- |
| **P1 — Historical debt** | Giữ đúng **265 source occurrences** theo baseline cũ. Dùng projection khóa từ snapshot đã seal: **263 tuple identities**, tổng quota 265, nhãn `KNOWN_DEBT_BOUNDED`. Đây là ghi nhận debt hiện hữu, không phải review mới hay xác nhận quyền truy cập hợp lệ. |
| **P2 — Newly observed / unresolved** | Default **BLOCK** cho call mới/thay đổi, 77 occurrences đang review và 20 expressions chưa resolve; chỉ những tuple được owner duyệt riêng mới có disposition khác. Cấm wildcard, miễn theo file/Product/role/prefix, hoặc exception cho target/schema/operation chưa resolve. Không đổi consumer sang literal chỉ để thỏa scanner. |
| **P3 — Seven bounded paths** | Chấp thuận về **control policy** đúng bảy tuple bên dưới, mỗi tuple quota một source occurrence, nhãn `APPROVED_CONTRACT_PATH`. Không cấp quyền DB, không sửa role/assignment/approval, không coi Auth/RLS/rollback đã PASS. P3 chỉ có hiệu lực nếu owner duyệt; hiện tại vẫn là candidate. |

P1/P2/P3 cần được xét như một gói nhất quán cho cả hai gate. Không chỉ thêm bảy exact keys rồi bỏ qua các FAIL còn lại.

## P1: quản lý debt có giới hạn

- Projection chỉ lấy từ **evidence snapshot đã seal**, không lấy source đang sửa hoặc tự tạo baseline sau mỗi lần CI. Phụ lục `f13-policy-proposal.json.P1.projection` liệt kê đầy đủ 263 identities / 265 occurrences để review; chưa có entry nào được kích hoạt.
- Identity là exact file + enclosing caller + transport + schema/client-default marker + resource đầy đủ + operation; quota là số occurrence trong source. Không suy `client-default` là schema `public`.
- Giữ nguyên `.github/ci/education-architecture-baselines.json` và số **265**. Same/reduced debt trong đúng tuple/quota được giữ theo policy hiện hữu; tăng quota, đổi resource/caller/schema/operation hoặc thêm call mới đều BLOCK. Giảm source không tự viết lại metadata. Việc retire debt là thay đổi được review riêng; không tuyên bố ratchet tự động chưa được triển khai.
- Các vi phạm đã biết vẫn được hiển thị là debt; không đổi thành compliant, không lấy đó làm bằng chứng Security/Go-Live. Không áp dụng P1 cho 26 direct Education SQL mới hoặc các API/UI ngoài snapshot Product debt.
- Source SHA và hash là provenance để owner review; không giả vờ rằng static tuple tự chứng minh tenant predicates hoặc Auth bên trong caller. Những thay đổi có tác động quyền vẫn chịu contract/gates hiện hữu.

## P3: đúng bảy tuple được trình duyệt

Đường dẫn dưới đây thuộc `src/app/api/education/`; schema marker hiện tại của cả bảy là `<client-default>`. Các entry đầy đủ và hash source file nằm trong `f13-policy-proposal.json.P3.exceptions`.

| ID | File / enclosing caller | Transport / operation | Resource | Source quota |
| --- | --- | --- | --- | ---: |
| M066 | `work-queue/incident-queue.persistence.ts` — `IncidentQueuePersistence/query` | from / SELECT | `edu_health_incidents` | 1 |
| M067 | Cùng file — `IncidentQueuePersistence/get` | from / SELECT | `edu_health_incidents` | 1 |
| M068 | `work-queue/request-review.persistence.ts` — `RequestReviewPersistence/query` | from / SELECT | `edu_comm_exceptions` | 1 |
| M069 | Cùng file — `RequestReviewPersistence/get` | from / SELECT | `edu_comm_exceptions` | 1 |
| M070 | Cùng file — `RequestReviewPersistence/resolveOpen` | from / UPDATE | `edu_comm_exceptions` | 1 |
| M071 | Cùng file — `RequestReviewPersistence/financeNoticeIds` | from / SELECT | `edu_comm_notices` | 1 |
| M004 | `care/bulk/route.ts` — `POST`, nhánh `save_care` hiện hữu | rpc / EXECUTE | `preschool_save_care_records` | 1 |

Quota tĩnh không giới hạn lượt query runtime, số lần gọi helper hoặc số records trong bulk. M070 không cho phép DELETE/INSERT; SELECT trả row sau UPDATE không biến nó thành read. M004 không cấp exception cho M005 (Care GET direct Attendance SQL) hoặc các RPC khác cùng file.

Authority của Work Queue là Product persistence port và Architecture Gate đã có; của M004 là contract Care non-health và đường gọi bounded đã đối chiếu. Chi tiết từng caller, hạn chế Auth development mock, executor và installed DB proof giữ nguyên trong `F13_GATE_DISPOSITION.md`. Chấp thuận control path không xóa các hạn chế bằng chứng đó.

## Cùng disposition cho hai gate

Nếu owner duyệt và cho phép triển khai local:

1. Giữ scanner v2; không phát triển analyzer tổng quát. Gắn **một input metadata** vào Education guard hiện có, dự kiến `.github/ci/education-architecture-dispositions.json`, tách rõ known debt với approved contract paths. JSON trong thư mục audit này không được dùng làm cấu hình runtime.
2. Exact-resource gate nhận diện P1 bằng tuple/quota debt và P3 bằng tuple/quota exception. Unknown hoặc ngoài quota vẫn BLOCK.
3. Legacy gate giữ baseline 265. Chỉ loại đúng occurrence P3 được nhận diện khỏi **phép so sánh legacy**, theo cùng tuple/quota; không loại cả signature/file. P1 vẫn nằm trong phép so sánh debt cũ.
4. Báo cáo giữ nguyên raw observations cùng các bucket debt/exception/blocked. Không giấu hoặc xóa inventory 77/33, logs FAIL và các debt đã ghi nhận.

| Chỉ số | Enforcement thực tế hiện nay | Mô phỏng nếu cả gói được duyệt và triển khai |
| --- | ---: | ---: |
| Raw resource occurrences | 362 | 362 |
| Historical debt được ghi nhận | 265 ở baseline legacy | 265, có projection exact nhưng vẫn là debt |
| Approved/applied exceptions | **0** | **7** theo P3 |
| Exact-resource còn BLOCK | 362 / 355 signatures | **90 / 85 signatures** |
| Legacy added còn BLOCK | 77 / 33 signatures | **70 / 30 signatures** |
| Unresolved expressions còn BLOCK | 20 | 20 |
| F13 | BLOCK — NOT MERGE-READY | **BLOCK — NOT MERGE-READY** |

90 còn BLOCK là **26 Education SQL + 28 Product API SQL + 7 workflow RPC + 6 Scheduling UI + 3 profile RPC + 20 unresolved**. Chúng cần disposition/implementation riêng; gói này không tự sửa hoặc chấp thuận chúng. 19 constant expressions và một typed dispatch vẫn giữ unknown-target BLOCK; không tự thêm resolver trong phạm vi gói này.

## Kiểm chứng đề xuất đã chạy

`propose-f13-policy.mjs` chỉ mô phỏng trong bộ nhớ bằng comparators hiện hữu và sealed call identities. **9 probes ALLOW và 118 probes BLOCK đúng kỳ vọng**, không có probe thất bại: bảy tuple riêng, same/reduced debt, đổi file/caller/resource/schema/operation/transport, target chưa resolve, vượt quota, 26 Education SQL, 20 unknown và historical substitution. Baseline và tracked diff trước/sau trùng hash.

Đây là kiểm chứng policy proposal, không phải source enforcement đã được thay hay DB/Auth/RLS PASS. Scanner regression 16 PASS, Architecture Jest 8 PASS/2 FAIL, focused typecheck PASS và CI exit 1 được reuse bằng hash; không chạy lại kiểm tra không đổi.

Sau khi duyệt, phạm vi local chỉ gồm ba file control hiện hữu và một metadata file nêu trên. Chạy regression cho classifier/quota và các case legitimate/prohibited, giữ hai assertion bắt các blocker còn lại, kiểm tra type/diff/scope và báo actual outcomes. Không sửa assertion để kỳ vọng ALLOW cho 90 blockers. Không đổi baseline 265, CI workflow, hooks, required checks, Product/API/UI, env, schema, DB, role, RLS hoặc quyền người dùng. Không commit/push/merge/deploy nếu chưa được giao riêng.

## Quyết định owner cần trả lời

**Duyệt cả P1/P2/P3 để triển khai local phần enforcement trong đúng phạm vi trên, hoặc chỉ rõ điểm cần chỉnh.** Chưa có quyết định này thì không kích hoạt projection/exception. Yêu cầu “làm đi” đã được thực hiện ở mức chuẩn bị gói policy cụ thể và kiểm chứng; trạng thái phê duyệt được để trống, không tự gán quyền cho AI.

Căn cứ: Constitution, mục **Protection Changes Require Independent Authority**: “Protection changes require approval independent of the feature they protect”. Gói này không cấp quyền Production hay sửa nghiệp vụ.

**Hiện tại: actual exception 0; F13 BLOCK; F10/F12 LOCAL PASS — SEALED; F09 DESIGN ONLY. Preschool NOT_READY; Real Auth/RLS, Browser và Production NOT_PROVEN.**
