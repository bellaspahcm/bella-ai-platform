# Preschool theme preset — verification

Ngày: 2026-10-16. Baseline: `0639dd98f`. Worktree: `C:/Users/DELL/.codex/worktrees/preschool-theme-preset/BELLA SPA ERP`.

## Kết quả trong phạm vi

- Sidebar Education đọc resolved sidebar tokens, gồm màu chữ tương phản, active/hover và trạng thái dark. Không tự ánh xạ preset sang bảng màu Tailwind riêng.
- Brand actions, selected tabs, links, focus và heading trên 17 trang Education tiêu thụ tenant tokens. Các trang Learning/Scheduling/Facilities theo light/dark tokens thay vì khóa nền tối.
- Giữ nguyên handlers, API, query, validation, authorization, route, dữ liệu, số liệu và điều kiện nghiệp vụ. So sánh AST của 18 TSX files sau khi bỏ className và các hằng presentation: 18/18 trùng baseline. JSON: [semantic-preservation](evidence/semantic-preservation.json).
- Giữ màu phân loại biểu đồ và ý nghĩa màu trạng thái/cảnh báo. Những trang trước đây chỉ có dark palette được bổ sung shade light cùng hue, giữ shade dark.
- Không đổi ProductRegistry, provider, resolver, persistence, API/service/repository, migrations, RLS/auth hay Kernel. Người dùng đã cho phép commit, push và mở PR sau khi kiểm tra local.

## Bằng chứng thực thi

| Check | Kết quả |
|---|---|
| `git diff --check` | PASS |
| `npx eslint src/app/dashboard/education src/components/layout/sidebar.tsx --quiet` | PASS, không lỗi; chỉ warning `.eslintignore` hiện hữu |
| `npm run typecheck:changed` | PASS; selector chạy full strict TypeScript, 0 diagnostics |
| `npm run gate:education-no-new-debt` | PASS; Education-owned diagnostics = 0 |
| Existing theme isolation + unknown-module theme suites | PASS; 2 suites, 16 tests |
| Browser route sweep | PASS về render fixture; 17/17 route, light/dark, 0 page errors |
| Browser theme matrix | PASS cho mẫu đã chạy; 64 cases, không tràn ngang |
| Browser tabs/modals | PASS về presentation; 28 interactions, 0 page errors, không submit mutations |
| AST preservation | PASS 18/18 TSX files |

Theme commands:

```powershell
cd 'C:\Users\DELL\.codex\worktrees\preschool-theme-preset\BELLA SPA ERP'
npx jest src/__tests__/beauty-spa-theme-preset-isolation.test.ts src/__tests__/unknown-module-theme-engine.test.ts --runInBand
```

Browser matrix = dashboard + teachers × 8 color cases × 2 appearances × 2 viewports (1440×1000, 390×844). Color cases: six existing presets plus custom dark `#5B217A` and light `#FFD54F`. Minimum primary-button contrast observed in this matrix: 7.178:1. This does not certify all possible custom colors, status text, focus indicators, or all content combinations. JSON: [browser sweep](evidence/browser-sweep.json), [tabs/modals](evidence/interactions.json).

Browser automation used the actual compiled UI with intercepted read responses and tenant/user fixtures. All API mutation requests and non-read server actions were blocked. Preset variants were applied to the DOM using existing resolved tokens; no tenant settings were saved. Screenshot capture waited for sidebar transitions. Scripts/screenshots remain under `.cache/preschool-theme/` for reproduction, without credentials.

A separate read-only database lookup confirmed `Preschool Test` currently has `stylePreset=ocean_clean`, primary `#1E40AF`, accent `#3B82F6`. Its `product_key` is null; the browser fixture supplies Preschool identity only to exercise presentation. No production identity/auth repair was performed. Production login, real user workflow and production rollout are **NOT_PROVEN** by this UI verification.

## Wide gates and attribution

- `npm run education:architecture`: 3 tests PASS, 1 FAIL; 217 direct Kernel DB access findings in existing `src/products/bella-education` repositories/services. That directory and `src/platform/education` have no diff against baseline. Classification: **PRE_EXISTING**. No suppression or baseline weakening.
- `npm run healthcare:verify`: architecture guard PASS with zero violations; architecture 2 suites/9 tests PASS; conformance 1 suite/7 tests PASS. Full regression encountered `TypeError: fetch failed` in DB fixture creation, followed by undefined-fixture cleanup cascades. The default test environment uses mock Supabase fallback because this worktree has no DB test environment. Stopped the failing wide regression. Full Healthcare regression = **NOT_VERIFIED (ENVIRONMENT)**, not PASS. Healthcare sources have no diff against baseline.

## Independent QA

Implementation: one owner. Three read-only reviews were required by quick-dev step 04; no reviewer edited shared files. Roles: blind hunter (`bmad-review-adversarial-general`), edge-case hunter (`bmad-review-edge-case-hunter`), acceptance auditor (approved spec + Architecture Gate). Inputs were diff-only or diff plus allowed source/spec, without conversation context. Outputs were findings and locations; ownership was strictly read-only QA.

Fixed findings: inactive sidebar child text and mobile close contrast; global unlayered heading cascade; Learning white text on new light panels; light status shades; Facilities badge foreground; back-link and observation-button hover contrast; expiry icon amber distinction; missed primary/focus controls. Evidence and AST checks were refreshed after fixes.

One review claimed `#AAAAAA` produces white text; direct execution disproved it: current resolver returns `#0F172A`, ratio 7.685:1. Rejected that example. Independent checks did find an existing shared-resolver limitation: `#777777` yields 3.987:1 and `#118899` yields 4.195:1. See [custom color boundary](evidence/custom-color-boundary.json). This boundary is outside the approved six-preset presentation repair; shared normalization/luminance logic remains unchanged. Arbitrary custom-color contrast = **DEFER**, requiring a separately authorized shared theme repair.

## Seal boundary

**Six-preset presentation repair: verified locally with fixtures. Business logic preservation: source/AST proven. Full platform/production proof: NOT_PROVEN.**

The spec remains `in-review` to keep the wide-gate and arbitrary-custom-color boundaries visible. No full-suite PASS, production readiness or Go-Live claim.
