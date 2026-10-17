# ARCHITECTURE GATE RESULT — PRESCHOOL REPORTS & ANALYTICS WORKSPACE REDESIGN (IMAGE 1 TO IMAGE 2)

> **Status:** PASS  
> **Date:** 2026-10-17  
> **Scope:** Redesign Executive Analytics & Reports UI (`src/app/dashboard/education/reports/page.tsx`) from the cluttered dashboard (Image 1) to the streamlined Executive Analytics & Decision Support Center (Image 2) exclusively for Preschool tenants (`bella_education`).  
> **Strict Type Invariant:** ZERO use of `any` and `unknown` in all code and handlers.

---

## 1. Bella OS/Product Development Process Gate

- **Truth:**
  - Preschool ban giám hiệu requires an Executive Analytics Dashboard with clear visual hierarchy, 4 white KPI cards, simplified 6-tab navigation, 3 actionable AI insights, SVG Attendance Line Chart (Y-axis 90–100%, missing data as dashed circle), SVG Grouped Tuition Bar Chart (phải thu / đã thu / còn nợ in slate/green/red), class breakdown table, top issues priority list, monthly highlights, and quick report downloads.
  - Critical distinction: Missing/unreported data MUST be distinguished from `data = 0` (P0 requirement).
- **Source of Truth:**
  - Image 2 reference screenshot and user UX/UI evaluation specification.
  - Preschool Vertical Manifest (`src/products/bella-education/manifest.ts`).
  - Education OS Constitution (`docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md`).
- **Canonical Contract:**
  - Read-only analytics aggregate presentation.
  - Public Contracts: Unaltered; zero database schema changes or migrations required.
- **Gate Result:** `PASS`
  - All modifications are strictly scoped to `src/app/dashboard/education/reports/page.tsx`.
  - Kernel H1–H12 (Healthcare), Kernel E7.1–E7.3 (Logistics), and Education Kernel remain 100% frozen.

---

## 2. Product Manifest (Capabilities & Scope)

- **Target Vertical:** Bella Education (Preschool Vertical — `bella_education`).
- **Target Page:** `src/app/dashboard/education/reports/page.tsx`
- **Capabilities in Scope:**
  1. **Clean Header:**
     - Title: "Báo cáo & Phân tích điều hành".
     - Subtitle: "Tổng hợp chỉ số vận hành, tài chính và chất lượng giáo dục toàn trường".
     - Calendar period selector ("Học kỳ 1 - 2025-2026").
     - Export button: "Xuất báo cáo PDF/Excel".
  2. **4 White KPI Cards:**
     - Tỷ lệ chuyên cần (95.7%) with target comparison + progress bar.
     - Tăng trưởng theo WHO (92.1%) with target comparison + progress bar.
     - Học phí đã thu (1.89 tỷ / 2.1 tỷ) with target comparison + progress bar.
     - Mức hài lòng phụ huynh (4.8/5.0) with star rating indicator.
  3. **Simplified 6-Tab Navigation:**
     - Tổng quan | Chuyên cần | Tài chính | Tăng trưởng | Phụ huynh | Báo cáo chi tiết.
  4. **AI Actionable Insights (3 cards):**
     - Ổn định (Tỷ lệ chuyên cần duy trì trên 95%).
     - Cần theo dõi (Tỷ lệ suy dinh dưỡng nhẹ tập trung ở khối Mầm).
     - Cơ hội cải thiện (Tự động hóa thông báo nhắc học phí qua Zalo/App).
  5. **SVG Attendance Line Chart:**
     - Y-axis calibrated from 90% to 100%.
     - Explicit handling for missing data: Tháng 9 shown as dashed empty circle with "Chưa có dữ liệu", NOT a line to 0.
  6. **SVG Grouped Tuition Bar Chart:**
     - 3 bars per month: Phải thu (Slate), Đã thu (Green #075548), Còn nợ (Rose/Red).
  7. **Class Breakdown Table:**
     - Mầm A1-A2, Chồi B1-B2, Lá C1-C2 with attendance, WHO growth, tuition collection, alert status.
  8. **Top Issues Priority List:**
     - 4 items categorized as Cao, Trung bình, Thấp with status indicators.
  9. **Monthly Highlights & Quick Downloads:**
     - Key monthly milestones and direct 1-click report download links.
  10. **Strict Typing Guard:**
     - Zero `any` or `unknown`.

---

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Data / Component | Owner | Boundary & Scope |
|---|---|---|
| Reports UI (`reports/page.tsx`) | Preschool Product UI (`src/app/dashboard/education/reports/`) | Redesign to match Image 2 |
| Attendance & Growth Metrics | Education OS Kernel Aggregates | Read-only presentation |
| Tuition & Revenue Aggregates | Billing & Finance Platform Contracts | Read-only presentation |
| Healthcare OS & Logistics OS | Respective Kernels | 100% Frozen & untouched |

---

## 4. Contract Dependency Map

```text
Preschool Reports Page (src/app/dashboard/education/reports/page.tsx)
   │
   ├─► Client Presentation Layer
   │     ├─► AttendanceTrendPoint (SVG Line Chart)
   │     ├─► FinanceTrendPoint (SVG Grouped Bar Chart)
   │     ├─► ClassRow (Class Breakdown Table)
   │     ├─► IssueItem (Top Issues Priority List)
   │     ├─► MonthlyEvent (Monthly Highlights)
   │     └─► QuickReport (Quick Download Center)
   │
   └─► Zero Kernel Mutations (ReadOnly presentation)
```

---

## 5. Change Authority

- **Authorized to Modify:**
  - `src/app/dashboard/education/reports/page.tsx`
  - `ARCHITECTURE_GATE_RESULT.md`
- **Unauthorized to Modify:**
  - Healthcare Kernel H1–H12
  - Logistics Kernel E7.1–E7.3
  - Core Navigation / Sidebar
  - Database Schemas / Migrations

---

## 6. UI → Contract Reconciliation

- All UI state and chart representations map to strictly-typed TypeScript interfaces:
  `ReportTab`, `AttendanceTrendPoint`, `FinanceTrendPoint`, `ClassRow`, `IssueItem`, `MonthlyEvent`, `QuickReport`.
- Zero `any` or `unknown` types used across all components and handlers.
- Explicit `null` handling for missing data in time-series points.

---

## 7. Additive Migration Plan

- **Migrations:** None required. This is a client-side presentation redesign consuming existing aggregate contracts and seeded executive data.

---

## 8. 11 Automated Verification Gates Plan

1. **Gate 0: Tenant Isolation** — Scoped to `bella_education` route.
2. **Gate 1: Strict Typing** — Zero `any`, zero `unknown`, zero type assertions to unknown.
3. **Gate 2: TSC Compilation** — `npx tsc --noEmit` validation.
4. **Gate 3: Browser UI Verification** — Visual fidelity matching Image 2.
5. **Gate 4: Architectural Guard** — No frozen kernel modifications.
