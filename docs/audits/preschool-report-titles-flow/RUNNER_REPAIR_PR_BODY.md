# Fix Preschool report document-title contrast

Quick and detailed report document names used a fixed dark text color in dark mode. Update only their two title classes to `text-slate-900 dark:text-slate-100` so the same four document names remain readable in both themes.

Base: `8f3441a08c6cea99f4544b32a662ce0fc53ec172`.
Branch: `codex/preschool-report-titles-flow`.

Validation:

- Native before: 16/32 pass, 16/32 fail; command exit 1. All 32 labels and ratios agree exactly with the host baseline on the same source/global CSS hashes (maximum delta 0, tolerance 1e-6), established before the UI patch.
- Same title-only test after: 32/32 pass across light/dark and desktop/mobile; exit 0; minimum raw contrast 13.656246675414016 against threshold 4.5.
- Four screenshots; zero page errors, unexpected requests, or downloads in all four cases.
- Changed-file ESLint, test syntax, and `git diff --check`: exit 0. ESLint reports the existing `.eslintignore` warning.
- Source diff: two insertions/two deletions, only the approved title classes. Exact comparison to HEAD after these replacements confirms all other source, including existing 503/output behavior, is preserved.
- Runner repair changes only the provisioned worktree Chromium executable path and new receipt/screenshot filenames. Measurement criteria and network assertions remain unchanged. Prior receipts are preserved.

An optional reverse-edit byte-hash comparison to the older attempt1 test receipt did not match; historical byte identity is NOT_PROVEN and the failed diagnostic is disclosed in `runner-repair-verification.json`. The current native before/after test hashes match, and the required host/native measurement equivalence passed independently.

Evidence in this directory: `native-before.json`, `native-after.json`, `native-equivalence.json`, `native-source.diff`, `runner-repair-verification.json`, and `native-titles-{light,dark}-{desktop,mobile}.png`.

Limits: synthetic React mount of the actual Reports component and globals.css, with stubbed Next presentation boundaries and no downloaded fonts. No Auth/API/DB or production-readiness proof. RLS FAIL, Course authorization BLOCKED, UI-to-DB NOT_PROVEN, and Pre-Go-Live BLOCKED remain. Old 84-contrast/11-Jest suites, full build, and full typecheck were not run under this bounded handoff.

Prepared PR only. Lead independently records and reconciles real native file-change/command lifecycle evidence; this worker does not manufacture that evidence. No staging, commit, push, PR creation, or deployment performed.
