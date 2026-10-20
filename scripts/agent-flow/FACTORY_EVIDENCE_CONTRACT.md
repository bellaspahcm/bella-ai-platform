# Companion Factory evidence contract v1

Authority: the human-approved A → B → C → D scope recorded in `docs/audits/factory-evidence-flow/ARCHITECTURE_GATE_RESULT.md`. This is a development-tooling format, not an OS/Product public contract. It does not change `contract.mjs` lifecycle facts, digest rules or bindings.

## Identity and sources

One `factoryRunId` identifies the workflow; `taskId` identifies the single-use admitted request. Each stage refers to its original receipt and retains its independent native `runId/threadId/sessionId/turnId/producerInstanceId/attempt`. A metadata ID is not a native event. The coding entrypoint remains `role-pipeline.mjs run <owner-task.json>`.

An index has exactly `format`, `schemaVersion`, `repository`, `taskId`, `factoryRunId`, `provenance`, `intake`, `stages`, `terminal`, `candidate`, `commit`. The format is `bella-factory-evidence`, version 1. Every artifact reference has exactly `packageId`, `file`, `bytes`, `sha256`. File names are basenames, package IDs match the existing private package naming convention, hashes are SHA-256 of original bytes, and consumers verify size/hash before parsing. Missing or contradictory sources are errors, never generated defaults. `terminal`, `candidate`, `commit` may be explicitly null while not yet produced; this means incomplete evidence, never success.

Provenance contains the separately pinned `auditedMainRevision` and `constitutionCandidateRevision`, plus `rules`. Each selected rule records repository-relative `path`, exact `revision`, `sha256`, nonempty `sections` and `reason`. Revision/hash identifies the material the operator selected; it does not prove comprehension, effective activation or compliance. Baseline sources and an unmerged Constitution candidate cannot silently substitute for each other.

`intake` refers to original admitted task/source/scope. Each stage has `role`, `activity`, `receipt` and explicit `sourcePointer` (the whole document, or a receipts/results array entry). Activities are `PLAN`, `CODE_CHANGE`, `TEST_EXECUTION`, `READBACK_ONLY`, `INDEPENDENT_REVIEW`. Role/activity combinations are checked. A Controller's readback-only VERIFY may index Builder test references but cannot count as an independently executed test or satisfy the four-role pipeline acceptance. Legacy imports preserve original source/outcome and need explicit compatibility validation; they are not new executions.

## Derived information and missing data

All IDs, stage decisions, scopes, test counters and outcomes exposed to Monitor must derive from original artifacts with a recorded projection rule. The index contains no independent execution verdict. `validateIndex` proves shape only; `resolveArtifact` proves reference bytes only. Neither establishes runtime authenticity, successful native reconciliation, complete gate coverage or release authority. Consumers still check receipt bindings, facts/ACKs/history reconciliation, source fingerprints, test-command/output linkage and actual independent review under the specific producer contract.

Keep execution outcome, evidence completeness/accessibility, proof status and release decisions separate. HELD may be a valid complete recorded outcome. Missing source, corrupt bytes, expiry and unsupported formats must remain distinguishable. Never infer live events or ACKs from history, replay an old run, backfill a missing terminal, extend retention or import executable evidence content.

## Candidate and commit

The candidate reference must identify the exact source manifest observed by Verify and Reviewer. Every manifest entry records `path`, regular-file Git `mode` and `sha256` of a declared byte representation. The producer must document that representation, pin relevant filters/configuration and retain worktree byte hashes; normalization is not an implicit waiver. Compare the complete declared source set with the actual commit tree: path additions/deletions, file mode and bytes must match, with no extra source. A later commit cannot be proved by a branch name, SHA label or the old HEAD-containing fingerprint alone. A mismatch requires verification/review of the new candidate. No commit is invented when permission is absent.

Monitor's reader must use read-only filesystem operations and never call `DevelopmentStore.read()`, `readNative()`, cleanup or AppServer. Collection/verification writers may produce immutable companion artifacts before Monitor reads them. Preserve original package bytes and retention deadlines.

Retained-source checks bind the immutable intake identity, each package deadline, native result/command/change identities and exact admitted Verify/Reviewer commands. Candidate validation reconstructs the complete inventory from intake plus unique changes; its fingerprint must match the verified terminal. Fresh readback checks match every receipt's role, revision, complete binding, artifact hash, counts and MATCH payload. Monitor consumes pure validation modules only. An unset optional Git autocrlf value is explicitly `null`, not an invented setting.
