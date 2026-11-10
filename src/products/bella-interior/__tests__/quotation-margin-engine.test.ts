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
});
