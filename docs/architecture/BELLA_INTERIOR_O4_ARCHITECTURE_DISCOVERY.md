# BELLA INTERIOR — O4 ARCHITECTURE DISCOVERY & GAP REPORT
**Hệ thống:** Bella Interior OS | **Phân hệ:** Nghiệm thu, Lắp đặt & Bàn giao (`Installation, Acceptance & Handover`)  
**Tiêu chuẩn Kiến trúc:** v2.0 — Approved 18/11/2026 | **Đặc tả Triển khai:** `BELLA_INTERIOR_O4_IMPLEMENTATION_SPECIFICATION.md`  
**Giai đoạn:** Workstream O4-A — Existing Architecture Discovery  
**Ranh giới Vận hành:** `Production Database = STRICTLY READ-ONLY` | `O3 = READY ON HOLD` | `Migration Production = NOT AUTHORIZED`

---

## 1. MỤC TIÊU CỦA BÁO CÁO DISCOVERY O4-A

Báo cáo này thực hiện bước đầu tiên theo quy trình **Discover $\rightarrow$ Map $\rightarrow$ Implement $\rightarrow$ Verify $\rightarrow$ Fix $\rightarrow$ Seal**:
1. Khảo sát toàn diện cơ sở dữ liệu hiện hành, migration ledger, domain services, API routes và phân quyền RBAC của Bella Interior.
2. Thiết lập Bản đồ Kế thừa (Reusability & Mapping Map) để tái sử dụng tối đa hạ tầng sẵn có, tránh tạo trùng lặp mô hình Project, BOQ, Punch List, Warranty, Finance hoặc Identity.
3. Nhận diện các khoảng trống (Architecture & Schema Gaps) giữa hiện trạng và 10 yêu cầu cốt lõi của Đặc tả O4.
4. Xây dựng lộ trình thiết kế Schema Additive và Service Layer sẵn sàng cho các workstream tiếp theo (O4-B $\rightarrow$ O4-F) mà không vi phạm ranh giới READ-ONLY của Production.

---

## 2. KHẢO SÁT HẠ TẦNG HIỆN HÀNH (CURRENT STATE INVENTORY)

### 2.1. Khảo sát Cơ sở Dữ liệu & Bảng Hiện hữu
Qua kiểm tra schema và lịch sử migration (`supabase/migrations/`), phân hệ Interior hiện sở hữu các thực thể cốt lõi sau:

| Bảng Cơ sở Dữ liệu | Bounded Context | Trạng thái Hiện tại | Khả năng Tái sử dụng cho Batch O4 |
| :--- | :--- | :--- | :--- |
| `public.interior_projects` | Project Core | Đang hoạt động | **Tái sử dụng 100%**: Lưu `id`, `tenant_id`, `code`, `name`, `client_name`, `client_phone`, `status`. Là gốc liên kết của toàn bộ Campaign/Session. |
| `public.interior_boq_items` | Commercial Takeoff | Đang hoạt động | **Tái sử dụng 100%**: Lưu `id`, `code`, `name`, `room_zone_name`. Phục vụ liên kết trực tiếp vào từng Session và Note. |
| `public.interior_production_orders` & `items` | Manufacturing Integration | Đang hoạt động | **Tái sử dụng 100%**: Lưu liên kết đơn hàng xưởng (`LSX-2024-004-R1`) phục vụ đợt nghiệm thu theo đợt giao (`DELIVERY_BATCH`). |
| `public.interior_site_installation_plans` | Site Operations | Đang hoạt động | **Tái sử dụng 100%**: Lưu kế hoạch lắp đặt hiện trường, người giám sát công trình. |
| `public.interior_site_diaries` | Site Operations | Đang hoạt động | **Tái sử dụng & Mở rộng**: Đã có 3 cột additive (`production_order_id`, `plan_id`, `diary_type`) từ PR #554. Lưu vết nhật ký thi công hàng ngày. |
| `public.interior_qc_punch_list_items` | Quality Control | Đang hoạt động | **Tái sử dụng 100% cho Work Routing**: Lưu các lỗi thi công/lắp đặt (`status IN ('open', 'in_progress', 'rectified', 'verified')`). |
| `public.interior_handover_dossiers` | Commercial Handover | Đang hoạt động | **Tái sử dụng cho Final Handover**: Lưu hồ sơ bàn giao thương mại và thanh quyết toán cuối cùng (`final_settlement_value`, `contract_id`). |
| `public.interior_handover_acceptance_requests` | Customer Evidence | Đang hoạt động | **Tái sử dụng Mô hình Chữ ký**: Đã có cơ chế token ký số, lưu `signature_storage_path`, `signature_sha256_hash`, `signature_file_size_bytes`. |
| `public.interior_warranty_certificates` | Aftercare & Warranty | Đang hoạt động | **Tái sử dụng 100%**: Chứng chỉ bảo hành kích hoạt sau khi hoàn tất đợt nghiệm thu cuối cùng (`FINAL_HANDOVER`). |
| `public.interior_warranty_service_tickets` | Aftercare & Warranty | Đang hoạt động | **Tái sử dụng 100% cho Work Routing**: Tiếp nhận các khiếu nại sau bàn giao từ ghi chú `QUALITY_ISSUE` / `DAMAGE`. |
| `public.audit_logs` | Platform Governance | Đang hoạt động | **Tái sử dụng 100%**: Bảng audit chuẩn với `action IN ('INSERT', 'UPDATE', 'DELETE')`, `old_data`, `new_data`, `changed_by_id`. |
| `storage.buckets` | Platform Storage | Đang hoạt động | Đã có `interior-customer-signatures`. Migration `20261118060000` bổ sung `interior-site-evidence`. |

### 2.2. Khảo sát Domain Services Hiện hữu (`src/products/bella-interior/services/`)
1. **`DeliveryAftercareService` (`delivery-aftercare.service.ts`):**
   - Đã cài đặt sẵn: `recordSiteDiary`, `recordPunchListItem`, `rectifyPunchListItem`, `verifyPunchListItem`, `completeHandover`, `createWarrantyTicket`.
   - Có kiểm tra rào chắn: Chặn hoàn tất bàn giao nếu còn tồn đọng lỗi nghiêm trọng (`openCritical.length > 0`).
2. **`InteriorQCHandoverAnalyticsService` (`interior-qc-handover-analytics.service.ts`):**
   - Tính toán toàn bộ KPI, Roadmap chất lượng và danh sách Punch List cho trang quản trị hiện trường `/dashboard/interior/qc-handover`.
3. **`InteriorWarrantyAnalyticsService` (`interior-warranty-analytics.service.ts`):**
   - Quản lý danh mục chứng chỉ bảo hành và các phiếu yêu cầu dịch vụ.
4. **`InteriorContractLifecycleService` (`interior-contract-lifecycle.service.ts`):**
   - Quản lý hợp đồng, nghiệm thu bàn giao và phụ lục phát sinh (`addendum`).

### 2.3. Khảo sát Phân quyền RBAC (`src/products/bella-interior/lib/server-context.ts`)
Hệ thống Interior RBAC đã định nghĩa sẵn các quyền scoped khớp hoàn hảo với Đặc tả O4:
- **Người phê duyệt (Approver):** `INTERIOR_PERMISSIONS.handoverApprove = 'interior:handover:approve'`
- **Người ghi nhận (Recorder):** `INTERIOR_PERMISSIONS.installationCreate = 'interior:installation:create'`
- **Người tải tài liệu (Uploader):** `INTERIOR_PERMISSIONS.installationUpdate = 'interior:installation:update'` hoặc `INTERIOR_PERMISSIONS.deliveryCreate = 'interior:delivery:create'`
- **Người quản lý QC (QC Supervisor):** `INTERIOR_PERMISSIONS.qcCreate = 'interior:qc:create'`, `qcApprove = 'interior:qc:approve'`

---

## 3. NHẬN DIỆN KHOẢNG TRỐNG KIẾN TRÚC (GAP ANALYSIS)

Mặc dù hệ thống đã có nền tảng rất mạnh về Punch List và Handover Dossier đơn lẻ, nhưng đối chiếu với 10 yêu cầu của **Đặc tả O4**, hệ thống đang tồn tại 5 khoảng trống kiến trúc chính:

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   O4 ARCHITECTURAL GAP MATRIX                                          │
├────────────────────────────────┬───────────────────────────────────────┬───────────────────────────────┤
│ Yêu cầu Đặc tả O4              │ Hiện trạng Hệ thống                   │ Đánh giá Khoảng trống (Gap)   │
├────────────────────────────────┼───────────────────────────────────────┼───────────────────────────────┤
│ 1. Multi-Campaign & Sessions   │ Chỉ có 1 bảng Handover Dossier duy    │ THIẾU BẢNG:                   │
│    (Đa đợt nghiệm thu độc lập) │ nhất cho toàn bộ dự án.               │ Cần bảng Campaign & Session   │
├────────────────────────────────┼───────────────────────────────────────┼───────────────────────────────┤
│ 2. Acceptance Notes (7 nhóm)   │ Chỉ có ghi chú dạng text đơn giản     │ THIẾU BẢNG:                   │
│    với Work Routing tự động    │ trong diary hoặc punch list riêng rẽ. │ Cần bảng Acceptance Notes     │
├────────────────────────────────┼───────────────────────────────────────┼───────────────────────────────┤
│ 3. Ba Trục Trạng thái Độc lập  │ Chỉ có 1 cột status đơn nhất          │ THIẾU TRƯỜNG DỮ LIỆU:         │
│    (Result / Approval / Doc)   │ ('pending', 'completed').             │ Cần tách 3 cột độc lập        │
├────────────────────────────────┼───────────────────────────────────────┼───────────────────────────────┤
│ 4. Storage Object Identity &   │ Chỉ lưu mảng URL text[] hoặc 1 đường  │ THIẾU BẢNG QUẢN LÝ VERSION:   │
│    Version Immutability        │ dẫn signature_storage_path duy nhất.  │ Cần bảng StorageObjectRef     │
├────────────────────────────────┼───────────────────────────────────────┼───────────────────────────────┤
│ 5. Post-Approval Supplement    │ Chưa có cơ chế tải bổ sung hồ sơ      │ THIẾU WORKFLOW LOGIC:         │
│    (Bổ sung hồ sơ sau duyệt)   │ mà không chạm vào quyết định duyệt.   │ Cần logic Recalculate Doc     │
└────────────────────────────────┴───────────────────────────────────────┴───────────────────────────────┘
```

---

## 4. BẢN ĐỒ THIẾT KẾ KẾ THỪA & THỰC THỂ MỚI (MAPPING & DATA MODEL DESIGN)

Để lấp đầy các khoảng trống trên mà không làm vỡ các hợp đồng nghiệp vụ hiện hữu, kiến trúc O4 sẽ áp dụng nguyên tắc **MỞ RỘNG CỘNG DỒN (ADDITIVE EXTENSION)**:

### 4.1. Thực thể Mới 1: `interior_acceptance_campaigns`
* **Mục đích:** Quản lý chương trình nghiệm thu của dự án.
* **Quan hệ:** Thuộc `interior_projects` (1 Project có nhiều Campaign).
* **Các trường cốt lõi:**
  * `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  * `tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`
  * `project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE`
  * `campaign_code TEXT NOT NULL` (ví dụ: `CPG-2024-004-01`)
  * `campaign_name TEXT NOT NULL`
  * `description TEXT`
  * `created_by_user_id UUID REFERENCES auth.users(id)`
  * `created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()`
  * `updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()`
  * Ràng buộc: `UNIQUE(tenant_id, project_id, campaign_code)`

### 4.2. Thực thể Mới 2: `interior_acceptance_sessions`
* **Mục đích:** Đại diện cho một đợt nghiệm thu kiểm tra thực tế tại hiện trường.
* **Quan hệ:** Thuộc `interior_acceptance_campaigns` và `interior_projects`.
* **Cài đặt Ba Trục Trạng thái Độc lập (Bắt buộc theo Mục 4 của Đặc tả):**
  * `inspection_result TEXT NOT NULL DEFAULT 'PENDING_REMEDIATION'`  
    `CHECK (inspection_result IN ('ACCEPTED_WITHOUT_ISSUES', 'ACCEPTED_WITH_REMARKS', 'PENDING_REMEDIATION'))`
  * `approval_status TEXT NOT NULL DEFAULT 'PENDING'`  
    `CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'))`
  * `documentation_status TEXT NOT NULL DEFAULT 'NONE'`  
    `CHECK (documentation_status IN ('NONE', 'PARTIAL', 'COMPLETE'))`
* **Các trường nghiệp vụ:**
  * `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  * `tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`
  * `campaign_id UUID NOT NULL REFERENCES public.interior_acceptance_campaigns(id) ON DELETE CASCADE`
  * `project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE`
  * `session_code TEXT NOT NULL` (ví dụ: `ACS-2024-004-01`)
  * `session_type TEXT NOT NULL`  
    `CHECK (session_type IN ('ROOM_BY_ROOM', 'ITEM_BASED', 'DELIVERY_BATCH', 'POST_REMEDIATION', 'FINAL_HANDOVER'))`
  * `inspection_scope TEXT NOT NULL`
  * `inspection_date DATE NOT NULL`
  * `recorder_actor_id UUID NOT NULL REFERENCES auth.users(id)`
  * `customer_representative TEXT NOT NULL`
  * `customer_contact TEXT`
  * `related_boq_item_ids UUID[] DEFAULT ARRAY[]::UUID[]`
  * `approved_by_actor_id UUID REFERENCES auth.users(id)`
  * `approved_at TIMESTAMPTZ`
  * `rejection_reason TEXT`
  * `approval_notes TEXT`
  * `created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()`
  * `updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()`

### 4.3. Thực thể Mới 3: `interior_acceptance_notes`
* **Mục đích:** Lưu trữ chi tiết từng phản ánh/ghi chú hiện trường trong session.
* **Quan hệ:** Thuộc `interior_acceptance_sessions`.
* **Phân loại 7 nhóm & Work Routing:**
  * `category TEXT NOT NULL CHECK (category IN ('QUALITY_ISSUE', 'INSTALLATION_ISSUE', 'CUSTOMER_REQUEST', 'MISSING_ITEM', 'DAMAGE', 'FOLLOW_UP', 'GENERAL_NOTE'))`
  * `severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical'))`
  * `assessment_status TEXT NOT NULL DEFAULT 'NO_ISSUES' CHECK (assessment_status IN ('NO_ISSUES', 'MINOR_MONITORING', 'DEFECT_REMEDIATION_REQUIRED', 'INCOMPLETE_ITEMS'))`
  * `remediation_status TEXT NOT NULL DEFAULT 'OPEN' CHECK (remediation_status IN ('OPEN', 'IN_PROGRESS', 'READY_FOR_REINSPECTION', 'VERIFIED', 'CLOSED'))`
  * `routed_entity_type TEXT` (ví dụ: `'punch_list'`, `'warranty_ticket'`, `'replenishment'`, `'change_order'`)
  * `routed_entity_id UUID` (Khóa ngoại trỏ đến bản ghi đã tạo tương ứng)
  * `remediation_plan TEXT`
  * `assigned_fixer TEXT`
  * `target_deadline DATE`
  * `created_by_user_id UUID NOT NULL REFERENCES auth.users(id)`

### 4.4. Thực thể Mới 4: `interior_acceptance_evidence_objects`
* **Mục đích:** Lưu trữ định danh đối tượng Storage bất biến có quản lý phiên bản.
* **Các trường:**
  * `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  * `tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`
  * `session_id UUID NOT NULL REFERENCES public.interior_acceptance_sessions(id) ON DELETE CASCADE`
  * `note_id UUID REFERENCES public.interior_acceptance_notes(id) ON DELETE SET NULL`
  * `evidence_category TEXT NOT NULL CHECK (evidence_category IN ('OVERALL', 'DETAIL', 'COMPLETED_PRODUCT', 'CUSTOMER_SIGNOFF', 'REMEDIATION_PROOF'))`
  * `bucket_id TEXT NOT NULL`
  * `storage_path TEXT NOT NULL`
  * `file_name TEXT NOT NULL`
  * `file_size_bytes BIGINT NOT NULL`
  * `mime_type TEXT NOT NULL`
  * `sha256_hash TEXT NOT NULL CHECK (sha256_hash ~ '^[0-9a-f]{64}$')` (Server tự tính)
  * `version INTEGER NOT NULL DEFAULT 1`
  * `uploaded_by_user_id UUID NOT NULL REFERENCES auth.users(id)`
  * `uploaded_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()`

---

## 5. MA TRẬN KẾ THỪA VÀ PHÂN LUỒNG TỰ ĐỘNG (WORK ROUTING MATRIX)

Đặc tả O4 yêu cầu tái sử dụng tối đa các dịch vụ hiện có:

```mermaid
flowchart LR
    Note["Acceptance Note"] --> Cat{Category?}
    Cat -->|QUALITY_ISSUE / INSTALLATION_ISSUE| PL["interior_qc_punch_list_items<br/>(Gọi DeliveryAftercareService.recordPunchListItem)"]
    Cat -->|DAMAGE (Sau bàn giao)| WT["interior_warranty_service_tickets<br/>(Gọi DeliveryAftercareService.createWarrantyTicket)"]
    Cat -->|MISSING_ITEM| RM["Replenishment Task / Xuất kho phụ kiện"]
    Cat -->|CUSTOMER_REQUEST| CO["Change Order / Phụ lục hợp đồng Addendum"]
    Cat -->|FOLLOW_UP| RI["Lịch công tác Tái kiểm tra Hiện trường"]
    Cat -->|GENERAL_NOTE| CRM["CRM / Chăm sóc khách hàng (Không tạo task)"]
```

---

## 6. KẾ HOẠCH TRIỂN KHAI CÁC WORKSTREAM TIẾP THEO (O4-B $\rightarrow$ O4-F)

1. **Workstream O4-B (Database & Domain Model):**
   - Soạn thảo migration DDL hoàn chỉnh cho 4 bảng mới (`interior_acceptance_campaigns`, `interior_acceptance_sessions`, `interior_acceptance_notes`, `interior_acceptance_evidence_objects`).
   - Thiết lập các chỉ mục tối ưu, khóa ngoại, check constraints và chính sách Tenant Isolation RLS.
   - Thử nghiệm trên môi trường Non-Production / Test Runner.
2. **Workstream O4-C (Server Services & RPC):**
   - Mở rộng `DeliveryAftercareService` hoặc xây dựng `AcceptanceSessionService` kế thừa repository.
   - Cài đặt RPC kiểm soát thẩm quyền Server-enforced và tự động tính mã băm SHA-256 từ luồng tệp.
   - Cài đặt thuật toán tự động cập nhật `documentation_status` (`NONE` $\rightarrow$ `PARTIAL` $\rightarrow$ `COMPLETE`).
3. **Workstream O4-D (UI Integration):**
   - Nâng cấp màn hình hiện hữu `/dashboard/interior/qc-handover` để hiển thị danh sách Campaign / Session.
   - Xây dựng modal phiếu nghiệm thu 5 phần theo đúng chuẩn giao diện approved.
4. **Workstream O4-E & O4-F (Testing & Release Readiness):**
   - Viết bộ 20 kịch bản kiểm thử E2E (E01 $\rightarrow$ E20) khớp 100% bảng yêu cầu trong Đặc tả.
   - Lập báo cáo an toàn và nghiệm thu mã nguồn.

---

## 7. KẾT LUẬN & TUÂN THỦ RANH GIỚI VẬN HÀNH

* Báo cáo Discovery O4-A xác nhận: **Hệ thống có đầy đủ nền tảng để triển khai O4 một cách thanh thoát thông qua cơ chế cộng dồn (Additive Extension), không cần đập bỏ hay refactor các phân hệ hiện có**.
* **Tuân thủ Tuyệt đối Ranh giới:**
  * Cơ sở dữ liệu Production `lvnvkpyxtuilhrabtlwv` duy trì **100% READ-ONLY**.
  * Batch O3 tiếp tục giữ nguyên trạng thái **`READY ON HOLD`**.
  * Toàn bộ mã nguồn và test của O4 sẽ được thực thi trên môi trường kiểm thử được ủy quyền.
