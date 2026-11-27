import { calculatePeriodInventoryMovements } from '../inventory';

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
});
