import { RepairOrderService } from '@/modules/bella-auto/services/RepairOrderService';
import { ServiceAppointmentService } from '@/modules/bella-auto/services/ServiceAppointmentService';

interface QueryCall {
  table: string;
  action: string;
  filters: Array<[string, unknown]>;
}

const mockCalls: QueryCall[] = [];

jest.mock('@/lib/database/read-replica', () => ({
  getPrimaryClient: () => ({
    from(table: string) {
      const call: QueryCall = { table, action: 'read', filters: [] };
      mockCalls.push(call);
      return {
        data: table === 'auto_repair_order_items'
          ? [{ item_type: 'labor', total_amount: 100, labor_hours: 1 }]
          : { additional_technicians: [], customers: { name: 'Workshop customer' } },
        error: null,
        select() { return this; },
        update() { call.action = 'update'; return this; },
        insert() { call.action = 'insert'; return this; },
        eq(column: string, value: unknown) {
          call.filters.push([column, value]);
          return this;
        },
        single() { return this; },
      };
    },
  }),
}));

describe('Workshop service tenant query boundary', () => {
  beforeEach(() => { mockCalls.length = 0; });

  it('scopes the additional-technician read and write to the supplied tenant', async () => {
    await RepairOrderService.assignTechnician('repair-id', 'tenant-context', 'technician-id', false);
    expect(mockCalls).toEqual([
      { table: 'auto_repair_orders', action: 'read', filters: [['id', 'repair-id'], ['tenant_id', 'tenant-context']] },
      { table: 'auto_repair_orders', action: 'update', filters: [['id', 'repair-id'], ['tenant_id', 'tenant-context']] },
    ]);
  });

  it('scopes the totals update to the same tenant as the line-item read', async () => {
    await RepairOrderService.addLineItems('repair-id', 'tenant-context', []);
    expect(mockCalls.filter(call => call.action !== 'insert')).toEqual([
      { table: 'auto_repair_order_items', action: 'read', filters: [['repair_order_id', 'repair-id'], ['tenant_id', 'tenant-context']] },
      { table: 'auto_repair_orders', action: 'update', filters: [['id', 'repair-id'], ['tenant_id', 'tenant-context']] },
    ]);
  });

  it('scopes the reminder flag update to the tenant used to load the appointment', async () => {
    await ServiceAppointmentService.sendReminder('appointment-id', 'tenant-context');
    expect(mockCalls).toEqual([
      { table: 'auto_service_appointments', action: 'read', filters: [['id', 'appointment-id'], ['tenant_id', 'tenant-context']] },
      { table: 'auto_service_appointments', action: 'update', filters: [['id', 'appointment-id'], ['tenant_id', 'tenant-context']] },
    ]);
  });
});
