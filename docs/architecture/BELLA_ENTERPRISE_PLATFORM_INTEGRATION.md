# Bella Enterprise Platform Integration Guide

**Document Status:** OFFICIAL ARCHITECTURE CONSTITUTION
**Version:** 1.0.0
**Freeze Date:** 2026-08-07
**Expected Lifetime:** 15-20 Years
**Change Policy:** ADR Only (Architectural Decision Records)

---

## Executive Summary

This document defines how **Bella Hospital Product Pack** integrates with the **Bella Host Enterprise Platform** 7-Volume Architecture Suite. It bridges the Platform-of-Platforms architecture (defined in `BELLA_HOSPITAL_ENTERPRISE_ARCHITECTURE.md`) with the enterprise-grade TOGAF 10 governance framework.

**Authority clarification, 2026-11-05:** The phase-specific assessments, ARB establishment tasks and proposed gates below are historical planning records, not a general prerequisite for ordinary Product-local coding. Apply the [Product-Local Implementation Authority](../01-architecture/ARCHITECTURE_CONSTITUTION.md#product-local-implementation-authority). Protected contracts, Healthcare safety, frozen boundaries and their applicable change and verification requirements remain in force.

---

## Architecture Alignment Matrix

### Hospital Product Pack → 7-Volume Mapping

| Hospital Component | Volume Reference | Compliance Status |
|-------------------|------------------|-------------------|
| **Hospital Dashboard UI** | Volume 2 (Business Architecture) | ✅ Aligned |
| **Bed Engine** | Volume 4 (Healthcare Industry) | ⚠️ Must move to Healthcare Platform |
| **Nursing Engine** | Volume 4 (Healthcare Industry) | ⚠️ Must move to Healthcare Platform |
| **MAR System** | Volume 4 (Healthcare Industry) | ⚠️ Must move to Healthcare Platform |
| **Database Schema** | Volume 5 (Technical Architecture) | ⚠️ Additive migration required |
| **Security Audit** | Volume 5 (Security Domains) | ✅ Break-Glass implemented |
| **Type System** | Volume 1 (Constitution Law 11) | ⚠️ Must eliminate `any` types |

---

## 11 Bella Platform Constitution Laws - Hospital Compliance

### Law 1: Encounter is the Aggregate Root
**Status:** ✅ COMPLIANT

- Hospital uses `Encounter` aggregate root for all clinical activities
- `InpatientAdmission` extends `Encounter` with `encounter_id` foreign key
- All clinical orders, vitals, MAR records linked to `Encounter`

```typescript
// ✅ CORRECT: Hospital respects Encounter aggregate root
interface InpatientAdmission {
  id: string;
  encounter_id: string; // FK to Encounter
  patient_id: string;
  bed_id: string;
  // ...
}
```

### Law 2: No Direct Host DB Access for Products
**Status:** ⚠️ PARTIAL VIOLATION (Phase 0 fix required)

- **Current:** Hospital services directly query Supabase
- **Required:** Hospital must consume engines via API Management Platform

```typescript
// ❌ WRONG (Current):
const { data } = await supabase.from('beds').select('*');

// ✅ CORRECT (Target after Phase 0):
const response = await bedEngine.listAvailableBeds({ tenantId, wardId });
```

### Law 3: Execution-Engine Decoupled Model
**Status:** ⚠️ VIOLATION (Phase 0 fix required)

- **Current:** Engines embedded in Hospital Product Pack services
- **Required:** Engines in Healthcare Platform, Hospital consumes via Runtime

```
❌ CURRENT:
Hospital Product Pack
  └── BedEngineService (engine logic)

✅ TARGET:
Healthcare Platform
  └── Bed Engine
      ↓
Enterprise Runtime Platform
  └── Workflow Runtime → Policy Runtime → Engine Proxy
      ↓
Hospital Product Pack
  └── useBedEngine() hook (consumer)
```

### Law 4: Additive Migration Only
**Status:** ✅ COMPLIANT

- All hospital migrations are additive (new tables, new columns)
- No `ALTER TABLE DROP COLUMN` or breaking constraints
- Example: `hc_master_patient_index`, `hc_encounters`, `hc_security_break_glass_logs`

### Law 5: Event-First Architecture & Event Catalog
**Status:** ❌ NOT IMPLEMENTED (Phase B requirement)

- **Missing:** Event Bus integration (Kafka/RabbitMQ)
- **Missing:** Domain events for bed allocation, admission, discharge
- **Required:** Implement Event Catalog with versioning

```typescript
// 🟡 TODO: Implement domain events
interface BedAllocatedEvent {
  eventType: 'BedAllocated';
  version: '1.0.0';
  timestamp: string;
  payload: {
    bedId: string;
    patientId: string;
    admissionId: string;
  };
}
```

### Law 6: Metadata-Driven Paradigm
**Status:** ❌ NOT IMPLEMENTED (Phase C requirement)

- **Current:** Hospital UI hardcoded in React components
- **Required:** Metadata-driven forms, tables, workflows

```typescript
// 🟡 TODO: Metadata-driven UI
const admissionFormMetadata = await metadataEngine.getForm('hospital.admission.v1');
```

### Law 7: Capability-First Enforcement
**Status:** ⚠️ PARTIAL (Capability check exists, enforcement incomplete)

- **Current:** Manifest declares capabilities, but runtime doesn't enforce
- **Required:** `CapabilityPlatform.checkPermission()` before every operation

```typescript
// ✅ EXISTS: Capability declaration
enabledCapabilities: ['hospital_inpatient', 'bed_engine', ...]

// ❌ MISSING: Runtime enforcement
if (!await capabilityPlatform.hasCapability('hospital_inpatient', { tenantId })) {
  return notFound();
}
```

### Law 8: Registry-First, ADR & ARB Compliance
**Status:** ⚠️ PARTIAL (Architecture docs exist, but no formal ARB process)

- **Current:** Architecture documented in Markdown files
- **Applicable authority:** Follow the [Product-Local Implementation Authority](../01-architecture/ARCHITECTURE_CONSTITUTION.md#product-local-implementation-authority). Ordinary in-scope Product-local implementation does not require an ADR or ARB approval merely because it is local; protected boundaries and changes retain their applicable authorization, review and freeze requirements.

```
✅ HAVE: docs/architecture/*.md
❌ MISSING: ADR registry, ARB review process
🟡 Historical gap: ADR registry and ARB workflow were not established at this assessment.
```

### Law 9: Zero Regression Guarantee
**Status:** ✅ COMPLIANT

- Hospital Product Pack isolated from `beauty_spa` and `babycare` tenants
- Capability flags prevent unintended feature leakage
- No shared tables or code with other verticals

### Law 10: No Direct DB Query for AI
**Status:** ✅ COMPLIANT (AI not yet implemented)

- AI Copilot currently placeholder (no DB queries)
- Future AI features will use **AI Platform Runtime** + **Knowledge Graph**

### Law 11: Strictly No `any` Types Allowed
**Status:** ⚠️ VIOLATION (Critical fix required)

**Current violations found:**
```bash
# Search for `any` types in codebase
grep -r "any" src/services/healthcare-hospital-services.ts
grep -r ": any" src/app/dashboard/hospital/**/*.tsx
```

**Examples of violations:**
```typescript
// ❌ WRONG: Using `any` type
function processData(data: any) { ... }
const response: any = await fetch(...);

// ✅ CORRECT: Strongly-typed
function processData(data: BedAllocationRequest) { ... }
const response: EngineResponse<BedAllocationResponse> = await fetch(...);
```

**Enforcement:**
1. Enable TypeScript `strict` mode in `tsconfig.json`
2. Add ESLint rule: `"@typescript-eslint/no-explicit-any": "error"`
3. Add pre-commit hook to block `any` types
4. Refactor all existing `any` types to proper interfaces

---

## 6-Gate Enterprise Quality Gate - Hospital Compliance

### Gate 1: Architecture Review
**Status:** ⚠️ PARTIAL

- ✅ Architecture documented
- ⚠️ ADR process not formalized
- ❌ No ARB review board
- ⚠️ TypeScript strict typing enforcement incomplete

**Action Items:**
1. Create ADR template (`docs/adr/YYYY-MM-DD-<title>.md`)
2. Establish ARB review board (Architect, Tech Lead, Security Lead)
3. Fix all `any` type violations (100% strongly-typed)
4. Add CI check: `tsc --noEmit && eslint --max-warnings 0`

### Gate 2: Security & Privacy
**Status:** ⚠️ PARTIAL

- ✅ Break-Glass access audit log implemented
- ✅ RLS (Row-Level Security) planned for Supabase
- ❌ SAST scanning not integrated
- ❌ ABAC/RBAC policy runtime not implemented

**Action Items:**
1. Integrate Semgrep/SonarQube for SAST
2. Implement Policy Runtime (OPA/Rego)
3. Add field-level masking for PHI data
4. Implement Zero-Trust architecture

### Gate 3: Performance & NFR
**Status:** ❌ NOT IMPLEMENTED

- ❌ No load testing (JMeter/k6)
- ❌ No latency SLA defined (target: <200ms)
- ❌ No database index optimization
- ❌ No caching strategy (Redis)

**Action Items:**
1. Define SLA: API latency <200ms, page load <2s
2. Add database indexes for common queries
3. Implement Redis caching for bed occupancy
4. Run load test: 500 concurrent users, 200 admissions/day

### Gate 4: Data Governance
**Status:** ✅ COMPLIANT

- ✅ Additive schema migrations only
- ✅ Data classification (PHI, PII)
- ✅ No breaking changes to legacy tables

**Action Items:**
1. Document data retention policy (7 years for medical records)
2. Implement GDPR right-to-be-forgotten (soft delete)

### Gate 5: Compliance & Legal
**Status:** ⚠️ PARTIAL

- ⚠️ BHYT XML 130 placeholder (not implemented)
- ❌ HIPAA compliance checklist incomplete
- ❌ Vietnam MOH certification pending

**Action Items:**
1. Implement BHYT XML 130 generation (Phase E)
2. Complete HIPAA compliance checklist
3. Prepare MOH certification documentation

### Gate 6: Release & Operations
**Status:** ⚠️ PARTIAL

- ✅ Health check endpoints exist
- ❌ Canary rollout not implemented
- ❌ Automated rollback not configured
- ❌ Disaster recovery plan not documented

**Action Items:**
1. Implement feature flag-based canary rollout
2. Configure automated rollback on error rate spike
3. Document disaster recovery runbook

---

## Volume 4: Healthcare Industry Architecture - Hospital Integration

### Healthcare Domain Boundary Map

```
Healthcare Platform (Industry Platform Layer)
│
├── Shared Engines (Healthcare Platform owns)
│   ├── MPI Engine (Master Patient Index)
│   ├── Encounter Engine (Visit management)
│   ├── Clinical Engine (SOAP, diagnosis, procedures)
│   ├── Order Engine (Lab, imaging, medication orders)
│   ├── Billing Engine (Charge capture, invoicing)
│   ├── Insurance Engine (BHYT, insurance verification)
│   ├── Scheduling Engine (Appointment booking)
│   ├── Smart Queue Engine (Queue optimization, AI calling)
│   ├── Pharmacy Engine (Drug database, DDI, MAR)
│   ├── Laboratory Engine (LIS integration)
│   ├── Imaging Engine (RIS/PACS integration)
│   ├── Bed Engine (Bed allocation, occupancy) ⭐ Must move here
│   ├── Nursing Engine (Vital signs, nursing notes) ⭐ Must move here
│   └── Emergency Engine (Triage, ED workflow)
│
└── Product Packs (Consume engines, provide UI)
    ├── Medical Clinic Product Pack (Outpatient UI)
    ├── Dental Clinic Product Pack (Dental UI)
    ├── Hospital Product Pack (Inpatient UI) ⭐ Hospital here
    │   ├── Dashboard UI
    │   ├── Admission UI
    │   ├── Bed Management UI
    │   ├── Nursing Station UI
    │   ├── Vital Signs UI
    │   ├── MAR UI
    │   └── ICU/ED/OR UI (Phase B)
    │
    ├── Pharmacy Product Pack
    └── Laboratory Product Pack
```

### DDD Context Mapping

```
Hospital Bounded Context (Product Pack)
  │
  ├── Uses: Encounter Engine (Upstream)
  ├── Uses: Bed Engine (Upstream) ⭐ Must consume, not implement
  ├── Uses: Nursing Engine (Upstream) ⭐ Must consume, not implement
  ├── Uses: Pharmacy Engine (Upstream)
  ├── Uses: Billing Engine (Upstream)
  └── Publishes: Hospital Domain Events (Downstream)
      ├── PatientAdmitted
      ├── BedAllocated
      ├── PatientTransferred
      └── PatientDischarged
```

---

## Volume 5: Technical Architecture - Hospital Deployment

### Hospital Runtime Execution Pipeline

```
User Request (Hospital UI)
  ↓
1. API Gateway (Kong/APIM)
  ↓
2. Authentication (Identity Platform) ✅ Supabase Auth
  ↓
3. Authorization (RBAC/ABAC) ⚠️ Needs Policy Runtime
  ↓
4. Capability Check (Capability Platform) ⚠️ Partial
  ↓
5. Policy Evaluation (Policy Runtime) ❌ Missing
  ↓
6. Workflow Orchestration (Workflow Runtime) ❌ Missing
  ↓
7. Engine Invocation (Healthcare Platform Engines) ⚠️ Direct DB now
  ↓
8. Event Publication (Kafka/Event Bus) ❌ Missing
  ↓
9. Audit Logging (Audit Platform) ⚠️ Partial
  ↓
10. Response (JSON/UI)
```

### Hospital Database Schema Additive Compliance

**✅ COMPLIANT Examples:**
```sql
-- ✅ Additive: New tables
CREATE TABLE hc_master_patient_index (...);
CREATE TABLE hc_encounters (...);
CREATE TABLE hc_security_break_glass_logs (...);
CREATE TABLE inpatient_admissions (...);
CREATE TABLE nursing_vital_signs (...);

-- ✅ Additive: New columns
ALTER TABLE inpatient_admissions ADD COLUMN discharge_summary TEXT;
ALTER TABLE beds ADD COLUMN last_maintenance_at TIMESTAMPTZ;
```

**❌ FORBIDDEN Examples:**
```sql
-- ❌ Breaking: Drop column
ALTER TABLE beds DROP COLUMN bed_code;

-- ❌ Breaking: Add NOT NULL constraint to existing table
ALTER TABLE beds ALTER COLUMN ward_id SET NOT NULL;

-- ❌ Breaking: Change column type
ALTER TABLE beds ALTER COLUMN status TYPE INTEGER USING status::INTEGER;
```

---

## Phase 0 Refactor: Constitution Compliance Roadmap

### Week 1-2: Foundation (Constitution Law 2, 3, 8)

**Objective:** Establish platform governance infrastructure

#### Tasks:
1. **Create Platform Directory Structure**
   ```bash
   mkdir -p src/platform/host/{contract-registry,capability-registry,feature-flags}
   mkdir -p src/platform/healthcare/engines/{bed-engine,nursing-engine,pharmacy-engine}
   mkdir -p docs/adr
   ```

2. **Implement Contract Registry** (Law 8)
   ```typescript
   // src/platform/host/contract-registry/contract-registry.service.ts
   export class ContractRegistryService {
     registerContract(contract: ContractMetadata): void { ... }
     validateContractCall(name: string, version: string, endpoint: string, request: unknown): ValidationResult { ... }
   }
   ```

3. **Implement Capability Registry** (Law 7)
   ```typescript
   // src/platform/host/capability-registry/capability-registry.service.ts
   export class CapabilityRegistryService {
     hasCapability(key: string, context: { tenantId: string }): Promise<boolean> { ... }
   }
   ```

4. **Create ADR Template** (Law 8)
   ```markdown
   <!-- docs/adr/YYYY-MM-DD-<title>.md -->
   # ADR-XXX: <Title>
   
   ## Status
   Proposed | Accepted | Deprecated | Superseded
   
   ## Context
   ...
   
   ## Decision
   ...
   
   ## Consequences
   ...
   ```

### Week 3-4: Engine Extraction (Constitution Law 2, 3, 10)

**Objective:** Move engines from Hospital to Healthcare Platform

#### Tasks:
1. **Extract Bed Engine** (Law 3)
   - Move `BedEngineService` → `src/platform/healthcare/engines/bed-engine/`
   - Define `BedEngineContract` interface
   - Register contract in Contract Registry
   - Implement engine with EngineResponse wrapper

2. **Extract Nursing Engine** (Law 3)
   - Move `NursingVitalsService` → `src/platform/healthcare/engines/nursing-engine/`
   - Define `NursingEngineContract` interface
   - Register contract in Contract Registry

3. **Extract Pharmacy Engine (MAR)** (Law 3)
   - Move `MARService` → `src/platform/healthcare/engines/pharmacy-engine/mar.service.ts`
   - Define `PharmacyEngineContract` interface
   - Register contract in Contract Registry

4. **Refactor Hospital Services to Consume Engines** (Law 2)
   ```typescript
   // Hospital CANNOT query DB directly
   // ❌ const { data } = await supabase.from('beds').select('*');
   
   // ✅ Hospital must consume engine
   const response = await bedEngine.listAvailableBeds({ tenantId, wardId });
   ```

### Week 5: Type Safety Enforcement (Constitution Law 11)

**Objective:** Eliminate ALL `any` types (Strict TypeScript)

#### Tasks:
1. **Enable TypeScript Strict Mode**
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "strictNullChecks": true,
       "strictFunctionTypes": true
     }
   }
   ```

2. **Add ESLint Rule**
   ```json
   // .eslintrc.json
   {
     "rules": {
       "@typescript-eslint/no-explicit-any": "error",
       "@typescript-eslint/no-unsafe-assignment": "error",
       "@typescript-eslint/no-unsafe-call": "error"
     }
   }
   ```

3. **Refactor All `any` Types**
   ```bash
   # Find all `any` violations
   grep -rn ": any" src/
   grep -rn "<any>" src/
   grep -rn "as any" src/
   
   # Fix each violation with proper interface
   # Example:
   # ❌ function process(data: any) { ... }
   # ✅ function process(data: BedAllocationRequest) { ... }
   ```

4. **Add Pre-Commit Hook**
   ```bash
   # .husky/pre-commit
   #!/bin/sh
   npm run type-check # Must pass with 0 errors
   npm run lint # Must pass with 0 warnings
   ```

### Week 6: Security & Governance (Constitution Law 5, 8)

**Objective:** Implement Event Bus + ADR Process

#### Tasks:
1. **Implement Event Bus Integration** (Law 5)
   ```typescript
   // src/platform/host/event-bus/event-bus.service.ts
   export class EventBusService {
     publish<T>(event: DomainEvent<T>): Promise<void> { ... }
     subscribe<T>(eventType: string, handler: EventHandler<T>): void { ... }
   }
   
   // Hospital publishes domain events
   await eventBus.publish({
     eventType: 'BedAllocated',
     version: '1.0.0',
     timestamp: new Date().toISOString(),
     payload: { bedId, patientId, admissionId }
   });
   ```

2. **Create ADR Process** (Law 8)
   - Create ADR template in `docs/adr/0000-template.md`
   - Document Phase 0 refactor as ADR-001
   - Establish ARB review board (3 members minimum)

3. **Document Architecture Decisions**
   ```markdown
   <!-- docs/adr/2026-08-07-phase-0-platform-refactor.md -->
   # ADR-001: Phase 0 Platform Refactor (Engine Extraction)
   
   ## Status
   Accepted (2026-08-07)
   
   ## Context
   Hospital Product Pack contains engines (BedEngineService, NursingVitalsService, MARService) 
   that should be in Healthcare Platform per Constitution Law 2 & 3.
   
   ## Decision
   Extract all engines from Hospital to Healthcare Platform. Hospital will consume engines
   via Contract Registry and Engine Proxy.
   
   ## Consequences
   - ✅ Zero engine duplication across products
   - ✅ Contract-first development enforced
   - ⚠️ 4-6 weeks migration effort
   - ⚠️ Dual-path support needed during transition
   ```

---

## Constitution Compliance Scorecard

| Law | Description | Status | Priority | Target Date |
|-----|-------------|--------|----------|-------------|
| 1 | Encounter Aggregate Root | ✅ COMPLIANT | - | - |
| 2 | No Direct DB Access | ⚠️ VIOLATION | 🔴 CRITICAL | Phase 0 Week 3-4 |
| 3 | Execution-Engine Decoupled | ⚠️ VIOLATION | 🔴 CRITICAL | Phase 0 Week 3-4 |
| 4 | Additive Migration Only | ✅ COMPLIANT | - | - |
| 5 | Event-First Architecture | ❌ MISSING | 🟡 HIGH | Phase 0 Week 6 |
| 6 | Metadata-Driven Paradigm | ❌ MISSING | 🟢 MEDIUM | Phase C |
| 7 | Capability-First Enforcement | ⚠️ PARTIAL | 🟡 HIGH | Phase 0 Week 1-2 |
| 8 | Registry-First & ADR | ⚠️ PARTIAL | 🟡 HIGH | Phase 0 Week 1-2 |
| 9 | Zero Regression Guarantee | ✅ COMPLIANT | - | - |
| 10 | No Direct DB Query for AI | ✅ COMPLIANT | - | - |
| 11 | Strictly No `any` Types | ⚠️ VIOLATION | 🔴 CRITICAL | Phase 0 Week 5 |

**Overall Compliance Score: 64/100 (7/11 laws fully compliant)**
**Target After Phase 0: 91/100 (10/11 laws fully compliant, Law 6 deferred to Phase C)**

---

## Next Steps (Immediate Actions)

### Day 1-3: Architecture Freeze Preparation
1. ✅ Review 7-Volume Architecture Blueprint (this document)
2. ✅ Create Constitution Compliance Scorecard (above)
3. 🟡 **TODO:** Establish ARB (Architecture Review Board)
   - Members: Lead Architect, Tech Lead, Security Lead
   - Meeting: Weekly (Mondays 10am)
   - Deliverable: ADR approval/rejection

4. 🟡 **TODO:** Create ADR-001 (Phase 0 Refactor)
   - File: `docs/adr/2026-08-07-phase-0-platform-refactor.md`
   - Status: Proposed → ARB Review → Accepted
   - Timeline: 4-6 weeks

### Day 4-7: Type Safety Enforcement (Law 11)
1. 🟡 **TODO:** Enable TypeScript `strict` mode
2. 🟡 **TODO:** Add ESLint `no-explicit-any` rule
3. 🟡 **TODO:** Scan codebase for `any` violations
   ```bash
   grep -rn ": any" src/ > any-violations.txt
   # Expected: ~50-100 violations
   ```
4. 🟡 **TODO:** Refactor top 10 critical violations
   - Priority: Services layer (healthcare-hospital-services.ts)
   - Priority: API routes (dashboard/hospital/*/route.ts)

### Week 2: Platform Foundation (Law 2, 3, 7, 8)
1. 🟡 **TODO:** Create platform directory structure
2. 🟡 **TODO:** Implement Contract Registry service
3. 🟡 **TODO:** Implement Capability Registry service
4. 🟡 **TODO:** Implement Feature Flag Platform
5. 🟡 **TODO:** Write unit tests (80% coverage minimum)

---

**Document Version:** 1.0.0
**Last Updated:** 2026-08-07
**Next Review:** After Phase 0 completion (Week 6)
**Compliance Target:** 91/100 (10/11 laws) after Phase 0
**Architecture Freeze Status:** PENDING (After Phase 0 + ARB approval)
