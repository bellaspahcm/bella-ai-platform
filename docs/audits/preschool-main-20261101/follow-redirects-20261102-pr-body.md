## Description

Two existing dependency chains block the reviewed Preschool code release: the root production audit flags `follow-redirects` 1.16.1, and Trivy flags Mobile's `decode-uri-component` 0.2.2. The owner approved both bounded repairs and their compatibility work; security gates and allowlists remain unchanged.

- Synchronize the root override and lock entry to `follow-redirects` 1.16.2, within Axios 1.20.0's existing range.
- Override Mobile's existing `query-string` chain to 9.5.1, installing decoder 0.5.1 and its required filter/split dependencies. Remove only the orphaned `strict-uri-encode` entry; retain every unrelated lock entry and Navigation Core 7.21.2/Routers 7.6.0.
- Preserve Core/Expo Router's existing namespace `parse/stringify` calls through a small Metro export-shape bridge that delegates to the library's public API. Other packages, the bridge's own import and existing resolver behavior retain normal resolution. No parser or routing rules are introduced.

An upstream Core upgrade was rejected because it changed URL output in two comparison cases. Merely pruning query-string also breaks Expo Router 4.0.22's undeclared imports. The scoped bridge avoids both changes.

Advisories: [follow-redirects](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p), [decoder](https://github.com/advisories/GHSA-qr28-fpjm-wq7f).

## Verification

- Root production audit PASS with the existing allowlist; synchronized pin passes plain and legacy-peer npm-ci dry-runs.
- Official integrity-verified redirect patch: 6/6 real loopback checks. The installed local baseline was 1.16.0, while the prior Git lock was 1.16.1; no Production exploit is claimed.
- Mobile clean `npm ci --ignore-scripts --no-audit --no-fund` PASS in an isolated copy; shared node_modules were not installed into or modified.
- Same-Core public linking helpers and Expo serializer: 31/31 comparisons PASS. The Node fixture rewires module imports to the bridge without changing upstream helper logic.
- Committed resolver/interop regression: 5/5 PASS. Actual Metro iOS bundle containing Core and the three existing Expo callers PASS.
- Root/CI TypeScript 5.9.3 against isolated Mobile: PASS, 0 diagnostics. Mobile's existing standalone TypeScript 5.3.3 cannot parse Expo's existing `module: preserve` setting (TS6046); this pre-existing toolchain mismatch is retained, not silently changed. CI uses the root compiler.
- Three independent scoped review layers: no actionable findings. `git diff --check` PASS.
- Final-head required CI, Trivy and remote builds must pass before merge/release; earlier failed install and scanner runs remain in history.

## Release scope

No UI, business rules, API, Auth, tenant/role scope, DB, migration, workflow, allowlist or Vercel settings change. No Mobile app-store/OTA release or device E2E claim. Product PR #474 is merged; this prerequisite supports its authorized code-only rollout, with staged verification before domain promotion.

Preschool remains NOT_READY overall: Teacher Care, Attendance V2, Admission and Real DB/RLS/Browser gaps are not closed by this dependency patch. No health migration is authorized.
