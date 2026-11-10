/**
 * Bella Interior OS — Quotation & Commercial Margin Engine — Unit Tests (Phase 2)
 *
 * Verifies:
 * - Generation of Quotations from approved BOQ with Tiered Markups
 * - 4-part Cost Breakdown computation (material, labor, hardware, finishing)
 * - CRITICAL AUTHORIZATION BOUNDARY:
 *   - ClientQuotationView strictly strips all internal COGS, margins, and markups (zero financial leakage)
 *   - InternalQuotationCostingView grants access to authorized roles and rejects unauthorized roles
 * - Profitability Analysis & Low Margin Threshold Warning (< 22%)
 * - Quotation Revision (V1 -> V2 negotiation) with price & discount adjustments
 * - Revision Diff comparison (revenue, cogs, margin, discount delta)
 * - Tenant Isolation (Gate 0) and Approved BOQ Status Gate
 *
 * @module src/products/bella-interior/__tests__/quotation-margin-engine.test.ts
 */

import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { InteriorQuotationMarginService } from '../services/interior-quotation-margin.service';
import { TenantIsolationViolationError } from '../domain/errors';
import type { InteriorBOQ, BOQItem } from '../domain/commercial-costing/types';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

const TENANT_A = 'tenant-aaa-0001-0000-000000000001';
const TENANT_B = 'tenant-bbb-0001-0000-000000000002';
const PROJECT_ID = 'proj-sunshine-0001';
const ACTOR_ID = 'estimator-001';

function makeBOQItem(overrides: Partial<BOQItem> & { id: string; category: BOQItem['category'] }): BOQItem {
  const internalUnitCost = overrides.internalUnitCost ?? 10_000_000;
  const quantity = overrides.quantity ?? 1;
  const clientUnitPrice = overrides.clientUnitPrice ?? 14_000_000;
  const internalTotalCost = internalUnitCost * quantity;
  const clientTotalPrice = clientUnitPrice * quantity;
  const grossMarginAmount = clientTotalPrice - internalTotalCost;
  const grossMarginPercent = clientTotalPrice > 0 ? (grossMarginAmount / clientTotalPrice) * 100 : 0;

  return {
    id: overrides.id,
    tenantId: TENANT_A,
    boqId: 'boq-canonical-001',
    roomZoneId: 'zone-kitchen',
    roomZoneName: 'Phòng Bếp',
    itemCode: `ITEM-${overrides.id}`,
    itemName: `Hạng mục ${overrides.id}`,
    category: overrides.category,
    dimensions: { width: 2400, depth: 600, height: 850, unit: 'mm' },
    specifications: {
      carcassMaterial: 'MDF lõi xanh An Cường',
      doorFrontMaterial: 'Acrylic bóng gương',
      surfaceFinish: 'Melamine',
      hardwareSpec: 'Blum Clip Top',
    },
    unit: 'bộ',
    quantity,
    internalUnitCost,
    internalTotalCost,
    clientUnitPrice,
    clientTotalPrice,
    grossMarginAmount,
    grossMarginPercent,
    ...overrides,
  };
}

function makeApprovedBOQ(items: BOQItem[]): InteriorBOQ {
  const totalInternal = items.reduce((s, i) => s + i.internalTotalCost, 0);
  const totalClient = items.reduce((s, i) => s + i.clientTotalPrice, 0);
  const totalMargin = totalClient - totalInternal;
  return {
    id: 'boq-canonical-001',
    tenantId: TENANT_A,
    projectId: PROJECT_ID,
    designRevisionId: 'rev-001',
    boqNumber: 'BOQ-INT-SUNSHINE-V1',
    versionNumber: 1,
    status: 'approved',
    totalInternalCost: totalInternal,
    totalClientPrice: totalClient,
    totalGrossMargin: totalMargin,
    grossMarginPercent: totalClient > 0 ? (totalMargin / totalClient) * 100 : 0,
    items,
    preparedBy: 'estimator@bellaspa.vn',
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('InteriorQuotationMarginService (Phase 2)', () => {
  let repo: InMemoryInteriorRepository;
  let service: InteriorQuotationMarginService;

  const itemCabinetry = makeBOQItem({
    id: 'comp-kitchen-cab',
    category: 'cabinetry',
    internalUnitCost: 20_000_000,
    clientUnitPrice: 0, // unassigned, test tiered markup
    quantity: 2,
    roomZoneName: 'Phòng Bếp',
  });

  const itemLooseSofa = makeBOQItem({
    id: 'comp-living-sofa',
    category: 'loose_furniture',
    internalUnitCost: 40_000_000,
    clientUnitPrice: 0, // unassigned, test tiered markup
    quantity: 1,
    roomZoneName: 'Phòng Khách',
  });

  const itemStoneIsland = makeBOQItem({
    id: 'comp-kitchen-stone',
    category: 'stone_work',
    internalUnitCost: 15_000_000,
    clientUnitPrice: 0,
    quantity: 1,
    roomZoneName: 'Phòng Bếp',
  });

  beforeEach(async () => {
    repo = new InMemoryInteriorRepository();
    service = new InteriorQuotationMarginService(repo);

    const boq = makeApprovedBOQ([itemCabinetry, itemLooseSofa, itemStoneIsland]);
    await repo.saveBOQ(TENANT_A, boq);
  });

  // ── 1. Tiered Markup Calculation ──────────────────────────────────────────

  describe('Tiered Markup Application', () => {
    test('applies 35% markup on cabinetry COGS', async () => {
      const quotation = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: 'boq-canonical-001',
        actorId: ACTOR_ID,
      });

      const cabItem = quotation.items.find((i) => i.category === 'cabinetry');
      expect(cabItem).toBeDefined();
      expect(cabItem!.markupPercent).toBe(35.0);
      // internalUnitCost = 20M -> 35% markup = 27M clientUnitPrice
      expect(cabItem!.clientUnitPrice).toBe(27_000_000);
      expect(cabItem!.clientTotalPrice).toBe(54_000_000); // qty = 2
    });

    test('applies 25% markup on loose_furniture COGS', async () => {
      const quotation = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: 'boq-canonical-001',
        actorId: ACTOR_ID,
      });

      const sofaItem = quotation.items.find((i) => i.category === 'loose_furniture');
      expect(sofaItem).toBeDefined();
      expect(sofaItem!.markupPercent).toBe(25.0);
      // internalUnitCost = 40M -> 25% markup = 50M clientUnitPrice
      expect(sofaItem!.clientUnitPrice).toBe(50_000_000);
      expect(sofaItem!.clientTotalPrice).toBe(50_000_000);
    });

    test('applies 20% markup on stone_work COGS', async () => {
      const quotation = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: 'boq-canonical-001',
        actorId: ACTOR_ID,
      });

      const stoneItem = quotation.items.find((i) => i.category === 'stone_work');
      expect(stoneItem).toBeDefined();
      expect(stoneItem!.markupPercent).toBe(20.0);
      // internalUnitCost = 15M -> 20% markup = 18M clientUnitPrice
      expect(stoneItem!.clientUnitPrice).toBe(18_000_000);
    });

    test('respects custom override markup config if provided', async () => {
      const quotation = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: 'boq-canonical-001',
        actorId: ACTOR_ID,
        tieredMarkupConfig: {
          categoryMarkups: {
            cabinetry: 40.0, // override from 35% to 40%
            loose_furniture: 25.0,
            wall_paneling: 30.0,
            stone_work: 20.0,
            metal_glass: 25.0,
            lighting_fitout: 20.0,
            curtain_soft: 25.0,
          },
        },
      });

      const cabItem = quotation.items.find((i) => i.category === 'cabinetry');
      expect(cabItem!.markupPercent).toBe(40.0);
      // internalUnitCost = 20M -> 40% markup = 28M
      expect(cabItem!.clientUnitPrice).toBe(28_000_000);
    });
  });

  // ── 2. Cost Breakdown ─────────────────────────────────────────────────────

  describe('4-Part Cost Breakdown', () => {
    test('computes material, labor, hardware, and finishing summing to exact COGS', async () => {
      const quotation = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: 'boq-canonical-001',
        actorId: ACTOR_ID,
      });

      for (const item of quotation.items) {
        expect(item.costBreakdown).toBeDefined();
        const cb = item.costBreakdown!;
        const sum = cb.materialCost + cb.laborCost + cb.hardwareCost + cb.finishingCost;
        expect(sum).toBe(item.internalTotalCost);
        expect(cb.materialCost).toBeGreaterThan(0);
        expect(cb.laborCost).toBeGreaterThan(0);
        expect(cb.hardwareCost).toBeGreaterThan(0);
      }
    });
  });

  // ── 3. STRICT DATA BOUNDARY: Client View vs Internal View ─────────────────

  describe('Authorization Boundary & Client Sanitization', () => {
    test('CRITICAL: ClientQuotationView strictly strips ALL internal financials', async () => {
      const quotation = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: 'boq-canonical-001',
        actorId: ACTOR_ID,
      });

      const clientView = await service.getClientQuotationView(TENANT_A, quotation);

      // Verify header totals exist
      expect(clientView.quotationNumber).toBe(quotation.quotationNumber);
      expect(clientView.grandTotalFormatted).toContain('đ');
      expect(clientView.itemsByZone.length).toBeGreaterThan(0);

      // CRITICAL: Ensure NO internal keys leaked onto the clientView
      const serialized = JSON.stringify(clientView);
      expect(serialized).not.toContain('internalUnitCost');
      expect(serialized).not.toContain('internalTotalCost');
      expect(serialized).not.toContain('grossMargin');
      expect(serialized).not.toContain('markupPercent');
      expect(serialized).not.toContain('totalInternalCogs');
      expect(serialized).not.toContain('costBreakdown');
      expect(serialized).not.toContain('materialCost');
      expect(serialized).not.toContain('laborCost');
    });

    test('InternalQuotationCostingView is accessible to authorized estimator roles', async () => {
      const quotation = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: 'boq-canonical-001',
        actorId: ACTOR_ID,
      });

      for (const role of ['estimator', 'lead_architect', 'director', 'admin', 'owner']) {
        const internalView = await service.getInternalCostingView(TENANT_A, quotation, role);
        expect(internalView.totalInternalCogs).toBeGreaterThan(0);
        expect(internalView.grossMarginPercent).toBeGreaterThan(0);
        expect(internalView.items.length).toBe(3);
      }
    });

    test('InternalQuotationCostingView rejects unauthorized roles', async () => {
      const quotation = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: 'boq-canonical-001',
        actorId: ACTOR_ID,
      });

      for (const role of ['client', 'guest', 'subcontractor', 'viewer']) {
        await expect(
          service.getInternalCostingView(TENANT_A, quotation, role)
        ).rejects.toThrow('AuthorizationViolation');
      }
    });
  });

  // ── 4. Profitability Analysis & Low Margin Alerts ─────────────────────────

  describe('Commercial Profitability & Margin Threshold', () => {
    test('computes category breakdowns and overall gross margin', async () => {
      const quotation = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: 'boq-canonical-001',
        actorId: ACTOR_ID,
      });

      const report = await service.analyzeProfitability(TENANT_A, quotation);
      expect(report.totalRevenue).toBe(quotation.subtotal);
      expect(report.totalCogs).toBe(quotation.totalInternalCogs);
      expect(report.grossProfit).toBe(quotation.totalGrossMargin);
      expect(report.categoryBreakdowns.length).toBe(3);
    });

    test('raises low margin warning if overall margin drops below threshold', async () => {
      // Force high discount to squeeze margin below 22%
      const quotation = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: 'boq-canonical-001',
        actorId: ACTOR_ID,
        discountAmount: 25_000_000, // deep discount
      });

      const report = await service.analyzeProfitability(TENANT_A, quotation, 25.0);
      expect(report.isMarginThresholdMet).toBe(false);
      expect(report.lowMarginWarnings.length).toBeGreaterThan(0);
      expect(report.lowMarginWarnings[0]).toContain('Cảnh báo tổng thể');
    });
  });

  // ── 5. Quotation Revision & Diff Comparison ───────────────────────────────

  describe('Quotation Revision & Diff Engine', () => {
    test('revises quotation to V2 with adjusted item price and discount', async () => {
      const v1 = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: 'boq-canonical-001',
        actorId: ACTOR_ID,
      });

      const cabItem = v1.items.find((i) => i.category === 'cabinetry')!;

      // Negotiate: Give 10% discount on cabinetry line item
      const v2 = await service.reviseQuotation(
        {
          tenantId: TENANT_A,
          sourceQuotationId: v1.id,
          actorId: ACTOR_ID,
          itemPriceAdjustments: [
            {
              itemId: cabItem.id,
              newClientUnitPrice: 25_000_000, // discounted from 27M
            },
          ],
          discountAmount: 5_000_000,
          revisionNotes: 'Giảm giá theo thỏa thuận gặp mặt ngày 10/11',
        },
        v1
      );

      expect(v2.versionNumber).toBe(2);
      expect(v2.quotationNumber).toContain('-Q2');
      expect(v2.discountAmount).toBe(5_000_000);
      expect(v2.subtotal).toBeLessThan(v1.subtotal);
      expect(v2.totalGrossMargin).toBeLessThan(v1.totalGrossMargin);
    });

    test('compares V1 vs V2 revisions producing exact financial deltas', async () => {
      const v1 = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: 'boq-canonical-001',
        actorId: ACTOR_ID,
      });

      const cabItem = v1.items.find((i) => i.category === 'cabinetry')!;
      const v2 = await service.reviseQuotation(
        {
          tenantId: TENANT_A,
          sourceQuotationId: v1.id,
          actorId: ACTOR_ID,
          itemPriceAdjustments: [
            { itemId: cabItem.id, newClientUnitPrice: 25_000_000 },
          ],
          discountAmount: 5_000_000,
        },
        v1
      );

      const diff = await service.compareQuotationRevisions(TENANT_A, v1, v2);

      expect(diff.baseVersionNumber).toBe(1);
      expect(diff.targetVersionNumber).toBe(2);
      expect(diff.revenueDelta).toBeLessThan(0); // price dropped
      expect(diff.discountDelta).toBe(5_000_000);
      expect(diff.modifiedItemsCount).toBe(1);
      expect(diff.addedItemsCount).toBe(0);
      expect(diff.removedItemsCount).toBe(0);
    });
  });

  // ── 6. Tenant Isolation & Workflow Guards ─────────────────────────────────

  describe('Tenant Isolation & Status Gates', () => {
    test('GUARD: tenant isolation on quotation generation', async () => {
      await expect(
        service.generateQuotationFromBOQ({
          tenantId: TENANT_B, // Tenant B tries to quote Tenant A's BOQ
          projectId: PROJECT_ID,
          boqId: 'boq-canonical-001',
          actorId: ACTOR_ID,
        })
      ).rejects.toThrow('QuotationGenerationError');
    });

    test('GUARD: cannot generate quotation from unapproved draft BOQ', async () => {
      const draftBOQ: InteriorBOQ = {
        ...makeApprovedBOQ([itemCabinetry]),
        id: 'boq-draft-unapproved',
        status: 'draft',
      };
      await repo.saveBOQ(TENANT_A, draftBOQ);

      await expect(
        service.generateQuotationFromBOQ({
          tenantId: TENANT_A,
          projectId: PROJECT_ID,
          boqId: 'boq-draft-unapproved',
          actorId: ACTOR_ID,
        })
      ).rejects.toThrow('Cannot generate quotation from BOQ in status "draft"');
    });

    test('GUARD: tenant isolation on client quotation view', async () => {
      const quotation = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: 'boq-canonical-001',
        actorId: ACTOR_ID,
      });

      await expect(
        service.getClientQuotationView(TENANT_B, quotation)
      ).rejects.toThrow(TenantIsolationViolationError);
    });
  });

  // ── 7. Six Architectural Hardening Verifications (User Directive Checklist) ─

  describe('Architectural Hardening Verification Checklist', () => {
    // Check 1: Gross Margin Formula vs Markup
    test('Check 1: Markup (35%) on 100M cost yields 135M price and 25.93% Gross Margin', async () => {
      const item100M = makeBOQItem({
        id: 'comp-100m-cabinetry',
        category: 'cabinetry', // 35% markup
        internalUnitCost: 100_000_000,
        clientUnitPrice: 0, // calculate from markup
        quantity: 1,
      });

      const singleItemBOQ = {
        ...makeApprovedBOQ([item100M]),
        id: 'boq-100m-unique-001',
      };
      await repo.saveBOQ(TENANT_A, singleItemBOQ);

      const quotation = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: singleItemBOQ.id,
        actorId: ACTOR_ID,
      });

      const lineItem = quotation.items[0];
      expect(lineItem.internalUnitCost).toBe(100_000_000);
      expect(lineItem.markupPercent).toBe(35.0);
      expect(lineItem.clientUnitPrice).toBe(135_000_000); // 100M * 1.35
      expect(lineItem.grossMarginAmount).toBe(35_000_000); // 135M - 100M
      // CRITICAL ASSERTION: Gross margin is 35M / 135M = 25.93%, NOT 35%!
      expect(lineItem.grossMarginPercent).toBe(25.9);
      expect(quotation.grossMarginPercent).toBe(25.9);
    });

    // Check 2: Weighted Margin Calculation
    test('Check 2: Weighted margin computes on aggregate revenue/COGS, not simple average', async () => {
      // Item A: 10M cost, 100% markup -> 20M price (50% margin)
      const itemA = makeBOQItem({
        id: 'item-small-high-margin',
        category: 'cabinetry',
        internalUnitCost: 10_000_000,
        clientUnitPrice: 20_000_000,
        quantity: 1,
      });
      // Item B: 80M cost, 25% markup -> 100M price (20% margin)
      const itemB = makeBOQItem({
        id: 'item-large-low-margin',
        category: 'loose_furniture',
        internalUnitCost: 80_000_000,
        clientUnitPrice: 100_000_000,
        quantity: 1,
      });

      const mixedBOQ: InteriorBOQ = {
        ...makeApprovedBOQ([itemA, itemB]),
        id: 'boq-mixed-margin-001',
      };
      await repo.saveBOQ(TENANT_A, mixedBOQ);

      const quotation = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: mixedBOQ.id,
        actorId: ACTOR_ID,
      });

      // Total Revenue = 120M, Total COGS = 90M, Total Margin = 30M
      // Weighted Margin = 30M / 120M = 25.0%
      // Simple Average of item margins = (50% + 20%) / 2 = 35.0%
      expect(quotation.subtotal).toBe(120_000_000);
      expect(quotation.totalInternalCogs).toBe(90_000_000);
      expect(quotation.totalGrossMargin).toBe(30_000_000);
      // CRITICAL ASSERTION: Weighted margin is 25.0%, NOT 35.0%!
      expect(quotation.grossMarginPercent).toBe(25.0);
    });

    // Check 3: Snapshot Integrity across BOQ Changes
    test('Check 3: Quotation snapshot remains 100% immutable when source BOQ is modified', async () => {
      const v1BOQ = {
        ...makeApprovedBOQ([itemCabinetry]),
        id: 'boq-snapshot-test-001',
      };
      await repo.saveBOQ(TENANT_A, v1BOQ);

      const quotationV1 = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: v1BOQ.id,
        actorId: ACTOR_ID,
      });

      const initialSubtotal = quotationV1.subtotal;
      const initialCogs = quotationV1.totalInternalCogs;

      // Now someone modifies BOQ (e.g. forks or changes quantities in a draft)
      const mutatedBOQ: InteriorBOQ = {
        ...v1BOQ,
        id: 'boq-v2-forked-unique',
        versionNumber: 2,
        status: 'draft',
        items: [
          {
            ...itemCabinetry,
            quantity: 999, // drastically changed
            internalTotalCost: 999 * itemCabinetry.internalUnitCost,
          },
        ],
      };
      await repo.saveBOQ(TENANT_A, mutatedBOQ);

      // Reload Quotation V1
      const reloadedQuotation = await repo.getQuotation(TENANT_A, quotationV1.id);
      expect(reloadedQuotation).toBeDefined();
      expect(reloadedQuotation!.subtotal).toBe(initialSubtotal);
      expect(reloadedQuotation!.totalInternalCogs).toBe(initialCogs);
      expect(reloadedQuotation!.boqVersionNumber).toBe(1);
    });

    // Check 4: Tenant Integrity
    test('Check 4: Cannot save quotation with mismatched tenant ID', async () => {
      const quotation = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: 'boq-canonical-001',
        actorId: ACTOR_ID,
      });

      // Tenant B tries to save Tenant A's quotation
      await expect(
        repo.saveQuotation(TENANT_B, quotation)
      ).rejects.toThrow(TenantIsolationViolationError);
    });

    // Check 5: Client Data Security
    test('Check 5: Client view contains zero internal financial fields in serialized JSON', async () => {
      const quotation = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: 'boq-canonical-001',
        actorId: ACTOR_ID,
      });

      const clientView = await service.getClientQuotationView(TENANT_A, quotation);
      const json = JSON.stringify(clientView);

      const forbiddenTokens = [
        'internalUnitCost',
        'internalTotalCost',
        'totalInternalCogs',
        'grossMargin',
        'grossProfit',
        'markupPercent',
        'costBreakdown',
        'materialCost',
        'laborCost',
        'hardwareCost',
        'finishingCost',
      ];

      for (const token of forbiddenTokens) {
        expect(json).not.toContain(token);
      }
    });

    // Check 6: Approval & Immutability Guard
    test('Check 6: Quotation in sent_to_client status rejects financial modifications', async () => {
      const quotation = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: 'boq-canonical-001',
        actorId: ACTOR_ID,
      });

      // Mark quotation as sent_to_client
      const sentQuotation = {
        ...quotation,
        status: 'sent_to_client' as const,
      };
      await repo.saveQuotation(TENANT_A, sentQuotation);

      // Attempt to tamper with financial terms on sent quotation
      const tamperedQuotation = {
        ...sentQuotation,
        grandTotal: 1_000_000, // malicious price drop
      };

      await expect(
        repo.saveQuotation(TENANT_A, tamperedQuotation)
      ).rejects.toThrow('QuotationImmutableError');
    });

    // Check C: Canonical Role Alignment
    test('Check C: Canonical roles OWNER, ADMIN, QS, PM succeed; CLIENT, DESIGNER fail', async () => {
      const quotation = await service.generateQuotationFromBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        boqId: 'boq-canonical-001',
        actorId: ACTOR_ID,
      });

      // Permitted canonical roles
      for (const role of ['OWNER', 'ADMIN', 'QS', 'PM', 'DIRECTOR', 'EXECUTIVE']) {
        const view = await service.getInternalCostingView(TENANT_A, quotation, role);
        expect(view).toBeDefined();
        expect(view.totalInternalCogs).toBeGreaterThan(0);
      }

      // Forbidden roles
      for (const role of ['CLIENT', 'DESIGNER', 'SUBCONTRACTOR', 'GUEST']) {
        await expect(
          service.getInternalCostingView(TENANT_A, quotation, role)
        ).rejects.toThrow('AuthorizationViolation');
      }
    });
  });
});
