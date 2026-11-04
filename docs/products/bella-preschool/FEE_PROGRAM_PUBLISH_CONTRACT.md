# Bella Preschool Fee Program Publish Contract

**Status:** ACCEPTED DESIGN; LOCAL RUNTIME CANDIDATE; PARTIALLY VERIFIED
**Owner:** Bella Preschool Product
**Date:** 2026-11-03
**Workstream:** Education Fee Program, separate from F01 implementation

This is the single Product-owned source for publishing and resolving Bella Preschool fee programs. The Product Owner accepted the design on 2026-11-03 and separately authorized a scoped Local/Test runtime candidate. Runtime authorization does not decide the explicitly unresolved business policies or authorize Production changes or F01 use. This document distinguishes source implementation from Local/Test runtime verification.

## 1. Purpose and boundaries

The contract defines immutable published fee references and the service-period decision needed to resolve a Preschool fee assessment. It supplies fee facts to a later Finance-owned charge contract; it does not create invoices, receivables, payments, journal entries, or revenue recognition.

| Capability | Owner |
| --- | --- |
| Program definitions, fee-item definitions, versioning, publication, assignment, and fee calculation | Bella Preschool Product |
| Canonical Enrollment identity, status, and eligibility provenance | Education, through its public contract |
| Invoice, receivable, payment, settlement, reconciliation, and accounting treatment | Finance Platform |

This is Product behavior, not an Education Kernel capability. The [Education Constitution](../../architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md) explicitly places school-specific fees in the Product Vertical. The contract does not modify Education Enrollment contracts or tables. It does not select Finance account mappings or replace the Finance contract.

### Owner decision — exact Admission course mapping (2026-11-03)

The Product Owner has specified that Preschool tuition has multiple programs
for different classes. During admission, the selected Education Course is the
class placement used for tuition mapping. The canonical key is the exact
`edu_enrollments.course_id` referencing `edu_courses.id`, because the current
Admission flow selects and persists that identity through the Education public
contract. Do not map through `preschool_enrollments.classroom_id`: it belongs to
the separate legacy `preschool_classrooms` identity domain and no mapping
between those IDs has been proven.

Do not infer, override, or validate the selected Course from date of birth; a
family or school may place a child in a class above or below the child's age.
The selected Course must resolve to exactly one applicable published Program
Version for the trusted tenant and approved effective context. Missing mapping
or multiple matches fails closed; never choose the first active fee row. Later
publication must not silently change a prior Enrollment's linked version. This
decision supersedes the earlier `classroom_id` mapping proposal after the
Production schema and Admission source were reconciled.

Whether an Enrollment may persist the Program Version link while its
billing-period policy is pending still requires an explicit Product rule before
implementation. A null policy remains `POLICY_PENDING`; it cannot authorize an
invoice, billing-period assessment, or payment. Publish-only runtime does not
implement the Course resolver or Enrollment binding.

The contract covers configured fixed or recurring fee items. Usage-based meal charges and extracurricular/event fees remain outside admission fee resolution. No price, discount, fee taxonomy, billing calendar, or accounting rule is supplied by this document.

## 2. Canonical records

| Record | Required meaning |
| --- | --- |
| Fee Program | Stable tenant-scoped identity for a Preschool fee program. The proposed lifecycle is ACTIVE or ARCHIVED; archiving preserves historical versions and bindings. |
| Fee Program Version | Immutable version of one Fee Program. It carries tenant, program scope, version identity, applicability, publication state and provenance, effective applicability, an exact set of included Fee Item Version IDs, and either one pinned Billing Period Policy Version ID or an explicit pending-policy state. |
| Fee Item | Stable tenant-scoped identity for a fee item across revisions. |
| Fee Item Version | Immutable version of one Fee Item. It carries the Fee Item ID, version identity, tenant, fee-type code, amount and currency when applicable, unit and billing basis, effective applicability, and publication provenance. Program membership is a reference from a Fee Program Version; it is not a parent field on the Fee Item Version. |
| Billing Period Policy Version | Immutable, published rule version pinned by a Fee Program Version. It resolves service-period identity and dates and the due-date decision; it does not independently select a Fee Program Version or Fee Item Version. |
| Enrollment Fee Binding | Product-owned immutable reference from an accepted canonical Enrollment to the exact Fee Program Version, selected Fee Item Versions, and Billing Period Policy Version used for that commitment. This is not a field or write to an Education Kernel table. |
| Fee Period Assessment Snapshot | Reconstructable Product-owned snapshot for a service period containing the exact version references and economic facts used. It preserves history when later versions are published. Its eventual persistence location is an implementation decision; it must not be placed in Education Kernel tables. |

Stable IDs identify programs and items across revisions. Version IDs identify immutable snapshots. A Fee Program Version defines membership by referencing exact Fee Item Version IDs. The same published Fee Item Version may be referenced by more than one Fee Program Version within its tenant when its effective applicability and compatibility permit; a program revision does not by itself require recreating unchanged Fee Item Versions. If an item fact changes or an existing version is not compatible with the new program context, create a new Fee Item Version and preserve the prior version for historical reconstruction. A resolver must reject an item ID that is not included in the exact Fee Program Version being resolved.

Only a valid PUBLISHED Fee Program Version, its included PUBLISHED Fee Item Versions, and the exact valid PUBLISHED Billing Period Policy Version pinned by that Program Version may be resolved for a new binding. Drafts are never a pricing source. PUBLISHED means immutable and eligible for applicability evaluation; it does not mean the version applies to every Enrollment.

Fee Program Versions and Billing Period Policy Versions use the proposed publication lifecycle DRAFT → PUBLISHED. A Fee Item Version becomes PUBLISHED when first included in a valid published Fee Program Version; after publication it remains immutable and may be reused by another Program Version only when tenant, effective applicability, and compatibility rules permit. Program Version membership and its pinned Billing Period Policy Version are frozen at publication. A change to policy facts requires a new Billing Period Policy Version; a Program Version that uses it must also be newly published, unless a separate change mechanism is approved by the Product Owner.

On 2026-11-03 the Product Owner approved publication of fee configuration before the billing-period policy is configured. A Program Version may therefore publish with no policy reference; this means `POLICY_PENDING`, never a fabricated published policy. It cannot be used for a new fee assessment or binding, and resolution returns `POLICY_NOT_DEFINED`. Once a valid policy is available, publish a new Program Version that pins it; do not alter the earlier published version.

### Proposed Program lifecycle

- ACTIVE programs may be considered for a new resolution when their published versions and applicability also match.
- ARCHIVED programs are excluded from new bindings. Existing bindings and period snapshots remain readable and unchanged.
- Reactivating an archived program and withdrawing a published version are not defined. Do not infer those operations from a status change.

## 3. Publication and immutability

1. Draft versions may be edited before publication.
2. Publishing records the authenticated publisher or identified system actor, publication time, tenant, version identity, applicability, exact included item references and either the billing-policy reference or its explicit pending state.
3. Publishing a Fee Program Version publishes any included Fee Item Versions that are still DRAFT. An already PUBLISHED Fee Item Version may be reused without creating a duplicate version when the new Program Version's applicability and compatibility rules permit it.
4. Publication freezes the Program Version, its exact Fee Item Version membership, its pinned Billing Period Policy Version, and all included version facts. A change to program scope, item membership, policy reference, or applicability requires a new Program Version. A change to an item's economic or applicability facts requires a new Fee Item Version.
5. A published version used by an Enrollment Fee Binding or Fee Period Assessment Snapshot remains readable for historical reconstruction.
6. A later version must not reprice an existing binding or overwrite a prior period snapshot.
7. A withdrawal, revocation, or retroactive correction policy is not defined here. Until an owner-approved rule exists, the resolver must not infer how such a change affects new or existing bindings.
8. Publisher identity is derived by the owning server boundary from Auth, or from a specifically identified service actor. It is never accepted from a browser-supplied actor field.

The Product Owner selected authenticated tenant Admin and Super Admin actors for publication. Runtime derives the actor and tenant from Auth and the active `public.users` profile; a caller-supplied actor, tenant, or role is not authority. The current candidate keeps Super Admin tenant-scoped. Reactivation behavior, version numbering convention, and withdrawal semantics remain open decisions; a database status column alone does not settle them.

For fixed monetary fees the Product Owner requires a nonempty fee name, a valid fee type, a finite nonnegative amount and a valid currency before publication. Each tenant's Admin/Super Admin creates and maintains its own fixed-fee type codes; no fee types, amounts, or default currency are seeded. An unregistered or inactive code is rejected. Codes remain stable; names and active status may change, while published Fee Item Versions retain fee and type-name snapshots. The current Local/Test candidate validates currency against the SIX ISO 4217 List One snapshot published 2026-09-17 (codes with numeric minor units); maintaining that reference data as ISO changes is a release responsibility. Missing policy may remain pending, but an incomplete fixed fee cannot be published.

## 4. Resolver contract

### Input

The owning server boundary supplies:

- Trusted tenant identity derived from the authenticated context.
- Canonical Education Enrollment identity, its `course_id` Course placement, and eligibility provenance, obtained through the Education public contract.
- Requested Fee Item Version IDs (requestedFeeItemVersionIds), if the Product workflow allows item selection. These are candidate identifiers only, never prices or totals; the resolver validates their membership and applicability.
- Explicit effective-date context, including the date value, the selected date basis, and provenance identifying its canonical source record and version. The selected basis must come from an approved Product rule; the resolver does not choose one implicitly.
- Explicit service-period context, including the canonical requested service-period identity or basis and provenance identifying its source record/version. The pinned Billing Period Policy Version derives the service-period start/end and due-date decision from this context; callers cannot supply arbitrary dates as authority.

The effective-date context must not silently default to the current date, request timestamp, or a date inferred by the resolver. The caller must supply the canonical Enrollment acceptance date and the canonical service-period context needed by the approved applicability rule, each with provenance. The exact rule choosing which date basis controls Fee Program Version applicability remains unresolved. If acceptance date and service-period start lead to different candidate versions and no approved rule selects the controlling basis, return POLICY_NOT_DEFINED; if multiple candidates remain under an approved rule, return AMBIGUOUS.

The resolver must not accept client-supplied amount, currency, discount result, due date, actor, or tenant as authority. Where the caller provides requested item IDs, the resolver verifies their membership and applicability. Which items are mandatory, optional, or selectable is not defined here; unresolved selection rules return POLICY_NOT_DEFINED.

### Resolution rules

1. Validate the Enrollment reference and tenant through the canonical Education public contract. A status value by itself is not eligibility evidence. Missing or untraceable provenance returns INVALID_ENROLLMENT_REFERENCE.
2. Evaluate only PUBLISHED Fee Program Versions whose explicit applicability rules match the trusted tenant, the exact canonical Enrollment `course_id`, and caller-supplied, provenance-backed date contexts. PUBLISHED alone never makes a version universally applicable. Missing applicability criteria return POLICY_NOT_DEFINED; unresolved or overlapping matches return AMBIGUOUS. Never choose the first active or published version.
3. Determine the controlling effective-date basis only from an approved Product applicability rule. Do not use current date or request timestamp. If no approved rule resolves differing acceptance and service-period dates, return POLICY_NOT_DEFINED.
4. Resolve only Fee Item Versions included in the exact Program Version and effective/compatible for the same context. Never select the first active fee structure or use a seed/default price.
5. Validate the exact Billing Period Policy Version ID pinned by that Program Version. Do not independently select a different policy from request context. A version published with policy pending returns POLICY_NOT_DEFINED; a broken, unpublished, or inapplicable reference fails with the corresponding NOT_FOUND, NOT_PUBLISHED, or NOT_EFFECTIVE outcome.
6. Derive service-period dates and due-date decision using the pinned policy and canonical service-period context. Return a result only when program, items, policy, service period, due date, and effective-date decision are uniquely determined from their canonical sources.
7. Preserve the source version IDs and provenance needed to reproduce the resolution. Repeating the same request against unchanged canonical versions returns the same resolution.

The contract does not define effective-date interval inclusivity, which date basis controls Program Version applicability, a default service-period anchor, billing frequency, proration, holiday or weekday handling, mid-cycle repricing, or due-date arithmetic. If any is required to produce a result and no approved policy defines it, return POLICY_NOT_DEFINED.

### Result

A RESOLVED result contains exactly one deterministic set of:

- Tenant and canonical Enrollment IDs.
- Fee Program Version ID.
- Selected Fee Item Version IDs.
- Billing Period Policy Version ID.
- Service-period identity, start, and end.
- Due-date decision and resolved date.
- Effective-date decision and its canonical source.
- Publication and applicability provenance for the program, items, and policy.
- Economic-fact snapshot for each selected item, including amount/currency and unit/billing basis when defined.

The public result field names are **feeProgramVersionId**, **feeItemVersionIds**, **billingPeriodPolicyVersionId**, **servicePeriod**, **dueDateDecision**, **effectiveDateDecision**, and **sourceProvenance**, alongside tenant and Enrollment identity and the resolved economic-fact snapshot. The proposed servicePeriod shape is identity plus start/end dates; dueDateDecision and effectiveDateDecision each carry the resolved value, policy/version reference, and source; sourceProvenance identifies the canonical Enrollment eligibility result and the published Program, Item, and Billing Policy versions used.

The result contains no accounting account, journal, payment, or revenue-recognition decision.

### Outcomes

| Outcome | Meaning |
| --- | --- |
| RESOLVED | Exactly one valid published program, item set, period policy, and deterministic assessment were found. |
| NOT_FOUND | No candidate source exists for the trusted tenant and Enrollment context, or a referenced policy record cannot be found. |
| NOT_PUBLISHED | A candidate exists but is not published. |
| NOT_EFFECTIVE | A published program, item, or pinned policy does not apply to the resolved effective-date/service-period context. |
| AMBIGUOUS | More than one candidate or decision remains applicable. |
| INVALID_ENROLLMENT_REFERENCE | The canonical Enrollment or required eligibility provenance is missing, mismatched, or invalid. |
| POLICY_NOT_DEFINED | A required business decision or source field is unresolved. |

All outcomes other than RESOLVED fail closed: no binding or financial charge may be reported as successful.

## 5. Enrollment binding and historical facts

An accepted Enrollment Fee Binding stores immutable references to the Fee Program Version, selected Fee Item Versions, Billing Period Policy Version, Enrollment, tenant, acceptance time, and trusted accepting actor. It is Product-owned. The canonical Education Enrollment contract remains unchanged unless a separate review proves a minimal extension is necessary.

Each service-period assessment stores the resolved version references and a reconstructable snapshot of the economic facts actually used. Correcting a prior assessment must be represented by an additive correction record under a future approved policy; it must not overwrite the original binding or snapshot.

The exact binding and snapshot persistence artifacts are not defined by this documentation-only contract. No schema or migration is authorized here.

## 6. Source mapping and non-authoritative legacy behavior

The three requested source documents — EDUCATION_FEE_PROGRAM_PRODUCT_DEFINITION_PROPOSAL.md, EDUCATION_FIXED_RECURRING_FEE_CONTRACT_DESIGN_PROPOSAL.md, and EDUCATION_FEE_PROGRAM_FINANCE_CONTRACT_GAP_REVIEW.md — are not present in this worktree. The existing [Education Finance P1-P4 proposal](../../education/EDUCATION_FINANCE_P1_P4_PRODUCT_DEFINITION_PROPOSAL_V1.md) and [product-definition gate](../../education/EDUCATION_FINANCE_PRODUCT_DEFINITION_GATE.md) are broader Finance policy-space documents, not a canonical Bella Preschool fee publisher or resolver. They now point to this Product-owned contract.

The existing [Preschool TuitionBillingService](../../../src/products/bella-education/finance/services/tuition-billing.service.ts) is implementation evidence, not the source of fee truth. It selects the first active TUITION structure, accepts billing period and due date from its caller, and calculates from mutable active discount profiles. This contract does not bless those behaviors as the canonical resolver. The [Education Finance responsibility matrix](../../education/EDUCATION_FINANCE_RESPONSIBILITY_MATRIX.md) is historical context; this Product-specific contract controls only after Product Owner acceptance.

## 7. Explicitly unresolved decisions

- Whether an Enrollment may persist its immutable Program Version link while the pinned Billing Period Policy is pending; billing and assessment remain blocked in either case.
- Required versus optional Fee Item selection and who may make that selection.
- Effective-date anchor and interval boundary semantics, including how the approved rule selects between Enrollment acceptance date and service-period context when they differ.
- Applicability taxonomy and matching rules for each published Program Version; PUBLISHED never implies universal applicability.
- Compatibility rules governing whether a published Fee Item Version can be reused by another Program Version.
- Billing frequency, service-period anchor, due-date rule, calendar exceptions, proration, and mid-cycle fee changes.
- Discount, scholarship, waiver, and correction representation and provenance.
- Fee-type vocabulary, units, currencies, tax facts, and amounts for actual programs.
- Published-version withdrawal and retroactive correction behavior.

These decisions are NOT_DEFINED until an authorized Product Owner source closes them. The resolver returns POLICY_NOT_DEFINED where they affect a result. No seed value, legacy default, or client choice closes them.

Finance accounting treatment, pre-service payment handling, invoice and receivable contracts, and revenue recognition continuation are explicitly outside this Fee Program contract and remain Finance-owned.

## 8. Runtime implementation and acceptance criteria

Runtime work is authorized only in the Fee Program worktree and Local/Test. It must demonstrate:

1. Draft, missing, unpublished, ineffective, cross-tenant, and ambiguous sources fail closed.
2. A valid context resolves exactly one applicable published Program Version, only its included Fee Item Versions, and the exact published Billing Period Policy Version pinned by that Program Version; no independent policy fallback is allowed.
3. Requested item IDs are verified against the exact program version; prices and totals cannot be supplied by the client.
4. Published versions and historical bindings/snapshots cannot be silently changed or repriced.
5. Service-period and due-date results have reproducible policy and effective-date provenance; absent applicability rules, unresolved date-basis conflicts, or a missing/unpublished/inapplicable pinned policy fail closed.
6. An invalid Enrollment or missing eligibility provenance is rejected through the canonical Education contract.
7. No direct write to Education Kernel or Finance tables occurs through Fee Program.
8. Real Local/Test persistence and readback prove version immutability, tenant isolation, deterministic resolution, and all fail-closed outcomes.

This acceptance list is a future verification plan, not execution evidence.

## 9. D2 state

- Design artifact: ACCEPTED (2026-11-03).
- Local source candidate: additive publisher schema/command and typed resolver boundary implemented in this worktree.
- Local/Test integration: PASS — 2 Jest suites, 9 tests against disposable stack `bella-f01-f3-auth-20261103`; Auth/PostgREST exercised Admin and Super Admin publication, denial for Staff/anon/service role, tenant isolation, incomplete fee rejection, readback, publish idempotency, immutable snapshots, item-version reuse, post-publication membership lock, publication with no policy reference, and fail-closed resolver behavior. The run verifies mechanics for synthetic fees, not the business applicability of actual tenant fees.
- Migration execution: five candidate migrations were applied directly to that disposable stack for the test run. They were not recorded in the Supabase migration ledger. Do not run `supabase migration up` on this stack until the separately identified legacy migration dependency is resolved.
- Resolver business result: `POLICY_NOT_DEFINED` until applicability, date-basis, billing-period, and canonical Enrollment eligibility provenance are available. No Enrollment binding or fee-period snapshot is written.
- Not proven: a successful business resolution, binding/snapshot persistence, or canonical Education eligibility verification.
- Runtime acceptance criteria in §8: NOT COMPLETE.
- F01 readiness: NOT ESTABLISHED.

The separate Education Finance Product Definition Gate remains scoped to general Education Finance capabilities and is not changed by this Bella Preschool Product acceptance. F01 may consume resolved fee references only after the resolver can verify canonical Enrollment eligibility and approved applicability/billing policy, and its persistence is verified on Local/Test; independent F01 dependencies remain in force.

## 10. Publish Runtime release boundary — 2026-11-03

- Catalog recheck on disposable `supabase_db_bella-f01-f3-auth-20261103`: the nine original candidate tables and the fixed-fee type catalog have RLS enabled. Both publish and resolver RPCs are owned by `postgres`; publish is `SECURITY DEFINER`, resolver is `SECURITY INVOKER`. Effective `EXECUTE` is denied to `anon` and `service_role` and allowed to `authenticated` for both. This is Local/Test evidence only.
- The disposable ledger has eight versions, from `20260814000000` through `20260815040000`; it contains none of `20260816020000`, `20261103090000`, `20261103100000`, `20261103110000`, `20261103120000`, or `20261103130000`. Both F1 posting and reversal functions exist, but their presence does not establish complete dependency history. The installed Supabase CLI documents `migration repair --status applied --db-url <explicit-db-url> <version...>` as a way to record selected versions. No repair was executed. Before any repair, verify exact database identity and that the complete applied definitions match the intended migration files; resolve the separately excluded legacy migration history. Never use the linked project or run a blanket migration-up as a substitute.
- Current migration `20261103090000` packages six publish tables and its publish command together with the resolver RPC and three binding/snapshot tables. Authenticated callers can execute the fail-closed resolver directly. Migration `20261103110000` adds the pending-policy behavior, and `20261103100000` locks membership mutations. Consequently the present files are not a publish-only release package. A publish-only candidate must separate or otherwise explicitly account for these objects and reverify the resulting migration and upgrade path before release.
- The earlier Local/Test fixture used placeholder fee facts. The new fixed-fee catalog and validation migration rejects unknown/inactive type codes, missing or non-finite/negative amounts, missing/invalid ISO currency and missing fee names before publication. Older synthetic published fixtures remain historical test data; they do not establish valid real fee policy.
- The owner approved a narrow scanner exception for `fee-program/fee-program.persistence.ts` calling only `preschool_publish_fee_program_version`. Tests run against the scanner and exercise wrong paths, other RPCs, dynamic and bracket calls; existing baselines and Kernel protections remain intact. The scanner's existing coverage outside that adapter is unchanged. The separate Weekly Menu findings remain outside this workstream.
- A publish-only candidate is kept outside the automatic migration directory at `supabase/candidates/preschool_fee_program_publish_only_20261103.sql`. An isolated database with synthetic Auth/tenant dependency definitions installed seven RLS tables and the publish command, with no resolver or binding/snapshot tables. Compared with the exercised migration chain, table columns, constraints, grants, policies and triggers matched; the bodies, ACL, security mode and search path of nine functions matched after normalizing carriage returns. Raw function fingerprints differed in line endings. A later separate Supabase target with real Auth/PostgREST passed its standalone E2E (1 suite / 1 integration test), with schema-only tenants/users dependencies copied from the disposable profile. See the candidate report for the exact identity and ledger limitations. This is not a Production migration approval.
- The disposable stack's Supabase default privileges had given `authenticated` `TRUNCATE`, `REFERENCES`, `TRIGGER` and `MAINTAIN` on the seven publish tables. `20261103130000` revokes those excess privileges for the seven tables and regrants only required operations; the Auth/PostgREST suite and catalog checks passed afterward. The three excluded binding/snapshot tables still expose those effective privileges to `authenticated` in this Local/Test stack. RLS does not govern TRUNCATE. They remain outside the publish-only package and need a separate fix before any release containing them; Production privileges have not been checked.
- Fee Type/Program API and UI source now exists in the current worktree; no authenticated browser E2E or Production deployment is proven. The focused Jest and ESLint attempts could not initialize because the worktree dependency tree cannot resolve `next` and `eslint-config-next`. Production migration-history inventory is recorded in `FEE_PROGRAM_PRODUCTION_PREFLIGHT.md`, but a safe versioned release/ledger application path and recovery procedure remain unproven. Do not expose the current candidate as production-ready.
