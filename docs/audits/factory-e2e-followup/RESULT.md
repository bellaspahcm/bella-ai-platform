# Factory follow-up — real end-to-end run

Date: 2026-10-20. Runtime result: **PASS for this bounded tooling task**. Final source review and current-code storage-negative replay are being completed; no remote publication is authorized.

## Identity and acceptance evidence

- Task: `bf4f2ae7-33d4-4425-a566-804c268c85af`.
- Factory run: `54679318-68cd-4085-97e6-e3953ba5cccc`.
- Package: `C:\Users\DELL\.codex\agent-flow-evidence\bella-agent-flow-luXG6S`.
- Intake source T: `cb485d046763be22e136b490b4369c357f833109`; candidate `3ca7f5f0709da841b77c5c3c08207ad04d18c4d5123f4310f28b9de05578d6de`.
- Verified coding commit C: `f5983f7c25c573131f80f30f8bac562f9466699c`. Exactly two owned files; its parent is T. Later audit-only commits are separate from C.
- Lead ACCEPT, Builder DONE, native Verify **15/15 PASS**, independent native Reviewer PASS. Four distinct threads, zero revision loops.
- Fresh-process canonical readback: PASS, four source/payload MATCH checks, exact bindings and original receipt hashes.
- Canonical commit linkage: PASS_CANDIDATE_COMMIT_CONTENT. Actual parent tree, exact changed paths, regular-file modes, Git blob OIDs/bytes, worktree byte hashes and whole source inventory agree.
- Monitor: PASS_SAME_RUN_MONITOR_BROWSER on the same task/factory/native IDs, candidate evidence and C. Desktop/mobile, refresh and reload verified; anonymous 401, mutation method 405, zero page errors or horizontal overflow. It reads retained artifacts only; no native query or store.read by viewer.

## Meaningful coding change

The existing legacy testCounters parser accepted duplicate labels and inconsistent totals, allowing ambiguous output into projectHistory/task-reader/real-filechange evidence. Baseline reproduction was saved before coding. Native Builder modified only task-workflow.mjs and task-workflow.test.mjs; six original tests remain, with regressions for duplicated/missing/malformed/unsafe counters, totals, formats and boundaries. Its pure suite genuinely fits the existing read-only Verify sandbox. The old filechange tests that require TEMP writes were not weakened or skipped.

## Repairs needed to execute the workflow

1. Strengthen canonical dispatch to stop before Reviewer when Verify is not green, as explicitly required by the owner. Separate unit tests prove legitimate PASS and rejected FAIL. The native task cannot edit this protected driver.
2. Adopt AGENTS/CLAUDE/Constitution verbatim from approved governance commit a8b6c98c51642b4ccf0d1574c13b57cc4934a369 (PR395); no new Constitution was drafted. Preserve historical audited main 5ad15661 and old unmerged candidate 36a57668 as distinct provenance.
3. Native payload failures were retained as HELD, never resumed. Hash-only diagnostics isolated command output differences. Bounded policy reads preserve the full text when concatenated (six chunks, maximum 22,709 bytes).
4. The bounded-read retry exposed the actual UTF-8 transport defect: Buffer.toString called separately on pipe chunks corrupted a split multibyte character. A real child-process RPC fixture was RED (0/1) before a minimal StringDecoder fix and GREEN afterward. Fresh native history of the 20KB failed command now has zero replacement characters and exactly matches its original live hash. No native fact/package was rewritten. The separate large-output mismatch was not fully explained by this decoder fix; policy reads remain bounded, with strict equality retained.

Failed successor runs: 73aaa1d6 / 96c7c6da (Lead); 7b8ba89d / 4c3342e2 (Builder); 2020342e / 0d3e534e (Lead). Their packages 2E3T9o, 5LpJWO and pzz5r3 stay HELD. The unaccepted Builder patch from the second run was backed up byte-for-byte before restoring only its two files to the clean baseline for a new task. No old run was backfilled or resumed.

## Negative checks and wider verification

- Three actual alternate Git commits with the same parent and owned paths but different bytes, executable mode or deletion were rejected by the canonical commit-link command. Worktree/branch C stayed unchanged. Add/delete/mode comparison also has real disposable Git fixtures.
- Missing and corrupt candidate evidence on controlled copies of the positive run cause MISSING/CORRUPT with validation HELD; the original execution outcome remains PASS as a retained source fact. Expired copies hide their contents. Original packages were not mutated.
- A forbidden Product-scope task is rejected by current canonical intake before any native dispatch or Factory ID allocation.
- Operator Jest wrapper ran 134/134 Node tests, no failures/skips/todo/cancelled; lint exit 0 with existing environment warnings only. These are separate from the native 15/15 Verify result.
- Prior actual controlled STORE_WRITE_FAILED negative is retained; a fresh replay on current code is pending. store.mjs and contract.mjs remain unchanged. The historical unexplained store failure still has root cause NOT_PROVEN.

## Limits

FACTORY_END_TO_END is demonstrated only for the named development task and environment. FACTORY_DEFAULT_EXECUTION, SEALED_ON_MAIN and GO_LIVE remain NOT_PROVEN. No sandbox expansion, store rewrite, Product/Core/kernel/registry/DB/migration/RLS/auth/CI workflow/deployment change. No push/PR/merge. Multi-Agent default remains off; native stages are sequential. Static implementation reviews follow the existing QA skill and carry no write authority.

Operator evidence: `C:\Users\DELL\.codex\delivery-evidence\factory-e2e-followup-20261020`. Runtime sources stay in their original private packages and retention windows. Audit manifest and final review/storage results will be appended without rewriting historical runs.
