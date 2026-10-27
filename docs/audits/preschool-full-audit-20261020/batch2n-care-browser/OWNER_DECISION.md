# Two bounded owner decisions — Care browser blockers

Status: **PENDING**. Current UI corrections and exact6 E2E verification remain authorized; their authority is not being requested again. No production changes.

## 1. Shared proxy: exact Care cache contract

Actual local production401 is `no-store, must-revalidate`, although the route contract requires `private, no-store`. `src/proxy.ts` overrides it. Review-only patch: `PROPOSED_PROXY_PRIVATE.patch`; it applies only to exact `/api/education/care/bulk`, including Supabase cookie refresh set/remove. The source file is unchanged. `proxy-proposal-tests.json` records30 unit cases PASS, including anonymous/authenticated simulations, refresh/remove and unchanged public/webhook/other API behavior. These are candidate unit tests, not runtime proof.

Requested authority: apply and verify this exact patch as a separately scoped security-header correction. If the new Care classes endpoint in decision2 is approved, extend the exact allowlist by `/api/education/care/classes`, update negative tests and prove both paths in the real local production runtime. No wildcard policy or auth bypass.

Why independent approval is required: `BELLA_AI_CODING_CONSTITUTION.md`, **Protection Changes Require Independent Authority**, states: “Protection changes require approval independent of the feature they protect”. This is a shared security-header policy correction, beyond the Product-only UI repair.

## 2. Canonical Course catalog: architecture gap

Review `ACR_COURSE_CATALOG_READ.md`. The API's legacy projection conflicts with the actual shared Training table, while the existing public Course contract uses that same legacy model. The proposed fix adds only a read-only canonical contract (two named Education files) and a Product Care classes endpoint, using existing branch-access producers and the approved matrix. It does not modify either Course table or provision teacher assignments.

Requested authority: owning architecture review of that ACR, then the required ADR/exact unlock/implementation/reseal sequence. Education Constitution sectionI says the directory “is frozen after E1”; sectionIV Law11 requires `ARCHITECTURAL GAP DETECTED`. No frozen code will be changed merely because the browser test is blocked.

Recommended decision: approve both exact proposals and their verification sequence. Alternative: approve only the proxy; keep the catalog/Browser save dependent work held. Production and Go-Live remain independent gates in either case.
