# Investigation: AutoMove dashboard NEXT_REDIRECT

## Hand-off Brief

1. **Hiện tượng đã xác nhận:** tab Chrome tại `http://localhost:3000/dashboard/bella-auto` hiển thị sidebar đã nhận người dùng nhưng nội dung là `Lỗi tải Dashboard / NEXT_REDIRECT`.
2. **Nguyên nhân trực tiếp:** `BellaAutoPage` gọi `redirect('/login')` bên trong `try`; `catch` bắt tín hiệu điều hướng và biến nó thành lỗi hiển thị. Luồng xác thực dev của proxy/layout và trang AutoMove không thống nhất.
3. **Bước tiếp theo:** sửa xử lý điều hướng tại trang, đồng thời quyết định dùng phiên Supabase Auth thật cho AutoMove hay hỗ trợ luồng dev qua contract hiện có; chỉ sửa `catch` chưa chứng minh dashboard tải được trong phiên dev hiện tại.

## Case Info

| Field | Value |
| --- | --- |
| Request | `kiểm tra lỗi automove, không tải được giao diện dashboard` |
| Date | 2026-10-23, Asia/Saigon |
| Status | Concluded: diagnosis; no runtime code changes |
| Runtime | Windows, Next development server, port 3000, listener PID 26240 at inspection |
| Checkout | `D:\Antigravity\Projects\BELLA SPA ERP` |
| Branch / HEAD | `codex/preschool-full-audit-20261020` / `474e3a57582cc0c9406a5e167af76937b45018db` |
| Working tree | Existing unrelated tracked/untracked changes, including `src/services/user-actions.ts`; preserved |
| Workflow config | No resolvable implementation artifact directory in BMAD config; case stored in repository `investigations/` fallback |

## Problem Statement

The supplied screenshot identifies `src/app/dashboard/bella-auto/page.tsx:36` and `NEXT_REDIRECT`. The same failure is visible in the current browser, so this investigation uses current runtime/source evidence rather than treating the screenshot or prior CI records as sufficient proof.

## Evidence Inventory

| Source | Status | Evidence |
| --- | --- | --- |
| Current browser | Available | Existing Chrome tab at the reported URL; authorized shell/sidebar plus dashboard error |
| Browser console | Available | 2026-10-23 19:51:28 Asia/Saigon: `Starting render...`, `Getting user...`, `No user, redirecting to login`, `Fatal error: NEXT_REDIRECT` |
| Server log | Available | `.next/dev/logs/next-development.log:68-71`, same four-message sequence |
| Source | Available | Page, proxy, login, shared current-user resolver, dashboard layout/cache |
| Runtime ownership | Available | Listener 3000 belongs to Next `start-server.js` under this checkout; parent executes `next dev` |
| Anonymous HTTP | Available | GET with no cookies/Authorization returns 307, Location `/login?next=%2Fdashboard%2Fbella-auto` |
| Real authenticated AutoMove session | Missing | No genuine user Auth session exercised during this diagnostic |

## Confirmed Findings

### 1. The page consumes a framework redirect as an application error

- `src/app/dashboard/bella-auto/page.tsx:25`: starts broad `try`.
- `src/app/dashboard/bella-auto/page.tsx:29-36`: `supabase.auth.getUser()` has no user; invokes `redirect('/login')`.
- `src/app/dashboard/bella-auto/page.tsx:75-77`: catches it, logs a fatal error, sets `errorMsg` from `error.message`.
- `src/app/dashboard/bella-auto/page.tsx:80-86`: renders the dashboard-error UI with that message.
- Installed `node_modules/next/dist/client/components/redirect.js` throws the redirect signal. The [official redirect contract](https://nextjs.org/docs/app/api-reference/functions/redirect) documents the same behavior and requires keeping redirect outside `try/catch`.

This explains both the user-visible `NEXT_REDIRECT` text and development error overlay. The browser and server logs directly confirm execution of this path.

### 2. Current authentication consumers accept different session types

- `src/app/(auth)/login/page.tsx:39-63`: development login can use the existing mock-email path after real Auth sign-in fails; this path does not establish a Supabase Auth user.
- `src/proxy.ts:146-150`: `NODE_ENV === 'development'` plus the mock cookie permits a protected route without `auth.getUser()` returning a user. `src/proxy.ts:225-228` forwards the corresponding mock-email header.
- `src/services/user-actions.ts:90-138`: shared `getCurrentUser()` includes that development-only resolution and validates active user/tenant state.
- `src/lib/dashboard-client-context.ts:4` and `src/app/dashboard/layout.tsx:73`: the shell uses the shared current-user path.
- `src/app/dashboard/bella-auto/page.tsx:27-36`: the page only uses the cookie-backed Supabase Auth client and has no corresponding dev-session resolution.

The differences above are confirmed in current source. The sidebar being authorized while this page logs no Auth user is consistent with the development path. The exact cookie/token contents and original login attempt were not inspected; active mock-session attribution is **Deduced**, not a credential-level observation.

### 3. The failure precedes inventory and analytics loading

`getMobilityVehicleInventorySummary` is reached at `src/app/dashboard/bella-auto/page.tsx:61`, after successful user/profile resolution. The observed invocation exits through the no-user branch before that call. No evidence from this incident establishes an inventory, chart, schema, or RLS defect.

## Hypothesized Paths and Refutation

| Hypothesis | Status | Resolution |
| --- | --- | --- |
| Dashboard rendering fails before business data loading | Confirmed | Current logs and page control flow stop at missing Auth user |
| Framework redirect is swallowed | Confirmed | Installed framework implementation, official contract, page catch, browser error |
| Current browser entered through the existing mock-dev path | Deduced | Consistent with proxy admission, authorized shell, and no Auth user; raw session contents not inspected |
| Server is stopped or uses a different checkout | Refuted | Matching listener/process paths, current browser error, successful local HTTP response |
| The incident proves an inventory/analytics or DB failure | Refuted for this invocation | Execution never reaches that data-loading branch |

## Verification Packet

```text
SCOPE: Read-only diagnosis of local AutoMove dashboard failure.
SECURITY SURFACE: Auth session resolution, development login, tenant context.
RELIABILITY SURFACE: Redirect control flow and dashboard rendering.
AUTH / RLS / TENANT EVIDENCE: Anonymous GET denied by redirect; no authenticated RLS assertion.
RUNTIME EVIDENCE: Existing browser and server logs; correct port/checkout; HTTP 307.
COMMANDS OR INSPECTIONS: Workflow resolver; source and Git reads; TCP/process inspection;
  current browser accessibility and filtered console logs; one anonymous GET.
RESULT: Direct redirect/catch defect CONFIRMED; dev-session mismatch confirmed statically.
GAPS: Real authenticated dashboard rendering and current Real DB/RLS behavior NOT_PROVEN.
STOP CONDITIONS: Diagnostic request completed; no auth/security-policy expansion inferred.
```

No test suite, build, database mutation, credential reset, login attempt, cookie alteration, dependency installation, restart, commit, push, or deployment was performed. The only authored file is this diagnostic report.

## Recommended Next Steps

1. In a scoped page repair, keep the missing-user redirect outside the broad data-load `try/catch`, or preserve framework control-flow errors using the supported framework API. Do not report redirect signals as dashboard failures.
2. Resolve the separate authentication mismatch before claiming recovery: a real Supabase Auth session is required by the page's current data client. If mock-dev support is intended, establish its approved identity/data-client contract and reuse it; merely replacing `getUser()` with `getCurrentUser()` leaves the data client without the real JWT and does not prove RLS-compatible data access. Do not add service-role access to this page as a shortcut.
3. Verify real authenticated dashboard rendering, unauthenticated redirect, existing dev-session behavior without redirect loops, and genuine data-load failures. Keep tenant/RLS checks proportional to any auth change.

## Side Findings

Installed Next is `16.2.11`; `package-lock.json` records `16.3.8`. This matches the stale-version badge but is not needed to explain the confirmed redirect/catch defect. Dependencies were not changed.

Historical dashboard/CI evidence was used only to identify prior presentation scope and dependency mismatch history. It is not proof of this checkout's current runtime or post-fix behavior.

## Conclusion

**Confidence: High** for swallowed redirect and the source-level auth-consumer mismatch. **Deduced** for the current browser's mock-dev origin; no credential inspection was needed or performed. Diagnosis is complete; dashboard recovery remains **NOT_PROVEN**, with no application source changes made in this task.

## Follow-up: 2026-10-23 — authorized local repair

The user asked `tiếp tục`, authorizing the diagnosed local repair. The original diagnostic conclusion above describes the earlier read-only phase.

- Isolated branch `codex/automove-dashboard-auth-redirect` in `C:\Users\DELL\.codex\worktrees\automove-dashboard-auth-redirect\BELLA SPA ERP` contains the scoped page repair, regression test, and completed spec/evidence.
- Page fix moves existing Auth lookup and missing-user redirect before the data-loading catch. No auth bypass, admin access, shared auth/RLS/contract/query change was added.
- Real Auth login through the existing repository test fixture succeeded; browser-origin logs then recorded analytics success and inventory loaded. No password reset or user provisioning was performed.
- Regression RED: 1 failed / 3 passed, reproducing swallowed redirect. GREEN: 1 suite / 4 tests passed, exit 0; lint exit 0; scoped whitespace clean. Three independent reviews found no actionable introduced defect after triage. Architecture guard exit 0 (presence/import checks only).
- Applied only the verified page to the active main checkout after confirming that file had no unrelated diff. Its SHA-256 matches the isolated copy: `84BEC6AF1F821BF93FDF857059CB5A9B600B2A0AFF7F0D0F5655C8F44EB3BD70`.
- Current listener at final inspection: PID 13128 on port 3000, Next server under the main checkout. No server restart performed by this task.
- Post-fix HTTP command exit 0: real-Auth dashboard Flight returned 200 and included Header/Analytics/Inventory, authenticated tenant, inventory summary; no dashboard error or redirect error. Recognized-sales API returned 200 with expected shape. Anonymous GET returned 307 to `/login?next=%2Fdashboard%2Fbella-auto`.
- Visual post-fix browser confirmation remains `NOT_PROVEN`: local browser use was disabled in Work settings after sign-in. No workaround or setting change attempted. HTTP/component payload and earlier Browser logs are separate evidence; no screenshot or full E2E claim.
- Local redirect/data-flow repair: `PASS` at the stated unit/HTTP scope. Production, full RLS isolation, full build/typecheck, and Go-Live remain unverified. No stage, commit, push, merge, or deployment.

Reviewable implementation record: `C:\Users\DELL\.codex\worktrees\automove-dashboard-auth-redirect\BELLA SPA ERP\implementation-artifacts\spec-automove-dashboard-auth-redirect.md`.
