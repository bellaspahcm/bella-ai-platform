# BELLA INTERIOR CRM & CUSTOMER SUCCESS — GIAI ĐOẠN B: CUSTOMER DOMAIN FOUNDATION

> **Trạng thái thực thi:** `PASS — IN-MEMORY IMPLEMENTATION & VALIDATION`  
> **Cơ sở dữ liệu Production:** `STRICTLY READ-ONLY (ZERO MUTATION)`  
> **Phát hành O4:** `STANDBY ON HOLD (Chờ quyết định release độc lập)`  
> **Bộ kiểm thử phân hệ CRM:** `17/17 TESTS PASSED (0.75s)`  
> **Kiểm thử hồi quy toàn Bella Interior:** `58/58 SUITES, 661/661 TESTS PASSED`  
> **Kiểm tra TypeScript:** `0 ERRORS (Exit code 0)`  
> **Ngày lập báo cáo:** 19/11/2026  

---

## 1. TỔNG QUAN THỰC THI GIAI ĐOẠN B

Theo phê duyệt của Ban Kiến trúc tại phiên làm việc trước (`APPROVED WITH ARCHITECTURAL REFINEMENTS`), Giai đoạn B đã được triển khai tập trung hoàn toàn vào **Customer Domain Foundation** theo nguyên tắc **Domain-First / Pure Logic**:
1. **Không can thiệp cơ sở dữ liệu:** Chưa tạo bất kỳ file migration DDL nào, tuyệt đối không gửi lệnh ghi/sửa tới Supabase Production (`lvnvkpyxtuilhrabtlwv`).
2. **Không chạm mã nguồn O1–O4:** Không thay đổi bất kỳ file triển khai nào của các đợt bàn giao trước.
3. **Không chỉnh sửa UI/API hiện hữu:** Màn hình `/dashboard/interior/customers` và các API tổng hợp dự án giữ nguyên hiện trạng.
4. **Xây dựng thực thể độc lập:** Khách hàng (Customer) đã được giải phóng khỏi sự phụ thuộc vào hồ sơ công trình (`interior_projects.customer_id`), trở thành một thực thể Domain hoàn chỉnh với hồ sơ, danh bạ liên hệ đa vai trò, đa địa chỉ, cơ chế hợp nhất và phòng vệ tài chính.

---

## 2. HIỆU CHỈNH KIẾN TRÚC THEO 6 NGUYÊN TẮC CỐT LÕI

| # | Điểm hiệu chỉnh kiến trúc | Hiện trạng thiết kế & Triển khai thực tế tại Giai đoạn B | Bằng chứng kiểm thử |
|---|---------------------------|----------------------------------------------------------|---------------------|
| **1** | **Customer Lifecycle** | Tách bạch hoàn toàn `CustomerProfileStatus` (`active`, `inactive`, `merged`) khỏi vòng đời thương mại/thi công (`prospect`, `active_project`, `warranty`). Hồ sơ khách hàng không bao giờ bị đổi trạng thái chỉ vì một công trình kết thúc. | Test #1, #6, #16 |
| **2** | **Bảo vệ dữ liệu tài chính** | Số liệu tài chính (`totalContractValue`, `totalPaidAmount`, `receivableDebt`) là **Read-Only Dynamic Projections** tổng hợp từ Commercial Contract và Finance Payment. Chặn đứng bằng lỗi `DirectFinancialMutationError` nếu bất kỳ ai cố tình gửi ghi/sửa trường này qua CRM. | Test #7 |
| **3** | **Số điện thoại không độc quyền** | Không coi số điện thoại là Unique Identifier tuyệt đối. Hai khách hàng (vợ/chồng, sếp/trợ lý, đại diện công ty) có cùng số điện thoại vẫn được tạo và tồn tại độc lập, không bao giờ bị hệ thống tự động gộp. | Test #2 |
| **4** | **Phát hiện trùng lặp theo trọng số** | Triển khai thuật toán chấm điểm đa tiêu chí: Mã số thuế trùng (+100 điểm), SĐT trùng (+40 điểm), Email trùng (+30 điểm), Tên tương đồng (+40 điểm, có chuẩn hóa từ viết tắt doanh nghiệp VN như `cty`, `cp`, `tnhh`, `jsc`). Ngưỡng cảnh báo gộp là $\ge 80$ điểm. SĐT đơn lẻ chỉ được 40 điểm nên không bao giờ kích hoạt cảnh báo gộp. | Test #2, #17 |
| **5** | **Tính toàn vẹn khi gộp khách hàng** | Quy trình Merge thực hiện nguyên tử: Kiểm tra chéo tenant, phát hiện chu kỳ ($A \rightarrow B \rightarrow A$), chặn gộp chính mình, chặn gộp bản ghi đã merge, tự động chuyển giao danh bạ & địa chỉ, đánh dấu `profileStatus = 'merged'`, lưu bảng tra cứu Alias vĩnh viễn và ghi log kiểm toán. Có cơ chế rollback trạng thái nếu ghi log thất bại. | Test #10, #11, #12, #13, #14, #15 |
| **6** | **Cô lập Tenant tuyệt đối** | Tất cả các phương thức của Repository và Service đều yêu cầu `tenantId`. Mọi thao tác truy vấn rỗng tenant đều ném `TenantIsolationViolationError`. Khách hàng cùng mã nhưng khác tenant được lưu trữ độc lập hoàn toàn. | Test #3, #4 |

---

## 3. DANH MỤC CÁC CẤU HÌNH VÀ FILE NGUỒN ĐÃ TẠO

Toàn bộ mã nguồn Domain được đóng gói tách bạch trong thư mục riêng của Bella Interior:

1. **Domain Types & Contracts:**
   - File: `src/products/bella-interior/domain/crm/customer.types.ts`
   - Chứa: `CustomerProfile`, `CustomerProfileStatus`, `CustomerContact`, `CustomerAddress`, `CustomerAlias`, `CustomerMergeLog`, `DuplicateCandidate`, `CustomerFinancialProjection`, `CreateCustomerInput`, `UpdateCustomerInput`.
2. **Domain Errors:**
   - File: `src/products/bella-interior/domain/crm/customer-errors.ts`
   - Chứa: `TenantIsolationViolationError`, `CustomerNotFoundError`, `DuplicateCustomerCodeError`, `CustomerAlreadyMergedError`, `CustomerMergeSelfError`, `CustomerMergeCycleDetectedError`, `CustomerMergeCrossTenantError`, `DirectFinancialMutationError`, `InvalidCustomerDataError`.
3. **Repository Interface:**
   - File: `src/products/bella-interior/repositories/crm/customer-repository.interface.ts`
   - Giao diện chuẩn `ICustomerRepository` phục vụ cả In-Memory và tương lai cho Supabase.
4. **Validation Service:**
   - File: `src/products/bella-interior/services/crm/customer-validation.service.ts`
   - Kiểm tra định dạng số điện thoại, email, MST, cấm sửa trạng thái thành `merged` qua update thường, cấm can thiệp tài chính.
5. **Duplicate Detection Service:**
   - File: `src/products/bella-interior/services/crm/customer-duplicate-detection.service.ts`
   - Thuật toán Dice/Jaccard kết hợp từ điển mở rộng viết tắt Việt Nam và bộ trọng số phân cấp.
6. **In-Memory Repository:**
   - File: `src/products/bella-interior/repositories/crm/in-memory-customer.repository.ts`
   - Quản trị cấu trúc dữ liệu Map đa tenant, sinh mã tự động `KH-XXXXXX`, quản lý quan hệ con và chuỗi phân giải Alias.
7. **Merge Service:**
   - File: `src/products/bella-interior/services/crm/customer-merge.service.ts`
   - Điều phối toàn bộ quy trình gộp an toàn và khôi phục khi có lỗi.
8. **Acceptance Test Suite:**
   - File: `src/products/bella-interior/__tests__/crm-customer-domain.test.ts`
   - Bao phủ 17 kịch bản kiểm thử chi tiết.

---

## 4. CHI TIẾT 17 KỊCH BẢN KIỂM THỬ ĐÃ ĐƯỢC XÁC MINH

```
PASS src/products/bella-interior/__tests__/crm-customer-domain.test.ts
  Bella Interior CRM — Customer Domain Foundation (Phase B)
    √ 1. Tạo Customer mới thành công với mã tự sinh và trạng thái active (3 ms)
    √ 2. Hai Customer cùng số điện thoại: Không tự động gộp, tồn tại độc lập (11 ms)
    √ 3. Hai tenant có cùng Customer code: Hoàn toàn độc lập
    √ 4. Truy vấn chéo tenant: Bị từ chối và cô lập hoàn toàn (13 ms)
    √ 5. Cập nhật Customer không tồn tại: Báo lỗi CustomerNotFoundError, không tạo ngầm (2 ms)
    √ 6. Cập nhật hồ sơ: Bảo toàn createdAt, cập nhật updatedAt (10 ms)
    √ 7. Financial fields: Chặn đứng mọi hành vi CRM tự ghi/sửa dữ liệu tài chính (3 ms)
    √ 8. Customer có nhiều Contacts: Hỗ trợ nhiều vai trò và quản lý primary contact (1 ms)
    √ 9. Customer có nhiều Addresses: Quản lý địa chỉ trụ sở và công trường (1 ms)
    √ 10. Merge hai Customer cùng tenant: Chuyển giao quan hệ, ghi log và lưu alias (3 ms)
    √ 11. Merge Customer khác tenant: REJECTED với CustomerMergeCrossTenantError (2 ms)
    √ 12. Merge Customer đã merged: REJECTED với CustomerAlreadyMergedError
    √ 13. Merge vào chính mình: REJECTED với CustomerMergeSelfError (1 ms)
    √ 14. Merge tạo chu kỳ alias: REJECTED với CustomerMergeCycleDetectedError (1 ms)
    √ 15. Merge thất bại giữa chừng: Không để lại trạng thái nửa hoàn thành (1 ms)
    √ 16. Chống sửa profileStatus thành merged qua update thông thường
    √ 17. Thuật toán phát hiện trùng lặp: Phân định rạch ròi điểm số (2 ms)
```

---

## 5. BẰNG CHỨNG HỒI QUY VÀ CHẤT LƯỢNG MÃ NGUỒN

1. **Kiểm tra TypeScript (`npx tsc --noEmit`):**
   - Kết quả: `Exit code 0` — Hoàn toàn sạch kiểu dữ liệu, không có lỗi lỏng lẻo (`no any` được tuân thủ).
2. **Kiểm thử hồi quy nội bộ Bella Interior:**
   - Lệnh thực thi: `npm run test -- src/products/bella-interior/__tests__/`
   - Kết quả: **58 Test Suites PASS, 661 Tests PASS**, thời gian thực thi ~6.1 giây.
   - Các phân hệ trước (O1 Khảo sát thiết kế & BOQ, O2 Sản xuất mộc, O3 Vận chuyển & Lắp đặt, O4 Nghiệm thu bàn giao) hoạt động ổn định 100%, không bị ảnh hưởng.
3. **Môi trường Database Production (`lvnvkpyxtuilhrabtlwv`):**
   - Giữ nguyên trạng thái `STRICTLY READ-ONLY`.
   - Số lượng migration thực tế đã áp dụng: 0.

---

## 6. ĐỀ XUẤT KẾ HOẠCH BƯỚC TIẾP THEO: GIAI ĐOẠN C (CUSTOMER PERSISTENCE)

Sau khi Customer Domain Foundation đã được chứng minh hoàn thiện trên mô hình In-Memory, bước tiếp theo được đề xuất là chuẩn bị cho **Giai đoạn C (Customer Persistence)** theo chiến lược không gián đoạn (Zero-Downtime):

1. **Thiết kế Additive Migration DDL (Chưa chạy trên DB thật):**
   - `interior_customers` (Hồ sơ khách hàng, `tenant_id`, `code`, `name`, `tax_code`, `profile_status`, `merged_into_id`).
   - `interior_customer_contacts` (Danh bạ đa vai trò).
   - `interior_customer_addresses` (Địa chỉ trụ sở/công trường).
   - `interior_customer_aliases` (Bảng tra cứu ID cũ sau khi gộp).
   - `interior_customer_merge_logs` (Nhật ký kiểm toán sáp nhập).
2. **Cầu nối dữ liệu không gián đoạn (Expand Phase):**
   - Thêm cột nullable `customer_profile_id UUID` vào bảng `interior_projects`.
   - Giữ nguyên trường `customer_id TEXT` cũ để các màn hình hiện tại không bị đứt gãy.
3. **Supabase Customer Repository:**
   - Triển khai `SupabaseCustomerRepository` tương thích với interface `ICustomerRepository`, bọc chính sách RLS `tenant_id = public.interior_actor_tenant()`.

---

> [!IMPORTANT]
> **Cam kết:** Toàn bộ mã nguồn và cấu trúc DDL của Giai đoạn C sẽ chỉ được soạn thảo và kiểm thử mô phỏng. Sẽ **KHÔNG** áp dụng lệnh DDL lên Supabase Production khi chưa có phê duyệt chính thức từ người dùng.
