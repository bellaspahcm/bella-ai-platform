---
title: 'Dong bo card va form ho so BabyCare'
type: bugfix
created: '2026-10-14'
status: done
baseline_commit: 61777e1eac60e586d4795bd5211a9d12469bfe6d
context: []
---

<frozen-after-approval reason="user requested implementation in this conversation">

## Intent

**Problem:** Trang chi tiet BabyCare dang hien phong goi, diem AI, anh va lich mau. Card ho so co cac muc khong sua duoc va gan thong tin be vao nhan thong tin khach hang.

**Approach:** Chi bat ban sua khi Product Identity la `bella_babycare`. Tai su dung du lieu ho so, booking, session va payment hien co; hien trang thai trong khi thieu du lieu.

## Boundaries & Constraints

**Always:** Beauty va cac product khac giu nhanh UI hien tai. Moi truong ho so co the sua phai dung `EditCustomerData` va `updateCustomer`. UI khong tu tao business rule.

**Ask First:** Them kha nang phan nhom, nguon khach, VIP, upload anh hay scoring AI can hop dong rieng.

**Never:** Sua schema, migration, RLS, Finance, ProductRegistry, Healthcare, Education, Logistics hoac du lieu Production.

## I/O & Edge-Case Matrix

| Tinh huong | Du lieu | Ket qua |
|---|---|---|
| BabyCare co ho so | ten me, ten be, ngay sinh/dusinh va gioi tinh be | Card va form dung nhan va cung truong |
| Ngay sinh khac du sinh | hai cot co gia tri khac nhau | Sua mot ngay khong ghi de ngay kia |
| Thieu ho so | truong null/rong | Hien chua cap nhat, khong suy dien gioi tinh/VIP/nguon khach |
| Chua co booking | mang rong | Khong hien goi demo, ngay demo, KTV demo |
| Sessions khac trang thai | scheduled/completed/cancelled | Lich ke tiep dung lich scheduled; lich su chi completed |
| Khong co khoan thu | revenue rong/pending | Tong thanh toan 0; khong hien tien mau |
| Beauty/unknown product | product khac bella_babycare | Khong bat nhanh BabyCare |

</frozen-after-approval>

## Code Map

- `src/lib/user-context.tsx`: Product Identity tu ProductResolver.
- `src/services/customer-actions.ts`: customer read/write co tenant scope va audit.
- `src/core/services/order/query-actions.ts`: booking/session/revenue read contract.
- `src/app/dashboard/customers/[id]/page.tsx`: chon nhanh BabyCare va tab.
- `src/app/dashboard/customers/[id]/components/`: cac card va form consumer.

## Tasks & Acceptance

**Execution:**
- [x] `page.tsx` -- opt-in theo product, tab dung noi dung va nut ghi chu dung action.
- [x] `CustomerProfilePanel.tsx`, `CustomerDetailModals.tsx` -- nhan ho so me/be va form tuong ung; tach hai ngay; bo muc gia.
- [x] `ActiveBookingPanel.tsx`, `BookingSelectorPanel.tsx` -- bo scoring/demo/dummy action tren BabyCare; dung KTV, trang thai va ngay thuc.
- [x] `SessionHistoryPanel.tsx`, `CustomerStatsPanel.tsx` -- session, money va empty state theo du lieu; bo phong va anh stock.
- [x] Test UI/component regression -- BabyCare happy/empty/date edits va Beauty isolation.

**Acceptance Criteria:**
- Given BabyCare, when mo card ho so va form, then cac nhan va gia tri tuong ung.
- Given lich BabyCare, when mo card, then khong co phong va khong hien lich/duration mau.
- Given thieu du lieu, when mo trang, then khong hien tien/KTV/anh/hoat dong mau.
- Given Beauty, when render cung component, then nhanh UI hien tai duoc giu.

## Verification

- Jest scoped component tests, customer-actions and payment audit.
- ESLint on touched TypeScript/TSX; git diff --check.
- TypeScript and architecture boundary checks.
- Desktop/mobile browser snapshots and interaction checks using synthetic fixtures; no Production mutation.

## Ket qua kiem tra

- 42/42 Jest tests PASS (4 suites): card/form, page/product isolation, customer actions, payment audit.
- Full TypeScript: zero diagnostics. Scoped ESLint and Architecture Guard PASS.
- Playwright Chromium: 1440x1000 va 390x844; no horizontal overflow; KTV selection,
  independent date edits, notes and save-to-local-preview-state PASS.
- Browser fixtures use real components with synthetic data; not Real DB persistence proof.
- Next dev localhost:3015 started; /login HTTP 200. Real DB/Production writes NOT_RUN.
- Single-agent local review followed Product Identity, null/zero, cancelled sessions,
  form write mapping and non-BabyCare rendering boundaries.

## Suggested Review Order

1. Product Identity va tabs:
   [page.tsx:31](../../src/app/dashboard/customers/[id]/page.tsx#L31)
2. Card ho so me/be:
   [CustomerProfilePanel.tsx:142](../../src/app/dashboard/customers/[id]/components/CustomerProfilePanel.tsx#L142)
3. Form dung cac truong hien co:
   [CustomerDetailModals.tsx:136](../../src/app/dashboard/customers/[id]/components/CustomerDetailModals.tsx#L136)
4. Lich va cac so lieu khong fallback du lieu mau:
   [babycare-customer-view.ts:8](../../src/app/dashboard/customers/[id]/babycare-customer-view.ts#L8)
5. Regression cho scope va chinh sua:
   [babycare-customer-card-contract.test.tsx:36](../../src/__tests__/babycare-customer-card-contract.test.tsx#L36)
