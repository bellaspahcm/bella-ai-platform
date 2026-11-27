export const INVENTORY_REASONS = {
  initial: 'initial',
  restock: 'restock',
  sessionConsumption: 'session_consumption',
  monthlyReconciliation: 'monthly_reconciliation',
} as const;

export type InventoryMovementKind =
  | 'purchase'
  | 'consumption'
  | 'reconciliation'
  | 'unknown';

export type InventoryStockInput = {
  stockLevel: number | string | null | undefined;
  amount: number | string | null | undefined;
};

export type InventorySummaryItemLike = {
  stock_level?: number | string | null;
  min_stock_level?: number | string | null;
  price_per_unit?: number | string | null;
};

export type PackageMaterialInput = {
  item_id?: string | null;
  quantity_per_session?: number | string | null;
};

export type SessionMaterialLike = {
  quantity_per_session?: number | string | null;
  inventory_items?: {
    id?: string | null;
    price_per_unit?: number | string | null;
  } | null;
};

function asFiniteNumber(value: number | string | null | undefined, fallback = 0) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

export function classifyInventoryMovementReason(reason: string | null | undefined): InventoryMovementKind {
  const normalized = normalize(reason);

  if (['purchase', 'import', 'stock_in', INVENTORY_REASONS.restock, INVENTORY_REASONS.initial].includes(normalized)) {
    return 'purchase';
  }

  if (['consume', 'consumed', 'session_consumed', 'used', INVENTORY_REASONS.sessionConsumption].includes(normalized)) {
    return 'consumption';
  }

  if ([INVENTORY_REASONS.monthlyReconciliation, 'reconciliation', 'stock_count'].includes(normalized)) {
    return 'reconciliation';
  }

  return 'unknown';
}

export function calculateRestockMovement(input: InventoryStockInput) {
  const previousStock = Math.max(0, asFiniteNumber(input.stockLevel));
  const amount = asFiniteNumber(input.amount);

  if (amount <= 0) {
    return { error: 'Số lượng nhập kho không hợp lệ' };
  }

  return {
    previousStock,
    changeAmount: amount,
    newStock: previousStock + amount,
    reason: INVENTORY_REASONS.restock,
  };
}

export function calculateConsumptionMovement(
  input: InventoryStockInput & { itemName?: string | null },
) {
  const previousStock = Math.max(0, asFiniteNumber(input.stockLevel));
  const amount = asFiniteNumber(input.amount);

  if (amount <= 0) {
    return { error: 'Số lượng tiêu hao không hợp lệ' };
  }

  if (previousStock < amount) {
    const itemName = input.itemName || 'Mat hang';
    return {
      error: `${itemName} không đủ tồn kho (Hiện có: ${previousStock}, Cần tiêu hao: ${amount})`,
    };
  }

  return {
    previousStock,
    changeAmount: -amount,
    newStock: previousStock - amount,
    reason: INVENTORY_REASONS.sessionConsumption,
  };
}

export function calculateRollbackStock(input: {
  stockLevel: number | string | null | undefined;
  changeAmount: number | string | null | undefined;
}) {
  return Math.max(0, asFiniteNumber(input.stockLevel) + Math.abs(asFiniteNumber(input.changeAmount)));
}

export function calculateLowStockState(input: {
  stockLevel: number | string | null | undefined;
  minStockLevel: number | string | null | undefined;
}) {
  const stockLevel = Math.max(0, asFiniteNumber(input.stockLevel));
  const minStockLevel = Math.max(0, asFiniteNumber(input.minStockLevel));
  return {
    stockLevel,
    minStockLevel,
    isLowStock: stockLevel <= minStockLevel,
  };
}

export function calculateInventorySummary(items: InventorySummaryItemLike[] | null | undefined) {
  const list = items ?? [];
  return {
    totalItems: list.length,
    lowStockCount: list.filter((item) => calculateLowStockState({
      stockLevel: item.stock_level,
      minStockLevel: item.min_stock_level,
    }).isLowStock).length,
    totalValue: list.reduce(
      (sum, item) => sum + Math.max(0, asFiniteNumber(item.stock_level)) * Math.max(0, asFiniteNumber(item.price_per_unit)),
      0,
    ),
  };
}

export function normalizePackageMaterialRows(rows: PackageMaterialInput[] | null | undefined) {
  return (rows ?? [])
    .map((row) => ({
      item_id: String(row.item_id ?? '').trim(),
      quantity_per_session: asFiniteNumber(row.quantity_per_session),
    }))
    .filter((row) => row.item_id && row.quantity_per_session > 0);
}

export function calculateOpeningStock(stockLevel: number | string | null | undefined) {
  const initialStock = asFiniteNumber(stockLevel);
  if (initialStock < 0) {
    return { error: 'Tồn kho ban đầu không hợp lệ' };
  }
  return { initialStock };
}

export function calculateMonthlyReconciliationEntry(input: {
  actualStock: number | string | null | undefined;
  expectedStock: number | string | null | undefined;
  unit?: string | null;
  periodLabel: string;
  notes?: string | null;
}) {
  const actualStock = asFiniteNumber(input.actualStock, Number.NaN);
  if (!Number.isFinite(actualStock) || actualStock < 0) {
    return { error: 'Số lượng thực tế không hợp lệ' };
  }

  const expectedStock = asFiniteNumber(input.expectedStock);
  const variance = actualStock - expectedStock;
  const noteText = variance === 0
    ? `Kiểm kê tháng ${input.periodLabel}: khớp sổ${input.notes ? ` - ${input.notes}` : ''}`
    : `Kiểm kê tháng ${input.periodLabel}: thực tế ${actualStock} vs dự kiến ${expectedStock} (${variance > 0 ? '+' : ''}${variance} ${input.unit || ''})${input.notes ? ` - ${input.notes}` : ''}`;

  return {
    actualStock,
    expectedStock,
    variance,
    noteText,
    reason: INVENTORY_REASONS.monthlyReconciliation,
  };
}

export function buildSessionConsumptionPlan(materials: SessionMaterialLike[] | null | undefined) {
  const items = (materials ?? []).flatMap((material) => {
    const quantity = asFiniteNumber(material.quantity_per_session);
    const itemId = material.inventory_items?.id;
    if (!itemId || quantity <= 0) return [];

    const unitCost = Math.max(0, asFiniteNumber(material.inventory_items?.price_per_unit));
    return [{
      itemId,
      quantity,
      unitCost,
      cost: quantity * unitCost,
    }];
  });

  return {
    items,
    totalCost: items.reduce((sum, item) => sum + item.cost, 0),
  };
}

export type PeriodInventoryItemInput = {
  id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  unit: string;
  stock_level: number | string | null;
  min_stock_level?: number | string | null;
  price_per_unit?: number | string | null;
};

export type PeriodInventoryLogInput = {
  id: string;
  item_id: string;
  change_amount: number | string | null;
  reason: string;
  notes?: string | null;
  created_at?: string | null;
  accounting_metadata?: unknown;
};

export type PeriodInventoryMovementRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  price_per_unit: number;
  min_stock_level: number;
  current_stock: number;
  opening_qty: number;
  import_qty: number;
  export_qty: number;
  closing_qty: number;
  opening_value: number;
  import_value: number;
  export_value: number;
  closing_value: number;
  last_import_at: string | null;
  last_export_at: string | null;
};

export type PeriodInventoryMovementLogRow = {
  id: string;
  item_id: string;
  sku: string;
  item_name: string;
  unit: string;
  unit_price: number;
  total_value: number;
  change_amount: number;
  reason: string;
  notes: string | null;
  created_at: string | null;
};

function toVietnamIsoDate(timestamp: string | null | undefined): string | null {
  if (!timestamp) return null;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    const trimmed = String(timestamp).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
  }
  return parsed.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function extractLogUnitPrice(
  metadata: unknown,
  fallbackPrice: number,
): number {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const raw = (metadata as Record<string, unknown>).unit_price;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return fallbackPrice;
}

export function calculateWeightedAverageUnitPrice(input: {
  currentStock: number;
  currentUnitPrice: number;
  importQty: number;
  importUnitPrice: number;
}): number {
  const safeOldQty = Math.max(0, asFiniteNumber(input.currentStock));
  const safeOldPrice = Math.max(0, asFiniteNumber(input.currentUnitPrice));
  const safeImportQty = Math.max(0, asFiniteNumber(input.importQty));
  const safeImportPrice = Math.max(0, asFiniteNumber(input.importUnitPrice));
  const newTotalQty = safeOldQty + safeImportQty;
  if (newTotalQty <= 0) return safeImportPrice;
  if (safeOldQty <= 0) return Math.round(safeImportPrice);
  return Math.round(((safeOldQty * safeOldPrice) + (safeImportQty * safeImportPrice)) / newTotalQty);
}

export function calculatePeriodInventoryMovements(input: {
  items: PeriodInventoryItemInput[];
  logs: PeriodInventoryLogInput[];
  dateFrom: string;
  dateTo: string;
}) {
  const { items, logs, dateFrom, dateTo } = input;
  const itemById = new Map<string, PeriodInventoryItemInput>();
  for (const item of items) {
    itemById.set(item.id, item);
  }

  const netAfterEndQty = new Map<string, number>();
  const netAfterEndValue = new Map<string, number>();
  const importQtyMap = new Map<string, number>();
  const importValueMap = new Map<string, number>();
  const exportQtyMap = new Map<string, number>();
  const exportValueMap = new Map<string, number>();
  const lastImportMap = new Map<string, string>();
  const lastExportMap = new Map<string, string>();
  const periodLogs: PeriodInventoryMovementLogRow[] = [];

  for (const log of logs) {
    const change = asFiniteNumber(log.change_amount);
    const logDate = toVietnamIsoDate(log.created_at);
    if (!logDate) continue;

    const item = itemById.get(log.item_id);
    const fallbackPrice = Math.max(0, asFiniteNumber(item?.price_per_unit));
    const unitPrice = extractLogUnitPrice(log.accounting_metadata, fallbackPrice);

    if (logDate > dateTo) {
      netAfterEndQty.set(log.item_id, (netAfterEndQty.get(log.item_id) ?? 0) + change);
      netAfterEndValue.set(
        log.item_id,
        (netAfterEndValue.get(log.item_id) ?? 0) + change * unitPrice,
      );
      continue;
    }

    if (logDate >= dateFrom && logDate <= dateTo) {
      const createdAt = log.created_at ?? null;
      const absQty = Math.abs(change);
      const txValue = absQty * unitPrice;

      if (change > 0) {
        importQtyMap.set(log.item_id, (importQtyMap.get(log.item_id) ?? 0) + change);
        importValueMap.set(log.item_id, (importValueMap.get(log.item_id) ?? 0) + txValue);
        if (createdAt) {
          const prev = lastImportMap.get(log.item_id);
          if (!prev || createdAt > prev) lastImportMap.set(log.item_id, createdAt);
        }
      } else if (change < 0) {
        exportQtyMap.set(log.item_id, (exportQtyMap.get(log.item_id) ?? 0) + absQty);
        exportValueMap.set(log.item_id, (exportValueMap.get(log.item_id) ?? 0) + txValue);
        if (createdAt) {
          const prev = lastExportMap.get(log.item_id);
          if (!prev || createdAt > prev) lastExportMap.set(log.item_id, createdAt);
        }
      }

      periodLogs.push({
        id: log.id,
        item_id: log.item_id,
        sku: (item?.sku || '').trim() || 'N/A',
        item_name: item?.name || 'Vật tư nội thất',
        unit: item?.unit || '',
        unit_price: unitPrice,
        total_value: txValue,
        change_amount: change,
        reason: log.reason,
        notes: log.notes ?? null,
        created_at: createdAt,
      });
    }
  }

  periodLogs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  const rows: PeriodInventoryMovementRow[] = items.map((item) => {
    const currentStock = asFiniteNumber(item.stock_level);
    const minStock = Math.max(0, asFiniteNumber(item.min_stock_level));
    const unitPrice = Math.max(0, asFiniteNumber(item.price_per_unit));
    const afterDeltaQty = netAfterEndQty.get(item.id) ?? 0;
    const afterDeltaValue = netAfterEndValue.get(item.id) ?? 0;
    const importQty = importQtyMap.get(item.id) ?? 0;
    const exportQty = exportQtyMap.get(item.id) ?? 0;
    const importValue = importValueMap.get(item.id) ?? 0;
    const exportValue = exportValueMap.get(item.id) ?? 0;
    const closingQty = currentStock - afterDeltaQty;
    const openingQty = closingQty - importQty + exportQty;
    const currentValue = currentStock * unitPrice;
    const closingValue = closingQty <= 0 ? 0 : Math.max(0, currentValue - afterDeltaValue);
    const openingValue = openingQty <= 0 ? 0 : Math.max(0, closingValue - importValue + exportValue);

    return {
      id: item.id,
      sku: (item.sku || '').trim() || 'CHUA-GAN-SKU',
      name: item.name,
      category: (item.category || '').trim() || 'Vật tư nội thất',
      unit: item.unit,
      price_per_unit: unitPrice,
      min_stock_level: minStock,
      current_stock: currentStock,
      opening_qty: openingQty,
      import_qty: importQty,
      export_qty: exportQty,
      closing_qty: closingQty,
      opening_value: openingValue,
      import_value: importValue,
      export_value: exportValue,
      closing_value: closingValue,
      last_import_at: lastImportMap.get(item.id) ?? null,
      last_export_at: lastExportMap.get(item.id) ?? null,
    };
  });

  const summary = rows.reduce(
    (acc, row) => ({
      totalItems: acc.totalItems + 1,
      lowStockCount: acc.lowStockCount + (row.current_stock <= row.min_stock_level ? 1 : 0),
      totalOpeningValue: acc.totalOpeningValue + row.opening_value,
      totalImportValue: acc.totalImportValue + row.import_value,
      totalExportValue: acc.totalExportValue + row.export_value,
      totalClosingValue: acc.totalClosingValue + row.closing_value,
    }),
    {
      totalItems: 0,
      lowStockCount: 0,
      totalOpeningValue: 0,
      totalImportValue: 0,
      totalExportValue: 0,
      totalClosingValue: 0,
    },
  );

  return { rows, logs: periodLogs, summary };
}
