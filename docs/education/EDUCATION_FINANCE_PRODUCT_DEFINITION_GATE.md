# Education Finance Product Definition Gate
**Phase:** Product Definition (Before Phase 3)  
**Date:** 2026-08-18  
**Status:** IN PROGRESS  
**Purpose:** Define Education Finance Capability Model and Policy Space for Contract Generality

> **Bella Preschool Fee Program:** This gate covers general Education Finance capabilities and policy space. Fee Program definitions, immutable version publication, item applicability, and billing-period resolution for Bella Preschool are owned by the Product and specified in the [Bella Preschool Fee Program Publish Contract](../products/bella-preschool/FEE_PROGRAM_PUBLISH_CONTRACT.md). This gate does not define Preschool fee amounts or select its accounting policy.

---

## Document Purpose

**This is the FINAL product definition gate before Phase 3 Contract Design.**

**What this gate defines:**
- ✅ **Capability Model:** What Education Finance Contract MUST be capable of
- ✅ **Policy Space:** Range of valid configurations (NOT one choice)
- ✅ **Generality Criteria:** Structural proof of generality
- ✅ **Contract Requirements:** Input for Phase 3 design

**What this gate does NOT do:**
- ❌ Choose specific policies for implementation
- ❌ Design contract (Phase 3)
- ❌ Write code
- ❌ Lock Education into one business model

---

## Governance Context

**Current Position:**
```
Phase 2: Discovery          🔒 COMPLETE
    ↓
P1-P4 Policy-Space Proposal ✅ APPROVED
    ↓
Product Definition Gate     🟡 IN PROGRESS  ← WE ARE HERE
    ↓
Phase 3: Contract Design    🔴 BLOCKED
    ↓
E-ARCH-1 Gate              ⏳ AFTER Phase 3
    ↓
Implementation             ⏳ AFTER E-ARCH-1
```

**Gate Success Criteria:**
1. ✅ Capability Model complete and general
2. ✅ Policy Space adequate for all education types
3. ✅ Generality structurally proven (not just examples)
4. ✅ Finance Protection maintained (Finance = authority)
5. ✅ No specific policy choice locked in

**When this gate PASSES:**
→ Product Definition FROZEN (as capability model + policy space)  
→ Phase 3 UNBLOCKED (Contract Design can begin)

---

## Principle 1: Capability ≠ Policy

**Capability:** What the system CAN do  
**Policy:** What the system WILL do (configured per tenant/industry)

**Example:**
```
Revenue Recognition Capability
    ↓
Has capacity to support:
├── Immediate recognition
├── Milestone-based recognition
└── Time-based recognition
    ↓
Policy Profile determines WHICH to use
```

**Anti-pattern:**
```
❌ Revenue Recognition = University Model (hard-coded)
```

**Correct:**
```
✅ Revenue Recognition Capability = General abstraction
✅ University Profile = Configuration of capability
```

---

## Principle 2: Finance Remains Authority

**Education Integration Layer:**
- Transforms Education business events → Financial intents
- Publishes intents via Finance Public Contract
- Does NOT decide GL accounts, journal entries, or financial treatment

**Finance OS:**
- Receives financial intents
- Applies accounting policies
- Enforces F1-F5 invariants
- Posts to General Ledger
- Maintains financial integrity

**Boundary:**
```
Education OS
    ↓
Business Event (Student enrolled, Payment received)
    ↓
Integration Layer
    ↓
Financial Intent (Revenue obligation, Cash receipt)
    ↓
Finance OS
    ↓
Financial Treatment (DR/CR accounts, GL posting)
    ↓
F1-F5 Enforcement
```

**Finance Protection Rule:**
> Integration Layer creates intents. Finance OS owns accounting.

---

## Principle 3: Policy Engine ≠ Accounting Engine

**Integration Layer responsibilities:**
- Detect Education business events
- Evaluate policy rules (WHAT should happen)
- Create financial intents (semantic meaning)
- Publish to Finance contract

**Integration Layer does NOT:**
- ❌ Calculate journal entries
- ❌ Choose GL accounts
- ❌ Decide DR/CR treatment
- ❌ Become an accounting system

**Example (Refund - P3):**
```
❌ Wrong:
Integration calculates refund amount
Integration decides: DR Revenue, CR Refund Liability
Integration posts to GL

✅ Right:
Education detects withdrawal
Policy evaluates refund eligibility
Integration publishes: FinancialIntent { type: "REFUND_DUE", amount }
Finance OS applies accounting treatment
Finance OS posts to GL with F1-F5 enforcement
```

**Rationale:**
- Finance OS has complete financial context (COA, policies, balances)
- Integration Layer only has Education context
- Separating concerns maintains Finance Protection

---

## Principle 4: Generality Must Be Structural, Not Example-Based

**Insufficient:**
```
❌ Generality Test:
School ✅ University ✅ Training Center ✅
Conclusion: General enough.
```

**Sufficient:**
```
✅ Generality Proof:
New Education Type
    ↓
Domain Adapter (maps entities)
    ↓
Policy Profile (configures behavior)
    ↓
Existing Education Finance Contract (UNCHANGED)
    ↓
Existing Finance OS (UNCHANGED)
    ↓
SUCCESS
```

**Structural Test:**
> Can a new education sub-industry be added WITHOUT modifying contract core?

**If answer is NO:**
→ Contract is NOT general
→ Must redesign capability model

**If answer is YES:**
→ Contract IS general
→ New sub-industry = Adapter + Policy config only

---

## Principle 5: Policy Profiles Are Reference Configurations

**Policy Profiles (University, School, Training, etc.) are:**
- ✅ Examples of valid configurations
- ✅ Reference implementations
- ✅ Proof that capability model works
- ✅ Starting templates for real deployments

**Policy Profiles are NOT:**
- ❌ Product Definition requirements
- ❌ Mandatory implementations
- ❌ Hard-coded into contract
- ❌ The only supported configurations

**Contract must support:**
> Any valid configuration within policy space, NOT just predefined profiles.

---

## Education Finance Capability Model

### Architecture Overview

```
                EDUCATION OS
                     │
        Education Finance Contract
                     │
    ┌────────────────┼────────────────┐
    │                │                │
    ↓                ↓                ↓
Revenue          Obligation       Settlement
Recognition      Management       Management
Capability       Capability       Capability
    │                │                │
    └────────────────┼────────────────┘
                     ↓
         Refund Management Capability
                     ↓
       Bad Debt Management Capability
                     ↓
            Financial Intent
                     ↓
              Finance OS
                     ↓
                  F1-F5
```

**Five Core Capabilities:**
1. **Revenue Recognition Capability** - When and how revenue is recognized
2. **Obligation Management Capability** - Tracking financial obligations (AR or off-balance)
3. **Settlement Management Capability** - How payments settle obligations
4. **Refund Management Capability** - Handling withdrawals and refunds
5. **Bad Debt Management Capability** - Handling uncollectible balances

---

## Capability 1: Revenue Recognition

### Capability Definition

**Purpose:** Enable Education Contract to support multiple revenue recognition models without contract modification.

**Semantic Model:**
```
Tuition Obligation Created
    ↓
Recognition Basis Determined (policy)
    ↓
Recognition Trigger Occurs
    ↓
Revenue Recognized
```

**Three-Dimensional Model:**

**Dimension 1: Recognition Basis**
- **Immediate** - Revenue recognized at single point in time
- **Milestone** - Revenue recognized at completion event
- **Over Time** - Revenue amortized over period

**Dimension 2: Recognition Trigger**
- **Enrollment** - Event: Student enrolls
- **Payment** - Event: Payment received
- **Completion** - Event: Student graduates/completes
- **Schedule** - Event: Time passage (daily/weekly/monthly)

**Dimension 3: Allocation Rule**
- **Full** - 100% of tuition recognized at trigger
- **Pro-rated** - Proportional to completion/time
- **Rule-based** - Complex policy engine evaluation

**Configuration Schema:**
```typescript
RevenueRecognitionCapability {
  // Dimension 1: Basis
  recognitionBasis: "IMMEDIATE" | "MILESTONE" | "OVER_TIME"
  
  // Dimension 2: Trigger
  recognitionTrigger: "ENROLLMENT" | "PAYMENT" | "COMPLETION" | "SCHEDULE"
  
  // Dimension 3: Allocation
  allocationRule: "FULL" | "PRO_RATED" | "RULE_BASED"
  
  // Additional config for OVER_TIME basis
  amortizationConfig?: {
    period: "DAILY" | "WEEKLY" | "MONTHLY"
    basis: "CALENDAR_TIME" | "COURSE_DURATION" | "LESSON_COMPLETION"
  }
  
  // Additional config for RULE_BASED allocation
  ruleEngine?: {
    ruleSetId: string
    evaluationContext: string[]
  }
}
```

### Policy Space

**Valid Combinations:**

| Basis | Trigger | Allocation | Example Use Case |
|-------|---------|-----------|------------------|
| IMMEDIATE | ENROLLMENT | FULL | Vocational (non-refundable) |
| IMMEDIATE | PAYMENT | FULL | Training center (cash-basis) |
| MILESTONE | COMPLETION | FULL | Academy (contingent on certificate) |
| OVER_TIME | SCHEDULE | PRO_RATED | University (semester amortization) |
| OVER_TIME | SCHEDULE | RULE_BASED | Corporate training (milestone-based) |
| IMMEDIATE | PAYMENT | PRO_RATED | Language center (per-lesson) |

**Policy Space Size:** 3 × 4 × 3 = 36 potential combinations (not all semantically valid)

**Generality Test:**
> Can contract represent: Cash-basis, Accrual-basis, Milestone-based, Time-based revenue recognition?

**Answer:** ✅ YES (via Basis + Trigger + Allocation configuration)

### Financial Intents

**Intent 1: `REVENUE_OBLIGATION_CREATED`**
```typescript
{
  type: "REVENUE_OBLIGATION_CREATED",
  amount: number,
  currency: string,
  recognitionPolicy: {
    basis: string,
    trigger: string,
    allocation: string
  },
  metadata: {
    studentId: string,
    courseId: string,
    enrolledAt: Date,
    expectedCompletionDate?: Date
  }
}
```

**Intent 2: `REVENUE_RECOGNIZED`**
```typescript
{
  type: "REVENUE_RECOGNIZED",
  amount: number, // May be partial if PRO_RATED
  recognitionDate: Date,
  recognitionTrigger: "ENROLLMENT" | "PAYMENT" | "COMPLETION" | "SCHEDULE",
  metadata: {
    obligationId: string,
    completionPercentage?: number,
    periodCovered?: { start: Date, end: Date }
  }
}
```

### Finance OS Treatment

**Finance receives intent → Applies accounting policy:**

| Basis | Finance Treatment |
|-------|------------------|
| IMMEDIATE | DR Cash/AR, CR Revenue (immediate) |
| MILESTONE | DR Cash/AR, CR Deferred Revenue → DR Deferred Revenue, CR Revenue (at milestone) |
| OVER_TIME | DR Cash/AR, CR Deferred Revenue → Periodic: DR Deferred Revenue, CR Revenue |

**Finance decides GL accounts and treatment. Integration only provides intent.**

---

## Capability 2: Obligation Management

### Capability Definition

**Purpose:** Enable Education Contract to support both AR-based and non-AR financial obligation models.

**Key Insight from Product Owner Review:**
> Settlement Model (AR vs. cash) is INDEPENDENT from Revenue Recognition Model.

**Semantic Model:**
```
Tuition Obligation Created
    ↓
Obligation Tracking Model Determined (policy)
    ↓
├── AR Model: Obligation tracked in AR subsidiary ledger
└── Off-Balance Model: Obligation tracked in Education OS only
    ↓
Payment Received
    ↓
Obligation Settled (full or partial)
```

**Two-Dimensional Model:**

**Dimension 1: Obligation Tracking**
- **AR Tracked** - Obligation creates AR entry (subsidiary ledger)
- **Off-Balance** - Obligation tracked in Education OS (`tuition_total - tuition_paid`), NOT in GL

**Dimension 2: Creation Trigger**
- **Enrollment** - AR created when student enrolls
- **Invoice** - AR created when invoice issued
- **None** - No AR creation (off-balance only)

**Configuration Schema:**
```typescript
ObligationManagementCapability {
  // Dimension 1: Tracking model
  trackingModel: "AR_TRACKED" | "OFF_BALANCE"
  
  // Dimension 2: Creation trigger (if AR_TRACKED)
  arCreationTrigger?: "ENROLLMENT" | "INVOICE"
  
  // Invoicing rules (if INVOICE trigger)
  invoicingConfig?: {
    timing: "IMMEDIATE" | "SCHEDULED" | "MILESTONE"
    terms: "DUE_ON_RECEIPT" | "NET_30" | "NET_60" | "INSTALLMENT"
    installmentSchedule?: {
      count: number
      frequency: "WEEKLY" | "MONTHLY"
    }
  }
  
  // Hybrid model (optional)
  hybridRules?: {
    arEligibility: "CORPORATE_CLIENTS" | "CREDIT_APPROVED" | "ENROLLMENT_TYPE"
    defaultModel: "AR_TRACKED" | "OFF_BALANCE"
  }
}
```

### Policy Space

**Valid Configurations:**

| Tracking Model | Creation Trigger | Example Use Case |
|---------------|------------------|------------------|
| AR_TRACKED | ENROLLMENT | University (tuition billed at enrollment) |
| AR_TRACKED | INVOICE | Corporate training (invoiced monthly) |
| OFF_BALANCE | None | Training center (cash-only, no AR) |
| HYBRID | Conditional | Academy (B2B invoiced, B2C cash) |

**Generality Test:**
> Can contract support: AR model, Cash-only model, Hybrid model?

**Answer:** ✅ YES (via Tracking Model + Creation Trigger configuration)

### Financial Intents

**Intent 1: `AR_OBLIGATION_CREATED`** (AR_TRACKED only)
```typescript
{
  type: "AR_OBLIGATION_CREATED",
  amount: number,
  currency: string,
  dueDate?: Date,
  terms?: string,
  metadata: {
    studentId: string,
    courseId: string,
    invoiceNumber?: string,
    obligationId: string
  }
}
```

**Intent 2: `OBLIGATION_UPDATED`** (Adjustment/Write-off)
```typescript
{
  type: "OBLIGATION_UPDATED",
  obligationId: string,
  adjustment: {
    amount: number, // Positive = increase, Negative = decrease
    reason: "DISCOUNT" | "SCHOLARSHIP" | "CORRECTION" | "WRITE_OFF"
  },
  metadata: {
    approvedBy?: string,
    note?: string
  }
}
```

### Finance OS Treatment

**Finance receives intent → Applies accounting policy:**

| Tracking Model | Finance Treatment |
|---------------|------------------|
| AR_TRACKED | DR Accounts Receivable, CR Deferred Revenue (or Revenue, depends on C1) |
| OFF_BALANCE | No GL entry at obligation creation (memo only) |

**Important:** Obligation tracking model does NOT dictate revenue recognition model.

**Example combinations:**
- AR_TRACKED + IMMEDIATE revenue = DR AR, CR Revenue (enrollment)
- AR_TRACKED + MILESTONE revenue = DR AR, CR Deferred Revenue (enrollment) → DR Deferred Revenue, CR Revenue (completion)
- OFF_BALANCE + PAYMENT revenue = No entry until payment → DR Cash, CR Revenue (payment)

---

## Capability 3: Settlement Management

### Capability Definition

**Purpose:** Enable Education Contract to support multiple payment settlement models.

**Semantic Model:**
```
Payment Received
    ↓
Settlement Model Determined (policy)
    ↓
├── AR Settlement: Payment reduces AR balance
└── Immediate Settlement: Payment → Revenue/Deferred Revenue
    ↓
Financial Effect Applied
```

**Key Insight from Product Owner Review:**
> Payment → Cash is universal. Payment → Revenue is NOT universal.
> Cash-only does NOT mean Payment = Revenue. Could be Payment → Deferred Revenue.

**Two-Dimensional Model:**

**Dimension 1: Settlement Target**
- **AR Settlement** - Payment reduces Accounts Receivable
- **Deferred Revenue Settlement** - Payment reduces Deferred Revenue (if obligation created earlier)
- **Direct Revenue** - Payment directly recognizes revenue (cash-basis)

**Dimension 2: Payment Timing**
- **Pre-obligation** - Payment before enrollment (advance payment)
- **Concurrent** - Payment at enrollment
- **Post-obligation** - Payment after enrollment (installment)

**Configuration Schema:**
```typescript
SettlementManagementCapability {
  // Dimension 1: Settlement target
  settlementTarget: "AR" | "DEFERRED_REVENUE" | "DIRECT_REVENUE"
  
  // Dimension 2: Payment timing expectation
  expectedPaymentTiming: "PRE_OBLIGATION" | "CONCURRENT" | "POST_OBLIGATION"
  
  // Overpayment handling
  overpaymentPolicy: {
    action: "CREDIT_BALANCE" | "REFUND" | "APPLY_TO_NEXT"
    threshold?: number
  }
  
  // Partial payment handling
  partialPaymentPolicy: {
    allowed: boolean
    minimumAmount?: number
    allocationRule?: "FIFO" | "LIFO" | "PRO_RATA" | "SPECIFIED"
  }
}
```

### Policy Space

**Valid Configurations:**

| Settlement Target | Payment Timing | Example Use Case |
|------------------|----------------|------------------|
| AR | POST_OBLIGATION | University (installment payments) |
| DEFERRED_REVENUE | CONCURRENT | School (semester prepaid) |
| DIRECT_REVENUE | CONCURRENT | Training center (cash-basis) |
| DEFERRED_REVENUE | PRE_OBLIGATION | Language center (advance payment) |

**Generality Test:**
> Can contract support: AR reduction, Deferred revenue application, Direct revenue recognition?

**Answer:** ✅ YES (via Settlement Target configuration)

### Financial Intents

**Intent 1: `PAYMENT_RECEIVED`**
```typescript
{
  type: "PAYMENT_RECEIVED",
  amount: number,
  currency: string,
  paymentMethod: "CASH" | "BANK_TRANSFER" | "CARD" | "VIETQR" | "OTHER",
  paidAt: Date,
  receiptNumber: string, // Idempotency key
  settlementTarget: "AR" | "DEFERRED_REVENUE" | "DIRECT_REVENUE",
  metadata: {
    studentId: string,
    obligationId?: string,
    recordedBy: string,
    paymentReference?: string
  }
}
```

**Intent 2: `PAYMENT_VOIDED`**
```typescript
{
  type: "PAYMENT_VOIDED",
  originalPaymentId: string,
  originalReceiptNumber: string,
  voidReason: "ERROR" | "REFUND_PROCESSED" | "FRAUD" | "DUPLICATE",
  voidedAt: Date,
  metadata: {
    voidedBy: string,
    note?: string
  }
}
```

### Finance OS Treatment

**Finance receives intent → Applies accounting policy:**

| Settlement Target | Finance Treatment |
|------------------|------------------|
| AR | DR Cash, CR Accounts Receivable |
| DEFERRED_REVENUE | DR Cash, CR Deferred Revenue (revenue recognized separately per C1) |
| DIRECT_REVENUE | DR Cash, CR Revenue (immediate recognition) |

**Void Treatment:**
- Reverses original entry
- Maintains audit trail (original + reversal)

---

## Capability 4: Refund Management

### Capability Definition

**Purpose:** Enable Education Contract to support multiple refund calculation and processing models.

**Semantic Model:**
```
Student Withdraws
    ↓
Refund Policy Evaluation
    ↓
├── Refund Eligible → Calculate refund amount (policy-based)
└── Not Eligible → No refund
    ↓
Refund Liability Created (if eligible)
    ↓
Refund Processed
```

**Key Insight from Product Owner Review:**
> Policy evaluation determines WHAT should happen (refund amount).
> Finance OS determines HOW it's financially treated (GL accounts, entries).

**Configuration Schema:**
```typescript
RefundManagementCapability {
  // Refund eligibility model
  eligibilityModel: "ALWAYS" | "TIME_BASED" | "MILESTONE_BASED" | "NEVER" | "RULE_BASED"
  
  // Time-based eligibility (if TIME_BASED)
  timeBasedRules?: {
    eligibilityWindow: number // Days from enrollment
    tiers?: {
      maxDaysFromEnrollment: number
      refundPercentage: number // 0-100
    }[]
  }
  
  // Milestone-based eligibility (if MILESTONE_BASED)
  milestoneRules?: {
    completionThreshold: number // Percentage (0-100)
    refundFormula: "LINEAR" | "STEPPED" | "FIXED"
  }
  
  // Rule-based (if RULE_BASED)
  ruleEngine?: {
    ruleSetId: string
    inputVariables: string[] // e.g., ["daysElapsed", "completionPercentage", "paymentCount"]
  }
  
  // Administrative fees
  administrativeFee?: {
    type: "FIXED" | "PERCENTAGE"
    amount: number
  }
  
  // Refund processing
  processingConfig: {
    method: "ORIGINAL_PAYMENT_METHOD" | "CASH" | "BANK_TRANSFER" | "CHECK"
    timing: "IMMEDIATE" | "BATCH" | "SCHEDULED"
    approvalRequired: boolean
  }
}
```

### Policy Space

**Valid Configurations:**

| Eligibility Model | Calculation | Example Use Case |
|------------------|-------------|------------------|
| ALWAYS | 100% refund | Money-back guarantee (7-day) |
| TIME_BASED | Tiered (100% week 1, 50% week 2-3, 0% after) | University add/drop period |
| MILESTONE_BASED | Pro-rated by completion % | Language center (by lessons) |
| NEVER | No refund | Non-refundable training |
| RULE_BASED | Complex policy | Corporate training (contract terms) |

**Generality Test:**
> Can contract support: Full refund, Partial refund, Pro-rated refund, No refund, Policy-based refund?

**Answer:** ✅ YES (via Eligibility Model + Calculation configuration)

### Financial Intents

**Intent 1: `REFUND_DUE`**
```typescript
{
  type: "REFUND_DUE",
  refundAmount: number, // Calculated by policy engine
  currency: string,
  reason: "WITHDRAWAL" | "CANCELLATION" | "ERROR_CORRECTION" | "SATISFACTION_GUARANTEE",
  eligibilityEvaluation: {
    eligible: boolean,
    calculationMethod: string,
    policyReference: string,
    evaluationDate: Date
  },
  metadata: {
    studentId: string,
    obligationId: string,
    originalAmount: number,
    amountPaid: number,
    daysFromEnrollment: number,
    completionPercentage?: number
  }
}
```

**Intent 2: `REFUND_PROCESSED`**
```typescript
{
  type: "REFUND_PROCESSED",
  refundId: string,
  amount: number,
  paymentMethod: string,
  processedAt: Date,
  metadata: {
    studentId: string,
    refundReference: string,
    processedBy: string
  }
}
```

### Finance OS Treatment

**Finance receives intent → Applies accounting policy:**

**Refund Liability Creation:**
```
DR Revenue (or Deferred Revenue)
CR Refund Liability
```

**Refund Payment:**
```
DR Refund Liability
CR Cash
```

**Finance decides:**
- Which revenue account to reverse (current year? prior year?)
- Whether to create liability or pay immediately
- GL posting sequence and atomicity

**Integration Layer does NOT decide financial treatment.**

---

## Capability 5: Bad Debt Management

### Capability Definition

**Purpose:** Enable Education Contract to support multiple bad debt recognition and collection policies.

**Semantic Model:**
```
Unpaid Balance Identified
    ↓
Bad Debt Policy Evaluation
    ↓
├── Write-off → Bad debt recognized
└── Collection → AR remains active
    ↓
Financial Effect Applied (if write-off)
```

**Key Insight from Product Owner Review:**
> Policy determines WHEN and WHETHER to write off.
> Finance OS performs the write-off with proper GL treatment.

**Configuration Schema:**
```typescript
BadDebtManagementCapability {
  // Recognition trigger
  recognitionTrigger: "AUTO_GRADUATION" | "AUTO_WITHDRAWAL" | "AGING" | "MANUAL" | "NEVER"
  
  // Auto graduation policy (if AUTO_GRADUATION)
  graduationPolicy?: {
    writeOffUnpaidBalance: boolean
    requiresApproval: boolean
    approvalThreshold?: number
  }
  
  // Auto withdrawal policy (if AUTO_WITHDRAWAL)
  withdrawalPolicy?: {
    writeOffUnpaidBalance: boolean
    gracePeriodDays?: number
  }
  
  // Aging policy (if AGING)
  agingPolicy?: {
    writeOffThreshold: number // Days overdue
    agingTiers?: {
      daysOverdue: number
      action: "REMINDER" | "COLLECTION" | "LEGAL" | "WRITE_OFF"
    }[]
  }
  
  // Manual policy (if MANUAL)
  manualPolicy?: {
    approvalRole: "CFO" | "CONTROLLER" | "CREDIT_MANAGER"
    requiresDocumentation: boolean
  }
  
  // Collection process
  collectionConfig?: {
    internalCollectionDays: number
    externalAgency: boolean
    agencyThreshold?: number
  }
}
```

### Policy Space

**Valid Configurations:**

| Recognition Trigger | Action | Example Use Case |
|--------------------|--------|------------------|
| AUTO_GRADUATION | Write-off unpaid balance | Vocational (goodwill for completers) |
| AUTO_WITHDRAWAL | Keep collectible | University (strict AR management) |
| AGING | Write-off after 90 days | Training center (aging-based) |
| MANUAL | Case-by-case review | Academy (requires approval) |
| NEVER | Always collect | Corporate training (B2B contracts) |

**Generality Test:**
> Can contract support: Auto write-off, Collection, Aging-based, Manual review, Never write-off?

**Answer:** ✅ YES (via Recognition Trigger + Action configuration)

### Financial Intents

**Intent 1: `BAD_DEBT_IDENTIFIED`**
```typescript
{
  type: "BAD_DEBT_IDENTIFIED",
  obligationId: string,
  unpaidAmount: number,
  currency: string,
  identificationReason: "GRADUATED_UNPAID" | "WITHDRAWN_UNPAID" | "AGING_THRESHOLD" | "MANUAL_REVIEW",
  policyEvaluation: {
    action: "WRITE_OFF" | "COLLECTION" | "HOLD",
    trigger: string,
    evaluationDate: Date
  },
  metadata: {
    studentId: string,
    enrollmentStatus: string,
    daysOverdue?: number,
    approvedBy?: string
  }
}
```

**Intent 2: `BAD_DEBT_RECOVERED`** (Optional - if collection successful)
```typescript
{
  type: "BAD_DEBT_RECOVERED",
  originalBadDebtId: string,
  recoveredAmount: number,
  recoveryDate: Date,
  metadata: {
    recoveryMethod: "PAYMENT" | "SETTLEMENT" | "LEGAL"
  }
}
```

### Finance OS Treatment

**Finance receives intent → Applies accounting policy:**

**Write-off:**
```
DR Bad Debt Expense
CR Accounts Receivable
```

**Recovery (if applicable):**
```
DR Cash
CR Bad Debt Expense (or Recovery Income)
```

**Finance decides:**
- Bad debt expense account classification
- Whether to create allowance or direct write-off
- Recovery accounting treatment

**Integration Layer does NOT perform write-off. Finance does.**

---

## Generality Structural Proof

### Generality Criteria

**For Education Finance Contract to be considered GENERAL:**

**Criterion 1: Capability Independence**
> Each capability (C1-C5) must be independently configurable without affecting others.

**Test:**
- Can C1 (Revenue) = IMMEDIATE while C2 (Obligation) = AR_TRACKED? ✅ YES
- Can C2 (Obligation) = OFF_BALANCE while C3 (Settlement) = DEFERRED_REVENUE? ✅ YES
- Can C4 (Refund) = TIME_BASED while C1 (Revenue) = MILESTONE? ✅ YES

**Result:** ✅ PASS - Capabilities are orthogonal

---

**Criterion 2: New Education Type Test**
> A new education sub-industry must be supportable via Domain Adapter + Policy Profile only.

**Test Procedure:**
```
1. Define new education type (e.g., "Subscription Learning Platform")
2. Map domain entities to Education Finance Contract
3. Configure policy profile (C1-C5)
4. Verify: Contract unchanged? ✅ / ❌
5. Verify: Finance OS unchanged? ✅ / ❌
```

**Test Case 1: Subscription Learning Platform**
```
Business Model:
- Monthly subscription ($50/month)
- Access to course library
- Cancel anytime, refund unused portion

Mapping:
- C1 (Revenue): OVER_TIME + SCHEDULE + PRO_RATED (monthly recognition)
- C2 (Obligation): OFF_BALANCE (no AR, prepaid model)
- C3 (Settlement): DEFERRED_REVENUE + CONCURRENT (monthly prepay)
- C4 (Refund): TIME_BASED (pro-rated by unused days)
- C5 (Bad Debt): NEVER (no AR, no bad debt)

Contract modification needed? ❌ NO
Finance OS modification needed? ❌ NO
Result: ✅ PASS
```

**Test Case 2: Intensive Bootcamp**
```
Business Model:
- $10,000 tuition (deposit $2,000 upfront, balance on completion)
- No refund after start date
- Payment required before certificate

Mapping:
- C1 (Revenue): MILESTONE + COMPLETION + FULL
- C2 (Obligation): AR_TRACKED + ENROLLMENT (balance tracked in AR)
- C3 (Settlement): AR + POST_OBLIGATION (installment)
- C4 (Refund): TIME_BASED (full refund before start, none after)
- C5 (Bad Debt): MANUAL (case-by-case)

Contract modification needed? ❌ NO
Finance OS modification needed? ❌ NO
Result: ✅ PASS
```

**Test Case 3: Enterprise Learning Management System**
```
Business Model:
- B2B contracts ($100k/year)
- Invoiced quarterly
- Pro-rated revenue recognition
- Contract penalties for early termination

Mapping:
- C1 (Revenue): OVER_TIME + SCHEDULE + PRO_RATED (quarterly)
- C2 (Obligation): AR_TRACKED + INVOICE (quarterly invoicing)
- C3 (Settlement): AR + POST_OBLIGATION
- C4 (Refund): RULE_BASED (contract penalty rules)
- C5 (Bad Debt): AGING (30-day collection)

Contract modification needed? ❌ NO
Finance OS modification needed? ❌ NO
Result: ✅ PASS
```

**Generality Structural Proof Result:** ✅ **3/3 PASS**

---

**Criterion 3: Policy Combination Test**
> All semantically valid policy combinations must be representable.

**Combination Count:**
- C1: 3 basis × 4 trigger × 3 allocation = 36 (subset valid)
- C2: 2 tracking × 2 creation = 4
- C3: 3 settlement × 3 timing = 9
- C4: 5 eligibility models
- C5: 5 recognition triggers

**Total theoretical combinations:** 36 × 4 × 9 × 5 × 5 = 32,400

**Semantically valid subset:** ~200-500 (estimated)

**Contract must support any valid combination, not enumerate all.**

**Test:** Can contract schema represent arbitrary valid combination?

**Answer:** ✅ YES (via configuration schema, not hard-coded enum)

---

**Criterion 4: Finance Protection Test**
> Integration Layer must NOT become accounting system.

**Test:** For each capability, verify Integration Layer does NOT:
- ❌ Choose GL accounts
- ❌ Calculate journal entries
- ❌ Post to General Ledger
- ❌ Enforce F1-F5 invariants

**Review:**
- C1 (Revenue): Integration publishes intent → Finance decides recognition treatment ✅
- C2 (Obligation): Integration publishes intent → Finance creates AR (or not) ✅
- C3 (Settlement): Integration publishes intent → Finance posts to GL ✅
- C4 (Refund): Integration publishes intent → Finance reverses revenue ✅
- C5 (Bad Debt): Integration publishes intent → Finance writes off AR ✅

**Result:** ✅ PASS - Finance remains authority

---

**Criterion 5: Extension Test**
> New capability (C6) must be addable without breaking C1-C5.

**Hypothetical C6: Scholarship Management**

```typescript
ScholarshipManagementCapability {
  scholarshipType: "FULL" | "PARTIAL" | "MERIT_BASED" | "NEED_BASED"
  accounting: "CONTRA_REVENUE" | "EXPENSE" | "DISCOUNT"
  eligibility: {
    criteria: string[]
    renewalPolicy?: string
  }
}
```

**Impact on existing capabilities:**
- C1 (Revenue): Scholarship affects amount, NOT recognition model ✅
- C2 (Obligation): Scholarship reduces obligation, NOT tracking model ✅
- C3 (Settlement): Scholarship doesn't affect settlement ✅
- C4 (Refund): Scholarship may affect refund calculation ✅
- C5 (Bad Debt): Scholarship doesn't affect bad debt ✅

**Contract modification needed:** Add C6 capability ✅ (additive, not breaking)

**Result:** ✅ PASS - Extensible architecture

---

## Generality Proof Summary

| Criterion | Test | Result |
|-----------|------|--------|
| Capability Independence | Orthogonal configuration | ✅ PASS |
| New Education Type | 3 new types without contract change | ✅ PASS (3/3) |
| Policy Combination | Arbitrary valid combinations supported | ✅ PASS |
| Finance Protection | Integration ≠ Accounting System | ✅ PASS |
| Extension | New capability addable without breaking | ✅ PASS |

**Overall Generality Proof:** ✅ **5/5 PASS**

**Conclusion:** Education Finance Contract (when designed per this capability model) is structurally general.

---

## Policy Profile Examples (Reference Only)

**IMPORTANT:** These profiles are **EXAMPLES**, not **REQUIREMENTS**.

**Purpose:**
- Demonstrate capability model usage
- Provide starting templates
- Prove generality structurally

**These profiles do NOT:**
- ❌ Define Product Definition
- ❌ Mandate implementation
- ❌ Lock contract to specific models

---

### Profile 1: University Model (Reference)

```typescript
{
  name: "University Profile",
  description: "Traditional semester-based university with AR and deferred revenue",
  
  C1_RevenueRecognition: {
    recognitionBasis: "OVER_TIME",
    recognitionTrigger: "SCHEDULE",
    allocationRule: "PRO_RATED",
    amortizationConfig: {
      period: "MONTHLY",
      basis: "CALENDAR_TIME"
    }
  },
  
  C2_ObligationManagement: {
    trackingModel: "AR_TRACKED",
    arCreationTrigger: "ENROLLMENT",
    invoicingConfig: {
      timing: "IMMEDIATE",
      terms: "INSTALLMENT",
      installmentSchedule: {
        count: 4,
        frequency: "MONTHLY"
      }
    }
  },
  
  C3_SettlementManagement: {
    settlementTarget: "AR",
    expectedPaymentTiming: "POST_OBLIGATION",
    partialPaymentPolicy: {
      allowed: true,
      allocationRule: "FIFO"
    }
  },
  
  C4_RefundManagement: {
    eligibilityModel: "TIME_BASED",
    timeBasedRules: {
      tiers: [
        { maxDaysFromEnrollment: 7, refundPercentage: 100 },
        { maxDaysFromEnrollment: 21, refundPercentage: 50 },
        { maxDaysFromEnrollment: 999, refundPercentage: 0 }
      ]
    },
    processingConfig: {
      approvalRequired: true,
      timing: "SCHEDULED"
    }
  },
  
  C5_BadDebtManagement: {
    recognitionTrigger: "AGING",
    agingPolicy: {
      writeOffThreshold: 180,
      agingTiers: [
        { daysOverdue: 30, action: "REMINDER" },
        { daysOverdue: 60, action: "COLLECTION" },
        { daysOverdue: 90, action: "LEGAL" },
        { daysOverdue: 180, action: "WRITE_OFF" }
      ]
    }
  }
}
```

**Use Case:** Large university with strict AR management, installment payments, and collection processes.

---

### Profile 2: Training Center Model (Reference)

```typescript
{
  name: "Training Center Profile",
  description: "Small cash-based training center with immediate revenue recognition",
  
  C1_RevenueRecognition: {
    recognitionBasis: "IMMEDIATE",
    recognitionTrigger: "PAYMENT",
    allocationRule: "FULL"
  },
  
  C2_ObligationManagement: {
    trackingModel: "OFF_BALANCE"
  },
  
  C3_SettlementManagement: {
    settlementTarget: "DIRECT_REVENUE",
    expectedPaymentTiming: "CONCURRENT"
  },
  
  C4_RefundManagement: {
    eligibilityModel: "TIME_BASED",
    timeBasedRules: {
      eligibilityWindow: 7,
      tiers: [
        { maxDaysFromEnrollment: 7, refundPercentage: 100 },
        { maxDaysFromEnrollment: 999, refundPercentage: 0 }
      ]
    },
    processingConfig: {
      method: "ORIGINAL_PAYMENT_METHOD",
      approvalRequired: false,
      timing: "IMMEDIATE"
    }
  },
  
  C5_BadDebtManagement: {
    recognitionTrigger: "NEVER" // No AR, no bad debt
  }
}
```

**Use Case:** Small training center, cash accounting, minimal financial complexity.

---

### Profile 3: Vocational School Model (Reference)

```typescript
{
  name: "Vocational School Profile",
  description: "Vocational training with completion-based revenue and goodwill write-off",
  
  C1_RevenueRecognition: {
    recognitionBasis: "MILESTONE",
    recognitionTrigger: "COMPLETION",
    allocationRule: "FULL"
  },
  
  C2_ObligationManagement: {
    trackingModel: "AR_TRACKED",
    arCreationTrigger: "ENROLLMENT"
  },
  
  C3_SettlementManagement: {
    settlementTarget: "AR",
    expectedPaymentTiming: "POST_OBLIGATION",
    partialPaymentPolicy: {
      allowed: true,
      minimumAmount: 500000 // VND
    }
  },
  
  C4_RefundManagement: {
    eligibilityModel: "MILESTONE_BASED",
    milestoneRules: {
      completionThreshold: 50, // 50% completion
      refundFormula: "LINEAR" // Pro-rated by remaining %
    }
  },
  
  C5_BadDebtManagement: {
    recognitionTrigger: "AUTO_GRADUATION",
    graduationPolicy: {
      writeOffUnpaidBalance: true, // Goodwill for completers
      requiresApproval: false
    }
  }
}
```

**Use Case:** Vocational school encouraging completion, revenue contingent on certification, goodwill for graduates.

---

### Profile 4: Corporate Academy Model (Reference)

```typescript
{
  name: "Corporate Academy Profile",
  description: "B2B corporate training with invoicing and rule-based policies",
  
  C1_RevenueRecognition: {
    recognitionBasis: "OVER_TIME",
    recognitionTrigger: "SCHEDULE",
    allocationRule: "RULE_BASED",
    ruleEngine: {
      ruleSetId: "corporate_milestone_recognition",
      evaluationContext: ["milestoneCompleted", "invoiceIssued"]
    }
  },
  
  C2_ObligationManagement: {
    trackingModel: "AR_TRACKED",
    arCreationTrigger: "INVOICE",
    invoicingConfig: {
      timing: "MILESTONE",
      terms: "NET_30"
    }
  },
  
  C3_SettlementManagement: {
    settlementTarget: "AR",
    expectedPaymentTiming: "POST_OBLIGATION"
  },
  
  C4_RefundManagement: {
    eligibilityModel: "RULE_BASED",
    ruleEngine: {
      ruleSetId: "corporate_contract_terms",
      inputVariables: ["daysFromStart", "contractType", "earlyTerminationClause"]
    },
    processingConfig: {
      approvalRequired: true,
      timing: "SCHEDULED"
    }
  },
  
  C5_BadDebtManagement: {
    recognitionTrigger: "AGING",
    agingPolicy: {
      writeOffThreshold: 120
    },
    collectionConfig: {
      internalCollectionDays: 60,
      externalAgency: true,
      agencyThreshold: 5000000 // VND
    }
  }
}
```

**Use Case:** Corporate B2B training, complex contracts, rule-based policies, strict collection.

---

## Contract Requirements for Phase 3

**Phase 3 Contract Design must deliver:**

### 1. Capability Configuration Schema

**Contract must include configuration for all 5 capabilities:**
```typescript
EducationFinancePolicyConfiguration {
  tenantId: string
  effectiveDate: Date
  version: string
  
  revenueRecognition: RevenueRecognitionCapability
  obligationManagement: ObligationManagementCapability
  settlementManagement: SettlementManagementCapability
  refundManagement: RefundManagementCapability
  badDebtManagement: BadDebtManagementCapability
}
```

### 2. Financial Intent Types

**Contract must support all intents defined in C1-C5:**
- `REVENUE_OBLIGATION_CREATED`
- `REVENUE_RECOGNIZED`
- `AR_OBLIGATION_CREATED`
- `OBLIGATION_UPDATED`
- `PAYMENT_RECEIVED`
- `PAYMENT_VOIDED`
- `REFUND_DUE`
- `REFUND_PROCESSED`
- `BAD_DEBT_IDENTIFIED`
- `BAD_DEBT_RECOVERED`

**Each intent must include:**
- Semantic type (what happened)
- Financial amounts
- Policy context (which capability config applied)
- Metadata (Education domain context)
- Idempotency key

### 3. Policy-Aware Routing

**Integration Layer must:**
- Load policy configuration per tenant
- Route Education events to correct capability handler
- Apply policy evaluation (WHAT should happen)
- Publish appropriate financial intent
- NOT decide financial treatment (HOW it's recorded)

### 4. Finance Contract Versioning

**Contract must support:**
- Version negotiation (Integration ↔ Finance)
- Backward compatibility (old intents still work)
- Forward compatibility (new intents ignored if not supported)
- Policy configuration versioning (policy changes don't break contract)

### 5. Generality Verification

**Phase 3 deliverable must include:**
- Generality test suite (run New Education Type Test)
- Policy combination validator (ensure valid configs accepted)
- Finance protection audit (verify Integration doesn't become accounting system)

---

## Product Definition Gate Approval Checklist

**Product Owner must verify:**

### Capability Model
- [ ] C1 (Revenue Recognition) complete and general
- [ ] C2 (Obligation Management) complete and general
- [ ] C3 (Settlement Management) complete and general
- [ ] C4 (Refund Management) complete and general
- [ ] C5 (Bad Debt Management) complete and general
- [ ] All capabilities independently configurable

### Policy Space
- [ ] Policy space adequate for all known education types
- [ ] Policy space extensible for future education types
- [ ] Policy profiles are examples, NOT requirements
- [ ] No specific policy choice mandated

### Generality Proof
- [ ] Generality Criterion 1 (Independence) PASS
- [ ] Generality Criterion 2 (New Type Test) PASS
- [ ] Generality Criterion 3 (Combination Test) PASS
- [ ] Generality Criterion 4 (Finance Protection) PASS
- [ ] Generality Criterion 5 (Extension Test) PASS
- [ ] Structural proof (not just example-based)

### Finance Protection
- [ ] Integration Layer = Business fact → Financial intent transformer
- [ ] Finance OS = Financial treatment authority
- [ ] Policy evaluation ≠ Accounting decision
- [ ] F1-F5 invariants remain in Finance OS only

### Governance
- [ ] No code written (correct governance)
- [ ] No contract designed yet (Phase 3)
- [ ] No specific policy locked in
- [ ] Capability model = Product Definition (not policy choice)

---

## Gate Pass Criteria

**This gate PASSES when:**

1. ✅ Product Owner approves Capability Model (C1-C5)
2. ✅ Product Owner confirms Policy Space adequate
3. ✅ Generality Proof accepted (5/5 criteria)
4. ✅ Finance Protection verified
5. ✅ No specific policy choice mandated

**When this gate PASSES:**
```
Product Definition Gate
       ↓
   ✅ APPROVED
       ↓
Capability Model FROZEN
       ↓
Phase 3 UNBLOCKED
       ↓
Contract Design can begin
```

**If this gate does NOT pass:**
→ Refine capability model  
→ Expand policy space  
→ Re-prove generality  
→ Resubmit for approval

---

## Strategic Significance

**If this gate passes, Bella achieves:**

**Platform Maturity Milestone:**
> Education Finance Contract becomes **Industry Integration Template**.

**Learning Effect:**
```
Hospital (Industry 1)
  → Proved: Bella handles complexity

Education (Industry 2)
  → Proves: Bella abstracts complexity into reusable pattern
  → Capability Model = Template

Industry 3+ (Manufacturing, Retail, etc.)
  → Uses: Template + Pattern
  → Duration: Even shorter
```

**Future Industry Integration:**
```
New Industry
    ↓
Define Capability Model (guided by Education template)
    ↓
Define Policy Space
    ↓
Design Industry Finance Contract (reuse pattern)
    ↓
Implement Domain Adapter
    ↓
Deploy with Policy Profiles
```

**Platform Scale Effect:**
- Industry 1 (Hospital): Longest (building foundation)
- Industry 2 (Education): Shorter (reusing Finance OS + creating template)
- Industry 3+: Even shorter (reusing Finance OS + template pattern)

---

## Next Steps After Gate Approval

**Phase 3: Contract Design**
1. Design Education Finance Contract schema (based on C1-C5)
2. Define Financial Intent message format
3. Map Education domain events → Financial intents (policy-aware)
4. Design adapter architecture (Education → Contract)
5. Prepare E-ARCH-1 gate documentation

**E-ARCH-1 Gate**
1. Verify Contract Generality (run New Type Test)
2. Verify Finance Protection (Hospital flows intact)
3. Verify Boundary Clarity (Education / Finance separation)
4. Verify Additive Integration (no breaking changes)
5. Verify Testability (regression strategy defined)

**Phase 4+: Implementation**
1. Implement Education Finance Adapter
2. Implement policy configuration management
3. Integration testing
4. Regression testing (Hospital + Finance Kernel)
5. Deploy with initial policy profile

---

## Conclusion

**Product Definition Gate Status:** 🟡 **IN PROGRESS**

**Awaiting:** Product Owner approval

**If approved:**
- Education Finance Capability Model → Product Definition ✅
- Policy Space → Adequate for all education types ✅
- Generality → Structurally proven ✅
- Finance Protection → Maintained ✅
- Phase 3 → UNBLOCKED ✅

**Significance:**
> This is not just "defining P1-P4 policies."  
> This is **defining Education Finance Integration Template** for entire Education industry.

**When this gate passes, Bella transitions from:**
- "Building Education integration" (product)
- TO: "Building Industry Integration Framework" (platform)

---

**END OF PRODUCT DEFINITION GATE**

**Awaiting Product Owner Review and Approval**

**Estimated Review Time:** 1-2 days

**Gate Approval Format:**
```
APPROVED: Product Definition Gate
  ✅ Capability Model (C1-C5) approved
  ✅ Policy Space approved
  ✅ Generality Proof accepted
  ✅ Finance Protection verified
  ✅ Ready for Phase 3 Contract Design

Signature: [Product Owner]
Date: [Date]
```

---

**Current Status:**

| Item | Status |
|------|--------|
| F1-F5 Finance Kernel | 🔒 FROZEN |
| H1.1 Finance Foundation | 🔒 FROZEN |
| H1.2 Operational Resilience | 🔒 CONDITIONAL FROZEN |
| Education v1.1 Plan | 🔒 FROZEN |
| Phase 1: Meta-Platform Constitution | 🔒 COMPLETE |
| Phase 2: Education Discovery | 🔒 COMPLETE |
| P1-P4 Policy-Space Proposal | ✅ APPROVED |
| **Product Definition Gate** | **🟡 IN PROGRESS** |
| Phase 3: Contract Design | 🔴 BLOCKED |
| E-ARCH-1 Gate | ⏳ AFTER Phase 3 |
| Implementation | ⏳ AFTER E-ARCH-1 |
