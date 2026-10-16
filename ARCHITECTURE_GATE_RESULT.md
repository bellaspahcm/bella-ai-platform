# ARCHITECTURE GATE RESULT — PRE SCHOOL CLASSROOM OPERATIONS & CAPACITY WORKSPACE REDESIGN (IMAGE 1 & 2 TO IMAGE 3)

> **Status:** PASS  
> **Date:** 2026-10-16  
> **Scope:** Redesign Classroom Operations & Capacity Management UI (`src/app/dashboard/education/courses/page.tsx`) from the cluttered layout (Image 1 & 2) to the streamlined, high-hierarchy visual layout (Image 3) exclusively for Preschool tenants (`bella_education`).  
> **Strict Type Invariant:** ZERO use of `any` and `unknown` in all code and handlers.

---

## 1. Bella OS/Product Development Process Gate

- **Truth:**
  - Preschool classroom management requires clear visual hierarchy: single unified primary color (`#075548`), reduced container nesting, compact card height, removal of noisy technical contract badges from end-user view, 4 lightweight neutral KPI stats, 2-tier search and grade filter bar, student avatar stacks, clear health alerts distinction, and direct classroom actions ("Vào lớp học →", "Điểm danh").
  - Non-preschool tenants visiting `/dashboard/education/courses` must retain the standard courses view without breaking changes or visual regression.
- **Source of Truth:**
  - Image 3 reference screenshot and user UX/UI evaluation specification.
  - Preschool Vertical Manifest (`src/products/bella-education/manifest.ts`).
  - Tenant Brand Identity (`src/lib/business-rules/tenant-modules.ts` -> `brand.moduleKey === 'bella_education'`).
  - Education OS Constitution (`docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md`).
- **Canonical Contract:**
  - API: `/api/education/courses` (GET classrooms summary, POST create new classroom).
  - Public Contracts: `TeacherAssignmentContractImpl` & Course canonical tables (`edu_courses`, `courses`).
- **Gate Result:** `PASS`
  - All modifications are strictly scoped to the presentation and client interaction layer in `src/app/dashboard/education/courses/page.tsx`.
  - Kernel H1–H12 (Healthcare), Kernel E7.1–E7.3 (Logistics), and Education Kernel (`src/platform/education/`) remain 100% frozen.
  - Zero database schema modifications (no migrations required).

---

## 2. Product Manifest (Capabilities & Scope)

- **Target Vertical:** Bella Education (Preschool Vertical — `bella_education`).
- **Target Page:** `src/app/dashboard/education/courses/page.tsx`
- **Capabilities in Scope:**
  1. **Clean Header:**
     - Simplified page title: "Quản lý lớp học".
     - Subtitle: "Theo dõi sĩ số, sức chứa và tình trạng điểm danh theo lớp".
     - Subdued category pill: "Preschool ERP Operations" (removed technical "P3.2 Verified Contracts" badge).
     - Academic year switcher ("Năm học 2025 - 2026" / "Năm học 2026 - 2027").
     - Single primary action: "+ Mở Lớp Học Mới" in unified brand green (`#075548`).
     - Overflow actions menu (three dots button next to create button).
  2. **4 Compact Neutral KPI Stat Cards:**
     - Tổng số lớp (4 lớp) with green icon.
     - Tổng học sinh (86 bé) with blue icon.
     - Chỗ trống còn lại (7 chỗ) with orange icon.
     - Tỷ lệ lấp đầy (92%) with purple icon and mini progress bar.
  3. **Two-Tier Search & Filter Bar:**
     - Row 1: Search input ("Tìm tên lớp, giáo viên, phòng học..."), Grade selector ("Tất cả khối"), Status selector ("Tất cả trạng thái"), and filter settings button.
     - Row 2: Grade pill tabs with dynamic counts: "Tất cả lớp (4)", "Nhà Trẻ (1)", "Khối Mầm (1)", "Khối Chồi (1)", "Khối Lá (1)".
  4. **Refined Classroom Cards (Grid):**
     - Class mascot icon/illustration (Họa Mi, Thỏ Ngọc, Vàng Anh, Gấu Misa).
     - Grade & capacity threshold badges ("Còn 3 chỗ", "Gần đầy (Còn 1 chỗ)", "Đã đầy").
     - Teacher row with avatar & room info.
     - Single clean capacity progress bar.
     - Flat "Điểm danh hôm nay" section (Có mặt, Có phép, Chưa báo, Cảnh báo SK) without heavy nested container boxes.
     - Health alert badge ("♥ 1 lưu ý sức khỏe") placed as an operational annotation, clarifying it is not an attendance subset conflict.
     - Student roster avatar stack (6 student photos + count badge like `+18`).
     - Primary button "Điểm danh" in brand green (`#075548`) and secondary action "Vào lớp học →".
  5. **Tenant Scoping Guard:**
     - Detect `isPreschoolTenant` via `getCachedTenantSettings()` and `resolveTenantBrandIdentity()`.
     - Non-preschool tenants retain the existing general layout; preschool tenants receive the Image 3 layout.
  6. **Strict Typing Guard:**
     - Zero `any` or `unknown`.

---

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Data / Component | Owner | Boundary & Scope |
|---|---|---|
| Classroom UI (`courses/page.tsx`) | Preschool Product UI (`src/app/dashboard/education/courses/`) | Redesign to match Image 3 for preschool |
| Classroom API (`api/education/courses`) | Education Module API | Unaltered contract; consumed by client |
| Course & Enrollment Aggregates | Education OS Kernel | Frozen contract; consumed via API |
| Tenant Settings & Brand Theme | Core Platform Context | Read-only access via `getCachedTenantSettings` |
| Healthcare OS & Logistics OS | Respective Kernels | 100% Frozen & untouched |

---

## 4. Contract Dependency Map

```text
Preschool Classroom Page (src/app/dashboard/education/courses/page.tsx)
   │
   ├─► Client Context: getCachedTenantSettings() ──► resolveTenantBrandIdentity()
   │     └─► isPreschool: boolean (moduleKey === 'bella_education')
   │
   ├─► API Route: GET /api/education/courses
   │     └─► edu_courses, courses, edu_enrollments, preschool_classrooms
   │
   └─► API Route: POST /api/education/courses
         └─► TeacherAssignmentContractImpl -> create classroom
```

---

## 5. Change Authority

- **Authorized to Modify:**
  - `src/app/dashboard/education/courses/page.tsx`
  - `ARCHITECTURE_GATE_RESULT.md`
- **Strictly Prohibited:**
  - Modifying files in `src/platform/**` (Kernel freeze lock).
  - Modifying database schemas, tables, or running database migrations.
  - Adding `any` or `unknown` types.
  - Modifying non-preschool views.

---

## 6. UI -> Contract Reconciliation

| UI Element in Image 3 | Contract Source | Binding Strategy |
|---|---|---|
| Page Title: "Quản lý lớp học" | Localized Title | Fixed UI text for Preschool vertical |
| Subtitle: "Theo dõi sĩ số..." | Localized Subtitle | Fixed UI text for Preschool vertical |
| KPI: Tổng số lớp | `classList.length` | Aggregated from `ClassItem[]` |
| KPI: Tổng học sinh | `classList.reduce(students)` | Aggregated from `ClassItem[]` |
| KPI: Chỗ trống còn lại | `classList.reduce(max - students)` | Aggregated from `ClassItem[]` |
| KPI: Tỷ lệ lấp đầy | `(students / max) * 100` | Aggregated percentage with rounded math |
| Classroom Mascot | `cls.gradeKey` / `cls.id` | Mapped to thematic preschool mascot illustration |
| Teacher Avatar & Details | `cls.teacher` | Mapped from teacher assignment |
| Capacity Progress | `cls.students / cls.maxStudents` | Single capacity progress bar with threshold color |
| Attendance Numbers | `cls.todayStatus` | Present, excused, unmarked, healthAlerts |
| Health Alert Badge | `cls.todayStatus.healthAlerts > 0` | Rendered as "♥ N lưu ý sức khỏe" badge |
| Student Avatar Stack | Mock / Roster Preview | Rendered with 6 child avatar portraits + overflow counter |
| Action: "Điểm danh" | Link `/dashboard/education/attendance` | Primary action with brand green `#075548` |
| Action: "Vào lớp học →" | Link `/dashboard/education/courses/[id]` | Secondary action |

---

## 7. Additive Migration Plan

- **Migrations Needed:** NONE (0).
- Pure UI and client presentation refactoring without any database mutations.

---

## 8. 11 Automated Verification Gates Plan

1. **Gate 0 (P0 - Multi-Tenant Isolation):** Verified via tenant filtering in API and client brand checking.
2. **Gate 1 (Zero-Cheating Types):** Verified with `tsc --project tsconfig.education.json` and explicit grep for `any` / `unknown`.
3. **Gate 2 (Kernel Freeze Compliance):** No files in `src/platform/` or `src/core/` are edited.
4. **Gate 3 (Lint & Quality):** Pass ESLint checks.
5. **Gate 4 (Public Contract Adherence):** API consumption matches `/api/education/courses`.
6. **Gate 5 (Visual Regression & UX):** Matches Image 3 hierarchy and styling tokens.
7. **Gate 6 (Interactive Verification):** Modal create class, filter tabs, search, and navigation links operate smoothly.
8. **Gate 7 (Theme Consistency):** Primary green `#075548` used consistently for primary buttons and active pills.
9. **Gate 8 (Performance):** Zero unneeded re-renders, lightweight markup without excess containers.
10. **Gate 9 (Accessibility & Responsive Layout):** Keyboard focusable, ARIA attributes, responsive 1-col to 2-col grid.
11. **Gate 10 (Non-Preschool Fallback):** Safe conditional rendering for other tenant modules.

**CONCLUSION: PASS.** Coding phase authorized.
