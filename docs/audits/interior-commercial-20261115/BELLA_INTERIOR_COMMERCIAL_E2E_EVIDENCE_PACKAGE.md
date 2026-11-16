# BELLA Interior Commercial — Production Evidence Package & Acceptance Baseline
**Trạng thái nghiệm thu chính thức:**  
# **`PRODUCTION VERIFIED — COMMERCIAL E2E PROVEN ON CONTROLLED PILOT`**

**Ngày lập:** 16/11/2026 (Cập nhật Hardening: 17/11/2026)  
**Môi trường:** Live Production (`https://bella-spa-erp.vercel.app`)  
**Cơ sở dữ liệu:** Supabase Production `lvnvkpyxtuilhrabtlwv` (`ap-southeast-1`)  
**Verified Code/Deployment SHA:** `fae81d7aeb6acdc24b197876f12a828814c81f1a` (Commit triển khai Vercel Production được kiểm chứng E2E/UI Smoke)  
**Mainline Archive SHA:** `a113bbfe8b417e453e1a0df91b36e8db0008544e` (Commit hợp nhất PR #545 lưu trữ hồ sơ nghiệm thu vào nhánh `main`)  
**Tenant ID:** `686884d2-6a4a-4581-ac8f-6ae69666b31d` (Bella Interior Demo)  
**Primary Actor:** `9077b10b-ee20-4058-907b-7a3e918b84c3` (`demo.interior@bellaspa.vn` — OWNER & ADMIN)

---

## 1. Bảng Tổng hợp Trạng thái Nghiệm thu (Acceptance Matrix)

Theo định hướng quản trị của Kiến trúc sư Trưởng, hệ thống BELLA Interior Commercial được phân loại và đánh giá chính xác:

| Hạng mục | Kết quả Báo cáo | Trạng thái Đánh giá | Ranh giới & Điều kiện nghiệm thu |
|---|---|---|---|
| **Database & Security** | 20/20 checks | ✅ **VERIFIED** | RLS, Triggers, Security Definer, Isolation vượt qua toàn bộ |
| **Authenticated API & Lifecycle** | API + RPC | ✅ **PROVEN** | RBAC, Project Isolation, Lifecycle RPCs hoạt động chuẩn xác |
| **Browser UI Smoke** | 7/7 checks | ✅ **VERIFIED PASS** | Playwright test chạy trực tiếp trên Live Vercel Production |
| **Historical Ledger Reconciliation** | 675M / 675M | ✅ **RECONCILED** | Sổ cái `interior_payment_transactions` và milestones khớp 100% |
| **External Bank Reconciliation** | Bằng chứng ngân hàng | ⏳ **EVIDENCE REQUIRED** | Cần sao kê / UNC thực tế của ngân hàng ngoài đời thực |
| **Payment Recording (Happy Path)** | Pilot E2E | ✅ **PROVEN** | Trigger cập nhật milestone `paid` và tạo Finance Outbox event |
| **Customer Approval (Happy Path)** | Pilot E2E | ✅ **PROVEN** | Public approval token chuyển quotation `accepted` và sinh contract |
| **Contract Addendum (Happy Path)** | Pilot E2E | ✅ **PROVEN** | Approval tự động cập nhật contract value và rebalance schedule |
| **Negative & Resilience Hardening** | 8/8 kịch bản biên | ✅ **VERIFIED PASS** | Thực thi CSDL có kiểm soát + Automated regression (11/11 PASS) |
| **Migration Windows A–D** | Windows A–D | 🔒 **SEALED — UNCHANGED** | Bất biến, giữ nguyên 100% baseline, không mở lại |

---

## 2. Đối soát Tài chính: Phân biệt Ledger Truth và Bank Truth

> [!IMPORTANT]
> **Nguyên tắc Quản trị Tài chính:**
> Không tuyên bố đã xác minh **Bank Truth** chỉ dựa trên việc các bảng CSDL nội bộ đã khớp số liệu.
> Cần phân định rạch ròi giữa việc đối soát sổ cái hệ thống (Ledger Reconciliation) và việc đối soát với dòng tiền ngân hàng bên ngoài (External Bank Reconciliation).

### 2.1. Đẳng thức Kế toán Sổ cái (Ledger Reconciliation: RECONCILED)
Trên hợp đồng Villa Riverside Thảo Điền (`HD-NT-2026/08`, ID: `b2c11111-2222-3333-4444-555566667777`):

$$\text{Đã thu (Milestone 1 + 2)} + \text{Công nợ còn lại (Milestone 3, 4, 5)} = \text{Tổng giá trị hợp đồng}$$

$$405.000.000\text{ đ} + 270.000.000\text{ đ} + 675.000.000\text{ đ} = 1.350.000.000\text{ đ}$$

$$675.000.000\text{ đ} + 675.000.000\text{ đ} = 1.350.000.000\text{ đ} \quad \text{(100\% cân bằng)}$$

### 2.2. Bằng chứng Dữ liệu Sổ cái Lịch sử
Bảng `public.interior_payment_transactions` đã lưu trữ 2 bản ghi lịch sử phục vụ đối soát:

| Thuộc tính | Giao dịch Đợt 1 | Giao dịch Đợt 2 |
|---|---|---|
| **Transaction ID** | `f1111111-2222-3333-4444-555566667701` | `f1111111-2222-3333-4444-555566667702` |
| **Milestone ID** | `ca3fa5b3-e9da-4a32-83ca-954c1b4b3f18` | `3359370f-4299-4169-b193-b665da02fce5` |
| **Số tiền thực thu** | 405.000.000.00 đ | 270.000.000.00 đ |
| **Phương thức** | `bank_transfer` | `bank_transfer` |
| **Mã tham chiếu (Ref)** | `LEGACY-THD-2026-01` | `LEGACY-THD-2026-02` |
| **Ngày phát sinh (Tx Date)** | `2026-11-01` | `2026-11-05` |
| **Ngày nhập dữ liệu (`created_at`)** | `2026-11-06 15:11:15.368+00` | `2026-11-06 15:11:15.368+00` |
| **Người ghi nhận (`recorded_by`)** | `9077b10b-ee20-4058-907b-7a3e918b84c3` | `9077b10b-ee20-4058-907b-7a3e918b84c3` |
| **Ghi chú đối soát** | Xác nhận thu đủ tạm ứng đợt 1 HĐ | Xác nhận thu đủ đợt 2 sau duyệt bản vẽ R1.0 |

- `created_at` phản ánh thời điểm snapshot dữ liệu lịch sử (`2026-11-06`), phân biệt rõ với `transaction_date` phát sinh giao dịch (`2026-11-01` và `2026-11-05`).
- `recorded_by` phản ánh đúng tài khoản Quản trị viên/Owner vận hành hệ thống.

### 2.3. Trạng thái Đối soát Ngân hàng (External Bank Reconciliation)
- **Trạng thái:** **`EVIDENCE REQUIRED`** (Chờ chứng từ).
- **Yêu cầu đối soát tiếp theo:** Kế toán trưởng đối chiếu sao kê tài khoản ngân hàng thụ hưởng của Công ty Bella đối với 2 khoản thu 405M và 270M để đính kèm tệp UNC/sao kê điện tử vào trường `proof_url`.

---

## 3. Bằng chứng Kiểm chứng 3 Luồng Happy Path trên Controlled Pilot

Để bảo toàn tính toàn vẹn của hợp đồng thực tế Villa Thảo Điền (`HD-NT-2026/08`), toàn bộ 3 luồng giao dịch thật đã được thực thi trên Dự án Thử nghiệm có kiểm soát `INT-PILOT-COMMERCIAL`.

### 3.1. Thông tin Dự án Thử nghiệm
- **Project ID:** `77a22222-3333-4444-5555-666677778888`
- **Mã dự án:** `INT-PILOT-2026`
- **Tên dự án:** `Dự Án Pilot Kiểm Chứng Thương Mại (Commercial Pilot E2E)`
- **Khách hàng:** `Nguyễn Văn Pilot` — SĐT: `0909999888`
- **Quy chuẩn kỹ thuật:**
  - Bản vẽ kỹ thuật: `77a22222-3333-4444-5555-666677778889` (R1.0 approved)
  - BOQ đã niêm phong: `77a22222-3333-4444-5555-666677778890` (`BOQ-PILOT-01`, locked_for_contract)
  - BOQ Item: `77a22222-3333-4444-5555-666677778891` (Tủ sồi tự nhiên, 500M)

### 3.2. Bằng chứng Luồng 2: Customer Approval (Quotation → Contract) — ✅ PROVEN
1. **Báo giá Snapshot:**
   - Quotation ID: `77a22222-3333-4444-5555-666677778893` (`BG-PILOT-2026-01`)
   - Giá trị: 500.000.000 đ | Version: 1 | Trạng thái ban đầu: `sent_to_client`
2. **Yêu cầu phê duyệt khách hàng:**
   - Approval Request ID: `77a22222-3333-4444-5555-666677778895`
   - Approval Token: `77a22222-3333-4444-5555-666677778896`
   - Subject: `quotation` v1
3. **Thực thi RPC Phê duyệt:**
   - Lệnh gọi: `public.interior_transition_public_customer_approval(approval_id, token, 'approved', NULL, 'Đồng ý phương án báo giá')`
   - Kết quả thực thi: `true`
4. **Xác nhận CSDL:**
   - `interior_quotations.status` chuyển thành `'accepted'`
   - `interior_quotations.accepted_at`: `'2026-11-16 15:10:36.923641+00'`
   - `interior_quotations.latest_approval_status`: `'approved'`
   - Hợp đồng `HD-PILOT-2026/01` (ID: `77a22222-3333-4444-5555-666677778897`) khởi tạo với đầy đủ lineage hợp lệ.

### 3.3. Bằng chứng Luồng 1: Payment Recording — ✅ PROVEN
1. **Kỳ thanh toán mục tiêu:**
   - Milestone 1 ID: `77a22222-3333-4444-5555-666677778898`
   - Tên đợt: `Đợt 1: Tạm ứng ký HĐ (50%)`
   - Số tiền: 250.000.000.00 đ | Trạng thái trước giao dịch: `pending`, `collected_amount = 0.00`
2. **Giao dịch thanh toán:**
   - Transaction ID: `77a22222-3333-4444-5555-666677778800`
   - Mã tham chiếu (Ref): `UNC-PILOT-20261116-01`
   - Số tiền thực thu: 250.000.000.00 đ | Phương thức: `bank_transfer`
   - Ngày giao dịch: `2026-11-16` | Actor: `9077b10b-ee20-4058-907b-7a3e918b84c3` (Owner)
3. **Kích hoạt Trigger CSDL (`trg_reconcile_interior_payment_milestone_after_receipt`):**
   - `interior_payment_milestones.collected_amount`: Nâng lên `250000000.00`
   - `interior_payment_milestones.status`: Chuyển sang `'paid'`
   - `interior_payment_milestones.paid_at`: Gắn mốc thời gian `'2026-11-16 15:10:36.93828+00'`
4. **Sự kiện Finance Outbox:**
   - Event Type: `INTERIOR_PAYMENT_TRANSACTION_RECORDED`
   - Reference ID: `77a22222-3333-4444-5555-666677778800`
   - Payload:
     ```json
     {
       "amount": 250000000,
       "currency": "VND",
       "tenantId": "686884d2-6a4a-4581-ac8f-6ae69666b31d",
       "projectId": "77a22222-3333-4444-5555-666677778888",
       "contractId": "77a22222-3333-4444-5555-666677778897",
       "milestoneId": "77a22222-3333-4444-5555-666677778898",
       "paymentMethod": "bank_transfer",
       "referenceCode": "UNC-PILOT-20261116-01",
       "collectedAmount": 250000000,
       "milestoneStatus": "paid",
       "transactionDate": "2026-11-16"
     }
     ```
   - *Ghi chú quan trọng:* Giao dịch pilot này phát sinh một **Outbox Event** phục vụ tích hợp liên phân hệ nội bộ, **không** tự động tạo bút toán tài chính kế toán ngân hàng ngoài đời thực.

### 3.4. Bằng chứng Luồng 3: Contract Addendum — ✅ PROVEN
1. **Khởi tạo Phụ lục Hợp đồng:**
   - Addendum ID: `77a22222-3333-4444-5555-666677778801` (`PL01-HD-PILOT-2026`)
   - Giá trị gốc: 500.000.000.00 đ | Giá trị phát sinh (`value_delta`): `+50.000.000.00 đ`
   - Nội dung: "Bổ sung tủ rượu phòng khách âm tường cánh kính"
2. **Ràng buộc Bất biến (Immutability Enforcement):**
   - Đợt 1 (đã thu 250M): Được giữ nguyên chính xác 100% mọi trường (`percentage = 50.00`, `amount = 250000000.00`).
   - Đợt 2 (chưa thu): Đề xuất điều chỉnh số tiền từ 250.000.000 đ lên 300.000.000 đ.
3. **Thực thi Phê duyệt Phụ lục:**
   - Customer Approval ID: `77a22222-3333-4444-5555-666677778802`
   - Approval Token: `77a22222-3333-4444-5555-666677778803`
   - Kích hoạt qua RPC: `interior_transition_public_customer_approval` -> Kết quả: `true`
4. **Kích hoạt Trigger CSDL (`trg_advance_interior_addendum_after_customer_approval`):**
   - `interior_contract_addenda.status`: Chuyển sang `'approved'`, `approved_at = '2026-11-16 15:10:36.942131+00'`
   - `interior_contracts.current_contract_value`: Tăng từ 500M lên **550.000.000.00 đ**
   - `interior_payment_milestones` (Đợt 2): Tự động cập nhật số tiền thành **300.000.000.00 đ**
   - Tổng tiến độ các đợt ($250M + 300M = 550M$) cân bằng hoàn hảo với giá trị hợp đồng mới.

---

## 4. Bằng chứng Kiểm thử Độ bền & Kiểm thử Biên (Product Hardening — 100% VERIFIED)

Toàn bộ 8 kịch bản kiểm thử biên (Negative & Resilience) đã được thực thi kiểm chứng trực tiếp trên Postgres Database Engine (`lvnvkpyxtuilhrabtlwv`) với cơ chế dọn sạch dữ liệu (0 dirty state) và được mã hóa thành bộ kiểm thử tự động vĩnh viễn (`src/products/bella-interior/__tests__/commercial-hardening-resilience.test.ts` — **11/11 PASS**):

| TT | Kịch bản kiểm thử | Hành vi hệ thống đã xác minh | Bằng chứng thực thi Runtime (Postgres & Jest) | Trạng thái |
|---|---|---|---|---|
| **1** | **Duplicate payment request** | Chặn mã tham chiếu trùng trong hợp đồng (kể cả khác biệt hoa/thường) | PostgreSQL ném `SQLSTATE 23505` (`uq_interior_payment_tx_reference_normalized`). Jest suite xác nhận ném `DuplicatePaymentTransaction`. | ✅ **PROVEN PASS** |
| **2** | **Overpayment** | Chặn thanh toán vượt quá số dư còn lại của đợt thu | PostgreSQL ném `P0001: INTERIOR_PAYMENT_EXCEEDS_MILESTONE_BALANCE`. Jest suite xác nhận chặn overpayment. | ✅ **PROVEN PASS** |
| **3** | **Partial payment** | `collected_amount` phản ánh đúng số tiền thực nhận; giữ status `pending`/`invoiced` nếu chưa đủ đợt | Ghi nhận 100M trên mốc 300M -> `collected_amount = 100M`, `status = pending`. Ghi nhận 3 đợt lũy kế trong Jest -> chuyển `paid` chỉ khi đủ 100%. | ✅ **PROVEN PASS** |
| **4** | **Duplicate approval** | Replay approval token đã sử dụng không sinh thêm hợp đồng hay đổi trạng thái | RPC `interior_transition_public_customer_approval` trả về `false`. Jest suite ném `ApprovalImmutabilityError`. | ✅ **PROVEN PASS** |
| **5** | **Rejected approval** | Từ chối yêu cầu bắt buộc có lý do; quotation/contract không chuyển `accepted` | Thiếu lý do: ném `INTERIOR_APPROVAL_REJECTION_REASON_REQUIRED`. Có lý do: approval sang `rejected`, quotation giữ nguyên `rejected`, không kích hoạt sinh hợp đồng. | ✅ **PROVEN PASS** |
| **6** | **Cross-tenant access** | RLS và RPC chặn tuyệt đối, trả về `NULL / Error` khi truy cập tenant khác | Query với claims tenant khác trả về `0 rows / NULL`. Ghi nhận giao dịch ném `AuthorizationViolation: payment actor and tenant must match`. | ✅ **PROVEN PASS** |
| **7** | **Outbox retry** | Không sinh trùng lặp bản ghi Outbox (`ON CONFLICT DO NOTHING`) | Replay cùng sự kiện: trả về đúng `UUID` ban đầu, bảng outbox duy trì chính xác 1 bản ghi duy nhất (`uq_interior_finance_outbox_event`). | ✅ **PROVEN PASS** |
| **8** | **Addendum trên paid milestone** | Chặn cứng việc thay đổi điều khoản trên đợt thanh toán đã tất toán | CSDL ném `INTERIOR_ADDENDUM_CANNOT_CHANGE_INVOICED_OR_PAID_MILESTONE`. Sửa mốc chưa thu: thành công `pending_customer_approval`. | ✅ **PROVEN PASS** |

**Kết luận Product Hardening:** Giai đoạn Product Hardening đã hoàn tất 100% mục tiêu, không phát sinh bất kỳ migration mới nào và giữ nguyên hiện trạng Production.

---

## 5. Bằng chứng Playwright Browser UI Smoke Suite (Live Production)

Chạy kiểm thử trực tiếp trên môi trường Vercel Live Production:
- **Lệnh chạy:** `npx playwright test e2e/tests/48-interior-commercial-ui-smoke.spec.ts --project=chromium`
- **Kết quả:** **7/7 PASS (100%)** — Thời gian thực thi: **1.3 phút**
- **Không có bất kỳ lỗi:** JavaScript runtime, React hydration, HTTP 403, HTTP 500 hay HTTP 503.

```
[S1 PASS] Dashboard loaded. Interior links found: 22. Errors: 0 (11.4s)
[S2 PASS] /dashboard/interior loaded. URL: https://bella-spa-erp.vercel.app/dashboard/interior. Errors: 0 (6.6s)
[S3 PASS] Project Detail loaded: INT-THD-2026 Villa Riverside Thao Dien. Errors: 0 (9.1s)
[S4 PASS] Contracts page: HD-NT-2026/08 & BG-THD-2026-01 visible. Errors: 0 (7.1s)
[S5 PASS] 5 Milestones visible. 1.35B VND verified. Progress 50%. Errors: 0 (5.6s)
[S6 PASS] Addendum section visible. 0 errors, 0 addenda on baseline contract. (11.7s)
[S7 PASS] Permission boundary verified: unauthenticated challenged 307 to /login. (424ms)
```

---

## 6. Quyết định Quản trị & Đóng Workstream

1. **Chính thức đóng workstream:**  
   `Financial Reconciliation & Business-flow Happy-path Completion`.
2. **Bảo toàn dữ liệu Sản xuất:**  
   Giữ nguyên 2 giao dịch lịch sử và 3 luồng pilot đã ghi nhận trên Production; không chạy lại kịch bản nếu không có thay đổi mã nguồn.
3. **Khóa bất biến Migration Windows A–D:**  
   Tuyệt đối không mở lại Windows A–D và không tạo thêm migration mới khi chưa có nhu cầu nghiệp vụ được phê duyệt.
4. **Ranh giới giao dịch:**  
   Không phát sinh thêm giao dịch tài chính Production nếu không có nhu cầu kinh doanh thật từ khách hàng.
5. **Chuyển giao:**  
   Chuyển các kịch bản kiểm thử negative, concurrency và outbox retry sang giai đoạn **Product Hardening**.
6. **Lưu trữ baseline:**  
   Lưu hồ sơ Evidence Package này làm căn cứ nghiệm thu chính thức cho phân hệ **BELLA Interior Commercial**.
