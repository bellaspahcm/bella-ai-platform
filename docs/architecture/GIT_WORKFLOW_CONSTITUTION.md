# Git Workflow Constitution

**Status:** OPERATIONAL  
**Version:** 1.0.0  
**Effective Date:** 2026-09-13

## Purpose

This constitution establishes mandatory governance for all code changes to prevent architectural contamination and maintain Kernel integrity.

## Core Principles

### P1: Single-Scope Mandate
**Each PR touches EXACTLY ONE product vertical OR platform infrastructure.**

✅ Valid:
- Product: English Center files only
- Product: Bella Land files only  
- Platform: Org Unit Kernel only
- Infrastructure: GitHub workflows only

❌ Blocked:
- English Center + Bella Land
- Product + Kernel (unless explicit contract)
- Multiple products in one PR

### P2: Kernel Freeze Protection
**Healthcare OS Kernel (H1-H12) and Logistics Kernel (E7.1-E7.3) are FROZEN.**

Modifications require:
1. Architecture Change Request (ACR)
2. Human Architect approval
3. Full regression test suite (52/52 Healthcare, 547/547 Logistics)

### P3: Size Discipline
**PRs >100 files require explicit justification.**

Valid exceptions:
- Database migrations
- Generated code (OpenAPI, GraphQL)
- Dependency-coupled contract changes

Invalid: Feature creep, unrelated cleanup

### P4: Clean Merge Policy
**One commit per logical change. Squash on merge.**

- PR title becomes commit message
- Detailed description preserved in commit body
- Branch auto-deleted after merge

### P5: Daily Reconciliation
**All branches classified automatically:**

- **IN_MAIN:** Already merged (safe to delete)
- **CANONICAL:** Active work (preserve)
- **STALE:** 30+ days inactive (review)
- **SUPERSEDED:** Replaced by newer work (archive)

### P6: Main Protection
**Direct commits to `main` are FORBIDDEN.**

All changes via PR with:
- Scope validation check
- CI quality gates
- Architecture guard
- Automated tests

### P7: Main Branch Synchronization & Integration Policy
**Code completed on Git MUST NOT remain unintegrated outside `main`.**

1. **Main is Single Source of Truth:** `main` is authoritative; feature branches are disposable workspaces.
2. **Immediate Integration:** Completed work must be PR'd and merged immediately without waiting to bundle.
3. **Pre-Merge Sync:** Branches must be rebased/updated from `main` with all conflicts resolved (`PRE_MERGE_SYNC`).
4. **Merge Ready:** Required scoped tests and checks must pass (`MERGE_READY`). Timeout/infrastructure issues are recorded as `NOT_PROVEN` (never false `PASS`).
5. **Post-Merge Verification:** Main commit confirmed, health checked (`POST_MERGE_VERIFY`), branch deleted.
6. **Separation of Concerns:** Merging into `main` integrates development baseline; Production deployment follows independent approved deployment governance.

## Enforcement Layers

### Layer 1: AI Steering (Pre-emptive)
File: `.kiro/steering/git-workflow-enforcement.md`

Kiro AI agent enforces rules BEFORE code is written:
- Blocks multi-scope implementations
- Guides correct branch naming
- Validates PR template compliance

### Layer 2: GitHub Actions (Runtime)
Files: `.github/workflows/branch-protection.yml`

**Workflow: "Validate PR Scope"**

Runs on: Every PR to `main`

Detection logic:
```javascript
// Multi-scope contamination
if (productScopes.length > 1) {
  status = 'BLOCKED';
  conclusion = 'failure';
}

// Large PR review
if (fileCount > 100) {
  status = 'REVIEW_REQUIRED';
  conclusion = 'neutral';
}

// Kernel modification
if (kernelFiles.length > 0) {
  status = 'KERNEL_CHANGE';
  conclusion = 'neutral';
  requireACR = true;
}
```

### Layer 3: Branch Reconciliation (Scheduled)
File: `scripts/branch-reconciliation.js`

**Runs:** Daily at 00:00 UTC

Actions:
1. Fetch all remote branches
2. Check if commits in main
3. Classify: IN_MAIN / CANONICAL / STALE / SUPERSEDED
4. Generate report
5. Upload artifact

### Layer 4: Auto-Cleanup (Post-Merge)
File: `.github/workflows/branch-cleanup-on-merge.yml`

**Trigger:** PR merged to `main`

Action: Delete source branch automatically

### Layer 5: Branch Protection Rules
**GitHub Repository Settings:**

`main` branch:
- ✅ Require pull request before merging
- ✅ Require status checks to pass
  - Validate PR Scope
  - Architecture Guard
  - CI Quality Gates
- ✅ Require linear history (squash merge)
- ✅ Do not allow bypassing

## Product Scope Detection

### Healthcare Products
- Path: `src/domains/healthcare/products/{product}/`
- Kernel: `src/platform/healthcare/engines/` (FROZEN)

### Education Products
- Path: `src/domains/education/products/{product}/`
- Examples: english-center, skills-training

### Real Estate Products  
- Path: `src/domains/real-estate/products/{product}/`
- Examples: bella-land, property-management

### Platform Kernel
- Path: `src/platform/{engine}/`
- Examples: org-unit, multi-tenancy, identity
- Status: Frozen subsystems require ACR

## Branch Naming Convention

**Format:** `{scope}/{feature-name}`

**Valid scopes:**
- `product/english-center/*`
- `product/bella-land/*`
- `platform/org-unit/*`
- `infra/*` (infrastructure)
- `docs/*` (documentation)

**Invalid:**
- `feature/multi-product-update`
- `fix/english-and-land`

## PR Template Enforcement

Required sections:
1. **Product Scope Declaration**
   - Primary product
   - Secondary products (must be "None" or have exception)
2. **Changes Summary**
3. **Testing Evidence**
4. **Exception Justification** (if >100 files or multi-scope)

## Adversarial Test Coverage

**Test Suite:** 6 cases (T1-T6)

| ID | Test Case | Expected | Status |
|----|-----------|----------|--------|
| T1 | Multi-scope PR (English + Land) | ❌ BLOCKED | ⏳ |
| T2 | Valid single-scope PR | ✅ ALLOWED | ⏳ |
| T3 | Platform + Product (coupled) | ⚠️ WARNING | ⏳ |
| T4 | Large PR (120+ files) | ⚠️ REVIEW | ⏳ |
| T5 | Daily reconciliation cron | 📊 REPORT | ⏳ |
| T6 | Main branch protection | 🚫 REJECT | ⏳ |

**Acceptance:** 6/6 PASS required for "ENFORCEMENT PROVEN" status

## Exception Protocol

### Valid Exceptions
1. **Contract Changes:** Platform interface + consuming product
2. **Migrations:** Database schema + seed data
3. **Generated Code:** OpenAPI spec + TypeScript types

### Approval Process
1. PR flagged with ⚠️ WARNING
2. PR description includes justification
3. Senior architect reviews
4. Manual approval overrides check

## Incident Response

**Scenario:** Contaminated PR merged despite enforcement

**Action Plan:**
1. Revert merge commit
2. Create hotfix branch per product scope
3. Cherry-pick clean changes
4. Investigate workflow failure
5. Update enforcement logic
6. Re-run adversarial tests

## Metrics & Monitoring

**Dashboard:** GitHub Actions > Branch Protection workflow

**Weekly Report:**
- PRs blocked (multi-scope)
- PRs warned (large/coupled)
- PRs allowed (clean)
- Branches deleted (merged)
- Branches classified (reconciliation)

**Success Criteria:**
- 0 contaminated PRs merged
- <5% false positives (valid PRs blocked)
- 100% branch auto-cleanup
- Daily reconciliation runs

## Versioning

**Version 1.0.0** (2026-09-13)
- Initial constitution
- 6 principles established
- 5-layer enforcement implemented
- Adversarial test suite defined

**Future Versions:**
- Add AI-powered scope inference
- Extend to monorepo subprojects
- Integrate with project management tools

---

**Authority:** Bella SPA ERP Architecture Council  
**Enforcement:** Mandatory for all engineers  
**Review:** Quarterly  
**Contact:** Architecture team for exceptions
