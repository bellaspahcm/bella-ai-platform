import {
  calculatePeriodInventoryMovements,
  calculateWeightedAverageUnitPrice,
} from '../inventory';

describe('calculatePeriodInventoryMovements', () => {
  it('computes opening, import, export, closing quantities, values, and timestamps accurately', () => {
    const items = [
      {
        id: 'item-1',
        name: 'Ván MDF chống ẩm An Cường 17mm',
        sku: 'VAN-MDF17-AC',
        category: 'Gỗ & Ván công nghiệp',
        unit: 'Tấm',
        stock_level: 115, // live stock after period & after-period movements
        min_stock_level: 30,
        price_per_unit: 400000,
      },
    ];

    const logs = [
      // After-period export on Dec 02 (-5) -> closing on Nov 30 should be 120
      {
        id: 'l4',
        item_id: 'item-1',
        change_amount: -5,
        reason: 'session_consumption',
        notes: 'Xuất sau kỳ',
        created_at: '2026-12-02T03:00:00.000Z',
      },
      // In-period export on Nov 25 (-30)
      {
        id: 'l3',
        item_id: 'item-1',
        change_amount: -30,
        reason: 'session_consumption',
        notes: 'Xuất công trình Zenity',
        created_at: '2026-11-25T08:15:00.000Z',
      },
      // In-period import on Nov 10 (+50)
      {
        id: 'l2',
        item_id: 'item-1',
        change_amount: 50,
        reason: 'restock',
        notes: 'Nhập kho từ An Cường',
        created_at: '2026-11-10T02:30:00.000Z',
      },
    ];

    const result = calculatePeriodInventoryMovements({
      items,
      logs,
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
    });

    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.sku).toBe('VAN-MDF17-AC');
    expect(row.closing_qty).toBe(120); // 115 - (-5)
    expect(row.import_qty).toBe(50);
    expect(row.export_qty).toBe(30);
    expect(row.opening_qty).toBe(100); // 120 - 50 + 30
    expect(row.opening_value).toBe(40_000_000);
    expect(row.import_value).toBe(20_000_000);
    expect(row.export_value).toBe(12_000_000);
    expect(row.closing_value).toBe(48_000_000);
    expect(row.last_import_at).toBe('2026-11-10T02:30:00.000Z');
    expect(row.last_export_at).toBe('2026-11-25T08:15:00.000Z');

    // Only in-period logs appear in period log list, sorted newest first
    expect(result.logs).toHaveLength(2);
    expect(result.logs[0].id).toBe('l3');
    expect(result.logs[1].id).toBe('l2');
    expect(result.summary.totalClosingValue).toBe(48_000_000);
  });

  it('uses weighted average cost without retroactively altering opening/historical values when batches have different prices', () => {
    // Old stock: 100 units @ 300,000đ = 30,000,000đ
    // New batch import: 50 units @ 450,000đ = 22,500,000đ
    const newWeightedAvg = calculateWeightedAverageUnitPrice({
      currentStock: 100,
      currentUnitPrice: 300000,
      importQty: 50,
      importUnitPrice: 450000,
    });
    expect(newWeightedAvg).toBe(350000); // (30,000,000 + 22,500,000) / 150

    const result = calculatePeriodInventoryMovements({
      items: [
        {
          id: 'item-2',
          name: 'Bản lề giảm chấn Hafele',
          sku: 'BL-HAFELE-304',
          unit: 'Cái',
          stock_level: 150,
          min_stock_level: 50,
          price_per_unit: newWeightedAvg,
        },
      ],
      logs: [
        {
          id: 'imp-1',
          item_id: 'item-2',
          change_amount: 50,
          reason: 'restock',
          created_at: '2026-11-27T09:00:00.000Z',
          accounting_metadata: { unit_price: 450000 },
        },
      ],
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
    });

    const row = result.rows[0];
    expect(row.opening_qty).toBe(100);
    expect(row.import_qty).toBe(50);
    expect(row.closing_qty).toBe(150);
    expect(row.import_value).toBe(22_500_000); // exact invoice value
    expect(row.closing_value).toBe(52_500_000); // 150 * 350,000đ
    expect(row.opening_value).toBe(30_000_000); // historical 100 * 300,000đ preserved!
  });
});
