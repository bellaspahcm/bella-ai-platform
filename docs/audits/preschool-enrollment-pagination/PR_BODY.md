# Fix Preschool registry pagination bounds and filtered footer

The registry rendered fixed pages 1–5/28 and allowed Next through page 28 even when the filtered list had only one page. Its footer always reported 280 children. Pagination now offers the first, neighboring, current and last reachable pages, marks the current page for assistive technology, clamps the page when the list shrinks, and reports the filtered count. Existing filter and page-size resets remain in place; the page-size control now has an accessible name.

Only runtime change: `src/app/dashboard/education/enrollments/page.tsx` (15 insertions, 22 deletions). API requests, sample/API merge and fallback, admission, links and selection handlers are preserved. Parent Daily and Course 503 containment is unchanged.

Validation: unchanged actual-component Chromium harness ran once before and once after. Before: four journeys, 28 failing assertions, zero runtime errors. After: four journeys, 56/56 assertions PASS; eight raster/computed-text contrast measurements PASS, minimum 4.758842787868666:1. Light/dark × desktop/mobile screenshots inspected. Focused ESLint, Education typecheck, harness syntax and git diff whitespace checks all exit 0. Raw hashes and preservation comparisons are in `verification.json` and `preservation-proof.json`.

Harness uses the actual page and globals.css, a Next Link presentation stub preserving href, and synthetic loopback GET responses. Remote images/fonts are blocked. Expected rows come from the rendered fixture census. Late-load shrink uses a documented test-only page-size 1 option through the actual select handler because the initial ten-row preset cannot occupy a later page at production sizes. No real API/DB/Auth or persistence proof is claimed.

Independent Reviewer: pending, coordinated by Lead. UI→DB NOT_PROVEN; Parent RLS FAIL; Course authorization BLOCKED; Pre-Go-Live BLOCKED. No commit, push, PR creation, merge or deployment performed.
