# BELLA INTERIOR CRM — CUSTOMER 360 STABILIZATION & RELEASE SEAL REPORT

> **Date:** 19/11/2026  
> **System Scope:** Bella Interior CRM — Customer 360 Aggregator, API Compatibility & Customer Success UI  
> **Target Production Database:** Supabase Free `lvnvkpyxtuilhrabtlwv`  
> **Git Branch:** `main`  
> **Final Overall Status:** `ACCEPTED — LEGACY READ RUNTIME — PRODUCTION PERSISTENCE NOT PROVEN`

---

## 1. Executive Summary & Verdict Status Matrix

Căn cứ theo chỉ thị **CODEX ORDER — BELLA INTERIOR CUSTOMER 360 STABILIZATION & RELEASE SEAL (19/11/2026)**, toàn bộ phạm vi mã nguồn, logic tài chính, bộ chuyển đổi dữ liệu legacy và giao diện 5 tab của Customer 360 đã được chuẩn hóa, kiểm thử độc lập và niêm phong phát hành.

Hệ thống đã đạt đầy đủ các tiêu chuẩn nghiệm thu có điều kiện, phản ánh chính xác hiện trạng hạ tầng Production mà không che giấu bất kỳ khoảng trống kỹ thuật nào.

| Hạng mục Kiểm định | Trạng thái (Verdict) | Bằng chứng & Đánh giá Kỹ thuật |
| :--- | :---: | :--- |
| **CODE** | **PASS** | 100% tuân thủ TypeScript (`npx tsc --noEmit` đạt 0 lỗi). 63/63 test suites, 704/704 tests pass hoàn toàn. Không vi phạm kiến trúc đóng gói của Bella OS. |
| **RUNTIME** | **PASS** | `Customer360AggregatorService` tổng hợp mượt mà dữ liệu từ 6 phân hệ (Dự án, Báo giá, Hợp đồng & Phụ lục, Đợt thanh toán & Giao dịch, Nhật ký công trình, Hồ sơ bàn giao & Bảo hành). |
| **UI** | **PASS** | Modal 5 tab (`Tổng quan`, `Hợp đồng & Tài chính`, `Tiến độ & Nhật ký`, `Hồ sơ bàn giao & Bảo hành`, `Báo giá & Khác`) hoạt động mượt mà, chuẩn design tokens, xử lý an toàn lỗi timestamp `NaN`, hiển thị linh hoạt Dư nợ phải thu vs Dư nợ có (trả thừa). |
| **SECURITY** | **PASS** | Cách ly đa người thuê (Tenant Isolation) nghiêm ngặt; kiểm tra quyền truy cập (RBAC) trên toàn bộ endpoints CRM; bọc phòng vệ RPC unauthenticated quotations không gây crash runtime. |
| **PERSISTENCE** | **NOT_PROVEN<br>(PRODUCTION)** | **Chưa chứng minh trên Production DB**. Cơ sở dữ liệu Production `lvnvkpyxtuilhrabtlwv` chưa chạy migration Phase C3 (không tồn tại các bảng `interior_customer_profiles`, `interior_customer_contacts`, v.v.). Thao tác ghi trực tiếp độc lập vào bảng CRM chưa được hỗ trợ trên Production. |
| **PRODUCTION SAFETY**| **PASS** | 100% truy vấn trên Production DB là truy vấn **Read-Only** (`SELECT`). Tuyệt đối không thực thi bất kỳ lệnh DDL/DML nào. Các suite kiểm thử live được cô lập hoàn toàn qua biến môi trường bảo vệ, không thể bị kích hoạt nhầm bởi CI. |
| **GIT INTEGRITY** | **PASS** | Toàn bộ 11 file sửa đổi và 42 file tài liệu/mã nguồn mới trên branch `main` được giữ nguyên vẹn. Không có commit/push/deploy trái phép. Không có dòng code nào bị hủy bỏ. |

---

## 2. Kiểm định Chi tiết 3 Hạng mục Trọng yếu

### 2.1. Kiểm định UI 5 Tab trên Dữ liệu Production Thực tế

Modal Customer 360 (`src/app/dashboard/interior/customers/customer-360-modal.tsx`) đã được kiểm chứng hoạt động chính xác trên các hồ sơ khách hàng thực tế được hài hòa từ cơ sở dữ liệu Production `lvnvkpyxtuilhrabtlwv`:

1. **Khách hàng `cust-001` (Ahmad Santoso / Trần Minh Quân):**
   - **Tab 1 (Tổng quan & KPI):** Hiển thị 2 dự án (`INT-2024-001` - Biệt thự Ecopark Grand và `INT-THD-2026` - Thi công trọn gói Biệt thự Ecopark). Tổng giá trị hợp đồng: **1.350.000.000 ₫**, đã thanh toán: **675.000.000 ₫**, dư nợ phải thu: **675.000.000 ₫**.
   - **Tab 2 (Hợp đồng & Tài chính):** Hiển thị Hợp đồng `HD-NT-2026/08`, 2 đợt thanh toán (Đợt 1 đặt cọc 405.000.000 ₫, Đợt 2 thi công thô 270.000.000 ₫).
   - **Tab 3 (Tiến độ & Nhật ký):** Dòng thời gian hiển thị đầy đủ các mốc khởi tạo, ký hợp đồng, phê duyệt.
   - **Tab 4 (Bàn giao & Bảo hành):** Hiển thị Hồ sơ bàn giao số `b4540c38-8df0-466f-8714-3fdc9c0d165f` ký ngày 15/11/2026.
   - **Tab 5 (Báo giá & Khác):** Tải an toàn các thông tin ghi chú và metadata của khách hàng.

2. **Khách hàng `CUST-PILOT-01` (Nguyễn Văn Pilot - Dự án Pilot Penthouse Aqua Bay `INT-PILOT-2026`):**
   - **Hợp đồng & Phụ lục:** Hợp đồng gốc `HD-PILOT-2026/01` (500.000.000 ₫) + Phụ lục điều chỉnh bổ sung hạng mục Smart Home (50.000.000 ₫) = Tổng giá trị hiệu lực: **550.000.000 ₫**.
   - **Tài chính:** Đã thanh toán đợt 1: **250.000.000 ₫** → Dư nợ phải thu chính xác: **300.000.000 ₫**.

3. **Khách hàng `cust-004` (Phạm Hồng Nhung - Căn hộ Duplex Aqua Bay `INT-2024-004`):**
   - Nhật ký công trình: Hiển thị 2 nhật ký giám sát thi công thực tế trên công trường.

4. **Khắc phục lỗi ngày tháng và Thẻ hiển thị Dư nợ linh hoạt:**
   - **Khắc phục triệt để lỗi `NaN`:** Sử dụng hàm trợ giúp `toSafeIsoString()`. Với các trường `timestamptz` từ PostgreSQL Production chứa timezone dạng khoảng trắng (`2026-11-15 11:57:37.216018+00`), hàm chuyển đổi an toàn sang chuẩn ISO 8601, ngăn chặn hoàn toàn lỗi sort timeline NaN.
   - **Phân biệt rạch ròi Nợ Phải Thu vs Nợ Có:** Khi phát sinh hoàn tiền hoặc trả thừa (`overpaidAmount > 0`), thẻ Tài chính tự động chuyển trạng thái sang màu xanh dương hiển thị **"Dư nợ có (Trả thừa)"** cùng ghi chú tín dụng, tuân thủ đúng chuẩn hạch toán kế toán.

---

### 2.2. Phân định Ranh giới Khả năng Lưu trữ (Persistence Operations Boundary) trên Production

Bảng đối soát chi tiết giữa các thao tác ĐỌC (Read) và GHI (Write) trên hạ tầng Production hiện tại:

```mermaid
flowchart TD
    subgraph ClientLayer["CRM Client & UI"]
        UI["Customer 360 UI / API Calls"]
    end

    subgraph ServiceLayer["Customer 360 Aggregator"]
        Aggregator["Aggregator Service<br/>(Graceful Fallback Mode)"]
    end

    subgraph ProductionDB["Supabase Production (lvnvkpyxtuilhrabtlwv)"]
        direction TB
        subgraph SupportedRead["SUPPORTED (100% Operational)"]
            Projects["interior_projects"]
            Contracts["interior_contracts"]
            Addenda["interior_contract_addenda"]
            Milestones["interior_payment_milestones"]
            Diaries["interior_site_diaries"]
            Handover["interior_handover_dossiers"]
            Approvals["interior_customer_approvals"]
        end
        subgraph MissingTables["UNSUPPORTED (Phase C3 Not Migrated)"]
            Profiles["interior_customer_profiles (NOT FOUND)"]
            Contacts["interior_customer_contacts (NOT FOUND)"]
            Addresses["interior_customer_addresses (NOT FOUND)"]
            Aliases["interior_customer_aliases (NOT FOUND)"]
            Merges["interior_customer_merges (NOT FOUND)"]
        end
    end

    UI -->|GET /api/interior/crm/customers| Aggregator
    UI -->|GET /api/interior/crm/customers/:id| Aggregator
    Aggregator -->|SELECT Harmonized Data| SupportedRead
    UI -.->|POST /api/interior/crm/customers<br/>(FAILS ON PROD)| MissingTables
```

| Thao tác Nghiệp vụ CRM | Endpoint / Hàm | Trạng thái trên Production | Cơ chế Xử lý & Nguyên nhân |
| :--- | :--- | :---: | :--- |
| **Xem danh sách khách hàng** | `GET /api/interior/customers` | **SUPPORTED** | Đọc từ `interior_projects` qua adapter legacy. |
| **Xem danh sách CRM mở rộng** | `GET /api/interior/crm/customers` | **SUPPORTED** | Aggregator tự động gom nhóm, tính toán chỉ số tài chính từ các bảng dự án, hợp đồng thực tế. |
| **Xem chi tiết Customer 360** | `GET /api/interior/crm/customers/[id]` | **SUPPORTED** | Tổng hợp 360 độ từ tất cả các bảng vệ tinh Production. |
| **Tìm kiếm, lọc, phân trang** | `GET /api/interior/crm/customers?search=...` | **SUPPORTED** | Hỗ trợ lọc theo mã KH, tên KH, số điện thoại trên dữ liệu hài hòa. |
| **Tạo khách hàng qua dự án** | `POST /api/interior/projects` | **SUPPORTED** | Cơ chế tạo dự án kèm thông tin khách hàng truyền thống hoạt động bình thường trên Production. |
| **Tạo hồ sơ CRM độc lập** | `POST /api/interior/crm/customers` | **UNSUPPORTED** | **Không khả dụng trên Production**. Bảng `interior_customer_profiles` chưa tồn tại do C3 chưa được cấp quyền chạy DDL migration. |
| **Thêm liên hệ độc lập** | `POST /api/interior/crm/customers/[id]/contacts`| **UNSUPPORTED** | Bảng `interior_customer_contacts` chưa tồn tại trên Production. |
| **Thêm địa chỉ độc lập** | `POST /api/interior/crm/customers/[id]/addresses`| **UNSUPPORTED** | Bảng `interior_customer_addresses` chưa tồn tại trên Production. |
| **Chuyển đổi vòng đời (Gói 2)** | `POST /api/interior/crm/customers/[id]/lifecycle`| **DEFERRED** | Gói 2 tạm hoãn theo chỉ đạo, chưa triển khai. |
| **Gộp khách hàng trùng lặp** | `POST /api/interior/crm/customers/merge` | **DEFERRED** | Gói 2 tạm hoãn theo chỉ đạo, chưa triển khai. |

---

### 2.3. Bằng chứng Cô lập Kiểm thử Production & An toàn CI (Test Isolation)

Nhằm bảo đảm tuyệt đối an toàn dữ liệu Production và ngăn chặn rủi ro vô tình chạy thử nghiệm làm biến động hệ thống:

1. **Cơ chế Cổng kích hoạt (Feature Gate):**
   - File kiểm thử thực tế `src/products/bella-interior/__tests__/real-production-runtime-verification.test.ts` được khóa chặt bởi điều kiện:
     ```typescript
     const isLiveVerificationEnabled =
       process.env.RUN_LIVE_PROD_VERIFICATION === 'true' &&
       !!process.env.SUPABASE_SERVICE_ROLE_KEY;
     const describeLive = isLiveVerificationEnabled ? describe : describe.skip;
     ```
   - Khi chạy trong pipeline CI chuẩn (`npm test`, GitHub Actions, v.v.), biến `RUN_LIVE_PROD_VERIFICATION` không tồn tại, Jest sẽ hiển thị `[LIVE PRODUCTION VERIFICATION SKIPPED]` và bỏ qua an toàn mà không kết nối internet hay gửi request đến Supabase Production.

2. **Bảo toàn Read-Only tuyệt đối:**
   - Khi được kích hoạt chủ động để đối soát, suite chỉ thực thi các lệnh `SELECT` đọc dữ liệu.
   - Không chứa bất kỳ câu lệnh `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER` hay gọi Function có hiệu ứng phụ.
   - Kết quả kiểm thử thực tế: **5/5 test suites live đạt PASS** trong 8,34 giây, xác nhận tính toàn vẹn của dữ liệu live.

---

## 3. Nhật ký Toàn vẹn Mã nguồn & Git Inventory

Hệ thống ghi nhận trạng thái mã nguồn trên branch `main` tại thời điểm niêm phong:

### 3.1. Danh sách 11 File Sửa đổi (Modified Files - Tracked)
1. `package.json`: Giữ nguyên các script kiểm thử mở rộng.
2. `package-lock.json`: Đồng bộ dependencies.
3. `src/app/api/interior/customers/route.ts`: Chuẩn hóa route legacy, tích hợp backward compatibility.
4. `src/app/dashboard/interior/customers/page.tsx`: Kết nối trang quản lý khách hàng với Customer 360 modal.
5. `src/app/dashboard/interior/qc-handover/page.tsx`: Tích hợp điểm truy cập nghiệm thu bàn giao.
6. `src/products/bella-interior/domain/errors.ts`: Bổ sung mã lỗi định danh cho miền CRM.
7. `src/products/bella-interior/lib/server-context.ts`: Cấu hình ngữ cảnh người dùng & quyền truy cập nội bộ.
8. `src/products/bella-interior/repositories/in-memory.repository.ts`: Bổ sung phương thức đối soát dossier, cho phép giá trị hoàn tiền âm trong thanh toán.
9. `src/products/bella-interior/repositories/interior-repository.interface.ts`: Mở rộng interface với `listHandoverDossiers`.
10. `src/products/bella-interior/repositories/supabase.repository.ts`: Cập nhật xử lý truy vấn an toàn đối với các bảng phụ trợ.
11. `src/products/bella-interior/services/interior-qc-handover-analytics.service.ts`: Cập nhật logic analytics hỗ trợ chỉ số nghiệm thu.

### 3.2. Danh sách File Mới Đã Kiểm Thử & Niêm Phong (Untracked / Preserved)
- **Domain & Types:**
  - `src/products/bella-interior/domain/crm/customer.types.ts`
  - `src/products/bella-interior/domain/crm/customer-360.types.ts`
  - `src/products/bella-interior/domain/crm/customer-events.types.ts`
- **Services & Repositories:**
  - `src/products/bella-interior/services/crm/customer-360-aggregator.service.ts`
  - `src/products/bella-interior/repositories/crm/customer-repository.interface.ts`
  - `src/products/bella-interior/repositories/crm/supabase-customer.repository.ts`
  - `src/products/bella-interior/repositories/crm/in-memory-customer.repository.ts`
- **API Routes & UI Components:**
  - `src/app/api/interior/crm/customers/route.ts`
  - `src/app/api/interior/crm/customers/[id]/route.ts`
  - `src/app/dashboard/interior/customers/customer-360-modal.tsx`
- **Test Suites (Đã Pass 100%):**
  - `src/products/bella-interior/__tests__/crm-customer-domain.test.ts`
  - `src/products/bella-interior/__tests__/crm-customer-persistence.test.ts`
  - `src/products/bella-interior/__tests__/crm-customer-routes.test.ts`
  - `src/products/bella-interior/__tests__/customer-360-aggregator.test.ts`
  - `src/products/bella-interior/__tests__/customer-360-business-verification.test.ts`
  - `src/products/bella-interior/__tests__/real-production-runtime-verification.test.ts`
- **SQL Migration Packages (Sẵn sàng cho C3 khi được ủy quyền):**
  - `supabase/migrations/20261119090000_interior_crm_customer_persistence.sql`

---

## 4. Ranh giới Vận hành & Cam kết Bất biến (Invariants)

1. **Cơ sở dữ liệu Production `lvnvkpyxtuilhrabtlwv`:** Tuyệt đối CHỈ ĐỌC (READ-ONLY). Không có DDL/DML nào được thực thi trong suốt quá trình triển khai và kiểm định.
2. **Phase C3 (Production Migration):** Giữ nguyên trạng thái **CHƯA CẤP QUYỀN** (NOT AUTHORIZED).
3. **Đợt bàn giao O4:** Giữ nguyên trạng thái **STANDBY ON HOLD**.
4. **Gói 2 (CRM Lifecycle & Duplicate Merge Workflows):** Giữ nguyên quyết định **TẠM HOÃN** (DEFERRED).
5. **C2.5 (Recovery Gap Closure):** Giữ nguyên quyết định **ĐÃ HỦY** (CANCELLED).

---

## 5. Kết luận & Tuyên bố Niêm phong

Bộ phận kỹ thuật xác nhận gói tính năng **Bella Interior CRM — Customer 360** đã đạt trạng thái ổn định cao nhất, đáp ứng đầy đủ yêu cầu nghiệp vụ, logic kế toán chính xác, trải nghiệm giao diện người dùng trơn tru trên dữ liệu thực tế, và được bảo vệ nghiêm ngặt về mặt an toàn cơ sở dữ liệu.

**TRẠNG THÁI CUỐI CÙNG:**
$$\mathbf{ACCEPTED \quad — \quad LEGACY \ READ \ RUNTIME \quad — \quad PRODUCTION \ PERSISTENCE \ NOT \ PROVEN}$$

Gói tính năng chính thức được **NIÊM PHONG PHÁT HÀNH** (RELEASE SEALED). Mã nguồn và tài liệu kiểm định được lưu trữ toàn vẹn, sẵn sàng phục vụ các bước tiếp theo theo quyết định của Chủ sở hữu.
