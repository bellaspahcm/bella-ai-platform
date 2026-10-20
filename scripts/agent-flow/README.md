# Bella Agent Flow development tooling

## Factory companion evidence (local implementation candidate)

`role-pipeline.mjs run <owner-task.json>` remains the coding entrypoint. New runs
require a clean isolated source baseline and publish immutable intake/terminal
companion indexes linking a workflow UUID to original role receipts and facts.
See `FACTORY_EVIDENCE_CONTRACT.md`. Native lifecycle schema is unchanged.
After a successful native `read` in a fresh process, an authorized local task
commit may be checked with `node scripts/agent-flow/role-pipeline.mjs commit
<private-evidence-directory> <full-commit-sha>`. This verifies parent tree,
exact changed paths, file modes and Git-filtered blob bytes against the candidate
observed by Verify/Reviewer. It never creates a commit, PR, merge or deployment.
The Monitor under `scripts/agent-flow-dashboard/` reads inert package files only;
it never invokes `readNative`, store operations, cleanup or AppServer.
Historical STORE_WRITE_FAILED remains NOT_PROVEN: one new read-only Lead diagnostic
did not reproduce it (15 live facts / 7 matches), and the human explicitly allowed
C/D to continue while keeping the store unchanged. Safe new failure observations
are companion artifacts, not reconstructed native events.

This directory integrates the existing managed-task lifecycle proof into source control. It is development tooling, not a continuously running orchestration service. It does not observe existing Desktop sessions, provide a dashboard, deploy products, or prove production readiness. Delivery review additionally fixed complete reconciliation scope, order-independent store bindings and single-clock retention calculation; the retained runtime package remains the historical pre-delivery proof.

## Verified scope

One new managed Codex AppServer task changed one reader file, ran the existing10 tests successfully, and emitted a native fileChange. Canonical persistence retained live start/completed plus a history snapshot. After the writer exited, an independent Node reader verified21 acknowledgements and1/1 fileChange reconciliation against freshly queried native history. Earlier task/package seals remain separate. Baseline source revision49f78e358817bb3991f699cc678204a3bd5ea8f9 was the proof's starting revision, not a merged/deployed commit.

The retained proof is local/private, outside Git: `%USERPROFILE%/.codex/agent-flow-evidence/bella-agent-flow-dDO9jU`. Its manifest SHA-256 is `21fbc699a448e52e1dca9f4c449ef12094a0c08ee29fac68c4ea3d057f4ff1d4`; expiry2026-10-22T06:20:03.253Z. Review requires access to that package; hash equality alone is not runtime authenticity. No raw evidence or credentials are committed. Package paths and expiry are historical references, not automatically available artifacts on another machine.

## Code and authority

- `contract.mjs`: canonical minimized lifecycle schema, identity, digests, dedup keys and reconciliation; fileChange stores identity/status, no paths/patches/content.
- `store.mjs`: private bounded filesystem store, write/sync/rename, persistence acknowledgements and operation-time retention.
- `authority.mjs`: actual GitHub actor and existing BDGF dev-admin policy. Tenant administration does not grant telemetry access.
- `filechange-reader.mjs`: immutable canonical readback. No source history query, rewriting or purge.
- `probe.mjs`, `completion.mjs`, `readback.mjs`, `task-workflow.mjs`, `task-reader.mjs`, `real-filechange.mjs`: bounded historical proof commands. These are not generic task launchers. Task inputs, owned paths and baseline are fixed. **Do not rerun completed coding tasks on merged main**; a new runtime task needs its own approved scope. `real-filechange.mjs --read` additionally checks the original full workspace inventory, so it belongs to the original sealed worktree.

The store survives process restart; power-loss durability is not claimed. Metadata maximum14days, allowlisted output maximum7days; retained companion packages expire no later than7days. Physical cleanup is operation-time or owner-triggered; no unattended purge service is installed. Windows persistence/ACL behavior was tested locally. CI uses protocol fixtures, not live Codex sessions or production access.

## Tests and merged-code readback

```powershell
node --test scripts/agent-flow/agent-flow.test.mjs scripts/agent-flow/task-workflow.test.mjs scripts/agent-flow/filechange.test.mjs
node node_modules/jest/bin/jest.js src/__tests__/agent-flow-tooling.test.ts --runInBand
```

The Jest adapter runs all52 Node tests (45 original plus7 delivery-review regressions) and rejects failures/skips/cancellation/todo; this lets the existing changed-file CI discover them without changing workflows. It does not launch Codex or create runtime evidence.

To verify the merged reader against the retained real package, from the merged checkout with an authorized `gh` session:

```powershell
node scripts/agent-flow/filechange-reader.mjs "$env:USERPROFILE/.codex/agent-flow-evidence/bella-agent-flow-dDO9jU"
```

This verifies persisted real facts using merged code. It does not execute a new task, prove continuous operation, or independently query native history; the retained reader artifact documents the earlier fresh-source reconciliation. Do not infer `REALTIME_ORCHESTRATION = PASS` from merge, CI or readback.
# Bounded role pipeline MVP

`role-pipeline.mjs` adds sequential Intake → Lead → Builder → Verify → independent
Reviewer over the existing AppServer, canonical contract and DevelopmentStore.
One actionable REVISE may run Builder → Verify → a fresh Reviewer once. Another
rejection, timeout, uncertain dispatch, scope drift or missing native evidence
ends HELD. There is no resume command and each task ID has a durable one-use claim.

From an isolated checkout, admit an Owner-authorized JSON task containing exactly
`taskId` (UUID), `sourceRevision` (HEAD), `goal`, `ownedFiles`, `testFile`,
`acceptance` (strings), `maxSeconds` (60–1800). This MVP accepts at most four
existing `scripts/agent-flow/*.mjs` task files; the running driver, collector,
authority, contract and store are protected. The selected Node test file must be
in the task scope. This restricted adapter is development tooling, not a general
untrusted task executor or a permission engine.

```powershell
node scripts/agent-flow/role-pipeline.mjs run <owner-task.json>
# After the writer has exited, query native history and store in a fresh process:
node scripts/agent-flow/role-pipeline.mjs read <private-evidence-directory>
```

The Verify command is exactly `node --test --test-reporter=tap <testFile>`, once
per candidate. Only complete non-skipped counters with zero exit may pass.
Reviewer has a fresh thread without Builder conversation and must read actual
diff, current source and the Verify output artifact. Final handoff requires the
same candidate fingerprint at Verify, review and fresh readback.

Role receipts are collector companion artifacts, not native lifecycle events.
Canonical store facts remain unchanged. Native thread/turn/item history and
actual command output/fileChange are reconciled separately. Private artifacts
use the existing seven-day operation-time review retention; no unattended purge
is claimed. Only scoped synthetic/development test output is retained, never
credentials or `.env` values. Inspect artifact sensitivity before publication.

Scope observations inventory tracked plus non-ignored source and reject symlinks.
Native sandbox modes constrain execution; the fingerprints are post-stage source
checks, not a host-wide command firewall or proof against malicious tasks.
No Product/DB/Auth/RLS/migration, remote probe, endpoint opening, automatic Git
publication, merge or deployment is performed. Pipeline PASS does not mean Go-Live.

Historical MVP task result (separate from the new Factory acceptance): **HELD / MVP NOT_PROVEN**. See
`docs/audits/agent-flow-mvp/agent-flow-mvp-evidence.json`. The first task reached
an independent Reviewer but did not produce an accepted handoff. Post-HELD
adapter fixes have unit/source verification only; no automatic task retry ran.

## Factory companion evidence

The scoped Factory publication and pure Monitor reader use `FACTORY_EVIDENCE_CONTRACT.md`. The current implementation/acceptance record is under `docs/audits/factory-evidence-flow/`; legacy results above remain historical.

After a PASS run and fresh native readback, an explicitly authorized operator may create a local commit containing exactly the verified changes and link it through the same entrypoint:

```powershell
node scripts/agent-flow/role-pipeline.mjs commit <private-evidence-directory> <full-local-commit-sha>
```

This compares the actual Git parent/tree/paths/modes/blob bytes and retained worktree fingerprint. It does not create, push or merge a commit. Monitor uses filesystem reads and pure validation only; `read` remains a separate operator action with native queries and store retention effects.
