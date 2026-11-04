## Description

Care deep links could resolve a sample name instead of the selected child's canonical roster identity, and late save callbacks could reset a newer child context. Resolve only exact Party IDs or unique student codes from the authorized roster, clear stale selection/draft on context changes, and preserve read-back and whole-class quick-save behavior.

Portal Care, Attendance and Tuition reads verified the token signature without revalidating the current guardian relationship. Reuse the existing `authorizePortalToken` service before private reads. Attendance database errors now return unavailable instead of a successful empty summary; genuinely absent enrollments retain the empty result.

## Type and architecture

- [x] Bug fix; Preschool Product scope only: four runtime files and six test files.
- [x] Existing public authorization contract and guardian repository reused.
- [x] No new SQL surface, schema/migration, role/grant, business rule or API success-contract change.
- [x] UI layout/classes/components and valid Finance/attendance behavior preserved.
- Real Estate checklist: not applicable. Kernel, guard/baseline, F10/F12/F13, Attendance V2 and GL05 remediation are excluded.

## Verification

- Clean assembly from current `main` `f1299e3138f3700062a1ed84271db315737b0071`: 12 Jest suites / 273 tests PASS, zero failed/skipped.
- Focused TypeScript over all ten changed files: zero diagnostics.
- `npm run build:prod`: PASS. This retains the existing production command's skipped build typecheck; focused TypeScript is separate evidence.
- Narrow independent integration review: ten copied files match sealed sources; thirteen unchanged dependencies match clean main. No dependency on excluded WIP found.
- Prior GL02/GL03/GL04 source reviews retained. Unit/DOM/mocked API evidence does not prove Real DB/RLS, Browser E2E or Production.

## Database and deployment

- [x] No database changes in this PR.
- [x] All original audit/remediation WIP preserved in its original checkout.
- [ ] Production rollout complete.

Production remains HOLD independently of code review: the existing release workflow has a mandatory health-migration step capable of applying a database migration; a code-only release route still needs a separate scoped decision. Keep all required CI/security/migration gates; no workflow dispatch, Promote or DB mutation is part of PR creation.

The current CLI deployment reports `gitDirty=1`. Direct read-only comparison resolved all 36 runtime source-file UID mismatches as BOM/line-ending differences: normalized source text matches main. This is source provenance evidence, not compiled-artifact or application E2E proof. No unrelated Production code is imported into this PR.

Full Teacher Care/Parent persistence, scoped handover and Preschool Go-Live remain NOT_PROVEN/HELD as applicable. This PR releases no new capability and does not certify Go-Live.
