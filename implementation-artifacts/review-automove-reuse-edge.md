# AutoMove reuse — edge review handoff

Earlier edge agent errored with a usage limit before a final verdict. Its progress
message is not PASS. This prompt preserves the dependency; it is not a review.
Run only when independent agent execution is available; do not bypass limits.

Use `.agents/skills/bmad-review-edge-case-hunter/SKILL.md` with no conversation
context. Read the complete final cumulative diff:
`D:/Bella-AutoMove-MVP-Evidence/20261023-bb7007e-01a1690f/platform-reuse/delivery-candidate.diff`.
Verify SHA256 against evidence.json. Read-only project access is permitted at
`C:/Users/DELL/.codex/worktrees/automove-mvp-ui-db-complete-20261023/BELLA SPA ERP`.
Trace browser client lifecycle, all service acquisitions, stale/failed UI reads,
upload completion/refresh, auth-session changes and synthetic SDK test boundaries.
Distinguish newly introduced defects from unchanged reorder/first-step error
handling; do not claim RLS, Storage, real DB or full Product readiness from unit
evidence. No edits, test/runtime/network/DB execution or secret/environment reads.
Write a final findings report with concrete paths/lines and explicit limits.
