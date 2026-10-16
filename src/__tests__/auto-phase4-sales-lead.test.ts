import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { LeadRotationService } from '@/modules/bella-auto/services/LeadRotationService';
import { AutoSalesProvider } from '@/modules/bella-auto/services/AutoSalesProvider';

jest.setTimeout(60000);

// Mock VehicleStatusMachineService để tránh DB call thực khi transition
jest.mock('@/modules/bella-auto/services/VehicleStatusMachineService', () => ({
  VehicleStatusMachineService: {
    transition: jest.fn().mockResolvedValue({ success: true }),
    getStatus: jest.fn().mockResolvedValue('showroom'),
  }
}));

// Mock CustomerJourneyService để tránh DB call thực
jest.mock('@/modules/bella-auto/services/CustomerJourneyService', () => ({
  CustomerJourneyService: {
    transitionStage: jest.fn().mockResolvedValue({ success: true }),
  }
}));

// Mock JourneySLAMonitorService để tránh DB call thực
jest.mock('@/modules/bella-auto/services/JourneySLAMonitorService', () => ({
  JourneySLAMonitorService: {
    recordTouchpoint: jest.fn().mockResolvedValue({ success: true }),
  }
}));

/**
 * Table-aware Supabase mock factory.
 * Mỗi table có thể có data riêng và single() trả đúng data của table.
 */
type MockRow = Record<string, unknown>;
type MockDbState = {
  auto_leads?: MockRow[];
  auto_bookings?: MockRow[];
  auto_vehicles?: MockRow[];
  singleOverride?: MockRow;
  [key: string]: MockRow[] | MockRow | undefined;
};
type MockChain = {
  eq: (field: string, value: unknown) => MockChain;
  in: (field: string, value: unknown) => MockChain;
  ilike: (field: string, value: unknown) => MockChain;
  limit: (count: number) => MockChain;
  order: (column: string, options?: unknown) => Promise<{ data: MockRow[]; error: null }>;
  single: () => Promise<{ data: MockRow | null; error: { message: string } | null }>;
  maybeSingle: () => Promise<{ data: null; error: null }>;
};

function makeSupabaseMock(dbState: {
  auto_leads?: MockRow[];
  auto_bookings?: MockRow[];
  auto_vehicles?: MockRow[];
  singleOverride?: MockRow;
  [key: string]: MockRow[] | MockRow | undefined;
}) {
  /** Tạo chain có khả năng track table hiện tại */
  function makeChain(table: string) {
    const self: MockChain = {
      eq: () => self,
      in: () => self,
      ilike: () => self,
      limit: () => self,
      order: () => {
        if (table === 'auto_leads') {
          return Promise.resolve({ data: dbState.auto_leads ?? [], error: null });
        }
        return Promise.resolve({ data: [], error: null });
      },
      single: () => {
        if (table === 'auto_vehicles') {
          const vehicle = dbState.auto_vehicles?.[0] ?? null;
          return Promise.resolve({ data: vehicle, error: vehicle ? null : { message: 'Not found' } });
        }
        if (table === 'auto_bookings') {
          const booking = dbState.singleOverride ?? dbState.auto_bookings?.[0] ?? null;
          return Promise.resolve({ data: booking, error: booking ? null : { message: 'Not found' } });
        }
        if (dbState.singleOverride) {
          return Promise.resolve({ data: dbState.singleOverride, error: null });
        }
        return Promise.resolve({
          data: { id: 'booking-new-id', booking_number: 'BK-AUTO-2026-9999', deposit_amount: 100000000, deposit_paid: 0 },
          error: null
        });
      },
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
    };

    return self;
  }

  return {
    from: (table: string) => {
      const chain = makeChain(table);
      return {
        select: (_columns?: string) => chain,
        insert: (payload: MockRow) => {
          if (!Array.isArray(dbState[table])) dbState[table] = [];
          (dbState[table] as MockRow[]).push(payload);
          // insert().select().single() — trả đúng dữ liệu đã insert hoặc singleOverride
          const resultData = dbState.singleOverride ?? payload;
          return {
            select: () => ({
              single: () => Promise.resolve({ data: resultData, error: null })
            })
          };
        },
        update: (payload: MockRow) => {
          const arr = Array.isArray(dbState[table]) ? dbState[table] : undefined;
          if (arr && arr.length > 0) {
            arr[0] = { ...arr[0], ...payload };
          }
          return chain;
        },
        delete: () => ({
          eq: () => ({ eq: () => Promise.resolve({ error: null }) })
        })
      };
    },
    rpc: () => Promise.resolve({ data: 'outbox-id-123', error: null })
  };
}

describe('Phase 4: Lead & Sales Center — Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('4.2 LeadRotationService', () => {
    it('should assign lead to agent who has oldest assignment (Round Robin)', async () => {
      const dbState = {
        auto_leads: [
          { id: 'lead-001', assigned_sales_agent_id: 'agent-2', assigned_at: '2026-08-03T10:00:00Z' },
          { id: 'lead-002', assigned_sales_agent_id: 'agent-1', assigned_at: '2026-08-03T09:00:00Z' },
        ]
      };
      const supabase = makeSupabaseMock(dbState);

      const assignedAgentId = await LeadRotationService.rotateLeadRoundRobin(
        supabase,
        'tenant-001',
        'lead-new-id',
        ['agent-1', 'agent-2']
      );

      // agent-1 should receive the lead because they received a lead earlier than agent-2 (09:00 vs 10:00)
      expect(assignedAgentId).toBe('agent-1');
    });

    it('should prioritize agent with highest conversion rate (Smart Allocation)', async () => {
      const dbState = {
        auto_leads: [
          { status: 'won', assigned_sales_agent_id: 'agent-1' },
          { status: 'won', assigned_sales_agent_id: 'agent-1' },
          { status: 'lost', assigned_sales_agent_id: 'agent-2' },
        ]
      };
      const supabase = makeSupabaseMock(dbState);

      const assignedAgentId = await LeadRotationService.rotateLeadByPerformance(
        supabase,
        'tenant-001',
        'lead-new-id',
        ['agent-1', 'agent-2']
      );

      // agent-1 has 100% won rate, agent-2 has 0% won rate -> agent-1 must get the lead
      expect(assignedAgentId).toBe('agent-1');
    });
  });

  describe('4.3 AutoSalesProvider', () => {
    it('should not emit PACKAGE_SALE from AutoMove booking or deposit producer', () => {
      const source = readFileSync(
        join(process.cwd(), 'src/modules/bella-auto/services/AutoSalesProvider.ts'),
        'utf8'
      );

      expect(source).not.toContain('enqueueWithAutoClient');
      expect(source).not.toContain("eventType:     'PACKAGE_SALE'");
      expect(source).toContain('payment_received / sale_revenue_recognized');
    });

    it('should create new booking and allocate VIN without vehicle revenue outbox', async () => {
      const dbState = {
        auto_bookings: [],
        auto_vehicles: [
          { id: 'veh-001', status: 'showroom', tenant_id: 'tenant-001' }
        ],
        singleOverride: {
          id: 'booking-id-123',
          booking_number: 'BK-AUTO-2026-9999',
          tenant_id: 'tenant-001',
          customer_id: 'cust-001',
          lead_id: 'lead-001',
          variant_id: 'var-001',
          vehicle_id: 'veh-001',
          color_exterior: 'Red',
          total_price: 3000000000,
          deposit_amount: 100000000,
          deposit_paid: 0,
          payment_status: 'unpaid',
          status: 'pending',
          created_at: new Date().toISOString()
        }
      };

      const supabase = makeSupabaseMock(dbState);

      const booking = await AutoSalesProvider.createBooking(supabase, {
        tenantId: 'tenant-001',
        customerId: 'cust-001',
        leadId: 'lead-001',
        variantId: 'var-001',
        vehicleId: 'veh-001',
        colorExterior: 'Red',
        totalPrice: 3000000000,
        depositAmount: 100000000
      });

      expect(booking.bookingNumber).toBe('BK-AUTO-2026-9999');
      expect(booking.totalPrice).toBe(3000000000);
      expect(booking.paymentStatus).toBe('unpaid');
    });

    it('should update payment status when record deposit payment without recognizing vehicle revenue', async () => {
      const dbState = {
        singleOverride: {
          id: 'booking-id-123',
          booking_number: 'BK-AUTO-2026-9999',
          customer_id: 'cust-001',
          deposit_amount: 100000000,
          deposit_paid: 30000000
        },
        auto_bookings: [
          {
            id: 'booking-id-123',
            deposit_amount: 100000000,
            deposit_paid: 30000000,
            payment_status: 'partially_paid'
          }
        ]
      };

      const supabase = makeSupabaseMock(dbState);

      const result = await AutoSalesProvider.recordDepositPayment(
        supabase,
        'tenant-001',
        'booking-id-123',
        70000000 // pay 70M more to fully pay 100M deposit
      );

      expect(result.success).toBe(true);
      expect(result.paymentStatus).toBe('fully_paid');
      expect(result.depositPaid).toBe(100000000);
      expect(dbState.auto_bookings[0]).toMatchObject({
        deposit_paid: 100000000,
        payment_status: 'fully_paid',
        status: 'confirmed',
      });
    });
  });

});
