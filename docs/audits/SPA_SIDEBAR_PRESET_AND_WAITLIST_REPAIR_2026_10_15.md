# Spa Sidebar Preset and Waitlist Repair

Date: 2026-10-15
Scope: BabyCare/Beauty Spa shared presentation and waitlist UI tenant selection.
Architecture gate: `ARCHITECTURE_GATE_RESULT.md`, Spa Session Theme and Copy,
including the Waitlist Consumer Addendum.

## Root Causes and Changes

- Assigned appointments used fixed blue instead of tenant primary tokens.
- BabyCare calendar reused Beauty Spa coordinator copy. BabyCare copy now opts
  in through Product Identity `bella_babycare`; Beauty retains its identity copy.
- Spa vocabulary and appointment notes used exercise-session terminology. Both
  spa modules now use treatment-session terminology; other vocabularies unchanged.
- Primary controls used fixed white text, hue-specific hover/shadows, legacy
  pink/gold accents, or selected dark backgrounds. Consumers now use existing
  primary/foreground/hover tokens. Neutral surfaces, semantic status colors,
  destructive controls, palette swatches, and chart category colors are retained.
- BabyCare CSS defaults could override a configured preset. Defaults now apply
  only without a preset marker. Preset primary-button rules and dark contrast
  consume runtime tokens. No new theme resolver or palette is introduced.
- Waitlist UI used `TenantContextProvider.tenantId`, which can be `dev-tenant`
  after a development timeout/fallback. The API validates the authenticated
  `getCurrentUser().tenant_id`. List/detail now use that profile through the
  existing UserProvider. List/stats/filters/add form share the same tenant.
  Missing/loading profiles do not send demo-tenant requests. API guards unchanged.

## Sidebar Source Sweep

Admin menu inventory from `src/components/layout/sidebar.tsx`:

| Route | Source review |
|---|---|
| `/dashboard` | Primary actions, shared dashboard controls |
| `/dashboard/ai-copilot` | Primary actions and related salary UI |
| `/dashboard/customers` | List/detail/modals and shared customer controls |
| `/dashboard/bookings` | Timeline/month/POS/create/detail controls |
| `/dashboard/sessions` | Cards/table/calendar/session modal |
| `/dashboard/waitlist` | Profile tenant, primary controls, preset stats accents |
| `/dashboard/inventory` | Add/request/restock/reconcile/transfer controls |
| `/dashboard/product-sales` | List/form primary controls |
| `/dashboard/salary` | Selected tabs, modals, tables, actions |
| `/dashboard/beauty-spa-v2/chain` | Selected branch uses primary tokens |
| `/dashboard/accounting` | Navigation, overview and accounting subpages |
| `/dashboard/finance/reconciliation` | Actions and related finance views |
| `/dashboard/executive` | Primary action; category KPI colors retained |
| `/dashboard/analytics` | Tabs/loading and embedded analytics views |
| `/dashboard/guides` | Spa-specific preset accents; other module branches retained |
| `/dashboard/services` | Primary controls, service accent panel, focus/selection |
| `/dashboard/settings` | Primary actions, focus accents, salary toggles; swatches retained |

This is a source/consumer audit, not an authenticated browser E2E of all 17 routes.
Shared UI consumers can also be used by other products; those products receive
semantic primary tokens rather than a fixed BabyCare color. Product-specific
non-spa implementations and permissions/navigation remain unchanged.

## Executed Evidence

- Focused Jest: spa sidebar theme/copy, existing preset isolation, unknown module,
  waitlist profile/boundary, BabyCare card/page, salary surface parity.
- Full TypeScript: zero diagnostics.
- ESLint changed TS/TSX: passed; only the existing `.eslintignore` CLI deprecation
  notice, no source lint warnings/errors.
- Architecture Guard: passed. No Core/Platform/kernel/API/service/RLS/schema edits.
- Presentation diff audit: 81 of 92 changed TSX consumers modify literals only;
  the remaining 11 are reviewed coordinator/vocabulary/theme-map/readiness cases.
- Browser component fixtures: 16 combinations across 1440px/390px, light/dark,
  BabyCare rose/ocean/custom light primary and Beauty jade. Actual global CSS,
  resolver, timeline/month/session modal render. Check computed backgrounds,
  foregrounds, hover, coordinator/session copy, no document overflow, accessible
  modal save control, and screenshots. Server actions/subscriptions are stubbed;
  this proves UI consumption, not persisted workflow or Real DB correctness.
- Read-only localhost `3015` HTTP smoke using the existing development-cookie
  mechanism and an existing BabyCare admin: list and stats reject `dev-tenant`
  with 403 and accept the profile tenant with 200. No users/rows were created or
  modified. This is not proof of Production login, RLS data contents, or Go-Live.

## Seal Boundary

No payment/deposit formulas, payroll rules, state transitions, notifications,
authorization, persisted data, migrations or frozen kernels were changed.
Production and full authenticated sidebar E2E remain NOT_PROVEN in this batch.
