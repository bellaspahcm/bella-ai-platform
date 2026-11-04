# Kế Hoạch Hoàn Thiện Toàn Diện Hồ Sơ 360° Học Sinh (Preschool Student 360 Full Completion)

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Hoàn thiện kết nối dữ liệu thật và giao diện chuẩn cho toàn bộ 8 tab trên trang Hồ sơ 360° Trẻ (`/dashboard/education/enrollments/[id]`), bảo đảm đồng nhất dữ liệu giữa Database, API Contracts và UI theo đúng Hiến pháp Kiến trúc Bella ERP.

**Architecture:** Áp dụng mô hình **Product → Contract → Kernel**. Sử dụng các bảng dữ liệu chuẩn của Bella Education (`edu_fin_invoices`, `edu_health_incidents`, `edu_child_allergies`, `edu_daily_care_records`, `edu_assessments`, `edu_dev_milestone_progress`) với Real Auth Session, phân quyền Tenant Isolation (Gate 0 / P0) và fail-closed error handling. Không tạo dữ liệu giả lập (no synthetic mockup), bảo toàn vùng đóng băng Healthcare H1–H12 và Logistics E7.1–E7.3.

**Tech Stack:** Next.js 14 (App Router), TypeScript 5.8 (Strict, Zero `any`), Supabase PostgreSQL, Lucide React, Jest + React Testing Library.

---

## Danh Mục Các Tab & Mục Tiêu Nghiệp Vụ

1. **Tab 1: Tổng Quan 360° (`overview`)** — Đã hoạt động ✅. Bổ sung liên kết nhanh đến trạng thái sức khỏe, công nợ học phí và điểm danh tháng.
2. **Tab 2: Sổ Liên Lạc & Nhật Ký (`communication`)** — Nối dữ liệu nhật ký sinh hoạt (`edu_daily_care_records`) và đơn gửi từ phụ huynh (`edu_comm_exceptions`).
3. **Tab 3: Điểm Danh & Đón Trả (`attendance`)** — Đã hoạt động ✅. Duy trì và đồng bộ thống kê thời gian thực.
4. **Tab 4: Đánh Giá Phát Triển (`grades`)** — Nối dữ liệu đánh giá định kỳ (`edu_assessments`) và mốc phát triển lứa tuổi (`edu_dev_milestone_progress`).
5. **Tab 5: Học Phí & Khoản Thu (`finance`)** — Cung cấp view tổng hợp tài chính đọc an toàn (`finance-summary`), hiển thị danh sách hóa đơn, công nợ và biên lai thực tế mà không vi phạm freeze của module ghi nợ kế toán.
6. **Tab 6: Cá Nhân & Người Giám Hộ (`guardians`)** — Đã hoạt động chuẩn G1 ✅. Bảo đảm liên kết phân quyền cơ sở (branch access) của quản trị viên.
7. **Tab 7: Sức Khỏe & Dinh Dưỡng (`health`)** — Nối tiền sử dị ứng (`edu_child_allergies`), đơn thuốc chỉ định (`edu_medication_authorizations`), sự cố y tế (`edu_health_incidents`) và thực đơn tuần (`edu_weekly_menus`).
8. **Tab 8: Lịch Sử Ghi Danh (`enrollments`)** — Đã hoạt động ✅. Duy trì danh mục lớp học.

---

## Phase 1: Chuẩn Bị & Đồng Bộ Dữ Liệu Hạt Nhân (Database Seed & Permissions)

### Task 1.1: Bổ sung dữ liệu vận hành mẫu cho học sinh đang kiểm tra (`EDU-2026-569808`)

**Files:**
- Modify: `scripts/seed-preschool-complete.mjs`
- Test: Chạy truy vấn xác nhận trong database

**Step 1: Mở rộng script seed**
Bổ sung đoạn chèn dữ liệu thực tế cho học sinh `EDU-2026-569808` (`student_id`: `1825098e-52f4-4e9b-ac11-521610c741c7`, `party_id`: `be938bc0-8815-41b8-8609-e2c05ede085d`):
- 1 dị ứng hải sản (`edu_child_allergies`)
- 1 đơn thuốc dặn dò (`edu_medication_authorizations`)
- 1 hóa đơn học phí Tháng 10/2026 (`edu_fin_invoices`)
- 2 mốc phát triển lứa tuổi 4 tuổi (`edu_dev_milestone_progress`)
- 1 nhật ký sinh hoạt ngày hôm nay (`edu_daily_care_records`)

**Step 2: Thực thi script seed**
Run: `node scripts/seed-preschool-complete.mjs`
Expected: Tất cả các bảng nghiệp vụ đều ghi nhận dữ liệu thật cho học sinh.

**Step 3: Kiểm chứng độc lập bằng database client**
Run: Truy vấn xác thực số lượng bản ghi > 0 trên từng bảng liên quan.

---

## Phase 2: Phân Hệ Sức Khỏe & Dinh Dưỡng (Tab 7 - Health & Nutrition)

### Task 2.1: Xây dựng API Route `/api/education/enrollments/[id]/health`

**Files:**
- Create: `src/app/api/education/enrollments/[id]/health/route.ts`
- Create: `src/app/api/education/enrollments/[id]/health/__tests__/route.test.ts`

**Step 1: Viết test failing (RED)**
Kiểm tra:
- Yêu cầu xác thực Admin (Real Auth token)
- Chặn identity headers giả mạo (`x-role`, `x-user-id`)
- Trả về danh sách `allergies`, `incidents`, `medications` của học sinh
- Trả về 400 nếu `id` không phải UUID hợp lệ
- Trả về 403 nếu role không phải Admin hoặc không có quyền cơ sở

**Step 2: Chạy test xác nhận FAIL**
Run: `npx jest "src/app/api/education/enrollments/[id]/health" --no-coverage`

**Step 3: Cài đặt API Route (GREEN)**
- Xác thực qua `CURRENT_ACTOR_PROFILE_RPC` + `reconcileCurrentActorProfile`
- Đọc dữ liệu từ `edu_child_allergies`, `edu_health_incidents`, `edu_medication_authorizations` có scope `tenant_id`
- Header phản hồi `Cache-Control: private, no-store`

**Step 4: Chạy test xác nhận PASS**
Run: `npx jest "src/app/api/education/enrollments/[id]/health" --no-coverage`

**Step 5: Commit**
`git add src/app/api/education/enrollments/[id]/health`
`git commit -m "feat(education): add authenticated student health api endpoint"`

---

### Task 2.2: Xây dựng Component `StudentHealth.tsx`

**Files:**
- Create: `src/app/dashboard/education/enrollments/[id]/StudentHealth.tsx`
- Create: `src/app/dashboard/education/enrollments/[id]/__tests__/StudentHealth.test.tsx`

**Step 1: Viết test component**
Kiểm tra:
- Trạng thái loading
- Trạng thái lỗi có nút "Thử lại"
- Trạng thái rỗng: "Chưa có dữ liệu đã xác minh trong hồ sơ này"
- Trạng thái có dữ liệu: Hiển thị đúng dị ứng, đơn thuốc, sự cố y tế

**Step 2: Cài đặt `StudentHealth.tsx`**
- Sử dụng UI chuẩn Bella Preschool (Tailwind CSS, hỗ trợ Dark Mode, Lucide icons: `Heart`, `ShieldAlert`, `Pill`, `Activity`)
- Gắn thẻ `role="tabpanel"` và `aria-labelledby="health-heading"`

**Step 3: Chạy test xác nhận PASS**
Run: `npx jest "src/app/dashboard/education/enrollments/[id]/__tests__/StudentHealth.test.tsx"`

---

## Phase 3: Phân Hệ Đánh Giá Phát Triển (Tab 4 - Developmental Assessments)

### Task 3.1: Xây dựng API Route `/api/education/enrollments/[id]/development`

**Files:**
- Create: `src/app/api/education/enrollments/[id]/development/route.ts`
- Create: `src/app/api/education/enrollments/[id]/development/__tests__/route.test.ts`

**Step 1: Viết test failing (RED)**
Kiểm tra:
- Xác thực Admin
- Chấp nhận `enrollment_id` hợp lệ
- Trả về `assessments` và `milestoneProgress`

**Step 2: Cài đặt Route (GREEN)**
- Truy vấn `edu_assessments` theo `student_id` hoặc `enrollment_id`
- Truy vấn `edu_dev_milestone_progress` kèm tên mốc và độ tuổi
- Trả về JSON chuẩn `{ success: true, studentId, assessments, milestoneProgress }`

**Step 3: Chạy test xác nhận PASS**
Run: `npx jest "src/app/api/education/enrollments/[id]/development" --no-coverage`

**Step 4: Commit**
`git add src/app/api/education/enrollments/[id]/development`
`git commit -m "feat(education): add authenticated student development api endpoint"`

---

### Task 3.2: Xây dựng Component `StudentDevelopment.tsx`

**Files:**
- Create: `src/app/dashboard/education/enrollments/[id]/StudentDevelopment.tsx`
- Create: `src/app/dashboard/education/enrollments/[id]/__tests__/StudentDevelopment.test.tsx`

**Step 1: Cài đặt Component**
- Giao diện 2 cột: Đánh giá định kỳ (bài đánh giá, điểm/kết quả, nhận xét) & Mốc phát triển (vận động, nhận thức, ngôn ngữ)
- Thẻ `role="tabpanel"` chuẩn accessibility

**Step 2: Chạy test xác nhận PASS**
Run: `npx jest "src/app/dashboard/education/enrollments/[id]/__tests__/StudentDevelopment.test.tsx"`

---

## Phase 4: Phân Hệ Học Phí & Sổ Liên Lạc (Tab 5 & Tab 2)

### Task 4.1: Xây dựng API Route `/api/education/enrollments/[id]/finance-summary`

**Files:**
- Create: `src/app/api/education/enrollments/[id]/finance-summary/route.ts`
- Create: `src/app/api/education/enrollments/[id]/finance-summary/__tests__/route.test.ts`

**Step 1: Cài đặt Endpoint đọc an toàn (Read-Only Finance View)**
- Không gọi lệnh tạo/thu tiền (giữ nguyên freeze của write finance)
- Tổng hợp từ `edu_fin_invoices`: Tổng phải thu (`totalDue`), Đã thanh toán (`totalPaid`), Còn phải nộp (`outstanding`), danh sách hóa đơn theo kỳ

**Step 2: Chạy test xác nhận PASS**
Run: `npx jest "src/app/api/education/enrollments/[id]/finance-summary" --no-coverage`

---

### Task 4.2: Xây dựng Component `StudentFinance.tsx`

**Files:**
- Create: `src/app/dashboard/education/enrollments/[id]/StudentFinance.tsx`
- Create: `src/app/dashboard/education/enrollments/[id]/__tests__/StudentFinance.test.tsx`

**Step 1: Cài đặt Component**
- Banner 3 thẻ KPI: Tổng Phải Thu, Đã Thanh Toán, Còn Nợ
- Bảng chi tiết hóa đơn: Số hóa đơn, Kỳ thu, Số tiền, Trạng thái (Đã nộp, Chờ thanh toán, Quá hạn)

**Step 2: Chạy test xác nhận PASS**
Run: `npx jest "src/app/dashboard/education/enrollments/[id]/__tests__/StudentFinance.test.tsx"`

---

### Task 4.3: Xây dựng Component `StudentCommunication.tsx` (Tab 2)

**Files:**
- Create: `src/app/dashboard/education/enrollments/[id]/StudentCommunication.tsx`
- Create: `src/app/api/education/enrollments/[id]/communications/route.ts`

**Step 1: Cài đặt Endpoint & Component**
- Hiển thị nhật ký chăm sóc trong ngày (Bữa ăn, giấc ngủ, uống nước, hoạt động) từ `edu_daily_care_records`
- Hiển thị danh sách dặn dò/yêu cầu từ phụ huynh từ `edu_comm_exceptions` (xin nghỉ học, đổi người đón, dặn uống thuốc)

**Step 2: Chạy test xác nhận PASS**
Run: `npx jest "src/app/dashboard/education/enrollments/[id]/__tests__/StudentCommunication.test.tsx"`

---

## Phase 5: Tích Hợp Vào `Student360LegacyLayout.tsx` & Kiểm Thử Tổng Thể

### Task 5.1: Cập nhật `Student360LegacyLayout.tsx`

**Files:**
- Modify: `src/app/dashboard/education/enrollments/[id]/Student360LegacyLayout.tsx`
- Modify: `src/app/dashboard/education/enrollments/[id]/__tests__/page.test.tsx`

**Step 1: Kết nối các component mới vào tab view**
- Tab `health` -> `<StudentHealth />`
- Tab `grades` -> `<StudentDevelopment />`
- Tab `finance` -> `<StudentFinance />`
- Tab `communication` -> `<StudentCommunication />`

**Step 2: Cập nhật regression test trong `page.test.tsx`**
- Mock các sub-component mới tương tự như cách mock `StudentGuardians`
- Xác nhận trang load mượt mà, chuyển tab tức thì

**Step 3: Chạy toàn bộ các cổng kiểm tra bắt buộc (Mandatory Gates)**
1. `npm run healthcare:guard` -> Xác nhận 0 vi phạm H1–H12.
2. `npm run logistics:verify` -> Xác nhận 15 suites, 547/547 tests PASS.
3. `npx jest src/app/api/education/enrollments` -> Xác nhận toàn bộ API routes PASS.
4. `npx jest src/app/dashboard/education/enrollments` -> Xác nhận toàn bộ UI pages PASS.
5. `npm run type-check` -> Xác nhận 0 lỗi TypeScript strict.

**Step 4: Commit & Push**
- Commit với message: `feat(education): complete real data connection for all student 360 tabs`
- Push nhánh `feat/preschool-dashboard-realtime-sync`.

