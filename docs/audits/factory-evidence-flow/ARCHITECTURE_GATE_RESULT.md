# Factory evidence flow — authorized tooling gate

Date: 2026-10-20. Decision: PASS for the bounded A → B → C → D implementation scope; runtime acceptance remains NOT_PROVEN.

## Authority and provenance

The human approved implementation in this chat, then explicitly authorized local commits. No push, PR, merge, release, CI/security policy, sandbox or production changes are authorized. Baseline main: `5ad15661f2dc2603881d50abdef17bcd7bc5fb20`. The separately committed Constitution candidate is `36a57668f5aba61da10d7c555dde2e6d01518a5b`; it is not represented as active on baseline main. Applicable baseline rules remain `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, the approved architecture foundation and Freeze Policy. No Constitution edit is part of this batch.

## Manifest, ownership and dependency

Development tooling only. One Lead owns implementation and integration; native Lead/Builder/Verify/Reviewer stages are sequential and independently bound. The existing `role-pipeline.mjs run <owner-task.json>` stays the coding entrypoint. Native AppServer owns events/history, DevelopmentStore owns persisted facts, metadata only indexes/verifies those sources, and Monitor is a read-only consumer. No Product, Core/kernel, ProductRegistry, DB/migration, tenant/auth/RLS change. No schema migration. No Product UI reconciliation is applicable.

## Change map and authority

A: add a versioned companion evidence contract and its tests/documentation; preserve lifecycle schema and event normalization. B: diagnose the original persistence gap using immutable retained artifacts and bounded disposable diagnostics, retain safe operation/error codes, and repair only a reproduced cause. Do not rewrite the store or synthesize missing live events/ACKs. C: admit the existing viewer source with a pure filesystem reader and format-specific provenance; no launcher/controller imports. D: one newly admitted tooling coding task, native test execution and independent review, immutable evidence, fresh readback, browser proof for that same run and byte/tree candidate–commit comparison. Negative tests never alter a sealed original package.

Owned paths: `scripts/agent-flow/` companion contract, native adapter, pipeline and directly relevant tests/README; `scripts/agent-flow-dashboard/` existing viewer and directly relevant reader/browser tests; `src/__tests__/agent-flow-tooling.test.ts` wrapper only if needed; this audit/spec directory. `store.mjs` behavior may change only after evidence identifies its failing operation/root cause. Protected driver/contract/store/authority remain forbidden to the acceptance task.

## Eleven verification gates

1. Exact baseline, approved scope and provenance. 2. Canonical contract rejects absent/contradictory sources. 3. Native bindings and facts unchanged. 4. Persistence failure diagnosed before a repair. 5. Safe errors contain no raw stderr, prompts or credentials. 6. Original retained packages remain byte-identical. 7. Monitor performs no writes, cleanup, native query or executable-package import. 8. Typed execution versus readback, HELD/missing/corrupt/expired behavior. 9. New task, exact test command and fresh independent Reviewer on the same candidate. 10. Fresh readback plus same-run browser and content/tree commit linkage. 11. Negative missing-evidence, scope and storage failures, final scope/diff review.

Each phase needs evidence before advancing. The new one-Lead diagnostic completed with 15 live facts / 7 history matches / zero source changes and did not reproduce the historical failure. The human explicitly authorized continuing C/D while keeping the store unchanged and the historical root cause NOT_PROVEN. This exception does not claim a persistence repair. A successful test of a different injected failure does not prove the historical cause. No implicit task retry/resume or permission change. A local Factory run cannot establish default routing or SEALED_ON_MAIN/Go-Live.
