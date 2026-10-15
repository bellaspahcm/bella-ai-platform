# Bella Agent Flow development tooling

This directory integrates the existing managed-task lifecycle proof into source control. It is development tooling, not a continuously running orchestration service. It does not observe existing Desktop sessions, provide a dashboard, deploy products, or prove production readiness.

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

The Jest adapter runs all45 existing Node tests and rejects failures/skips/cancellation/todo; this lets the existing changed-file CI discover them without changing workflows. It does not launch Codex or create runtime evidence.

To verify the merged reader against the retained real package, from the merged checkout with an authorized `gh` session:

```powershell
node scripts/agent-flow/filechange-reader.mjs "$env:USERPROFILE/.codex/agent-flow-evidence/bella-agent-flow-dDO9jU"
```

This verifies persisted real facts using merged code. It does not execute a new task, prove continuous operation, or independently query native history; the retained reader artifact documents the earlier fresh-source reconciliation. Do not infer `REALTIME_ORCHESTRATION = PASS` from merge, CI or readback.
