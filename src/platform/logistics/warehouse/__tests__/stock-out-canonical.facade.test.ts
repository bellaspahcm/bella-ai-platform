import {
  LedgerEntryType,
  TransactionStatus,
} from '../../contracts/inventory.contract';
import { TraceabilityEventType } from '../../contracts/traceability.contract';
import {
  WarehouseStockOutCanonicalFacade,
  type WarehouseStockOutCommand,
  type WarehouseStockOutIdempotencyRecord,
  type WarehouseStockOutPorts,
} from '../stock-out-canonical.facade';

describe('WarehouseStockOutCanonicalFacade', () => {
  const fixedNow = new Date('2026-10-08T09:00:00.000Z');

  function validCommand(quantity = 6): WarehouseStockOutCommand {
    return {
      tenantId: 'tenant-warehouse-1',
      actorId: 'user-issue-1',
      correlationId: 'corr-issue-1',
      issueDocument: {
        id: 'issue-1',
        number: 'ISS-001',
        type: 'warehouse_issue',
      },
      lines: [
        {
          warehouseSkuId: 'wh-sku-1',
          warehouseBinId: 'bin-1',
          itemId: 'item-1',
          locationId: 'loc-1',
          quantity,
          unitOfMeasure: 'EA',
          reason: 'disposal',
          lotNumber: 'LOT-1',
          serialNumbers: ['SN-1'],
          sourceLineId: 'issue-line-1',
          unitCost: 1000,
          currency: 'VND',
        },
      ],
    };
  }

  function createPorts(
    calls: string[],
    idempotencyRecords = new Map<string, WarehouseStockOutIdempotencyRecord>()
  ): WarehouseStockOutPorts {
    return {
      transaction: {
        run: jest.fn(async (operation) => {
          calls.push('transaction');
          return operation();
        }),
      },
      balance: {
        getSourceBalance: jest.fn(async (params) => {
          calls.push('sourceBalance');
          return {
            item_id: params.item_id,
            location_id: params.location_id,
            on_hand: 10,
            allocated: 0,
            available: 10,
            tenant_id: params.tenant_id,
            updated_at: fixedNow,
          };
        }),
        applyStockOut: jest.fn(async (mutation) => {
          calls.push('balance');
          const onHand = 10 - mutation.quantity;
          return {
            item_id: mutation.item_id,
            location_id: mutation.location_id,
            on_hand: onHand,
            allocated: 0,
            available: onHand,
            tenant_id: mutation.tenant_id,
            updated_at: fixedNow,
          };
        }),
      },
      movementLedger: {
        recordStockOut: jest.fn(async ({ mutation, balanceAfter, occurredAt }) => {
          calls.push('movementLedger');
          return {
            movement: {
              id: 'movement-issue-1',
              tenant_id: mutation.tenant_id,
              item_id: mutation.item_id,
              location_id: mutation.location_id,
              quantity: mutation.quantity,
              reason: mutation.reason,
              status: TransactionStatus.COMPLETED,
              actor_id: mutation.actor_id,
              created_at: occurredAt,
            },
            ledgerEntry: {
              id: 'ledger-issue-1',
              tenant_id: mutation.tenant_id,
              item_id: mutation.item_id,
              location_id: mutation.location_id,
              entry_type: LedgerEntryType.MOVEMENT,
              quantity_delta: -mutation.quantity,
              balance_after: balanceAfter.on_hand,
              transaction_id: 'movement-issue-1',
              actor_id: mutation.actor_id,
              reason: mutation.reason,
              created_at: occurredAt,
            },
          };
        }),
      },
      traceability: {
        recordEvent: jest.fn(async (request) => {
          calls.push('traceability');
          return {
            id: 'trace-issue-1',
            tenant_id: request.tenant_id,
            event_type: request.event_type,
            item_id: request.item_id,
            quantity: request.quantity,
            lot_number: request.lot_number,
            serial_numbers: request.serial_numbers,
            from_location_id: request.from_location_id,
            actor_id: request.actor_id,
            actor_type: request.actor_type,
            transaction_id: request.transaction_id,
            transaction_type: request.transaction_type,
            reference_id: request.reference_id,
            reference_type: request.reference_type,
            occurred_at: request.occurred_at ?? fixedNow,
            recorded_at: fixedNow,
            reason: request.reason,
            notes: request.notes,
            metadata: request.metadata,
          };
        }),
      },
      events: {
        publish: jest.fn(async () => {
          calls.push('event');
        }),
      },
      idempotency: {
        claim: jest.fn(async (params) => {
          calls.push('idempotency:claim');
          const existing = idempotencyRecords.get(`${params.operation}:${params.idempotencyKey}`);
          if (!existing) return { status: 'claimed' };
          if (existing.payloadHash !== params.payloadHash) return { status: 'conflict' };
          return { status: 'completed', record: existing };
        }),
        complete: jest.fn(async (record) => {
          calls.push('idempotency:complete');
          idempotencyRecords.set(`${record.operation}:${record.idempotencyKey}`, record);
        }),
      },
      readBack: {
        getStockOutEvidence: jest.fn(async (params) => {
          calls.push('readBack');
          return {
            balance: {
              item_id: params.item_id,
              location_id: params.location_id,
              on_hand: 4,
              allocated: 0,
              available: 4,
              tenant_id: params.tenant_id,
              updated_at: fixedNow,
            },
            movement: {
              id: params.movement_id,
              tenant_id: params.tenant_id,
              item_id: params.item_id,
              location_id: params.location_id,
              quantity: 6,
              reason: 'disposal',
              status: TransactionStatus.COMPLETED,
              actor_id: 'user-issue-1',
              created_at: fixedNow,
            },
            ledgerEntry: {
              id: 'ledger-issue-1',
              tenant_id: params.tenant_id,
              item_id: params.item_id,
              location_id: params.location_id,
              entry_type: LedgerEntryType.MOVEMENT,
              quantity_delta: -6,
              balance_after: 4,
              transaction_id: params.movement_id,
              actor_id: 'user-issue-1',
              reason: 'disposal',
              created_at: fixedNow,
            },
            traceability: {
              id: params.traceability_event_id,
              tenant_id: params.tenant_id,
              event_type: TraceabilityEventType.SHIPPED,
              item_id: params.item_id,
              quantity: 6,
              from_location_id: params.location_id,
              actor_id: 'user-issue-1',
              actor_type: 'user',
              occurred_at: fixedNow,
              recorded_at: fixedNow,
            },
          };
        }),
      },
    };
  }

  it('executes stock out through canonical source balance, balance mutation, movement/ledger, audit, event, and read-back', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockOutCanonicalFacade(ports, {
      now: () => fixedNow,
      idFactory: () => 'event-issue-1',
    });

    const result = await facade.execute(validCommand());

    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      'sourceBalance',
      'balance',
      'movementLedger',
      'traceability',
      'event',
      'readBack',
    ]);
    expect(ports.balance.applyStockOut).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-warehouse-1',
        item_id: 'item-1',
        location_id: 'loc-1',
        quantity: 6,
        reason: 'disposal',
        actor_id: 'user-issue-1',
        reference_id: 'issue-1',
      })
    );
    expect(ports.events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          event_id: 'event-issue-1',
          event_type: 'InventoryIssuedEvent',
          tenant_id: 'tenant-warehouse-1',
          causation_id: 'movement-issue-1',
        }),
        item_id: 'item-1',
        from_location_id: 'loc-1',
        quantity: 6,
        reason: 'disposal',
        reference_id: 'issue-1',
      })
    );
  });

  it('records damage issue with damaged traceability event', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockOutCanonicalFacade(ports);
    const command = validCommand();
    command.lines[0].reason = 'damage';

    const result = await facade.execute(command);

    expect(result.ok).toBe(true);
    expect(ports.traceability.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: TraceabilityEventType.DAMAGED,
        reason: 'damage',
      })
    );
  });

  it('executes production consumption with required work-order reference and Logistics idempotency', async () => {
    const calls: string[] = [];
    const idempotencyRecords = new Map<string, WarehouseStockOutIdempotencyRecord>();
    const ports = createPorts(calls, idempotencyRecords);
    const facade = new WarehouseStockOutCanonicalFacade(ports, {
      now: () => fixedNow,
      idFactory: () => 'event-production-consumption-1',
    });
    const command = validCommand();
    command.issueDocument = {
      id: 'issue-production-1',
      number: 'PC-001',
      type: 'production_consumption',
    };
    command.productionConsumptionReference = {
      productionOrderId: 'production-order-1',
      productionOrderLineId: 'production-order-line-1',
      idempotencyKey: 'production-consumption-key-1',
    };
    command.lines[0].reason = 'production_consumption';
    command.lines[0].sourceLineId = 'material-requirement-1';

    const first = await facade.execute(command);
    const second = await facade.execute(command);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('production consumption failed');
    expect(first.value.isDuplicate).toBe(false);
    expect(second.value.isDuplicate).toBe(true);
    expect(ports.balance.applyStockOut).toHaveBeenCalledTimes(1);
    expect(ports.events.publish).toHaveBeenCalledTimes(1);
    expect(ports.events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'production_consumption',
        reference_id: 'production-order-1',
        reference_type: 'work_order',
      })
    );
    expect(ports.traceability.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: TraceabilityEventType.PICKED,
        reference_id: 'issue-production-1',
        reference_type: 'production_consumption',
      })
    );
    expect(calls).toEqual([
      'transaction',
      'idempotency:claim',
      'sourceBalance',
      'balance',
      'movementLedger',
      'traceability',
      'event',
      'readBack',
      'idempotency:complete',
      'transaction',
      'idempotency:claim',
    ]);
  });

  it('executes sales order stock out with sale reference and Logistics idempotency', async () => {
    const calls: string[] = [];
    const idempotencyRecords = new Map<string, WarehouseStockOutIdempotencyRecord>();
    const ports = createPorts(calls, idempotencyRecords);
    const facade = new WarehouseStockOutCanonicalFacade(ports, {
      now: () => fixedNow,
      idFactory: () => 'event-sales-order-1',
    });
    const command = validCommand();
    command.issueDocument = {
      id: 'sale-order-1',
      number: 'RS-001',
      type: 'sales_order',
    };
    command.idempotencyKey = 'sales-order-key-1';
    command.lines[0].reason = 'sale';
    command.lines[0].sourceLineId = 'sale-line-1';

    const first = await facade.execute(command);
    const second = await facade.execute(command);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('sales order stock out failed');
    expect(first.value.isDuplicate).toBe(false);
    expect(second.value.isDuplicate).toBe(true);
    expect(ports.balance.applyStockOut).toHaveBeenCalledTimes(1);
    expect(ports.events.publish).toHaveBeenCalledTimes(1);
    expect(ports.events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'sale',
        reference_id: 'sale-order-1',
        reference_type: 'sales_order',
      })
    );
    expect(ports.traceability.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: TraceabilityEventType.SHIPPED,
        reference_id: 'sale-order-1',
        reference_type: 'sales_order',
      })
    );
    expect(ports.idempotency?.claim).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'warehouse_stock_out.sales_order',
        idempotencyKey: 'sales-order-key-1',
      })
    );
  });

  it('fails sales order stock out before mutation without idempotency key', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockOutCanonicalFacade(ports);
    const command = validCommand();
    command.issueDocument.type = 'sales_order';
    command.lines[0].reason = 'sale';

    const result = await facade.execute(command);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_OUT_SALES_ORDER_REFERENCE_REQUIRED',
        message: 'sales order stock out requires an idempotency key',
      },
    });
    expect(calls).toEqual([]);
    expect(ports.balance.applyStockOut).not.toHaveBeenCalled();
  });

  it('fails production consumption before mutation without production reference', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockOutCanonicalFacade(ports);
    const command = validCommand();
    command.issueDocument.type = 'production_consumption';
    command.lines[0].reason = 'production_consumption';

    const result = await facade.execute(command);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_OUT_PRODUCTION_REFERENCE_REQUIRED',
        message: 'production consumption requires production order, production order line, and idempotency key',
      },
    });
    expect(calls).toEqual([]);
    expect(ports.balance.applyStockOut).not.toHaveBeenCalled();
  });

  it('fails production consumption before mutation without Logistics idempotency port', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    ports.idempotency = undefined;
    const facade = new WarehouseStockOutCanonicalFacade(ports);
    const command = validCommand();
    command.issueDocument.type = 'production_consumption';
    command.productionConsumptionReference = {
      productionOrderId: 'production-order-1',
      productionOrderLineId: 'production-order-line-1',
      idempotencyKey: 'production-consumption-key-1',
    };
    command.lines[0].reason = 'production_consumption';

    const result = await facade.execute(command);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_OUT_IDEMPOTENCY_REQUIRED',
        message: 'idempotent stock out requires Logistics idempotency',
      },
    });
    expect(calls).toEqual([]);
    expect(ports.balance.applyStockOut).not.toHaveBeenCalled();
  });

  it('fails production consumption before mutation without transactional persistence', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    ports.transaction = undefined;
    const facade = new WarehouseStockOutCanonicalFacade(ports);
    const command = validCommand();
    command.issueDocument.type = 'production_consumption';
    command.productionConsumptionReference = {
      productionOrderId: 'production-order-1',
      productionOrderLineId: 'production-order-line-1',
      idempotencyKey: 'production-consumption-key-1',
    };
    command.lines[0].reason = 'production_consumption';

    const result = await facade.execute(command);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_OUT_TRANSACTION_REQUIRED',
        message: 'idempotent stock out requires transactional Logistics persistence',
      },
    });
    expect(calls).toEqual([]);
    expect(ports.balance.applyStockOut).not.toHaveBeenCalled();
  });

  it('rejects production consumption retry with conflicting payload before mutation', async () => {
    const calls: string[] = [];
    const records = new Map<string, WarehouseStockOutIdempotencyRecord>();
    const ports = createPorts(calls, records);
    const facade = new WarehouseStockOutCanonicalFacade(ports);
    const command = validCommand();
    command.issueDocument.type = 'production_consumption';
    command.productionConsumptionReference = {
      productionOrderId: 'production-order-1',
      productionOrderLineId: 'production-order-line-1',
      idempotencyKey: 'production-consumption-key-1',
    };
    command.lines[0].reason = 'production_consumption';
    await facade.execute(command);

    const changed = validCommand(5);
    changed.issueDocument.type = 'production_consumption';
    changed.productionConsumptionReference = command.productionConsumptionReference;
    changed.lines[0].reason = 'production_consumption';
    const result = await facade.execute(changed);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_OUT_IDEMPOTENCY_CONFLICT',
        message: 'idempotency key was already claimed with a different payload',
      },
    });
    expect(ports.balance.applyStockOut).toHaveBeenCalledTimes(1);
  });

  it('fails before mutation when canonical SKU mapping is missing', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockOutCanonicalFacade(ports);
    const command = validCommand();
    command.lines[0].itemId = '';

    const result = await facade.execute(command);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_OUT_CANONICAL_SKU_MISSING',
        message: 'canonical itemId is required before stock out',
        lineIndex: 0,
      },
    });
    expect(calls).toEqual([]);
  });

  it('fails before mutation when quantity is invalid', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockOutCanonicalFacade(ports);

    const result = await facade.execute(validCommand(0));

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_OUT_INVALID_QUANTITY',
        message: 'quantity must be a positive finite number',
        lineIndex: 0,
      },
    });
    expect(calls).toEqual([]);
  });

  it('fails before mutation when source balance is insufficient', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockOutCanonicalFacade(ports);

    const result = await facade.execute(validCommand(11));

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_OUT_INSUFFICIENT_SOURCE_BALANCE',
        message: 'source balance is insufficient for stock out',
        lineIndex: 0,
      },
    });
    expect(calls).toEqual(['sourceBalance']);
    expect(ports.balance.applyStockOut).not.toHaveBeenCalled();
    expect(ports.events.publish).not.toHaveBeenCalled();
  });

  it('does not publish events when movement or audit persistence fails', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    ports.movementLedger.recordStockOut = jest.fn(async () => {
      calls.push('movementLedger');
      throw new Error('movement ledger write failed');
    });
    const facade = new WarehouseStockOutCanonicalFacade(ports);

    const result = await facade.execute(validCommand());

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_OUT_RUNTIME_FAILED',
        message: 'movement ledger write failed',
      },
    });
    expect(calls).toEqual(['sourceBalance', 'balance', 'movementLedger']);
    expect(ports.events.publish).not.toHaveBeenCalled();
    expect(ports.readBack.getStockOutEvidence).not.toHaveBeenCalled();
  });
});
