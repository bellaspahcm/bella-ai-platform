---
title: Complete existing Preschool security delivery and repair applicable CI failures
type: bugfix
status: completed
created: 2026-10-21
baseline_platform: 790caf5ee89cdf91020b48491ed37eae22ef581f
baseline_education: 2522f6db2d0a19e6ec9ddc9f775bc8cd669d72c8
context: []
---

<frozen-after-approval reason="Continue the existing approved remediation after owner push and tiếp tục fix; no new Product/API/DB scope inferred">

## Intent

Complete the review/CI path of the two pushed security fixes without broadening the approved runtime or database scope. Fresh remote inspection found no PRs/runs, and a Git ancestry mismatch: squash-merged Phase3/4 commits remain unmerged ancestors in both delivery branches. A three-dot PR diff includes unrelated14 paths although the two-dot main→head content diff contains exactly each sealed scope. Correct that actual delivery defect first, then use draft PRs and applicable checks to expose/fix regressions within the approved source boundary.

## Boundaries

Allowed source: existing six shared identity/test/migration files and five Education Courses API/test files from source-release-manifest.json; directly related regression tests where an actual failure requires them. Keep the two PR scopes separate. Reuse the clean managed delivery worktrees. Owner's push authority persists for necessary same-scope delivery updates; continue fix authorizes the ordinary draft-review/CI path. Merge/release/production operations still require their separate applicable authority and gates.

No new API auth sweep, business role/delegation matrix, clinical/care semantics, Kernel/helper/guard/baseline/workflow change or production DML/DDL. Existing32-table/users/RPC containment stays in place. Do not force-push published histories, restore unsafe grants, copy credentials, provision production test identities, or claim deployed closure from source CI. Do not extend scope merely because a broad gate exposes unrelated debt.

## Acceptance

- Given the existing remote delivery refs and latest main, when synchronizing ancestry by ordinary merge, then preserve exact old branch tree and source blobs, use the actual configured commit hook, and produce a PR diff containing only the original scope.
- Given owner continuation and two separable security changes, when creating draft PRs, then target main, attach both to this chat and describe actual behavior, intentional degradation, tests and unresolved gates accurately.
- Given a failing applicable check, when investigating it, then classify root cause with actual logs; fix introduced defects within scope, verify them and retain honest pre-existing/environment/contract limitations. Never edit protection controls to make this patch pass.
- Given an unchanged source/tree, then reuse prior verification rather than repeat it without cause. Verify changed behavior again if a real fix alters the source.
- Given final status, then report exact PR heads, actual check conclusions, production source still undeployed, authenticated regression/RBAC/RLS/Go-Live gaps separately. No merge/release success claim.

</frozen-after-approval>

## Tasks & Acceptance

- [x] Fresh remote branches/PR/run/ruleset discovery; preserve actual404 classic-protection response versus active ruleset21221290.
- [x] Correct ancestry in both clean delivery worktrees; prove exact tree/source preservation and bounded three-dot diff; normal push and remote SHA check.
- [x] Reuse owner-created ready PRs405/406, update bounded descriptions and attach them; collect actual current-head CI results. No duplicate PR or draft-state change.
- [x] Resolve applicable delivery failures with actual checks; no new runtime patch required. Unchanged font and AutoMove retries passed; preserve original failures and NOT_PROVEN causes. No unrelated control/business change.
- [x] Seal delivery evidence and update current status without rewriting historical audit snapshots. Owner independently merged both PRs; automatic production deployment is QUEUED and new-main CI/production HTTP proof remain separate pending gates.

## Canonical sources / verification

Common/Git/Education/Healthcare constitutions already read; no source semantic change is selected merely by Git ancestry repair. Shared identity authority and temporary holds use Batch2C approved contract; Courses binding/session/RLS behavior uses Batch2B approved scope. Prior PostgreSQL/live ACL evidence remains separately scoped. Existing source tests80/80, scoped typecheck/lint/secret guard and independent reviews remain tied to the sealed source blobs; source CI/current merge head verification must be real. Ruleset21221290 currently requires four Architecture Gate checks; classical branch-protection API returns404, which does not mean absence of the active ruleset. No controls are modified.
