# Architecture Gate Result — Bella Interior OS (Hệ Điều Hành Quản Trị Thiết Kế, Sản Xuất & Thi Công Nội Thất)

Date: 2026-11-06  
Mode: Canonical Product Architecture Gate & Codebase Verification  
Result: `PASS`  

```ini
INTERIOR_PRODUCT_ARCHITECTURE = PASS
ARCHITECTURAL_PRINCIPLE = "PLATFORM REUSE – DOMAIN OWNERSHIP – PRODUCT INDEPENDENCE"
BOUNDED_CONTEXTS = 4 (Design & Spec, Commercial & Costing, Manufacturing & Install, Delivery & Aftercare)
CODEBASE_EVIDENCE = REUSE_STATUS_VERIFIED (PROVEN_REUSABLE vs EXISTS_NOT_PROVEN vs DOMAIN_OWNED)
APPROVED_DESIGN_LOCK = ENFORCED (Production orders strictly require an APPROVED Design Revision)
TRIPARTITE_PRICING = ENFORCED (Separation of Internal COGS, Client Price, and Contract Baseline)
ZERO_ANY_TYPES = ENFORCED
TENANT_ISOLATION_GATE_0 = ENFORCED
FINANCE_OS_INDEPENDENCE = ENFORCED (Finance Outbox integration only, zero direct writes to Finance ledger)
```

---

## 1. Problem and Target User

**Problem:**  
Doanh nghiệp nội thất vận hành một chuỗi giá trị đặc thù kéo dài từ khách hàng, khảo sát hiện trạng, lên ý tưởng phối cảnh 3D và bản vẽ 2D kỹ thuật, bóc tách khối lượng (BOQ) với hàng trăm mã vật liệu và phụ kiện, báo giá và ký hợp đồng chia đợt thanh toán, mua sắm nguyên vật liệu (gỗ công nghiệp MDF/MFC, veneer, đá, ray trượt, bản lề, đèn LED), điều hành sản xuất tại xưởng (cắt CNC, dán cạnh, khoan, lắp ráp, sơn hoàn thiện, QC xưởng) hoặc thuê ngoài gia công, vận chuyển và thi công lắp đặt tại công trình theo từng phòng/khu vực (Living Room, Kitchen, Master Bed), kiểm tra chất lượng nghiệm thu (Punch List), bàn giao và bảo hành hậu mãi.  

Sự khác biệt cốt lõi giữa **Construction OS** và **Interior OS**:
- **Construction OS** tập trung vào tổ chức, an toàn và điều hành thi công công trình dân dụng/công nghiệp.
- **Interior OS** tập trung vào chuỗi từ khách hàng, tư vấn thiết kế, chốt phương án, dự toán, hợp đồng, mua sắm, sản xuất tại xưởng đến lắp đặt chi tiết và bảo hành nội thất.
- Điểm khác biệt mấu chốt: **Một thay đổi thiết kế phải được truy xuất và đồng bộ hóa tức thì đến thay đổi BOQ, giá vốn (COGS), vật tư mua sắm, lệnh sản xuất xưởng, tiến độ lắp đặt và tỷ suất lợi nhuận dự án.**

---

## 2. Platform Capability Reuse Status Matrix (Kiểm Tra Thực Tế Codebase)

Nguyên tắc bất biến: **Có thư mục hoặc tên Engine trong Platform không đồng nghĩa với việc Engine đó đã có contract hoàn chỉnh hoặc có thể tái sử dụng ngay.** Bảng phân định thực tế dựa trên codebase `BELLA SPA ERP`:

| Platform Engine | Vị trí Source Code | Trạng Thái Kiểm Chứng | Kiến Trúc Quyết Định Cho Interior OS |
|---|---|---|---|
| **Action Authorization** | `src/platform/authorization/` | `PROVEN_REUSABLE` | Tái sử dụng `PlatformActionAuthorizationContract` thông qua `PlatformInteriorAuthorizationAdapter` để kiểm tra phân quyền (Designer, QS, Workshop, Supervisor, QC, Owner). |
| **Finance Outbox** | `src/platform/integration-hub/` | `PROVEN_REUSABLE` | Tái sử dụng `FinanceOutboxWriter` để phát sinh sự kiện đối soát thương mại/chi phí. **Interior OS không ghi trực tiếp vào Sổ cái Kế toán TT133.** |
| **State Machine Engine** | `src/platform/state-machine/` | `PROVEN_REUSABLE` (Engine) / `DOMAIN_OWNED` (Rules) | Tái sử dụng FSM Engine dùng chung (`StateMachine`, `TransitionContext`), nhưng toàn bộ States, Transitions và Guards là **DOMAIN_OWNED** do Interior OS sở hữu. |
| **KPI Engine** | `src/platform/kpi-engine/` | `PROVEN_REUSABLE` (Framework) / `DOMAIN_OWNED` (Metrics) | Platform sở hữu framework tính toán, Interior OS sở hữu định nghĩa KPI và logic tính toán: Conversion Rate, Active Projects, Contract Value, Gross Margin %, OTD %. |
| **Party Engine** | `src/platform/party/` | `EXISTS_NOT_PROVEN` | Platform có `PartyRole` và auth-link trường học, nhưng chưa có kho dữ liệu Khách hàng / Nhà cung cấp dùng chung cho Vertical mới. Interior OS sở hữu Customer & Supplier domain entities, hỗ trợ liên kết Party mà không bị phụ thuộc chặn runtime. |
| **Lead Engine** | `src/platform/lead-engine/` | `EXISTS_NOT_PROVEN` | Có SLA/Rotation logic cho Real Estate / Workforce nhưng contract hiện tại gắn với bất động sản. Interior CRM sở hữu Lead entity với các trường đặc thù (phong cách, ngân sách hoàn thiện, khảo sát hiện trạng). |
| **Document Engine** | `src/platform/document-engine/` | `EXISTS_NOT_PROVEN` | Platform Document Engine chỉ là template renderer in-memory, chưa hỗ trợ ký duyệt bản vẽ CAD/3D hay quy trình pháp lý công trình. Quy trình duyệt và khóa bản vẽ là **DOMAIN_OWNED** thuộc Interior OS. |
| **Timeline Engine** | `src/platform/timeline/` | `EXISTS_NOT_PROVEN` | Cần khởi tạo repository qua CompositionEngine (hiện chỉ Healthcare khởi tạo). Interior OS sử dụng cơ chế transactional outbox / domain event store tự bảo vệ, đẩy lên Timeline khi có repository. |
| **Notification Hub** | `src/platform/notification-hub/` | `EXISTS_NOT_PROVEN` | Dispatcher in-memory. Interior OS phát sinh Notification Request như side-effects không chặn transaction nghiệp vụ chính. |

---

## 3. Kiến Trúc 4 Bounded Contexts Của Bella Interior OS

Thay vì chia thành 10 module rời rạc thiếu ranh giới sở hữu dữ liệu, Bella Interior OS được cấu trúc thành **4 Bounded Contexts** thống nhất:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   BELLA INTERIOR OS                                    │
├─────────────────────────────────────────┬──────────────────────────────────────────────┤
│ 1. DESIGN & SPECIFICATION               │ 2. COMMERCIAL & COSTING                      │
│    - InteriorProject, Site & Rooms/Zones│    - Furniture BOQ & BOM Component Breakdown │
│    - Design Revision (V1, V2, Approved) │    - Tripartite Costing (COGS vs Price vs HĐ)│
│    - Design Assets (3D Render, 2D Shop) │    - Quotation Options & Discount Rules      │
│    - Material & Hardware Specifications │    - Contract Baseline & Payment Milestones  │
│    - APPROVED DESIGN LOCK               │    - Cash-flow & Milestone Invoicing         │
├─────────────────────────────────────────┼──────────────────────────────────────────────┤
│ 3. MANUFACTURING & INSTALLATION         │ 4. PROJECT DELIVERY & AFTERCARE              │
│    - Production Order (Strict Lock)     │    - Daily Site Diary & Field Photo Logs     │
│    - Workshop Stages (Cut/Edge/Drill/QC)│    - Field Issues & Blocker Management       │
│    - In-house vs Outsourced Tracking    │    - QC Inspection & Defect Punch List       │
│    - Dispatch & Delivery by Room/Zone   │    - Client Handover Dossier & Acceptance    │
│    - Site Installation Planning         │    - Product & Hardware Warranty Care        │
└─────────────────────────────────────────┴──────────────────────────────────────────────┘
```

---

## 4. Các Quy Tắc Nghiệp Vụ Bất Biến (Canonical Business Invariants)

1. **Gate 0 (Tenant Isolation):** Mọi bảng dữ liệu, service, query và repository đều bắt buộc phải có `tenant_id`. Không một thao tác nào được phép bỏ qua `tenant_id`.
2. **Approved Design Lock:** Xưởng sản xuất **tuyệt đối không được phép sản xuất** dựa trên bản vẽ dự thảo (`draft` hoặc `in_review`). Chỉ khi có phiên bản được duyệt (`APPROVED`), lệnh sản xuất (`ProductionOrder`) mới được cấp phát.
3. **Tripartite Pricing Separation:** Hệ thống phân định rạch ròi 3 loại số liệu:
   - **Giá vốn nội bộ (Internal COGS):** Chi phí gỗ, phụ kiện, nhân công xưởng, vận chuyển, lắp đặt.
   - **Giá chào khách (Quotation Price):** Giá báo khách theo bảng giá niêm yết và chiết khấu.
   - **Giá trị hợp đồng (Contract Baseline):** Căn cứ pháp lý để xuất hóa đơn và thu tiền theo từng đợt thanh toán (ví dụ: 30% - 20% - 30% - 15% - 5%).
4. **Punch List Defect Verification:** Mỗi hạng mục lỗi kiểm tra chất lượng (lệch cánh, xước mặt đá, sai mã veneer) phải có ảnh hiện trường, người chịu trách nhiệm, thời hạn khắc phục và chỉ được đóng khi có xác nhận kiểm tra lại.
5. **Finance OS Independence:** Interior OS chỉ phát sinh dữ liệu tích hợp gửi vào Finance Outbox; tuyệt đối không ghi trực tiếp vào sổ cái chung của Finance OS.
6. **Zero Any Types:** Toàn bộ mã nguồn TypeScript phải có kiểu dữ liệu tường minh, không sử dụng `any`.

---

## 5. Lộ Trình Triển Khai Xuyên Suốt (Phased Execution Roadmap)

- **Phase 1: Project + Design Revision + BOQ/BOM**  
  Tạo dự án, phòng/khu vực, quản lý bản vẽ và vật liệu, duyệt và khóa phiên bản thiết kế, bóc tách khối lượng và dự toán chi phí cấu kiện.
- **Phase 2: Quotation + Contract + Milestones**  
  Tạo các phương án báo giá, áp dụng chiết khấu, chốt hợp đồng và thiết lập các đợt thanh toán theo mốc.
- **Phase 3: Production Order + Workshop**  
  Chuyển bản vẽ duyệt thành lệnh sản xuất xưởng với định mức vật tư và theo dõi các công đoạn mộc (Cắt, Dán cạnh, Khoan, Lắp ráp, Hoàn thiện, QC xưởng, Đóng gói xuất xưởng).
- **Phase 4: Site Installation + QC + Handover**  
  Điều phối hàng về công trình theo phòng, kế hoạch lắp đặt, nhật ký công trình, danh mục lỗi Punch List, khắc phục lỗi và biên bản bàn giao.
- **Phase 5: Procurement + P&L + Warranty**  
  Quản lý đơn mua vật tư PO, kiểm soát lợi nhuận gộp dự án (P&L per project) và hồ sơ bảo hành hậu mãi.

---

## Kết Luận: PASS

Kiến trúc **Bella Interior OS** tuân thủ triệt để nguyên tắc **Platform Reuse – Domain Ownership – Product Independence**, phân định chính xác giữa năng lực đã kiểm chứng và nghiệp vụ chuyên ngành, đủ điều kiện triển khai mã nguồn.

---

## 1. Problem and Target User

**Problem:**  
Doanh nghiệp nội thất vận hành một chuỗi giá trị đặc thù kéo dài từ khách hàng cá nhân/doanh nghiệp, khảo sát hiện trạng, lên ý tưởng phối cảnh 3D và bản vẽ 2D kỹ thuật, bóc tách khối lượng (BOQ) với hàng trăm mã vật liệu và phụ kiện, báo giá và ký hợp đồng chia đợt thanh toán, mua sắm nguyên vật liệu (gỗ công nghiệp MDF/MFC, veneer, đá, ray trượt, bản lề, đèn LED), điều hành sản xuất tại xưởng (cắt CNC, dán cạnh, khoan, lắp ráp, sơn hoàn thiện, QC xưởng) hoặc thuê ngoài gia công, vận chuyển và thi công lắp đặt tại công trình theo từng phòng/khu vực (Living Room, Kitchen, Master Bed), kiểm tra chất lượng nghiệm thu (Punch List), bàn giao và bảo hành hậu mãi.  

Sự khác biệt cốt lõi giữa **Construction OS** và **Interior OS**:
- **Construction OS** tập trung vào tổ chức, an toàn và điều hành thi công công trình dân dụng/công nghiệp.
- **Interior OS** tập trung vào chuỗi từ khách hàng, tư vấn thiết kế, chốt phương án, dự toán, hợp đồng, mua sắm, sản xuất tại xưởng đến lắp đặt chi tiết và bảo hành nội thất.
- Điểm khác biệt mấu chốt: **Một thay đổi thiết kế phải được truy xuất và đồng bộ hóa tức thì đến thay đổi BOQ, giá vốn (COGS), vật tư mua sắm, lệnh sản xuất xưởng, tiến độ lắp đặt và tỷ suất lợi nhuận dự án.**

**Target User:**
- Ban Giám Đốc / Chủ Doanh Nghiệp Nội Thất (quản trị doanh thu, chi phí, lợi nhuận gộp theo từng công trình).
- Đội ngũ Kinh Doanh / Sales & CRM (quản lý lead, tư vấn, khảo sát, báo giá, chốt cọc).
- Đội ngũ Thiết Kế / KTS (quản lý phương án concept, 3D render, 2D shop drawing, spec vật liệu, phiên bản được khách hàng duyệt).
- Kỹ sư Dự Toán / QS (bóc tách BOQ chi tiết, định mức vật tư, cấu trúc giá vốn vs giá bán).
- Phòng Mua Hàng / Procurement (nhà cung cấp, so sánh giá, Purchase Orders, kiểm tra vật tư đầu vào).
- Xưởng Sản Xuất / Workshop (lệnh sản xuất, định mức BOM, các công đoạn cắt-dán-khoan-lắp ráp-sơn-QC-đóng gói).
- Đội Thi Công / Lắp Đặt Công Trường (kế hoạch lắp đặt theo khu vực, nhật ký công trình, xử lý issue).
- Đội Kiểm Định Chất Lượng / QC & Bàn Giao (Checklist, Punch list, nghiệm thu bàn giao).
- Phòng Dịch Vụ Khách Hàng / Bảo Hành (quản lý bảo hành thiết bị/phụ kiện/gỗ, tiếp nhận ticket và xử lý).

---

## 2. Product Proposal & Manifest

```yaml
productName: Bella Interior OS
productType: Vertical OS & Product
productKey: bella_interior
primaryIndustryOS: Bella Interior OS (Dedicated Vertical OS)
platformFoundation: Platform Core (Identity, Tenant, RBAC/Authorization, Notification, Audit, Documents/Media)
sharedOSDependencies: None (Decoupled from Construction OS)
themePreset: graphite_luxe
primaryColor: "#8B5E3C" # Warm Walnut Bronze
accentColor: "#D4AF37" # Brushed Gold Accent
navigationProfile: interior
serviceProfile: interior_fitout
defaultRoute: /dashboard/interior
```

### 3 Business Layers & 10 Core Modules:

1. **Business Operations Layer:**
   - **CRM & Sales:** Quản lý lead, cơ hội, lịch sử tư vấn, khảo sát hiện trạng, pipeline bán hàng.
   - **Design Management:** Quản lý concept, phối cảnh 3D, bản vẽ kỹ thuật 2D, bảng vật liệu, phiên bản duyệt (Version Lock).
   - **BOQ & Estimation:** Bóc tách khối lượng theo khu vực/sản phẩm (tủ bếp, tủ áo, giường, vách), định mức vật tư, giá vốn nội bộ vs giá bán.
   - **Quotation & Contract:** Tạo báo giá nhiều phương án, chiết khấu, hợp đồng thiết kế/thi công, lịch thanh toán theo mốc (milestones).

2. **Project Execution Layer:**
   - **Procurement:** Danh mục nhà cung cấp, vật tư, yêu cầu mua sắm, Purchase Order (PO), nhập kho và kiểm tra chất lượng vật liệu.
   - **Production / Workshop:** Chuyển bản vẽ duyệt thành lệnh sản xuất (Production Order), định mức BOM, theo dõi công đoạn (Cắt CNC, Dán cạnh, Khoan, Lắp ráp, Hoàn thiện, QC, Đóng gói xuất xưởng) hoặc thuê gia công ngoài.
   - **Site Installation:** Kế hoạch thi công, điều phối hàng hóa xưởng, lắp đặt theo khu vực (phòng khách, bếp, phòng ngủ), nhật ký thi công và issue công trình.
   - **Quality Control & Handover:** Checklist QC, danh mục lỗi (Punch List), khắc phục lỗi, nghiệm thu hạng mục và bàn giao khách hàng.

3. **Business Control Layer:**
   - **Finance & Cost Control:** Quản trị doanh thu, chi phí trực tiếp (vật tư, nhân công, gia công, vận chuyển, phát sinh), lãi gộp dự án (P&L per project).
   - **Warranty & After-sales:** Thời hạn bảo hành sản phẩm/phụ kiện, hồ sơ hoàn công, ticket bảo hành, lịch sửa chữa và nhà cung cấp chịu trách nhiệm.

---

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Data / Domain Entity | Canonical Owner | Integration Boundary |
|---|---|---|
| Tenant, User, Organization, RBAC | Platform Core | Authenticated context, RLS policies, direct grants |
| Lead, Customer, Opportunity, Survey | Interior OS | `interior_leads`, `interior_surveys` |
| Design Revisions, Drawings, Material Spec | Interior OS | `interior_design_revisions`, `interior_design_assets` |
| BOQ, BOQ Items, BOM Breakdown | Interior OS | `interior_boqs`, `interior_boq_items` |
| Quotations, Contracts, Payment Milestones | Interior OS | `interior_contracts`, `interior_payment_milestones` |
| Suppliers, Material Catalog, Purchase Orders | Interior OS | `interior_suppliers`, `interior_purchase_orders`, `interior_po_items` |
| Production Orders, Operations, Dispatch | Interior OS | `interior_production_orders`, `interior_production_items` |
| Interior Projects, Zones, Site Diaries, Issues | Interior OS | `interior_projects`, `interior_site_diaries`, `interior_site_issues` |
| QC Inspections, Punch Lists, Handover Dossiers | Interior OS | `interior_qc_inspections`, `interior_punch_list_items`, `interior_handovers` |
| Warranty Certificates, Service Tickets | Interior OS | `interior_warranties`, `interior_warranty_tickets` |
| Cost Control, Project Financials, Margins | Interior OS | `interior_financial_summaries` |
| Ledger, VAT, General Accounting TT133 | Finance OS | Public contract integration (Outbox event / Accounting vouchers) |

---

## 4. Contract Dependency Map (`Product → Contract → Kernel`)

```text
Interior UI (Workspace, Pages, Components)
  │
  ▼
Interior Authenticated API Routes (/api/interior/*)
  │
  ▼
Interior Core Contract & Ports (interior-core.contract.ts)
  │
  ├──► Interior OS Service (interior-os.service.ts)
  │      ├── Domain Validations & State Machines
  │      ├── Invariant Checks (Tenant Isolation, Approved Design Lock)
  │      └── Event Publisher (DB Commit -> Domain Event)
  │
  ├──► Interior Repository (Postgres / In-Memory Adapter)
  │      └── Strict Tenant Isolation (WHERE tenant_id = :tenant_id)
  │
  └──► Platform Capabilities
         ├── Identity & Context (UserProvider, TenantContext)
         ├── Action Authorization (RBAC / Grants)
         └── Audit Trail Engine
```

---

## 5. Change Authority

| Layer | Authorized Scope | Restrictions |
|---|---|---|
| `src/products/bella-interior/` | Full authority to create domain types, contracts, services, repositories, and tests | Zero `any` types; strictly enforce tenant isolation |
| `src/platform/registry/` | Register `bella_interior` in `product-registry.ts` and `vertical-registry.ts` | Preserve existing registered products |
| `src/lib/business-rules/` | Register `bella_interior` in tenant modules and brand themes | Preserve existing defaults |
| `src/components/layout/sidebar.tsx` | Add interior navigation items | Preserve existing tenant menus |
| `src/app/dashboard/interior/` | Add dashboard pages for 10 modules and main workspace | Use Tailwind & Design System |
| `src/app/api/interior/` | Add REST API routes for Interior OS capabilities | Authenticate tenant & user on every endpoint |
| `supabase/migrations/` | Create additive migration for interior tables | Additive only; strict RLS with tenant_id |
| Core Healthcare & Logistics Kernels | **NO MODIFICATION (STRICT HARD LOCK)** | Healthcare H1-H12 and Logistics E7 remain untouched |

---

## 6. UI → Contract Reconciliation

Every UI component in the Bella Interior OS workspace maps directly to an authenticated domain command/query:
- **Lead Board & Pipeline:** `listLeads()`, `createLead()`, `advanceLeadStage()`
- **Design Studio:** `listDesignRevisions()`, `createDesignRevision()`, `approveDesignRevision()`
- **BOQ Estimator:** `getBOQByProject()`, `saveBOQItems()`, `calculateProjectCost()`
- **Contract & Milestone Manager:** `getContract()`, `createContract()`, `updatePaymentMilestone()`
- **Procurement & PO Tracker:** `listPurchaseOrders()`, `createPurchaseOrder()`, `receivePurchaseOrder()`
- **Workshop Production Console:** `listProductionOrders()`, `advanceProductionStage()`, `dispatchToSite()`
- **Site Installation & Diary:** `listProjects()`, `createSiteDiary()`, `reportSiteIssue()`
- **QC & Punch List:** `getQCInspection()`, `createPunchListItem()`, `rectifyPunchListItem()`, `completeHandover()`
- **Cost & Margin Analytics:** `getProjectFinancialSummary()`
- **Warranty Care:** `listWarranties()`, `createWarrantyTicket()`, `resolveWarrantyTicket()`

---

## 7. Migration Applicability & Additive Migration Plan

Additive migration file: `supabase/migrations/20261106150000_create_interior_os_foundation.sql`
- All tables created with `tenant_id UUID NOT NULL REFERENCES tenants(id)`.
- RLS enabled on all tables: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.
- RLS policy: `CREATE POLICY tenant_isolation_policy ON ... USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);`.
- Foreign keys and composite indexes on `(tenant_id, id)`, `(tenant_id, project_id)`.
- No modifications, drops, or alterations of existing tables.

---

## 8. Verification Plan & Applicable Gates

1. **Gate 0 (P0 Tenant Isolation):** Every service method, query, and repository call requires and verifies `tenant_id`. Cross-tenant data leakage test must fail.
2. **Gate 1 (Zero `any` Types):** Strict TypeScript conformance across all created files.
3. **Gate 2 (Design Approval Lock):** Production orders cannot be issued without an `APPROVED` design revision.
4. **Gate 3 (Contract & Payment Baseline):** Contracts lock quotation figures and enforce payment milestones totaling 100%.
5. **Gate 4 (Workflow Progression):** End-to-end integration test verifies the complete chain: `Lead -> Design -> BOQ -> Contract -> Production -> Installation -> Handover`.
6. **Gate 5 (Regression Safety):** Frozen kernels (Healthcare H1-H12, Logistics E7) remain 100% untouched and passing.

---

## Conclusion: PASS

The architectural separation, domain boundaries, ownership model, and phased roadmap for **Bella Interior OS** satisfy all platform constitutional rules. Implementation is authorized.

