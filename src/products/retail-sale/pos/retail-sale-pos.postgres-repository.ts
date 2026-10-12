import type { QueryResult, QueryResultRow } from 'pg';

import {
  buildRetailSaleLineRecords,
  buildRetailSaleRecord,
  type RetailSaleClaim,
  type RetailSaleLineRecord,
  type RetailSalePosCommand,
  type RetailSaleRecord,
  type RetailSaleRepository,
} from './retail-sale-pos.service';

export interface RetailSalePosSqlExecutor {
  query<TRow extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<TRow> | { rows: TRow[]; rowCount: number | null }>;
}

interface RetailSaleRow extends QueryResultRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  store_id: string;
  sale_number: string;
  idempotency_key: string;
  payload_hash: string;
  status: string;
  payment_status: string;
  total_amount: string | number;
  stock_out_issue_document_id: string | null;
  finance_outbox_id: string | null;
}

interface RetailSaleLineRow extends QueryResultRow {
  id: string;
  sale_id: string;
  tenant_id: string;
  product_id: string;
  sku: string;
  logistics_item_id: string;
  logistics_location_id: string;
  quantity: string | number;
  unit_price: string | number;
  discount_amount: string | number;
  line_total: string | number;
}

export class PostgresRetailSaleRepository implements RetailSaleRepository {
  constructor(private readonly db: RetailSalePosSqlExecutor) {}

  async claimConfirmedSale(params: {
    command: RetailSalePosCommand;
    payloadHash: string;
    saleId: string;
    lineIds: string[];
  }): Promise<RetailSaleClaim> {
    const inserted = await this.db.query<RetailSaleRow>(
      `
        INSERT INTO public.retail_pos_sales (
          id, tenant_id, branch_id, store_id, sale_number, idempotency_key,
          payload_hash, status, payment_status, payment_method, currency,
          subtotal, discount_amount, tax_amount, total_amount, customer_id,
          actor_id, occurred_at
        )
        VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6,
          $7, 'confirmed', 'paid', $8, $9,
          $10, $11, $12, $13, $14::uuid,
          $15::uuid, $16
        )
        ON CONFLICT (tenant_id, business_operation, idempotency_key) DO NOTHING
        RETURNING id, tenant_id, branch_id, store_id, sale_number, idempotency_key,
                  payload_hash, status, payment_status, total_amount,
                  stock_out_issue_document_id, finance_outbox_id
      `,
      [
        params.saleId,
        params.command.tenantId,
        params.command.branchId,
        params.command.storeId,
        params.command.saleNumber,
        params.command.idempotencyKey,
        params.payloadHash,
        params.command.paymentMethod,
        params.command.currency,
        params.command.subtotal,
        params.command.discountAmount,
        params.command.taxAmount,
        params.command.totalAmount,
        params.command.customerId ?? null,
        params.command.actorId,
        params.command.occurredAt,
      ]
    );

    if (inserted.rows[0]) {
      const sale = toSaleRecord(inserted.rows[0]);
      const lines = buildRetailSaleLineRecords({
        command: params.command,
        saleId: sale.id,
        lineIds: params.lineIds,
      });
      await this.insertLines(params.command, sale.id, lines);
      return { status: 'claimed', sale, lines };
    }

    const existing = await this.readByIdempotencyKey({
      tenantId: params.command.tenantId,
      idempotencyKey: params.command.idempotencyKey,
    });
    if (existing.sale.payloadHash !== params.payloadHash) {
      return { status: 'conflict', sale: existing.sale };
    }
    if (existing.sale.stockOutIssueDocumentId && existing.sale.financeOutboxId) {
      return { status: 'completed', sale: existing.sale, lines: existing.lines };
    }
    return { status: 'claimed', sale: existing.sale, lines: existing.lines };
  }

  async markSideEffectsCompleted(params: {
    tenantId: string;
    saleId: string;
    stockOutIssueDocumentId: string;
    financeOutboxId: string;
  }): Promise<RetailSaleRecord> {
    const result = await this.db.query<RetailSaleRow>(
      `
        UPDATE public.retail_pos_sales
        SET stock_out_issue_document_id = $3::uuid,
            finance_outbox_id = $4::uuid,
            updated_at = NOW()
        WHERE tenant_id = $1::uuid
          AND id = $2::uuid
        RETURNING id, tenant_id, branch_id, store_id, sale_number, idempotency_key,
                  payload_hash, status, payment_status, total_amount,
                  stock_out_issue_document_id, finance_outbox_id
      `,
      [params.tenantId, params.saleId, params.stockOutIssueDocumentId, params.financeOutboxId]
    );
    return toSaleRecord(requireRow(result.rows[0], 'retail sale completion update returned no row'));
  }

  async readSale(params: { tenantId: string; saleId: string }): Promise<{
    sale: RetailSaleRecord;
    lines: RetailSaleLineRecord[];
  }> {
    const saleResult = await this.db.query<RetailSaleRow>(
      `
        SELECT id, tenant_id, branch_id, store_id, sale_number, idempotency_key,
               payload_hash, status, payment_status, total_amount,
               stock_out_issue_document_id, finance_outbox_id
        FROM public.retail_pos_sales
        WHERE tenant_id = $1::uuid
          AND id = $2::uuid
      `,
      [params.tenantId, params.saleId]
    );
    const sale = toSaleRecord(requireRow(saleResult.rows[0], 'retail sale not found'));
    return {
      sale,
      lines: await this.readLines(params.tenantId, sale.id),
    };
  }

  private async readByIdempotencyKey(params: {
    tenantId: string;
    idempotencyKey: string;
  }): Promise<{ sale: RetailSaleRecord; lines: RetailSaleLineRecord[] }> {
    const saleResult = await this.db.query<RetailSaleRow>(
      `
        SELECT id, tenant_id, branch_id, store_id, sale_number, idempotency_key,
               payload_hash, status, payment_status, total_amount,
               stock_out_issue_document_id, finance_outbox_id
        FROM public.retail_pos_sales
        WHERE tenant_id = $1::uuid
          AND business_operation = 'retail_pos.confirm_sale'
          AND idempotency_key = $2
      `,
      [params.tenantId, params.idempotencyKey]
    );
    const sale = toSaleRecord(requireRow(saleResult.rows[0], 'retail sale idempotency record not found'));
    return {
      sale,
      lines: await this.readLines(params.tenantId, sale.id),
    };
  }

  private async insertLines(
    command: RetailSalePosCommand,
    saleId: string,
    lines: RetailSaleLineRecord[]
  ): Promise<void> {
    for (let index = 0; index < command.lines.length; index += 1) {
      const line = command.lines[index];
      const lineRecord = lines[index];
      await this.db.query(
        `
          INSERT INTO public.retail_pos_sale_items (
            id, tenant_id, sale_id, product_id, sku, logistics_item_id,
            logistics_location_id, warehouse_sku_id, warehouse_bin_id, quantity,
            unit_of_measure, unit_price, discount_amount, line_total, lot_number,
            serial_numbers, unit_cost
          )
          VALUES (
            $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::uuid,
            $7::uuid, $8, $9, $10,
            $11, $12, $13, $14, $15,
            $16, $17
          )
        `,
        [
          lineRecord.id,
          command.tenantId,
          saleId,
          line.productId,
          line.sku,
          line.itemId,
          line.locationId,
          line.warehouseSkuId,
          line.warehouseBinId,
          line.quantity,
          line.unitOfMeasure,
          line.unitPrice,
          line.discountAmount,
          line.lineTotal,
          line.lotNumber ?? null,
          line.serialNumbers ?? null,
          line.unitCost ?? null,
        ]
      );
    }
  }

  private async readLines(tenantId: string, saleId: string): Promise<RetailSaleLineRecord[]> {
    const result = await this.db.query<RetailSaleLineRow>(
      `
        SELECT id, sale_id, tenant_id, product_id, sku, logistics_item_id,
               logistics_location_id, quantity, unit_price, discount_amount, line_total
        FROM public.retail_pos_sale_items
        WHERE tenant_id = $1::uuid
          AND sale_id = $2::uuid
        ORDER BY created_at ASC, id ASC
      `,
      [tenantId, saleId]
    );
    return result.rows.map(toLineRecord);
  }
}

function toSaleRecord(row: RetailSaleRow): RetailSaleRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id,
    storeId: row.store_id,
    saleNumber: row.sale_number,
    idempotencyKey: row.idempotency_key,
    payloadHash: row.payload_hash,
    status: 'confirmed',
    paymentStatus: 'paid',
    totalAmount: Number(row.total_amount),
    stockOutIssueDocumentId: row.stock_out_issue_document_id ?? undefined,
    financeOutboxId: row.finance_outbox_id ?? undefined,
  };
}

function toLineRecord(row: RetailSaleLineRow): RetailSaleLineRecord {
  return {
    id: row.id,
    saleId: row.sale_id,
    tenantId: row.tenant_id,
    productId: row.product_id,
    sku: row.sku,
    itemId: row.logistics_item_id,
    locationId: row.logistics_location_id,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    discountAmount: Number(row.discount_amount),
    lineTotal: Number(row.line_total),
  };
}

function requireRow<TRow>(row: TRow | undefined, message: string): TRow {
  if (!row) throw new Error(message);
  return row;
}
