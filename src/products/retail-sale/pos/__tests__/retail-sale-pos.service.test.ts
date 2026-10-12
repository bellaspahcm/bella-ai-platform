import { InMemoryRetailSaleRepository } from '../retail-sale-pos.memory-repository';
import {
  RetailSalePosService,
  type RetailSaleFinancePort,
  type RetailSalePosCommand,
  type RetailSaleStockOutPort,
} from '../retail-sale-pos.service';
import type {
  WarehouseStockOutCommand,
  WarehouseStockOutResult,
} from '@/platform/logistics/warehouse/stock-out-canonical.facade';
import type { FinancialIntent } from '@/platform/integration-runtime/types/financial-intent.types';
import {
  TransactionStatus,
  LedgerEntryType,
} from '@/platform/logistics/contracts/inventory.contract';
import { TraceabilityEventType } from '@/platform/logistics/contracts/traceability.contract';

describe('RetailSalePosService', () => {
  it('persists sale, calls stock-out, submits Finance intent, and returns read-back evidence', async () => {
    const stockOut = new FakeStockOutPort();
    const finance = new FakeFinancePort();
    const service = createService(stockOut, finance);

    const result = await service.confirmSale(command());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.isDuplicate).toBe(false);
    expect(result.value.sale.tenantId).toBe('tenant-a');
    expect(result.value.sale.branchId).toBe('branch-a');
    expect(result.value.sale.storeId).toBe('store-a');
    expect(result.value.lines).toHaveLength(1);
    expect(stockOut.commands).toHaveLength(1);
    expect(stockOut.commands[0].issueDocument.type).toBe('sales_order');
    expect(stockOut.commands[0].lines[0].reason).toBe('sale');
    expect(finance.submitted).toHaveLength(1);
    expect(finance.submitted[0].intent.entityType).toBe('retail_pos_sale');
    expect(finance.submitted[0].intent.amount).toBe(200000);
    expect(result.value.financeIntent.readBack.status).toBe('PENDING');
  });

  it('retries the same idempotency key without duplicate sale, stock-out, or Finance intent', async () => {
    const stockOut = new FakeStockOutPort();
    const finance = new FakeFinancePort();
    const service = createService(stockOut, finance);

    const first = await service.confirmSale(command());
    const duplicate = await service.confirmSale(command());

    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(true);
    if (!first.ok || !duplicate.ok) throw new Error('expected duplicate success');
    expect(duplicate.value.isDuplicate).toBe(true);
    expect(duplicate.value.sale.id).toBe(first.value.sale.id);
    expect(duplicate.value.stockOut.lines[0].movement.id).toBe(first.value.stockOut.lines[0].movement.id);
    expect(duplicate.value.financeIntent.outboxId).toBe(first.value.financeIntent.outboxId);
    expect(stockOut.commands).toHaveLength(2);
    expect(finance.submitted).toHaveLength(1);
  });

  it('rejects same tenant/idempotency key with a different payload before side effects', async () => {
    const stockOut = new FakeStockOutPort();
    const finance = new FakeFinancePort();
    const service = createService(stockOut, finance);

    const first = await service.confirmSale(command());
    const changed = await service.confirmSale({
      ...command(),
      totalAmount: 300000,
      subtotal: 300000,
      lines: [{ ...command().lines[0], quantity: 3, lineTotal: 300000 }],
    });

    expect(first.ok).toBe(true);
    expect(changed).toEqual({
      ok: false,
      error: {
        code: 'RETAIL_SALE_IDEMPOTENCY_CONFLICT',
        message: 'retail sale idempotency key was already completed with a different payload',
      },
    });
    expect(stockOut.commands).toHaveLength(1);
    expect(finance.submitted).toHaveLength(1);
  });

  it('allows the same idempotency key in another tenant scope', async () => {
    const stockOut = new FakeStockOutPort();
    const finance = new FakeFinancePort();
    const service = createService(stockOut, finance);

    const tenantA = await service.confirmSale(command());
    const tenantB = await service.confirmSale({
      ...command(),
      tenantId: 'tenant-b',
      branchId: 'branch-b',
      storeId: 'store-b',
    });

    expect(tenantA.ok).toBe(true);
    expect(tenantB.ok).toBe(true);
    if (!tenantA.ok || !tenantB.ok) throw new Error('expected tenant-scoped success');
    expect(tenantB.value.sale.id).not.toBe(tenantA.value.sale.id);
    expect(stockOut.commands).toHaveLength(2);
    expect(finance.submitted).toHaveLength(2);
  });
});

function createService(stockOut: FakeStockOutPort, finance: FakeFinancePort): RetailSalePosService {
  let id = 0;
  return new RetailSalePosService(
    {
      repository: new InMemoryRetailSaleRepository(),
      stockOut,
      finance,
    },
    {
      idFactory: () => {
        id += 1;
        return `generated-id-${id}`;
      },
    }
  );
}

function command(): RetailSalePosCommand {
  return {
    tenantId: 'tenant-a',
    branchId: 'branch-a',
    storeId: 'store-a',
    actorId: 'cashier-a',
    idempotencyKey: 'tenant-a-sale-001',
    saleNumber: 'POS-001',
    paymentMethod: 'cash',
    occurredAt: new Date('2026-10-12T09:00:00.000Z'),
    currency: 'VND',
    subtotal: 200000,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 200000,
    lines: [{
      productId: 'retail-product-a',
      sku: 'SKU-A',
      warehouseSkuId: 'warehouse-sku-a',
      warehouseBinId: 'warehouse-bin-a',
      itemId: 'item-a',
      locationId: 'location-a',
      quantity: 2,
      unitOfMeasure: 'EA',
      unitPrice: 100000,
      discountAmount: 0,
      lineTotal: 200000,
      lotNumber: 'lot-a',
      unitCost: 40000,
    }],
  };
}

class FakeStockOutPort implements RetailSaleStockOutPort {
  readonly commands: WarehouseStockOutCommand[] = [];
  private readonly completed = new Map<string, WarehouseStockOutResult>();

  async execute(command: WarehouseStockOutCommand): Promise<WarehouseStockOutResult> {
    this.commands.push(command);
    const existing = this.completed.get(command.idempotencyKey ?? '');
    if (existing) {
      if (!existing.ok) return existing;
      return {
        ok: true,
        value: {
          ...existing.value,
          isDuplicate: true,
        },
      };
    }
    const result: WarehouseStockOutResult = {
      ok: true,
      value: {
        tenantId: command.tenantId,
        issueDocumentId: command.issueDocument.id,
        isDuplicate: false,
        lines: command.lines.map((line, index) => ({
          itemId: line.itemId,
          locationId: line.locationId,
          quantity: line.quantity,
          balanceBefore: {
            tenant_id: command.tenantId,
            item_id: line.itemId,
            location_id: line.locationId,
            on_hand: 10,
            reserved: 0,
            available: 10,
            updated_at: new Date('2026-10-12T09:00:00.000Z'),
          },
          balanceAfter: {
            tenant_id: command.tenantId,
            item_id: line.itemId,
            location_id: line.locationId,
            on_hand: 10 - line.quantity,
            reserved: 0,
            available: 10 - line.quantity,
            updated_at: new Date('2026-10-12T09:00:00.000Z'),
          },
          movement: {
            id: `movement-${index + 1}`,
            tenant_id: command.tenantId,
            item_id: line.itemId,
            location_id: line.locationId,
            quantity: line.quantity,
            reason: 'sale',
            status: TransactionStatus.COMPLETED,
            actor_id: command.actorId,
            created_at: new Date('2026-10-12T09:00:00.000Z'),
          },
          ledgerEntry: {
            id: `movement-${index + 1}`,
            tenant_id: command.tenantId,
            item_id: line.itemId,
            location_id: line.locationId,
            entry_type: LedgerEntryType.MOVEMENT,
            quantity_delta: -line.quantity,
            balance_after: 10 - line.quantity,
            transaction_id: `movement-${index + 1}`,
            actor_id: command.actorId,
            reason: 'sale',
            created_at: new Date('2026-10-12T09:00:00.000Z'),
            metadata: {},
          },
          traceabilityEvent: {
            id: `trace-${index + 1}`,
            tenant_id: command.tenantId,
            event_type: TraceabilityEventType.SHIPPED,
            item_id: line.itemId,
            lot_number: line.lotNumber,
            quantity: line.quantity,
            from_location_id: line.locationId,
            actor_id: command.actorId,
            occurred_at: new Date('2026-10-12T09:00:00.000Z'),
            transaction_id: `movement-${index + 1}`,
          },
          readBack: {
            balance: {
              tenant_id: command.tenantId,
              item_id: line.itemId,
              location_id: line.locationId,
              on_hand: 10 - line.quantity,
              reserved: 0,
              available: 10 - line.quantity,
              updated_at: new Date('2026-10-12T09:00:00.000Z'),
            },
            ledgerEntry: {
              id: `movement-${index + 1}`,
              tenant_id: command.tenantId,
              item_id: line.itemId,
              location_id: line.locationId,
              entry_type: LedgerEntryType.MOVEMENT,
              quantity_delta: -line.quantity,
              balance_after: 10 - line.quantity,
              transaction_id: `movement-${index + 1}`,
              actor_id: command.actorId,
              reason: 'sale',
              created_at: new Date('2026-10-12T09:00:00.000Z'),
              metadata: {},
            },
            movement: {
              id: `movement-${index + 1}`,
              tenant_id: command.tenantId,
              item_id: line.itemId,
              location_id: line.locationId,
              quantity: line.quantity,
              reason: 'sale',
              status: TransactionStatus.COMPLETED,
              actor_id: command.actorId,
              created_at: new Date('2026-10-12T09:00:00.000Z'),
            },
            traceability: {
              id: `trace-${index + 1}`,
              tenant_id: command.tenantId,
              event_type: TraceabilityEventType.SHIPPED,
              item_id: line.itemId,
              lot_number: line.lotNumber,
              quantity: line.quantity,
              from_location_id: line.locationId,
              actor_id: command.actorId,
              occurred_at: new Date('2026-10-12T09:00:00.000Z'),
              transaction_id: `movement-${index + 1}`,
            },
          },
        })),
      },
    };
    this.completed.set(command.idempotencyKey ?? '', result);
    return result;
  }
}

class FakeFinancePort implements RetailSaleFinancePort {
  readonly submitted: Array<{
    tenantId: string;
    idempotencyKey: string;
    intent: FinancialIntent;
  }> = [];
  private readonly outboxByTenantAndKey = new Map<string, string>();

  async submitIntent(params: {
    tenantId: string;
    idempotencyKey: string;
    intent: FinancialIntent;
  }): Promise<{ outboxId: string }> {
    this.submitted.push(params);
    const key = `${params.tenantId}:${params.idempotencyKey}`;
    const existing = this.outboxByTenantAndKey.get(key);
    if (existing) return { outboxId: existing };
    const outboxId = `outbox-${this.outboxByTenantAndKey.size + 1}`;
    this.outboxByTenantAndKey.set(key, outboxId);
    return { outboxId };
  }

  async readIntent(params: { tenantId: string; outboxId: string }): Promise<{
    outboxId: string;
    tenantId: string;
    intentType: string;
    correlationId: string;
    status: string;
  }> {
    return {
      outboxId: params.outboxId,
      tenantId: params.tenantId,
      intentType: 'REVENUE_RECOGNIZED',
      correlationId: 'retail-sale:generated-id-1',
      status: 'PENDING',
    };
  }
}
