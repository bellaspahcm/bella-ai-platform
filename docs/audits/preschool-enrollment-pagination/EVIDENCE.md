# Pagination UI execution evidence

Result: PASS for the authorized pagination presentation repair. Independent review remains pending with Lead.

The readonly task gate authorizes this Product leaf only. The source now derives reachable numeric controls from filtered totalPages, uses boundedPage for slicing/current indication/disabled bounds, and synchronizes an out-of-range stored page during its own render. This conditional state adjustment converges immediately and prevents the old page from returning when a later list expands. No effect, backend logic or shared abstraction was added. The footer uses filteredStudents.length; page-size/reset and filter handlers remain unchanged.

## Executed proof

- Before source edits: actual component and actual globals.css, native Chromium, four theme/viewport journeys. 56 assertions: 28 failed, 28 passed, zero harness/runtime errors. Failures include phantom 28, wrong Next bound, footer count, absent accessible current page, and late-load shrink. Receipt: native-before.json.
- After native apply_patch: identical harness SHA-256; four journeys, 56/56 assertions pass, zero errors. Receipt: native-after.json. No bounded follow-up source correction was needed.
- Eight contrast measurements use the readonly reference method: computed foreground converted to sRGB with Chromium canvas, text ink hidden while preserving composited raster background, all pixels under real text rectangles sampled, WCAG threshold compared without rounding. Footer and current-page measurements all pass; minimum 4.758842787868666:1.
- All four named screenshots were visually inspected: pagination controls and footer are visible, current page is indicated, and controls fit the mobile footer. The existing table scroll surface is preserved. Remote fonts/images are blocked; browser fallback fonts and avatar fallbacks are expected in this isolated proof.
- Exact ESLint file, Education tsc command, node --check and git diff --check all exit 0. ESLint emits only the existing .eslintignore deprecation warning. Logs and exact commands are in verification.json.
- Preservation hashes compare 7,936 tracked/Lead-input/reference files; only the owned UI source differs. Three source regions outside pagination/footer match after LF/CRLF-only normalization. Raw source hashes are retained separately. The baseline inventory and pre-edit source are retained under .cache. Parent Daily GET and Course POST retain status 503 unchanged.

## Journey details and limits

Every theme/viewport covers synthetic many-page census, last/previous/first page contents, Next/Previous bounds, page-size reset, filter reset, one match, zero matches, href identity, checkbox state through navigation, keyboard Enter navigation and aria-current, then late async list shrink while already on a valid later page. The initial fixture census combines 73 explicitly synthetic students with the ten existing sample records through the unchanged merge. Expectations use the rendered IDs from two 50-row pages rather than fixed total counters.

The initial canonical preset has only ten rows. For the late-response case the harness appends a test-only size=1 option and invokes the real select handler, navigates to page 3, then releases a pending synthetic GET replacing all ten IDs with one active and nine pending records. This proves a valid later page clamps when the filtered active list shrinks. It does not assert that production exposes size=1.

The loopback server accepts only declared document/registry GETs. Routing blocks unexpected requests and all write methods; CSP blocks remote assets and form submission. All four final journeys record zero unexpected network calls, mutations or page errors. No real endpoint, DB, credentials or auth was accessed. UI→DB NOT_PROVEN; Parent RLS FAIL; Course authorization BLOCKED; Pre-Go-Live BLOCKED.

No old suite, install, network probe, task retry/resume, subagent, stage/commit/push/PR/deployment or tooling/Lead-input edit was performed. source.diff is the reviewable runtime diff. PR_BODY.md is prepared for Lead delivery; stop after evidence.
