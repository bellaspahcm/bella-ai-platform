# Architecture Change Request (ACR)

**ACR ID:** ACR-2026-020

**Date Submitted:** 2026-10-19

**Submitted By:** Codex, tenant initial-render repair

**Status:** APPROVED

**PR:** [#388](https://github.com/bellaspahcm/bella-ai-platform/pull/388)

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-020",
  "status": "APPROVED",
  "pr": 388,
  "approvedCoreFiles": [
    "src/core/providers/TenantContextProvider.tsx"
  ],
  "approver": "Human user (explicit ACR-2026-020 Core Freeze exception)",
  "approvedDate": "2026-10-19",
  "purpose": "Prevent the existing module-context theme effect from overwriting authenticated product branding on /dashboard and its child routes by adding only a pathname guard. No contract, schema, RPC, API, or data ownership change.",
  "contractChange": false,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->

## Summary

Approve a scoped Core Freeze exception for four added lines in the existing client-side tenant context provider. On `/dashboard` and its child routes, its module-based theme effect must leave presentation to the authenticated dashboard brand consumer so that a late context response cannot overwrite the resolved product theme.

The user approved the implementation plan on 2026-10-19, including this file, and subsequently authorized PR delivery. That task approval is recorded in the [approved specification](../../../implementation-artifacts/spec-tenant-initial-render.md). After reviewing this ACR's exact scope, the user separately approved the Core Freeze exception: "Duyệt ngoại lệ Core Freeze theo ACR-2026-020". This record attributes that exception to the human user; it does not assert a separate Architecture Review Board meeting or vote.

## Exact Core Scope

```text
src/core/providers/TenantContextProvider.tsx
```

The change adds only the following guard after `if (!context) return;` in the existing theme effect:

```typescript
// Dashboard branding is resolved from the authenticated UserProvider tenant.
// This module/context provider must not overwrite that product identity.
const path = window.location.pathname;
if (path === '/dashboard' || path.startsWith('/dashboard/')) return;
```

No other Core file is approved. The existing effect still runs for routes outside `/dashboard`.

## Reason and Decision

The bootstrap, dashboard layout and sidebar previously accepted missing or stale presentation identity. In addition, this provider writes theme from enabled modules independently of the dashboard's authenticated tenant/product resolution. A later module-context response can therefore replace the correct product presentation.

The approved decision is to stop this secondary theme writer on the dashboard subtree. Keep the existing `tenant.product_key -> ProductResolver -> ProductRegistry` identity contract and the authenticated `UserProvider` snapshot. Dashboard layout and shell already apply the resolved presentation before rendering product content.

This shared presentation effect serves multiple registered products, including Preschool/Education, Healthcare and Beauty. This statement describes the shared consumer scope; it is not a claim of authenticated browser or Real DB verification for every product.

The governing freeze decision remains [ADR-002](../ADR-002-PLATFORM-CORE-FREEZE.md). This ACR records the human-approved, file-specific exception and its alternatives; it does not unlock a Kernel or establish a new Core capability.

## Authority and Impact

| Boundary | Approved change |
| --- | --- |
| Core file | Only the presentation-effect guard shown above |
| Public contract / API / RPC | None |
| Database / schema / migrations | None |
| Data ownership / product identity source | None |
| Authentication / authorization / RLS | None |
| Context fetch, timeout and dev/HQ fallback | None |
| Healthcare H1-H12 / sealed Logistics Kernels | None |

Risk is a dashboard theme remaining neutral if the authenticated brand consumer fails to resolve. The shell intentionally stays neutral or displays the existing error instead of presenting another product. No data migration is required.

## Alternatives Considered

1. **Only reset the theme in Product/UI consumers.** Rejected because the later provider effect remains an independent writer and can overwrite the result.
2. **Change context fetching, its module fallback, or the identity contract.** Rejected because this incident needs only presentation control and those changes exceed the approved scope.
3. **Relocate the provider or weaken the freeze guard.** Rejected because this would conceal the Core change rather than obtain the required approval.
4. **Leave the provider unchanged.** The competing dashboard theme writer remains and the reported first-render defect is not fully addressed.

## Verification Evidence

Evidence below is for PR head `ad3a7686171916e9ad1df893fc0b27cf0596ca40` against base `4816e75b1dbcca12c110c98af6da3604d793d962`:

- Local new behavior tests: 83/83 passed. Expanded local run: 196/197 passed; the remaining palette source assertion also failed before this change.
- Local ESLint, diff hygiene and Healthcare Architecture Guard passed.
- GitHub full Type Check, Relevant App Build, affected tests, changed-file lint, Baseline Comparison, Architecture Gate and security checks passed on 2026-10-19.
- Core Freeze Verification failed at the original head because PR #388 had no matching approved metadata. This was a missing governance approval, not evidence of a runtime compilation or test failure.
- Real Database Business E2E and Vercel were still pending at the evidence snapshot. Browser E2E remains NOT_PROVEN because browser control is disabled. Healthcare Real DB verification remains blocked by the previously documented test-environment gap.

The approval block above binds PR 388 to exactly the one Core file, with the actual human authorization and approval date, and all contract/schema/RPC/API/ownership change flags set to false. Verification commands:

```powershell
node scripts/approved-core-change-guard.mjs --pr 388 --base 4816e75b1dbcca12c110c98af6da3604d793d962 --head HEAD
git diff --check
```

Commit the approval record to the same PR branch and verify the new head's CI. A passed governance check alone does not establish complete CI, browser proof, main deployment or Go-Live.

## Rollback

Revert the four-line provider guard together with the coordinated dashboard presentation patch from PR #388. A database rollback is not needed. Reverting the provider alone reintroduces the competing theme writer and does not preserve the intended fix.

## Approval Record

- **Core Freeze decision:** APPROVED by explicit human exception for PR #388 and the exact file scope above.
- **Approver / date:** Human user in this task, 2026-10-19.
- **Authorization evidence:** In response to the question naming PR #388, the exact Core file, the four-line guard and all unchanged boundaries, the user answered "Duyệt ngoại lệ Core Freeze theo ACR-2026-020".
- **Board review:** A separate board meeting is not evidenced; no board members or votes are claimed.
- **Implementation authorization:** User-approved task specification on 2026-10-19; followed by the separate Core Freeze exception recorded here.
