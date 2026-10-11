import { expect } from '@playwright/test';

import { test } from '../fixtures/auth';

const snapshot = {
  tenantId: 'tenant-manufacturing',
  factoryOrgUnitId: 'factory-a',
  generatedAt: '2026-10-11T00:00:00.000Z',
  orders: [
    {
      order: {
        id: 'po-1',
        tenantId: 'tenant-manufacturing',
        factoryOrgUnitId: 'factory-a',
        orderNumber: 'PO-UI-001',
        finishedGoodItemId: 'fg-1',
        targetQuantity: 10,
        uom: 'EA',
        status: 'in_progress',
        lines: [
          {
            id: 'po-line-1',
            tenantId: 'tenant-manufacturing',
            productionOrderId: 'po-1',
            finishedGoodItemId: 'fg-1',
            targetQuantity: 10,
            uom: 'EA',
          },
        ],
        bomRevisionId: 'bom-1',
        createdBy: 'planner-1',
        createdAt: '2026-10-11T00:00:00.000Z',
      },
      materialRequirements: [],
      executions: [],
      qualityDispositions: [],
      operationProgress: [],
      quantities: {
        plannedQuantity: 10,
        actualQuantity: 8,
        acceptedQuantity: 7,
        rejectedQuantity: 1,
        scrapQuantity: 0,
        receivedAcceptedQuantity: 7,
        receivedRejectedQuantity: 1,
        receivedPendingQuantity: 0,
        completedQuantity: 0,
      },
      materialReadiness: 'available',
      requiredOperationCount: 2,
      completedRequiredOperationCount: 1,
      blockedOperationCount: 0,
      openQualityDispositionCount: 0,
      reconciliationStatus: 'pending_routing_completion',
      missingEvidence: ['required_operation_completion_evidence'],
    },
  ],
  workCenters: [],
  routingRevisions: [],
  bomRevisions: [],
};

test.describe('Manufacturing operational readiness browser surface', () => {
  test('renders the operational snapshot and sends a planner command through the public API route', async ({
    adminPage,
  }) => {
    await adminPage.route('**/api/manufacturing/operational-readiness?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          productKey: 'bella_manufacturing',
          tenantName: 'Bella Manufacturing E2E',
          snapshot,
        }),
      });
    });

    await adminPage.route('**/api/manufacturing/operational-readiness', async (route) => {
      const requestBody = JSON.parse(route.request().postData() ?? '{}') as {
        action?: string;
        payload?: { orderNumber?: string; targetQuantity?: number };
      };
      expect(requestBody.action).toBe('createProductionOrder');
      expect(requestBody.payload?.orderNumber).toBe('PO-UI-002');
      expect(requestBody.payload?.targetQuantity).toBe(12);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          action: requestBody.action,
          result: {
            value: {
              id: 'po-2',
              orderNumber: requestBody.payload?.orderNumber,
            },
            isDuplicate: false,
          },
          snapshot,
        }),
      });
    });

    await adminPage.goto('/dashboard/manufacturing', { waitUntil: 'domcontentloaded' });

    await expect(adminPage.getByTestId('manufacturing-dashboard')).toBeVisible();
    await expect(adminPage.getByTestId('manufacturing-order-count')).toContainText('1');
    await expect(adminPage.getByTestId('manufacturing-order-list')).toContainText('PO-UI-001');
    await expect(adminPage.getByTestId('manufacturing-order-list')).toContainText(
      'pending_routing_completion'
    );

    const planner = adminPage.getByTestId('manufacturing-planner-form');
    await planner.getByLabel('Order number').fill('PO-UI-002');
    await planner.getByLabel('Finished good').fill('fg-2');
    await planner.getByLabel('Quantity').fill('12');
    await planner.getByLabel('UOM').fill('EA');
    await planner
      .locator('form')
      .filter({ hasText: 'Production order' })
      .getByRole('button', { name: 'Create' })
      .click();

    await expect(adminPage.getByTestId('manufacturing-command-result')).toContainText('PO-UI-002');
  });
});
