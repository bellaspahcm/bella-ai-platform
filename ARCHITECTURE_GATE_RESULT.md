# ARCHITECTURE GATE RESULT — PRE-SCHOOL VERTICAL PARENT PORTAL & CANONICAL ENGAGEMENT

> **Status:** PASS  
> **Date:** 2026-10-20  
> **Scope:** Full-Flow Parent Portal Experience via Secure Magic Token Link for Bella Preschool OS (`bella_education` / `bella_preschool`), covering:
> 1. Secure Magic Link Tokenization (`tenantId`, `guardianPartyId`, `studentPartyId`, cryptographic signature, expiration).
> 2. Class & Headcount Projection: Classroom name, teacher, total class enrollment count, and live daily attendance headcount (`edu_enrollments`, `edu_attendance_daily_state`).
> 3. Daily Care & Wellbeing Journal: Real-time arrival status, morning condition check, meal records, hygiene records, nap records, temperature/health checks, and safe pickup handover (`edu_daily_care_sessions`, `edu_daily_care_records`, `edu_preschool_pickup_handover_events`).
> 4. Weekly Nutrition Menu: Published weekly meal plans, daily breakfast/lunch/snack breakdowns, and caloric metrics (`edu_weekly_menus`, `edu_weekly_menu_days`).
> 5. Classroom Timetable & Routine: Daily preschool pedagogical and developmental activity schedule.
> 6. Tuition, Fees & VietQR: Invoice items, settlement status (`UNPAID` / `PARTIALLY_PAID` / `PAID`), and dynamic VietQR standard transfer payload (`edu_invoices`, `edu_invoice_items`, `edu_payments`).
> 7. Bidirectional Parent-Teacher Messaging: Thread retrieval and message persistence directly into Postgres (`edu_comm_threads`, `edu_comm_responses`).
> 8. Strict Type Invariant: ZERO use of `any` and `unknown` in all domain types, services, API routes, and UI components.

---

## 1. Bella OS/Product Development Process Gate

- **Truth:**
  - Guardians of preschool children require secure, frictionless access to their child's daily school lifecycle without requiring complex password authentication.
  - The portal must aggregate 7 canonical operational data pillars:
    1. Lớp học & Sĩ số hôm nay (Classroom & Daily Headcount)
    2. Lịch học & Khung giờ sinh hoạt (Class Timetable & Daily Routine)
    3. Thực đơn tuần & Dinh dưỡng (Weekly Nutrition Menu)
    4. Tình trạng con trong ngày (Daily Care & Wellbeing Journal)
    5. Lịch sử phát triển & Thể trạng (Observations & Physical Growth)
    6. Học phí & Mã QR thanh toán (Tuition Invoices & VietQR Settlement)
    7. Chat 2 chiều với Nhà trường (Bidirectional Parent-Teacher Messaging)
- **Source of Truth:**
  - Preschool Vertical Manifest (`src/products/bella-education/manifest.ts`).
  - Education OS Constitution (`docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md`).
  - Active verified Postgres schema (`edu_courses`, `edu_enrollments`, `edu_attendance_daily_state`, `edu_daily_care_records`, `edu_weekly_menus`, `edu_invoices`, `edu_comm_responses`, `party_relationships`).
- **Canonical Contract:**
  - Public contract access only: `Product -> Education Contract -> Education Kernel`.
  - Student identity is anchored via Platform Core `Party` (`party_parties`) + `students` vertical role.
  - Guardian relationship is verified via `party_relationships` (`GUARDIAN_OF`).
  - Attendance state is queried from `edu_attendance_daily_state`.
  - Daily care records are managed via `edu_daily_care_records`.
  - Financial records are reconciled via `edu_invoices`.
  - Messaging records are persisted in `edu_comm_responses`.
- **Gate Result:** `PASS`
  - Zero modifications to frozen Kernel layers (Healthcare H1–H12, Logistics E7.1–E7.3, Education Kernel in `src/platform/education/`).
  - Multi-tenant isolation enforced via mandatory `tenant_id` filtering on every query.

---

## 2. Product Manifest (Capabilities & Scope)

- **Target Vertical:** Bella Education (Preschool Vertical — `bella_education` / `bella_preschool`).
- **Capabilities in Scope:**
  1. `parent_engagement_communications`: Parent portal token issuance, thread queries, response persistence.
  2. `attendance_checkpoint_command`: Classroom total roster & daily attendance roll-call headcount.
  3. `care_safety_operations`: Daily arrival, meals, sleep, hygiene, health checks, pickup handover.
  4. `preschool_nutrition_menu`: Weekly meal breakdown and calorie tracking.
  5. `preschool_tuition_billing`: Invoicing, fee items, and dynamic payment payload.
  6. `learning_development_observation`: Milestones and teacher notes.

---

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Domain Entity | Canonical Table | Owning Subsystem / Engine | Storage Strategy |
|---|---|---|---|
| Tenant / Institution | `tenants` | Platform Core | Persistent DB |
| Student Identity | `students`, `party_parties` | Student Engine (E3) | Persistent DB |
| Guardian Relationship | `party_relationships` (`GUARDIAN_OF`) | Party Management | Persistent DB |
| Classroom / Course | `edu_courses` | Course Engine (E1) | Persistent DB |
| Enrollment & Class Headcount | `edu_enrollments` | Enrollment Engine (E2) | Persistent DB |
| Daily Attendance & Roll Call | `edu_attendance_daily_state` | Attendance Engine (E4) | Persistent DB |
| Daily Care & Wellbeing Journal | `edu_daily_care_sessions`, `edu_daily_care_records` | P4 Care & Wellbeing | Persistent DB |
| Safe Pickup Handover | `edu_preschool_pickup_handover_events` | P4.2 Safe Pickup | Persistent DB |
| Weekly Nutrition Plan | `edu_weekly_menus`, `edu_weekly_menu_days` | P4.3 Nutrition | Persistent DB |
| Tuition & Invoices | `edu_invoices`, `edu_invoice_items`, `edu_payments` | P7.1 Finance | Persistent DB |
| Communication Thread & Messages | `edu_comm_threads`, `edu_comm_responses` | P6 Parent Engagement | Persistent DB |

---

## 4. Contract Dependency Map

```text
Parent Portal Journey Flow:
   │
   ├─► Client Browser: /portal/education/[token]
   │     ├─► GET /api/education/portal/[token]
   │     │     └─► PreschoolParentPortalService.getParentPortalPayload(token)
   │     │           ├─► Token Verification (HMAC SHA-256 + Expiry Check)
   │     │           ├─► Guardian Authorization Assertion (party_relationships)
   │     │           ├─► Student Profile & Classroom Query (edu_courses + edu_enrollments)
   │     │           ├─► Classroom Headcount & Today's Attendance (edu_attendance_daily_state)
   │     │           ├─► Daily Care Journal (edu_daily_care_records)
   │     │           ├─► Pickup Handover State (edu_preschool_pickup_handover_events)
   │     │           ├─► Weekly Nutrition Menu (edu_weekly_menus + days)
   │     │           ├─► Tuition & Invoices (edu_invoices + edu_invoice_items)
   │     │           └─► Communication Thread & History (edu_comm_threads + edu_comm_responses)
   │     │
   │     └─► POST /api/education/portal/[token]/chat
   │           └─► PreschoolParentPortalService.sendChatMessage(token, text, attachments)
   │                 ├─► Guardian Authorization Check
   │                 ├─► Ensure Active Thread in edu_comm_threads
   │                 └─► INSERT Message into edu_comm_responses
```

---

## 5. Change Authority

- **Authorized Layers:**
  - Product Services: `src/products/bella-education/parent-portal/`
  - API Presentation Routes: `src/app/api/education/portal/[token]/`
  - UI Presentation Route: `src/app/portal/education/[token]/page.tsx`
  - Tests: `src/products/bella-education/__tests__/`
- **Prohibited Layers (Untouched):**
  - Healthcare Kernel (`src/platform/healthcare/` — FROZEN H1–H12)
  - Logistics Kernel (`src/platform/logistics/` — SEALED E7.1–E7.3)
  - Education Kernel Core (`src/platform/education/contracts/` — FROZEN E1)
  - Existing containment test: `src/__tests__/preschool-containment.test.ts` (Remains PASS)

---

## 6. UI → Contract Reconciliation

- **Classroom & Headcount Card:**
  - `courseTitle` maps to `edu_courses.title`
  - `totalClassSize` maps to `COUNT(edu_enrollments)`
  - `presentTodayCount` maps to `COUNT(edu_attendance_daily_state WHERE status IN ('present', 'late'))`
  - `childAttendanceStatus` maps to student's own record in `edu_attendance_daily_state`
- **Daily Care Journal:**
  - `arrivalStatus`, `arrivalTime`, `morningCondition`, `mealRecords`, `napRecords`, `hygieneRecords`, `healthChecks` map directly to `edu_daily_care_records`
- **Weekly Menu View:**
  - `days` map directly to `edu_weekly_menu_days` with `caloriesKcal`, `summaryDishes`, and `meals_payload`
- **Finance Card:**
  - Total fees, amount paid, and status map to `edu_invoices`
  - Bank transfer details format to NAPAS247 VietQR standard specification
- **Chat Box:**
  - Sends to `/api/education/portal/[token]/chat`, reads from `edu_comm_responses`

---

## 7. Migration Applicability & Additive Migration Plan

- **Status:** `NOT_APPLICABLE`
- **Justification:** All required database tables (`edu_courses`, `edu_enrollments`, `edu_attendance_daily_state`, `edu_daily_care_sessions`, `edu_daily_care_records`, `edu_weekly_menus`, `edu_invoices`, `edu_comm_threads`, `edu_comm_responses`, `party_relationships`, `students`) already exist with active schemas and RLS in the database.
- Tokens are cryptographically signed magic tokens (HMAC SHA-256) verified dynamically against active database relationships, eliminating the need for schema modifications.

---

## 8. Verification Plan

1. **Gate 1 (Architecture Compliance):** Zero cross-industry imports, strict TypeScript types (`no-explicit-any`).
2. **Gate 2 (Contract Boundary):** Product layer queries via authorized services.
3. **Gate 3 (Tenant Isolation - P0):** Mandatory `tenant_id` verification on token and all sub-queries.
4. **Gate 4 (Guardian Authorization):** Tamper resistance; forged or mismatched guardian-student tokens are rejected.
5. **Gate 5 (Regression):** Existing `preschool-containment.test.ts` continues to pass 12/12.
6. **Gate 6 (Integration Tests):** Dedicated test suite covering token creation, payload aggregation, and chat message persistence.
