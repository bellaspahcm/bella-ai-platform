# BELLA INTERIOR — BÁO CÁO ĐÁNH GIÁ SẴN SÀNG PHÁT HÀNH O4
## EVIDENCE-FIRST RELEASE READINESS PACKAGE (BATCH O4)

**Hệ thống:** Bella Interior OS | **Phân hệ:** Quản lý Thi công, Nghiệm thu & Bàn giao (O4)\
**Dự án Thí điểm:** Aqua Bay Ecopark (`INT-2024-004`) | ID: `d450fc00-a593-484f-a8ad-ff8aebf756df`\
**Thời điểm lập:** 19/11/2026 05:45 +07\
**Kiến trúc Baseline:** v2.0 (Approved 18/11/2026)\
**Trạng thái Điều hành:**
- `O4-A đến O4-E: PASS — LOCAL TESTS (35/35 Tests)`
- `Production Database (lvnvkpyxtuilhrabtlwv): STRICTLY READ-ONLY`
- `Migration 20261118120000: NOT AUTHORIZED ON PRODUCTION`
- `Batch O3: READY ON HOLD`
- **Kết luận Phát hành: `READY WITH CONDITIONS (STANDBY ON HOLD)`**

---

## 1. BÁO CÁO CHỨC NĂNG (FUNCTIONAL AUDIT MATRIX)

### 1.1. Các chức năng đã hoàn thành (Code, Domain Model & Local UI)

| # | Khả năng nghiệp vụ | Thành phần hiện thực | Trạng thái kỹ thuật |
| :---: | :--- | :--- | :---: |
| **1** | **Chiến dịch Nghiệm thu (Acceptance Campaign)** | `AcceptanceCampaign`, `interior_acceptance_campaigns` | Hoàn thành |
| **2** | **Nghiệm thu Đa đợt (Multi-Session Lifecycle)** | `AcceptanceSession`, `interior_acceptance_sessions` | Hoàn thành |
| **3** | **3 Chiều Trạng thái Độc lập** | `inspection_result`, `approval_status`, `documentation_status` | Hoàn thành |
| **4** | **Đánh giá Zero-Defect** | `recordAcceptanceAssessment` (NO_ISSUES không sinh lỗi giả) | Hoàn thành |
| **5** | **Ghi nhận 7 Nhóm Ý kiến** | `AcceptanceNoteItem`, 7 nhóm ý kiến với phân cấp mức độ | Hoàn thành |
| **6** | **Điều hướng Công việc Tự động (Work Routing)** | Tự động chuyển việc sang Punch List, Warranty, Change Order... | Hoàn thành |
| **7** | **Bằng chứng Tệp & Băm SHA-256 Phía Server** | `registerEvidenceObject` (`crypto.createHash('sha256')`) | Hoàn thành |
| **8** | **Quản lý Phiên bản Tệp Bất biến (Versioning)** | Version increment (`v1 -> v2`) tại cùng đường dẫn | Hoàn thành |
| **9** | **Cập nhật Tiến độ Hồ sơ Tự động** | Tự động nâng cấp `documentation_status` (NONE -> PARTIAL -> COMPLETE) | Hoàn thành |
| **10** | **Cổng Phê duyệt Quản lý (Approval Gate)** | Quyền `interior:handover:approve`, chặn trái phép HTTP 403 | Hoàn thành |
| **11** | **Bảo toàn Tồn đọng (Defect Isolation Invariant)** | Quản lý duyệt bàn giao KHÔNG tự động đóng lỗi trong Punch List | Hoàn thành |
| **12** | **Bổ sung Hồ sơ Sau Phê duyệt** | Tải biên bản ký sau duyệt bảo toàn nguyên vẹn lịch sử duyệt | Hoàn thành |
| **13** | **Giao diện Người dùng Tích hợp** | `AcceptanceSessionModal` tích hợp tại `/dashboard/interior/qc-handover` | Hoàn thành |

### 1.2. Các chức năng còn thiếu / Chưa thực hiện / Chờ thực địa

| # | Hạng mục chưa hoàn thành | Nguyên nhân / Ranh giới điều hành | Biện pháp xử lý |
| :---: | :--- | :--- | :--- |
| **1** | **Kết nối Storage Bucket Thật trên Production** | Bucket `interior-acceptance-docs` chưa được tạo trên Production DB. | Chỉ tạo khi có lệnh mở cửa sổ bảo trì Production. |
| **2** | **Thi hành DDL Migration `20261118120000` trên Prod** | Production DB đang duy trì `STRICTLY READ-ONLY` theo lệnh điều hành. | Giữ trạng thái local DDL, không tự ý áp dụng. |
| **3** | **Kiểm thử trên Trình duyệt Live (Real Browser E2E)** | Các bài kiểm thử UI chạy trên môi trường giả lập JSDOM. | Cần phiên kiểm thử thực tế với Chromium trước khi bàn giao. |
| **4** | **Bằng chứng Vật lý Thực tế tại Aqua Bay Ecopark** | Lịch giao hàng và lắp đặt diễn ra ngày 20–21/11/2026. | Áp dụng biên bản giấy và ảnh hiện trường thực tế độc lập. |

---

## 2. BÁO CÁO AN TOÀN & BẢO MẬT (SECURITY & SAFETY AUDIT)

### 2.1. Phân quyền Người dùng & Kiểm soát Vai trò (RBAC)
* **Thẩm quyền Duyệt Nghiệm thu:** Ràng buộc chặt chẽ với quyền hệ thống `interior:handover:approve`. Chỉ người dùng có vai trò Quản lý (`admin`, `manager`, `director`, `general_director`, `project_manager`) mới có thể ký duyệt đợt nghiệm thu.
* **Chặn Đứng Thao tác Trái phép:** Kỹ thuật viên hiện trường (`technician`) hoặc người dùng không có thẩm quyền khi gọi API phê duyệt sẽ bị máy chủ từ chối ngay với mã lỗi **HTTP 403 Forbidden**.
* **Độc lập giữa Giao diện và API:** Phân quyền được thực thi ở cả 2 tầng: giao diện ẩn/vô hiệu hóa nút duyệt, và API backend kiểm tra quyền độc lập trước khi ghi dữ liệu.

### 2.2. Kiểm soát Phân quyền Cơ sở Dữ liệu & Cô lập Tenant (RLS Gate 0)
* **Khắc phục lỗi cấp quyền `service_role`:**
  * Thu hồi triệt để quyền khỏi `PUBLIC` và `anon` (`REVOKE ALL FROM PUBLIC, anon;`).
  * Cấp đầy đủ quyền `SELECT, INSERT, UPDATE, DELETE` cho `service_role` nhằm bảo đảm các tác vụ nền, worker và admin client không bị gián đoạn.
  * Cấp quyền `SELECT, INSERT, UPDATE` cho `authenticated` thông qua chính sách Row-Level Security.
* **Bảo vệ Cô lập Đa Khách hàng (Tenant Isolation):**
  * Tất cả 4 bảng mới (`interior_acceptance_campaigns`, `interior_acceptance_sessions`, `interior_acceptance_notes`, `interior_acceptance_evidence_objects`) đều kích hoạt RLS bắt buộc:
    ```sql
    USING (tenant_id = public.interior_actor_tenant())
    WITH CHECK (tenant_id = public.interior_actor_tenant());
    ```
  * Mọi phương thức truy vấn và cập nhật đều yêu cầu `tenantId` ở tham số đầu tiên.
  * Kiểm thử E2E xác nhận: Tenant B hoàn toàn không thể đọc, liệt kê hoặc duyệt đợt nghiệm thu của Tenant A.

### 2.3. An toàn Lưu trữ Tệp & Tính toàn vẹn Bằng chứng
* **Kiểm soát Tải lên (Upload Guards):**
  * Dung lượng: Giới hạn nghiêm ngặt từ 1 byte đến tối đa 10 MB (10,485,760 bytes). Tệp vượt quá bị từ chối với lỗi `AcceptanceEvidenceSizeExceededError`.
  * Định dạng: Giới hạn danh sách trắng (`image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf`). Chặn đứng các tệp thực thi, script hoặc tệp nhị phân lạ.
* **Toàn vẹn Dữ liệu bằng Server SHA-256:**
  * Mã băm SHA-256 được tính toán trực tiếp từ luồng nhị phân nhận được tại máy chủ backend qua Node.js `crypto`. Tuyệt đối không chấp nhận mã băm do client tự khai báo.
  * Đường dẫn lưu trữ được phân cấp rõ ràng theo Tenant và Session ID:
    `acceptance/{sessionId}/{fileName}`.
  * Phiên bản tệp được đánh số tăng dần bất biến (`v1`, `v2`, `v3`), không bao giờ ghi đè làm mất dấu vết ảnh chụp hiện trường ban đầu.

### 2.4. Đánh giá Zero-Downtime Migration
* Script kiểm tra an toàn `npm run db:migration:zero-downtime` xác nhận migration `20261118120000` đạt chuẩn 100%:
  * Không chứa lệnh phá vỡ cấu trúc (zero `ALTER TABLE ... DROP COLUMN`).
  * Không có giao dịch trung gian lồng nhau (`BEGIN`, `COMMIT`, `ROLLBACK`).
  * Đánh chỉ mục hiệu năng (Compound Index) có chú thích hợp lệ cho bảng mới tạo.

---

## 3. BÁO CÁO PHÂN LOẠI KIỂM THỬ (TEST & EVIDENCE TAXONOMY)

Nhằm duy trì tính minh bạch kỹ thuật cao nhất theo định hướng **Evidence First**, các bài kiểm thử được phân định rạch ròi theo mức độ tin cậy thực tế:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   THÁP BẰNG CHỨNG KIỂM THỬ BATCH O4                   │
├────────────────────────────────────────────────────────────────────────┤
│  [Tầng 5] REAL ON-SITE E2E (0/1)  ── Chờ thực địa 20-21/11 Aqua Bay    │
│  [Tầng 4] SIMULATED E2E    (1/1)  ── PASS (In-Memory, 9 Phases, E01-E20)│
│  [Tầng 3] UI INTEGRATION   (3/3)  ── PASS (JSDOM React Testing Library)│
│  [Tầng 2] API BOUNDARY     (10/10)── PASS (Mock Context / Route tests)  │
│  [Tầng 1] UNIT & SERVICES  (21/21)── PASS (Domain Invariants & Service)│
└────────────────────────────────────────────────────────────────────────┘
```

### Chi tiết 5 Bộ Test Suite Cục bộ (35/35 Tests PASSED):

1. **`o4-database-and-domain-model.test.ts` (11 Tests — Unit Level):**
   * Kiểm tra tính toàn vẹn của DDL migration, cấu trúc 4 bảng additive, ràng buộc 3 chiều trạng thái, 7 nhóm ý kiến, và các hàm bảo vệ bất biến miền (`isZeroDefectAssessment`, `doesApprovalCloseRemediation`).
   * *Mức độ tin cậy:* **Unit Test trên mã nguồn cục bộ.**
2. **`o4-api-and-business-services.test.ts` (10 Tests — Service Integration Level):**
   * Kiểm tra logic xử lý của `InteriorAcceptanceService` kết nối với `InMemoryInteriorRepository`: tạo chiến dịch, tạo đợt nghiệm thu, đánh giá zero defect, tính SHA-256 server-side, versioning tệp, và phê duyệt quản lý.
   * *Mức độ tin cậy:* **Integration Test trên bộ nhớ (In-Memory).**
3. **`o4-api-routes.test.ts` (10 Tests — HTTP Boundary Level):**
   * Kiểm tra 5 API route handlers (`campaigns`, `sessions`, `notes`, `evidence`, `approval`): xác thực tham số UUID, kiểm tra phân quyền (HTTP 403 khi thiếu quyền), kiểm tra mã trạng thái HTTP 200, 201, 400.
   * *Mức độ tin cậy:* **API Contract Test với mock server context.**
4. **`o4-ui-integration.test.tsx` (3 Tests — Presentation Level):**
   * Kiểm tra hiển thị của `AcceptanceSessionModal`, chuyển tab, gửi form tạo đợt nghiệm thu, hiển thị 3 huy hiệu trạng thái độc lập, và thao tác phê duyệt của quản lý.
   * *Mức độ tin cậy:* **UI Component Test trong môi trường JSDOM.**
5. **`o4-e2e-acceptance-lifecycle.test.ts` (1 Suite / 9 Phases — Simulated E2E):**
   * Mô phỏng toàn bộ hành trình công trường dự án Aqua Bay Ecopark `INT-2024-004` từ khởi tạo chiến dịch $\rightarrow$ nghiệm thu 3 phòng $\rightarrow$ phát sinh lỗi $\rightarrow$ chuyển việc sang Punch List $\rightarrow$ tải ảnh và tính hash $\rightarrow$ quản lý duyệt có điều kiện $\rightarrow$ thợ khắc phục $\rightarrow$ tái kiểm tra $\rightarrow$ bổ sung biên bản ký sau duyệt $\rightarrow$ kiểm tra cô lập đa khách hàng.
   * *Mức độ tin cậy:* **Simulated E2E trên bộ nhớ (chưa phải Real Database/Storage).**

> [!WARNING]
> **Ranh giới quan trọng:** Toàn bộ 35 bài kiểm thử trên được thực thi bằng dữ liệu trong bộ nhớ (`InMemoryInteriorRepository`) và mock context. Hệ thống chưa chạy các bài kiểm thử này qua cơ sở dữ liệu thật, dịch vụ Storage thật hay Supabase Auth thật của Production.

---

## 4. KẾT LUẬN PHÁT HÀNH (RELEASE CONCLUSION)

### **Quyết định: `READY WITH CONDITIONS (STANDBY ON HOLD)`**

Batch O4 đã hoàn tất đầy đủ các mục tiêu thiết kế và cài đặt ở cấp độ mã nguồn, kiến trúc miền, dịch vụ nghiệp vụ, API và giao diện người dùng. Tuy nhiên, theo nguyên tắc **Evidence First** và để đảm bảo an toàn tuyệt đối cho hệ thống đang vận hành:

### **4 Điều kiện Tiên quyết (Prerequisites for Production Release):**

1. **Điều kiện 1 — Duy trì Production Database Read-Only:**
   * Cơ sở dữ liệu Production `lvnvkpyxtuilhrabtlwv` tiếp tục duy trì chế độ **`STRICTLY READ-ONLY`**.
   * Nghiêm cấm mọi hành vi ghi dữ liệu thử nghiệm hoặc thao tác DDL/DML trực tiếp trên Production.
2. **Điều kiện 2 — Tạm hoãn Migration `20261118120000`:**
   * Bản DDL migration `20261118120000_interior_o4_acceptance_campaign_and_evidence.sql` **chưa được phép chạy trên Production**.
   * Bản DDL này sẽ được xếp vào hàng đợi chờ phát hành chính thức trong cửa sổ bảo trì (Maintenance Window) được Quản trị viên phê duyệt riêng.
3. **Điều kiện 3 — Áp dụng Quy trình Nghiệm thu Thực địa Độc lập tại Aqua Bay Ecopark:**
   * Ngày 20–21/11/2026, đội ngũ giám sát và khách hàng tại Aqua Bay Ecopark (`INT-2024-004`) áp dụng quy trình kiểm tra chất lượng theo đúng cấu trúc của đặc tả O4 (ảnh tổng thể, ảnh chi tiết, biên bản ký nhận, ghi nhận tồn đọng).
   * Hồ sơ giấy và ảnh hiện trường thực tế sẽ được lưu giữ nguyên bản độc lập, làm căn cứ đối soát khi hệ thống O4 được đưa vào hoạt động chính thức.
4. **Điều kiện 4 — Kiểm thử Staging / Pre-Production với Dịch vụ Thật:**
   * Trước khi đưa O4 lên Production, cần kích hoạt một môi trường Staging/Test có đầy đủ Supabase Auth và Storage Bucket thật để chạy bộ kiểm thử `Real E2E`, xác minh việc tải tệp nhị phân và phân quyền database thực tế.

---

## 5. ĐỊNH HƯỚNG CHIẾN LƯỢC KẾ TIẾP: PHÂN HỆ CRM & CHĂM SÓC KHÁCH HÀNG

Đồng thuận tuyệt đối với chỉ đạo chiến lược của Quản trị viên: **O4 chỉ hoàn tất luồng vận hành công trình, không đại diện cho toàn bộ sản phẩm Bella Interior**.

Hai dòng nghiệp vụ lớn của Bella Interior được phân định ranh giới độc lập và rõ ràng:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   HAI DÒNG NGHIỆP VỤ BELLA INTERIOR                    │
├────────────────────────────────────────────────────────────────────────┤
│ DÒNG 1: QUẢN LÝ THỰC HIỆN HỢP ĐỒNG & CÔNG TRÌNH (O1 - O4)              │
│ Hợp đồng → Thiết kế → BOQ → Sản xuất → Thi công → QC → Nghiệm thu/BG  │
│ [Trạng thái: Đạt chuẩn Kiến trúc & Kỹ thuật — READY ON HOLD]           │
├────────────────────────────────────────────────────────────────────────┤
│ DÒNG 2: QUẢN LÝ TRỌN VÒNG ĐỜI KHÁCH HÀNG (CRM & CUSTOMER SUCCESS)      │
│ Nguồn khách → Phân loại → Chăm sóc → Khảo sát → Báo giá → Đàm phán    │
│ → Ký hợp đồng → Chăm sóc sau bán → Bảo hành & Tái ký                   │
│ [Trạng thái: WORKSTREAM CHIẾN LƯỢC TIẾP THEO — CẦN KHỞI ĐỘNG RIÊNG]   │
└────────────────────────────────────────────────────────────────────────┘
```

### Trọng tâm triển khai tiếp theo sau khi đóng O4:
1. **Thiết kế Kiến trúc Phân hệ CRM:** Hoạch định phễu khách hàng (Pipeline & Stages), nguồn gốc khách (Referral, Website, Showroom), người phụ trách (Sales/Architect), và nhật ký tương tác.
2. **Kết nối hai dòng nghiệp vụ:** Hợp đồng thành công từ CRM sẽ tự động kích hoạt luồng O1 (Thiết kế & BOQ); và đợt bàn giao hoàn tất từ O4 sẽ tự động chuyển thông tin sang luồng Chăm sóc sau bán & Bảo hành của CRM.
3. **Tiếp nhận Bằng chứng Hiện trường:** Sẵn sàng tiếp nhận dữ liệu kiểm tra thực tế từ công trường Aqua Bay Ecopark vào ngày 21/11/2026.
