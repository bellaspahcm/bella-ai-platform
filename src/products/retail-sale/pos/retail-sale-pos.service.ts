import { createHash, randomUUID } from 'crypto';

import type {
  WarehouseStockOutCommand,
  WarehouseStockOutResult,
  WarehouseStockOutSuccess,
} from '@/platform/logistics/warehouse/stock-out-canonical.facade';
import type { FinancialIntent } from '@/platform/integration-runtime/types/financial-intent.types';

export type RetailSaleStatus = 'confirmed';
export type RetailSalePaymentStatus = 'paid';
export type RetailSaleCurrency = 'VND';

export interface RetailSalePosCommand {
  tenantId: string;
  branchId: string;
  storeId: string;
  actorId: string;
  idempotencyKey: string;
  saleNumber: string;
  paymentMethod: string;
  occurredAt: Date;
  currency: RetailSaleCurrency;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  customerId?: string;
  lines: RetailSalePosLineCommand[];
}

export interface RetailSalePosLineCommand {
  productId: string;
  sku: string;
  warehouseSkuId: string;
  warehouseBinId: string;
  itemId: string;
  locationId: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
  lotNumber?: string;
  serialNumbers?: string[];
  unitCost?: number;
}

export interface RetailSaleRecord {
  id: string;
  tenantId: string;
  branchId: string;
  storeId: string;
  saleNumber: string;
  idempotencyKey: string;
  payloadHash: string;
  status: RetailSaleStatus;
  paymentStatus: RetailSalePaymentStatus;
  totalAmount: number;
  stockOutIssueDocumentId?: string;
  financeOutboxId?: string;
}

export interface RetailSaleLineRecord {
  id: string;
  saleId: string;
  tenantId: string;
  productId: string;
  sku: string;
  itemId: string;
  locationId: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
}

export type RetailSaleClaim =
  | { status: 'claimed'; sale: RetailSaleRecord; lines: RetailSaleLineRecord[] }
  | { status: 'completed'; sale: RetailSaleRecord; lines: RetailSaleLineRecord[] }
  | { status: 'conflict'; sale: RetailSaleRecord };

export interface RetailSaleRepository {
  claimConfirmedSale(params: {
    command: RetailSalePosCommand;
    payloadHash: string;
    saleId: string;
    lineIds: string[];
  }): Promise<RetailSaleClaim>;
  markSideEffectsCompleted(params: {
    tenantId: string;
    saleId: string;
    stockOutIssueDocumentId: string;
    financeOutboxId: string;
  }): Promise<RetailSaleRecord>;
  readSale(params: { tenantId: string; saleId: string }): Promise<{
    sale: RetailSaleRecord;
    lines: RetailSaleLineRecord[];
  }>;
}

export interface RetailSaleFinancePort {
  submitIntent(params: {
    tenantId: string;
    idempotencyKey: string;
    intent: FinancialIntent;
  }): Promise<{ outboxId: string }>;
  readIntent(params: { tenantId: string; outboxId: string }): Promise<{
    outboxId: string;
    tenantId: string;
    intentType: string;
    correlationId: string;
    status: string;
  }>;
}

export interface RetailSaleStockOutPort {
  execute(command: WarehouseStockOutCommand): Promise<WarehouseStockOutResult>;
}

export interface RetailSalePosServicePorts {
  repository: RetailSaleRepository;
  stockOut: RetailSaleStockOutPort;
  finance: RetailSaleFinancePort;
}

export type RetailSalePosErrorCode =
  | 'RETAIL_SALE_INVALID_COMMAND'
  | 'RETAIL_SALE_TOTAL_MISMATCH'
  | 'RETAIL_SALE_IDEMPOTENCY_CONFLICT'
  | 'RETAIL_SALE_STOCK_OUT_FAILED'
  | 'RETAIL_SALE_FINANCE_INTENT_FAILED';

export type RetailSalePosResult =
  | {
      ok: true;
      value: RetailSalePosSuccess;
    }
  | {
      ok: false;
      error: {
        code: RetailSalePosErrorCode;
        message: string;
      };
    };

export interface RetailSalePosSuccess {
  sale: RetailSaleRecord;
  lines: RetailSaleLineRecord[];
  stockOut: WarehouseStockOutSuccess;
  financeIntent: {
    outboxId: string;
    readBack: {
      outboxId: string;
      tenantId: string;
      intentType: string;
      correlationId: string;
      status: string;
    };
  };
  isDuplicate: boolean;
}

export interface RetailSalePosServiceOptions {
  idFactory?: () => string;
}

export class RetailSalePosService {
  private readonly idFactory: () => string;

  constructor(
    private readonly ports: RetailSalePosServicePorts,
    options: RetailSalePosServiceOptions = {}
  ) {
    this.idFactory = options.idFactory ?? randomUUID;
  }

  async confirmSale(command: RetailSalePosCommand): Promise<RetailSalePosResult> {
    const validation = validateCommand(command);
    if (validation) return validation;

    const payloadHash = stablePayloadHash(command);
    const saleId = this.idFactory();
    const lineIds = command.lines.map(() => this.idFactory());
    const claim = await this.ports.repository.claimConfirmedSale({
      command,
      payloadHash,
      saleId,
      lineIds,
    });

    if (claim.status === 'conflict') {
      return failure(
        'RETAIL_SALE_IDEMPOTENCY_CONFLICT',
        'retail sale idempotency key was already completed with a different payload'
      );
    }

    if (claim.status === 'completed') {
      const stockOut = await this.ports.stockOut.execute(toStockOutCommand(command, claim.sale));
      if (!stockOut.ok) {
        return failure('RETAIL_SALE_STOCK_OUT_FAILED', stockOut.error.message);
      }
      const outboxId = claim.sale.financeOutboxId;
      if (!outboxId) {
        return failure(
          'RETAIL_SALE_FINANCE_INTENT_FAILED',
          'completed retail sale is missing Finance outbox evidence'
        );
      }
      const financeReadBack = await this.ports.finance.readIntent({
        tenantId: command.tenantId,
        outboxId,
      });
      return {
        ok: true,
        value: {
          sale: claim.sale,
          lines: claim.lines,
          stockOut: stockOut.value,
          financeIntent: {
            outboxId,
            readBack: financeReadBack,
          },
          isDuplicate: true,
        },
      };
    }

    const stockOut = await this.ports.stockOut.execute(toStockOutCommand(command, claim.sale));
    if (!stockOut.ok) {
      return failure('RETAIL_SALE_STOCK_OUT_FAILED', stockOut.error.message);
    }

    const financeIntent = toFinanceIntent(command, claim.sale);
    let financeResult: { outboxId: string };
    try {
      financeResult = await this.ports.finance.submitIntent({
        tenantId: command.tenantId,
        idempotencyKey: command.idempotencyKey,
        intent: financeIntent,
      });
    } catch (error) {
      return failure(
        'RETAIL_SALE_FINANCE_INTENT_FAILED',
        error instanceof Error ? error.message : 'Finance intent submission failed'
      );
    }

    const completedSale = await this.ports.repository.markSideEffectsCompleted({
      tenantId: command.tenantId,
      saleId: claim.sale.id,
      stockOutIssueDocumentId: stockOut.value.issueDocumentId,
      financeOutboxId: financeResult.outboxId,
    });
    const readBackSale = await this.ports.repository.readSale({
      tenantId: command.tenantId,
      saleId: completedSale.id,
    });
    const financeReadBack = await this.ports.finance.readIntent({
      tenantId: command.tenantId,
      outboxId: financeResult.outboxId,
    });

    return {
      ok: true,
      value: {
        sale: readBackSale.sale,
        lines: readBackSale.lines,
        stockOut: stockOut.value,
        financeIntent: {
          outboxId: financeResult.outboxId,
          readBack: financeReadBack,
        },
        isDuplicate: false,
      },
    };
  }
}

function validateCommand(command: RetailSalePosCommand): RetailSalePosResult | null {
  const required = [
    command.tenantId,
    command.branchId,
    command.storeId,
    command.actorId,
    command.idempotencyKey,
    command.saleNumber,
    command.paymentMethod,
    command.currency,
  ];
  if (required.some((value) => !hasText(value))) {
    return failure('RETAIL_SALE_INVALID_COMMAND', 'tenant, branch, store, actor, sale, payment, and idempotency fields are required');
  }
  if (command.lines.length === 0) {
    return failure('RETAIL_SALE_INVALID_COMMAND', 'at least one retail sale line is required');
  }
  for (const line of command.lines) {
    if (
      !hasText(line.productId) ||
      !hasText(line.sku) ||
      !hasText(line.warehouseSkuId) ||
      !hasText(line.warehouseBinId) ||
      !hasText(line.itemId) ||
      !hasText(line.locationId)
    ) {
      return failure('RETAIL_SALE_INVALID_COMMAND', 'each retail sale line requires product, SKU, warehouse, item, and location identity');
    }
    if (!positiveFinite(line.quantity) || !positiveFinite(line.unitPrice)) {
      return failure('RETAIL_SALE_INVALID_COMMAND', 'line quantity and unit price must be positive numbers');
    }
    const expectedLineTotal = money(line.quantity * line.unitPrice - line.discountAmount);
    if (money(line.lineTotal) !== expectedLineTotal) {
      return failure('RETAIL_SALE_TOTAL_MISMATCH', 'line total must equal quantity * unit price minus discount');
    }
  }
  const lineSubtotal = money(command.lines.reduce((sum, line) => sum + line.lineTotal, 0));
  if (money(command.subtotal) !== lineSubtotal) {
    return failure('RETAIL_SALE_TOTAL_MISMATCH', 'sale subtotal must equal sum of line totals');
  }
  const expectedTotal = money(command.subtotal - command.discountAmount + command.taxAmount);
  if (money(command.totalAmount) !== expectedTotal) {
    return failure('RETAIL_SALE_TOTAL_MISMATCH', 'sale total must equal subtotal minus discount plus tax');
  }
  return null;
}

function toStockOutCommand(
  command: RetailSalePosCommand,
  sale: RetailSaleRecord
): WarehouseStockOutCommand {
  return {
    tenantId: command.tenantId,
    actorId: command.actorId,
    correlationId: `retail-sale:${sale.id}`,
    issueDocument: {
      id: sale.id,
      number: command.saleNumber,
      type: 'sales_order',
    },
    idempotencyKey: command.idempotencyKey,
    lines: command.lines.map((line, index) => ({
      warehouseSkuId: line.warehouseSkuId,
      warehouseBinId: line.warehouseBinId,
      itemId: line.itemId,
      locationId: line.locationId,
      quantity: line.quantity,
      unitOfMeasure: line.unitOfMeasure,
      reason: 'sale',
      lotNumber: line.lotNumber,
      serialNumbers: line.serialNumbers,
      sourceLineId: `${sale.id}:line:${index + 1}`,
      unitCost: line.unitCost,
      currency: command.currency,
      metadata: {
        retail_sale_id: sale.id,
        retail_sale_number: command.saleNumber,
        retail_product_id: line.productId,
        retail_sku: line.sku,
      },
    })),
  };
}

function toFinanceIntent(command: RetailSalePosCommand, sale: RetailSaleRecord): FinancialIntent {
  return {
    intentType: 'REVENUE_RECOGNIZED',
    tenantId: command.tenantId,
    entityId: sale.id,
    entityType: 'retail_pos_sale',
    amount: command.totalAmount,
    currency: command.currency,
    effectiveDate: command.occurredAt,
    source: 'retail_sale_pos',
    correlationId: `retail-sale:${sale.id}`,
    metadata: {
      branch_id: command.branchId,
      store_id: command.storeId,
      sale_number: command.saleNumber,
      payment_method: command.paymentMethod,
      line_count: command.lines.length,
    },
  };
}

export function buildRetailSaleRecord(params: {
  command: RetailSalePosCommand;
  saleId: string;
  payloadHash: string;
}): RetailSaleRecord {
  const { command, saleId, payloadHash } = params;
  return {
    id: saleId,
    tenantId: command.tenantId,
    branchId: command.branchId,
    storeId: command.storeId,
    saleNumber: command.saleNumber,
    idempotencyKey: command.idempotencyKey,
    payloadHash,
    status: 'confirmed',
    paymentStatus: 'paid',
    totalAmount: command.totalAmount,
  };
}

export function buildRetailSaleLineRecords(params: {
  command: RetailSalePosCommand;
  saleId: string;
  lineIds: string[];
}): RetailSaleLineRecord[] {
  return params.command.lines.map((line, index) => ({
    id: params.lineIds[index],
    saleId: params.saleId,
    tenantId: params.command.tenantId,
    productId: line.productId,
    sku: line.sku,
    itemId: line.itemId,
    locationId: line.locationId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountAmount: line.discountAmount,
    lineTotal: line.lineTotal,
  }));
}

function stablePayloadHash(command: RetailSalePosCommand): string {
  return createHash('sha256').update(stableStringify({
    ...command,
    occurredAt: command.occurredAt.toISOString(),
  })).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function failure(code: RetailSalePosErrorCode, message: string): RetailSalePosResult {
  return { ok: false, error: { code, message } };
}
