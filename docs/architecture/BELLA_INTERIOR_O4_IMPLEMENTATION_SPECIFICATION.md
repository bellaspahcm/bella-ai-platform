# BELLA INTERIOR — O4 IMPLEMENTATION SPECIFICATION

**Module:** Installation, Acceptance & Handover  
**Architecture Baseline:** v2.0 — Approved 18/11/2026  
**Implementation Batch:** O4  
**Priority:** Production-grade business workflow  
**Environment Boundary:** Production READ-ONLY during O4 implementation  

---

## 1. IMPLEMENTATION OBJECTIVE

Implement a complete, auditable field acceptance and handover workflow for Bella Interior.

The implementation must support:

1. Multiple acceptance campaigns per project.
2. Multiple independent acceptance sessions per campaign.
3. Mandatory acceptance assessment, including zero-defect acceptance.
4. Multi-angle physical evidence and customer sign-off documents.
5. Seven categories of acceptance notes with specialized work routing.
6. Independent manager approval and remediation lifecycles.
7. Independent approval, inspection result and documentation states.
8. Immutable evidence versioning and server-computed SHA-256.
9. Database-level audit trail and server-enforced project permissions.
10. Post-approval documentation supplementation without modifying historical approval decisions.

**Definition of Done:** A real authenticated user can execute the complete workflow from field inspection through management approval, remediation, re-inspection and final handover, with persisted database records and independently verifiable evidence.

A UI-only implementation, mock data, simulated RPC, or disconnected form does not satisfy this specification.

---

## 2. IMPLEMENTATION BOUNDARIES

### 2.1. Environment

- O3 remains `READY ON HOLD`.
- Production remains `READ-ONLY`.
- No Production migration, INSERT, UPDATE, DELETE, Storage upload, or deployment.
- Implementation and verification must use the explicitly authorized O4 development environment.
- Do not assume Non-Production and Production schemas are identical.

### 2.2. Architecture

Before implementation:

1. Inspect existing Interior project, BOQ, installation, punch-list, warranty, contract, addendum, Storage and audit structures.
2. Inspect existing authentication, project-scoped permissions, server APIs and RPCs.
3. Identify reusable services and canonical relationships.
4. Produce a mapping of existing components to the O4 requirements.
5. Add only missing capabilities.

Do not create duplicate project, BOQ, production order, warranty, finance or identity models.

Do not introduce a new OS abstraction merely to support this module.

### 2.3. UI

- Preserve approved UI and existing user workflows.
- Implement the approved business functionality behind existing UI.
- Add only the minimum missing controls required to complete the workflow.
- Do not remove or defer approved functionality because its backend implementation is missing.

---

## 3. DOMAIN MODEL

### 3.1. Acceptance Campaign

Represents a coordinated acceptance and handover program belonging to an Interior project.

Required relationships:

- `tenant_id`
- `project_id`
- Campaign code
- Campaign name
- Description / scope
- Created by
- Created timestamp
- Updated timestamp

A project can have multiple campaigns.

A campaign can contain multiple independent sessions.

### 3.2. Acceptance Session

Represents one actual field inspection and acceptance event.

Required relationships:

- `tenant_id`
- `campaign_id`
- `project_id`
- Session code
- Session type
- Inspection scope
- Inspection timestamp
- Recorder actor
- Customer / authorized representative
- Related BOQ items
- Inspection result
- Approval status
- Documentation status

Supported session types:

- `ROOM_BY_ROOM`
- `ITEM_BASED`
- `DELIVERY_BATCH`
- `POST_REMEDIATION`
- `FINAL_HANDOVER`

Each session must retain its own lifecycle and historical records.

Do not overwrite previous sessions when creating a subsequent inspection.

### 3.3. Acceptance Notes

Acceptance Notes are a mandatory part of each completed acceptance assessment.

A session with zero defects must still have an explicit assessment record.

Support:

- `NO_ISSUES`
- `MINOR_MONITORING`
- `DEFECT_REMEDIATION_REQUIRED`
- `INCOMPLETE_ITEMS`

Each individual note must support:

- Category
- Severity
- Description
- Related BOQ item, when applicable
- Evidence references
- Remediation plan
- Responsible party
- Target deadline
- Current remediation status
- Created by / created at
- Updated by / updated at

Supported categories:

- `QUALITY_ISSUE`
- `INSTALLATION_ISSUE`
- `CUSTOMER_REQUEST`
- `MISSING_ITEM`
- `DAMAGE`
- `FOLLOW_UP`
- `GENERAL_NOTE`

Do not create artificial defect records for a `NO_ISSUES` assessment.

A zero-defect assessment must be explicitly distinguishable from a missing assessment.

---

## 4. THREE INDEPENDENT STATE DIMENSIONS

This is a mandatory architecture requirement.

Do not combine the following three dimensions into one status field.

### 4.1. Inspection Result

Field: `inspection_result`

Supported values:

- `ACCEPTED_WITHOUT_ISSUES`
- `ACCEPTED_WITH_REMARKS`
- `PENDING_REMEDIATION`

Interpretation:

| Value | Meaning |
| :--- | :--- |
| `ACCEPTED_WITHOUT_ISSUES` | Inspected and accepted with zero outstanding issues |
| `ACCEPTED_WITH_REMARKS` | Accepted with recorded remarks and potentially outstanding remediation |
| `PENDING_REMEDIATION` | Not yet accepted because remediation or incomplete work prevents acceptance |

`PENDING_REMEDIATION` must not automatically imply manager rejection.

### 4.2. Approval Status

Field: `approval_status`

Supported values:

- `PENDING`
- `APPROVED`
- `REJECTED`

Only an authorized project approver can change this status through a server-enforced operation.

Store:

- Approver actor ID from authenticated server context
- Approval timestamp
- Decision
- Rejection reason, when applicable
- Approval snapshot / referenced assessment version

Manager approval must never automatically close a defect, punch-list item or warranty ticket.

### 4.3. Documentation Status

Field: `documentation_status`

Supported values:

- `NONE`
- `PARTIAL`
- `COMPLETE`

Rules:

- `NONE`: No attached supporting documents or physical evidence.
- `PARTIAL`: Some supporting evidence exists, but the required evidence set is incomplete.
- `COMPLETE`: The configured required evidence set has been satisfied.

The required evidence set must distinguish:

1. Overall site photographs.
2. Detailed technical photographs.
3. Completed-product photographs.
4. Customer-signed acceptance minutes.

Store evidence type and verification state explicitly.

Documentation status must be derived from persisted evidence records, not client-supplied values.

**Critical invariant: Documentation Status never blocks approval by itself.**

Valid combinations include:

| Approval | Documentation | Valid |
| :--- | :--- | :--- |
| APPROVED | COMPLETE | Yes |
| APPROVED | PARTIAL | Yes |
| APPROVED | NONE | Yes |
| PENDING | NONE | Yes |
| PENDING | PARTIAL | Yes |
| PENDING | COMPLETE | Yes |
| REJECTED | NONE / PARTIAL / COMPLETE | Yes |

Do not convert `NONE` or `PARTIAL` into `REJECTED`, `BLOCKED` or `NOT_APPROVED`.

Do not infer `COMPLETE` from `APPROVED`.

### 4.4. Post-Approval Supplementation

After approval:

- Additional documents can be uploaded.
- New evidence versions must be created.
- Uploader and server timestamp must be recorded.
- Documentation status must be recalculated.
- The original approval decision, approver and approval timestamp must remain unchanged.

A documentation update is not a new approval.

---

## 5. ACCEPTANCE EVIDENCE PACKAGE

Implement the six evidence pillars.

### 5.1. Physical Evidence

Support image evidence categories:

- `OVERALL`
- `DETAIL`
- `COMPLETED_PRODUCT`

Every file must have a stable Storage object reference.

Required metadata:

- Object ID
- Bucket ID
- Storage path
- Original filename
- File size
- MIME type
- SHA-256
- Uploader actor ID
- Server upload timestamp
- Linked entity type
- Linked entity ID
- Version number

SHA-256 must be calculated server-side from the actual uploaded object stream.

Never trust a client-provided hash.

Validate file type, size, tenant ownership, project ownership and authorized upload scope.

### 5.2. Customer Acceptance

Support:

- PDF signed minutes.
- Scanned image of a physically signed document.
- Authorized customer representative information.
- Document version history.

Customer sign-off is supporting evidence, not a technical condition that prevents an authorized manager from approving an assessment.

Never fabricate customer signatures or sign-off metadata.

### 5.3. Acceptance Notes

Preserve all seven note categories and their respective routing rules.

### 5.4. Remediation Tracking

Link notes to actual work items where required.

Preserve the original note and its relationship to the remediation work.

### 5.5. Manager Approval

Keep approval records independent of remediation closure.

### 5.6. Immutable Audit Trail

Record the entire lifecycle, including evidence uploads, approval decisions, supplementation and remediation transitions.

---

## 6. STORAGE OBJECT VERSIONING

Implement immutable file versioning.

Rules:

1. Never overwrite an existing evidence object in place.
2. Each replacement creates a new version.
3. Each version has a unique Storage path.
4. Retain previous versions and their metadata.
5. Link every version to the correct entity.
6. Record uploader and server timestamp.
7. Compute SHA-256 server-side.
8. Validate tenant and project authorization before accepting the upload.

Suggested path convention:

`{tenant_id}/{project_id}/{campaign_id}/{session_id}/{entity_type}/{entity_id}/v{version}/{file}`

Use existing approved bucket conventions where available.

Do not create a second Storage infrastructure if an existing secure bucket can support the requirement.

---

## 7. SPECIALIZED WORK ROUTING

Do not convert every acceptance note into a warranty ticket.

Implement category-aware and lifecycle-aware routing.

| Category | Routing | Business rule |
| :--- | :--- | :--- |
| `QUALITY_ISSUE` | Punch List / Warranty | Pre-handover defects go to Punch List; eligible post-handover defects follow Warranty |
| `INSTALLATION_ISSUE` | Punch List | Create or link a field adjustment work item |
| `CUSTOMER_REQUEST` | Change Order / Addendum | Record request and assess cost/scope/schedule impact; do not automatically approve a contract change |
| `MISSING_ITEM` | Replenishment Task | Link to existing inventory and delivery processes |
| `DAMAGE` | Defect Remediation | Assign according to damage origin and project responsibility |
| `FOLLOW_UP` | Re-inspection Task | Record scheduled inspection and responsible person |
| `GENERAL_NOTE` | CRM Note | Persist customer feedback without creating unnecessary tasks |

### Routing requirements

- Reuse existing canonical services.
- Avoid duplicate work items.
- Use idempotency keys for routing operations.
- Preserve source note references.
- Persist routing outcome and destination ID.
- Record routing failures for retry.
- Never silently discard a note because a downstream integration is unavailable.

If an integration cannot complete, retain the original note and report the routing state truthfully.

---

## 8. REMEDIATION LIFECYCLE

Implement independent remediation states.

Minimum lifecycle:

- `OPEN`
- `IN_PROGRESS`
- `READY_FOR_REINSPECTION`
- `VERIFIED`
- `CLOSED`

Required behavior:

1. A note classified as a defect can create or link to a Punch List Item.
2. The responsible team records remediation activity.
3. Remediation evidence is uploaded as a new evidence record.
4. The responsible supervisor or authorized verifier inspects the result.
5. The issue is closed only after the required independent verification.
6. Preserve the complete remediation history.

**Forbidden behavior:**

`approval_status = APPROVED` must never trigger automatic `VERIFIED` or `CLOSED`.

A new post-remediation session must reference the original issue and its remediation record.

Do not close a Punch List item merely because the customer has accepted conditional handover.

---

## 9. MANAGER APPROVAL GATE

Implement server-side approval authorization.

Permission:

`interior:handover:approve`

Recorder permission:

`interior:installation:create`

Uploader permission must be mapped to the existing project-scoped authorization model. Introduce a dedicated permission only if no suitable existing permission exists.

Every authorization check must validate:

- Authenticated identity.
- Tenant membership.
- Project scope.
- Permission.
- Current entity state.
- Valid state transition.

Never trust:

- Client-supplied actor IDs.
- Client-supplied tenant IDs without server-side verification.
- Client-supplied approval timestamps.
- UI visibility as proof of authorization.

Approval must remain possible when documentation status is `NONE` or `PARTIAL`.

The approval operation must explicitly record that documentation was missing or incomplete at the time of approval.

Do not silently treat missing documents as a complete package.

---

## 10. DATABASE AUDIT IMMUTABILITY

Use the existing `public.audit_logs` contract if it is suitable.

Requirements:

1. Append-only behavior.
2. No UPDATE or DELETE for `anon` or `authenticated`.
3. Database-level protection against modification and deletion, including privileged application paths.
4. Server-authenticated actor identity.
5. Server-generated timestamps using `statement_timestamp()`.
6. Old and new state snapshots.
7. Tenant, project and entity references.
8. Event type and operation metadata.

Do not rely exclusively on client-side logging or revoked grants.

Implement appropriate database-level protection, including immutable-table triggers where compatible with the existing audit architecture.

Review service-role and table-owner bypass paths explicitly.

Audit events must be written transactionally with the business operation wherever possible. Do not allow a successful approval or state transition to silently lose its corresponding audit event.

Do not alter unrelated historical audit records.

---

## 11. SECURITY AND TENANT ISOLATION

All new or modified business tables must preserve tenant isolation.

Requirements:

- RLS policies.
- Tenant-scoped relationships.
- Project-scoped authorization.
- Secure Storage policies.
- Server/API/RPC authorization.
- No direct client privilege escalation.
- No cross-tenant evidence access.
- No cross-project session manipulation.
- No unauthorized approval or remediation closure.

Validate access through actual authenticated user contexts, not only service-role tests.

---

## 12. TRANSACTIONAL INTEGRITY AND IDEMPOTENCY

Operations that create an acceptance note and route a downstream work item must be idempotent.

Prevent:

- Duplicate Punch List Items.
- Duplicate replenishment tasks.
- Duplicate change requests.
- Duplicate approval records.
- Duplicate evidence version numbers.
- Duplicate audit events from retrying the same business operation.

Use unique constraints, transactional RPCs or equivalent existing application mechanisms.

Concurrent uploads and version creation must not produce conflicting version numbers.

A failed downstream operation must not destroy the original acceptance record.

---

## 13. IMPLEMENTATION WORKSTREAMS

### O4-A — Existing Architecture Discovery

- Inspect existing schema and migrations.
- Map canonical project, BOQ and customer references.
- Inspect Punch List and Warranty services.
- Inspect Storage and audit contracts.
- Inspect project-scoped RBAC.
- Produce an implementation gap report.

### O4-B — Database and Domain Model

- Campaign and Session persistence.
- Acceptance assessment and notes.
- Three independent state dimensions.
- Evidence metadata and versioning.
- Remediation relationships.
- Approval history.
- Required indexes, constraints and RLS.

### O4-C — Server Services and RPC

- Create/update campaign and session.
- Record acceptance assessment.
- Record acceptance notes.
- Upload and register evidence.
- Compute SHA-256.
- Calculate documentation status.
- Approve/reject session.
- Supplement post-approval documents.
- Route downstream work.
- Verify and close remediation.

### O4-D — UI Integration

- Campaign listing and details.
- Session listing and details.
- Acceptance form, five sections.
- Evidence upload and preview.
- Notes and remediation tracking.
- Customer sign-off.
- Manager approval.
- Approval/documentation status visibility.
- Historical evidence and audit timeline.

Preserve approved UI structure and design conventions.

### O4-E — Integration and E2E Verification

Test complete workflows using real authentication and persisted data.

### O4-F — Release Readiness

- Build and type checks.
- Unit and integration tests.
- RLS and tenant isolation.
- Migration review.
- Evidence verification.
- Audit verification.
- Deployment readiness report.

No Production execution is included in this authorization.

---

## 14. REQUIRED END-TO-END TEST SCENARIOS

| ID | Scenario | Expected result |
| :--- | :--- | :--- |
| E01 | Create a campaign and multiple sessions | All records persist with correct project relationships |
| E02 | Complete inspection with zero defects | `ACCEPTED_WITHOUT_ISSUES`, explicit `NO_ISSUES` assessment |
| E03 | Record an installation defect | Correct Punch List routing |
| E04 | Record a customer request | Change request assessment, no automatic addendum approval |
| E05 | Record missing accessories | Replenishment routing |
| E06 | Upload overall/detail/completed photographs | Valid metadata, SHA-256 and version 1 |
| E07 | Upload signed acceptance minutes | Correct customer acceptance evidence |
| E08 | Approve with no documents | Approval succeeds; documentation remains `NONE` |
| E09 | Approve with partial documents | Approval succeeds; documentation remains `PARTIAL` |
| E10 | Approve with complete documents | Approval succeeds; documentation is `COMPLETE` |
| E11 | Supplement documents after approval | Documentation updates; approval history remains unchanged |
| E12 | Approve session with open Punch List | Punch List remains open |
| E13 | Complete remediation | Independent evidence and verification required |
| E14 | Conduct post-remediation session | Original issue and remediation history remain linked |
| E15 | Attempt unauthorized approval | Server returns 403 |
| E16 | Attempt cross-tenant access | Access denied |
| E17 | Attempt audit UPDATE/DELETE | Database rejects modification |
| E18 | Replace evidence file | New version created; previous version retained |
| E19 | Retry routing operation | No duplicate downstream work item |
| E20 | Create final handover session | Correct final handover and warranty integration without premature closure |

Additional tests must cover concurrent version creation, failed uploads, invalid MIME types, stale approval requests and failed downstream routing.

---

## 15. ACCEPTANCE CRITERIA

O4 can be marked `PASS` only when:

- All required domain relationships persist correctly.
- The three state dimensions remain independent.
- `NO_ISSUES` is supported without artificial defect records.
- Approval is possible with `NONE` and `PARTIAL` documentation.
- Approval does not close Punch List items.
- Evidence hashes are computed from actual server-side file content.
- Evidence version history is immutable.
- Audit records are protected at database level.
- Project and tenant authorization is enforced at the server.
- Work routing is idempotent and traceable.
- Post-approval supplementation preserves original approval history.
- All 20 E2E scenarios pass or have individually documented, evidence-backed dispositions.
- Existing Interior functionality remains intact.

A passing unit test suite alone is insufficient.

A successful database migration alone is insufficient.

A successful UI demonstration alone is insufficient.

---

## 16. EVIDENCE AND REPORTING REQUIREMENTS

Produce the following implementation artifacts:

1. `BELLA_INTERIOR_O4_ARCHITECTURE_DISCOVERY.md`
2. `BELLA_INTERIOR_O4_SCHEMA_MAPPING.md`
3. `BELLA_INTERIOR_O4_IMPLEMENTATION_REPORT.md`
4. `BELLA_INTERIOR_O4_E2E_REPORT.md`
5. `BELLA_INTERIOR_O4_SECURITY_AND_RLS_REPORT.md`
6. `BELLA_INTERIOR_O4_RELEASE_READINESS.md`

Every PASS must reference actual evidence:

- Git commit and changed files.
- Migration identifiers.
- Database query results.
- Authenticated E2E results.
- Storage object IDs and SHA-256 verification.
- Audit trail verification.
- RLS and permission test results.
- Build and test results.

Classify findings accurately:

- `PASS`
- `PARTIAL`
- `NOT_PROVEN`
- `BLOCKED`
- `FAIL`

Do not convert TIMEOUT or SKIP into PASS.

Do not report `GO-LIVE` based solely on implementation readiness.

---

## 17. EXECUTION INSTRUCTIONS FOR CODEX

Execute using the following sequence:

**Discover → Map → Implement → Verify → Fix → Seal**

1. Start with repository and database discovery.
2. Reuse existing canonical structures and services.
3. Implement the minimum complete solution.
4. Run tests continuously.
5. Fix discovered defects without repeatedly requesting approval for already-authorized work.
6. Preserve Production READ-ONLY.
7. Do not execute unauthorized migrations or deployments.
8. Record every unresolved dependency and its actual impact.
9. Commit and push only within the explicitly authorized O4 scope.
10. Report the final implementation status using evidence, not assumptions.

Do not stop at an architecture proposal when implementation is possible.

Do not invent missing business data.

Do not weaken security or business invariants to make tests pass.

Do not expand scope into Finance, Manufacturing or unrelated OS modules.

**FINAL DIRECTIVE**

Complete Bella Interior O4 as a working, authenticated, database-backed Acceptance & Handover workflow.

The objective is a usable product capability with truthful operational records, not another architecture demonstration.

**Architecture baseline: APPROVED.**  
**O4 implementation scope: AUTHORIZED WITHIN THE ENVIRONMENT BOUNDARY ABOVE.**  
**Production: READ-ONLY.**  
**Production migration/deployment: NOT AUTHORIZED BY THIS SPECIFICATION.**
