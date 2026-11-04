# Education Finance P1-P4 Product Definition Proposal v1
**Phase:** Product Definition (Before Phase 3)  
**Date:** 2026-08-18  
**Status:** PROPOSAL (Requires Product Owner Review)  
**Purpose:** Define policy space for Education Finance Contract with Generality Principle

> **Bella Preschool Fee Program:** This proposal defines a general Education Finance policy space. It is not the source for Preschool fee versions, item applicability, or service-period resolution. See the [Bella Preschool Fee Program Publish Contract](../products/bella-preschool/FEE_PROGRAM_PUBLISH_CONTRACT.md). This pointer does not approve fee amounts or accounting treatment.

---

## Document Purpose

**This is NOT a decision** - This is a **PROPOSAL** for Product Owner review.

**What this document defines:**
- **Policy Space:** Range of valid accounting policies for Education
- **Semantic Model:** Common abstractions across education sub-industries
- **Configuration Points:** Where School/University/Training Center policies differ
- **Contract Implications:** How policies affect Finance integration design

**What this document does NOT do:**
- ❌ Make final policy decisions (Product Owner authority)
- ❌ Hard-code one education model
- ❌ Assume business rules without evidence

---

## Governance Context

**From Phase 2 findings:**
- 6 financial touch points identified
- 4 touch points **BLOCKED** on policy definition (P1-P4)
- 2 touch points **CLEAR** (can proceed)

**From Meta-Platform Constitution:**
> Education Finance Contract must work for School, University, Training Center, Academy, Language Center, Vocational + 3 imaginable types WITHOUT modifying contract core.

**Contract Generality Test (E-ARCH-1):**
```
New Education Type
    ↓
Domain Adapter + Policy Config
    ↓
Existing Education Contract (unchanged)
    ↓
Existing Finance OS (unchanged)
```

**Therefore:** P1-P4 must define **policy space**, not **policy choice**.

---

## P1: Revenue Recognition Policy

### Problem Statement

**From Phase 2 Touch Points:**
- Touch Point #1: Enrollment - Revenue obligation created?
- Touch Point #2: Payment - Revenue recognized immediately?
- Touch Point #3: Graduation - Revenue earned trigger?

**Question:**
> "When does Education recognize tuition revenue?"

**Wrong question:**
> "When does THIS school recognize revenue?"

**Right question:**
> "Can Education Contract represent ALL valid revenue recognition models for education sub-industries?"

---

### Policy Space Definition

**P1.1: Recognition Trigger Options**

Education sub-industries may recognize revenue at:

1. **ENROLLMENT** (Immediate Recognition)
   - Revenue recognized when student enrolls
   - Deferred Revenue liability created
   - Example: Some universities (tuition non-refundable)

2. **PAYMENT** (Cash-Basis)
   - Revenue recognized when payment received
   - No AR, no deferral
   - Example: Small training centers (cash accounting)

3. **COMPLETION** (Milestone-Based)
   - Revenue recognized when student graduates/completes
   - Deferred Revenue until milestone
   - Example: Vocational training (contingent on certification)

4. **PRO-RATED** (Time-Based)
   - Revenue recognized proportionally over course duration
   - Monthly/weekly revenue recognition entries
   - Example: Universities (semester-based amortization)

5. **HYBRID** (Multi-Trigger)
   - Different policies for different course types
   - Example: Theory courses (enrollment), Exam fees (completion)

**Configuration Required:**
```typescript
RevenueRecognitionPolicy {
  trigger: "ENROLLMENT" | "PAYMENT" | "COMPLETION" | "PRO_RATED" | "HYBRID"
  
  // For PRO_RATED:
  amortizationBasis?: "COURSE_DURATION" | "CALENDAR_TIME" | "LESSON_COMPLETION"
  recognitionPeriod?: "DAILY" | "WEEKLY" | "MONTHLY"
  
  // For HYBRID:
  ruleSet?: {
    courseType: string
    trigger: RecognitionTrigger
  }[]
  
  // For COMPLETION:
  completionCriteria?: "GRADUATED" | "EXAM_PASSED" | "CERTIFICATE_ISSUED"
}
```

---

### Semantic Model (Education-Wide)

**Common abstraction across all policies:**

```
Tuition Obligation Created
    ↓
Revenue Deferral (if applicable)
    ↓
Recognition Trigger Occurs
    ↓
Revenue Earned
```

**Financial Intents Required:**

1. **`TUITION_OBLIGATION_CREATED`**
   - Published: On enrollment (always)
   - Creates: Deferred Revenue liability (if policy requires)
   - OR: Creates AR (if policy requires)
   - OR: No GL entry (if cash-basis)

2. **`TUITION_REVENUE_RECOGNIZED`**
   - Published: On trigger (enrollment/payment/completion/pro-rated schedule)
   - Effect: Deferred Revenue → Revenue (or direct Revenue if cash-basis)

**Generality Test:**

| Education Type | Recognition Trigger | Contract Accommodates? |
|---------------|---------------------|------------------------|
| School (K-12) | Enrollment (semester-based) | ✅ PRO_RATED |
| University | Enrollment + Pro-rated | ✅ PRO_RATED |
| Training Center | Payment (cash-basis) | ✅ PAYMENT |
| Academy | Completion (certificate) | ✅ COMPLETION |
| Language Center | Payment | ✅ PAYMENT |
| Vocational | Graduation | ✅ COMPLETION |
| Corporate Training | Pro-rated (monthly) | ✅ PRO_RATED |

**Result:** ✅ Policy space covers known education types

---

### Contract Implications

**Education Finance Contract must support:**
1. Configurable recognition trigger (not hard-coded)
2. Deferred Revenue liability (optional, policy-dependent)
3. Revenue recognition events (separate from cash receipt events)
4. Pro-rated schedules (if time-based recognition)

**Finance OS requirements:**
- Deferred Revenue account (already exists in COA)
- Revenue account (already exists)
- Time-based recognition engine (if PRO_RATED) - **May need enhancement**

**Integration Layer requirements:**
- Policy configuration storage
- Recognition trigger detection
- Pro-rated schedule calculation (if applicable)
- Event publishing based on policy

---

### Product Owner Decision Required

**Choose ONE of:**

**Option A: Single Policy (Simple)**
> "All Education courses use [ENROLLMENT/PAYMENT/COMPLETION] recognition."

**Option B: Configurable Per Course Type (Moderate)**
> "Course type determines recognition policy (e.g., theory=ENROLLMENT, exam=COMPLETION)."

**Option C: Configurable Per Tenant (Advanced)**
> "Each education organization configures own policy."

**Recommendation:** **Option B** (balance between generality and complexity)

**Rationale:**
- Different course types genuinely have different revenue characteristics
- Tenant-level config may be overkill (unless multi-brand SaaS)
- Single policy too restrictive for education diversity

---

### Unknowns Requiring Clarification

1. **Does tuition_total ever change after enrollment?**
   - If yes: Revenue adjustment intent needed
   - If no: Revenue obligation fixed

2. **Are there enrollment fees separate from tuition?**
   - If yes: Different recognition policy?
   - If no: Single revenue stream (tuition only)

3. **Partial enrollments or course bundles?**
   - If yes: Revenue allocation rules needed
   - If no: One course = one revenue obligation

---

## P2: Accounts Receivable Model

### Problem Statement

**From Phase 2 Touch Points:**
- Touch Point #1: Enrollment - AR created?
- Touch Point #2: Payment - Reduces AR or recognizes revenue?

**Question:**
> "Does Education use Accounts Receivable?"

**Wrong question:**
> "Does this school have AR?"

**Right question:**
> "Can Education Contract support both AR-based and cash-only models?"

---

### Policy Space Definition

**P2.1: AR Capability Options**

Education sub-industries may use:

1. **FULL AR MODEL**
   - AR created at enrollment (or invoice)
   - Payments reduce AR
   - Revenue recognition separate from AR (depends on P1)
   - Example: Universities (tuition billed upfront, paid over time)

2. **CASH-ONLY MODEL**
   - No AR subsidiary ledger
   - Payment = Revenue (if cash-basis P1)
   - OR: Payment = Deferred Revenue reduction (if accrual P1)
   - Example: Small training centers (pay-as-you-go)

3. **HYBRID MODEL**
   - AR for some students (e.g., corporate clients)
   - Cash-only for others (e.g., individual students)
   - Configuration per student or enrollment type
   - Example: Academy (B2B invoiced, B2C cash)

**Configuration Required:**
```typescript
ARModel {
  capability: "FULL_AR" | "CASH_ONLY" | "HYBRID"
  
  // For FULL_AR:
  arCreationTrigger?: "ENROLLMENT" | "INVOICE_ISSUED"
  invoicingRule?: {
    timing: "IMMEDIATE" | "SCHEDULED" | "MILESTONE_BASED"
    terms: "DUE_ON_RECEIPT" | "NET_30" | "INSTALLMENT"
  }
  
  // For HYBRID:
  arEligibility?: "CORPORATE_CLIENTS" | "CREDIT_APPROVED" | "MANUAL"
}
```

---

### Semantic Model (Education-Wide)

**Common abstraction:**

```
FULL AR:
Enrollment → AR Created → Payment → AR Reduced

CASH-ONLY:
Enrollment → Obligation Tracked (off-GL) → Payment → Revenue/Deferred Revenue

HYBRID:
Enrollment → AR or Cash determination → Follow respective flow
```

**Financial Intents Required:**

1. **`AR_OBLIGATION_CREATED`** (FULL_AR only)
   - Published: On enrollment or invoice
   - Amount: `tuition_total`
   - Creates: DR AR, CR Deferred Revenue (or Revenue, depends on P1)

2. **`PAYMENT_RECEIVED_AR`** (FULL_AR only)
   - Published: On payment
   - Effect: DR Cash, CR AR

3. **`PAYMENT_RECEIVED_CASH`** (CASH_ONLY or HYBRID)
   - Published: On payment
   - Effect: DR Cash, CR Revenue (or Deferred Revenue, depends on P1)

**Generality Test:**

| Education Type | AR Model | Contract Accommodates? |
|---------------|----------|------------------------|
| School (K-12) | Full AR (tuition billed) | ✅ FULL_AR |
| University | Full AR (installments) | ✅ FULL_AR |
| Training Center | Cash-only | ✅ CASH_ONLY |
| Academy | Hybrid (B2B/B2C) | ✅ HYBRID |
| Language Center | Cash-only | ✅ CASH_ONLY |
| Vocational | Full AR | ✅ FULL_AR |
| Corporate Training | Full AR (invoiced) | ✅ FULL_AR |

**Result:** ✅ Policy space covers known models

---

### Contract Implications

**Education Finance Contract must support:**
1. Optional AR creation (not mandatory)
2. Dual payment flows (AR vs. cash-only)
3. AR balance tracking (if FULL_AR)
4. Hybrid determination rules (if HYBRID)

**Finance OS requirements:**
- AR subsidiary ledger (already exists from Hospital)
- Dual GL account structures:
  - AR model: DR AR, CR Deferred Revenue → DR Cash, CR AR
  - Cash model: DR Cash, CR Revenue (or Deferred Revenue)

**Integration Layer requirements:**
- AR model configuration per enrollment or tenant
- Payment flow routing (AR vs. cash)
- Balance tracking synchronization (Education `tuition_paid` vs. Finance AR balance)

---

### Product Owner Decision Required

**Choose ONE of:**

**Option A: Full AR Always**
> "All enrollments create AR. All payments reduce AR."

**Option B: Cash-Only Always**
> "No AR. Payment = immediate financial effect."

**Option C: Hybrid (Configurable)**
> "AR model determined by [student type / enrollment type / manual flag]."

**Recommendation:** **Option C (Hybrid)** - Maximum flexibility

**Rationale:**
- Education businesses often serve both B2B (invoiced) and B2C (cash) clients
- Corporate training clients expect invoicing
- Individual students often pay cash/card immediately
- Hybrid model covers both without separate integrations

---

### Unknowns Requiring Clarification

1. **Current Education OS: Is AR tracked?**
   - Evidence: `students.tuition_paid` exists (running balance)
   - Question: Is this AR balance? Or just payment tracking?
   - If AR balance: Reconciliation with Finance AR required

2. **Invoicing: Does Education issue invoices?**
   - If yes: Invoice entity needed (not found in schema)
   - If no: AR created directly at enrollment

3. **Credit terms: Are there payment installment rules?**
   - If yes: AR aging, collection tracking needed
   - If no: Simple AR (due on receipt)

---

## P3: Refund Policy

### Problem Statement

**From Phase 2 Touch Points:**
- Touch Point #4: Student Withdrawal - Refund due?

**Question:**
> "When student withdraws, how much refund?"

**Wrong question:**
> "What is THIS school's refund amount?"

**Right question:**
> "Can Education Contract represent all valid refund calculation methods?"

---

### Policy Space Definition

**P3.1: Refund Eligibility & Calculation Options**

Education sub-industries may refund:

1. **FULL REFUND**
   - 100% tuition returned
   - Conditions: Withdrawal within X days of enrollment
   - Example: Many schools (7-day cooling-off period)

2. **PRO-RATED REFUND**
   - Refund = (Remaining course duration / Total duration) × Tuition
   - OR: Refund = Tuition - (Lessons completed / Total lessons) × Tuition
   - Example: Universities (pro-rated by semester week)

3. **TIERED REFUND**
   - Refund percentage based on timing:
     - Week 1: 100%
     - Week 2-3: 50%
     - Week 4+: 0%
   - Example: Training centers (graduated forfeiture)

4. **FORFEITURE** (No Refund)
   - Tuition retained regardless of withdrawal timing
   - Example: Non-refundable course policies

5. **POLICY-BASED** (Rule Engine)
   - Refund calculated by complex rules:
     - Enrollment date, withdrawal date, course completion %, payment amount, etc.
   - Configurable per course type or tenant

**Configuration Required:**
```typescript
RefundPolicy {
  type: "FULL" | "PRO_RATED" | "TIERED" | "FORFEITURE" | "POLICY_BASED"
  
  // For FULL:
  eligibilityWindow?: number // Days from enrollment
  
  // For PRO_RATED:
  basis?: "TIME_BASED" | "LESSON_BASED" | "COMPLETION_PERCENTAGE"
  
  // For TIERED:
  tiers?: {
    maxDaysFromEnrollment: number
    refundPercentage: number // 0-100
  }[]
  
  // For POLICY_BASED:
  ruleSetId?: string // Reference to configurable rule engine
  
  // Common:
  administrativeFee?: number // Fixed fee deducted
  minimumRefund?: number // Floor amount
}
```

---

### Semantic Model (Education-Wide)

**Common abstraction:**

```
Student Withdraws
    ↓
Refund Eligibility Check (policy rules)
    ↓
Refund Amount Calculation (based on policy)
    ↓
Refund Liability Created (Finance)
    ↓
Refund Paid (Cash disbursement)
```

**Financial Intents Required:**

1. **`TUITION_REFUND_DUE`**
   - Published: On withdrawal (if refund eligible)
   - Amount: Calculated refund amount (based on policy)
   - Effect: DR Revenue (or Deferred Revenue), CR Refund Liability

2. **`REFUND_PAID`**
   - Published: When refund processed
   - Effect: DR Refund Liability, CR Cash

**Generality Test:**

| Education Type | Refund Policy | Contract Accommodates? |
|---------------|---------------|------------------------|
| School (K-12) | Pro-rated (semester) | ✅ PRO_RATED |
| University | Tiered (add/drop period) | ✅ TIERED |
| Training Center | Forfeiture | ✅ FORFEITURE |
| Academy | Full (7-day) | ✅ FULL |
| Language Center | Pro-rated (lessons) | ✅ PRO_RATED (lesson-based) |
| Vocational | Tiered | ✅ TIERED |
| Corporate Training | Policy-based (contract terms) | ✅ POLICY_BASED |

**Result:** ✅ Policy space covers known refund models

---

### Contract Implications

**Education Finance Contract must support:**
1. Refund amount calculation (or receive calculated amount from Education)
2. Refund liability creation
3. Revenue reversal (partial or full)
4. Cash disbursement tracking

**Finance OS requirements:**
- Refund Liability account (may need addition to COA)
- Revenue reversal (contra-revenue entries)
- Cash disbursement (already exists)

**Integration Layer requirements:**
- Refund policy configuration
- Refund calculation engine (or pass-through from Education)
- Withdrawal detection
- Refund intent publishing

---

### Product Owner Decision Required

**Choose ONE of:**

**Option A: Simple Policy (FULL or FORFEITURE)**
> "All withdrawals: [100% refund | No refund]."

**Option B: Time-Based (TIERED)**
> "Refund percentage based on withdrawal timing (define tiers)."

**Option C: Configurable (POLICY_BASED)**
> "Refund rules configured per course type or tenant."

**Recommendation:** **Option B (TIERED)** - Common in education

**Rationale:**
- Most education organizations have add/drop period with tiered refunds
- Simple to configure, understand, and audit
- Policy-based may be overkill for v1.1

---

### Unknowns Requiring Clarification

1. **Current refund processing: How done today?**
   - Manual? Automated?
   - Refund via original payment method? Or cash/check?

2. **Refund liability: Immediate or batched?**
   - Refund paid immediately on withdrawal?
   - Or: Liability created, paid on schedule (e.g., end of month)?

3. **Partial payments: If student paid 50%, withdrew, refund 80% tuition?**
   - Refund = min(paid, eligible_refund)?
   - Or: Refund can exceed paid (negative balance carried)?

---

## P4: Bad Debt Policy

### Problem Statement

**From Phase 2 Touch Points:**
- Touch Point #3: Student Graduated with unpaid balance (tuition_paid < tuition_total)

**Question:**
> "What happens to unpaid tuition balance?"

**Wrong question:**
> "Does this school write off bad debt?"

**Right question:**
> "Can Education Contract support various bad debt recognition and collection policies?"

---

### Policy Space Definition

**P4.1: Bad Debt Recognition & Collection Options**

Education sub-industries may handle unpaid balances:

1. **AUTO WRITE-OFF** (Graduation Forgiveness)
   - Unpaid balance written off when student graduates
   - DR Bad Debt Expense, CR AR (or Deferred Revenue)
   - Example: Some vocational schools (partial scholarship)

2. **COLLECTION ACTIVE** (Post-Graduation Collection)
   - Unpaid balance remains collectible after graduation
   - No write-off
   - Collection continues (may involve external agency)
   - Example: Universities (student loan collection)

3. **AGING-BASED WRITE-OFF**
   - Unpaid balance written off after X days overdue
   - Independent of graduation status
   - Example: 90 days past due → bad debt
   - Common in AR models

4. **MANUAL REVIEW**
   - Each case reviewed individually
   - CFO/Controller approves write-off
   - No automatic write-off rules

5. **HYBRID** (Status-Dependent)
   - Graduated: Forgive (write off)
   - Withdrawn: Collect (remain on AR)
   - Example: Goodwill policy for completers

**Configuration Required:**
```typescript
BadDebtPolicy {
  recognitionTrigger: "AUTO_GRADUATION" | "AGING" | "MANUAL" | "HYBRID"
  
  // For AUTO_GRADUATION:
  writeOffOnGraduation?: boolean // If true, forgive unpaid balance
  
  // For AGING:
  agingThreshold?: number // Days overdue
  agingTiers?: {
    daysOverdue: number
    action: "REMINDER" | "COLLECTION" | "WRITE_OFF"
  }[]
  
  // For MANUAL:
  approvalRequired?: boolean
  approvalRole?: string // "CFO" | "CONTROLLER"
  
  // For HYBRID:
  rules?: {
    enrollmentStatus: "GRADUATED" | "WITHDRAWN" | "PAUSED"
    action: "WRITE_OFF" | "COLLECT" | "HOLD"
  }[]
  
  // Common:
  collectionAgency?: boolean // External collection?
}
```

---

### Semantic Model (Education-Wide)

**Common abstraction:**

```
Unpaid Balance Identified
    ↓
Bad Debt Policy Check
    ↓
IF WRITE_OFF:
  Bad Debt Expense Created
  AR Reduced
ELSE IF COLLECT:
  Collection Process Initiated
  AR Remains
```

**Financial Intents Required:**

1. **`BAD_DEBT_RECOGNIZED`**
   - Published: When write-off triggered (by policy)
   - Amount: Unpaid balance (tuition_total - tuition_paid)
   - Effect: DR Bad Debt Expense, CR AR (or Deferred Revenue)

2. **`COLLECTION_INITIATED`**
   - Published: When collection process starts (if policy requires)
   - Informational (may not have GL effect)
   - Tracks collection status

**Generality Test:**

| Education Type | Bad Debt Policy | Contract Accommodates? |
|---------------|-----------------|------------------------|
| School (K-12) | Auto write-off (graduation) | ✅ AUTO_GRADUATION |
| University | Collection (student loans) | ✅ COLLECTION_ACTIVE |
| Training Center | Aging (90 days) | ✅ AGING |
| Academy | Hybrid (graduated=forgive, withdrawn=collect) | ✅ HYBRID |
| Language Center | Manual review | ✅ MANUAL |
| Vocational | Auto write-off (graduation) | ✅ AUTO_GRADUATION |
| Corporate Training | Aging (30 days, then collection) | ✅ AGING |

**Result:** ✅ Policy space covers known policies

---

### Contract Implications

**Education Finance Contract must support:**
1. Bad debt expense recognition (configurable trigger)
2. AR write-off
3. Optional collection tracking (informational)
4. Graduation status → Financial effect (if policy requires)

**Finance OS requirements:**
- Bad Debt Expense account (already exists in standard COA)
- AR write-off capability (already exists)
- Aging report (if AGING policy) - May need enhancement

**Integration Layer requirements:**
- Bad debt policy configuration
- Graduation event detection → Bad debt check
- Aging calculation (if applicable)
- Write-off intent publishing

---

### Product Owner Decision Required

**Choose ONE of:**

**Option A: Forgiveness (AUTO_GRADUATION)**
> "Unpaid balance at graduation is forgiven (written off as bad debt)."

**Option B: Collection (COLLECTION_ACTIVE)**
> "Unpaid balance remains collectible post-graduation."

**Option C: Hybrid**
> "Graduated = forgive, Withdrawn = collect."

**Recommendation:** **Option A (Forgiveness)** - If scholarship/goodwill model

OR **Option B (Collection)** - If strict AR management

**Rationale:**
- Option A: Common in training/vocational (encourages completion)
- Option B: Common in universities (financial discipline)
- Depends on business model philosophy

---

### Unknowns Requiring Clarification

1. **Current practice: What happens today with unpaid balances?**
   - Are students allowed to graduate with unpaid balance?
   - Or: Payment completion required before graduation?

2. **Legal/regulatory: Are there jurisdiction-specific rules?**
   - Some regions prohibit withholding education credentials for non-payment
   - May force AUTO_GRADUATION policy

3. **Scholarship vs. Bad Debt: How distinguished?**
   - If `tuition_total < course.tuition_amount`, is that scholarship?
   - Or: Scholarship tracked separately?
   - Bad debt should be unexpected loss, not planned scholarship

---

## Policy Interaction Matrix

**P1-P4 are NOT independent** - Combinations affect accounting treatment:

| P1 (Revenue) | P2 (AR) | P3 (Refund) | P4 (Bad Debt) | Combined Effect |
|-------------|---------|-------------|---------------|-----------------|
| ENROLLMENT | FULL_AR | PRO_RATED | COLLECTION | DR AR, CR Def. Revenue (enrollment) → DR Def. Revenue, CR Revenue (time) → DR Bad Debt, CR AR (if unpaid) |
| PAYMENT | CASH_ONLY | FULL | FORGIVENESS | DR Cash, CR Revenue (payment) → DR Revenue, CR Cash (refund) → No bad debt (cash-only) |
| COMPLETION | FULL_AR | TIERED | HYBRID | DR AR, CR Def. Revenue (enrollment) → DR Def. Revenue, CR Revenue (graduation) → Bad debt if withdrawn, forgive if graduated |

**Contract must handle all valid combinations.**

---

## Generality Validation

### Contract Generality Test

**For each policy, verify:**

1. **School (K-12):**
   - P1: PRO_RATED (semester-based) ✅
   - P2: FULL_AR (tuition billed) ✅
   - P3: PRO_RATED (refund by semester) ✅
   - P4: AUTO_GRADUATION (forgive unpaid) ✅
   - **Verdict:** ✅ Supported

2. **University:**
   - P1: PRO_RATED (monthly) ✅
   - P2: FULL_AR (installments) ✅
   - P3: TIERED (add/drop period) ✅
   - P4: COLLECTION (strict AR) ✅
   - **Verdict:** ✅ Supported

3. **Training Center:**
   - P1: PAYMENT (cash-basis) ✅
   - P2: CASH_ONLY ✅
   - P3: FORFEITURE ✅
   - P4: N/A (no AR) ✅
   - **Verdict:** ✅ Supported

4. **Academy:**
   - P1: COMPLETION (certificate) ✅
   - P2: HYBRID (B2B AR, B2C cash) ✅
   - P3: FULL (7-day) ✅
   - P4: HYBRID (graduated=forgive, withdrawn=collect) ✅
   - **Verdict:** ✅ Supported

5. **Language Center:**
   - P1: PAYMENT (cash-basis) ✅
   - P2: CASH_ONLY ✅
   - P3: PRO_RATED (by lessons) ✅
   - P4: N/A (no AR) ✅
   - **Verdict:** ✅ Supported

6. **Vocational:**
   - P1: COMPLETION (certification) ✅
   - P2: FULL_AR ✅
   - P3: TIERED ✅
   - P4: AUTO_GRADUATION ✅
   - **Verdict:** ✅ Supported

7. **Corporate Training:**
   - P1: PRO_RATED (monthly invoicing) ✅
   - P2: FULL_AR (B2B invoices) ✅
   - P3: POLICY_BASED (contract terms) ✅
   - P4: AGING (30-day collection) ✅
   - **Verdict:** ✅ Supported

**Generality Test Result:** ✅ **PASS**

All known education sub-industries can be supported via policy configuration, WITHOUT modifying Education Finance Contract core.

---

## Imaginable Education Types (Generality Extension Test)

**3 additional imaginable education models:**

1. **Online Learning Platform (Coursera/Udemy model):**
   - P1: PAYMENT (immediate revenue on course purchase)
   - P2: CASH_ONLY (credit card)
   - P3: TIERED (30-day money-back guarantee)
   - P4: N/A (no AR)
   - **Verdict:** ✅ Supported (PAYMENT + CASH_ONLY + TIERED)

2. **Bootcamp (Intensive Short-Term Training):**
   - P1: HYBRID (deposit on enrollment, balance on completion)
   - P2: HYBRID (deposit cash, balance AR)
   - P3: TIERED (full refund before start, no refund after)
   - P4: COLLECTION (strict payment before certificate)
   - **Verdict:** ✅ Supported (HYBRID policies)

3. **Subscription-Based Learning (Membership Model):**
   - P1: PRO_RATED (monthly subscription revenue)
   - P2: CASH_ONLY (monthly billing)
   - P3: FULL (cancel anytime, refund unused portion)
   - P4: N/A (no long-term AR)
   - **Verdict:** ✅ Supported (PRO_RATED + CASH_ONLY)

**Extension Test Result:** ✅ **PASS**

Imaginable future education models can be accommodated with existing policy space.

---

## Contract Design Implications

### Phase 3 Requirements

**Education Finance Contract must include:**

1. **Policy Configuration Layer**
   ```typescript
   EducationFinancePolicy {
     tenantId: string
     revenueRecognition: RevenueRecognitionPolicy
     arModel: ARModel
     refundPolicy: RefundPolicy
     badDebtPolicy: BadDebtPolicy
   }
   ```

2. **Financial Intent Types**
   - `TUITION_OBLIGATION_CREATED` (enrollment)
   - `TUITION_REVENUE_RECOGNIZED` (trigger-dependent)
   - `AR_OBLIGATION_CREATED` (if FULL_AR)
   - `PAYMENT_RECEIVED_AR` (if FULL_AR)
   - `PAYMENT_RECEIVED_CASH` (if CASH_ONLY)
   - `TUITION_REFUND_DUE` (withdrawal)
   - `REFUND_PAID` (refund processed)
   - `BAD_DEBT_RECOGNIZED` (write-off)

3. **Metadata Requirements**
   - All intents must include: studentId, courseId, tenantId, policyReference
   - Enrollment event: enrolledAt, tuitionTotal, tuitionPaid (current)
   - Payment event: receiptNumber (idempotency), paymentMethod, amount
   - Withdrawal event: withdrawnAt, daysFromEnrollment, completionPercentage
   - Graduation event: graduatedAt, unpaidBalance

4. **Contract Versioning**
   - Version 1.1: Initial Education integration
   - Policy changes: Backward compatible (add policies, don't remove)
   - Contract must version independently from policy configuration

---

### Finance OS Requirements

**Minimal Finance OS changes:**
- ✅ Deferred Revenue account (already exists)
- ✅ AR subsidiary ledger (already exists from Hospital)
- ✅ Bad Debt Expense account (standard COA)
- 🟡 Refund Liability account (may need addition - verify COA)
- 🟡 Pro-rated revenue recognition engine (if P1=PRO_RATED) - May need enhancement

**Conclusion:** Finance OS largely ready, minimal enhancements

---

### Integration Layer Complexity

**Moderate complexity:**
- Policy configuration management (CRUD)
- Policy-based routing (different intent types based on policy)
- Refund calculation engine (if not delegated to Education OS)
- Pro-rated schedule generation (if P1=PRO_RATED)
- AR balance reconciliation (Education tuition_paid vs. Finance AR)

**Manageable with existing H1.2 patterns (Outbox, retry, idempotency).**

---

## Product Owner Decision Summary

**Product Owner must decide for each policy:**

### P1: Revenue Recognition
- [ ] Choose: ENROLLMENT / PAYMENT / COMPLETION / PRO_RATED / HYBRID
- [ ] If PRO_RATED: Define amortization basis
- [ ] If HYBRID: Define course-type rules

### P2: Accounts Receivable
- [ ] Choose: FULL_AR / CASH_ONLY / HYBRID
- [ ] If FULL_AR: Define AR creation trigger
- [ ] If HYBRID: Define eligibility rules

### P3: Refund Policy
- [ ] Choose: FULL / PRO_RATED / TIERED / FORFEITURE / POLICY_BASED
- [ ] Define eligibility window or tiers
- [ ] Define administrative fees (if any)

### P4: Bad Debt Policy
- [ ] Choose: AUTO_GRADUATION / COLLECTION / AGING / MANUAL / HYBRID
- [ ] Define write-off trigger or aging thresholds
- [ ] Define collection process (if applicable)

---

## Recommendations

**For v1.1 (Simplicity + Generality Balance):**

**Recommended Policy Set A (Training Center Model):**
- P1: PAYMENT (cash-basis)
- P2: CASH_ONLY
- P3: TIERED (7-day full, 30-day 50%, after none)
- P4: N/A (no AR, no bad debt)

**Pros:** Simplest implementation, fastest to market  
**Cons:** Doesn't prove AR capability, limited to cash-based education

---

**Recommended Policy Set B (University Model):**
- P1: PRO_RATED (semester/monthly)
- P2: FULL_AR
- P3: TIERED (add/drop period)
- P4: COLLECTION (strict AR management)

**Pros:** Proves full capability (AR, deferral, collection), closer to Hospital complexity  
**Cons:** More complex implementation, longer dev time

---

**Recommended Policy Set C (Hybrid Model - BEST FOR GENERALITY PROOF):**
- P1: HYBRID (cash-basis for short courses, pro-rated for long programs)
- P2: HYBRID (cash for individuals, AR for corporate)
- P3: TIERED (standard add/drop)
- P4: HYBRID (forgive graduated, collect withdrawn)

**Pros:** Proves Contract Generality, covers most education types  
**Cons:** Most complex, requires robust configuration layer

---

**My Recommendation:** **Policy Set B** (University Model)

**Rationale:**
1. Proves Education Contract can handle complexity similar to Hospital
2. AR + Deferral + Pro-rated = full Finance OS capability exercise
3. Collection policy proves bad debt handling
4. Not too complex (no hybrid routing)
5. Upgradeable to Set C in v1.2 (add hybrid support)

---

## Next Steps

**After Product Owner Decision:**

1. **Formalize Product Definition**
   - Document chosen policies (P1-P4)
   - Create formal policy configuration schema
   - Approve as official product requirement

2. **Phase 3: Contract Design**
   - Design Education Finance Contract (based on P1-P4)
   - Map Education events → Financial intents (policy-aware)
   - Define adapter transformation logic
   - Prepare E-ARCH-1 gate documentation

3. **E-ARCH-1 Gate**
   - Verify Contract Generality (use matrix from this document)
   - Verify Finance Protection (no Kernel changes)
   - Verify Boundary Clarity (Education/Integration/Finance)
   - Obtain architecture approval

4. **Phase 4+: Implementation**
   - Implement adapter (policy-driven)
   - Implement policy configuration UI (if needed)
   - Integration testing
   - Regression (Hospital flows intact)

---

## Conclusion

**This proposal demonstrates:**
- ✅ P1-P4 can be defined as **policy space** (not hard-coded choice)
- ✅ Contract Generality Test: All known education types supported
- ✅ Extension Test: Imaginable future types supported
- ✅ Finance OS: Minimal changes required
- ✅ Integration Layer: Manageable complexity
- ✅ Template Potential: Pattern reusable for future industries

**Awaiting Product Owner decision on P1-P4 to proceed to Phase 3.**

---

**Document Status:** PROPOSAL  
**Requires:** Product Owner review and policy selection  
**Blocks:** Phase 3 (Contract Design) until P1-P4 finalized  
**Estimated Review Time:** 1-3 days

---

**END OF P1-P4 PROPOSAL V1**
