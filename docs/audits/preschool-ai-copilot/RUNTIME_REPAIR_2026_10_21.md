---
title: Preschool Executive Copilot runtime repair
type: bugfix
created: 2026-10-21
status: in-review
baseline_commit: 0ee8467a33c34d30a0a0a60911da0d55c85db5a2
---

## Intent and authority

Restore truthful, visible Copilot behavior on local Preschool. The user reported 186 present / 100% while the dashboard shows 0 present, then silent non-operation. Browser reproduction and source trace show `presentCount || totalKidsCount` and executive-action HTTP 403 for role admin. Owner approved “Cho phép admin trong tenant Preschool” on 2026-10-21. This authorizes the bounded permission extension and related repairs; no credential, role provisioning, Kernel, RLS or shared policy changes.

## Proportional Change Map and ownership

| Surface | Owner / change | Contract and verification |
| --- | --- | --- |
| Copilot API route | Product adapter: permit admin for the two executive actions only in own active canonical Preschool tenant | Real Auth, active profile/subject match, tenant query rejection remain; positive and denial tests |
| Dashboard | Product UI: preserve measured zero/absence/unmarked values, require loaded analytics, show API errors, label Q&A fallback | Existing ExecutiveDashboardDTO; browser reproduction and scoped checks |
| Capability pack and service | Product formatting: no invented attendance defaults; carry optional unmarked count; distinguish incomplete attendance | Existing executive tool result; unit and service regression tests |
| TT52 dashboard action | Product UI cannot supply structured age/staffing from current analytics DTO | Report missing evidence, do not invent two teachers or sample classes; no legal rule changes |

Flow: dashboard → authenticated Product route → Preschool service → Product capability pack. Analytics remains the existing snapshot source. No direct Kernel access, new persistence, migration, event or shared abstraction. Migration applicability: NOT_APPLICABLE. The canonical permission decision is the Phase4 gate section9.

## Acceptance

- Given a real active admin profile, when the own active tenant is canonically Preschool, then both executive actions pass authorization. Other products, unavailable identity, cross-tenant selectors and forged roles fail closed.
- Given 186 enrolled and 0 present, when generating briefing, then it says 0 present / 0%, preserving recorded absence and unmarked counts. Missing enrollment/present measurements fail rather than generate demo counts.
- Given incomplete roll-call, when formatting, then missing records are not described as confirmed absence or illness.
- Given failed requests, when invoking any dashboard Copilot action, then the user sees a safe, actionable error.
- Given no model configuration, when Q&A uses the existing fallback, then the UI explicitly labels rules-based guidance.
- Given the current DTO lacks verified age groups and per-class teachers, when TT52 review is requested, then no invented compliance pass is displayed.

## Verification applicability

The specialized eleven gates are retained with their actual scope:

| Education gate | Applicability / evidence |
| --- | --- |
| 1 Architecture | Scoped PASS: architecture/sandbox suites, lint and full TypeScript; no cross-industry imports or Kernel edits |
| 2 Contract boundary | Product-only request/result changes, no Kernel DB access; scoped service/API regression PASS |
| 3 Tenant isolation | Unit tenant selectors and canonical identity checks PASS; own-tenant browser request PASS. Full cross-tenant Real DB proof NOT_PROVEN; broad fixture run failed |
| 4 RLS & authorization | Auth/profile/role denial tests PASS; browser admin briefing and anonymous HTTP401 observed. No RLS modification; full DB RLS verification NOT_PROVEN |
| 5 Migration safety | NOT_APPLICABLE: no schema changes |
| 6 Event after persistence | NOT_APPLICABLE: no writes or events added |
| 7 Academic safety routing | NOT_APPLICABLE: no assessment/enrollment decisions or calculations changed |
| 8 Temporal provenance | NOT_APPLICABLE: no academic history or timeline writes |
| 9 Rule governance | NOT_APPLICABLE: no grading scale/checksum changes; existing TT52 thresholds retained without asserting new legal validation |
| 10 Audit evidence integrity | NOT_APPLICABLE: no transcript export or audit hash changes; existing child PII masking tests separately PASS |
| 11 Platform regression | FAIL in current fixture environment; detailed Education/Healthcare results below. No aggregate gate PASS, production or Go-Live claim |

## Results

- Implemented the approved Product-only admin extension, preserving real Auth, active profile binding, own-tenant selection and canonical Preschool identity for the newly permitted role. No DB role or credential changes.
- Removed the frontend `0 → enrollment` fallback and backend fabricated 100-child defaults. The payload now carries measured attendance, recorded absence and unmarked attendance separately. Incomplete roll-call does not imply illness/confirmed absence. Aggregate health incidents are labeled as incidents, not diagnosed fever cases.
- Removed sample class rosters, inferred age groups and hardcoded two-teacher staffing. Added `verificationComplete` to the Product result, and the dashboard suppresses compliance scores/certification when evidence is incomplete. Current analytics cannot prove full TT52 compliance; this dependency remains NOT_PROVEN.
- Errors are visible for all three tabs. The existing Q&A fallback is explicitly labeled rules-based. Local environment has no Gemini environment key; successful fallback is not proof of model availability. Existing tenant AI configuration infrastructure is outside this bounded repair and was not changed.

### Executed verification

| Check | Actual result |
| --- | --- |
| Copilot API, executive pack/service, existing Copilot, child PII, dashboard interaction suites | PASS: 5 suites / 119 tests, 0 failed. JSON: `.cache/copilot-theme/runtime-final-tests.json` |
| Scoped ESLint | PASS, exit0; existing `.eslintignore` warning only |
| Full TypeScript | Final `npx tsc --noEmit --pretty false`: PASS, exit0, no diagnostics. Raw log: `.cache/copilot-theme/runtime-typecheck-final.log` |
| `npm run education:verify` | FAIL, exit1. Architecture/customization/extension sandbox: 3 suites / 7 tests passed. Conformance: 6 failed + 2 passed suites, 32 failed + 14 passed tests. Root evidence includes `ENOTFOUND mock.supabase.co`, fixture fetch failures and timeouts/cascades. The final two chained conformance commands did not execute. No fixture/baseline/selector changes |
| `npm run healthcare:verify` | FAIL, exit1. Guard zero violations; architecture 2 suites / 9 tests PASS; conformance 1 suite / 7 tests PASS; Kernel regression 39 passed, 18 failed, 4 skipped suites; 374 passed, 151 failed, 5 skipped tests. Root evidence includes `ENOTFOUND mock.supabase.co` and fixture/cleanup cascades. Raw log: `.cache/copilot-theme/runtime-healthcare.log` |
| Real browser admin briefing | PASS at the recorded observation: API POST200 and rendered `Sĩ số toàn trường 186 trẻ, có mặt 0 trẻ (0% chuyên cần). Đã ghi nhận vắng 0 trẻ. Chưa điểm danh 156 trẻ.` These are snapshot values, not a claim that unmarked + absent + present reconcile to all enrollment |
| Real browser TT52 / final Q&A UI | NOT_PROVEN: local browser use was disabled in Work settings before the TT52 submit. Covered by interaction/API tests, not claimed as real browser proof |
| Independent review | NOT_PROVEN: three read-only reviewers were dispatched by the quick-dev workflow; two failed at usage limits, one failed when application network permission was revoked. No review findings were returned. Lead source/edge/acceptance self-review completed; no independent-review PASS or merge-readiness claim |

### Runtime and scope limits

Port3000 initially ran the corrected worktree and the browser briefing succeeded. The listener later stopped without a logged application error. Restarted the same worktree using the existing in-memory env launcher; final listener/HTTP evidence is recorded below. No browser control workaround was used after Work disabled browser access. No screenshot of the new briefing was captured before that restriction; existing investigation images predate the repaired briefing.

Final listener PID1868, parent22904; the listener command line resolves to this worktree's `node_modules/next/dist/server/lib/start-server.js`. Anonymous `POST /api/education/ai/copilot` returned HTTP401 with `COPILOT_UNAUTHENTICATED`. The unauthenticated dashboard request redirects to login as expected. This final smoke does not substitute for the earlier authenticated browser observation. `git diff --check` and scoped secret/log leak guard both passed. Actual `core.hooksPath` is `.husky/_`; pre-commit points to the architecture guard. No controls were changed.

These checks establish the bounded local repair and scoped regression behavior. Broad Education/Healthcare gates, full TT52 evidence, live Gemini, CI/main, production and Go-Live are not PASS. This change remains separate from UI-only PR408 on local branch `codex/preschool-copilot-runtime-feedback`.

## Suggested Review Order

- Inspect the approved admin boundary and canonical Product check.
  [route.ts](../../../src/app/api/education/ai/copilot/route.ts)
- Check measured attendance payloads, visible errors and incomplete TT52 display.
  [page.tsx](../../../src/app/dashboard/education/page.tsx)
- Inspect incomplete evidence handling and deterministic formatting.
  [PreschoolAICapabilityPack.ts](../../../src/products/bella-education/ai-skills/PreschoolAICapabilityPack.ts)
- Review UI interaction regression and permission denial coverage.
  [copilot-runtime.test.tsx](../../../src/app/dashboard/education/__tests__/copilot-runtime.test.tsx), [access.test.ts](../../../src/app/api/education/ai/copilot/__tests__/access.test.ts)
