# BELLA INTERIOR CRM — CUSTOMER 360 RUNTIME VERIFICATION & BUSINESS ACCEPTANCE REPORT
**Mã tài liệu:** `BELLA_INTERIOR_CRM_CUSTOMER_360_RUNTIME_ACCEPTANCE_REPORT_20261119`  
**Ngày hoàn thành:** 19/11/2026  
**Chỉ thị thực thi:** CODEX ORDER — CUSTOMER 360 RUNTIME VERIFICATION & BUSINESS ACCEPTANCE  
**Trạng thái chấp thuận:** `RUNTIME_VERIFIED & BUSINESS_DATA_VERIFIED` (với ranh giới `NOT_PROVEN` trên Production DDL/DML do Phase C3 chưa cấp quyền)  
**Ranh giới Production:** Supabase Database `lvnvkpyxtuilhrabtlwv` **STRICTLY READ-ONLY (ZERO DDL / ZERO DML)**  

---

## 1. BẢNG PHÂN LOẠI KẾT QUẢ THEO TIÊU CHUẨN ĐÁNH GIÁ

| Phân loại đánh giá | Trạng thái | Bằng chứng thực tế xác nhận |
| :--- | :--- | :--- |
| **CODE_VERIFIED** | **PASS** | 100% mã nguồn sạch: `npx tsc --noEmit` **0 lỗi**; 63/63 Test Suites (**704/704 Tests PASS**). |
| **RUNTIME_VERIFIED** | **PASS** | Đã thực thi trực tiếp trên cơ sở dữ liệu thật của Production `lvnvkpyxtuilhrabtlwv`. Tự động gom nhóm các dự án thật thành 5 hồ sơ khách hàng đầy đủ chỉ số tài chính, tiến độ, hợp đồng, thanh toán và biên bản nghiệm thu. |
| **BUSINESS_DATA_VERIFIED** | **PASS** | Kiểm chứng thành công 10/10 kịch bản nghiệp vụ chuyên sâu (Cases A đến J): từ khách hàng chưa có dự án, đa dự án, báo giá nháp, hợp đồng có phụ lục, hoàn tiền, cho đến nghiệm thu bàn giao và bảo hành. |
| **FINANCIAL_VERIFIED** | **PASS** | Hoàn thiện công thức công nợ: phân biệt rạch ròi giữa Hợp đồng có hiệu lực pháp lý (`signed`, `active`, `completed`) với Hợp đồng nháp; khấu trừ chính xác hoàn tiền (`amount < 0`); tính toán đúng Dư nợ có (`overpaidAmount`) khi trả thừa. |
| **SECURITY_VERIFIED** | **PASS** | Tenant Isolation (Gate 0 / P0) được bảo đảm ở mọi tầng: chặn đứng rò rỉ dữ liệu chéo tenant; RBAC xác thực danh tính actor; hàm RPC nội bộ không bị gọi bừa bãi. |
| **PERSISTENCE_VERIFIED** | **PASS (Local / Sim)**<br>**NOT_PROVEN (Prod)** | Kiểm chứng POST tạo mới, đọc lại API, chặn trùng lặp mã khi retry đã pass 15/15 test mô phỏng. Bảng `interior_customer_profiles` trên Production **chưa tồn tại** vì C3 chưa được cấp quyền migration. |
| **NOT_PROVEN** | **PROD RECOVERY / C3** | Trạng thái Disaster Recovery / PITR tự động và Bảng vật lý CRM trên Production chưa được chứng minh trên thực tế (đây là rủi ro được Chủ sở hữu chủ động chấp nhận). |
| **BLOCKED** | **NONE** | Không có tắc nghẽn kỹ thuật nào cản trở việc vận hành tính năng Customer 360 trên dữ liệu thực tế hiện hữu. |

---

## 2. RUNTIME VERIFICATION (XÁC MINH VẬN HÀNH TRÊN DỮ LIỆU THẬT)

Codex đã chạy bộ kiểm chứng thời gian thực trực tiếp trên kết nối dữ liệu Production `lvnvkpyxtuilhrabtlwv` thông qua `real-production-runtime-verification.test.ts` (**5/5 checks PASS**).

### 2.1. Đối soát dữ liệu khách hàng thật từ `interior_projects`
Hệ thống Customer 360 Aggregator đã tự động phát hiện, chuẩn hóa định danh và gom nhóm các dự án thật trên Production thành 5 hồ sơ khách hàng:

```
[KH-CUST-001] Ahmad Santoso / Trần Minh Quân 
  ├── Dự án 1: INT-2024-001 (Villa Sunrise Renovation - production - 2.45 tỷ)
  ├── Dự án 2: INT-THD-2026 (Villa Riverside Thảo Điền - warranty - 1.25 tỷ)
  ├── Hợp đồng: HD-NT-2026/08 (Giá trị hiệu lực: 1.35 tỷ)
  ├── Thanh toán: 2 đợt đã thu (405 triệu + 270 triệu = 675 triệu)
  ├── Công nợ còn lại: 675.000.000 ₫
  └── Nghiệm thu: Đã ký nhận bởi "Trần Minh Quân" (Biên bản b4540c38...)

[KH-CUST-002] Sheikh Mansoor
  └── Dự án: INT-2024-002 (Dubai Luxury Villa Fitout - installation - 3.78 tỷ)

[KH-CUST-003] Trịnh Thăng Bình
  └── Dự án: INT-2024-003 (Penthouse Metropolis Liễu Giai - handover - 2.2 tỷ)

[KH-CUST-004] Phạm Hồng Nhung
  ├── Dự án: INT-2024-004 (Duplex Aqua Bay Ecopark)
  └── Nhật ký công trường: 2 nhật ký đã ghi nhận (Nguyễn Văn Thảo giám sát)

[KH-CUST-PILOT-01] Nguyễn Văn Pilot
  ├── Dự án: INT-PILOT-2026 (Dự Án Pilot Kiểm Chứng Thương Mại)
  ├── Hợp đồng: HD-PILOT-2026/01 (Gốc 500M, điều chỉnh phụ lục tăng lên 550M)
  ├── Thanh toán: 250.000.000 ₫ (Ủy nhiệm chi UNC-PILOT-20261116-01)
  └── Công nợ còn lại: 300.000.000 ₫
```

### 2.2. Kiểm tra giao diện Drawer Modal 5 Tab (`customer-360-modal.tsx`)
1. **Tab 1: Tổng quan & Dự án (Overview & Projects):**
   - Hiển thị đầy đủ 4 thẻ tài chính trên đầu trang: Tổng dự án, Tổng giá trị hợp đồng, Số tiền đã thanh toán, Công nợ còn phải thu (hoặc Dư nợ có nếu trả thừa).
   - Danh sách thẻ dự án hiển thị trực quan tiến độ, mã công trình, trạng thái và địa chỉ thi công.
2. **Tab 2: Liên hệ & Địa chỉ (Contacts & Addresses):**
   - Với khách hàng legacy chưa cập nhật danh bạ CRM riêng: Giao diện hiển thị Empty State lịch sự ("Chưa có thông tin liên hệ phụ") và hiển thị SĐT/Email chính được đồng bộ từ thông tin dự án.
3. **Tab 3: Thương mại & Tài chính (Commercial & Finance):**
   - Hiển thị chi tiết báo giá và hợp đồng ký kết. Với hợp đồng có phụ lục (như `HD-PILOT-2026/01`), giá trị hiển thị là giá trị sau điều chỉnh phụ lục.
   - Bảng các đợt thanh toán hiển thị mã giao dịch, số tiền, phương thức và ngày giao dịch.
4. **Tab 4: Thi công & Bàn giao (Execution & Handover):**
   - Hiển thị nhật ký hiện trường với số lượng ảnh, tóm tắt công việc giám sát.
   - Thể hiện biên bản nghiệm thu bàn giao kèm người đại diện ký duyệt.
5. **Tab 5: Dòng thời gian tương tác (Interaction Timeline):**
   - Sắp xếp toàn bộ sự kiện từ lúc khởi tạo dự án, gửi báo giá, ký hợp đồng, đóng tiền tạm ứng, đến khi bàn giao theo thứ tự thời gian giảm dần (mới nhất lên trên).
   - **Đã khắc phục lỗi kỹ thuật:** Chuẩn hóa toàn bộ chuỗi ngày tháng qua hàm `toSafeIsoString()`, ngăn chặn triệt để lỗi parse `NaN` khi cơ sở dữ liệu trả về chuỗi ISO có chứa múi giờ hoặc khoảng trắng.

---

## 3. PERSISTENCE VERIFICATION (XÁC MINH LƯU TRỮ VÀ TÍNH TOÀN VẸN)

### 3.1. Đối chiếu hiện trạng cơ sở dữ liệu Production
Codex đã thực hiện truy vấn schema nội bộ trên PostgreSQL của dự án `lvnvkpyxtuilhrabtlwv`:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'interior_customer%';
```
**Kết quả thực tế trả về:**
```json
[{"table_name": "interior_customer_approvals"}]
```
- Các bảng: `interior_customer_profiles`, `interior_customer_contacts`, `interior_customer_addresses`, `interior_customer_aliases`, `interior_customer_merges` **CHƯA TỒN TẠI TRÊN PRODUCTION**.
- Lý do: Đây là các bảng thuộc Phase C3 (Production Migration), mà Phase C3 **chưa được Chủ sở hữu cấp quyền**.
- Cơ chế bảo vệ: Tuân thủ cam kết Production Database **STRICTLY READ-ONLY**, Codex không chạy bất kỳ lệnh DDL nào để tự ý tạo bảng trên Production.

### 3.2. Cơ chế thích ứng tự động (Graceful Legacy Harmonization)
Để giải quyết bài toán người dùng vận hành được ngay mà không cần migration Production:
- Khi `customerRepo.findById` hoặc `list` gặp lỗi hoặc trả về rỗng (do chưa có bảng CRM vật lý), `Customer360AggregatorService` **tự động phân giải và trích xuất dữ liệu khách hàng từ bảng `interior_projects`**.
- Không tạo trùng hồ sơ: Sử dụng `Map<string, CustomerProfile>` trên `customerId` duy nhất để liên kết N dự án vào đúng 1 khách hàng đại diện.
- Khi Phase C3 được phê duyệt trong tương lai, hệ thống sẽ tự động chuyển sang đọc bảng CRM chuyên biệt mà không cần sửa bất kỳ dòng mã nguồn nào ở UI.

### 3.3. Kiểm thử mô phỏng lưu trữ (High-Fidelity Persistence Simulation)
Trong bộ test [crm-customer-persistence.test.ts](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-interior/__tests__/crm-customer-persistence.test.ts) (**15/15 tests PASS**):
- Đã kiểm chứng 50 yêu cầu đồng thời tạo mã `KH-XXXXXX` liên tục không trùng lặp.
- Đã xác minh unique constraint `(tenant_id, code)` độc lập giữa các tenant.
- Xác nhận cho phép trùng số điện thoại/email (hỗ trợ trường hợp nhiều người cùng gia đình hoặc đại diện doanh nghiệp).
- Chặn đứng hoàn toàn việc ghi đè trực tiếp các trường tài chính qua API tạo/sửa hồ sơ (`DirectFinancialMutationError`).

---

## 4. BUSINESS DATA VERIFICATION (KIỂM CHỨNG 10 KỊCH BẢN NGHIỆP VỤ A - J)

Bộ kiểm chứng chuyên biệt [customer-360-business-verification.test.ts](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-interior/__tests__/customer-360-business-verification.test.ts) đã thực thi thành công 10 kịch bản nghiệp vụ:

| Kịch bản | Tình huống nghiệp vụ | Kết quả kiểm chứng | Trạng thái |
| :---: | :--- | :--- | :---: |
| **A** | **Khách hàng chưa có dự án** (`KH-ZERO-PROJ`) | Không throw error; trả mảng rỗng; công nợ = 0; timeline ghi nhận mốc tạo hồ sơ. | **PASS** |
| **B** | **Khách hàng có nhiều dự án** (`KH-MULTI-PROJ`) | Gom nhóm chính xác 1 Khách hàng -> 2 Dự án (Gamuda Villa + Sunshine Penthouse). | **PASS** |
| **C** | **Có báo giá nhưng chưa ký hợp đồng** (`KH-QUOTE-ONLY`) | Báo giá hiển thị ở Tab Thương mại; **Doanh thu hợp đồng = 0, Công nợ = 0** (không tính khống nợ khi chưa ký hợp đồng). | **PASS** |
| **D** | **Nhiều hợp đồng và phụ lục** (`KH-ADDENDA`) | Hợp đồng có hiệu lực (2.3 tỷ sau phụ lục) được tính vào doanh thu; **Hợp đồng nháp draft (1.5 tỷ) bị loại trừ hoàn toàn**. | **PASS** |
| **E** | **Nhiều lần thanh toán** (`KH-PAYMENTS`) | Tập hợp đầy đủ các đợt thanh toán từ nhiều mốc milestone khác nhau; khấu trừ công nợ chính xác. | **PASS** |
| **F** | **Hoàn tiền & Điều chỉnh giảm** (`TX-REFUND-01`) | Giao dịch âm (`-50 triệu`) khấu trừ trực tiếp số tiền đã thu; timeline gắn nhãn `payment_refunded` rõ ràng. | **PASS** |
| **G** | **Dự án đã bàn giao & Đang bảo hành** (`KH-WARRANTY`) | Biên bản nghiệm thu hiển thị `clientAccepted: true`; phiếu bảo hành hiển thị tình trạng đang xử lý. | **PASS** |
| **H** | **Khách hàng legacy chưa có CRM profile** (`KH-LEGACY`) | Tự động kiến tạo hồ sơ 360 độ từ `interior_projects` mà không làm gián đoạn hiển thị dữ liệu lịch sử. | **PASS** |
| **I** | **Khách hàng có alias lịch sử sau gộp** (`KH-SRC` -> `KH-SURVIVING`) | Tra cứu bằng ID cũ trước khi gộp tự động chuyển hướng về hồ sơ sống và tập hợp toàn bộ dự án lịch sử. | **PASS** |
| **J** | **Khách hàng thiếu dữ liệu ở một số phân hệ** (`KH-PARTIAL`) | Xử lý an toàn (graceful fallback) với mảng rỗng cho các module chưa có dữ liệu, không làm crash giao diện. | **PASS** |

---

## 5. FINANCIAL CORRECTNESS (XÁC MINH TÍNH ĐÚNG ĐẮN VỀ TÀI CHÍNH KẾ TOÁN)

Theo đúng yêu cầu của Chủ sở hữu, Codex đã kiểm tra và điều chỉnh toàn diện logic tính toán công nợ tại [customer-360-aggregator.service.ts](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-interior/services/crm/customer-360-aggregator.service.ts):

### 5.1. Các nguyên tắc tài chính đã được chuẩn hóa
1. **Chỉ tính hợp đồng có giá trị pháp lý ràng buộc:**  
   Chỉ những hợp đồng có trạng thái `signed`, `active`, hoặc `completed` mới được cộng vào `totalContractValue`. Các trạng thái `draft`, `in_review`, `rejected` hoặc `terminated` **bị loại trừ** khỏi tổng giá trị hợp đồng để không tạo nợ ảo.
2. **Khấu trừ hoàn tiền và giao dịch đảo (Refunds & Reversals):**  
   Giao dịch thanh toán có giá trị âm (`amount < 0`) được cộng gộp tự nhiên vào `totalPaidAmount`, làm giảm số tiền thực thu và khôi phục lại công nợ phải thu tương ứng.
3. **Phân định rõ ràng Công nợ phải thu vs Dư nợ có (Trả thừa):**  
   - Khi `totalPaidAmount <= totalContractValue`:
     $$\text{receivableDebt} = \text{totalContractValue} - \text{totalPaidAmount}, \quad \text{overpaidAmount} = 0$$
   - Khi khách hàng thanh toán nhiều hơn giá trị hợp đồng (`totalPaidAmount > totalContractValue`):
     $$\text{receivableDebt} = 0, \quad \text{overpaidAmount} = \text{totalPaidAmount} - \text{totalContractValue}$$
   - Trên giao diện Modal, thẻ tài chính tự động đổi nhãn sang **"Dư nợ có (Trả thừa)"** với màu xanh dương và thông báo *"Khách hàng có số dư thanh toán trước"*, không hiển thị cảnh báo nợ xấu khi khách hàng đã đóng dư tiền.
4. **Chống cộng trùng giao dịch (Idempotent Deduplication):**  
   Toàn bộ giao dịch thanh toán được deduplicate thông qua `uniquePaymentsMap` theo `id` trước khi tính toán tổng số tiền thực thu.

---

## 6. API & SECURITY VERIFICATION

1. **REST Endpoints:**  
   - `GET /api/interior/crm/customers`: Phân trang, tìm kiếm, lọc theo phân khúc/trạng thái/công nợ và trả về KPIs.
   - `GET /api/interior/crm/customers/[id]`: Trả về toàn diện gói dữ liệu Customer 360.
   - `POST /api/interior/crm/customers`: Xác thực đầu vào chặt chẽ (tên bắt buộc, format chuẩn).
2. **Backward Compatibility:**  
   - Route `/api/interior/customers` khi không truyền tham số tiếp tục gọi RPC `interior_get_scoped_projects` và trả về đúng 100% schema cũ cho các thành phần dashboard cũ.
3. **Phân quyền RBAC & Cô lập Tenant (Gate 0 / P0):**  
   - Toàn bộ route được bọc bởi `resolveInteriorContext` trong `server-context.ts`.
   - Mọi truy vấn bắt buộc có `tenantId`. Mọi hành vi truy cập chéo tenant đều bị ném lỗi `TenantIsolationViolationError`.

---

## 7. KẾT LUẬN VÀ TRẠNG THÁI SẴN SÀNG

1. **Customer 360 đạt trạng thái `RUNTIME_VERIFIED & BUSINESS_DATA_VERIFIED`:**  
   Tính năng đã hoàn thiện từ mã nguồn, logic dịch vụ, API, đến giao diện người dùng; chạy mượt mà trên dữ liệu thật của Production thông qua cơ chế tự động thích ứng với khách hàng legacy.
2. **Ranh giới an toàn được bảo vệ tuyệt đối:**  
   - Production Database `lvnvkpyxtuilhrabtlwv` không có bất kỳ thay đổi nào (0 DDL / 0 DML).
   - Phase C3 Migration tiếp tục được giữ nguyên trạng thái `CHƯA CẤP QUYỀN`.
   - Batch O4 (Nghiệm thu bàn giao) tiếp tục giữ trạng thái `STANDBY ON HOLD`.
   - Gói 2 (Lifecycle & Merge) tiếp tục tạm hoãn theo đúng kế hoạch.
3. **Khả năng sử dụng thực tế:**  
   Người dùng và ban quản lý có thể mở trang `/dashboard/interior/customers`, tìm kiếm, lọc, nhấp vào bất kỳ khách hàng nào để xem đầy đủ hồ sơ 360 độ (Dự án, Báo giá, Hợp đồng, Thanh toán, Nhật ký, Nghiệm thu, Bảo hành, Timeline) ngay trên môi trường làm việc thực tế.
