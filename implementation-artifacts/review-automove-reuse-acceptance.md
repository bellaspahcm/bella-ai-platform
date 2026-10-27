# AutoMove reuse — acceptance review handoff

Earlier acceptance agent errored with a usage limit before a final verdict. This
prompt preserves the dependency and grants no additional authority. Independent
review is HELD; the spec remains in-review and no all-AC PASS is asserted.

Start with no conversation context and read:
- `D:/Bella-AutoMove-MVP-Evidence/20261023-bb7007e-01a1690f/platform-reuse/delivery-candidate.diff`.
- `implementation-artifacts/spec-automove-platform-client-reuse.md` and every
  frontmatter context document, including the common Constitution and Product gate.

Project root:
`C:/Users/DELL/.codex/worktrees/automove-mvp-ui-db-complete-20261023/BELLA SPA ERP`.
Read the complete diff; verify SHA256 against evidence.json. Check acceptance,
ownership, consumer reuse versus new capability, authority, unchanged frozen
intent and evidence applicability. General denial propagation has explicitly
PARTIAL evidence: reorder and multi-request first-step failures are not proven.
Do not silently narrow the frozen criterion or turn this limitation into PASS.
Confirm that source-level client correction is separate from browser integration,
effective RLS/tenant isolation, Storage, real persistence, RC and Go-Live.
Read-only source/diff/spec only; no mutations, tests, runtime/network/DB operations
or secret/environment reads. Return actual violations, acceptance status and limits.
