# Batch2o independent review

Three fresh reviewers received no conversation context: blind hunter(diff only), edge hunter(diff and referenced producer source), acceptance auditor(diff/SPEC/ADR/authority/context). All were read-only; no reviewer executed tests, DB or network calls or supplied authorization. `REVIEW_CODE.diff` and `REVIEW_SOURCE.json` preserve their original input. Actual commands/results belong to the Lead's evidence.

## Findings and resolution

| Finding | Classification | Resolution |
|---|---|---|
| Inactive tenant assertion expected CARE_PRODUCT_ACCESS_DENIED, but the reused getCurrentUser producer returns null first | patch | Only harness expectation changed to403CARE_ACCESS_DENIED. Original failed native1 report/controller preserved. Current report now saves actual HTTP receipts immediately and even on failure |
| Header gate accepted substring matches rather than literal contract | patch | Raw Cache-Control retained; anonymous/catalog/browser gates require exact `private, no-store`. Both endpoint receipts required. Offline malformed `private="x", no-storex` case rejects |
| Catalog exceeds PostgREST row cap and deliberately returns503 | reject as implementation defect; documented availability limit | SPEC/ACR explicitly require incomplete/truncated data to fail closed, not pagination in this scope. No partial list or widened privilege results. Ordered pagination/large-catalog capacity is a separate capability decision; unit negative controls retain truncation rejection |

No runtime Product/contract defect was found in this review. Acceptance auditor confirmed minimal caller-scoped contract, canonical source, current role/branch intersection, strict counts/status checks, held teacher identity and exact proxy paths. Edge reviewer reread the two patched controls and returned `[]`. Blind reviewer saw only the original diff; no claim of independent post-fix inspection from that reviewer.

Additional Lead verification closes the already-specified same-session context gate: actual profile tenant reassignment rejects the old tenant selector, exact restoration returns its canonical class again, then the same runtime Browser gates execute. The new checks only mutate exact synthetic profile rows and restore in finally; no runtime/schema behavior changed.

Full regression/environment holds are not patched or waived by review. Owner ACR approval and manual exact unlock are separately recorded; no automated protection was changed. Reseal/merge/Go-Live cannot be certified from review or narrower tests.

## Supplementary recovery review

The edge reviewer read the exact recovery and independent poststate scripts/results against the actual checkpoint: no concrete safety defect; final output[]. Exact inactive/owned/terminated/Auth-absent guards and1-row deletion/residual0/catalog postconditions confirmed. The unused literal progress variable has no execution effect: the script selects the unique actual checkpoint by its exact run prefix. Original native1 remains unchanged. Reviewer performed only local source/artifact inspection, no executed verification.
