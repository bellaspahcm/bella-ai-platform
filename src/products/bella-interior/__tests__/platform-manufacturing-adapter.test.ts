/**
 * Test: Platform Manufacturing Adapter
 *
 * Verifies fail-closed behavior until the Product can provide canonical
 * Manufacturing authorization context and persisted BOM references.
 *
 * @module src/products/bella-interior/__tests__
 */

import { PlatformManufacturingAdapter } from '../adapters/platform-manufacturing.adapter';

describe('Bella Interior OS — Platform Manufacturing Adapter', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const actorUserId = 'user-arch-01';

  it('fails closed without a canonical Manufacturing actor and persisted BOM context', async () => {
    const adapter = new PlatformManufacturingAdapter();

    await expect(adapter.requestProduction({
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
    })).rejects.toThrow('MANUFACTURING_AUTHORIZATION_CONTEXT_UNAVAILABLE');
  });

  it('fails closed when no persisted Manufacturing status provider is configured', async () => {
    const adapter = new PlatformManufacturingAdapter();
    await expect(adapter.getProductionStatus({
      tenantId,
      manufacturingProductionOrderId: 'mfg_po_12345',
    })).rejects.toThrow('MANUFACTURING_SERVICE_UNAVAILABLE');
  });
});

