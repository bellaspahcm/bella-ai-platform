/**
 * Test: Platform Manufacturing Adapter
 *
 * Verifies that InteriorProductionRequestPort implementation delegates
 * correctly to Platform Manufacturing OS (ManufacturingSlice1Service).
 *
 * @module src/products/bella-interior/__tests__
 */

import { PlatformManufacturingAdapter } from '../adapters/platform-manufacturing.adapter';
import type { ManufacturingSlice1Service } from '@/platform/manufacturing/manufacturing-slice1.service';
import type { ProductionOrder } from '@/platform/manufacturing/domain/types';

describe('Bella Interior OS — Platform Manufacturing Adapter', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const actorUserId = 'user-arch-01';

  it('delegates production order creation to ManufacturingSlice1Service', async () => {
    const mockOrder: ProductionOrder = {
      id: 'mfg_po_12345',
      tenantId,
      factoryOrgUnitId: 'org-interior-factory-01',
      orderNumber: 'PO-MFG-INT-DUBAI-001',
      finishedGoodItemId: 'fg-interior-rev-001',
      targetQuantity: 8,
      uom: 'set',
      status: 'draft',
      lines: [],
      createdBy: actorUserId,
      createdAt: new Date().toISOString(),
    };

    const mockManufacturingService = {
      createProductionOrder: jest.fn().mockResolvedValue({
        value: mockOrder,
        isDuplicate: false,
      }),
    };

    const adapter = new PlatformManufacturingAdapter(
      mockManufacturingService as unknown as ManufacturingSlice1Service,
    );

    const result = await adapter.requestProduction({
      tenantId,
      actorUserId,
      designRevisionId: 'rev-001-approved',
      interiorProjectId: 'proj-001',
      projectCode: 'INT-DUBAI-001',
      requiredByDate: '2026-12-31',
      items: [
        {
          boqItemId: 'boq-item-1',
          itemName: 'Wardrobe Set',
          roomZoneName: 'Master Bedroom',
          quantity: 8,
          unit: 'set',
          carcassMaterial: 'MDF',
          doorFrontMaterial: 'Acrylic',
          surfaceFinish: 'Gloss',
          hardwareSpec: 'Blum',
          dimensionsMm: { width: 2400, depth: 600, height: 2600 },
          estimatedProductionHours: 16,
        },
      ],
    });

    expect(result.manufacturingProductionOrderId).toBe('mfg_po_12345');
    expect(result.status).toBe('draft');
    expect(mockManufacturingService.createProductionOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId: actorUserId,
      }),
      expect.objectContaining({
        targetQuantity: 8,
        uom: 'set',
      }),
    );
  });

  it('provides status query through port', async () => {
    const adapter = new PlatformManufacturingAdapter();
    const status = await adapter.getProductionStatus({
      tenantId,
      manufacturingProductionOrderId: 'mfg_po_12345',
    });

    expect(status.status).toBe('in_production');
    expect(status.currentStage).toBe('cutting_cnc');
    expect(status.completionPercent).toBe(35);
  });
});
