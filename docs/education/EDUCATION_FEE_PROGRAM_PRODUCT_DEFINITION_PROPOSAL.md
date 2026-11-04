# Education Fee Program & Pricing Management — Product Definition

**03/11/2026 · Bella Preschool / Bella Education · PROPOSED — REVIEW**  
Đề xuất cho Quang Nguyễn review; chưa phê duyệt policy, contract, Phase 3 hay implementation. Bổ sung [Education Finance Product Definition Gate](EDUCATION_FINANCE_PRODUCT_DEFINITION_GATE.md), không tự chuyển gate IN PROGRESS thành PASS. Baseline: `origin/main` b3ccd5903b9ef03395e91be88e30c2a424878992.

## 1. Bằng chứng và phạm vi

- **Yêu cầu owner:** ba cơ chế thu, lịch thanh toán, trách nhiệm và các giới hạn nêu dưới đây. Những điều chưa xác định là OPEN DECISION.
- **Repo source:** [TuitionBillingService](../../src/products/bella-education/finance/services/tuition-billing.service.ts) lấy phí active của PRESCHOOL rồi chọn TUITION đầu tiên, nhận period/due date từ caller; [repository](../../src/products/bella-education/finance/repositories/preschool-finance.repository.ts) lọc tenant/program/active, chưa chứng minh lựa chọn duy nhất theo enrollment và kỳ. Đây là source, không phải bằng chứng runtime.
- **Migration source:** [P7.1](../../supabase/migrations/20260909000058_p71_preschool_finance.sql) định nghĩa fee structures, periods, discount profiles, invoices và line items; không chứng minh version/assignment đầy đủ. [Enrollment migration](../../supabase/migrations/20260812060000_create_education_schema.sql) mô tả `edu_enrollments`. [Finance lifecycle](../../supabase/migrations/20260817010000_finance_invoice_lifecycle_rpcs.sql) gọi F1 với `ACCRUAL` khi finalize; chưa chứng minh phù hợp thu trước dịch vụ. Các migration sau có thể thay đổi catalog/quyền.
- **F01 working tree riêng, chưa commit:** ACR-024 ghi scope Local/Test, nguồn phí/kỳ thuộc Preschool, thiếu hoặc mơ hồ phải fail-closed; activation contract và giao dịch kết hợp cần chứng minh. ACR-025 ghi exception F2 Local/Test được chấp thuận, có dòng re-seal pending; `docs/architecture/frozen/F2_FREEZE.md` tại F01 ghi re-seal PASS cho bridge Local/Test sau DB acceptance. Hai record chưa đồng bộ; giữ cả hai, không suy rộng sang Production hay F01 completion. Quan sát theo thời điểm, không đưa các file dở dang vào branch này.
- **DB Local/Test:** Docker API từ chối truy cập; catalog, dữ liệu fee/period và activation RPC trên target hiện tại **NOT_PROVEN**. Không kết luận dữ liệu vắng mặt; không kiểm tra Production.
- **Suy luận:** chọn fee đầu tiên không chứng minh fee đúng cho enrollment. Các mô hình bên dưới là **đề xuất**, không phải schema hay contract đã tồn tại.

## 2. Capability model và nơi quản lý

Đề xuất khu vực **Education Fee Program Management** để nhân viên được phân quyền tạo, xem và quản lý chương trình/phiên bản, đối tượng áp dụng và kết quả tính. Route/UI và quyền cụ thể chưa được chứng minh. UI tiêu thụ contract được duyệt, không tự quyết định quyền hoặc tính tiền.

| Capability | Mô tả |
|---|---|
| Program & assignment | Tên, mã, đối tượng lớp/chương trình/nhóm/học sinh, version và hiệu lực; một program có nhiều fee item. |
| Fee item | Tên/mã, loại nghiệp vụ, fixed/recurring, usage hoặc event, currency và policy; một item không đồng nghĩa một invoice. |
| Pricing & incentives | Giá theo hiệu lực, discount/promotion theo item hoặc toàn program, conditions và provenance. |
| Source & calculation | Kỳ dịch vụ, usage xác nhận, consent sự kiện; giải thích được phép tính. |
| Obligation & transfer | Xác nhận nghĩa vụ và chuyển intent an toàn, có idempotency, giữ lineage. |
| Monitoring | Theo dõi đối soát meal, participation, obligation và trạng thái Finance; không suy ra payment từ consent. |

Đây là mô hình logic, không quyết định tạo engine hoặc bảng. Discount/promotion là điều chỉnh có điều kiện; chi phí khác/ngoại khóa dùng item thích hợp.

## 3. Program, giá và lịch sử

**Đề xuất:** Fee Program (tenant, mã/tên, đối tượng) → Program Version bất biến sau sử dụng → nhiều Fee Item Version (mã/tên, fee type, mechanism, currency, chu kỳ/trigger, giá và đơn vị, điều kiện, hiệu lực) → tham chiếu discount/promotion và lịch thanh toán. Program có thể nháp, chờ áp dụng, đang áp dụng, hết hiệu lực; đây là nhãn capability, không phải enum đã duyệt. Quy tắc overlap, hủy, biên ngày và timezone là OPEN.

Ví dụ version 1 01/01–31/05 và version 2 từ 01/06. Enrollment giữ nguyên Fee Program Version và Fee Item Version đã cam kết khi xác nhận; repricing không ghi đè hai liên kết này. Mỗi kỳ dịch vụ tham chiếu riêng version thực tế được phép áp dụng. Nếu kỳ dùng version khác version cam kết của Enrollment, phải có một quyết định thay đổi riêng gắn với kỳ/hiệu lực áp dụng, actor và lý do. Khi chưa có quyết định, dùng version đã cam kết nếu version đó còn hợp lệ theo policy được duyệt; nếu version hết hiệu lực hoặc có kết quả mơ hồ thì hold kỳ đó. Không tự chuyển Enrollment sang version mới. Không sửa đè version đã dùng, hóa đơn đã phát hành hay nghĩa vụ đã xác nhận; điều chỉnh có liên kết gốc, lý do và actor theo contract được duyệt. Phân biệt giá enrollment mới, giá kỳ tương lai enrollment cũ, override một học sinh, và adjustment khoản đã phát sinh. Chính sách thương mại và thẩm quyền repricing chi tiết vẫn OPEN.

**Tiêu chí nghiệm thu đề xuất cho D2:** với mỗi Enrollment đã xác nhận, có thể đọc lại version cam kết ban đầu mà không bị thay thế khi repricing. Với mỗi service period/obligation, lưu snapshot tính phí đủ để tái dựng kết quả mà không phụ thuộc bản giá hiện tại: Fee Item Version và đơn giá hiệu lực; discount/promotion version thực tế áp dụng; quantity và unit; unit price; gross và net; currency; service period; source reference/revision; calculation timestamp và calculation basis. Nếu version dùng cho kỳ khác version cam kết của Enrollment, snapshot phải kèm tham chiếu tới quyết định thay đổi, kỳ/hiệu lực, actor và lý do. Chỉ lưu ID tham chiếu tới bản giá có thể bị sửa hoặc thay thế là chưa đủ. Đây là tiêu chí truy nguyên, chưa phải schema hay contract được phê duyệt.

Resolver cần tenant, student/enrollment, ngày/kỳ dịch vụ và đối tượng; kiểm tra quyền/hiệu lực, trả một kết quả cùng lý do/provenance hoặc fail-closed nếu thiếu/mơ hồ. Thứ bậc khi nhiều điều kiện trùng, thời điểm áp version và override là OPEN. Ngày 01–05 là cửa sổ thanh toán, không tự suy ra ngày phát hành invoice.

## 4. Ba cơ chế thu

### Fixed / recurring

Cấu hình tên/mã, amount/currency, chu kỳ, hiệu lực, đối tượng, ưu đãi, lịch phát hành và hạn thanh toán. Policy được cung cấp: kỳ dịch vụ tháng, thu ngày 01–05 tháng áp dụng. Ngày phát hành, prorate giữa tháng, ngày nghỉ/lễ và trigger chính xác là OPEN; không tự tính trọn kỳ hay prorate.

### Usage — meal thực tế

Phải có xác nhận bé thực tế ăn, không dùng ngày đi học thay ngày ăn. Ghi nhận nghỉ, không ăn, hủy suất, adjustment hợp lệ kèm actor/thời gian/lý do. Chính sách tính phí suất đã đăng ký nhưng không ăn hoặc hủy suất là OPEN. Cuối tháng tổng hợp theo giá/version áp dụng từng ngày: `gross = tổng(quantity ngày ăn xác nhận × đơn giá ngày đó)`. Ví dụ 18 ngày × 40.000đ = 720.000đ; thu 01–05/12 cho tháng 11. Có thể thay giá giữa kỳ mà không giả định một giá duy nhất.

Đề xuất `OPEN → RECONCILED → LOCKED → INVOICED → PAID / PARTIAL / OVERDUE`: ba nhãn cuối phản ánh Finance, PARTIAL và OVERDUE có thể đồng thời đúng nên không phải một enum loại trừ. Phải đối soát và lock nguồn trước khi phát hành khoản phải thu; INVOICED chỉ sau xác nhận Finance. Trước lock, correction làm đối soát cũ mất hiệu lực và phải đối soát lại; sau lock/invoice giữ snapshot, thực hiện adjustment liên kết khi policy được duyệt, không sửa invoice cũ. Ai xác nhận, cutoff, mở lại, late data và xử lý Finance reject là OPEN.

### Event / one-time

Trường tạo sự kiện với ngày, địa điểm, nội dung, phí theo lớp/nhóm, deadline và gửi thông báo phụ huynh qua capability được phép. Xác thực quyền guardian; ghi nhận delivery và response riêng. Chỉ consent hợp lệ mới tạo obligation và đưa ngay vào quy trình thanh toán Finance. Từ chối/chưa phản hồi không tạo phí; hết hạn không mặc định từ chối. Retry không tạo phí trùng. Ví dụ dã ngoại 500.000đ/bé.

Ba trục độc lập: **participation** (chưa phản hồi/đồng ý/từ chối/hủy), **obligation** (chưa có/đã xác nhận/điều chỉnh hoặc hủy khi được phép), **payment** (chưa trả/một phần/đã trả, quá hạn do Finance xác nhận). Đồng ý chưa trả vẫn còn nghĩa vụ. Hủy sau trả không tự xóa khoản hoặc hoàn; chính sách hủy, phí hủy, hoàn tiền là OPEN và Finance xử lý khi được quyết định.

## 5. Discount / promotion

Hỗ trợ phần trăm, số tiền cố định, thời hạn, nhập học, nhóm/điều kiện và phạm vi item hoặc program. Mỗi lần áp dụng ghi policy/version, eligibility, thời điểm, base, thứ tự, stacking, cap, rounding và kết quả; giữ gross/net. **OPEN:** điều kiện, thứ tự, cộng dồn, trần, làm tròn, phân bổ toàn program, zero/negative, ưu đãi hết hạn giữa kỳ và ảnh hưởng khoản đã phát sinh. Thiếu rule thiết yếu thì fail-closed; code hiện tại không tự thành policy được duyệt.

## 6. Fee Obligation và lifecycle

Obligation là nghĩa vụ nghiệp vụ Education xác nhận, khác invoice/AR Finance. Dữ liệu tối thiểu: tenant; student/enrollment khi áp dụng; program/version; item/type; service period hoặc event occurrence; calculation basis; quantity/unit, unit price/currency; discount/promotion references và kết quả; gross/net; effective policy version; source reference/revision; idempotency key; created/confirmed timestamps và actor. Đây là yêu cầu nghiên cứu, không phải schema. Quy tắc event không có enrollment, precision, zero/negative và currency conversion là OPEN.

Đề xuất `DRAFT/CALCULATED → CONFIRMED → SUBMITTED → ACCEPTED` hoặc `REJECTED/RETRY_PENDING`. Finance acceptance không đồng nghĩa invoice đã phát hành. Adjustment/cancellation tham chiếu obligation gốc; khi đã invoiced Finance quyết định correction. Invoice/payment/refund/AR là Finance truth; projection chậm/thất bại hiển thị unknown/stale. Trigger: fixed theo assignment/kỳ và policy; usage sau lock; event sau consent. Event chỉ phát sau persistence commit.

**Một hiệu ứng nghiệp vụ duy nhất là yêu cầu thiết kế, chưa chứng minh runtime:** key ổn định scope tenant + nguồn + item + kỳ/occurrence + mục đích, chi tiết khóa xác định tại Phase 3; atomic uniqueness ở owning boundary. Cùng key/payload trả cùng kết quả; cùng key khác payload conflict; timeout tra outcome trước retry. Version đổi không âm thầm tạo nghĩa vụ thứ hai; correction dùng workflow riêng. Kiểm tra concurrency, retry, crash giữa commit và transfer, replay bằng transaction/outbox hoặc contract tương đương. Không tuyên bố exactly-once delivery.

## 7. Ownership và Phase 3 contract requirements

| Education / Preschool | Finance |
|---|---|
| Program, pricing, discount/promotion, assignment, attendance/meal attendance, participation; kỳ, nguồn, tính toán và xác nhận obligation | Invoice, AR, payment, reconciliation, refund, accounting, GL, financial audit; xác thực intent và quyết định accounting theo policy được duyệt |

Education không chọn GL account, bút toán hoặc tự ghi sổ. Tenant isolation, authorization, guardian consent, actor/service provenance, audit, correction và failure phải được bảo vệ; task này không thiết kế ACL/RLS hay migration.

**Intent/requirements, chưa phải contract hiện có:** (1) chuyển obligation đã xác nhận gồm tenant, source, parties, amount/currency, chi tiết, kỳ, policy/version, due date hợp lệ, correlation và idempotency; (2) Finance xác thực quyền, consistency và policy; trả canonical IDs, acceptance/rejection/conflict không lộ tenant khác; (3) retry đồng nhất và concurrent an toàn; (4) Finance trả trạng thái invoice/payment/refund có thời điểm/provenance, xử lý stale/out-of-order; (5) correction/reversal/cancellation/refund theo Finance contract và policy đã duyệt; (6) timeout/commit/outbox không tạo thành công giả hoặc mất/nhân đôi hiệu ứng; (7) cùng semantic envelope thể hiện ba mechanisms mà không ép accounting hay một loại trường. Kiểm tra public contract hiện hữu trước extension. Phase 3 vẫn bị chặn theo gate hiện hành cho đến quyết định phù hợp.

## 8. Tác động F01 — chưa được phép triển khai

1. Thay lựa chọn fee đầu tiên bằng nguồn Product-owned resolve theo tenant, enrollment, item, version và kỳ; thiếu/mơ hồ fail-closed. Xác định discount, amount, due date từ nguồn hợp lệ, không lấy UI literal/seed làm policy.
2. Giữ policy/version và basis trên enrollment/obligation; phân biệt enrollment mới với kỳ tương lai. Mid-month chưa có quyết định.
3. Đối chiếu Finance public contract với line items và provenance; không mặc định finalize ACCRUAL cho thu trước dịch vụ. Finance owner quyết định accounting hợp lệ.
4. ACR-024 ghi thiếu Education-owned SQL-callable activation và composability một transaction; proposal này không tạo RPC hay chứng minh atomicity. Giữ F01 fail-closed cho đến khi điều kiện riêng được chứng minh.
5. Giữ F1, F2, ACR, F01 và Production; F2 scoped Local/Test seal là bằng chứng riêng, không chạy lại chỉ vì proposal này. Sau review, PO quyết định scope contract trước tích hợp.

## 9. OPEN BUSINESS DECISIONS — Quang Nguyễn / owner

| ID | Quyết định | Phương án cần cân nhắc, chưa chọn |
|---|---|---|
| D1 | Nhập học giữa tháng | Trọn kỳ / prorate theo cơ sở xác định / quy tắc khác; ngày bắt đầu và rounding. |
| D2 | Giá thay khi enrollment còn active | Invariant đề xuất: giữ bất biến version cam kết Enrollment; version của từng kỳ chỉ đổi theo quyết định riêng có hiệu lực, actor và lý do. Điều kiện thương mại, người có thẩm quyền và thông báo vẫn OPEN. |
| D3 | Assignment cạnh tranh | Thứ bậc student/group/class/program, overlap và override. |
| D4 | Meal | Người xác nhận, cutoff/lock/reopen, hủy/đăng ký không ăn, late correction, giá thay trong kỳ, đơn vị ngày/suất. |
| D5 | Event | Guardian consent, deadline/đổi ý, hủy trước/sau trả, phí hủy, refund và chưa phản hồi. |
| D6 | Ưu đãi | Eligibility, hiệu lực, stacking/order/cap/rounding, phân bổ, expiry, override và zero. |
| D7 | Billing | Ngày phát hành, timezone/biên ngày, ngày nghỉ/lễ, zero, adjustment sau issue, gộp/tách invoice. |
| D8 | Finance | Pre-service treatment, invoice/AR, adjustment/refund do Finance xác định theo policy duyệt. |
| D9 | Quản trị | Quyền tạo/áp dụng/sửa program, đối soát/lock, override, thông báo và audit. |

## 10. Generality và kịch bản kiểm chứng

Các kịch bản sau **chưa chạy**, không phải proof. Khi implementation được duyệt, kiểm chứng persistence thật, concurrency, tenant isolation/authorization, failure không side effect và Finance boundary trong môi trường phù hợp.

| # | Tình huống | Invariant / xử lý |
|---|---|---|
| 1 | Nhập học giữa tháng | Hold số tiền khi D1 chưa quyết định; không tự prorate. |
| 2 | Giá đổi tháng sau | Kỳ cũ giữ version/amount, kỳ mới theo D2; invoice cũ bất biến. |
| 3 | Hai bé cùng lớp, policy khác | Resolve đúng assignment/tenant và provenance; mơ hồ fail-closed. |
| 4 | Nghỉ và không ăn | Không tính ngày ăn thực tế; policy hủy suất riêng chưa xác định. |
| 5 | Đi học nhưng không ăn | Không thay attendance cho meal confirmation. |
| 6 | Sửa meal trước lock | Mất hiệu lực kết quả đối soát cũ, reconcile lại theo revision và giá đúng. |
| 7 | Sửa meal sau invoice | Giữ bản gốc; adjustment liên kết và Finance xử lý sau policy. |
| 8 | Đồng ý dã ngoại chưa trả | Một obligation, payment chưa trả; không suy paid từ consent. |
| 9 | Từ chối dã ngoại | Không obligation, retry không tạo phí. |
| 10 | Hủy sau trả | Giữ payment/lịch sử; chờ D5 và Finance, không tự xóa/refund. |
| 11 | Promotion hết hạn | Áp theo thời điểm được duyệt; không sửa lịch sử; thiếu rule thì hold. |
| 12 | Retry/concurrent | Cùng key/payload một kết quả; khác payload conflict; replay không nhân đôi. |
| 13 | Đổi giá khi enrollment cũ active | Enrollment vẫn giữ version cam kết; kỳ cũ giữ snapshot/version và kết quả tính; kỳ mới dùng version khác chỉ khi có quyết định thay đổi được truy nguyên, nếu không hợp lệ thì hold. |
| 14 | Hai assignment/version cùng hiệu lực | Conflict/hold, không chọn record đầu tiên. |
| 15 | Finance lỗi sau commit hoặc phản hồi trễ | Không thành công giả/nhân đôi; retry/reconcile, hiển thị unknown. |
| 16 | Consent giả hoặc tenant khác | Từ chối không side effect hay rò dữ liệu. |

**Tiêu chí generality cấu trúc:** loại hình Education mới với tổ hợp fixed, usage, event và policy hợp lệ phải biểu diễn qua mapping/configuration trong policy space mà không sửa semantic contract core hoặc ép một accounting model. Đây là tiêu chí Phase 3, chưa phải chứng minh đã đạt. Policy Preschool không mặc định cho mọi trường.

## 11. Verify và bàn giao

Đối chiếu thủ công các yêu cầu, ownership, ba mechanisms, 16 kịch bản kiểm chứng tương lai (chưa chạy) và quyết định mở. Không có runtime, schema, migration hoặc public contract thay đổi; runtime tests, 11 gates cho thay đổi runtime và F2 rerun không áp dụng với proposal tài liệu này. Catalog DB hiện tại và khả năng runtime vẫn NOT_PROVEN. Đề xuất đủ cụ thể để review nhưng **không APPROVED**, không seal Product Definition Gate, không cho phép Phase 3 hay implementation. Owner review D1–D9 và generality trước khi quyết định Contract Design.
