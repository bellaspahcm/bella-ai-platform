import {
  buildRetailSaleLineRecords,
  buildRetailSaleRecord,
  type RetailSaleClaim,
  type RetailSalePosCommand,
  type RetailSaleRecord,
  type RetailSaleRepository,
  type RetailSaleLineRecord,
} from './retail-sale-pos.service';

export class InMemoryRetailSaleRepository implements RetailSaleRepository {
  private readonly salesByTenantAndKey = new Map<string, RetailSaleRecord>();
  private readonly salesById = new Map<string, RetailSaleRecord>();
  private readonly linesBySaleId = new Map<string, RetailSaleLineRecord[]>();

  async claimConfirmedSale(params: {
    command: RetailSalePosCommand;
    payloadHash: string;
    saleId: string;
    lineIds: string[];
  }): Promise<RetailSaleClaim> {
    const key = tenantKey(params.command.tenantId, params.command.idempotencyKey);
    const existing = this.salesByTenantAndKey.get(key);
    if (existing) {
      if (existing.payloadHash !== params.payloadHash) {
        return { status: 'conflict', sale: existing };
      }
      const lines = this.linesBySaleId.get(existing.id) ?? [];
      if (existing.financeOutboxId && existing.stockOutIssueDocumentId) {
        return { status: 'completed', sale: existing, lines };
      }
      return { status: 'claimed', sale: existing, lines };
    }

    const sale = buildRetailSaleRecord({
      command: params.command,
      saleId: params.saleId,
      payloadHash: params.payloadHash,
    });
    const lines = buildRetailSaleLineRecords({
      command: params.command,
      saleId: params.saleId,
      lineIds: params.lineIds,
    });
    this.salesByTenantAndKey.set(key, sale);
    this.salesById.set(sale.id, sale);
    this.linesBySaleId.set(sale.id, lines);
    return { status: 'claimed', sale, lines };
  }

  async markSideEffectsCompleted(params: {
    tenantId: string;
    saleId: string;
    stockOutIssueDocumentId: string;
    financeOutboxId: string;
  }): Promise<RetailSaleRecord> {
    const existing = this.salesById.get(params.saleId);
    if (!existing || existing.tenantId !== params.tenantId) {
      throw new Error('retail sale not found for side-effect completion');
    }
    const updated: RetailSaleRecord = {
      ...existing,
      stockOutIssueDocumentId: params.stockOutIssueDocumentId,
      financeOutboxId: params.financeOutboxId,
    };
    this.salesById.set(updated.id, updated);
    this.salesByTenantAndKey.set(tenantKey(updated.tenantId, updated.idempotencyKey), updated);
    return updated;
  }

  async readSale(params: { tenantId: string; saleId: string }): Promise<{
    sale: RetailSaleRecord;
    lines: RetailSaleLineRecord[];
  }> {
    const sale = this.salesById.get(params.saleId);
    if (!sale || sale.tenantId !== params.tenantId) {
      throw new Error('retail sale not found');
    }
    return {
      sale,
      lines: this.linesBySaleId.get(sale.id) ?? [],
    };
  }
}

function tenantKey(tenantId: string, idempotencyKey: string): string {
  return `${tenantId}:${idempotencyKey}`;
}
