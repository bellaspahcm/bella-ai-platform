# Bella AI Platform - Architecture Constitution

**Version:** 1.1

**Status:** APPROVED  

**Effective Date:** 2026-08-02; Product-first authority amendment 2026-11-05

**Approval Authority:** Product Owner

**Review Cycle:** Quarterly

---

## Preamble

This document establishes the **architectural foundation** and **governing principles** for the Bella AI Platform. All engineering decisions, system designs, code implementations, and AI-assisted development must conform to the rules defined herein.

This is not a guideline. This is a **constitution**.

The Product Owner has final authority over Bella's strategy, business and architecture. The Chief Architect and ARB advise and provide technical challenge; they have no independent veto over ordinary Product-local implementation within assigned scope. Product-local implementation is governed by the Product-Local Implementation Authority below. Protected contracts, security boundaries, frozen components and other explicitly restricted changes retain their applicable authorization and review requirements.

---

## I. Vision & Mission

### Vision
**"Build the most extensible, AI-native, multi-industry business platform in Southeast Asia by 2027."**

### Mission
Bella AI Platform provides **unified business capabilities** (Identity, CRM, Finance, Operations, Analytics) that can be:
- **Composed** into industry-specific solutions (Real Estate, Baby Care, Beauty Spa, Clean Services, Healthcare, Retail, etc.)
- **Extended** without modifying core platform code
- **Operated** by humans and AI employees collaboratively
- **Evolved** without breaking existing tenants

---

## II. Scope & Boundaries

### In Scope (Platform Responsibilities)
✅ Identity & Access Management  
✅ Multi-tenancy & Organization Management  
✅ Event-Driven Integration Bus  
✅ Policy & Workflow Engine  
✅ Document & Storage Platform  
✅ Notification & Communication  
✅ AI Decision Support Layer  
✅ Audit & Compliance  
✅ Package & License Management  
✅ Module Registry & Assignment  

### Out of Scope (Industry Module Responsibilities)
❌ Industry-specific business logic (booking, commission, inventory, treatment)  
❌ Industry-specific UI/UX  
❌ Industry-specific reports  
❌ Industry-specific integrations  

**Rule:** Platform provides **capabilities**. Modules provide **business logic**.

---

## III. Design Principles

### 1. Business Capability First
**"Design around business capabilities, not technical components."**

❌ BAD: `UserService`, `DataService`, `HelperService`  
✅ GOOD: `IdentityManagement`, `RegistrationWorkflow`, `ProvisioningPipeline`

**Rationale:** Business capabilities are stable. Technical implementations change.

---

<a id="2-platform-before-industry"></a>
### 2. Platform Reuse and Product-Local Authority
**Reuse suitable Platform capabilities; do not make their creation a prerequisite for Product completion.**

An existing suitable capability should be reused through its contract. If it is unavailable, unsuitable, or creates an unnecessary development dependency, use the smallest safe, authorized Product-local solution. For example, Product-specific registration workflow may remain local while respecting existing protected identity ownership and contracts. Platform extensions or new capabilities require their own assigned scope.

#### Product-Local Implementation Authority

Not every Product capability must originate from Bella Platform. AI Coding Agents may implement Product-local business logic, UI, APIs and data models within assigned scope and applicable change authority without ARB approval solely because the capability is local. A local solution must preserve security, tenant isolation, authorization, data integrity, ownership and protected contracts. It does not automatically become Platform or OS capability, and must not introduce unnecessary shared abstractions or cross-Product dependencies.

Use **REUSE → EXTEND → LOCAL → ABSTRACT**. Record relevant observations for future evidence-based OS consolidation. Do not block independent Product work on unrelated Platform or OS development. Changes to protected Platform contracts, frozen components or explicitly restricted boundaries retain their applicable change authority; Production migration and deployment retain separately granted authority.

The Product Owner retains final business and architectural decision authority. Architecture review is advisory by default; a specific protected boundary, applicable control or explicit authority condition may require authorization or review. This does not waive security, freeze, protected-contract or release controls. Platform architecture enables Product completion.

---

### 3. Event-First Architecture
**"Communicate through events, not direct calls."**

❌ BAD:
```typescript
async function approveRegistration(id: string) {
  await updateStatus(id, 'approved');
  await sendEmail(id);           // Direct call
  await createAuditLog(id);      // Direct call
  await notifyCRM(id);           // Direct call
}
```

✅ GOOD:
```typescript
async function approveRegistration(id: string) {
  await updateStatus(id, 'approved');
  await eventBus.publish('IdentityApproved', { id, timestamp, approvedBy });
  // Subscribers handle the rest
}
```

**Rationale:** Event-driven systems are loosely coupled, extensible, and auditable.

---

### 4. Policy-Driven Workflows
**"Configuration over code. Policy over if/else."**

❌ BAD:
```typescript
if (type === 'agency') {
  requireDocuments(['business_license', 'tax_cert']);
} else if (type === 'broker') {
  requireDocuments(['cccd']);
}
```

✅ GOOD:
```typescript
const policy = await policyEngine.getPolicy('registration', type);
const requiredDocs = policy.requiredDocuments;
```

**Rationale:** Policies can be changed by business users without code deployment.

---

### 5. AI-Native Architecture
**"AI is not a feature. AI is a layer."**

❌ BAD: Add AI as optional chatbot  
✅ GOOD: Build AI Decision Support into every critical workflow

**Example:**
```
Registration → AI Review (Risk/Fraud/Quality) → Human Approval
Booking → AI Optimization → Staff Assignment
Commission → AI Validation → Finance Approval
```

**Rationale:** AI should augment human decisions, not replace them. Human-in-the-loop is mandatory.

---

### 6. Configuration Over Code
**"Prefer runtime configuration over compile-time logic."**

✅ Feature flags  
✅ Policy rules  
✅ Workflow definitions  
✅ Module assignments  
✅ Package configurations  

❌ Hardcoded business rules  
❌ Environment-specific code branches  

**Rationale:** Configuration changes don't require code deployment, testing, or downtime.

---

### 7. Everything Extensible
**"Design for extension, not modification."**

**Extension Points:**
- Custom fields (JSONB metadata)
- Event subscribers
- Workflow hooks
- Policy providers
- Module plugins
- AI models

**Anti-Pattern:** Modifying core platform code to add industry features.

---

## IV. Architectural Invariants

These invariants are mandatory. Owner architectural authority does not itself waive technical protections or grant authority to change protected contracts, security boundaries, frozen components, database permissions or Production. Any proposed protected change must follow its specific authorization, applicable review, verification and recovery requirements; an ordinary Product-local solution that respects them needs no Chief Architect or ARB approval.

### Invariant 1: Zero Regression Policy
**"New features MUST NOT break existing tenants."**

- Production tenants are **IMMUTABLE** by default
- New capabilities are **OPT-IN** via feature flags
- Schema changes are **ADDITIVE ONLY** (no breaking ALTER TABLE)
- Legacy APIs remain functional (deprecate, don't delete)

**Enforcement:** Automated regression tests in CI/CD.

---

### Invariant 2: Event Sourcing for Critical Operations
**"All state-changing operations MUST publish domain events."**

**Critical Operations:**
- Identity lifecycle (created, verified, approved, provisioned, activated, suspended, deleted)
- Tenant lifecycle (created, configured, suspended, archived)
- Financial transactions (created, approved, paid, reversed)
- Audit-worthy actions (approval, rejection, configuration changes)

**Event Schema:**
```typescript
{
  eventId: uuid,
  eventType: string,          // 'IdentityApproved'
  aggregateId: uuid,          // Identity ID
  aggregateType: string,      // 'Identity'
  payload: object,            // Event-specific data
  metadata: {
    tenantId: uuid,
    userId: uuid,
    timestamp: ISO8601,
    correlationId: uuid,
    causationId: uuid
  }
}
```

---

### Invariant 3: Single Source of Truth
**"Every data entity has ONE authoritative source."**

| Entity | Source of Truth | Anti-Pattern |
|--------|-----------------|--------------|
| Identity | `identities` table | Duplicate in `partners`, `employees` |
| Tenant | `tenants` table | Duplicate in `organizations` |
| User Permissions | `user_permissions` table | Hardcoded in code |
| Module Assignment | `tenant_modules` table | Derived from tenant type |

**Rationale:** Duplication causes data inconsistency and synchronization bugs.

---

### Invariant 4: API Contract Stability
**"Public APIs are contracts. Breaking changes require major version bump."**

**Versioning Strategy:**
- `/api/v1/identities` → Stable, supported for 2 years
- `/api/v2/identities` → New version with breaking changes
- `/api/internal/identities` → No stability guarantee

**Deprecation Policy:**
- Announce 6 months before deprecation
- Provide migration guide
- Support old version for 1 year after deprecation

---

### Invariant 5: Multi-Tenancy Isolation
**"Tenant data MUST be isolated. Cross-tenant queries are forbidden."**

**Enforcement Mechanisms:**
- Row-Level Security (RLS) on all tables
- `tenant_id` in every query WHERE clause
- API middleware validates tenant context
- Database views enforce tenant filtering

**Test Requirement:** Every feature must have multi-tenant isolation test.

---

### Invariant 6: AI Explainability
**"Every AI decision MUST be explainable and auditable."**

**Requirements:**
- Store AI model version, input features, confidence score
- Log AI recommendations with reasoning
- Allow human override with justification
- Track AI accuracy over time

**Example:**
```typescript
{
  aiReviewId: uuid,
  registrationId: uuid,
  modelVersion: 'fraud-detection-v2.1',
  riskScore: 0.73,
  fraudScore: 0.15,
  reasoning: [
    'Email domain has low reputation score',
    'Phone number associated with 3 other accounts',
    'Business license verified successfully'
  ],
  recommendation: 'REQUEST_MORE_INFO',
  humanDecision: 'APPROVED',
  humanJustification: 'Known business, false positive',
  decidedBy: uuid,
  decidedAt: timestamp
}
```

---

### Invariant 7: Idempotency
**"All state-changing APIs MUST be idempotent."**

**Implementation:**
- Accept `idempotency-key` header
- Store operation result keyed by idempotency key
- Return cached result for duplicate requests
- TTL: 24 hours

**Rationale:** Prevents duplicate operations from retries, network failures, or user errors.

---

## V. Layer Architecture

### Conceptual Layers (Top to Bottom)

```
┌─────────────────────────────────────────────────────────┐
│  Industry Modules (Real Estate, Baby Care, Spa, ...)   │
│  - Business Logic                                       │
│  - Industry UI                                          │
│  - Industry Reports                                     │
└─────────────────────────────────────────────────────────┘
                        ↓ Uses
┌─────────────────────────────────────────────────────────┐
│  Platform Capabilities                                  │
│  - Identity, CRM, Finance, Operations, Analytics        │
│  - Workflow Engine, Policy Engine, Event Bus            │
│  - AI Decision Support, Document Management             │
└─────────────────────────────────────────────────────────┘
                        ↓ Uses
┌─────────────────────────────────────────────────────────┐
│  Infrastructure Services                                │
│  - Database (PostgreSQL/Supabase)                       │
│  - Storage (Supabase Storage)                           │
│  - Auth (Supabase Auth)                                 │
│  - Messaging (Event Bus)                                │
│  - AI Services (OpenAI, Custom Models)                  │
└─────────────────────────────────────────────────────────┘
```

### Dependency Rule
**"Inner layers MUST NOT depend on outer layers."**

✅ Industry Module → Platform Capability  
✅ Platform Capability → Infrastructure  
❌ Platform Capability → Industry Module  
❌ Infrastructure → Platform Capability  

---

## VI. Naming Conventions

### Aggregate Roots (PascalCase, Singular)
`Identity`, `Registration`, `Tenant`, `Organization`, `Module`, `Package`, `License`, `Role`, `Permission`, `Document`, `Workflow`, `Policy`, `Notification`

### Domain Events (PascalCase, Past Tense)
`IdentityRegistered`, `IdentityVerified`, `IdentityApproved`, `IdentityProvisioned`, `IdentityActivated`, `IdentitySuspended`, `IdentityDeleted`

### Services (PascalCase, Noun + Action)
`RegistrationWorkflow`, `ProvisioningPipeline`, `NotificationDispatcher`, `PolicyEvaluator`, `DocumentManager`

### Database Tables (snake_case, Plural)
`identities`, `registrations`, `tenants`, `organizations`, `modules`, `packages`, `licenses`, `roles`, `permissions`, `documents`, `workflows`, `policies`, `notifications`

### API Endpoints (kebab-case, REST-ful)
`/api/v1/identities`  
`/api/v1/identities/{id}/registrations`  
`/api/v1/identities/{id}/provision`  

---

## VII. Domain Boundaries

### Core Domains (Platform)
- **Identity & Access Management** - Who can do what
- **Multi-Tenancy** - Organization & tenant management
- **Workflow & Policy** - Business process automation
- **Event Bus** - Inter-module communication
- **AI Decision Support** - ML-powered recommendations

### Supporting Domains (Platform)
- **Document Management** - File storage & retrieval
- **Notification** - Email, SMS, in-app notifications
- **Audit & Compliance** - Event logging, data retention
- **Package & License** - Subscription management

### Generic Subdomains (Infrastructure)
- Authentication, Authorization
- Database, Storage
- Caching, Queue
- Monitoring, Logging

---

## VIII. Extension Rules

### How to Extend the Platform

#### ✅ Allowed Extensions
1. **Add new Industry Module** - Implement `IndustryModuleProvider` interface
2. **Add custom Registration Type** - Implement `RegistrationProvider` interface
3. **Subscribe to Events** - Register event handler in Event Bus
4. **Define custom Policies** - Add policy rules in Policy Engine
5. **Add custom Workflows** - Define workflow in Workflow Engine
6. **Extend Metadata** - Use JSONB `metadata` column

#### ❌ Forbidden Modifications
1. ~~Modify core platform tables~~ → Use extension tables
2. ~~Hardcode industry logic in platform~~ → Use providers
3. ~~Skip event publishing~~ → Always publish domain events
4. ~~Bypass Policy Engine~~ → Always check policies
5. ~~Direct database calls from UI~~ → Use API layer

---

## IX. Backward Compatibility Rules

### Database Schema Changes
- ✅ Add new table
- ✅ Add new column (nullable or with default)
- ✅ Add new index
- ❌ Rename column (create new, deprecate old)
- ❌ Delete column (mark deprecated, delete after 6 months)
- ❌ Change column type (create new, migrate data, deprecate old)

### API Changes
- ✅ Add new endpoint
- ✅ Add optional parameter
- ✅ Add new response field
- ❌ Remove endpoint (deprecate for 6 months)
- ❌ Remove required parameter (make optional first)
- ❌ Change response structure (version bump)

### Event Schema Changes
- ✅ Add new event type
- ✅ Add new field to payload (optional)
- ❌ Rename event type (create new, deprecate old)
- ❌ Remove field from payload (mark deprecated)

---

## X. Governance & Compliance

### Architecture Review Board (ARB)
**Members:** Chief Architect, Tech Leads, Product Owner

**Responsibilities:** The Chief Architect and ARB advise and challenge technical decisions; the Product Owner retains final strategic, business and architectural authority. Review or approval is mandatory only where a specific protected boundary, applicable control or explicit authority condition requires it. Neither role has an independent veto over ordinary in-scope Product-local implementation.

- Advise on ADRs and protected changes when applicable or requested.
- Provide technical challenge and recommendations on architecture questions.
- Support periodic architecture review and bring unresolved decisions to the Product Owner.

### ADR Process
When an ADR is required by an applicable protected change process or explicitly requested, use the existing template and required authorized review. Approved ADRs remain immutable; create a new ADR to supersede one. Ordinary Product-local implementation does not require an ADR or ARB review.

### Compliance Checks
**Automated (CI/CD):**
- Schema migration review (no breaking changes)
- API contract validation (no breaking changes)
- Event schema validation
- Multi-tenant isolation tests
- Idempotency tests

**Manual (Code Review):**
- Adherence to naming conventions
- Proper use of Event Bus
- Policy Engine usage
- AI explainability

---

## XI. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.1 | 2026-11-05 | Product Owner | Established Product-first, Product-local and final Owner architectural authority; retained protected controls and risk-scoped review. |
| 1.0 | 2026-08-02 | Chief Architect | Initial constitution |

---

## XII. Sign-Off

The initial constitution records Chief Architect authority in version 1.0. The Product Owner's direction of 2026-11-05 authorizes the version 1.1 amendment. Chief Architect, ARB, VP Engineering and CTO input is advisory unless a specific protected control or explicit authority condition requires otherwise. This record does not assert a separate signature or approval for a protected change.

---

**Document Classification:** CONFIDENTIAL - INTERNAL USE ONLY

**Location:** `docs/01-architecture/ARCHITECTURE_CONSTITUTION.md`

**Related Documents:**
- [ADR-001: Identity Platform](../05-adr/ADR-001-identity-platform.md)
- [ADR-004: Event-Driven Architecture](../05-adr/ADR-004-event-driven-architecture.md)
- [ADR-010: Domain Model](../05-adr/ADR-010-domain-model.md)

---

**"This is not a guideline. This is a constitution."**
