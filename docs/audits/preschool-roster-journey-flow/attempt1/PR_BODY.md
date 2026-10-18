Prepared title: Fix sample Preschool roster selection and recovery

Filtering to another child could mark select-all checked solely because selection and visible counts matched. Bulk selection also discarded hidden selections. The scoped Grades page repair checks visible ID membership, uses functional selection updates, preserves hidden IDs, and disables bulk selection for an empty visible set. Reset is labeled “Xóa bộ lọc” and retains selections. Roster header/footer now describe the available eight sample profiles, unsupported page controls are removed, and both list/grid show explicit empty recovery feedback.

Validation status: BLOCKED — do not publish as passing.

- New independent roster-browser.cjs: six isolated journeys across light/dark desktop/mobile, fresh context/page for each journey. Actual Grades component and globals.css; synthetic Next/tenant-settings boundaries; task-local Chromium; loopback-only document.
- Before command: 24 flows, 4 PASS, 20 FAIL, 0 harness errors, exit 1. J5 profile regression passed in all four contexts. No baseline empty feedback existed, so contrast target count was 0.
- Same-test after command: 24 flows, 20 PASS, 4 FAIL, 0 harness errors, exit 1. All four remaining failures are J4 card-count assertions: the new test incorrectly lists “Đỗ Khánh Linh,” while the unchanged sample is “Đặng Khánh Linh.” Its name filter therefore counts seven of eight cards. The frozen test hash and receipts were preserved. A corrected same-test before/after sequence is required to establish 24/24; it was not performed or claimed.
- Eight new empty-feedback contrast targets PASS; minimum raw ratio 10.35474573184942 against 4.5. This covers only J3/J4 empty feedback.
- Changed-page ESLint, Education TypeScript check, node --check and git diff --check all exit 0. ESLint emitted the existing unsupported .eslintignore warning. Full commands, actual output, hashes, diff and preservation comparisons are in verification.json.
- Both browser commands recorded zero page errors, unexpected requests and downloads. Four after screenshots show recovered rosters with the original MAM selection. Browser contexts/browser/local server closed through finally.

Harness disclosure: The initial compile failed to resolve an extensionless TypeScript import. Bounded local .ts/.tsx/index candidates were added on unchanged source before the recorded baseline. The J4 oracle typo was discovered after the recorded baseline and left intact under the same-test requirement.

Scope evidence: sample constants, filter predicate, tenant detection and all profile/observation/AI drawers compare byte-equivalent after newline normalization against HEAD; hashes are recorded. Export/draft logic, globals, contracts, Kernel, backend and configuration are unchanged. No old suites, installations, remote network, environment/credential reads, DB/Auth actions, staging, commits, push, PR creation or deployment.

Limits: synthetic UI proof only. Parent RLS FAIL, Course authorization BLOCKED, UI-to-DB NOT_PROVEN and Pre-Go-Live BLOCKED remain. Daily/Course POST503 remains untouched. Lead owns real native lifecycle; this worker did not generate lifecycle claims.

Artifacts: native-before.json, native-after.json, verification.json, roster-browser.cjs and roster-{light,dark}-{desktop,mobile}.png in this directory.
