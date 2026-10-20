# Factory follow-up scoped gate

Decision: PASS for authorized development tooling only. Goal: one real end-to-end coding run, not default routing/main/Go-Live proof.

Authority: user reopened CLOSED/LOCAL_PARTIAL as a successor batch; prior local-commit permission persists. No new runtime framework, Product, kernel, registry, DB/migration, RLS/auth, sandbox, CI workflow, remote Git publication or production changes. Scope is the existing agent-flow tooling and the new task record. No migration required: NOT_APPLICABLE. Specialized vertical gates NOT_APPLICABLE for unchanged verticals; preserve freezes.

Ownership: native runtime owns lifecycle/history; unchanged store owns canonical persistence; companion metadata links original sources; pure Monitor reads only. Parent does not implement the native task's two owned files. Reviewer receives no Builder conversation.

Current mandatory governing source is the approved Constitution at a8b6c98c51642b4ccf0d1574c13b57cc4934a369 and current user AGENTS. Copy its existing canonical AGENTS/CLAUDE/Constitution bytes into this old isolated worktree so all native roles read the actual governing source. This is source synchronization, not new policy drafting. Keep 5ad15661 and 36a57668 as historical provenance only.

Minimal control correction explicitly required by owner: canonical pipeline must not dispatch Reviewer after Verify FAIL. This strengthens the actual control and is independent of the new task's legacy counter parser (the canonical pipeline uses separate protected role-validation counters). No admission/sandbox/guard bypass is authorized. Verify success remains mandatory and tested.

Expected semantics are evidence integrity: six unique safe integer counters with a consistent sum; ambiguous/contradictory summaries cannot be treated as evidence. Canonical counterpart role-validation already embodies this invariant; user evidence requirements and companion contract establish authority. Baseline repro demonstrates reachable incorrect parsing in legacy consumers, independent of any new test assertion.

Required checks: exact provenance/source hash; scoped admission/role isolation; failed Verify stops before Reviewer; pure-suite baseline/repro; actual four native stages; successful durable evidence + fresh readback; exact Git path/mode/blob content and full inventory comparison; same-run browser and read-only Monitor; negative missing/corrupt/scope/commit drift; preserved historical package hashes. Report actual execution counts and environment separately. Historical STORE_WRITE_FAILED cause stays NOT_PROVEN; store/contract unchanged.
