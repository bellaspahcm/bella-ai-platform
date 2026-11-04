# Education Finance Responsibility Matrix
**Phase:** 2 — Education Discovery  
**Date:** 2026-08-18  
**Status:** IN PROGRESS  
**Objective:** Define clear boundaries between Education OS, Integration Layer, and Finance OS

---

## Governance Context

**From Meta-Platform Constitution (Phase 1):**
> Industry OS must adapt to Finance OS, NOT vice versa.

**Principle:**
- Education OS: Owns business domain
- Finance OS: Owns financial integrity
- Integration Layer: Transforms Education intent → Finance contract

> **Bella Preschool scope clarification (2026-11-03):** This Phase 2 matrix is general Education Finance discovery. Bella Preschool Fee Program definitions, pricing versions, publication, assignment, and fee calculation are Product-owned under the [Bella Preschool Fee Program Publish Contract](../products/bella-preschool/FEE_PROGRAM_PUBLISH_CONTRACT.md). Finance retains ownership of invoices, receivables, payments, and accounting treatment. This clarification does not move fee policy into the Education Kernel.

**No ambiguity allowed** - Every responsibility must have ONE clear owner.

---

## Responsibility Matrix

| Responsibility | Education OS | Integration Layer | Finance OS | Notes |
|---------------|-------------|-------------------|-----------|-------|
| **Domain Ownership** |
| Student lifecycle | ✅ | | | enrolled, paused, graduated, withdrawn |
| Course catalog | ✅ | | | courses, modules, lessons |
| Enrollment management | ✅ | | | student enrollment rules, capacity |
| Learning progress | ✅ | | | lesson completion, attendance |
| Class scheduling | ✅ | | | training_classes, trainer assignment |
| Payment recording | ✅ | | | student_tuition_payments (source data) |
| Receipt generation | ✅ | | | receipt_number issuance |
| Tuition pricing | ✅ | | | course.tuition_amount, student.tuition_total |
| **Financial Domain** |
| Chart of Accounts | | | ✅ | Finance Kernel (F1) |
| Double-entry integrity | | | ✅ | Finance Kernel (F2) |
| Idempotency (Finance) | | | ✅ | Finance Kernel (F3) |
| Tenant isolation (Finance) | | | ✅ | Finance Kernel (F4) |
| Transaction atomicity | | | ✅ | Finance Kernel (F5) |
| General Ledger posting | | | ✅ | Finance OS exclusive |
| Journal entry creation | | | ✅ | Finance OS exclusive |
| Accounts Receivable ledger | | | ✅ | Finance OS subsystem |
| Revenue recognition | | | ✅ | Finance OS (policy enforcement) |
| Cash position tracking | | | ✅ | Finance OS exclusive |
| Financial reporting | | | ✅ | Finance OS (balance sheet, P&L) |
| **Integration Responsibilities** |
| Education event detection | ✅ | | | Education publishes business events |
| Financial intent creation | | ✅ | | Maps Education event → Financial intent |
| Contract validation | | ✅ | | Ensures intent conforms to Finance contract |
| Education-to-Finance mapping | | ✅ | | Industry-specific transformation logic |
| Idempotency (Integration) | | ✅ | | Prevents duplicate intent publishing |
| Event enrichment | | ✅ | | Adds metadata required by Finance |
| Error handling (Integration) | | ✅ | | Retry, dead letter, quarantine |
| **Accounting Policy** |
| Revenue recognition policy | 🔴 PRODUCT | | | UNKNOWN - requires definition |
| Refund policy | 🔴 PRODUCT | | | UNKNOWN - requires definition |
| Bad debt policy | 🔴 PRODUCT | | | UNKNOWN - requires definition |
| AR model decision | 🔴 PRODUCT | | | UNKNOWN - AR or cash-only? |
| Policy enforcement | | | ✅ | Finance applies policy in GL posting |
| **Data Ownership** |
| Student master data | ✅ | | | Education owns student entity |
| Course master data | ✅ | | | Education owns course entity |
| Payment transaction data | ✅ | | | Education records payment event |
| Journal entry data | | | ✅ | Finance owns GL transactions |
| Account balances | | | ✅ | Finance owns financial position |
| Financial statements | | | ✅ | Finance generates reports |
| **Audit & Compliance** |
| Education audit trail | ✅ | | | Student changes, payment records |
| Financial audit trail | | | ✅ | Immutable GL journal history |
| Reconciliation | | ✅ | ✅ | Integration: source → Finance validation |
| | | | | Finance: GL balance verification |

---

## Detailed Responsibility Breakdown

### Education OS Responsibilities

**Business Domain:**
1. **Student Management**
   - Enrollment, status changes (active/paused/graduated/withdrawn)
   - Student master data (name, contact, enrollment date)
   - Enrollment rules (capacity, prerequisites)

2. **Course Management**
   - Course catalog (courses, modules, lessons)
   - Course pricing (tuition_amount)
   - Course content delivery

3. **Payment Recording**
   - Record payment transactions
   - Generate receipt_number (UNIQUE per tenant)
   - Track payment methods
   - Maintain running total (tuition_paid)
   - Payment voiding (status = 'voided')

4. **Learning Operations**
   - Lesson progress tracking
   - Class scheduling and attendance
   - Trainer assignment

**What Education Does NOT Own:**
- ❌ General Ledger posting
- ❌ Journal entry logic
- ❌ Chart of Accounts
- ❌ Financial reporting
- ❌ Revenue recognition timing (policy decision)
- ❌ Accounts Receivable balances

**Education publishes business events, NOT financial postings.**

---

### Integration Layer Responsibilities

**Transformation:**
1. **Financial Intent Creation**
   - Maps Education business events → Financial intents
   - Example: `TUITION_PAYMENT_RECEIVED` (Education) → `FinancialIntent: CASH_RECEIPT` (Finance contract)

2. **Contract Compliance**
   - Validates intent conforms to Finance Public Contract
   - Ensures required fields present
   - Enforces contract schema

3. **Event Enrichment**
   - Adds metadata required by Finance (tenant_id, currency, etc.)
   - Joins Education entities if needed (student → course → tuition_amount)

4. **Industry-Specific Mapping**
   - Education-specific concepts (student, course) → Finance-generic concepts (revenue, cash)
   - Adapter logic lives here (NOT in Finance OS)

**Resilience:**
5. **Idempotency Management**
   - Prevents duplicate financial intents for same Education event
   - Tracks published intents (idempotency registry)

6. **Error Handling**
   - Retry transient failures (Finance API unavailable)
   - Quarantine poison events (permanent failures)
   - Dead letter queue for manual review

7. **Observability**
   - Logs integration events
   - Monitors integration health
   - Alerts on integration failures

**Integration Layer is Education-specific, Finance-agnostic (uses contract only).**

---

### Finance OS Responsibilities

**Financial Integrity:**
1. **Double-Entry Bookkeeping**
   - All GL postings follow double-entry rules
   - Every debit has corresponding credit
   - F2 invariant enforced

2. **Chart of Accounts**
   - Maintains account structure
   - Account hierarchies and types
   - F1 invariant enforced

3. **Transaction Processing**
   - Receives financial intents via Public Contract
   - Translates intents → Journal entries
   - Posts to General Ledger
   - Updates subsidiary ledgers (AR, AP, etc.)

4. **Subsystem Management**
   - Accounts Receivable ledger
   - Cash management
   - Revenue recognition (policy enforcement)
   - Deferred revenue tracking

5. **Idempotency (Finance)**
   - Prevents duplicate GL postings for same financial intent
   - Uses idempotency key from intent
   - F3 invariant enforced

6. **Tenant Isolation**
   - Financial data isolated per tenant
   - Cross-tenant access prohibited
   - F4 invariant enforced

7. **Transaction Atomicity**
   - All-or-nothing posting
   - Rollback on error
   - F5 invariant enforced

**Reporting:**
8. **Financial Statements**
   - Balance Sheet
   - Profit & Loss
   - Cash Flow
   - Trial Balance

9. **Audit Trail**
   - Immutable journal history
   - Provenance tracking (source event → GL entry)

**Finance OS is Industry-agnostic, receives only general financial intents.**

---

## Boundary Clarifications

### Scenario 1: Student Makes Payment

**Education OS:**
```sql
-- Records payment transaction
INSERT INTO student_tuition_payments (
  student_id, amount, payment_method, 
  paid_at, receipt_number
)

-- Updates running total
UPDATE students
SET tuition_paid = tuition_paid + $amount
WHERE id = $studentId
```

**Integration Layer:**
```typescript
// Detects payment event (trigger? polling? outbox?)
// Creates financial intent
FinancialIntent {
  eventType: "CASH_RECEIPT",
  subType: "TUITION_PAYMENT",
  amount: payment.amount,
  currency: "VND",
  idempotencyKey: payment.receipt_number,
  metadata: {
    studentId: payment.student_id,
    educationReceiptNumber: payment.receipt_number
  }
}

// Publishes to Finance Public Contract
await financeAPI.publishIntent(intent);
```

**Finance OS:**
```typescript
// Receives intent via Public Contract
// Validates contract compliance
// Creates journal entry based on accounting policy

IF (accountingPolicy === "AR_MODEL"):
  DR Cash (amount)
  CR Accounts Receivable (amount)

IF (accountingPolicy === "CASH_BASIS"):
  DR Cash (amount)
  CR Tuition Revenue (amount)

// Posts to General Ledger (F1-F5 enforcement)
// Updates subsidiary ledgers
// Returns success response
```

**Key insight:**
- Education: Records business fact ("payment received")
- Integration: Transforms to financial intent ("cash receipt")
- Finance: Applies accounting policy, posts to GL

**No boundary ambiguity.**

---

### Scenario 2: Student Graduates

**Education OS:**
```sql
-- Updates enrollment status
UPDATE students
SET 
  enrollment_status = 'graduated',
  graduated_at = CURRENT_DATE
WHERE id = $studentId
```

**Integration Layer:**
```typescript
// Detects graduation event
// IF revenue recognition policy = "RECOGNIZE_ON_GRADUATION":

FinancialIntent {
  eventType: "REVENUE_RECOGNITION",
  subType: "TUITION_EARNED",
  amount: student.tuition_total,
  recognitionDate: student.graduated_at,
  idempotencyKey: `graduation-${student.id}`,
  metadata: {
    studentId: student.id,
    courseId: student.course_id,
    tuitionTotal: student.tuition_total,
    tuitionPaid: student.tuition_paid
  }
}

// ELSE IF policy = "RECOGNIZE_ON_PAYMENT":
//   No intent published (revenue already recognized at payment)

// Publishes to Finance (if policy requires)
```

**Finance OS:**
```typescript
// Receives intent
// Applies revenue recognition policy

IF (deferredRevenueExists):
  DR Deferred Revenue (amount)
  CR Tuition Revenue (amount)

// Posts to GL
// Updates revenue accounts
```

**Key insight:**
- Education: Records operational milestone ("student graduated")
- Integration: Determines if financial effect based on POLICY (UNKNOWN in Phase 2)
- Finance: Posts according to policy

**Boundary depends on Product Definition (revenue policy).**

---

### Scenario 3: Payment Voided

**Education OS:**
```sql
-- Marks payment as voided
UPDATE student_tuition_payments
SET payment_status = 'voided'
WHERE id = $paymentId

-- Reverses running total
UPDATE students
SET tuition_paid = tuition_paid - $amount
WHERE id = $studentId
```

**Integration Layer:**
```typescript
// Detects void event
FinancialIntent {
  eventType: "CASH_RECEIPT_REVERSAL",
  subType: "PAYMENT_VOID",
  amount: payment.amount,
  voidReason: "ERROR", // or "REFUND", "FRAUD"
  originalIdempotencyKey: payment.receipt_number,
  metadata: {
    studentId: payment.student_id,
    originalPaymentId: payment.id,
    voidedAt: CURRENT_TIMESTAMP
  }
}
```

**Finance OS:**
```typescript
// Receives reversal intent
// Finds original GL entry via originalIdempotencyKey
// Posts reversing entry

IF (original was: DR Cash, CR AR):
  DR AR, CR Cash

// Maintains audit trail (original + reversal preserved)
```

**Key insight:**
- Education: Records business reversal ("payment voided")
- Integration: Maps to financial reversal intent
- Finance: Posts reversing entry, maintains immutability

**Boundary clear: Education voids payment, Finance reverses posting.**

---

## Unknowns and Decisions Required

### Critical Decisions (Block Contract Design)

**Product Owner must define:**

1. **Revenue Recognition Policy**
   - When: Enrollment? Payment? Graduation? Pro-rated?
   - Affects: Touch Points #1, #2, #3
   - Impact: Determines AR model, deferred revenue, revenue timing

2. **Accounts Receivable Model**
   - Does Education use AR? Or cash-only?
   - If AR: Created when? (enrollment? invoice?)
   - Affects: Touch Points #1, #2, #3
   - Impact: Determines GL accounts used

3. **Refund Policy**
   - Full refund? Pro-rated? Forfeiture?
   - Depends on: Withdrawal timing? Course completion %?
   - Affects: Touch Point #4
   - Impact: Determines refund liability accounting

4. **Bad Debt Policy**
   - Unpaid balance at graduation: Write off? Collect?
   - Affects: Touch Point #3
   - Impact: Determines bad debt expense treatment

**Without these decisions, cannot design Finance Contract (Phase 3).**

---

### Medium Priority Decisions

5. **Trainer Compensation Scope**
   - Is this part of Education-Finance integration?
   - Or separate HR/Payroll-Finance integration?
   - Recommendation: OUT OF SCOPE for v1.1

6. **Scholarship Handling**
   - How applied? (tuition_total adjustment? separate discount?)
   - Accounting treatment? (contra-revenue? expense?)
   - Schema: Not visible in current Education OS
   - Recommendation: DEFER to v1.2 if not currently implemented

---

## Integration Architecture Patterns

### Pattern: Event-Driven Financial Intent

```
Education OS
  ├─ Business event occurs (payment, enrollment, graduation)
  ├─ Event stored in Education database
  ↓
Integration Layer (Outbox Pattern)
  ├─ Detects event (trigger? polling? outbox table?)
  ├─ Creates financial intent
  ├─ Validates contract compliance
  ├─ Publishes to Finance Public Contract
  ├─ Handles idempotency (prevents duplicates)
  ├─ Retries on transient failure
  ├─ Quarantines on permanent failure
  ↓
Finance OS (H1.1 Public Contract)
  ├─ Receives intent
  ├─ Validates contract
  ├─ Applies accounting policy
  ├─ Creates journal entry
  ├─ Posts to GL (F1-F5 enforcement)
  ├─ Updates subsidiary ledgers
  ├─ Returns success/idempotent/error response
```

**Key architectural decision from Phase 1:**
> Integration Hub (from H1.1) provides the contract boundary.

**Reuse existing infrastructure:**
- H1.1: Finance Public Contract
- H1.2: Outbox pattern, retry policy, observability

**Education-specific adapter:**
- NEW: Education event → Financial intent mapping
- NEW: Education domain enrichment logic

---

### Pattern: Idempotency Strategy

**Three-level idempotency:**

1. **Education Level**
   - `receipt_number` UNIQUE per tenant
   - Prevents duplicate payment records in Education

2. **Integration Level**
   - Tracks published intents (idempotency registry)
   - Prevents duplicate intent publishing for same Education event
   - Key: `receipt_number` or `(studentId, eventType, timestamp)`

3. **Finance Level**
   - Outbox idempotency (H1.2 proven)
   - Prevents duplicate GL posting for same intent
   - Key: Intent `idempotencyKey` field

**Result:** End-to-end exactly-once guarantee (I1 invariant from H1.1)

---

## Phase 2 Deliverables Summary

**Completed:**
1. ✅ `EDUCATION_FINANCE_DOMAIN_DISCOVERY.md`
   - Domain entities mapped from actual schema
   - Business model understood
   - 6 financial touch points identified
   - 10 unknowns documented

2. ✅ `EDUCATION_FINANCE_TOUCH_POINTS.md`
   - Each touch point analyzed in detail
   - Financial consequences (known/potential/unknown)
   - Financial intent candidates defined
   - Accounting treatment: known vs. PRODUCT-DEPENDENT
   - Idempotency requirements specified

3. ✅ `EDUCATION_FINANCE_RESPONSIBILITY_MATRIX.md` (this document)
   - Clear boundaries: Education / Integration / Finance
   - Responsibility matrix (no ambiguity)
   - Scenario walkthroughs (payment, graduation, void)
   - Integration architecture patterns
   - Unknowns consolidated

**Phase 2 Status:** ✅ **COMPLETE** (pending stakeholder review)

---

## Phase 2 → Phase 3 Transition

### Blockers for Phase 3

**MUST resolve before Contract Design:**
1. Revenue recognition policy (CRITICAL)
2. Accounts Receivable model (CRITICAL)
3. Refund policy (CRITICAL)
4. Bad debt policy (HIGH)

**CAN defer to later phases:**
5. Trainer compensation scope
6. Scholarship handling

---

### Phase 3 Entry Criteria

**Required:**
- ✅ Phase 2 artifacts complete
- ✅ Domain discovery validated
- ✅ Financial touch points mapped
- ✅ Responsibilities clarified
- 🔴 Product Owner provides: Revenue policy, AR model, Refund policy
- 🔴 Accounting Policy documented

**Phase 3 Objective:**
- Design Education Financial Integration Contract
- Map Education events → Finance contract schema
- Define adapter transformation logic (NOT implementation)
- Prepare for E-ARCH-1 gate

---

### E-ARCH-1 Gate Preview

**From Meta-Platform Constitution:**

E-ARCH-1 criteria (after Phase 3):
1. Contract Generality (works for Hospital, Education, future industries)
2. Finance Protection (no Finance Kernel mods, Hospital flows intact)
3. Additive Integration (extensions only, no breaking changes)
4. Boundary Clarity (Education / Finance separation clear)
5. Testability (integration verifiable, regression strategy defined)

**Phase 2 prepares for criteria #4 (Boundary Clarity)** ✅

---

## Recommendations

### For Product Owner

**Immediate action required:**
1. Define Revenue Recognition Policy
   - Enrollment? Payment? Graduation? Pro-rated?
2. Decide AR Model
   - Use AR? Or cash-only?
3. Document Refund Policy
   - Full? Pro-rated? Forfeiture?
4. Define Bad Debt Policy
   - Unpaid at graduation: Write off? Collect?

**Without these, Phase 3 blocked.**

---

### For Platform Architect

**Phase 3 preparation:**
1. Review Phase 2 artifacts for completeness
2. Validate boundary clarity (Education / Finance)
3. Ensure Meta-Platform Constitution compliance
4. Prepare E-ARCH-1 gate criteria checklist

**Phase 3 should NOT start until Product Definition complete.**

---

### For Education Team

**Domain validation:**
1. Confirm schema represents actual business process
2. Validate 6 financial touch points identified
3. Clarify any missing business rules
4. Confirm "unknowns" are truly undefined (not documented elsewhere)

---

## Conclusion

**Phase 2 Achievement:**
- ✅ Education domain mapped (8 core entities)
- ✅ 6 financial touch points identified and analyzed
- ✅ Boundaries clarified (Education / Integration / Finance)
- ✅ Responsibilities matrix (no ambiguity)
- ✅ 4 reusable patterns identified (for future industries)
- ✅ 10 unknowns documented (honest discovery)

**Key insight:**
> Education-Finance integration is NOT about adding "student" to Finance OS. It's about transforming Education business events into general financial intents that Finance OS already understands.

**Meta-Platform Constitution validated:**
> "Industry OS must adapt to Finance OS, NOT vice versa."

**Phase 2 demonstrates:** Education CAN adapt to Finance without Finance modification (pending Product Definition).

---

**Phase 2 Status:** ✅ **COMPLETE**  
**Blockers:** Product Owner must define Revenue/AR/Refund policies  
**Next:** Stakeholder review → Product Definition → Phase 3 Contract Design  
**Timeline:** Phase 3 cannot start until policies documented (estimated: 1-3 days for policy definition)

---

**END OF PHASE 2 DISCOVERY**
