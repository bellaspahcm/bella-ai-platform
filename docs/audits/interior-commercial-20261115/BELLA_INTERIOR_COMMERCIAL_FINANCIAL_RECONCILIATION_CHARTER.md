# BELLA Interior Commercial — Financial Reconciliation Charter & Business-flow Completion Plan
**Trạng thái hệ thống:** `PRODUCTION FULLY VERIFIED & E2E PROVEN`  
**Ngày hoàn tất:** 16/11/2026  
**Môi trường:** Live Production (`https://bella-spa-erp.vercel.app`)  
**Cơ sở dữ liệu:** Supabase Production `lvnvkpyxtuilhrabtlwv` (`ap-southeast-1`)  
**Workstream:** `Bella Interior Commercial — Production Business-flow Completion & Financial Reconciliation`

---

## 1. Tuyên bố Trạng thái Sản xuất (Production Scope Baseline)

Toàn bộ các tiêu chí kỹ thuật, an toàn dữ liệu và chu trình nghiệp vụ thương mại của **BELLA Interior Commercial** đã hoàn tất kiểm chứng và đạt trạng thái chuẩn xác nhất:

| Phân hệ / Tiêu chí | Trạng thái | Ghi chú bằng chứng |
|---|---|---|
| **Database & Security** | ✅ **VERIFIED** | RLS, Triggers, Security Definer, Isolation vượt qua 20/20 checks |
| **Authenticated API** | ✅ **VERIFIED** | Lifecycle context, project isolation, read contracts hoạt động chuẩn xác |
| **Lifecycle RPC** | ✅ **PROVEN** | Quá trình chuyển đổi trạng thái và ràng buộc bất biến đã được chứng minh |
| **Browser UI Smoke E2E** | ✅ **VERIFIED PASS (7/7)** | Playwright suite chạy trên Live Production đạt 100% không lỗi JS/API |
| **Full Business-flow E2E** | ✅ **PROVEN (3/3)** | 3 luồng giao dịch thật (Payment, Approval, Addendum) đã được chứng minh 100% |
| **Financial Reconciliation** | ✅ **CLOSED (RECONCILED)** | Milestone 1, 2 đã được đối soát vào sổ cái, `collected_amount = amount` chuẩn 100% |
| **Migration Windows A–D** | 🔒 **SEALED** | Bất biến, giữ nguyên baseline, toàn vẹn 100% |

---

## 2. Kết quả Đối soát Tài chính: Milestone 1 & Milestone 2 (CLOSED)

### 2.1. Hiện trạng dữ liệu sau đối soát
Dữ liệu trên bảng `public.interior_payment_milestones` đối với Hợp đồng số `HD-NT-2026/08` (ID: `b2c11111-2222-3333-4444-555566667777`) của dự án `INT-THD-2026` đã đạt tính nhất quán kế toán tuyệt đối:

| Đợt | ID | Giá trị (VND) | Đã thu (`collected_amount`) | Trạng thái (`status`) | Ngày ghi nhận (`paid_at`) |
|---|---|---|---|---|---|
| **Đợt 1** | `ca3fa5b3-e9da-4a32-83ca-954c1b4b3f18` | 405.000.000 đ (30%) | **405.000.000.00 đ** | `paid` | `2026-11-06 15:11:15.368+00` |
| **Đợt 2** | `3359370f-4299-4169-b193-b665da02fce5` | 270.000.000 đ (20%) | **270.000.000.00 đ** | `paid` | `2026-11-06 15:11:15.368+00` |
| **Đợt 3** | `fcb63668-2e17-42c3-80b5-0941243681da` | 405.000.000 đ (30%) | 0.00 đ | `pending` | `NULL` |
| **Đợt 4** | `0c223d01-6179-4966-877c-108ecf77ed9c` | 202.500.000 đ (15%) | 0.00 đ | `pending` | `NULL` |
| **Đợt 5** | `091890eb-6c12-45a4-b4cb-a28116454b69` | 67.500.000 đ (5%) | 0.00 đ | `pending` | `NULL` |

### 2.2. Chứng từ trong Sổ cái Giao dịch (`interior_payment_transactions`)
Đã bổ sung 2 bản ghi lịch sử vào sổ cái theo đúng phê duyệt Phương án A:
1. `f1111111-2222-3333-4444-555566667701`:
   - *Reference Code:* `LEGACY-THD-2026-01`
   - *Milestone:* Đợt 1 (405.000.000 đ)
   - *Method:* `bank_transfer`
   - *Transaction Date:* `2026-11-01`
   - *Recorded By:* `9077b10b-ee20-4058-907b-7a3e918b84c3` (`demo.interior@bellaspa.vn` - Owner)
   - *Notes:* "Xác nhận thu đủ 405.000.000 đ tạm ứng đợt 1 ký hợp đồng (Đối soát dữ liệu lịch sử)"
2. `f1111111-2222-3333-4444-555566667702`:
   - *Reference Code:* `LEGACY-THD-2026-02`
   - *Milestone:* Đợt 2 (270.000.000 đ)
   - *Method:* `bank_transfer`
   - *Transaction Date:* `2026-11-05`
   - *Recorded By:* `9077b10b-ee20-4058-907b-7a3e918b84c3` (`demo.interior@bellaspa.vn` - Owner)
   - *Notes:* "Xác nhận thu đủ 270.000.000 đ đợt 2 sau khi ký duyệt bản vẽ sản xuất R1.0 (Đối soát dữ liệu lịch sử)"

**Kết luận đối soát:** Tổng thực thu hợp đồng `HD-NT-2026/08` đạt **675.000.000 đ** (50%), số dư công nợ còn lại chính xác là **675.000.000 đ** (50%). Thời điểm ghi nhận lịch sử `paid_at = 2026-11-06` được bảo toàn nguyên vẹn.

---

## 3. Source Mapping cho 3 Migrations có `name = null` (100% COMPLETE)

3 phiên bản migration có trường `name = null` trên bảng `supabase_migrations.schema_migrations` đã được đối chiếu nguồn gốc mã nguồn Git:

| Phiên bản DB | Tên File Migration trong Git | Nội dung chức năng | Trạng thái nguồn |
|---|---|---|---|
| `20261114110000` | `20261114110000_interior_handover_requires_customer_evidence.sql` | Ràng buộc biên bản bàn giao phải có chữ ký/bằng chứng khách hàng | ✅ Mapped 100% |
| `20261114120000` | `20261114120000_interior_customer_evidenced_handover.sql` | Triển khai RPC xác thực nghiệm thu bàn giao từ khách hàng | ✅ Mapped 100% |
| `20261114120100` | `20261114120100_interior_customer_approval_addendum_subject.sql` | Mở rộng enum đối tượng phê duyệt khách hàng cho Phụ lục Hợp đồng | ✅ Mapped 100% |

Không có bất kỳ migration mồ côi hay trôi dạt mã nguồn nào.

---

## 4. Kết quả Kiểm chứng 3 Luồng Nghiệp vụ Giao dịch Thật (PROVEN)

Thực hiện kiểm chứng trọn vẹn trên Dự án Thử nghiệm có kiểm soát `INT-PILOT-COMMERCIAL` (`77a22222-3333-4444-5555-666677778888`) thuộc Tenant `686884d2-6a4a-4581-ac8f-6ae69666b31d`:

### Luồng 1: Ghi nhận Thanh toán (Payment Recording) — ✅ PROVEN
1. **Thực thi:**
   - Milestone 1 (`77a22222-3333-4444-5555-666677778898`): Giá trị 250.000.000 đ, ban đầu `status = pending`, `collected_amount = 0.00`.
   - Ghi nhận thanh toán: 250.000.000 đ, `bank_transfer`, `reference_code = 'UNC-PILOT-20261116-01'`, ngày `2026-11-16`, actor `demo.interior@bellaspa.vn` (Owner).
2. **Bằng chứng CSDL:**
   - `public.interior_payment_transactions` lưu bản ghi `77a22222-3333-4444-5555-666677778800`.
   - Trigger `trg_reconcile_interior_payment_milestone_after_receipt` tự động nâng `collected_amount = 250000000.00` và chuyển `status = 'paid'`, `paid_at = '2026-11-16 15:10:36.93828+00'`.
   - Bảng `public.interior_finance_outbox` phát sinh sự kiện `INTERIOR_PAYMENT_TRANSACTION_RECORDED` với đầy đủ payload tài chính.

### Luồng 2: Phê duyệt Khách hàng (Customer Approval) — ✅ PROVEN
1. **Thực thi:**
   - Tạo báo giá `BG-PILOT-2026-01` (`77a22222-3333-4444-5555-666677778893`), giá trị 500.000.000 đ, trạng thái ban đầu `sent_to_client`.
   - Tạo yêu cầu phê duyệt khách hàng `77a22222-3333-4444-5555-666677778895` với token bảo mật.
   - Khách hàng ký duyệt qua RPC công khai: `public.interior_transition_public_customer_approval(..., 'approved')`.
2. **Bằng chứng CSDL:**
   - `public.interior_quotations` tự động chuyển `status = 'accepted'`, ghi nhận `accepted_at = '2026-11-16 15:10:36.923641+00'`, `latest_approval_status = 'approved'`.
   - Hợp đồng `HD-PILOT-2026/01` được khởi tạo chuẩn xác với liên kết dòng dõi (lineage) đầy đủ từ Báo giá và BOQ đã khóa.

### Luồng 3: Phụ lục Hợp đồng (Contract Addendum) — ✅ PROVEN
1. **Thực thi:**
   - Tạo phụ lục `PL01-HD-PILOT-2026` (`77a22222-3333-4444-5555-666677778801`) với `value_delta = +50.000.000 đ` (bổ sung tủ rượu phòng khách).
   - Tiến độ thanh toán đề xuất điều chỉnh: Giữ nguyên Đợt 1 đã thanh toán (bất biến), điều chỉnh Đợt 2 từ 250.000.000 đ lên 300.000.000 đ.
   - Tạo yêu cầu phê duyệt phụ lục và khách hàng xác nhận duyệt qua RPC `public.interior_transition_public_customer_approval`.
2. **Bằng chứng CSDL:**
   - `public.interior_contract_addenda.status` tự động chuyển sang `'approved'`.
   - `public.interior_contracts.current_contract_value` tự động tăng từ 500.000.000 đ lên **550.000.000.00 đ**.
   - `public.interior_payment_milestones` (Đợt 2) tự động cập nhật số tiền từ 250.000.000 đ lên **300.000.000.00 đ**.
   - Tổng tiến độ các đợt (250M + 300M = 550M) khớp 100% với giá trị hợp đồng sau phụ lục.

---

## 5. Kết luận Tổng thể

1. **BELLA Interior Commercial** đã hoàn tất trọn vẹn toàn bộ các mục tiêu đặt ra:
   - Đối soát tài chính: **HOÀN THÀNH (100% nhất quán)**.
   - 3 Luồng nghiệp vụ còn thiếu: **ĐÃ CHỨNG MINH THÀNH CÔNG TRÊN LIVE PRODUCTION**.
   - Giao diện Browser UI Smoke (Playwright): **7/7 PASS (100%)** trên môi trường Vercel Live Production.
   - Các Migration Windows A–D: **SEALED — BẤT BIẾN**.
2. Toàn bộ hồ sơ kiểm chứng, dữ liệu đối soát và mã nguồn đều đã được lưu vết minh bạch, sẵn sàng cho nghiệm thu sản phẩm.
